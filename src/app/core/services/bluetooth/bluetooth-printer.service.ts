import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { buildE40TsplCommand, TsplCommandOptions } from './tspl-command-builder';

const SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const WRITE_CHARACTERISTIC_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';

const PRINTER_DEVICE_ID_KEY = 'regi_bt_printer_device_id';
const PRINTER_NAME_KEY = 'regi_bt_printer_name';

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
    private initialized = false;
    private connectedDeviceId: string | null = null;
    private jobQueue: Promise<void> = Promise.resolve();

    /** La impresión directa solo tiene sentido en la app empaquetada (Android/iOS), no en el navegador. */
    isSupported(): boolean {
        return Capacitor.isNativePlatform();
    }

    getPairedPrinter(): PairedPrinter | null {
        const deviceId = localStorage.getItem(PRINTER_DEVICE_ID_KEY);
        const name = localStorage.getItem(PRINTER_NAME_KEY);
        return deviceId && name ? { deviceId, name } : null;
    }

    pairPrinter(printer: PairedPrinter): void {
        localStorage.setItem(PRINTER_DEVICE_ID_KEY, printer.deviceId);
        localStorage.setItem(PRINTER_NAME_KEY, printer.name);
    }

    forgetPrinter(): void {
        const current = this.connectedDeviceId;
        localStorage.removeItem(PRINTER_DEVICE_ID_KEY);
        localStorage.removeItem(PRINTER_NAME_KEY);
        if (current) {
            this.connectedDeviceId = null;
            BleClient.disconnect(current).catch(() => undefined);
        }
    }

    /**
     * Escanea impresoras AIYIN cercanas por BLE. No filtra por servicio en la
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

        const found = new Map<string, PairedPrinter>();
        await BleClient.requestLEScan({}, result => {
            const name = (result.device.name ?? result.localName ?? '').trim();
            if (name && this.isAiyinName(name)) {
                found.set(result.device.deviceId, { deviceId: result.device.deviceId, name });
            }
        });
        await new Promise(resolve => setTimeout(resolve, timeoutMs));
        await BleClient.stopLEScan();

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
        const command = buildE40TsplCommand(canvas, options);

        const job = this.jobQueue.then(() => this.sendCommand(printer, command));
        this.jobQueue = job.catch(() => undefined);
        return job;
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
            } catch {
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
            } catch {
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
        await this.withConnectRetry(() => this.getOrOpenConnection(printer));
        try {
            await this.writeInChunks(printer.deviceId, command);
        } catch (error) {
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

        try {
            await BleClient.connect(printer.deviceId, deviceId => {
                if (this.connectedDeviceId === deviceId) this.connectedDeviceId = null;
            });
        } catch {
            throw new BluetoothPrintError(
                'No encontramos la impresora. Enciéndela y acércala al teléfono.',
                'device_not_found'
            );
        }

        try {
            const services = await BleClient.getServices(printer.deviceId);
            const hasPrintCharacteristic = services.some(
                service =>
                    service.uuid.toLowerCase() === SERVICE_UUID &&
                    service.characteristics.some(characteristic => characteristic.uuid.toLowerCase() === WRITE_CHARACTERISTIC_UUID)
            );
            if (!hasPrintCharacteristic) {
                throw new BluetoothPrintError(
                    'Esta impresora no tiene el servicio de impresión Bluetooth esperado.',
                    'characteristic_not_found'
                );
            }
        } catch (error) {
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

        let offset = 0;
        while (offset < command.length) {
            const end = Math.min(offset + chunkSize, command.length);
            const chunk = command.subarray(offset, end);
            const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
            await BleClient.writeWithoutResponse(deviceId, SERVICE_UUID, WRITE_CHARACTERISTIC_UUID, view);
            offset = end;
        }
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
