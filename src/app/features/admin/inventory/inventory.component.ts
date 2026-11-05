import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as QRCode from 'qrcode';
import {
    CreateInventoryBoxDto,
    CreateInventoryItemDto,
    CompleteInventoryCountDto,
  InventoryBoxDto,
  InventoryBoxSummaryDto,
  InventoryItemDto
} from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';
import { LabelPrintService } from '../../../core/services/label-print.service';
import { ToastService } from '../../../core/services/toast.service';

interface NdefRecordLike {
  recordType: string;
  data?: DataView;
}

interface NdefReadingEventLike extends Event {
  message: { records: NdefRecordLike[] };
}

interface NdefReaderLike {
  scan(): Promise<void>;
  addEventListener(type: 'reading', listener: (event: NdefReadingEventLike) => void, options?: AddEventListenerOptions): void;
}

interface NfcBrowserWindow extends Window {
  NDEFReader?: new () => NdefReaderLike;
}

@Component({
  selector: 'app-inventory',
  imports: [FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="inventory-page">
      <header class="hero-card">
        <div>
          <p class="eyebrow">MI BODEGA</p>
          <h2>Todo tiene su cajita ✨</h2>
          <p>Encuentra lo que buscas, acomoda mercancía y acerca tu celular a una etiqueta para abrir su contenido.</p>
        </div>
        <div class="hero-actions">
          <button class="secondary-button" type="button" (click)="startWebNfcReader()" [disabled]="isScanningNfc()">
            <span>📲</span>{{ isScanningNfc() ? 'Acerca la etiqueta…' : 'Leer etiqueta NFC' }}
          </button>
          <button class="primary-button" type="button" (click)="openCreateBox()"><span>＋</span>Nueva caja</button>
        </div>
      </header>

      @if (nfcStatus()) {
        <div class="notice" [class.notice-error]="nfcStatusType() === 'error'">
          <span>{{ nfcStatusType() === 'error' ? '⚠️' : '💡' }}</span>{{ nfcStatus() }}
        </div>
      }

      <section class="stats-grid" aria-label="Resumen de inventario">
        <article><span>🧺</span><strong>{{ boxes().length }}</strong><small>Cajas activas</small></article>
        <article><span>🧸</span><strong>{{ totalArticleTypes() }}</strong><small>Tipos de artículo</small></article>
        <article><span>✨</span><strong>{{ totalUnits() }}</strong><small>Piezas registradas</small></article>
      </section>

      <section class="workspace">
        <aside class="boxes-panel">
          <div class="panel-heading">
            <div>
              <h3>Mis cajas</h3>
              <p>Busca por caja, lugar o artículo.</p>
            </div>
            <button type="button" class="icon-button" aria-label="Actualizar cajas" (click)="loadBoxes()">↻</button>
          </div>

          <form class="search-form" (ngSubmit)="loadBoxes()">
            <input [(ngModel)]="search" name="inventorySearch" placeholder="Ej. pijamas, B-07, estante…" autocomplete="off" />
            <button type="submit" aria-label="Buscar">⌕</button>
          </form>

          @if (isLoadingBoxes()) {
            <div class="empty-state">Cargando tus cajitas…</div>
          } @else {
            <div class="box-list">
              @for (box of boxes(); track box.id) {
                <button type="button" class="box-card" [class.box-card-active]="selectedBox()?.id === box.id" (click)="selectBox(box.id)">
                  <span class="box-emoji">🧺</span>
                  <span class="box-info">
                    <b>{{ box.code }} · {{ box.name }}</b>
                    <small>{{ box.location || 'Sin ubicación' }}</small>
                    <em>{{ box.articleTypesCount }} artículos · {{ box.totalUnits }} piezas</em>
                  </span>
                  @if (box.isNfcBound) { <span class="nfc-dot" title="Etiqueta vinculada">NFC</span> }
                </button>
              } @empty {
                <div class="empty-state">No encontramos nada. Crea la primera caja para empezar.</div>
              }
            </div>
          }
        </aside>

        <main class="detail-panel">
          @if (isLoadingDetail()) {
            <div class="detail-empty"><span>🪄</span><h3>Abriendo la caja…</h3></div>
          } @else if (selectedBox(); as box) {
            <div class="detail-header">
              <div>
                <p class="eyebrow">{{ box.code }}</p>
                <h3>{{ box.name }}</h3>
                <p class="location">📍 {{ box.location || 'Ubicación pendiente' }}</p>
              </div>
              <span class="nfc-badge" [class.nfc-pending]="!box.isNfcBound">{{ box.isNfcBound ? '✦ Etiqueta lista' : '◌ Falta vincular NFC' }}</span>
            </div>

            <div class="nfc-link-card">
              <div>
                <b>Etiqueta de esta caja</b>
                <p>{{ box.isNfcBound ? 'Esta caja ya responde al acercar el celular.' : 'Copia esta liga y escríbela desde la app Android.' }}</p>
              </div>
              <div class="label-actions">
                <button type="button" class="link-button" (click)="copyNfcUrl(box.nfcUrl)">Copiar liga NFC</button>
                <button type="button" class="link-button" (click)="openQrLabel(box)">Ver QR imprimible</button>
              </div>
            </div>

            <div class="detail-actions">
              <button type="button" class="primary-button" (click)="showItemForm.set(!showItemForm())">＋ Agregar artículo</button>
              <button type="button" class="secondary-button" (click)="openCount(box)" [disabled]="box.items.length === 0">Conteo físico</button>
              <button type="button" class="secondary-button" (click)="showHistory.set(!showHistory())">{{ showHistory() ? 'Ver artículos' : 'Ver historial' }}</button>
            </div>

            @if (showItemForm()) {
              <form class="item-form" (ngSubmit)="addItem(box)">
                <input [(ngModel)]="itemDraft.name" name="itemName" required maxlength="150" placeholder="Artículo, ej. Pijama" />
                <input [(ngModel)]="itemDraft.variant" name="itemVariant" maxlength="120" placeholder="Talla, color o variante" />
                <input [(ngModel)]="itemDraft.quantity" name="itemQuantity" type="number" min="1" required placeholder="Cantidad" />
                <input [(ngModel)]="itemDraft.barcode" name="itemBarcode" maxlength="100" placeholder="Código de barras (opcional)" />
                <input [(ngModel)]="itemDraft.note" name="itemNote" maxlength="300" placeholder="Nota (opcional)" />
                <div class="form-actions"><button type="button" class="plain-button" (click)="showItemForm.set(false)">Cancelar</button><button type="submit" class="primary-button" [disabled]="isSaving()">Guardar artículo</button></div>
              </form>
            }

            @if (showHistory()) {
              <div class="history-list">
                @for (movement of box.movements; track movement.id) {
                  <article class="history-row">
                    <span class="movement-icon">{{ movementEmoji(movement.type) }}</span>
                    <div><b>{{ movement.itemName || 'Artículo' }}</b><small>{{ movementLabel(movement.type) }} · {{ movement.performedBy }} · {{ movement.occurredAt | date:'d MMM, h:mm a' }}</small>@if (movement.note) { <em>{{ movement.note }}</em> }</div>
                    <strong [class.negative]="movement.quantityDelta < 0">{{ movement.quantityDelta > 0 ? '+' : '' }}{{ movement.quantityDelta }}</strong>
                  </article>
                } @empty { <div class="empty-state">Todavía no hay movimientos en esta caja.</div> }
              </div>
            } @else {
              <div class="items-list">
                @for (item of box.items; track item.id) {
                  <article class="item-row">
                    <div class="item-copy"><b>{{ item.name }}</b><small>{{ item.variant || 'Sin variante' }} · {{ item.barcode || item.labelCode }}</small></div>
                    <div class="item-actions">
                    <button type="button" class="plain-button label-item-button" (click)="printItemLabel(item)">Etiqueta</button>
                    <div class="quantity-control" aria-label="Cantidad de {{ item.name }}">
                      <button type="button" aria-label="Sacar una pieza" (click)="adjustItem(box, item, -1)" [disabled]="item.quantity === 0 || isSaving()">−</button>
                      <strong>{{ item.quantity }}</strong>
                      <button type="button" aria-label="Agregar una pieza" (click)="adjustItem(box, item, 1)" [disabled]="isSaving()">＋</button>
                    </div>
                    </div>
                    <button type="button" class="move-button" (click)="openTransfer(item)">Mover</button>
                  </article>
                } @empty {
                  <div class="detail-empty"><span>🎀</span><h3>Esta caja todavía está vacía</h3><p>Agrega los artículos que guardaste aquí.</p></div>
                }
              </div>
            }
          } @else {
            <div class="detail-empty"><span>🧺</span><h3>Elige una caja</h3><p>O acerca una etiqueta NFC para abrirla de inmediato.</p></div>
          }
        </main>
      </section>

      @if (showCreateBox()) {
        <div class="modal-backdrop" (click)="showCreateBox.set(false)">
          <form class="modal-card" (ngSubmit)="createBox()" (click)="$event.stopPropagation()">
            <span class="modal-emoji">🧺</span><h3>Nueva caja</h3><p>Primero nómbrala; después la vinculas con una etiqueta desde Android.</p>
            <label>Código visible<input [(ngModel)]="boxDraft.code" name="boxCode" required maxlength="30" placeholder="B-01" /></label>
            <label>¿Qué guardarás?<input [(ngModel)]="boxDraft.name" name="boxName" required maxlength="120" placeholder="Pijamas y conjuntos" /></label>
            <label>Ubicación<input [(ngModel)]="boxDraft.location" name="boxLocation" maxlength="200" placeholder="Bodega · Estante 2" /></label>
            <div class="form-actions"><button type="button" class="plain-button" (click)="showCreateBox.set(false)">Cancelar</button><button class="primary-button" type="submit" [disabled]="isSaving()">Crear caja</button></div>
          </form>
        </div>
      }

      @if (transferItem(); as item) {
        <div class="modal-backdrop" (click)="transferItem.set(null)">
          <form class="modal-card" (ngSubmit)="transferItemToBox(item)" (click)="$event.stopPropagation()">
            <span class="modal-emoji">↔️</span><h3>Mover {{ item.name }}</h3><p>Selecciona a qué caja irá la mercancía.</p>
            <label>Caja destino<select [(ngModel)]="transferDestinationId" name="transferDestination" required><option value="">Elige una caja</option>@for (box of transferTargets(); track box.id) { <option [value]="box.id">{{ box.code }} · {{ box.name }}</option> }</select></label>
            <label>Cantidad<input [(ngModel)]="transferQuantity" name="transferQuantity" type="number" min="1" [max]="item.quantity" required /></label>
            <label>Nota<input [(ngModel)]="transferNote" name="transferNote" maxlength="300" placeholder="Opcional" /></label>
            <div class="form-actions"><button type="button" class="plain-button" (click)="transferItem.set(null)">Cancelar</button><button class="primary-button" type="submit" [disabled]="isSaving()">Mover artículos</button></div>
          </form>
        </div>
      }

      @if (countBox(); as box) {
        <div class="modal-backdrop" (click)="closeCount()">
          <form class="modal-card count-modal" (ngSubmit)="completeCount(box)" (click)="$event.stopPropagation()">
            <span class="modal-emoji">🧮</span>
            <h3>Conteo físico · {{ box.code }}</h3>
            <p>Cuenta todo lo que hay en la caja. Sólo se guardarán las diferencias con su historial.</p>
            <div class="count-list">
              @for (item of box.items; track item.id) {
                <label class="count-row">
                  <span><b>{{ item.name }}</b><small>{{ item.variant || 'Sin variante' }} · Sistema: {{ item.quantity }}</small></span>
                  <input [(ngModel)]="countDraft[item.id]" [name]="'count-' + item.id" type="number" min="0" step="1" required />
                </label>
              }
            </div>
            <label>Nota del conteo<input [(ngModel)]="countNote" name="countNote" maxlength="300" placeholder="Ej. Conteo semanal" /></label>
            <div class="form-actions"><button type="button" class="plain-button" (click)="closeCount()">Cancelar</button><button class="primary-button" type="submit" [disabled]="isSaving()">Guardar conteo</button></div>
          </form>
        </div>
      }

      @if (labelBox(); as box) {
        <div class="modal-backdrop" (click)="closeQrLabel()">
          <section class="modal-card label-modal" (click)="$event.stopPropagation()" aria-label="Etiqueta QR de {{ box.code }}">
            <span class="modal-emoji">🏷️</span><h3>Etiqueta de {{ box.code }}</h3><p>Imprime este QR y pégalo junto a la etiqueta NFC. Ambos abren la misma caja segura.</p>
            @if (qrDataUrl(); as qrUrl) {
              <img class="qr-preview" [src]="qrUrl" alt="Código QR de la caja {{ box.code }}" />
              <strong>{{ box.name }}</strong><small>{{ box.location || 'Ubicación pendiente' }}</small>
              <div class="form-actions"><button type="button" class="plain-button" (click)="closeQrLabel()">Cerrar</button><button type="button" class="primary-button" (click)="printQrLabel(box)">Imprimir etiqueta</button></div>
            } @else {
              <div class="empty-state">Preparando el QR…</div>
            }
          </section>
        </div>
      }
    </section>
  `,
  styles: [`
    :host { display: block; color: #4a1630; }
    .inventory-page { max-width: 1500px; margin: 0 auto; padding: .5rem 0 2rem; }
    .hero-card, .boxes-panel, .detail-panel, .stats-grid article, .modal-card { border: 1px solid rgba(236,72,153,.16); background: rgba(255,255,255,.76); box-shadow: 0 20px 55px rgba(157,23,77,.09); backdrop-filter: blur(16px); }
    .hero-card { border-radius: 28px; padding: 1.75rem; display:flex; justify-content:space-between; gap:1.5rem; align-items:center; background:linear-gradient(130deg,rgba(255,255,255,.9),rgba(253,242,248,.86)); }
    .eyebrow { margin:0 0 .2rem; color:#db2777; letter-spacing:.16em; font-size:.67rem; font-weight:900; }
    h2,h3,p { margin-top:0; } h2 { margin-bottom:.35rem; font-size:clamp(1.7rem,3vw,2.5rem); font-weight:900; letter-spacing:-.05em; } .hero-card p:not(.eyebrow) { max-width:690px; color:#9d174d; margin-bottom:0; }
    .hero-actions,.detail-actions,.form-actions { display:flex; gap:.65rem; flex-wrap:wrap; } button { font:inherit; cursor:pointer; } button:disabled { cursor:not-allowed; opacity:.55; }
    .primary-button,.secondary-button,.link-button,.move-button,.plain-button { min-height:42px; border-radius:13px; padding:.65rem .9rem; border:0; font-weight:800; transition:transform .18s ease, box-shadow .18s ease; } .primary-button { color:white; background:linear-gradient(135deg,#be185d,#ec4899); box-shadow:0 8px 18px rgba(190,24,93,.24); } .primary-button:hover:not(:disabled) { transform:translateY(-1px); } .secondary-button { color:#9d174d; background:#fce7f3; } .link-button { color:#9d174d; background:white; border:1px solid #f9a8d4; } .plain-button { color:#9d174d; background:transparent; } .move-button { color:#7e22ce; background:#f3e8ff; padding:.48rem .65rem; }
    .notice { display:flex; align-items:center; gap:.6rem; margin:1rem 0; border-radius:15px; padding:.85rem 1rem; color:#831843; background:#fdf2f8; border:1px solid #fbcfe8; font-size:.9rem; } .notice-error { color:#991b1b; background:#fff1f2; border-color:#fecdd3; }
    .stats-grid { margin:1rem 0; display:grid; grid-template-columns:repeat(3,1fr); gap:.85rem; }.stats-grid article { border-radius:20px; padding:1rem 1.15rem; display:grid; grid-template-columns:auto 1fr; column-gap:.75rem; align-items:center; }.stats-grid span { grid-row:span 2; font-size:1.55rem; }.stats-grid strong { font-size:1.35rem; color:#831843; }.stats-grid small { color:#9d174d; }
    .workspace { display:grid; grid-template-columns:minmax(270px, .8fr) minmax(500px,1.75fr); gap:1rem; align-items:start; }.boxes-panel,.detail-panel { border-radius:25px; min-width:0; }.boxes-panel { padding:1rem; position:sticky; top:1rem; max-height:calc(100vh - 2rem); overflow:auto; }.detail-panel { min-height:590px; padding:1.35rem; }.panel-heading,.detail-header,.nfc-link-card,.item-row,.history-row { display:flex; gap:1rem; justify-content:space-between; align-items:center; }.panel-heading h3,.detail-header h3 { margin-bottom:.15rem; font-size:1.25rem; font-weight:900; }.panel-heading p,.location,.nfc-link-card p { color:#9d174d; font-size:.84rem; margin-bottom:0; }.icon-button { width:38px; height:38px; border:0; border-radius:12px; color:#9d174d; background:#fce7f3; font-size:1.2rem; }.search-form { display:flex; gap:.45rem; margin:1rem 0; }.search-form input,.item-form input,.modal-card input,.modal-card select { width:100%; min-height:42px; border:1px solid #f9a8d4; border-radius:12px; padding:.62rem .72rem; outline:none; color:#4a1630; background:rgba(255,255,255,.85); }.search-form input:focus,.item-form input:focus,.modal-card input:focus,.modal-card select:focus { border-color:#db2777; box-shadow:0 0 0 3px rgba(236,72,153,.13); }.search-form button { width:42px; border:0; border-radius:12px; background:#fce7f3; color:#9d174d; font-size:1.3rem; }.box-list { display:flex; flex-direction:column; gap:.55rem; }.box-card { display:flex; width:100%; gap:.65rem; align-items:flex-start; padding:.8rem; text-align:left; border:1px solid transparent; border-radius:16px; background:transparent; color:#4a1630; }.box-card:hover,.box-card-active { background:#fff1f7; border-color:#f9a8d4; }.box-emoji { font-size:1.35rem; }.box-info { display:grid; min-width:0; flex:1; gap:.1rem; }.box-info b { font-size:.84rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.box-info small,.box-info em { color:#9d174d; font-size:.72rem; font-style:normal; }.nfc-dot { align-self:center; font-size:.58rem; border-radius:999px; color:#9d174d; background:#fce7f3; padding:.25rem .38rem; font-weight:900; }
    .detail-header { align-items:flex-start; }.nfc-badge { white-space:nowrap; border-radius:999px; background:#fce7f3; color:#9d174d; padding:.38rem .65rem; font-size:.72rem; font-weight:900; }.nfc-pending { color:#a16207; background:#fef3c7; }.nfc-link-card { margin:1.15rem 0; padding:1rem; border-radius:17px; background:linear-gradient(135deg,#fdf2f8,#faf5ff); border:1px dashed #f9a8d4; }.nfc-link-card b { font-size:.9rem; }.label-actions { display:flex; }.detail-actions { margin:1rem 0; }.item-form { display:grid; grid-template-columns:1.2fr 1fr .55fr 1fr; gap:.6rem; padding:1rem; margin:1rem 0; border-radius:18px; background:#fff1f7; }.item-form input:last-of-type,.item-form .form-actions { grid-column:span 2; }.form-actions { justify-content:flex-end; align-items:center; }.items-list,.history-list { display:flex; flex-direction:column; gap:.6rem; }.item-row,.history-row { padding:.85rem .15rem .85rem .75rem; border-bottom:1px solid #fce7f3; }.item-copy { min-width:0; flex:1; display:grid; gap:.18rem; }.item-copy b { font-size:.92rem; }.item-copy small,.history-row small,.history-row em { font-size:.76rem; color:#9d174d; }.item-actions { display:flex; gap:.35rem; align-items:center; }.label-item-button { min-height:31px; padding:.35rem .48rem; border:1px solid #f7bed5; border-radius:9px; color:#9d174d; background:#fff7fb; font-size:.67rem; }.quantity-control { display:flex; gap:.4rem; align-items:center; border-radius:12px; background:#fdf2f8; padding:.25rem; }.quantity-control button { width:31px; height:31px; border:0; border-radius:9px; color:#9d174d; background:white; font-size:1rem; font-weight:900; }.quantity-control strong { min-width:2rem; text-align:center; }.history-row { justify-content:flex-start; }.movement-icon { width:34px; height:34px; display:grid; place-items:center; border-radius:10px; background:#fdf2f8; }.history-row div { display:grid; gap:.12rem; flex:1; }.history-row em { font-style:normal; }.history-row strong { color:#15803d; }.history-row strong.negative { color:#dc2626; }.detail-empty,.empty-state { display:grid; place-items:center; text-align:center; color:#9d174d; }.detail-empty { min-height:330px; align-content:center; }.detail-empty span { font-size:3rem; }.detail-empty h3 { margin:.7rem 0 .25rem; font-weight:900; }.detail-empty p { font-size:.9rem; }.empty-state { padding:2rem 1rem; font-size:.86rem; }
    .modal-backdrop { position:fixed; inset:0; z-index:90; display:grid; place-items:center; padding:1rem; background:rgba(76,5,25,.35); backdrop-filter:blur(5px); }.modal-card { width:min(100%,430px); border-radius:26px; padding:1.5rem; }.modal-card h3 { margin:.25rem 0; font-size:1.35rem; font-weight:900; }.modal-card p { color:#9d174d; font-size:.86rem; }.modal-card label { display:grid; gap:.35rem; margin:1rem 0; font-size:.78rem; font-weight:800; color:#831843; }.modal-emoji { font-size:2rem; }.count-list { display:grid; gap:.5rem; max-height:45vh; overflow:auto; margin:1rem 0; }.count-row { display:flex!important; align-items:center; padding:.6rem; margin:0!important; border-radius:13px; background:#fff1f7; }.count-row small,.label-modal small { color:#9d174d; font-weight:500; }.count-row input { width:82px!important; }.label-modal { text-align:center; }.qr-preview { width:min(72vw,290px); background:white; padding:.6rem; border-radius:18px; box-shadow:0 8px 22px rgba(157,23,77,.14); }
    @media (max-width: 920px) { .hero-card { align-items:flex-start; flex-direction:column; }.workspace { grid-template-columns:1fr; }.boxes-panel { position:static; max-height:none; }.box-list { max-height:290px; overflow:auto; }.detail-panel { min-height:0; }.item-form { grid-template-columns:1fr 1fr; }.item-form input:last-of-type,.item-form .form-actions { grid-column:span 2; } }
    @media (max-width: 560px) { .inventory-page { padding-top:0; }.hero-card,.detail-panel { padding:1rem; border-radius:20px; }.hero-actions,.hero-actions button { width:100%; }.stats-grid { grid-template-columns:1fr; }.detail-header,.nfc-link-card,.item-row { align-items:flex-start; flex-direction:column; }.nfc-link-card .link-button { width:100%; }.item-actions { width:100%; }.quantity-control { flex:1; align-self:stretch; justify-content:space-between; }.move-button { width:100%; }.item-form { grid-template-columns:1fr; }.item-form input:last-of-type,.item-form .form-actions { grid-column:auto; }.form-actions { justify-content:stretch; }.form-actions button { flex:1; } }
  `]
})
export class InventoryComponent {
  private readonly api = inject(ApiService);
  private readonly labelPrint = inject(LabelPrintService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly boxes = signal<InventoryBoxSummaryDto[]>([]);
  readonly selectedBox = signal<InventoryBoxDto | null>(null);
  readonly isLoadingBoxes = signal(true);
  readonly isLoadingDetail = signal(false);
  readonly isSaving = signal(false);
  readonly showCreateBox = signal(false);
  readonly showItemForm = signal(false);
  readonly showHistory = signal(false);
  readonly transferItem = signal<InventoryItemDto | null>(null);
  readonly countBox = signal<InventoryBoxDto | null>(null);
  readonly labelBox = signal<InventoryBoxDto | null>(null);
  readonly qrDataUrl = signal<string | null>(null);
  readonly isScanningNfc = signal(false);
  readonly nfcStatus = signal('');
  readonly nfcStatusType = signal<'info' | 'error'>('info');
  readonly totalArticleTypes = computed(() => this.boxes().reduce((sum, box) => sum + box.articleTypesCount, 0));
  readonly totalUnits = computed(() => this.boxes().reduce((sum, box) => sum + box.totalUnits, 0));
  readonly transferTargets = computed(() => this.boxes().filter(box => box.id !== this.selectedBox()?.id));

  search = '';
  boxDraft: CreateInventoryBoxDto = { code: '', name: '', location: '' };
  itemDraft: CreateInventoryItemDto = { name: '', variant: '', barcode: '', quantity: 1, note: '' };
  transferDestinationId = '';
  transferQuantity = 1;
  transferNote = '';
  countDraft: Record<string, number> = {};
  countNote = '';

  constructor() {
    this.loadBoxes();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const token = params.get('tag');
      if (token) this.resolveNfcToken(token);
    });
  }

  loadBoxes(): void {
    this.isLoadingBoxes.set(true);
    this.api.getInventoryBoxes(this.search).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: boxes => { this.boxes.set(boxes); this.isLoadingBoxes.set(false); },
      error: error => { this.isLoadingBoxes.set(false); this.toast.error(this.errorMessage(error, 'No pudimos cargar el inventario.')); }
    });
  }

  selectBox(id: string): void {
    this.isLoadingDetail.set(true);
    this.showHistory.set(false);
    this.api.getInventoryBox(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: box => { this.selectedBox.set(box); this.isLoadingDetail.set(false); },
      error: error => { this.isLoadingDetail.set(false); this.toast.error(this.errorMessage(error, 'No pudimos abrir esta caja.')); }
    });
  }

  openCreateBox(): void {
    this.boxDraft = { code: this.nextBoxCode(), name: '', location: '' };
    this.showCreateBox.set(true);
  }

  createBox(): void {
    if (!this.boxDraft.code.trim() || !this.boxDraft.name.trim()) return;
    this.isSaving.set(true);
    this.api.createInventoryBox(this.cleanBoxDraft()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: box => {
        this.isSaving.set(false);
        this.showCreateBox.set(false);
        this.selectedBox.set(box);
        this.boxes.update(boxes => [this.toSummary(box), ...boxes].sort((a, b) => a.code.localeCompare(b.code)));
        this.toast.success(`Caja ${box.code} creada. Ahora vincula su etiqueta desde Android.`);
      },
      error: error => { this.isSaving.set(false); this.toast.error(this.errorMessage(error, 'No pudimos crear la caja.')); }
    });
  }

  addItem(box: InventoryBoxDto): void {
    if (!this.itemDraft.name.trim() || this.itemDraft.quantity < 1) return;
    this.isSaving.set(true);
    const request: CreateInventoryItemDto = {
      name: this.itemDraft.name.trim(),
      variant: this.emptyToNull(this.itemDraft.variant),
      barcode: this.emptyToNull(this.itemDraft.barcode),
      quantity: Number(this.itemDraft.quantity),
      note: this.emptyToNull(this.itemDraft.note)
    };
    this.api.addInventoryItem(box.id, request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.isSaving.set(false); this.applyBox(updated); this.showItemForm.set(false);
        this.itemDraft = { name: '', variant: '', barcode: '', quantity: 1, note: '' };
        this.toast.success('Artículo guardado en la caja.');
      },
      error: error => { this.isSaving.set(false); this.toast.error(this.errorMessage(error, 'No pudimos guardar el artículo.')); }
    });
  }

  adjustItem(box: InventoryBoxDto, item: InventoryItemDto, quantityDelta: number): void {
    this.isSaving.set(true);
    this.api.adjustInventoryItem(item.id, { quantityDelta }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => { this.isSaving.set(false); this.applyBox(updated); },
      error: error => { this.isSaving.set(false); this.toast.error(this.errorMessage(error, 'No pudimos actualizar la cantidad.')); }
    });
  }

  openTransfer(item: InventoryItemDto): void {
    this.transferDestinationId = '';
    this.transferQuantity = 1;
    this.transferNote = '';
    this.transferItem.set(item);
  }

  transferItemToBox(item: InventoryItemDto): void {
    const source = this.selectedBox();
    if (!source || !this.transferDestinationId || this.transferQuantity < 1 || this.transferQuantity > item.quantity) return;
    this.isSaving.set(true);
    this.api.transferInventoryItems({
      sourceBoxId: source.id,
      destinationBoxId: this.transferDestinationId,
      itemId: item.id,
      quantity: Number(this.transferQuantity),
      note: this.emptyToNull(this.transferNote)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.isSaving.set(false); this.transferItem.set(null); this.selectBox(source.id); this.loadBoxes();
        this.toast.success('Mercancía movida correctamente.');
      },
      error: error => { this.isSaving.set(false); this.toast.error(this.errorMessage(error, 'No pudimos mover la mercancía.')); }
    });
  }

  openCount(box: InventoryBoxDto): void {
    this.countDraft = Object.fromEntries(box.items.map(item => [item.id, item.quantity]));
    this.countNote = '';
    this.countBox.set(box);
  }

  closeCount(): void {
    this.countBox.set(null);
    this.countDraft = {};
    this.countNote = '';
  }

  completeCount(box: InventoryBoxDto): void {
    const items = box.items.map(item => ({
      inventoryItemId: item.id,
      actualQuantity: Number(this.countDraft[item.id])
    }));
    if (items.some(item => !Number.isInteger(item.actualQuantity) || item.actualQuantity < 0)) {
      this.toast.warning('Escribe cantidades enteras de cero o más para todos los artículos.');
      return;
    }

    const request: CompleteInventoryCountDto = {
      items,
      note: this.emptyToNull(this.countNote)
    };
    this.isSaving.set(true);
    this.api.completeInventoryCount(box.id, request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.isSaving.set(false);
        this.applyBox(updated);
        this.closeCount();
        this.toast.success('Conteo físico guardado. Las diferencias quedaron en el historial.');
      },
      error: error => {
        this.isSaving.set(false);
        this.toast.error(this.errorMessage(error, 'No pudimos guardar el conteo.'));
      }
    });
  }

  openQrLabel(box: InventoryBoxDto): void {
    this.labelBox.set(box);
    this.qrDataUrl.set(null);
    void QRCode.toDataURL(box.nfcUrl, { width: 600, margin: 1, errorCorrectionLevel: 'M' }).then(
      dataUrl => {
        if (this.labelBox()?.id === box.id) this.qrDataUrl.set(dataUrl);
      },
      () => {
        this.closeQrLabel();
        this.toast.error('No pudimos preparar el QR de esta caja.');
      }
    );
  }

  closeQrLabel(): void {
    this.labelBox.set(null);
    this.qrDataUrl.set(null);
  }

  async printQrLabel(box: InventoryBoxDto): Promise<void> {
    try {
      await this.labelPrint.printBox(box.id);
    } catch (error) {
      this.toast.error(this.errorMessage(error, 'No pudimos preparar la etiqueta de esta caja.'));
    }
  }

  async printItemLabel(item: InventoryItemDto): Promise<void> {
    try {
      await this.labelPrint.printItem(item.id);
    } catch (error) {
      this.toast.error(this.errorMessage(error, 'No pudimos preparar la etiqueta de este artículo.'));
    }
  }

  startWebNfcReader(): void {
    const browser = window as NfcBrowserWindow;
    if (!browser.NDEFReader) {
      this.nfcStatusType.set('error');
      this.nfcStatus.set('Este navegador no puede leer NFC. Usa la app Android o abre la caja por búsqueda.');
      return;
    }

    try {
      const reader = new browser.NDEFReader();
      this.isScanningNfc.set(true);
      this.nfcStatusType.set('info');
      this.nfcStatus.set('Acerca el teléfono a la etiqueta de la caja.');
      reader.addEventListener('reading', event => {
        const token = this.tokenFromNdef(event);
        this.isScanningNfc.set(false);
        if (!token) {
          this.nfcStatusType.set('error');
          this.nfcStatus.set('La etiqueta no pertenece a una caja de Regi Bazar.');
          return;
        }
        this.nfcStatus.set('Etiqueta leída. Abriendo la caja…');
        this.resolveNfcToken(token);
      }, { once: true });
      void reader.scan().catch(error => {
        this.isScanningNfc.set(false);
        this.nfcStatusType.set('error');
        this.nfcStatus.set(this.errorMessage(error, 'No se pudo iniciar el lector NFC. Revisa que NFC esté encendido.'));
      });
    } catch (error) {
      this.isScanningNfc.set(false);
      this.nfcStatusType.set('error');
      this.nfcStatus.set(this.errorMessage(error, 'No se pudo iniciar el lector NFC.'));
    }
  }

  copyNfcUrl(url: string): void {
    if (!navigator.clipboard) {
      this.toast.warning('Tu navegador no permite copiar automáticamente. Copia la liga manualmente.');
      return;
    }
    void navigator.clipboard.writeText(url).then(
      () => this.toast.success('Liga NFC copiada. Ábrela desde la app Android al vincular la etiqueta.'),
      () => this.toast.warning('No pudimos copiar la liga. Intenta de nuevo.')
    );
  }

  movementLabel(type: string): string {
    return ({ InitialCount: 'Conteo inicial', Added: 'Entrada', Removed: 'Salida', Adjusted: 'Ajuste', TransferOut: 'Movido a otra caja', TransferIn: 'Llegó de otra caja', CountAdjustment: 'Diferencia de conteo físico' } as Record<string, string>)[type] ?? 'Movimiento';
  }

  movementEmoji(type: string): string {
    return ({ InitialCount: '✨', Added: '＋', Removed: '−', Adjusted: '↺', TransferOut: '↗', TransferIn: '↙', CountAdjustment: '🧮' } as Record<string, string>)[type] ?? '•';
  }

  private resolveNfcToken(token: string): void {
    this.isLoadingDetail.set(true);
    this.api.getInventoryBoxByToken(token).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: box => { this.selectedBox.set(box); this.isLoadingDetail.set(false); this.showHistory.set(false); },
      error: error => { this.isLoadingDetail.set(false); this.nfcStatusType.set('error'); this.nfcStatus.set(this.errorMessage(error, 'No encontramos una caja con esa etiqueta.')); }
    });
  }

  private tokenFromNdef(event: NdefReadingEventLike): string | null {
    for (const record of event.message.records) {
      if (record.recordType !== 'url' || !record.data) continue;
      const value = new TextDecoder().decode(record.data);
      try {
        const segments = new URL(value).pathname.split('/').filter(Boolean);
        const position = segments.lastIndexOf('caja');
        if (position >= 0 && segments[position + 1]) return segments[position + 1];
      } catch {
        continue;
      }
    }
    return null;
  }

  private applyBox(box: InventoryBoxDto): void {
    this.selectedBox.set(box);
    this.boxes.update(boxes => {
      const summary = this.toSummary(box);
      const exists = boxes.some(current => current.id === box.id);
      return (exists ? boxes.map(current => current.id === box.id ? summary : current) : [summary, ...boxes])
        .sort((a, b) => a.code.localeCompare(b.code));
    });
  }

  private toSummary(box: InventoryBoxDto): InventoryBoxSummaryDto {
    return {
      id: box.id, code: box.code, name: box.name, location: box.location, isNfcBound: box.isNfcBound,
      articleTypesCount: box.items.filter(item => item.quantity > 0).length,
      totalUnits: box.items.reduce((sum, item) => sum + item.quantity, 0), updatedAt: box.updatedAt
    };
  }

  private cleanBoxDraft(): CreateInventoryBoxDto {
    return { code: this.boxDraft.code.trim(), name: this.boxDraft.name.trim(), location: this.emptyToNull(this.boxDraft.location) };
  }

  private emptyToNull(value: string | null | undefined): string | null {
    return value?.trim() || null;
  }

  private nextBoxCode(): string {
    const numbers = this.boxes().map(box => Number(box.code.match(/(\d+)$/)?.[1] ?? 0));
    return `B-${String(Math.max(0, ...numbers) + 1).padStart(2, '0')}`;
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const response = error as { error?: { message?: string } | string };
      if (typeof response.error === 'string') return response.error;
      if (response.error?.message) return response.error.message;
    }
    return fallback;
  }
}
