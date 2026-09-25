import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Printer } from '@capgo/capacitor-printer';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import {
    LabelDesignDefinition,
    LabelAlignment,
    LabelElementDefinition,
    LabelElementProperties,
    LabelPrinterProfile
} from '../models';

export interface LabelPrinterProfileSpec {
    id: LabelPrinterProfile;
    name: string;
    widthMm: number;
    heightMm: number;
    dpi: number;
    calibrationHint: string;
}

export interface LabelRenderOptions {
    data: Readonly<Record<string, string>>;
    assetUrls?: ReadonlyMap<string, string>;
    scale?: number;
    monochrome?: boolean;
}

const PRINTER_PROFILES: Record<LabelPrinterProfile, LabelPrinterProfileSpec> = {
    NiimbotB1_50x50: {
        id: 'NiimbotB1_50x50',
        name: 'NIIMBOT B1 · 50 × 50 mm',
        widthMm: 50,
        heightMm: 50,
        dpi: 203,
        calibrationHint: 'Usa una etiqueta 50 × 50 mm y deja la escala en 100% en la app NIIMBOT.'
    },
    AiyinE40_4x6: {
        id: 'AiyinE40_4x6',
        name: 'AIYIN E40 Pro · 4 × 6 in',
        widthMm: 101.6,
        heightMm: 152.4,
        dpi: 203,
        calibrationHint: 'Selecciona papel 4 × 6 in y desactiva “ajustar al papel” en el diálogo de impresión.'
    }
};

@Injectable({ providedIn: 'root' })
export class LabelRendererService {
    getProfile(profile: LabelPrinterProfile): LabelPrinterProfileSpec {
        return PRINTER_PROFILES[profile];
    }

    async render(
        design: LabelDesignDefinition,
        profile: LabelPrinterProfile,
        options: LabelRenderOptions
    ): Promise<HTMLCanvasElement> {
        const profileSpec = this.getProfile(profile);
        this.ensureCanvasMatchesProfile(design, profileSpec);

        const scale = options.scale ?? 1;
        const pixelsPerMm = (profileSpec.dpi / 25.4) * scale;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(design.canvas.widthMm * pixelsPerMm);
        canvas.height = Math.round(design.canvas.heightMm * pixelsPerMm);

        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('El navegador no pudo preparar el lienzo de impresión.');

        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';

        const elements = [...design.elements].filter(element => element.visible).sort((left, right) => left.zIndex - right.zIndex);
        for (const element of elements) {
            await this.drawElement(context, element, pixelsPerMm, options);
        }

        if (options.monochrome !== false) {
            try {
                this.convertToThermalMonochrome(context, canvas.width, canvas.height);
            } catch {
                throw new Error('Una imagen de la etiqueta no permite convertirse a térmico. Vuelve a subirla desde la biblioteca de imágenes.');
            }
        }
        return canvas;
    }

    async toPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
        return new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('No pudimos generar la imagen de impresión.'));
            }, 'image/png');
        });
    }

    downloadPng(canvas: HTMLCanvasElement, filename: string): void {
        const anchor = document.createElement('a');
        anchor.href = canvas.toDataURL('image/png');
        anchor.download = `${this.toSafeFilename(filename)}.png`;
        anchor.click();
    }

    async sharePng(canvas: HTMLCanvasElement, filename: string): Promise<boolean> {
        const blob = await this.toPngBlob(canvas);
        const file = new File([blob], `${this.toSafeFilename(filename)}.png`, { type: 'image/png' });
        const shareData: ShareData = { files: [file], title: filename };

        if (!navigator.share || (navigator.canShare && !navigator.canShare(shareData))) return false;
        await navigator.share(shareData);
        return true;
    }

    async printInBrowser(canvas: HTMLCanvasElement, profile: LabelPrinterProfile, title: string): Promise<void> {
        const html = this.buildPrintHtml([canvas.toDataURL('image/png')], profile, title);
        await this.dispatchPrintHtml(html);
    }

    async printManyInBrowser(canvases: HTMLCanvasElement[], profile: LabelPrinterProfile, title: string): Promise<void> {
        if (!canvases.length) throw new Error('No hay etiquetas para imprimir.');
        const html = this.buildPrintHtml(canvases.map(canvas => canvas.toDataURL('image/png')), profile, title);
        await this.dispatchPrintHtml(html);
    }

    private buildPrintHtml(imageUrls: string[], profile: LabelPrinterProfile, title: string): string {
        const profileSpec = this.getProfile(profile);
        const escapedTitle = this.escapeHtml(title);
        const images = imageUrls.map((imageUrl, index) => `<section class="label-page${index < imageUrls.length - 1 ? ' page-break' : ''}"><img src="${imageUrl}" alt="${escapedTitle}"></section>`).join('');
        return `<!doctype html>
            <html lang="es"><head><meta charset="utf-8"><title>${escapedTitle}</title>
            <style>
                @page { size: ${profileSpec.widthMm}mm ${profileSpec.heightMm}mm; margin: 0; }
                html, body { margin: 0; padding: 0; background: #fff; }
                .label-page { width: ${profileSpec.widthMm}mm; height: ${profileSpec.heightMm}mm; margin:0; padding:0; overflow:hidden; }
                .page-break { break-after: page; page-break-after: always; }
                img { display:block; width:${profileSpec.widthMm}mm; height:${profileSpec.heightMm}mm; object-fit:fill; image-rendering:auto; }
            </style></head><body>${images}</body></html>`;
    }

    private async dispatchPrintHtml(html: string): Promise<void> {
        if (Capacitor.isNativePlatform()) {
            await Printer.printHtml({ html });
            return;
        }

        await new Promise<void>((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.setAttribute('aria-hidden', 'true');
            iframe.style.position = 'fixed';
            iframe.style.width = '1px';
            iframe.style.height = '1px';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.border = '0';
            iframe.style.opacity = '0';
            document.body.appendChild(iframe);
            const documentRef = iframe.contentDocument;
            if (!documentRef) {
                iframe.remove();
                reject(new Error('El navegador no pudo preparar la impresión.'));
                return;
            }
            documentRef.open();
            documentRef.write(html);
            documentRef.close();
            window.setTimeout(() => {
                try {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                    window.setTimeout(() => iframe.remove(), 1000);
                    resolve();
                } catch {
                    iframe.remove();
                    reject(new Error('No pudimos abrir el diálogo de impresión.'));
                }
            }, 300);
        });
    }

    resolveText(properties: LabelElementProperties, data: Readonly<Record<string, string>>): string {
        const raw = properties.binding ? data[properties.binding] ?? '' : properties.text ?? '';
        return `${properties.prefix ?? ''}${raw}${properties.suffix ?? ''}`;
    }

    private async drawElement(
        context: CanvasRenderingContext2D,
        element: LabelElementDefinition,
        pixelsPerMm: number,
        options: LabelRenderOptions
    ): Promise<void> {
        const x = element.x * pixelsPerMm;
        const y = element.y * pixelsPerMm;
        const width = element.width * pixelsPerMm;
        const height = element.height * pixelsPerMm;

        context.save();
        context.translate(x + width / 2, y + height / 2);
        context.rotate((element.rotation * Math.PI) / 180);
        context.translate(-width / 2, -height / 2);

        switch (element.type) {
            case 'text':
            case 'data':
                this.drawText(context, element, width, height, pixelsPerMm, options.data);
                break;
            case 'qr':
                await this.drawQr(context, element, width, height, options.data);
                break;
            case 'barcode':
                this.drawBarcode(context, element, width, height, options.data);
                break;
            case 'image':
                await this.drawImage(context, element, width, height, options.assetUrls);
                break;
            case 'shape':
                this.drawShape(context, element, width, height, pixelsPerMm);
                break;
            case 'line':
                this.drawLine(context, element, width, height, pixelsPerMm);
                break;
        }

        context.restore();
    }

    private drawText(
        context: CanvasRenderingContext2D,
        element: LabelElementDefinition,
        width: number,
        height: number,
        pixelsPerMm: number,
        data: Readonly<Record<string, string>>
    ): void {
        const properties = element.properties;
        const fontSize = Math.max(4, properties.fontSize ?? 12) * pixelsPerMm * 0.3528;
        const fontWeight = properties.fontWeight ?? 500;
        const letterSpacing = (properties.letterSpacing ?? 0) * pixelsPerMm * 0.3528;
        const text = this.resolveText(properties, data);
        if (!text) return;

        context.fillStyle = '#000000';
        context.font = `${fontWeight} ${fontSize}px Arial, Helvetica, sans-serif`;
        context.textBaseline = 'top';
        context.textAlign = properties.align ?? 'left';

        const alignX = this.getAlignedX(properties.align ?? 'left', width);
        const lineHeight = Math.max(fontSize * 1.12, 1);
        const maxLines = Math.max(1, Math.floor(height / lineHeight));
        const lines = properties.wrap ? this.wrapText(context, text, width, maxLines, letterSpacing) : text.split('\n').slice(0, maxLines);

        lines.forEach((line, index) => {
            const y = index * lineHeight;
            if (y + lineHeight > height + 1) return;
            this.fillTextWithLetterSpacing(context, line, alignX, y, letterSpacing, properties.align ?? 'left');
        });
    }

    private async drawQr(
        context: CanvasRenderingContext2D,
        element: LabelElementDefinition,
        width: number,
        height: number,
        data: Readonly<Record<string, string>>
    ): Promise<void> {
        const value = this.resolveText(element.properties, data);
        if (!value) return;
        const side = Math.floor(Math.min(width, height));
        const dataUrl = await QRCode.toDataURL(value, {
            errorCorrectionLevel: element.properties.errorCorrection ?? 'M',
            margin: 0,
            width: side,
            color: { dark: '#000000', light: '#FFFFFF' }
        });
        const image = await this.loadImage(dataUrl);
        const offsetX = (width - side) / 2;
        const offsetY = (height - side) / 2;
        context.imageSmoothingEnabled = false;
        context.drawImage(image, offsetX, offsetY, side, side);
    }

    private drawBarcode(
        context: CanvasRenderingContext2D,
        element: LabelElementDefinition,
        width: number,
        height: number,
        data: Readonly<Record<string, string>>
    ): void {
        const value = this.resolveText(element.properties, data);
        if (!value) return;

        const barcodeCanvas = document.createElement('canvas');
        JsBarcode(barcodeCanvas, value, {
            format: 'CODE128',
            lineColor: '#000000',
            background: '#FFFFFF',
            displayValue: false,
            margin: 0,
            width: 2,
            height: Math.max(30, Math.round(height))
        });
        context.imageSmoothingEnabled = false;
        context.drawImage(barcodeCanvas, 0, 0, width, height);
    }

    private async drawImage(
        context: CanvasRenderingContext2D,
        element: LabelElementDefinition,
        width: number,
        height: number,
        assetUrls?: ReadonlyMap<string, string>
    ): Promise<void> {
        const assetId = element.properties.assetId;
        const url = assetId ? assetUrls?.get(assetId) : undefined;
        if (!url) return;
        const image = await this.loadImage(url);
        const sourceRatio = image.naturalWidth / image.naturalHeight;
        const targetRatio = width / height;
        let drawWidth = width;
        let drawHeight = height;
        let drawX = 0;
        let drawY = 0;
        if (sourceRatio > targetRatio) {
            drawHeight = width / sourceRatio;
            drawY = (height - drawHeight) / 2;
        } else {
            drawWidth = height * sourceRatio;
            drawX = (width - drawWidth) / 2;
        }
        context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    }

    private drawShape(
        context: CanvasRenderingContext2D,
        element: LabelElementDefinition,
        width: number,
        height: number,
        pixelsPerMm: number
    ): void {
        const properties = element.properties;
        const radius = Math.max(0, properties.radius ?? 0) * pixelsPerMm;
        context.fillStyle = properties.fill ?? '#FFFFFF';
        context.strokeStyle = properties.stroke ?? '#000000';
        context.lineWidth = Math.max(0.2, properties.strokeWidth ?? 0.3) * pixelsPerMm;
        context.beginPath();
        if (radius > 0) context.roundRect(0, 0, width, height, Math.min(radius, Math.min(width, height) / 2));
        else context.rect(0, 0, width, height);
        context.fill();
        if (properties.stroke) context.stroke();
    }

    private drawLine(
        context: CanvasRenderingContext2D,
        element: LabelElementDefinition,
        width: number,
        height: number,
        pixelsPerMm: number
    ): void {
        context.strokeStyle = element.properties.stroke ?? '#000000';
        context.lineWidth = Math.max(0.2, element.properties.strokeWidth ?? 0.3) * pixelsPerMm;
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(width, height);
        context.stroke();
    }

    private wrapText(
        context: CanvasRenderingContext2D,
        text: string,
        maxWidth: number,
        maxLines: number,
        letterSpacing: number
    ): string[] {
        const lines: string[] = [];
        for (const paragraph of text.split('\n')) {
            const words = paragraph.split(/\s+/).filter(Boolean);
            let currentLine = '';
            for (const word of words) {
                const candidate = currentLine ? `${currentLine} ${word}` : word;
                if (this.measureTextWithLetterSpacing(context, candidate, letterSpacing) <= maxWidth || !currentLine) {
                    currentLine = candidate;
                    continue;
                }
                lines.push(currentLine);
                currentLine = word;
                if (lines.length >= maxLines) return this.ellipsizeLines(lines, maxLines, context, maxWidth, letterSpacing);
            }
            if (currentLine || !words.length) lines.push(currentLine);
            if (lines.length >= maxLines) return this.ellipsizeLines(lines, maxLines, context, maxWidth, letterSpacing);
        }
        return lines.slice(0, maxLines);
    }

    private ellipsizeLines(
        lines: string[],
        maxLines: number,
        context: CanvasRenderingContext2D,
        maxWidth: number,
        letterSpacing: number
    ): string[] {
        const result = lines.slice(0, maxLines);
        if (!result.length) return result;
        let lastLine = result[result.length - 1];
        while (lastLine.length > 1 && this.measureTextWithLetterSpacing(context, `${lastLine}…`, letterSpacing) > maxWidth) {
            lastLine = lastLine.slice(0, -1);
        }
        result[result.length - 1] = `${lastLine}…`;
        return result;
    }

    private fillTextWithLetterSpacing(
        context: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        letterSpacing: number,
        alignment: LabelAlignment
    ): void {
        if (!letterSpacing) {
            context.fillText(text, x, y);
            return;
        }
        const totalWidth = this.measureTextWithLetterSpacing(context, text, letterSpacing);
        let cursor = alignment === 'center' ? x - totalWidth / 2 : alignment === 'right' ? x - totalWidth : x;
        const originalAlignment = context.textAlign;
        context.textAlign = 'left';
        for (const character of text) {
            context.fillText(character, cursor, y);
            cursor += context.measureText(character).width + letterSpacing;
        }
        context.textAlign = originalAlignment;
    }

    private measureTextWithLetterSpacing(context: CanvasRenderingContext2D, text: string, letterSpacing: number): number {
        return context.measureText(text).width + Math.max(0, text.length - 1) * letterSpacing;
    }

    private getAlignedX(alignment: LabelAlignment, width: number): number {
        if (alignment === 'center') return width / 2;
        return alignment === 'right' ? width : 0;
    }

    private async loadImage(source: string): Promise<HTMLImageElement> {
        return new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            if (!source.startsWith('data:')) image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('No pudimos cargar una imagen de la etiqueta.'));
            image.src = source;
        });
    }

    private convertToThermalMonochrome(context: CanvasRenderingContext2D, width: number, height: number): void {
        const image = context.getImageData(0, 0, width, height);
        const data = image.data;
        const bayer = [
            [0, 8, 2, 10],
            [12, 4, 14, 6],
            [3, 11, 1, 9],
            [15, 7, 13, 5]
        ];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const offset = (y * width + x) * 4;
                const luminance = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
                const threshold = 128 + (bayer[y % 4][x % 4] - 7.5) * 10;
                const value = luminance > threshold ? 255 : 0;
                data[offset] = value;
                data[offset + 1] = value;
                data[offset + 2] = value;
                data[offset + 3] = 255;
            }
        }
        context.putImageData(image, 0, 0);
    }

    private ensureCanvasMatchesProfile(design: LabelDesignDefinition, profile: LabelPrinterProfileSpec): void {
        if (
            Math.abs(design.canvas.widthMm - profile.widthMm) > 0.05 ||
            Math.abs(design.canvas.heightMm - profile.heightMm) > 0.05
        ) {
            throw new Error('La medida del diseño no coincide con la impresora seleccionada.');
        }
    }

    private toSafeFilename(value: string): string {
        return value.replace(/[^a-z0-9áéíóúüñ_-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'etiqueta-regi-bazar';
    }

    private escapeHtml(value: string): string {
        return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
    }
}
