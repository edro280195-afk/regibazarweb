import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
    CreateLabelPrintEventDto,
    LabelPrintContextDto,
    LabelTemplateKind
} from '../models';
import { ApiService } from './api.service';
import { LabelDesignService } from './label-design.service';
import { LabelRendererService } from './label-renderer.service';

export type LabelOutputMethod = 'browser' | 'download' | 'share';

@Injectable({ providedIn: 'root' })
export class LabelPrintService {
    private readonly api = inject(ApiService);
    private readonly designService = inject(LabelDesignService);
    private readonly renderer = inject(LabelRendererService);

    async printBox(boxId: string, method: LabelOutputMethod = 'browser'): Promise<void> {
        await this.printTarget('InventoryBox', boxId, method);
    }

    async printItem(itemId: string, method: LabelOutputMethod = 'browser'): Promise<void> {
        await this.printTarget('InventoryItem', itemId, method);
    }

    async printPackage(packageId: string, method: LabelOutputMethod = 'browser'): Promise<void> {
        await this.printTarget('OrderPackage', packageId, method);
    }

    async printPackages(packageIds: string[]): Promise<void> {
        if (!packageIds.length) return;
        const templates = await firstValueFrom(this.api.getLabelTemplates());
        const template = templates.find(current => current.kind === 'OrderPackage' && current.isDefault && !!current.publishedVersionId && !current.isArchived);
        if (!template) throw new Error('Primero publica una etiqueta de bolsa en el Centro de impresión.');

        const [assets, contexts] = await Promise.all([
            firstValueFrom(this.api.getLabelAssets()),
            Promise.all(packageIds.map(packageId => firstValueFrom(this.api.getPackageLabelPrintContext(template.id, packageId))))
        ]);
        const assetUrls = new Map(assets.map(asset => [asset.id, asset.url]));
        const canvases = await Promise.all(contexts.map(async context => {
            const design = this.designService.parseDesign(context.template.designJson);
            return this.renderer.render(design, context.template.printerProfile, {
                data: context.data,
                assetUrls,
                scale: 1.5,
                monochrome: true
            });
        }));

        await Promise.all(contexts.map(context => {
            const event: CreateLabelPrintEventDto = {
                labelTemplateVersionId: context.template.versionId,
                targetKind: 2,
                targetId: context.targetId,
                printerProfile: context.template.printerProfile === 'NiimbotB1_50x50' ? 0 : 1,
                method: 0,
                copies: 1
            };
            return firstValueFrom(this.api.createLabelPrintEvent(event));
        }));
        await this.renderer.printManyInBrowser(canvases, contexts[0].template.printerProfile, 'Etiquetas de bolsas · Regi Bazar');
    }

    async renderDraft(
        designJson: string,
        kind: LabelTemplateKind,
        profile: 'NiimbotB1_50x50' | 'AiyinE40_4x6'
    ): Promise<HTMLCanvasElement> {
        const design = this.designService.parseDesign(designJson);
        const assets = await firstValueFrom(this.api.getLabelAssets());
        return this.renderer.render(design, profile, {
            data: this.designService.getSampleData(kind),
            assetUrls: new Map(assets.map(asset => [asset.id, asset.url])),
            scale: 1.5,
            monochrome: true
        });
    }

    private async printTarget(kind: LabelTemplateKind, targetId: string, method: LabelOutputMethod): Promise<void> {
        const templates = await firstValueFrom(this.api.getLabelTemplates());
        const template = templates.find(current => current.kind === kind && current.isDefault && !!current.publishedVersionId && !current.isArchived);
        if (!template) {
            throw new Error(`Primero publica una etiqueta de ${this.kindLabel(kind)} en el Centro de impresión.`);
        }

        const context = await this.loadContext(kind, template.id, targetId);
        const assets = await firstValueFrom(this.api.getLabelAssets());
        const design = this.designService.parseDesign(context.template.designJson);
        const canvas = await this.renderer.render(design, context.template.printerProfile, {
            data: context.data,
            assetUrls: new Map(assets.map(asset => [asset.id, asset.url])),
            scale: 1.5,
            monochrome: true
        });

        const event: CreateLabelPrintEventDto = {
            labelTemplateVersionId: context.template.versionId,
            targetKind: this.kindValue(kind),
            targetId,
            printerProfile: context.template.printerProfile === 'NiimbotB1_50x50' ? 0 : 1,
            method: this.methodValue(method),
            copies: 1
        };
        await firstValueFrom(this.api.createLabelPrintEvent(event));

        const title = `${this.kindLabel(kind)} · Regi Bazar`;
        if (method === 'download') {
            this.renderer.downloadPng(canvas, title);
            return;
        }
        if (method === 'share') {
            const shared = await this.renderer.sharePng(canvas, title);
            if (!shared) {
                this.renderer.downloadPng(canvas, title);
            }
            return;
        }
        await this.renderer.printInBrowser(canvas, context.template.printerProfile, title);
    }

    private loadContext(kind: LabelTemplateKind, templateId: string, targetId: string): Promise<LabelPrintContextDto> {
        switch (kind) {
            case 'InventoryBox':
                return firstValueFrom(this.api.getBoxLabelPrintContext(templateId, targetId));
            case 'InventoryItem':
                return firstValueFrom(this.api.getItemLabelPrintContext(templateId, targetId));
            case 'OrderPackage':
                return firstValueFrom(this.api.getPackageLabelPrintContext(templateId, targetId));
        }
    }

    private kindValue(kind: LabelTemplateKind): 0 | 1 | 2 {
        return ({ InventoryBox: 0, InventoryItem: 1, OrderPackage: 2 } as Record<LabelTemplateKind, 0 | 1 | 2>)[kind];
    }

    private methodValue(method: LabelOutputMethod): 0 | 3 | 4 {
        return method === 'browser' ? 0 : method === 'share' ? 3 : 4;
    }

    private kindLabel(kind: LabelTemplateKind): string {
        return ({ InventoryBox: 'Etiqueta de caja', InventoryItem: 'Etiqueta de artículo', OrderPackage: 'Etiqueta de bolsa' } as Record<LabelTemplateKind, string>)[kind];
    }
}
