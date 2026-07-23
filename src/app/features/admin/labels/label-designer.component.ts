import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
    CreateLabelTemplateDto,
    LabelAssetDto,
    LabelDesignDefinition,
    LabelElementDefinition,
    LabelElementType,
    LabelPrinterProfile,
    LabelTemplateDetailDto,
    LabelTemplateKind,
    LabelTemplateSummaryDto,
    LabelTemplateVersionDto
} from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';
import { LabelDesignIssue, LabelDesignService } from '../../../core/services/label-design.service';
import { LabelRendererService } from '../../../core/services/label-renderer.service';
import { LabelPrintService } from '../../../core/services/label-print.service';
import { ToastService } from '../../../core/services/toast.service';
import { alignSelection, distributeSelection } from './label-layout.util';

type SidebarTab = 'elements' | 'fields' | 'images' | 'layers' | 'properties';
type PointerAction = 'move' | 'resize';
type ResizeHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface PointerState {
    action: PointerAction;
    elementId: string;
    startX: number;
    startY: number;
    original: LabelElementDefinition;
    handle?: ResizeHandle;
}

interface SnapGuide {
    x: number | null;
    y: number | null;
}

interface TemplateStarter {
    kind: LabelTemplateKind;
    profile: LabelPrinterProfile;
    title: string;
    description: string;
    accent: string;
}

@Component({
    selector: 'app-label-designer',
    imports: [FormsModule, NgTemplateOutlet],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <section class="label-page">
            <header class="hero">
                <div>
                    <p class="eyebrow">CENTRO DE IMPRESIÓN</p>
                    <h2>Etiquetas que se sienten tuyas</h2>
                    <p class="hero-copy">Diseña una vez, publícala con seguridad e imprímela igual desde la compu, iPad o Android.</p>
                </div>
                <div class="hero-actions">
                    @if (activeTemplate()) {
                        <button class="secondary-action" type="button" (click)="backToLibrary()">Plantillas</button>
                        <button class="primary-action" type="button" [disabled]="isPublishing() || isSaving() || errors().length > 0" (click)="publish()">
                            {{ isPublishing() ? 'Publicando…' : 'Publicar versión' }}
                        </button>
                    }
                </div>
            </header>

            @if (!activeTemplate()) {
                <section class="library-card" aria-label="Biblioteca de plantillas">
                    <div class="library-heading">
                        <div>
                            <p class="eyebrow">BIBLIOTECA</p>
                            <h3>Elige qué quieres preparar</h3>
                        </div>
                        @if (isLoadingLibrary()) { <span class="loading-label">Cargando…</span> }
                    </div>

                    <div class="starter-grid">
                        @for (starter of starters; track starter.kind) {
                            <article class="starter-card" [style.--accent]="starter.accent">
                                <span class="starter-size">{{ starter.profile === 'NiimbotB1_50x50' ? '50 × 50 mm' : '4 × 6 in' }}</span>
                                <h4>{{ starter.title }}</h4>
                                <p>{{ starter.description }}</p>
                                @if (templateFor(starter.kind); as template) {
                                    <button type="button" class="card-action" (click)="openTemplate(template.id)">
                                        Abrir plantilla
                                    </button>
                                } @else {
                                    <button type="button" class="card-action" [disabled]="isCreatingKind() === starter.kind" (click)="createStarter(starter)">
                                        {{ isCreatingKind() === starter.kind ? 'Creando…' : 'Crear diseño' }}
                                    </button>
                                }
                            </article>
                        }
                    </div>

                    @if (templates().length > 0) {
                        <div class="existing-list">
                            <p class="existing-title">Más versiones o variantes</p>
                            @for (template of templates(); track template.id) {
                                <button class="existing-template" type="button" (click)="openTemplate(template.id)">
                                    <span><strong>{{ template.name }}</strong><small>{{ printerLabel(template.printerProfile) }}</small></span>
                                    <span class="template-status" [class.unpublished]="!template.publishedVersionId" [class.default-template]="template.isDefault">
                                        {{ template.publishedVersionNumber ? 'Versión ' + template.publishedVersionNumber + ' publicada' : 'Borrador' }}
                                    </span>
                                </button>
                            }
                        </div>
                    }
                </section>
            } @else {
                <section class="editor-shell" [class.mobile-panel-open]="mobilePanelOpen()">
                    <aside class="tool-rail" aria-label="Herramientas del diseñador">
                        <button type="button" [class.active]="activeTab() === 'elements'" (click)="activeTab.set('elements')">Agregar</button>
                        <button type="button" [class.active]="activeTab() === 'fields'" (click)="activeTab.set('fields')">Datos</button>
                        <button type="button" [class.active]="activeTab() === 'images'" (click)="activeTab.set('images')">Imágenes</button>
                        <button type="button" [class.active]="activeTab() === 'layers'" (click)="activeTab.set('layers')">Capas</button>
                        <button type="button" [class.active]="activeTab() === 'properties'" (click)="activeTab.set('properties')">Ajustes</button>
                    </aside>

                    <aside class="left-panel">
                        <div class="panel-heading">
                            <p class="eyebrow">{{ panelTitle() }}</p>
                            <button class="close-mobile" type="button" (click)="mobilePanelOpen.set(false)">Cerrar</button>
                        </div>

                        @switch (activeTab()) {
                            @case ('elements') {
                                <div class="tool-grid">
                                    <button type="button" (click)="addElement('text')"><b>T</b><span>Texto</span></button>
                                    <button type="button" (click)="addDataElement()"><b>≡</b><span>Dato</span></button>
                                    <button type="button" (click)="addElement('qr')"><b>QR</b><span>Código QR</span></button>
                                    <button type="button" (click)="addElement('barcode')"><b>|||</b><span>Barras</span></button>
                                    <button type="button" (click)="addElement('shape')"><b>□</b><span>Forma</span></button>
                                    <button type="button" (click)="addElement('line')"><b>—</b><span>Línea</span></button>
                                </div>
                                <div class="panel-tip">Arrastra los elementos sobre la etiqueta. Doble clic en un texto para editarlo ahí mismo; usa Shift + clic para seleccionar varios.</div>
                            }
                            @case ('fields') {
                                <p class="panel-copy">Estos datos se llenan solos cuando imprimes una caja, artículo o bolsa.</p>
                                <div class="field-list">
                                    @for (field of fields(); track field.key) {
                                        <button type="button" class="field-row" [class.selected]="selectedBinding() === field.key" (click)="selectField(field.key)">
                                            <span><strong>{{ field.label }}</strong><small>{{ field.example }}</small></span>
                                            @if (field.required) { <em>Obligatorio</em> }
                                        </button>
                                    }
                                </div>
                            }
                            @case ('images') {
                                <label class="upload-asset" [class.uploading]="isUploadingAsset()">
                                    <input type="file" accept="image/png,image/jpeg,image/webp" (change)="uploadAsset($event)" [disabled]="isUploadingAsset()" />
                                    {{ isUploadingAsset() ? 'Subiendo imagen…' : 'Subir imagen' }}
                                    <small>PNG, JPG o WebP · máximo 5 MB</small>
                                </label>
                                <div class="asset-grid">
                                    @for (asset of assets(); track asset.id) {
                                        <button type="button" class="asset-card" (click)="addImage(asset)">
                                            <img [src]="asset.url" [alt]="asset.name" />
                                            <span>{{ asset.name }}</span>
                                        </button>
                                    } @empty {
                                        <div class="empty-panel">Sube el logo de Regi Bazar o cualquier imagen que quieras imprimir.</div>
                                    }
                                </div>
                            }
                            @case ('layers') {
                                <div class="layers-list">
                                    @for (element of orderedElements(); track element.id) {
                                        <button type="button" class="layer-row" [class.selected]="isElementSelected(element.id)" (click)="selectElement(element.id, $event.shiftKey || $event.ctrlKey || $event.metaKey)">
                                            <span class="layer-type">{{ elementTypeName(element.type) }}</span>
                                            <span class="layer-name">{{ elementName(element) }}</span>
                                            @if (element.locked) { <small>Bloqueado</small> }
                                            @else if (!element.visible) { <small>Oculto</small> }
                                        </button>
                                    }
                                </div>
                                <div class="panel-tip">Selecciona una capa para cambiar su orden, ocultarla o bloquearla desde Ajustes.</div>
                            }
                            @case ('properties') {
                                <ng-container *ngTemplateOutlet="elementProperties"></ng-container>
                            }
                        }
                    </aside>

                    <main class="workspace">
                        <div class="workspace-toolbar">
                            <div class="template-identity">
                                <span class="printer-chip">{{ printerLabel(activeTemplate()!.printerProfile) }}</span>
                                <strong>{{ activeTemplate()!.name }}</strong>
                                @if (activeTemplate()!.isDefault) { <span class="default-chip">Predeterminada</span> }
                                <small>{{ savedState() }}</small>
                            </div>
                            <div class="canvas-actions">
                                <button type="button" [disabled]="!canUndo()" (click)="undo()">Deshacer</button>
                                <button type="button" [disabled]="!canRedo()" (click)="redo()">Rehacer</button>
                                <button type="button" [class.active]="showGrid()" (click)="toggleGrid()">Cuadrícula</button>
                                <button type="button" [class.active]="snapEnabled()" (click)="toggleSnap()">Imán</button>
                                <button type="button" [class.active]="showRulers()" (click)="toggleRulers()">Reglas</button>
                                <button type="button" (click)="printTest()">Probar</button>
                                <button type="button" (click)="downloadTest()">PNG</button>
                                <button type="button" (click)="shareTest()">Compartir</button>
                                <button type="button" aria-label="Alejar lienzo" (click)="changeZoomBy(-1)">−</button>
                                <select [value]="zoom()" (change)="changeZoom($event)">
                                    <option [value]="60">60%</option><option [value]="75">75%</option><option [value]="100">100%</option><option [value]="125">125%</option><option [value]="150">150%</option>
                                </select>
                                <button type="button" aria-label="Acercar lienzo" (click)="changeZoomBy(1)">+</button>
                            </div>
                        </div>

                        @if (renderError()) {
                            <div class="render-error">{{ renderError() }}</div>
                        }
                        <div class="canvas-scroll">
                            <div class="canvas-stage" [class.with-rulers]="showRulers()">
                                @if (showRulers()) {
                                    <span class="top-ruler" aria-hidden="true"><b>0</b><b>{{ design().canvas.widthMm }} mm</b></span>
                                    <span class="left-ruler" aria-hidden="true"><b>0</b><b>{{ design().canvas.heightMm }} mm</b></span>
                                }
                                <div class="canvas-scale" [style.width.%]="zoom()">
                                <div
                                    class="label-artboard"
                                    [class.with-grid]="showGrid()"
                                    [style.aspect-ratio]="canvasAspectRatio()"
                                    (pointerdown)="clearSelectionFromCanvas($event)">
                                    @if (previewUrl()) {
                                        <img class="thermal-preview" [src]="previewUrl()!" alt="Vista térmica de la etiqueta" draggable="false" />
                                    } @else {
                                        <div class="preview-loading">Renderizando vista térmica…</div>
                                    }
                                    <div
                                        class="safe-area"
                                        aria-hidden="true"
                                        [style.left.%]="safeInsetXPercent()"
                                        [style.right.%]="safeInsetXPercent()"
                                        [style.top.%]="safeInsetYPercent()"
                                        [style.bottom.%]="safeInsetYPercent()"></div>
                                    @if (snapGuide().x !== null) {
                                        <span class="smart-guide smart-guide-vertical" aria-hidden="true" [style.left.%]="snapGuide().x!"></span>
                                    }
                                    @if (snapGuide().y !== null) {
                                        <span class="smart-guide smart-guide-horizontal" aria-hidden="true" [style.top.%]="snapGuide().y!"></span>
                                    }
                                    @for (element of design().elements; track element.id) {
                                        <div
                                            class="element-hitbox"
                                            [class.selected]="isElementSelected(element.id)"
                                            [class.locked-element]="element.locked"
                                            [class.hidden-element]="!element.visible"
                                            [style.left.%]="leftPercent(element)"
                                            [style.top.%]="topPercent(element)"
                                            [style.width.%]="widthPercent(element)"
                                            [style.height.%]="heightPercent(element)"
                                            [style.transform]="'rotate(' + element.rotation + 'deg)'"
                                            (pointerdown)="startPointerAction($event, element, 'move')"
                                            (dblclick)="startInlineTextEditing($event, element)"
                                            (keydown.enter)="selectElement(element.id)"
                                            tabindex="0"
                                            role="button"
                                            [attr.aria-label]="'Seleccionar ' + elementName(element)">
                                            @if (selectedElementId() === element.id) {
                                                <span class="selection-tag">{{ elementTypeName(element.type) }}</span>
                                                @if (!element.locked) {
                                                    <button class="resize-handle top-left" type="button" aria-label="Cambiar tamaño desde la esquina superior izquierda" (pointerdown)="startPointerAction($event, element, 'resize', 'top-left')"></button>
                                                    <button class="resize-handle top-right" type="button" aria-label="Cambiar tamaño desde la esquina superior derecha" (pointerdown)="startPointerAction($event, element, 'resize', 'top-right')"></button>
                                                    <button class="resize-handle bottom-left" type="button" aria-label="Cambiar tamaño desde la esquina inferior izquierda" (pointerdown)="startPointerAction($event, element, 'resize', 'bottom-left')"></button>
                                                    <button class="resize-handle bottom-right" type="button" aria-label="Cambiar tamaño desde la esquina inferior derecha" (pointerdown)="startPointerAction($event, element, 'resize', 'bottom-right')"></button>
                                                }
                                            }
                                            @if (inlineEditingElementId() === element.id) {
                                                <textarea
                                                    class="canvas-text-editor"
                                                    aria-label="Editar texto directamente en la etiqueta"
                                                    [value]="inlineTextValue()"
                                                    [style.font-size.pt]="element.properties.fontSize ?? 12"
                                                    [style.font-weight]="element.properties.fontWeight ?? 500"
                                                    (pointerdown)="$event.stopPropagation()"
                                                    (input)="setInlineTextValue($event)"
                                                    (blur)="commitInlineTextEditing()"
                                                    (keydown.escape)="cancelInlineTextEditing()"></textarea>
                                            }
                                        </div>
                                    }
                                </div>
                                </div>
                            </div>
                        </div>

                        <footer class="workspace-footer">
                            <span>{{ activeTemplate()!.printerProfile === 'NiimbotB1_50x50' ? 'Etiqueta B1: 50 × 50 mm' : 'Etiqueta E40 Pro: 4 × 6 in' }}</span>
                            <span>Vista térmica: blanco y negro</span>
                        </footer>
                    </main>

                    <aside class="inspector" aria-label="Propiedades del elemento">
                        <div class="panel-heading"><p class="eyebrow">INSPECTOR</p></div>
                        <ng-container *ngTemplateOutlet="elementProperties"></ng-container>

                        <div class="version-panel">
                            <div><p class="eyebrow">VERSIONES</p><span>{{ activeTemplate()!.publishedVersion ? 'Publicada: v' + activeTemplate()!.publishedVersion!.versionNumber : 'Aún sin publicar' }}</span></div>
                            @if (!activeTemplate()!.isDefault) {
                                <button type="button" [disabled]="!activeTemplate()!.publishedVersion" (click)="setAsDefault()">Usar para imprimir</button>
                            }
                            @for (version of historicalVersions(); track version.id) {
                                <button type="button" (click)="restoreVersion(version)">Restaurar v{{ version.versionNumber }}</button>
                            }
                        </div>
                    </aside>

                    <button class="mobile-tools" type="button" (click)="toggleMobilePanel()">
                        {{ mobilePanelOpen() ? 'Cerrar herramientas' : 'Herramientas' }}
                    </button>
                </section>

                @if (issues().length > 0) {
                    <section class="validation-strip" [class.has-errors]="errors().length > 0">
                        <strong>{{ errors().length > 0 ? 'Antes de publicar' : 'Revisión de impresión' }}</strong>
                        <div>
                            @for (issue of issues(); track issue.message + issue.elementId) {
                                <span [class.warning]="issue.severity === 'warning'">{{ issue.message }}</span>
                            }
                        </div>
                    </section>
                }

                <ng-template #elementProperties>
                    @if (selectedElements().length > 1) {
                        <div class="empty-inspector">
                            <strong>{{ selectedElements().length }} elementos seleccionados</strong>
                            <p>Usa Shift + clic para sumar o quitar elementos. Estas acciones respetan los que están bloqueados.</p>
                        </div>
                        <div class="property-section">
                            <span class="property-section-title">Alinear selección</span>
                            <div class="inspector-actions three-columns">
                                <button type="button" (click)="alignSelectedElements('left')">Izquierda</button>
                                <button type="button" (click)="alignSelectedElements('center')">Centro</button>
                                <button type="button" (click)="alignSelectedElements('right')">Derecha</button>
                                <button type="button" (click)="alignSelectedElements('top')">Arriba</button>
                                <button type="button" (click)="alignSelectedElements('middle')">Medio</button>
                                <button type="button" (click)="alignSelectedElements('bottom')">Abajo</button>
                            </div>
                        </div>
                        <div class="property-section">
                            <span class="property-section-title">Distribuir con el mismo espacio</span>
                            <div class="layer-actions">
                                <button type="button" [disabled]="selectedElements().length < 3" (click)="distributeSelectedElements('horizontal')">Horizontal</button>
                                <button type="button" [disabled]="selectedElements().length < 3" (click)="distributeSelectedElements('vertical')">Vertical</button>
                            </div>
                        </div>
                        <div class="property-section">
                            <span class="property-section-title">Acciones por lote</span>
                            <div class="layer-actions">
                                <button type="button" (click)="duplicateSelected()">Duplicar</button>
                                <button type="button" (click)="toggleSelectedElementsLock()">Bloquear / desbloquear</button>
                            </div>
                            <button type="button" class="secondary-wide-action" (click)="copySelectedElements()">Copiar selección</button>
                            <button type="button" class="danger-link" (click)="removeSelected()">Eliminar elementos editables</button>
                        </div>
                    } @else if (selectedElement(); as element) {
                        <div class="selection-title">
                            <div>
                                <strong>{{ elementTypeName(element.type) }}</strong>
                                <small>{{ element.locked ? 'Bloqueado para evitar cambios accidentales' : 'Seleccionado en el lienzo' }}</small>
                            </div>
                            <button type="button" class="icon-text" (click)="duplicateSelected()">Duplicar</button>
                        </div>

                        <div class="quick-property-actions">
                            <button type="button" [class.active]="element.locked" (click)="toggleLocked(element.id)">
                                {{ element.locked ? 'Desbloquear' : 'Bloquear' }}
                            </button>
                            <button type="button" [class.active]="!element.visible" (click)="toggleVisibility(element.id, $event)">
                                {{ element.visible ? 'Ocultar' : 'Mostrar' }}
                            </button>
                        </div>

                        <div class="property-section">
                            <span class="property-section-title">Medidas en milímetros</span>
                            <div class="property-grid compact">
                                <label>X <input type="number" step="0.5" [disabled]="element.locked" [value]="element.x" (change)="updateNumeric(element.id, 'x', $event)" /></label>
                                <label>Y <input type="number" step="0.5" [disabled]="element.locked" [value]="element.y" (change)="updateNumeric(element.id, 'y', $event)" /></label>
                                <label>Ancho <input type="number" step="0.5" [disabled]="element.locked" [value]="element.width" (change)="updateNumeric(element.id, 'width', $event)" /></label>
                                <label>Alto <input type="number" step="0.5" [disabled]="element.locked" [value]="element.height" (change)="updateNumeric(element.id, 'height', $event)" /></label>
                                <label>Giro <input type="number" step="1" min="-360" max="360" [disabled]="element.locked || element.type === 'qr'" [value]="element.rotation" (change)="updateRotation(element.id, $event)" /></label>
                            </div>
                            @if (element.type === 'qr') {
                                <p class="property-help">El QR permanece sin giro para que siempre se pueda escanear.</p>
                            }
                        </div>

                        <div class="property-section">
                            <span class="property-section-title">Alinear en la etiqueta</span>
                            <div class="inspector-actions three-columns">
                                <button type="button" [disabled]="element.locked" (click)="positionSelected('left')">Izquierda</button>
                                <button type="button" [disabled]="element.locked" (click)="positionSelected('center')">Centro</button>
                                <button type="button" [disabled]="element.locked" (click)="positionSelected('right')">Derecha</button>
                                <button type="button" [disabled]="element.locked" (click)="positionSelected('top')">Arriba</button>
                                <button type="button" [disabled]="element.locked" (click)="positionSelected('middle')">Medio</button>
                                <button type="button" [disabled]="element.locked" (click)="positionSelected('bottom')">Abajo</button>
                            </div>
                        </div>

                        @if (element.type === 'text') {
                            <label class="property-block">Texto
                                <textarea [disabled]="element.locked" [value]="element.properties.text ?? ''" (input)="updateTextProperty(element.id, 'text', $event)"></textarea>
                            </label>
                        }
                        @if (element.type === 'data' || element.type === 'qr' || element.type === 'barcode') {
                            <label class="property-block">Dato que se imprime
                                <select [disabled]="element.locked" [value]="element.properties.binding ?? ''" (change)="updateTextProperty(element.id, 'binding', $event)">
                                    @for (field of fields(); track field.key) { <option [value]="field.key">{{ field.label }}</option> }
                                </select>
                            </label>
                        }
                        @if (element.type === 'shape' || element.type === 'line') {
                            <div class="property-section">
                                <span class="property-section-title">Trazo y relleno</span>
                                <div class="property-grid compact">
                                    @if (element.type === 'shape') {
                                        <label>Relleno <input type="color" [disabled]="element.locked" [value]="element.properties.fill ?? '#FFFFFF'" (input)="updateTextProperty(element.id, 'fill', $event)" /></label>
                                        <label>Esquinas <input type="number" min="0" max="20" step="0.5" [disabled]="element.locked" [value]="element.properties.radius ?? 0" (change)="updateNumericProperty(element.id, 'radius', $event)" /></label>
                                    }
                                    <label>Trazo <input type="color" [disabled]="element.locked" [value]="element.properties.stroke ?? '#000000'" (input)="updateTextProperty(element.id, 'stroke', $event)" /></label>
                                    <label>Grosor <input type="number" min="0.1" max="4" step="0.1" [disabled]="element.locked" [value]="element.properties.strokeWidth ?? 0.4" (change)="updateNumericProperty(element.id, 'strokeWidth', $event)" /></label>
                                </div>
                            </div>
                        }
                        @if (element.type === 'text' || element.type === 'data') {
                            <div class="property-section">
                                <span class="property-section-title">Tipografía</span>
                                <div class="property-grid compact">
                                    <label>Tamaño <input type="number" min="5" max="60" [disabled]="element.locked" [value]="element.properties.fontSize ?? 12" (change)="updateNumericProperty(element.id, 'fontSize', $event)" /></label>
                                    <label>Peso <select [disabled]="element.locked" [value]="element.properties.fontWeight ?? 500" (change)="updateNumericProperty(element.id, 'fontWeight', $event)"><option value="400">Regular</option><option value="500">Medio</option><option value="600">Semibold</option><option value="700">Negrita</option><option value="800">Extra negrita</option></select></label>
                                    <label>Espaciado <input type="number" min="0" max="8" step="0.1" [disabled]="element.locked" [value]="element.properties.letterSpacing ?? 0" (change)="updateNumericProperty(element.id, 'letterSpacing', $event)" /></label>
                                </div>
                                <div class="inspector-actions text-alignment">
                                    <button type="button" [class.active]="(element.properties.align ?? 'left') === 'left'" [disabled]="element.locked" (click)="alignText('left')">Texto a la izquierda</button>
                                    <button type="button" [class.active]="element.properties.align === 'center'" [disabled]="element.locked" (click)="alignText('center')">Texto centrado</button>
                                    <button type="button" [class.active]="element.properties.align === 'right'" [disabled]="element.locked" (click)="alignText('right')">Texto a la derecha</button>
                                </div>
                                <label class="check-row"><input type="checkbox" [disabled]="element.locked" [checked]="element.properties.wrap ?? false" (change)="toggleProperty(element.id, 'wrap', $event)" /> Ajustar texto en varias líneas</label>
                            </div>
                        }
                        @if (element.type === 'qr' || element.type === 'barcode') {
                            <button type="button" class="secondary-wide-action" [disabled]="element.locked" (click)="applyRecommendedCodeSize(element.id)">Usar tamaño seguro para escanear</button>
                        }
                        @if (element.type === 'image') {
                            <p class="property-help">Elige otra imagen desde Biblioteca. Al cambiar el tamaño, usa las esquinas para conservar una composición limpia.</p>
                        }

                        <div class="property-section">
                            <span class="property-section-title">Orden</span>
                            <div class="layer-actions">
                                <button type="button" [disabled]="element.locked" (click)="moveSelectedToFront()">Al frente</button>
                                <button type="button" [disabled]="element.locked" (click)="moveSelectedToBack()">Al fondo</button>
                            </div>
                        </div>
                        <button type="button" class="danger-link" [disabled]="element.locked || isRequiredElement(element)" (click)="removeSelected()">
                            {{ isRequiredElement(element) ? 'Dato obligatorio protegido' : element.locked ? 'Desbloquea para eliminar' : 'Eliminar elemento' }}
                        </button>
                    } @else {
                        <div class="empty-inspector">
                            <strong>Selecciona algo</strong>
                            <p>Toca un elemento sobre la etiqueta para editarlo. Usa las reglas y el imán para colocarlo con precisión.</p>
                        </div>
                    }
                </ng-template>
            }
        </section>
    `,
    styles: [`
        :host { display: block; color: #3f2232; }
        * { box-sizing: border-box; }
        button, input, select, textarea { font: inherit; }
        button { cursor: pointer; }
        button:disabled { cursor: not-allowed; opacity: .48; }
        .label-page { max-width: 1680px; margin: 0 auto; padding: .2rem 0 2.5rem; }
        .hero { display:flex; gap:1.5rem; justify-content:space-between; align-items:flex-end; margin-bottom:1.25rem; padding:.5rem .3rem; }
        .eyebrow { margin:0 0 .3rem; color:#b6497c; font-size:.67rem; font-weight:800; letter-spacing:.14em; }
        h2, h3, h4, p { margin-top:0; } h2 { margin-bottom:.35rem; font-size:clamp(1.55rem,3vw,2.35rem); letter-spacing:-.045em; } h3 { margin-bottom:0; font-size:1.38rem; } .hero-copy { max-width:670px; margin-bottom:0; color:#80546b; font-size:.94rem; line-height:1.55; }
        .hero-actions { display:flex; gap:.65rem; flex-wrap:wrap; }
        .primary-action, .secondary-action { min-height:44px; border-radius:13px; padding:.65rem 1rem; font-size:.84rem; font-weight:750; }
        .primary-action { border:1px solid #8f2357; color:white; background:linear-gradient(135deg,#b52d68,#8f2357); box-shadow:0 10px 24px rgba(143,35,87,.22); }
        .secondary-action { border:1px solid #ebc7d8; color:#7e345a; background:rgba(255,255,255,.72); }
        .library-card, .editor-shell, .validation-strip { border:1px solid rgba(210,143,174,.28); background:rgba(255,255,255,.66); box-shadow:0 18px 48px rgba(145,50,94,.10); backdrop-filter:blur(14px); }
        .library-card { border-radius:24px; padding:clamp(1.15rem,3vw,2rem); }
        .library-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1.25rem; } .loading-label { color:#b6497c; font-size:.8rem; }
        .starter-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1rem; }
        .starter-card { min-height:235px; position:relative; overflow:hidden; display:flex; flex-direction:column; padding:1.25rem; border:1px solid color-mix(in srgb,var(--accent) 35%, white); border-radius:19px; background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 12%,white),rgba(255,255,255,.95)); }
        .starter-card::after { content:''; position:absolute; right:-45px; bottom:-60px; width:160px; height:160px; border-radius:50%; background:color-mix(in srgb,var(--accent) 18%,transparent); }
        .starter-card h4 { position:relative; z-index:1; margin:.8rem 0 .45rem; font-size:1.25rem; } .starter-card p { position:relative; z-index:1; color:#79556a; line-height:1.45; font-size:.86rem; } .starter-size { position:relative; z-index:1; align-self:flex-start; padding:.28rem .55rem; border-radius:999px; background:white; color:#7a3157; font-size:.68rem; font-weight:750; }
        .card-action { position:relative; z-index:1; min-height:42px; align-self:flex-start; margin-top:auto; border:1px solid var(--accent); border-radius:11px; padding:.5rem .75rem; color:#642442; background:white; font-weight:750; font-size:.78rem; }
        .existing-list { margin-top:1.6rem; border-top:1px solid #f0d9e4; padding-top:1.1rem; } .existing-title { color:#83536c; font-size:.78rem; font-weight:700; } .existing-template { width:100%; display:flex; justify-content:space-between; align-items:center; gap:1rem; text-align:left; padding:.85rem .2rem; border:0; border-bottom:1px solid #f6e5ec; color:#4e263a; background:transparent; } .existing-template strong, .existing-template small { display:block; } .existing-template small { margin-top:.18rem; color:#94627b; font-size:.72rem; } .template-status { padding:.32rem .55rem; border-radius:999px; color:#7d2854; background:#fce6f0; font-size:.67rem; font-weight:750; white-space:nowrap; } .template-status.unpublished { color:#7a6070; background:#f5eef1; } .template-status.default-template, .default-chip { color:#5f3c08; background:#fff2c9; } .default-chip { display:inline-block; margin-left:.35rem; padding:.16rem .36rem; border-radius:999px; font-size:.57rem; font-weight:800; }
        .editor-shell { position:relative; display:grid; grid-template-columns:74px 250px minmax(0,1fr) 270px; min-height:710px; overflow:hidden; border-radius:24px; }
        .tool-rail { padding:.7rem .45rem; display:flex; flex-direction:column; gap:.35rem; border-right:1px solid #f0d9e4; background:rgba(253,239,246,.72); } .tool-rail button { min-height:51px; border:1px solid transparent; border-radius:12px; color:#83536c; background:transparent; font-size:.7rem; font-weight:750; } .tool-rail button.active { border-color:#e8b4cc; color:#8e2155; background:#fff; box-shadow:0 7px 18px rgba(144,45,85,.10); }
        .left-panel, .inspector { padding:1rem; overflow-y:auto; background:rgba(255,250,252,.78); } .left-panel { border-right:1px solid #f0d9e4; } .inspector { border-left:1px solid #f0d9e4; } .panel-heading { display:flex; align-items:center; justify-content:space-between; margin-bottom:.85rem; } .panel-copy, .panel-tip, .property-help { color:#845e72; font-size:.76rem; line-height:1.45; } .panel-tip, .empty-panel { margin-top:1rem; padding:.7rem; border-radius:10px; color:#895b73; background:#fbf0f5; font-size:.74rem; line-height:1.45; }
        .tool-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.5rem; } .tool-grid button { min-height:76px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.2rem; border:1px solid #f0d6e2; border-radius:12px; color:#74304f; background:white; font-size:.68rem; } .tool-grid button b { font-size:1.05rem; }
        .field-list, .layers-list { display:flex; flex-direction:column; gap:.35rem; } .field-row, .layer-row { width:100%; display:flex; justify-content:space-between; align-items:center; gap:.4rem; text-align:left; padding:.65rem; border:1px solid transparent; border-radius:10px; background:transparent; color:#593044; } .field-row:hover, .field-row.selected, .layer-row.selected { border-color:#e6b0c9; background:#fff; } .field-row strong, .field-row small { display:block; } .field-row strong { font-size:.75rem; } .field-row small { margin-top:.15rem; color:#95657d; font-size:.64rem; } .field-row em { color:#9e295d; font-size:.57rem; font-style:normal; font-weight:800; } .layer-type { color:#a04470; font-size:.62rem; font-weight:800; } .layer-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.71rem; } .layer-row small { color:#9a7284; font-size:.6rem; }
        .upload-asset { min-height:76px; display:flex; flex-direction:column; justify-content:center; padding:.75rem; border:1px dashed #d987ae; border-radius:12px; color:#8f2357; background:#fff7fb; font-size:.78rem; font-weight:750; cursor:pointer; } .upload-asset input { position:absolute; width:1px; height:1px; opacity:0; } .upload-asset small { margin-top:.2rem; color:#98657e; font-size:.63rem; font-weight:500; } .asset-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.5rem; margin-top:.75rem; } .asset-card { min-width:0; overflow:hidden; border:1px solid #efd5e2; border-radius:10px; padding:0; color:#78405a; background:#fff; font-size:.64rem; text-align:left; } .asset-card img { display:block; width:100%; aspect-ratio:1; object-fit:contain; padding:.3rem; background:#f8f8f8; } .asset-card span { display:block; overflow:hidden; padding:.35rem; text-overflow:ellipsis; white-space:nowrap; }
        .workspace { min-width:0; display:flex; flex-direction:column; background:radial-gradient(circle at 50% 30%,#fff 0,#fdf3f7 60%,#f8e7ef 100%); } .workspace-toolbar { min-height:65px; display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:.75rem 1rem; border-bottom:1px solid #f0d9e4; } .template-identity { min-width:0; } .template-identity strong, .template-identity small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .template-identity strong { margin-top:.18rem; font-size:.85rem; } .template-identity small { color:#936078; font-size:.63rem; } .printer-chip { display:inline-block; padding:.19rem .42rem; border-radius:999px; color:#7c2952; background:#fde5ef; font-size:.59rem; font-weight:800; } .canvas-actions { display:flex; align-items:center; gap:.4rem; } .canvas-actions button, .canvas-actions select { min-height:34px; border:1px solid #e8c4d4; border-radius:9px; padding:.25rem .45rem; color:#7f3659; background:#fff; font-size:.68rem; } .canvas-actions button.active { color:#922859; background:#fae4ee; box-shadow:0 0 0 2px rgba(178,60,111,.1) inset; }
        .canvas-scroll { flex:1; overflow:auto; display:flex; justify-content:center; align-items:flex-start; padding:1.5rem; } .canvas-stage { position:relative; width:min(100%,760px); min-width:280px; } .canvas-stage.with-rulers { padding:22px 0 0 22px; } .canvas-scale { min-width:280px; margin:0 auto; transition:width .16s ease; } .top-ruler, .left-ruler { position:absolute; display:flex; justify-content:space-between; color:#a65f81; background-color:#fff9fc; font-size:8px; font-weight:800; line-height:1; pointer-events:none; } .top-ruler { top:0; left:22px; right:0; height:18px; align-items:flex-end; padding:0 2px 3px; background-image:repeating-linear-gradient(90deg,transparent 0 9px,rgba(176,78,124,.35) 9px 10px); } .left-ruler { top:22px; bottom:0; left:0; width:18px; flex-direction:column; align-items:flex-end; padding:2px 3px 2px 0; background-image:repeating-linear-gradient(180deg,transparent 0 9px,rgba(176,78,124,.35) 9px 10px); } .left-ruler b:last-child { writing-mode:vertical-rl; transform:rotate(180deg); } .label-artboard { position:relative; width:100%; overflow:hidden; border:1px solid #cfc7cb; background:#fff; box-shadow:0 20px 45px rgba(68,30,48,.2); touch-action:none; } .label-artboard.with-grid { background-image:linear-gradient(to right,rgba(188,105,147,.18) 1px,transparent 1px),linear-gradient(to bottom,rgba(188,105,147,.18) 1px,transparent 1px); background-size:2% 2%; } .thermal-preview { position:absolute; inset:0; width:100%; height:100%; object-fit:fill; pointer-events:none; user-select:none; } .preview-loading { position:absolute; inset:0; display:grid; place-items:center; color:#9d5d7b; font-size:.78rem; background:white; } .safe-area { position:absolute; z-index:3; border:1px dashed rgba(174,61,112,.55); pointer-events:none; } .smart-guide { position:absolute; z-index:7; display:block; background:#a72c61; pointer-events:none; } .smart-guide-vertical { top:0; bottom:0; width:1px; } .smart-guide-horizontal { left:0; right:0; height:1px; }
        .element-hitbox { position:absolute; z-index:5; border:1px solid transparent; transform-origin:center; touch-action:none; } .element-hitbox.selected { z-index:10; border:1.5px solid #cc3979; box-shadow:0 0 0 1px rgba(255,255,255,.9) inset; } .element-hitbox.locked-element.selected { border-color:#76556b; } .element-hitbox.hidden-element { opacity:.4; background:repeating-linear-gradient(135deg,rgba(216,87,139,.15) 0 4px,transparent 4px 8px); } .selection-tag { position:absolute; left:-1px; top:-21px; padding:2px 5px; color:#fff; background:#cc3979; font-size:9px; font-weight:750; line-height:1.3; } .resize-handle { position:absolute; width:14px; height:14px; border:2px solid #fff; border-radius:50%; background:#cc3979; } .resize-handle.top-left { left:-7px; top:-7px; cursor:nwse-resize; } .resize-handle.top-right { right:-7px; top:-7px; cursor:nesw-resize; } .resize-handle.bottom-left { bottom:-7px; left:-7px; cursor:nesw-resize; } .resize-handle.bottom-right { right:-7px; bottom:-7px; cursor:nwse-resize; } .canvas-text-editor { position:absolute; inset:0; min-height:100%; margin:0; resize:none; border:0; border-radius:0; background:rgba(255,255,255,.96); line-height:1.2; outline:2px solid #b52d68; }
        .workspace-footer { display:flex; justify-content:space-between; gap:1rem; padding:.6rem 1rem; border-top:1px solid #f0d9e4; color:#8d6076; font-size:.65rem; }
        .render-error { margin:.8rem 1rem 0; padding:.65rem; border-radius:10px; color:#9c244f; background:#ffe9ef; font-size:.75rem; }
        .selection-title { display:flex; justify-content:space-between; align-items:center; gap:.6rem; margin-bottom:.8rem; } .selection-title strong, .selection-title small { display:block; } .selection-title strong { font-size:.88rem; } .selection-title small { margin-top:.15rem; color:#94627a; font-size:.61rem; } .icon-text, .danger-link { border:0; color:#9a2d5e; background:transparent; font-size:.7rem; font-weight:750; } .quick-property-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.35rem; margin-bottom:.85rem; } .quick-property-actions button, .secondary-wide-action { min-height:32px; border:1px solid #e8c7d5; border-radius:8px; color:#80425e; background:#fff; font-size:.65rem; font-weight:750; } .quick-property-actions button.active { border-color:#cb5d8b; color:#8f2357; background:#fcecf3; } .property-section { margin-top:.95rem; padding-top:.85rem; border-top:1px solid #f1dfe7; } .property-section-title { display:block; margin-bottom:.5rem; color:#a04b73; font-size:.6rem; font-weight:850; letter-spacing:.07em; text-transform:uppercase; } .property-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.45rem; } .property-grid label, .property-block { color:#825069; font-size:.65rem; font-weight:700; } input, select, textarea { width:100%; margin-top:.18rem; border:1px solid #e6bfd0; border-radius:8px; padding:.42rem; color:#4b2940; background:white; font-size:.75rem; outline:none; } textarea { min-height:74px; resize:vertical; } input:focus, select:focus, textarea:focus { border-color:#c13c76; box-shadow:0 0 0 3px rgba(193,60,118,.11); } .property-block { display:block; margin-top:.8rem; } .check-row { display:flex; align-items:center; gap:.4rem; margin-top:.7rem; color:#77455d; font-size:.68rem; } .check-row input { width:16px; height:16px; margin:0; accent-color:#b52d68; } .inspector-actions, .layer-actions { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.3rem; margin-top:.65rem; } .inspector-actions.three-columns { grid-template-columns:repeat(3,minmax(0,1fr)); } .text-alignment { grid-template-columns:1fr; } .layer-actions { grid-template-columns:repeat(2,minmax(0,1fr)); } .inspector-actions button, .layer-actions button { min-height:31px; border:1px solid #e8c7d5; border-radius:8px; color:#80425e; background:#fff; font-size:.61rem; } .inspector-actions button.active { border-color:#cb5d8b; color:#8f2357; background:#fcecf3; } .secondary-wide-action { width:100%; margin-top:.9rem; } .danger-link { display:block; margin:1rem auto .25rem; } .empty-inspector { padding:1rem .25rem; color:#855b6e; font-size:.78rem; line-height:1.5; } .version-panel { margin-top:1.4rem; padding-top:1rem; border-top:1px solid #efdce5; } .version-panel > div { display:flex; justify-content:space-between; gap:.5rem; color:#81536b; font-size:.65rem; } .version-panel > div p { margin:0; } .version-panel button { width:100%; margin-top:.35rem; min-height:33px; border:1px solid #eed1df; border-radius:8px; color:#864460; background:#fff; font-size:.66rem; }
        .validation-strip { display:flex; gap:1rem; align-items:flex-start; margin-top:1rem; padding:1rem 1.15rem; border-radius:16px; color:#6c4a5a; font-size:.75rem; } .validation-strip.has-errors { border-color:#efadc3; background:#fff1f5; color:#922850; } .validation-strip > div { display:flex; flex-wrap:wrap; gap:.4rem .7rem; } .validation-strip span { padding-left:.5rem; border-left:2px solid #d7467f; } .validation-strip span.warning { border-color:#d68b20; color:#8a641e; }
        .mobile-tools, .close-mobile { display:none; }
        @media (max-width: 1180px) { .editor-shell { grid-template-columns:64px 220px minmax(0,1fr); } .inspector { display:none; } }
        @media (max-width: 900px) { .label-page { padding-bottom:5rem; } .hero { align-items:flex-start; flex-direction:column; } .starter-grid { grid-template-columns:1fr; } .editor-shell { grid-template-columns:1fr; min-height:660px; overflow:visible; } .tool-rail, .left-panel { display:none; } .workspace { min-height:660px; border-radius:24px; overflow:hidden; } .workspace-toolbar { align-items:flex-start; flex-direction:column; } .canvas-actions { width:100%; overflow:auto; padding-bottom:.15rem; } .canvas-scroll { padding:1rem; } .canvas-scale { width:100% !important; max-width:600px; } .left-panel { position:absolute; z-index:30; top:0; left:0; bottom:0; width:min(330px,86vw); padding:1rem; box-shadow:18px 0 44px rgba(81,35,59,.22); } .editor-shell.mobile-panel-open .left-panel { display:block; } .mobile-tools { position:absolute; z-index:25; right:1rem; bottom:-52px; display:block; min-height:43px; border:1px solid #c63d76; border-radius:12px; padding:.5rem .8rem; color:white; background:#aa2d62; box-shadow:0 8px 20px rgba(129,35,78,.24); font-size:.75rem; font-weight:750; } .close-mobile { display:block; border:0; color:#9d3161; background:transparent; font-size:.68rem; font-weight:700; } .workspace-footer { font-size:.59rem; } }
        @media (max-width: 520px) { .hero h2 { font-size:1.65rem; } .library-card { padding:1rem; } .workspace-toolbar { padding:.7rem; } .canvas-scroll { padding:.6rem; align-items:center; } .canvas-actions button { padding:.24rem .35rem; } .workspace-footer { flex-direction:column; gap:.2rem; } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition:none !important; } }
    `]
})
export class LabelDesignerComponent {
    private readonly api = inject(ApiService);
    private readonly toast = inject(ToastService);
    private readonly designService = inject(LabelDesignService);
    private readonly renderer = inject(LabelRendererService);
    private readonly labelPrint = inject(LabelPrintService);
    private readonly destroyRef = inject(DestroyRef);
    private autosaveTimer: number | null = null;
    private pointerState: PointerState | null = null;
    private renderSequence = 0;
    private history: LabelDesignDefinition[] = [];
    private historyIndex = -1;
    private copiedElements: LabelElementDefinition[] = [];

    readonly starters: TemplateStarter[] = [
        { kind: 'InventoryBox', profile: 'NiimbotB1_50x50', title: 'Cajas de bodega', description: 'Código, ubicación, contenido y QR/NFC para abrir la caja.', accent: '#c23a77' },
        { kind: 'InventoryItem', profile: 'NiimbotB1_50x50', title: 'Artículos', description: 'Nombre y código de barras o código Regi Bazar para inventario.', accent: '#9a64c9' },
        { kind: 'OrderPackage', profile: 'AiyinE40_4x6', title: 'Bolsas de pedido', description: 'Clienta, dirección, contenido y QR logístico de cada bolsa.', accent: '#d77a49' }
    ];

    readonly templates = signal<LabelTemplateSummaryDto[]>([]);
    readonly assets = signal<LabelAssetDto[]>([]);
    readonly activeTemplate = signal<LabelTemplateDetailDto | null>(null);
    readonly design = signal<LabelDesignDefinition>(this.emptyDesign());
    readonly selectedElementId = signal<string | null>(null);
    readonly selectedElementIds = signal<string[]>([]);
    readonly activeTab = signal<SidebarTab>('elements');
    readonly selectedBinding = signal('');
    readonly previewUrl = signal<string | null>(null);
    readonly renderError = signal<string | null>(null);
    readonly isLoadingLibrary = signal(true);
    readonly isCreatingKind = signal<LabelTemplateKind | null>(null);
    readonly isSaving = signal(false);
    readonly isPublishing = signal(false);
    readonly isUploadingAsset = signal(false);
    readonly showGrid = signal(true);
    readonly snapEnabled = signal(true);
    readonly showRulers = signal(true);
    readonly zoom = signal(100);
    readonly mobilePanelOpen = signal(false);
    readonly isDirty = signal(false);
    readonly lastSavedAt = signal<Date | null>(null);
    readonly snapGuide = signal<SnapGuide>({ x: null, y: null });
    readonly inlineEditingElementId = signal<string | null>(null);
    readonly inlineTextValue = signal('');

    readonly selectedElement = computed(() => this.design().elements.find(element => element.id === this.selectedElementId()) ?? null);
    readonly selectedElements = computed(() => {
        const selectedIds = new Set(this.selectedElementIds());
        return this.design().elements.filter(element => selectedIds.has(element.id));
    });
    readonly fields = computed(() => this.activeTemplate() ? this.designService.getFields(this.activeTemplate()!.kind) : []);
    readonly issues = computed<LabelDesignIssue[]>(() => {
        const template = this.activeTemplate();
        return template ? this.designService.validate(this.design(), template.kind, template.printerProfile) : [];
    });
    readonly errors = computed(() => this.issues().filter(issue => issue.severity === 'error'));
    readonly orderedElements = computed(() => [...this.design().elements].sort((left, right) => right.zIndex - left.zIndex));
    readonly canUndo = computed(() => this.historyIndex > 0);
    readonly canRedo = computed(() => this.historyIndex >= 0 && this.historyIndex < this.history.length - 1);
    readonly canvasAspectRatio = computed(() => `${this.design().canvas.widthMm} / ${this.design().canvas.heightMm}`);
    readonly savedState = computed(() => {
        if (this.isSaving()) return 'Guardando borrador…';
        if (this.isDirty()) return 'Cambios sin guardar';
        return this.lastSavedAt() ? 'Borrador guardado' : 'Listo para editar';
    });

    constructor() {
        this.loadLibrary();
    }

    templateFor(kind: LabelTemplateKind): LabelTemplateSummaryDto | undefined {
        return this.templates().find(template => template.kind === kind && !template.isArchived);
    }

    panelTitle(): string {
        return ({
            elements: 'AGREGAR',
            fields: 'DATOS DEL SISTEMA',
            images: 'BIBLIOTECA',
            layers: 'CAPAS',
            properties: 'AJUSTES DEL ELEMENTO'
        } as Record<SidebarTab, string>)[this.activeTab()];
    }

    printerLabel(profile: LabelPrinterProfile): string {
        return this.renderer.getProfile(profile).name;
    }

    openTemplate(id: string): void {
        this.api.getLabelTemplate(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: template => {
                const draft = template.draftVersion;
                if (!draft) {
                    this.toast.error('Esta plantilla no tiene un borrador disponible.');
                    return;
                }
                try {
                    const design = this.designService.parseDesign(draft.designJson);
                    this.activeTemplate.set(template);
                    this.design.set(design);
                    this.history = [this.designService.cloneDesign(design)];
                    this.historyIndex = 0;
                    this.selectedElementId.set(null);
                    this.selectedElementIds.set([]);
                    this.selectedBinding.set(this.designService.getFields(template.kind)[0]?.key ?? '');
                    this.isDirty.set(false);
                    this.lastSavedAt.set(new Date(draft.createdAt));
                    this.mobilePanelOpen.set(false);
                    this.renderPreview();
                } catch {
                    this.toast.error('No pudimos abrir este diseño.');
                }
            },
            error: () => this.toast.error('No pudimos cargar la plantilla.')
        });
    }

    backToLibrary(): void {
        this.flushAutosave();
        this.activeTemplate.set(null);
        this.selectedElementId.set(null);
        this.selectedElementIds.set([]);
        this.previewUrl.set(null);
        this.mobilePanelOpen.set(false);
        this.loadLibrary();
    }

    createStarter(starter: TemplateStarter): void {
        this.isCreatingKind.set(starter.kind);
        const request: CreateLabelTemplateDto = {
            name: starter.title,
            description: starter.description,
            kind: this.kindValue(starter.kind),
            printerProfile: this.profileValue(starter.profile)
        };
        this.api.createLabelTemplate(request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: template => {
                this.isCreatingKind.set(null);
                this.templates.update(current => [this.toSummary(template), ...current]);
                this.toast.success('Diseño inicial creado. Ahora puedes hacerlo completamente tuyo.');
                this.openTemplate(template.id);
            },
            error: error => {
                this.isCreatingKind.set(null);
                this.toast.error(this.errorMessage(error, 'No pudimos crear la plantilla.'));
            }
        });
    }

    addElement(type: LabelElementType): void {
        const template = this.activeTemplate();
        if (!template) return;
        const element = this.designService.createElement(type, template.printerProfile);
        if (type === 'qr') element.properties.binding = this.defaultCodeBinding(template.kind, 'qr');
        if (type === 'barcode') element.properties.binding = this.defaultCodeBinding(template.kind, 'barcode');
        element.zIndex = this.nextZIndex();
        this.applyDesign({ ...this.design(), elements: [...this.design().elements, element] });
        this.selectElement(element.id);
        this.mobilePanelOpen.set(false);
    }

    addDataElement(): void {
        const template = this.activeTemplate();
        if (!template) return;
        const element = this.designService.createElement('data', template.printerProfile);
        element.properties.binding = this.selectedBinding() || this.fields()[0]?.key;
        element.zIndex = this.nextZIndex();
        this.applyDesign({ ...this.design(), elements: [...this.design().elements, element] });
        this.selectElement(element.id);
        this.mobilePanelOpen.set(false);
    }

    addImage(asset: LabelAssetDto): void {
        const template = this.activeTemplate();
        if (!template) return;
        const element = this.designService.createElement('image', template.printerProfile, asset.id);
        element.zIndex = this.nextZIndex();
        this.applyDesign({ ...this.design(), elements: [...this.design().elements, element] });
        this.selectElement(element.id);
        this.toast.success(`Agregué “${asset.name}” al lienzo.`);
        this.mobilePanelOpen.set(false);
    }

    selectField(binding: string): void {
        this.selectedBinding.set(binding);
        this.addDataElement();
    }

    selectElement(id: string, additive = false): void {
        const currentIds = this.selectedElementIds();
        const nextIds = additive
            ? currentIds.includes(id) ? currentIds.filter(currentId => currentId !== id) : [...currentIds, id]
            : [id];
        this.selectedElementIds.set(nextIds);
        this.selectedElementId.set(nextIds.includes(id) ? id : nextIds[0] ?? null);
        const element = this.design().elements.find(current => current.id === id);
        if (element?.properties.binding) this.selectedBinding.set(element.properties.binding);
    }

    isElementSelected(id: string): boolean {
        return this.selectedElementIds().includes(id);
    }

    startInlineTextEditing(event: MouseEvent, element: LabelElementDefinition): void {
        if (element.type !== 'text' || element.locked) return;
        event.preventDefault();
        event.stopPropagation();
        this.selectElement(element.id);
        this.inlineTextValue.set(element.properties.text ?? '');
        this.inlineEditingElementId.set(element.id);
        window.setTimeout(() => document.querySelector<HTMLTextAreaElement>('.canvas-text-editor')?.focus());
    }

    setInlineTextValue(event: Event): void {
        this.inlineTextValue.set((event.target as HTMLTextAreaElement).value);
    }

    commitInlineTextEditing(): void {
        const id = this.inlineEditingElementId();
        if (!id) return;
        this.updateTextPropertyValue(id, 'text', this.inlineTextValue());
        this.inlineEditingElementId.set(null);
    }

    cancelInlineTextEditing(): void {
        this.inlineEditingElementId.set(null);
        this.inlineTextValue.set('');
    }

    clearSelectionFromCanvas(event: PointerEvent): void {
        if (event.target === event.currentTarget) {
            this.selectedElementId.set(null);
            this.selectedElementIds.set([]);
            this.cancelInlineTextEditing();
        }
    }

    startPointerAction(event: PointerEvent, element: LabelElementDefinition, action: PointerAction, handle?: ResizeHandle): void {
        event.preventDefault();
        event.stopPropagation();
        const additive = event.shiftKey || event.ctrlKey || event.metaKey;
        this.selectElement(element.id, additive);
        if (additive) return;
        if (element.locked) {
            this.toast.info('Este elemento está bloqueado. Desbloquéalo desde Ajustes para moverlo o editarlo.');
            return;
        }
        this.pointerState = {
            action,
            elementId: element.id,
            startX: event.clientX,
            startY: event.clientY,
            original: { ...element, properties: { ...element.properties } },
            handle
        };
        (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    }

    @HostListener('document:pointermove', ['$event'])
    onDocumentPointerMove(event: PointerEvent): void {
        const state = this.pointerState;
        const template = this.activeTemplate();
        if (!state || !template) return;
        const artboard = document.querySelector<HTMLElement>('.label-artboard');
        if (!artboard) return;
        const rect = artboard.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dx = ((event.clientX - state.startX) / rect.width) * this.design().canvas.widthMm;
        const dy = ((event.clientY - state.startY) / rect.height) * this.design().canvas.heightMm;
        const changed = state.action === 'move'
            ? { ...state.original, x: state.original.x + dx, y: state.original.y + dy }
            : this.resizeFromHandle(state.original, dx, dy, state.handle ?? 'bottom-right');
        const clamped = this.designService.clampElement(changed, this.renderer.getProfile(template.printerProfile));
        const nextElement = this.applyPlacementSnap(clamped, event.shiftKey);
        this.replaceElement(nextElement, false);
    }

    @HostListener('document:pointerup')
    onDocumentPointerUp(): void {
        if (!this.pointerState) return;
        this.pointerState = null;
        this.snapGuide.set({ x: null, y: null });
        this.commitCurrentToHistory();
        this.queueAutosave();
    }

    @HostListener('document:keydown', ['$event'])
    onDocumentKeydown(event: KeyboardEvent): void {
        if (this.isEditingTextControl(event.target)) return;
        const modifierPressed = event.ctrlKey || event.metaKey;
        if (modifierPressed && event.key.toLowerCase() === 'a') {
            event.preventDefault();
            const ids = this.design().elements.map(element => element.id);
            this.selectedElementIds.set(ids);
            this.selectedElementId.set(ids[0] ?? null);
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            this.selectedElementIds.set([]);
            this.selectedElementId.set(null);
            this.cancelInlineTextEditing();
            return;
        }
        if (modifierPressed && event.key.toLowerCase() === 'c') {
            event.preventDefault();
            this.copySelectedElements();
            return;
        }
        if (modifierPressed && event.key.toLowerCase() === 'v') {
            event.preventDefault();
            this.pasteCopiedElements();
            return;
        }
        const selected = this.selectedElement();
        if (!selected) return;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            if (event.shiftKey) this.redo(); else this.undo();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
            event.preventDefault();
            this.redo();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
            event.preventDefault();
            this.duplicateSelected();
            return;
        }
        const offsetByKey: Record<string, [number, number]> = {
            ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
        };
        if (offsetByKey[event.key]) {
            event.preventDefault();
            if (selected.locked) return;
            const multiplier = event.shiftKey ? 5 : 1;
            const [x, y] = offsetByKey[event.key];
            this.nudgeSelected(x * multiplier, y * multiplier);
        }
        if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            this.removeSelected();
        }
        if (event.key === '+' || event.key === '=') this.changeZoomBy(1);
        if (event.key === '-') this.changeZoomBy(-1);
    }

    updateNumeric(id: string, key: 'x' | 'y' | 'width' | 'height', event: Event): void {
        const value = this.readNumber(event);
        if (value === null) return;
        const template = this.activeTemplate();
        const element = this.design().elements.find(current => current.id === id);
        if (!template || !element || element.locked) return;
        this.replaceElement(this.designService.clampElement({ ...element, [key]: value }, this.renderer.getProfile(template.printerProfile)));
    }

    updateRotation(id: string, event: Event): void {
        const rotation = this.readNumber(event);
        if (rotation === null) return;
        this.updateElement(id, element => element.type === 'qr' ? element : { ...element, rotation });
    }

    updateNumericProperty(id: string, key: keyof LabelElementDefinition['properties'], event: Event): void {
        const value = this.readNumber(event);
        if (value === null) return;
        this.updateElement(id, element => ({ ...element, properties: { ...element.properties, [key]: value } }));
    }

    updateTextProperty(id: string, key: keyof LabelElementDefinition['properties'], event: Event): void {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        this.updateTextPropertyValue(id, key, target.value);
    }

    updateTextPropertyValue(id: string, key: keyof LabelElementDefinition['properties'], value: string): void {
        this.updateElement(id, element => ({ ...element, properties: { ...element.properties, [key]: value } }));
    }

    toggleProperty(id: string, key: keyof LabelElementDefinition['properties'], event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        this.updateElement(id, element => ({ ...element, properties: { ...element.properties, [key]: checked } }));
    }

    toggleVisibility(id: string, event: Event): void {
        const element = this.design().elements.find(current => current.id === id);
        if (!element) return;
        const target = event.target;
        const visible = target instanceof HTMLInputElement ? target.checked : !element.visible;
        this.replaceElement({ ...element, visible });
    }

    toggleLocked(id: string): void {
        const element = this.design().elements.find(current => current.id === id);
        if (!element) return;
        this.replaceElement({ ...element, locked: !element.locked });
    }

    toggleSelectedElementsLock(): void {
        const selected = this.selectedElements();
        if (!selected.length) return;
        const selectedIds = new Set(selected.map(element => element.id));
        const shouldLock = selected.some(element => !element.locked);
        this.applyDesign({
            ...this.design(),
            elements: this.design().elements.map(element => selectedIds.has(element.id) ? { ...element, locked: shouldLock } : element)
        });
    }

    alignText(alignment: 'left' | 'center' | 'right'): void {
        const selected = this.selectedElement();
        if (!selected || selected.locked || !['text', 'data'].includes(selected.type)) return;
        this.updateElement(selected.id, element => ({ ...element, properties: { ...element.properties, align: alignment } }));
    }

    positionSelected(position: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void {
        const selected = this.selectedElement();
        const template = this.activeTemplate();
        if (!selected || selected.locked || !template) return;
        const profile = this.renderer.getProfile(template.printerProfile);
        const x = position === 'left' ? 0 : position === 'center' ? (profile.widthMm - selected.width) / 2 : position === 'right' ? profile.widthMm - selected.width : selected.x;
        const y = position === 'top' ? 0 : position === 'middle' ? (profile.heightMm - selected.height) / 2 : position === 'bottom' ? profile.heightMm - selected.height : selected.y;
        this.replaceElement(this.designService.clampElement({ ...selected, x, y }, profile));
    }

    alignSelectedElements(position: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void {
        const selected = this.selectedElements().filter(element => !element.locked);
        if (selected.length < 2) return;
        const positions = alignSelection(selected, position);
        this.applyDesign({
            ...this.design(),
            elements: this.design().elements.map(element => {
                const nextPosition = positions.get(element.id);
                return nextPosition ? { ...element, x: nextPosition.x, y: nextPosition.y } : element;
            })
        });
    }

    distributeSelectedElements(direction: 'horizontal' | 'vertical'): void {
        const selected = this.selectedElements().filter(element => !element.locked);
        if (selected.length < 3) return;
        const positions = distributeSelection(selected, direction);
        this.applyDesign({
            ...this.design(),
            elements: this.design().elements.map(element => {
                const nextPosition = positions.get(element.id);
                return nextPosition ? { ...element, x: nextPosition.x, y: nextPosition.y } : element;
            })
        });
    }

    moveSelectedToFront(): void {
        const selected = this.selectedElements().filter(element => !element.locked);
        if (!selected.length) return;
        const selectedIds = new Set(selected.map(element => element.id));
        const ordered = [...selected].sort((left, right) => left.zIndex - right.zIndex);
        const zIndexById = new Map(ordered.map((element, index) => [element.id, this.nextZIndex() + index]));
        this.applyDesign({ ...this.design(), elements: this.design().elements.map(element => selectedIds.has(element.id) ? { ...element, zIndex: zIndexById.get(element.id)! } : element) });
    }

    moveSelectedToBack(): void {
        const selected = this.selectedElements().filter(element => !element.locked);
        if (!selected.length) return;
        const selectedIds = new Set(selected.map(element => element.id));
        const ordered = [...selected].sort((left, right) => left.zIndex - right.zIndex);
        const lowestLayer = Math.min(0, ...this.design().elements.map(element => element.zIndex)) - ordered.length;
        const zIndexById = new Map(ordered.map((element, index) => [element.id, lowestLayer + index]));
        this.applyDesign({ ...this.design(), elements: this.design().elements.map(element => selectedIds.has(element.id) ? { ...element, zIndex: zIndexById.get(element.id)! } : element) });
    }

    duplicateSelected(): void {
        const selected = this.selectedElements().filter(element => !element.locked);
        const template = this.activeTemplate();
        if (!selected.length || !template) return;
        const copies = this.createElementCopies(selected, template.printerProfile, 2);
        this.applyDesign({ ...this.design(), elements: [...this.design().elements, ...copies] });
        this.selectedElementIds.set(copies.map(element => element.id));
        this.selectedElementId.set(copies[0]?.id ?? null);
    }

    copySelectedElements(): void {
        this.copiedElements = this.selectedElements().map(element => ({ ...element, properties: { ...element.properties } }));
        if (this.copiedElements.length) this.toast.info(`${this.copiedElements.length} elemento${this.copiedElements.length === 1 ? '' : 's'} copiado${this.copiedElements.length === 1 ? '' : 's'}.`);
    }

    pasteCopiedElements(): void {
        const template = this.activeTemplate();
        if (!template || !this.copiedElements.length) return;
        const copies = this.createElementCopies(this.copiedElements, template.printerProfile, 2);
        this.applyDesign({ ...this.design(), elements: [...this.design().elements, ...copies] });
        this.selectedElementIds.set(copies.map(element => element.id));
        this.selectedElementId.set(copies[0]?.id ?? null);
    }

    setAsDefault(): void {
        const template = this.activeTemplate();
        if (!template || !template.publishedVersion) return;
        this.api.setDefaultLabelTemplate(template.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: updated => {
                this.activeTemplate.set(updated);
                this.loadLibrary();
                this.toast.success('Esta es ahora la plantilla oficial para imprimir.');
            },
            error: error => this.toast.error(this.errorMessage(error, 'No pudimos elegir la plantilla predeterminada.'))
        });
    }

    removeSelected(): void {
        const removableIds = new Set(this.selectedElements().filter(element => !element.locked && !this.isRequiredElement(element)).map(element => element.id));
        if (!removableIds.size) return;
        this.applyDesign({ ...this.design(), elements: this.design().elements.filter(element => !removableIds.has(element.id)) });
        const remaining = this.selectedElementIds().filter(id => !removableIds.has(id));
        this.selectedElementIds.set(remaining);
        this.selectedElementId.set(remaining[0] ?? null);
        this.cancelInlineTextEditing();
    }

    undo(): void {
        if (!this.canUndo()) return;
        this.historyIndex--;
        this.design.set(this.designService.cloneDesign(this.history[this.historyIndex]));
        this.isDirty.set(true);
        this.renderPreview();
        this.queueAutosave();
    }

    redo(): void {
        if (!this.canRedo()) return;
        this.historyIndex++;
        this.design.set(this.designService.cloneDesign(this.history[this.historyIndex]));
        this.isDirty.set(true);
        this.renderPreview();
        this.queueAutosave();
    }

    changeZoom(event: Event): void {
        const value = Number((event.target as HTMLSelectElement).value);
        if (Number.isFinite(value)) this.zoom.set(value);
    }

    changeZoomBy(direction: -1 | 1): void {
        const levels = [60, 75, 100, 125, 150];
        const currentIndex = levels.indexOf(this.zoom());
        const fallbackIndex = levels.findIndex(level => level >= this.zoom());
        const index = currentIndex >= 0 ? currentIndex : Math.max(0, fallbackIndex);
        this.zoom.set(levels[Math.max(0, Math.min(levels.length - 1, index + direction))]);
    }

    toggleGrid(): void {
        this.showGrid.set(!this.showGrid());
    }

    toggleSnap(): void {
        this.snapEnabled.set(!this.snapEnabled());
        this.snapGuide.set({ x: null, y: null });
    }

    toggleRulers(): void {
        this.showRulers.set(!this.showRulers());
    }

    applyRecommendedCodeSize(id: string): void {
        const template = this.activeTemplate();
        const element = this.design().elements.find(current => current.id === id);
        if (!template || !element || element.locked || !['qr', 'barcode'].includes(element.type)) return;
        const profile = this.renderer.getProfile(template.printerProfile);
        if (element.type === 'qr') {
            const minimum = template.printerProfile === 'NiimbotB1_50x50' ? 20 : 28;
            const side = Math.min(Math.max(minimum, Math.max(element.width, element.height)), Math.min(profile.widthMm, profile.heightMm) - 2);
            this.replaceElement(this.designService.clampElement({ ...element, width: side, height: side, rotation: 0 }, profile));
            return;
        }
        const minimumWidth = template.printerProfile === 'NiimbotB1_50x50' ? 30 : 45;
        this.replaceElement(this.designService.clampElement({ ...element, width: Math.max(minimumWidth, element.width), height: Math.max(10, element.height) }, profile));
    }

    toggleMobilePanel(): void {
        this.mobilePanelOpen.set(!this.mobilePanelOpen());
    }

    async printTest(): Promise<void> {
        const template = this.activeTemplate();
        if (!template) return;
        try {
            const canvas = await this.labelPrint.renderDraft(
                this.designService.serializeDesign(this.design()),
                template.kind,
                template.printerProfile
            );
            await this.renderer.printInBrowser(canvas, template.printerProfile, `Prueba · ${template.name}`);
        } catch (error) {
            this.toast.error(error instanceof Error ? error.message : 'No pudimos preparar la prueba de impresión.');
        }
    }

    async downloadTest(): Promise<void> {
        const template = this.activeTemplate();
        if (!template) return;
        try {
            const canvas = await this.labelPrint.renderDraft(
                this.designService.serializeDesign(this.design()),
                template.kind,
                template.printerProfile
            );
            this.renderer.downloadPng(canvas, `Prueba ${template.name}`);
        } catch (error) {
            this.toast.error(error instanceof Error ? error.message : 'No pudimos crear el PNG.');
        }
    }

    async shareTest(): Promise<void> {
        const template = this.activeTemplate();
        if (!template) return;
        try {
            const canvas = await this.labelPrint.renderDraft(
                this.designService.serializeDesign(this.design()),
                template.kind,
                template.printerProfile
            );
            const shared = await this.renderer.sharePng(canvas, `Prueba ${template.name}`);
            if (!shared) {
                this.renderer.downloadPng(canvas, `Prueba ${template.name}`);
                this.toast.info('Tu navegador no permite compartir este PNG; lo descargué para abrirlo con la app de impresión.');
            }
        } catch (error) {
            this.toast.error(error instanceof Error ? error.message : 'No pudimos compartir la etiqueta.');
        }
    }

    uploadAsset(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
            this.toast.warning('Usa una imagen PNG, JPG o WebP de máximo 5 MB.');
            return;
        }
        this.isUploadingAsset.set(true);
        this.api.uploadLabelAsset(file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: asset => {
                this.assets.update(current => [asset, ...current]);
                this.isUploadingAsset.set(false);
                this.addImage(asset);
            },
            error: error => {
                this.isUploadingAsset.set(false);
                this.toast.error(this.errorMessage(error, 'No pudimos subir esa imagen.'));
            }
        });
    }

    restoreVersion(version: LabelTemplateVersionDto): void {
        const template = this.activeTemplate();
        const draft = template?.draftVersion;
        if (!template || !draft || this.isSaving()) return;
        this.api.restoreLabelTemplateVersion(template.id, version.id, draft.revision).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: result => {
                this.replaceDraftVersion(result.draftVersion);
                try {
                    this.resetDesign(this.designService.parseDesign(result.draftVersion.designJson));
                    this.toast.success(`Restauré la versión ${version.versionNumber} en el borrador.`);
                } catch {
                    this.toast.error('No pudimos cargar la versión restaurada.');
                }
            },
            error: error => this.handleSaveError(error)
        });
    }

    publish(): void {
        const template = this.activeTemplate();
        if (!template || this.errors().length > 0 || this.isPublishing() || this.isSaving()) return;
        this.isPublishing.set(true);
        this.flushAutosave();
        this.saveDraft(() => {
            const latest = this.activeTemplate()?.draftVersion;
            if (!latest) {
                this.isPublishing.set(false);
                return;
            }
            this.api.publishLabelTemplate(template.id, latest.revision).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
                next: result => {
                    this.isPublishing.set(false);
                    this.updateAfterPublish(result.publishedVersion, result.draftVersion);
                    this.toast.success('Versión publicada. Ya es la etiqueta oficial para imprimir.');
                    if (result.warnings.length) this.toast.warning(result.warnings[0]);
                    this.loadLibrary();
                },
                error: error => {
                    this.isPublishing.set(false);
                    this.toast.error(this.errorMessage(error, 'No pudimos publicar la versión.'));
                }
            });
        }, () => this.isPublishing.set(false));
    }

    leftPercent(element: LabelElementDefinition): number { return (element.x / this.design().canvas.widthMm) * 100; }
    topPercent(element: LabelElementDefinition): number { return (element.y / this.design().canvas.heightMm) * 100; }
    widthPercent(element: LabelElementDefinition): number { return (element.width / this.design().canvas.widthMm) * 100; }
    heightPercent(element: LabelElementDefinition): number { return (element.height / this.design().canvas.heightMm) * 100; }
    safeInsetXPercent(): number { return (1 / this.design().canvas.widthMm) * 100; }
    safeInsetYPercent(): number { return (1 / this.design().canvas.heightMm) * 100; }
    elementTypeName(type: LabelElementType): string { return ({ text: 'Texto', data: 'Dato', image: 'Imagen', qr: 'QR', barcode: 'Barras', shape: 'Forma', line: 'Línea' } as Record<LabelElementType, string>)[type]; }
    elementName(element: LabelElementDefinition): string { return element.properties.text || element.properties.binding || element.properties.assetId || this.elementTypeName(element.type); }
    isRequiredElement(element: LabelElementDefinition): boolean { const template = this.activeTemplate(); return !!template && !!element.properties.binding && this.designService.getRequiredBindings(template.kind).includes(element.properties.binding); }
    historicalVersions(): LabelTemplateVersionDto[] { return this.activeTemplate()?.versions.filter(version => version.status !== 'Draft').slice(0, 5) ?? []; }

    private loadLibrary(): void {
        this.isLoadingLibrary.set(true);
        this.api.getLabelTemplates().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: templates => { this.templates.set(templates); this.isLoadingLibrary.set(false); },
            error: () => { this.isLoadingLibrary.set(false); this.toast.error('No pudimos cargar las plantillas.'); }
        });
        this.api.getLabelAssets().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: assets => this.assets.set(assets) });
    }

    private applyDesign(next: LabelDesignDefinition, addToHistory = true): void {
        this.design.set(next);
        this.isDirty.set(true);
        if (addToHistory) this.commitCurrentToHistory();
        this.renderPreview();
        this.queueAutosave();
    }

    private replaceElement(next: LabelElementDefinition, addToHistory = true): void {
        this.applyDesign({ ...this.design(), elements: this.design().elements.map(element => element.id === next.id ? next : element) }, addToHistory);
    }

    private updateElement(id: string, update: (element: LabelElementDefinition) => LabelElementDefinition): void {
        const element = this.design().elements.find(current => current.id === id);
        if (!element || element.locked) return;
        this.replaceElement(update(element));
    }

    private nudgeSelected(dx: number, dy: number): void {
        const selected = this.selectedElement();
        const template = this.activeTemplate();
        if (!selected || !template) return;
        const adjusted = this.designService.clampElement({ ...selected, x: selected.x + dx, y: selected.y + dy }, this.renderer.getProfile(template.printerProfile));
        this.replaceElement(adjusted);
    }

    private createElementCopies(elements: LabelElementDefinition[], profile: LabelPrinterProfile, offsetMm: number): LabelElementDefinition[] {
        const profileSpec = this.renderer.getProfile(profile);
        const baseZIndex = this.nextZIndex();
        return elements.map((element, index) => {
            const generated = this.designService.createElement(element.type, profile);
            return this.designService.clampElement({
                ...element,
                id: generated.id,
                x: element.x + offsetMm,
                y: element.y + offsetMm,
                zIndex: baseZIndex + index,
                locked: false,
                properties: { ...element.properties }
            }, profileSpec);
        });
    }

    private snapElement(element: LabelElementDefinition): LabelElementDefinition {
        if (!this.showGrid()) return element;
        const snap = (value: number) => Math.round(value * 2) / 2;
        return { ...element, x: snap(element.x), y: snap(element.y), width: snap(element.width), height: snap(element.height) };
    }

    private resizeFromHandle(element: LabelElementDefinition, dx: number, dy: number, handle: ResizeHandle): LabelElementDefinition {
        const minimum = element.type === 'line' ? 0.5 : 1;
        let x = element.x;
        let y = element.y;
        let width = element.width;
        let height = element.height;

        if (handle === 'top-left' || handle === 'bottom-left') {
            width = Math.max(minimum, element.width - dx);
            x = element.x + element.width - width;
        } else {
            width = Math.max(minimum, element.width + dx);
        }

        if (handle === 'top-left' || handle === 'top-right') {
            height = Math.max(minimum, element.height - dy);
            y = element.y + element.height - height;
        } else {
            height = Math.max(minimum, element.height + dy);
        }

        if (element.type === 'qr') {
            const side = Math.max(width, height);
            if (handle === 'top-left' || handle === 'bottom-left') x = element.x + element.width - side;
            if (handle === 'top-left' || handle === 'top-right') y = element.y + element.height - side;
            width = side;
            height = side;
        }

        return { ...element, x, y, width, height };
    }

    private applyPlacementSnap(element: LabelElementDefinition, bypassGuides: boolean): LabelElementDefinition {
        const template = this.activeTemplate();
        if (!template) return element;
        const base = this.snapElement(element);
        if (!this.snapEnabled() || bypassGuides) {
            this.snapGuide.set({ x: null, y: null });
            return base;
        }

        const profile = this.renderer.getProfile(template.printerProfile);
        const verticalCandidates: Array<{ position: number; guide: number }> = [
            { position: 0, guide: 0 },
            { position: (profile.widthMm - base.width) / 2, guide: profile.widthMm / 2 },
            { position: profile.widthMm - base.width, guide: profile.widthMm }
        ];
        const horizontalCandidates: Array<{ position: number; guide: number }> = [
            { position: 0, guide: 0 },
            { position: (profile.heightMm - base.height) / 2, guide: profile.heightMm / 2 },
            { position: profile.heightMm - base.height, guide: profile.heightMm }
        ];

        for (const other of this.design().elements) {
            if (other.id === base.id || !other.visible) continue;
            verticalCandidates.push(
                { position: other.x, guide: other.x },
                { position: other.x + other.width / 2 - base.width / 2, guide: other.x + other.width / 2 },
                { position: other.x + other.width - base.width, guide: other.x + other.width }
            );
            horizontalCandidates.push(
                { position: other.y, guide: other.y },
                { position: other.y + other.height / 2 - base.height / 2, guide: other.y + other.height / 2 },
                { position: other.y + other.height - base.height, guide: other.y + other.height }
            );
        }

        const nearestX = this.findNearestSnap(base.x, verticalCandidates);
        const nearestY = this.findNearestSnap(base.y, horizontalCandidates);
        const snapped = this.designService.clampElement({
            ...base,
            x: nearestX?.position ?? base.x,
            y: nearestY?.position ?? base.y
        }, profile);
        this.snapGuide.set({
            x: nearestX ? (nearestX.guide / profile.widthMm) * 100 : null,
            y: nearestY ? (nearestY.guide / profile.heightMm) * 100 : null
        });
        return snapped;
    }

    private findNearestSnap(current: number, candidates: Array<{ position: number; guide: number }>): { position: number; guide: number } | null {
        let nearest: { position: number; guide: number } | null = null;
        let distance = Number.POSITIVE_INFINITY;
        for (const candidate of candidates) {
            const candidateDistance = Math.abs(candidate.position - current);
            if (candidateDistance < distance) {
                nearest = candidate;
                distance = candidateDistance;
            }
        }
        return distance <= 0.85 ? nearest : null;
    }

    private commitCurrentToHistory(): void {
        const snapshot = this.designService.cloneDesign(this.design());
        const current = this.history[this.historyIndex];
        if (current && this.designService.serializeDesign(current) === this.designService.serializeDesign(snapshot)) return;
        this.history = [...this.history.slice(0, this.historyIndex + 1), snapshot].slice(-30);
        this.historyIndex = this.history.length - 1;
    }

    private resetDesign(design: LabelDesignDefinition): void {
        this.design.set(design);
        this.history = [this.designService.cloneDesign(design)];
        this.historyIndex = 0;
        this.isDirty.set(false);
        this.lastSavedAt.set(new Date());
        this.renderPreview();
    }

    private renderPreview(): void {
        const template = this.activeTemplate();
        if (!template) return;
        const renderSequence = ++this.renderSequence;
        const assetUrls = new Map(this.assets().map(asset => [asset.id, asset.url]));
        this.renderError.set(null);
        void this.renderer.render(this.design(), template.printerProfile, {
            data: this.designService.getSampleData(template.kind),
            assetUrls,
            scale: 1.5,
            monochrome: true
        }).then(canvas => {
            if (renderSequence !== this.renderSequence) return;
            this.previewUrl.set(canvas.toDataURL('image/png'));
        }).catch(error => {
            if (renderSequence !== this.renderSequence) return;
            this.renderError.set(error instanceof Error ? error.message : 'No pudimos renderizar la etiqueta.');
        });
    }

    private queueAutosave(): void {
        if (this.autosaveTimer !== null) window.clearTimeout(this.autosaveTimer);
        if (!this.activeTemplate() || this.errors().length > 0) return;
        this.autosaveTimer = window.setTimeout(() => this.saveDraft(), 900);
    }

    private flushAutosave(): void {
        if (this.autosaveTimer !== null) {
            window.clearTimeout(this.autosaveTimer);
            this.autosaveTimer = null;
        }
    }

    private saveDraft(afterSave?: () => void, afterError?: () => void): void {
        const template = this.activeTemplate();
        const draft = template?.draftVersion;
        if (!template || !draft || !this.isDirty()) {
            afterSave?.();
            return;
        }
        if (this.isSaving()) {
            afterError?.();
            return;
        }
        if (this.errors().length > 0) return;
        this.isSaving.set(true);
        this.api.saveLabelTemplateDraft(template.id, {
            designJson: this.designService.serializeDesign(this.design()),
            expectedRevision: draft.revision
        }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: result => {
                this.isSaving.set(false);
                this.replaceDraftVersion(result.draftVersion);
                this.isDirty.set(false);
                this.lastSavedAt.set(new Date());
                afterSave?.();
            },
            error: error => {
                this.isSaving.set(false);
                afterError?.();
                this.handleSaveError(error);
            }
        });
    }

    private replaceDraftVersion(draftVersion: LabelTemplateVersionDto): void {
        this.activeTemplate.update(template => template ? {
            ...template,
            draftVersion,
            versions: template.versions.map(version => version.id === draftVersion.id ? draftVersion : version),
            updatedAt: new Date().toISOString()
        } : template);
    }

    private updateAfterPublish(publishedVersion: LabelTemplateVersionDto, draftVersion: LabelTemplateVersionDto): void {
        this.activeTemplate.update(template => template ? {
            ...template,
            publishedVersionId: publishedVersion.id,
            publishedVersion,
            draftVersion,
            versions: [draftVersion, publishedVersion, ...template.versions.filter(version => version.id !== draftVersion.id && version.id !== publishedVersion.id)],
            updatedAt: new Date().toISOString()
        } : template);
        this.isDirty.set(false);
        this.lastSavedAt.set(new Date());
    }

    private handleSaveError(error: unknown): void {
        this.toast.error(this.errorMessage(error, 'No pudimos guardar el borrador.'));
    }

    private defaultCodeBinding(kind: LabelTemplateKind, type: 'qr' | 'barcode'): string {
        if (kind === 'InventoryBox') return 'box.nfcUrl';
        if (kind === 'InventoryItem') return 'item.scannableCode';
        return type === 'barcode' ? 'package.qrCodeValue' : 'package.qrCodeValue';
    }

    private nextZIndex(): number {
        return Math.max(0, ...this.design().elements.map(element => element.zIndex)) + 1;
    }

    private kindValue(kind: LabelTemplateKind): 0 | 1 | 2 {
        return ({ InventoryBox: 0, InventoryItem: 1, OrderPackage: 2 } as Record<LabelTemplateKind, 0 | 1 | 2>)[kind];
    }

    private profileValue(profile: LabelPrinterProfile): 0 | 1 {
        return profile === 'NiimbotB1_50x50' ? 0 : 1;
    }

    private toSummary(template: LabelTemplateDetailDto): LabelTemplateSummaryDto {
        return {
            id: template.id,
            name: template.name,
            description: template.description,
            kind: template.kind,
            printerProfile: template.printerProfile,
            isDefault: template.isDefault,
            isArchived: template.isArchived,
            publishedVersionId: template.publishedVersionId,
            publishedVersionNumber: template.publishedVersion?.versionNumber ?? null,
            updatedAt: template.updatedAt
        };
    }

    private readNumber(event: Event): number | null {
        const value = Number((event.target as HTMLInputElement | HTMLSelectElement).value);
        return Number.isFinite(value) ? value : null;
    }

    private isEditingTextControl(target: EventTarget | null): boolean {
        return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
    }

    private errorMessage(error: unknown, fallback: string): string {
        if (typeof error === 'object' && error !== null && 'error' in error) {
            const payload = (error as { error?: unknown }).error;
            if (typeof payload === 'object' && payload !== null && 'message' in payload && typeof (payload as { message?: unknown }).message === 'string') {
                return (payload as { message: string }).message;
            }
        }
        return fallback;
    }

    private emptyDesign(): LabelDesignDefinition {
        return { schemaVersion: 1, canvas: { widthMm: 50, heightMm: 50, background: '#FFFFFF' }, elements: [] };
    }
}
