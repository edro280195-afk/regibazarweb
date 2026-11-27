import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';
import type { LabelPrinterProfile } from '../../models';
import { NiimbotB1PrintService } from './niimbot-b1-print.service';
import { buildE40TsplCommand, TsplCommandOptions } from './tspl-command-builder';

const SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const WRITE_CHARACTERISTIC_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';

const PRINTER_DEVICE_ID_KEY = 'regi_bt_printer_device_id';
const PRINTER_NAME_KEY = 'regi_bt_printer_name';
const PRINTER_PROFILE_KEY = 'regi_bt_printer_profile';

const DEFAULT_CHUNK_SIZE = 182;
const CONNECT_RETRY_DELAYS_MS = [400, 1000, 2000];

export class BluetoothPrintError extends Error {
    constructor(message: string, readonly code: string) {
        super(message);
        this.name = 'BluetoothPrintError';
    }
}

export interface PairedPrinter {
    deviceId: string;
    name: string;
    profile: LabelPrinterProfile;
}

/**
 * Impresión directa por BLE a la AIYIN E40 Pro — sin diálogo de impresión del
 * sistema operativo. Puerto del protocolo ya validado en producción por
 * nenis-app (Flutter) y regibazardelivery (Android nativo): mismo servicio
 * BLE (FFF0/FFF2), mismos reintentos solo en la fase de conexión, misma
 * política de "un envío parcial descarta la sesión" (ver sendCommand).
 */
@Injectable({ providedIn: 'root' })
export class BluetoothPrinterService {
    private readonly niimbotPrinter = inject(NiimbotB1PrintService);
    private initialized = false;
    private connectedDeviceId: string | null = null;
    private jobQueue: Promise<void> = Promise.resolve();

    /** La impresión directa solo tiene sentido en la app empaquetada (Android/iOS), no en el navegador. */
    isSupported(): boolean {
        return Capacitor.isNativePlatform();
    }

    /**
     * Pedido best-effort al iniciar la app, para no interrumpir con el diálogo
     * de permiso justo cuando ya se quiere imprimir. Si la usuaria lo niega
     * aquí, el error real (con mensaje claro) aparece recién cuando de verdad
     * intente escanear o imprimir.
     */
    async requestPermissions(): Promise<void> {
        if (!this.isSupported()) return;
        try {
            await this.ensureReady();
        } catch {
            // silencioso a propósito
        }
    }

    getPairedPrinter(profile?: LabelPrinterProfile): PairedPrinter | null {
        const deviceId = localStorage.getItem(PRINTER_DEVICE_ID_KEY);
        const name = localStorage.getItem(PRINTER_NAME_KEY);
        if (!deviceId || !name) return null;
        const savedProfile = localStorage.getItem(PRINTER_PROFILE_KEY);
        const printerProfile: LabelPrinterProfile = savedProfile === 'NiimbotB1_50x50' || savedProfile === 'AiyinE40_4x6'
            ? savedProfile
            : this.profileForName(name);
        if (profile && profile !== printerProfile) return null;
        return { deviceId, name, profile: printerProfile };
    }

    pairPrinter(printer: PairedPrinter): void {
        localStorage.setItem(PRINTER_DEVICE_ID_KEY, printer.deviceId);
        localStorage.setItem(PRINTER_NAME_KEY, printer.name);
        localStorage.setItem(PRINTER_PROFILE_KEY, printer.profile);
    }

    forgetPrinter(): void {
        const current = this.connectedDeviceId;
        localStorage.removeItem(PRINTER_DEVICE_ID_KEY);
        localStorage.removeItem(PRINTER_NAME_KEY);
        localStorage.removeItem(PRINTER_PROFILE_KEY);
        if (current) {
            this.connectedDeviceId = null;
            BleClient.disconnect(current).catch(() => undefined);
        }
    }

    /**
     * Escanea impresoras NIIMBOT B1 y AIYIN E40 cercanas por BLE. No filtra por servicio en la
     * radio: algunas unidades solo publican el servicio de impresión después
     * de conectar, y en iOS un filtro de servicio solo encuentra servicios
     * incluidos en el anuncio.
     */
    async scanForPrinters(timeoutMs = 6000): Promise<PairedPrinter[]> {
        if (!this.isSupported()) {
            throw new BluetoothPrintError(
                'La impresión Bluetooth solo está disponible en la app instalada, no en el navegador.',
                'unsupported_platform'
            );
        }
        await this.ensureReady();

        console.log('[BluetoothPrinter] escaneando…');
        const found = new Map<string, PairedPrinter>();
        await BleClient.requestLEScan({}, result => {
            const name = (result.device.name ?? result.localName ?? '').trim();
            console.log(`[BluetoothPrinter] visto: "${name || '(sin nombre)'}" (${result.device.deviceId})`);
            const upperName = name.toUpperCase();
            const profile = upperName.startsWith('B1')
                ? 'NiimbotB1_50x50'
                : this.isAiyinName(upperName) ? 'AiyinE40_4x6' : null;
            if (name && profile) {
                found.set(result.device.deviceId, { deviceId: result.device.deviceId, name, profile });
            }
        });
        await new Promise(resolve => setTimeout(resolve, timeoutMs));
        await BleClient.stopLEScan();

        console.log(`[BluetoothPrinter] fin del escaneo, ${found.size} impresora(s) compatible(s) encontrada(s)`);
        return Array.from(found.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    /** Imprime un lienzo ya renderizado (ver LabelRendererService.render) en la impresora emparejada. */
    async printCanvas(canvas: HTMLCanvasElement, options: TsplCommandOptions): Promise<void> {
        if (!this.isSupported()) {
            throw new BluetoothPrintError(
                'La impresión Bluetooth solo está disponible en la app instalada, no en el navegador.',
                'unsupported_platform'
            );
        }
        const printer = this.getPairedPrinter();
        if (!printer) {
            throw new BluetoothPrintError('Primero conecta la impresora Bluetooth desde Ajustes.', 'printer_not_paired');
        }
        if (printer.profile === 'NiimbotB1_50x50') {
            const job = this.jobQueue.then(() => this.niimbotPrinter.printCanvas(printer.deviceId, canvas));
            this.jobQueue = job.catch(() => undefined);
            return job;
        }

        const command = buildE40TsplCommand(canvas, options);

        const job = this.jobQueue.then(() => this.sendCommand(printer, command));
        this.jobQueue = job.catch(() => undefined);
        return job;
    }

    async printCanvases(canvases: readonly HTMLCanvasElement[], options: TsplCommandOptions): Promise<void> {
        const printer = this.getPairedPrinter();
        if (!printer) {
            throw new BluetoothPrintError('Primero conecta la impresora Bluetooth desde Ajustes.', 'printer_not_paired');
        }
        if (printer.profile === 'NiimbotB1_50x50') {
            const job = this.jobQueue.then(() => this.niimbotPrinter.printCanvases(printer.deviceId, canvases));
            this.jobQueue = job.catch(() => undefined);
            return job;
        }
        for (const canvas of canvases) await this.printCanvas(canvas, options);
    }

    private profileForName(name: string): LabelPrinterProfile {
        return name.trim().toUpperCase().startsWith('B1') ? 'NiimbotB1_50x50' : 'AiyinE40_4x6';
    }

    private isAiyinName(name: string): boolean {
        const upper = name.toUpperCase();
        return upper.includes('AIYIN') || upper.includes('E40') || upper.endsWith('_BLE');
    }

    private async ensureReady(): Promise<void> {
        if (!this.initialized) {
            try {
                await BleClient.initialize();
                this.initialized = true;
                console.log('[BluetoothPrinter] BLE inicializado');
            } catch (error) {
                console.error('[BluetoothPrinter] BleClient.initialize() falló:', error);
                throw new BluetoothPrintError(
                    'Regi Bazar necesita permiso de Bluetooth para conectar la impresora. Actívalo en los ajustes del teléfono.',
                    'permission_denied'
                );
            }
        }

        const enabled = await BleClient.isEnabled().catch(() => true);
        if (enabled) return;

        if (Capacitor.getPlatform() === 'android') {
            try {
                await BleClient.requestEnable();
            } catch (error) {
                console.error('[BluetoothPrinter] requestEnable() falló:', error);
                throw new BluetoothPrintError('Activa Bluetooth para conectar la impresora.', 'bluetooth_disabled');
            }
        } else {
            throw new BluetoothPrintError('Activa Bluetooth para conectar la impresora.', 'bluetooth_disabled');
        }
    }

    /**
     * Solo esta fase (buscar/conectar/verificar servicio) se reintenta.
     * Reintentar una escritura ya en curso podría imprimir la misma etiqueta
     * dos veces si una parte del comando ya llegó a la impresora.
     */
    private async sendCommand(printer: PairedPrinter, command: Uint8Array): Promise<void> {
        console.log(`[BluetoothPrinter] enviando comando de ${command.length} bytes a ${printer.name} (${printer.deviceId})`);
        await this.withConnectRetry(() => this.getOrOpenConnection(printer));
        try {
            await this.writeInChunks(printer.deviceId, command);
            console.log('[BluetoothPrinter] comando enviado completo');
        } catch (error) {
            console.error('[BluetoothPrinter] falló el envío del comando:', error);
            await this.discardConnection(printer.deviceId);
            throw error instanceof BluetoothPrintError
                ? error
                : new BluetoothPrintError(
                    'No pudimos enviar la etiqueta a la impresora: revisa que esté encendida y cerca.',
                    'write_failed'
                );
        }
    }

    private async getOrOpenConnection(printer: PairedPrinter): Promise<void> {
        await this.ensureReady();
        if (this.connectedDeviceId === printer.deviceId) return;
        if (this.connectedDeviceId) await this.discardConnection(this.connectedDeviceId);

        console.log(`[BluetoothPrinter] conectando a ${printer.name} (${printer.deviceId})…`);
        try {
            await BleClient.connect(printer.deviceId, deviceId => {
                console.warn(`[BluetoothPrinter] la impresora se desconectó (${deviceId})`);
                if (this.connectedDeviceId === deviceId) this.connectedDeviceId = null;
            });
            console.log('[BluetoothPrinter] conectado');
        } catch (error) {
            console.error('[BluetoothPrinter] connect() falló:', error);
            throw new BluetoothPrintError(
                'No encontramos la impresora. Enciéndela y acércala al teléfono.',
                'device_not_found'
            );
        }

        try {
            const services = await BleClient.getServices(printer.deviceId);
            console.log('[BluetoothPrinter] servicios GATT:', services.map(s => s.uuid));
            const hasPrintCharacteristic = services.some(
                service =>
                    service.uuid.toLowerCase() === SERVICE_UUID &&
                    service.characteristics.some(characteristic => characteristic.uuid.toLowerCase() === WRITE_CHARACTERISTIC_UUID)
            );
            if (!hasPrintCharacteristic) {
                console.error(`[BluetoothPrinter] no se encontró el servicio ${SERVICE_UUID} / característica ${WRITE_CHARACTERISTIC_UUID}`);
                throw new BluetoothPrintError(
                    'Esta impresora no tiene el servicio de impresión Bluetooth esperado.',
                    'characteristic_not_found'
                );
            }
        } catch (error) {
            console.error('[BluetoothPrinter] descubrimiento de servicios falló:', error);
            await this.discardConnection(printer.deviceId);
            throw error instanceof BluetoothPrintError
                ? error
                : new BluetoothPrintError('No pudimos preparar la impresora para imprimir.', 'service_discovery_failed');
        }

        this.connectedDeviceId = printer.deviceId;
    }

    private async writeInChunks(deviceId: string, command: Uint8Array): Promise<void> {
        let mtu = DEFAULT_CHUNK_SIZE + 3;
        try {
            mtu = await BleClient.getMtu(deviceId);
        } catch {
            // se usa el valor por defecto conservador
        }
        const chunkSize = Math.min(512, Math.max(20, mtu - 3));
        console.log(`[BluetoothPrinter] mtu=${mtu} chunkSize=${chunkSize} total=${command.length} bytes`);

        let offset = 0;
        let chunkIndex = 0;
        while (offset < command.length) {
            const end = Math.min(offset + chunkSize, command.length);
            const chunk = command.subarray(offset, end);
            const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
            await BleClient.writeWithoutResponse(deviceId, SERVICE_UUID, WRITE_CHARACTERISTIC_UUID, view);
            chunkIndex++;
            offset = end;
        }
        console.log(`[BluetoothPrinter] ${chunkIndex} chunk(s) escritos`);
    }

    private async discardConnection(deviceId: string): Promise<void> {
        if (this.connectedDeviceId === deviceId) this.connectedDeviceId = null;
        try {
            await BleClient.disconnect(deviceId);
        } catch {
            // puede que ya estuviera desconectada
        }
    }

    private async withConnectRetry(attempt: () => Promise<void>): Promise<void> {
        const maxAttempts = 3;
        let lastError: unknown;
        for (let i = 0; i < maxAttempts; i++) {
            try {
                await attempt();
                return;
            } catch (error) {
                lastError = error;
                if (i === maxAttempts - 1) break;
                await new Promise(resolve => setTimeout(resolve, CONNECT_RETRY_DELAYS_MS[i]));
            }
        }
        throw lastError;
    }
}
