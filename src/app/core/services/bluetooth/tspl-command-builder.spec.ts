import { describe, expect, it } from 'vitest';
import { deflate, inflate } from 'pako';
import { buildE40TsplCommandFromPixels } from './tspl-command-builder';

function makePixels(rows: boolean[][]): Uint8ClampedArray {
    const height = rows.length;
    const width = rows[0].length;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const value = rows[y][x] ? 0 : 255;
            const offset = (y * width + x) * 4;
            data[offset] = value;
            data[offset + 1] = value;
            data[offset + 2] = value;
            data[offset + 3] = 255;
        }
    }
    return data;
}

describe('buildE40TsplCommandFromPixels', () => {
    it('empaqueta los pixeles oscuros como bits en 1 (MSB primero) y comprime con windowBits=10', () => {
        const rows = [
            [true, true, true, true, false, false, false, false],
            [false, false, false, false, false, false, false, false]
        ];
        const pixels = makePixels(rows);

        const command = buildE40TsplCommandFromPixels(pixels, 8, 2, {
            widthMm: 101.6,
            heightMm: 152.4,
            copies: 2
        });

        const text = new TextDecoder('latin1').decode(command);
        expect(text).toContain('SIZE 102 mm,152 mm\r\n');
        expect(text).toContain('GAP 2 mm,0 mm\r\n');
        expect(text).toContain('DENSITY 8\r\n');
        expect(text).toContain('SPEED 4\r\n');
        expect(text).toContain('DIRECTION 0\r\n');
        expect(text).toContain('REFERENCE 0,0\r\n');
        expect(text).toContain('CLS\r\n');
        expect(text.endsWith('\r\nPRINT 1,2\r\n')).toBe(true);

        // bytesPerRow = ceil(8/8) = 1, height = 2
        const marker = 'BITMAP 0,0,1,2,3,';
        const markerIndex = text.indexOf(marker);
        expect(markerIndex).toBeGreaterThan(-1);
        const lengthStart = markerIndex + marker.length;
        const commaIndex = text.indexOf(',', lengthStart);
        const declaredLength = Number(text.slice(lengthStart, commaIndex));

        const compressedStart = commaIndex + 1;
        const compressed = command.subarray(compressedStart, compressedStart + declaredLength);
        expect(compressed.length).toBe(declaredLength);

        const raw = inflate(compressed);
        expect(Array.from(raw)).toEqual([0b11110000, 0b00000000]);

        // Mismo resultado que un deflate independiente con la misma config (zlib, windowBits=10).
        expect(deflate(new Uint8Array(raw), { windowBits: 10 })).toEqual(compressed);
    });

    it('usa bobina continua ("GAP 0 mm,0 mm") cuando gapMm es 0', () => {
        const command = buildE40TsplCommandFromPixels(makePixels([[false]]), 1, 1, {
            widthMm: 50,
            heightMm: 50,
            gapMm: 0
        });
        const text = new TextDecoder('latin1').decode(command);
        expect(text).toContain('GAP 0 mm,0 mm\r\n');
    });
});
