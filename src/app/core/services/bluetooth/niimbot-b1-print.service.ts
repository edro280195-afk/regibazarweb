import { Injectable } from '@angular/core';
import { BleClient } from '@capacitor-community/bluetooth-le';
import {
    buildPage,
    handshake,
    imageDataToRows,
    LabelType,
    parsePackets,
    printJob,
    readModelId,
    type Link,
    type Packet
} from '@slastra/nblib';

const SERVICE_UUID = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2';
const CHARACTERISTIC_UUID = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f';
const PRINT_HEAD_WIDTH = 384;
const DEFAULT_WRITE_SIZE = 20;
const WRITE_PACE_MS = 10;

interface ReceiveWaiter {
    commands: readonly number[];
    resolve: (packet: Packet | null) => void;
    timeoutId: ReturnType<typeof setTimeout>;
}

interface NiimbotLinkState {
    link: Link;
    receiveNotification: (value: DataView) => void;
    clearWaiters: () => void;
}

@Injectable({ providedIn: 'root' })
export class NiimbotB1PrintService {
    async printCanvas(deviceId: string, canvas: HTMLCanvasElement): Promise<void> {
        await this.printCanvases(deviceId, [canvas]);
    }

    async printCanvases(deviceId: string, canvases: readonly HTMLCanvasElement[]): Promise<void> {
        if (!canvases.length) return;

        const state = this.createLinkState(deviceId);
        let connected = false;
        let notificationsStarted = false;
        try {
            await BleClient.connect(deviceId, () => state.clearWaiters());
            connected = true;

            const services = await BleClient.getServices(deviceId);
            const hasPrinterChannel = services.some(service =>
                service.uuid.toLowerCase() === SERVICE_UUID &&
                service.characteristics.some(item => item.uuid.toLowerCase() === CHARACTERISTIC_UUID)
            );
            if (!hasPrinterChannel) {
                throw new Error('La NIIMBOT no expuso el canal BLE de impresión esperado.');
            }

            await BleClient.startNotifications(
                deviceId,
                SERVICE_UUID,
                CHARACTERISTIC_UUID,
                state.receiveNotification
            );
            notificationsStarted = true;

            await this.openLink(state.link);
            const modelId = await readModelId(state.link);
            if (modelId !== 4096) {
                throw new Error(`La impresora conectada no es una NIIMBOT B1 (modelo ${modelId}).`);
            }

            const pages = canvases.map(canvas => this.buildPage(canvas));
            const builders = pages.map(page => async () => page);
            const printed = await printJob(state.link, builders, {
                density: 5,
                labelType: LabelType.WithGaps
            });
            if (printed !== canvases.length) {
                throw new Error(`La NIIMBOT confirmó ${printed} de ${canvases.length} etiquetas.`);
            }
        } catch (error) {
            console.error('[NiimbotB1] falló la impresión BLE:', error);
            throw new Error(error instanceof Error && error.message
                ? error.message
                : 'No pudimos imprimir en la NIIMBOT B1. Revisa que esté encendida y cerca.');
        } finally {
            state.clearWaiters();
            if (notificationsStarted) {
                await BleClient.stopNotifications(deviceId, SERVICE_UUID, CHARACTERISTIC_UUID).catch(() => undefined);
            }
            if (connected) await BleClient.disconnect(deviceId).catch(() => undefined);
        }
    }

    private async openLink(link: Link): Promise<void> {
        let lastError: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await handshake(link, 1200);
                return;
            } catch (error) {
                lastError = error;
                if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 350));
            }
        }
        throw lastError instanceof Error ? lastError : new Error('La NIIMBOT no respondió al saludo BLE.');
    }

    private buildPage(canvas: HTMLCanvasElement) {
        const raster = document.createElement('canvas');
        raster.width = PRINT_HEAD_WIDTH;
        raster.height = canvas.height;
        const context = raster.getContext('2d', { alpha: false });
        if (!context) throw new Error('No se pudo preparar la imagen para la NIIMBOT B1.');
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, raster.width, raster.height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(canvas, 0, 0, raster.width, raster.height);
        const pixels = context.getImageData(0, 0, raster.width, raster.height);
        const rows = imageDataToRows(pixels);
        return buildPage(rows, { align: 'center' });
    }

    private createLinkState(deviceId: string): NiimbotLinkState {
        let remainder: ReturnType<typeof parsePackets>['rest'] = new Uint8Array();
        const packets: Packet[] = [];
        const waiters: ReceiveWaiter[] = [];

        const receiveNotification = (value: DataView): void => {
            const incoming = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
            const joined = new Uint8Array(remainder.length + incoming.length);
            joined.set(remainder);
            joined.set(incoming, remainder.length);
            const parsed = parsePackets(joined);
            remainder = parsed.rest;

            for (const packet of parsed.packets) {
                const waiterIndex = waiters.findIndex(waiter => waiter.commands.includes(packet.cmd));
                if (waiterIndex >= 0) {
                    const [waiter] = waiters.splice(waiterIndex, 1);
                    clearTimeout(waiter.timeoutId);
                    waiter.resolve(packet);
                } else {
                    packets.push(packet);
                    if (packets.length > 64) packets.shift();
                }
            }
        };

        const link: Link = {
            send: async bytes => {
                for (let offset = 0; offset < bytes.length; offset += DEFAULT_WRITE_SIZE) {
                    const chunk = bytes.subarray(offset, Math.min(offset + DEFAULT_WRITE_SIZE, bytes.length));
                    await BleClient.writeWithoutResponse(
                        deviceId,
                        SERVICE_UUID,
                        CHARACTERISTIC_UUID,
                        new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength)
                    );
                    if (offset + chunk.length < bytes.length) {
                        await new Promise(resolve => setTimeout(resolve, WRITE_PACE_MS));
                    }
                }
            },
            receive: (commands, timeoutMs) => {
                const packetIndex = packets.findIndex(packet => commands.includes(packet.cmd));
                if (packetIndex >= 0) return Promise.resolve(packets.splice(packetIndex, 1)[0]);

                return new Promise(resolve => {
                    const waiter: ReceiveWaiter = {
                        commands,
                        resolve,
                        timeoutId: setTimeout(() => {
                            const index = waiters.indexOf(waiter);
                            if (index >= 0) waiters.splice(index, 1);
                            resolve(null);
                        }, timeoutMs)
                    };
                    waiters.push(waiter);
                });
            }
        };

        return {
            link,
            receiveNotification,
            clearWaiters: () => {
                while (waiters.length) {
                    const waiter = waiters.shift();
                    if (!waiter) continue;
                    clearTimeout(waiter.timeoutId);
                    waiter.resolve(null);
                }
            }
        };
    }
}
