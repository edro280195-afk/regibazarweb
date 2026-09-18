import { Injectable } from '@angular/core';
import {
    LabelDesignDefinition,
    LabelElementDefinition,
    LabelElementProperties,
    LabelElementType,
    LabelPrinterProfile,
    LabelTemplateKind
} from '../models';
import { LabelPrinterProfileSpec, LabelRendererService } from './label-renderer.service';

export interface LabelDesignIssue {
    severity: 'error' | 'warning';
    message: string;
    elementId?: string;
}

export interface LabelDataFieldDefinition {
    key: string;
    label: string;
    example: string;
    required?: boolean;
}

const FIELDS_BY_KIND: Record<LabelTemplateKind, LabelDataFieldDefinition[]> = {
    InventoryBox: [
        { key: 'box.code', label: 'Código de caja', example: 'CAJA-07', required: true },
        { key: 'box.name', label: 'Nombre de caja', example: 'Temporada verano' },
        { key: 'box.location', label: 'Ubicación', example: 'Estante A · Nivel 2' },
        { key: 'box.nfcUrl', label: 'URL NFC / QR', example: 'regibazar.com/caja/…', required: true },
        { key: 'box.articleTypes', label: 'Tipos de artículo', example: '8' },
        { key: 'box.totalUnits', label: 'Unidades', example: '42' },
        { key: 'box.updatedAt', label: 'Última actualización', example: 'Hoy' }
    ],
    InventoryItem: [
        { key: 'item.name', label: 'Nombre de artículo', example: 'Vaso térmico rosa', required: true },
        { key: 'item.variant', label: 'Variante', example: '500 ml' },
        { key: 'item.barcode', label: 'Código comercial', example: '7501234567890' },
        { key: 'item.labelCode', label: 'Código Regi Bazar', example: 'RBI98AC7D1' },
        { key: 'item.scannableCode', label: 'Código escaneable', example: '7501234567890', required: true },
        { key: 'item.quantity', label: 'Existencia', example: '12' },
        { key: 'item.boxCode', label: 'Código de caja', example: 'CAJA-07' },
        { key: 'item.boxName', label: 'Nombre de caja', example: 'Temporada verano' },
        { key: 'item.location', label: 'Ubicación', example: 'Estante A · Nivel 2' }
    ],
    OrderPackage: [
        { key: 'order.id', label: 'Número de pedido', example: '1254' },
        { key: 'order.clientName', label: 'Nombre de clienta', example: 'Mariana López', required: true },
        { key: 'order.phone', label: 'Teléfono', example: '867 123 4567' },
        { key: 'order.address', label: 'Dirección', example: 'Calle Mina 123, Centro' },
        { key: 'order.deliveryInstructions', label: 'Instrucciones de entrega', example: 'Portón negro; llamar al llegar' },
        { key: 'order.itemSummary', label: 'Contenido del pedido', example: '2 × Vaso térmico\n1 × Organizador' },
        { key: 'package.number', label: 'Número de bolsa', example: '2', required: true },
        { key: 'package.total', label: 'Total de bolsas', example: '3' },
        { key: 'package.qrCodeValue', label: 'QR de bolsa', example: 'RB-ORD1254-PKG8A12', required: true },
        { key: 'package.status', label: 'Estado de bolsa', example: 'Packed' }
    ]
};

@Injectable({ providedIn: 'root' })
export class LabelDesignService {
    constructor(private readonly renderer: LabelRendererService) {}

    getFields(kind: LabelTemplateKind): LabelDataFieldDefinition[] {
        return FIELDS_BY_KIND[kind];
    }

    getSampleData(kind: LabelTemplateKind): Record<string, string> {
        return Object.fromEntries(this.getFields(kind).map(field => [field.key, field.example]));
    }

    getRequiredBindings(kind: LabelTemplateKind): string[] {
        return this.getFields(kind).filter(field => field.required).map(field => field.key);
    }

    parseDesign(value: string): LabelDesignDefinition {
        const parsed: unknown = JSON.parse(value);
        if (!this.isDesignDefinition(parsed)) throw new Error('La plantilla guardada no tiene un formato compatible.');
        return parsed;
    }

    serializeDesign(design: LabelDesignDefinition): string {
        return JSON.stringify(design);
    }

    cloneDesign(design: LabelDesignDefinition): LabelDesignDefinition {
        return this.parseDesign(this.serializeDesign(design));
    }

    createElement(type: LabelElementType, profile: LabelPrinterProfile, assetId?: string): LabelElementDefinition {
        const profileSpec = this.renderer.getProfile(profile);
        const base: LabelElementDefinition = {
            id: this.createId(type),
            type,
            x: Math.max(3, (profileSpec.widthMm - 30) / 2),
            y: Math.max(3, (profileSpec.heightMm - 15) / 2),
            width: type === 'qr' ? 24 : type === 'barcode' ? Math.min(profileSpec.widthMm - 6, 44) : 30,
            height: type === 'qr' ? 24 : type === 'barcode' ? 12 : type === 'line' ? 0.5 : 10,
            rotation: 0,
            visible: true,
            zIndex: 1,
            properties: {}
        };

        switch (type) {
            case 'text':
                base.properties = { text: 'Nuevo texto', fontSize: 13, fontWeight: 600, align: 'left', wrap: true };
                break;
            case 'data':
                base.properties = { binding: this.getFieldsForProfile(profile)[0], fontSize: 13, fontWeight: 600, align: 'left', wrap: true };
                break;
            case 'image':
                base.width = 20;
                base.height = 20;
                base.properties = { assetId };
                break;
            case 'qr':
                base.properties = { binding: 'package.qrCodeValue', errorCorrection: 'M' };
                break;
            case 'barcode':
                base.properties = { binding: 'item.scannableCode', format: 'CODE128', displayValue: false };
                break;
            case 'shape':
                base.properties = { fill: '#FFFFFF', stroke: '#000000', strokeWidth: 0.4, radius: 1 };
                break;
            case 'line':
                base.width = Math.min(35, profileSpec.widthMm - 6);
                base.properties = { stroke: '#000000', strokeWidth: 0.4 };
                break;
        }
        return this.clampElement(base, profileSpec);
    }

    clampElement(element: LabelElementDefinition, profile: LabelPrinterProfileSpec): LabelElementDefinition {
        const minimumSize = element.type === 'line' ? 0.5 : 1;
        const width = Math.min(Math.max(minimumSize, element.width), profile.widthMm);
        const height = Math.min(Math.max(minimumSize, element.height), profile.heightMm);
        return {
            ...element,
            x: Math.min(Math.max(0, element.x), Math.max(0, profile.widthMm - width)),
            y: Math.min(Math.max(0, element.y), Math.max(0, profile.heightMm - height)),
            width,
            height,
            rotation: Math.min(360, Math.max(-360, element.rotation))
        };
    }

    validate(design: LabelDesignDefinition, kind: LabelTemplateKind, profile: LabelPrinterProfile): LabelDesignIssue[] {
        const profileSpec = this.renderer.getProfile(profile);
        const issues: LabelDesignIssue[] = [];
        if (
            Math.abs(design.canvas.widthMm - profileSpec.widthMm) > 0.05 ||
            Math.abs(design.canvas.heightMm - profileSpec.heightMm) > 0.05
        ) {
            issues.push({ severity: 'error', message: `El lienzo debe medir ${profileSpec.widthMm} × ${profileSpec.heightMm} mm.` });
        }

        const ids = new Set<string>();
        const bindings = new Set<string>();
        for (const element of design.elements) {
            if (!element.id || ids.has(element.id)) issues.push({ severity: 'error', message: 'Hay elementos sin identificador único.', elementId: element.id });
            ids.add(element.id);
            if (element.x < 0 || element.y < 0 || element.x + element.width > profileSpec.widthMm || element.y + element.height > profileSpec.heightMm) {
                issues.push({ severity: 'error', message: 'El elemento queda fuera de la etiqueta.', elementId: element.id });
            }
            if (element.visible && element.properties.binding) bindings.add(element.properties.binding);
            if (element.type === 'qr') {
                const minQr = profile === 'NiimbotB1_50x50' ? 20 : 28;
                if (element.width < minQr || element.height < minQr || Math.abs(element.width - element.height) > 0.05) {
                    issues.push({ severity: 'error', message: `El QR debe ser cuadrado y medir al menos ${minQr} mm.`, elementId: element.id });
                }
                if (element.rotation !== 0) issues.push({ severity: 'error', message: 'No gires un QR: pierde confiabilidad al escanear.', elementId: element.id });
                if (element.x < 1 || element.y < 1 || element.x + element.width > profileSpec.widthMm - 1 || element.y + element.height > profileSpec.heightMm - 1) {
                    issues.push({ severity: 'warning', message: 'Deja 1 mm de aire alrededor del QR para mejorar la lectura.', elementId: element.id });
                }
            }
            if (element.type === 'barcode' && (element.width < (profile === 'NiimbotB1_50x50' ? 30 : 45) || element.height < 10)) {
                issues.push({ severity: 'error', message: 'El código de barras necesita más espacio para poder leerse.', elementId: element.id });
            }
            if (element.type === 'image' && !element.properties.assetId) issues.push({ severity: 'error', message: 'Selecciona una imagen de la biblioteca.', elementId: element.id });
        }

        for (const binding of this.getRequiredBindings(kind)) {
            if (!bindings.has(binding)) issues.push({ severity: 'error', message: `No puedes publicar sin “${this.getFieldLabel(kind, binding)}”.` });
        }
        return issues;
    }

    private getFieldsForProfile(profile: LabelPrinterProfile): string {
        return profile === 'NiimbotB1_50x50' ? 'item.name' : 'order.clientName';
    }

    private getFieldLabel(kind: LabelTemplateKind, key: string): string {
        return this.getFields(kind).find(field => field.key === key)?.label ?? key;
    }

    private isDesignDefinition(value: unknown): value is LabelDesignDefinition {
        if (!this.isRecord(value) || value['schemaVersion'] !== 1 || !this.isRecord(value['canvas']) || !Array.isArray(value['elements'])) return false;
        const canvas = value['canvas'];
        return typeof canvas['widthMm'] === 'number' && typeof canvas['heightMm'] === 'number' && typeof canvas['background'] === 'string' &&
            value['elements'].every(element => this.isElementDefinition(element));
    }

    private isElementDefinition(value: unknown): value is LabelElementDefinition {
        if (!this.isRecord(value) || !this.isRecord(value['properties'])) return false;
        return typeof value['id'] === 'string' &&
            typeof value['type'] === 'string' &&
            typeof value['x'] === 'number' &&
            typeof value['y'] === 'number' &&
            typeof value['width'] === 'number' &&
            typeof value['height'] === 'number' &&
            typeof value['rotation'] === 'number' &&
            typeof value['visible'] === 'boolean' &&
            typeof value['zIndex'] === 'number';
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    private createId(prefix: string): string {
        const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID().slice(0, 8)
            : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        return `${prefix}-${randomPart}`;
    }
}
