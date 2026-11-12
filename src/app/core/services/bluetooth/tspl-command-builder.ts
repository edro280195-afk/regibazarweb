import { deflate } from 'pako';

export interface TsplCommandOptions {
    /** Tamaño físico de la etiqueta, en mm (se redondea al entero más cercano). */
    widthMm: number;
    heightMm: number;
    /** Separación entre etiquetas en la bobina. 0 = bobina continua. */
    gapMm?: number;
    /** 0-15, entre más alto más oscuro/caliente el cabezal. */
    density?: number;
    copies?: number;
}

/**
 * Arma el comando TSPL (modo BITMAP comprimido 3) para la AIYIN E40 Pro, byte
 * por byte, replicando el protocolo ya validado en producción en nenis-app y
 * regibazardelivery: raster monocromo 1bpp + deflate con windowBits=10 (zlib,
 * no raw) es lo único que ese equipo realmente imprime por BLE.
 *
 * Separado de la lectura del canvas para poder probar el empaquetado de bits
 * y el encabezado TSPL con un bitmap sintético, sin depender de un
 * HTMLCanvasElement real (jsdom no implementa getImageData).
 */
export function buildE40TsplCommandFromPixels(
    pixels: Uint8ClampedArray | Uint8Array,
    width: number,
    height: number,
    options: TsplCommandOptions
): Uint8Array {
    const gapMm = options.gapMm ?? 2;
    const density = options.density ?? 8;
    const copies = options.copies ?? 1;
    const widthMm = Math.round(options.widthMm);
    const heightMm = Math.round(options.heightMm);

    const bytesPerRow = (width + 7) >> 3;
    const bitmap = new Uint8Array(bytesPerRow * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Un pixel oscuro (canal rojo, la etiqueta ya viene en blanco/negro puro)
            // enciende el bit, igual que exige el modo comprimido 3 de la impresora.
            const luminance = pixels[(y * width + x) * 4];
            if (luminance < 128) {
                const byteIndex = y * bytesPerRow + (x >> 3);
                bitmap[byteIndex] |= 1 << (7 - (x & 7));
            }
        }
    }

    const compressedBitmap = deflate(bitmap, { windowBits: 10 });

    const encoder = new TextEncoder();
    const header = encoder.encode(
        `SIZE ${widthMm} mm,${heightMm} mm\r\n` +
        `GAP ${gapMm > 0 ? gapMm : 0} mm,0 mm\r\n` +
        `DENSITY ${density}\r\n` +
        `SPEED 4\r\n` +
        `DIRECTION 0\r\n` +
        `REFERENCE 0,0\r\n` +
        `CLS\r\n` +
        `BITMAP 0,0,${bytesPerRow},${height},3,${compressedBitmap.length},`
    );
    const footer = encoder.encode(`\r\nPRINT 1,${copies}\r\n`);

    const command = new Uint8Array(header.length + compressedBitmap.length + footer.length);
    command.set(header, 0);
    command.set(compressedBitmap, header.length);
    command.set(footer, header.length + compressedBitmap.length);
    return command;
}

export function buildE40TsplCommand(canvas: HTMLCanvasElement, options: TsplCommandOptions): Uint8Array {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('No se pudo leer la etiqueta para armar el comando de impresión.');

    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    return buildE40TsplCommandFromPixels(data, canvas.width, canvas.height, options);
}
