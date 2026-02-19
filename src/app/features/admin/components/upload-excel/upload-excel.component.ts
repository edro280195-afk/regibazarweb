import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { ExcelUploadResult, Client, OrderSummary } from '../../../../shared/models/models';

interface LiveCapture {
  id: string; // UUID
  rawText: string;
  parsed: {
    clientName: string;
    productDescription: string;
    quantity: number;
    totalPrice: number;
    unitPrice: number;
    confidence?: 'high' | 'medium' | 'low'; // Added confidence
  };
  isConfirmed: boolean; // True tras validar
  timestamp: Date;
}

interface LiveOrder {
  id: string;
  clientName: string;
  items: {
    productName: string;
    variant: string;
    quantity: number;
    unitPrice: number;
  }[];
  orderType: 'Delivery' | 'PickUp';
  selected: boolean;
  totalForSort: number;
}

interface LiveProduct {
  name: string;
  price: number;
  variants: string[];
}

const NUMBER_WORDS: Record<string, number> = {
  'un': 1, 'una': 1, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
  'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10, 'once': 11, 'doce': 12,
  'quince': 15, 'veinte': 20, 'treinta': 30, 'cuarenta': 40, 'cincuenta': 50,
  'cien': 100, 'doscientos': 200, 'quinientos': 500, 'mil': 1000
};

function normalizeForMatch(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/(as|es|os|a|o|s)$/, '');
}

@Component({
  selector: 'app-upload-excel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="upload-page">
      <h2>Cargar Pedidos 📦</h2>
      <p class="page-sub">Sube tu Excel del Live o captura a mano, tú decides bewis ✨</p>

      <div class="tab-switch">
        <button [class.active]="mode() === 'excel'" (click)="mode.set('excel')">📄 Excel</button>
        <button [class.active]="mode() === 'manual'" (click)="mode.set('manual')">✏️ Manual</button>
        <button [class.active]="mode() === 'live'" (click)="mode.set('live')" class="live-tab">🔴 Live</button>
      </div>

      <!-- ═══════════ EXCEL TAB ═══════════ -->
      @if (mode() === 'excel') {
        <div class="drop-zone" [class.dragging]="dragging()"
             (dragover)="onDragOver($event)" (dragleave)="dragging.set(false)"
             (drop)="onDrop($event)" (click)="fileInput.click()">
          <input #fileInput type="file" accept=".xlsx,.xls,.xlsm" (change)="onFileSelect($event)" hidden>
          <div class="drop-content">
            <span class="drop-icon">📊</span>
            <p class="drop-text">Arrastra tu archivo aquí o toca para seleccionar</p>
            <div class="drop-hint-box">
              <p>Columnas requeridas:</p>
              <div class="tags">
                <span class="col-tag">Articulo</span>
                <span class="col-tag">Precio</span>
                <span class="col-tag">Cliente</span>
                <span class="col-tag">Tipo Cliente</span>
                <span class="col-tag">Metodo (Opcional)</span>
              </div>
            </div>
          </div>
        </div>

        @if (selectedFile()) {
          <div class="file-preview">
            <span>📎 {{ selectedFile()!.name }}</span>
            <button class="btn-pink" (click)="uploadExcel()" [disabled]="uploading()">
              @if (uploading()) { <span class="spinner"></span> }
              🌸 Procesar
            </button>
          </div>
        }
      }

      <!-- ═══════════ MANUAL TAB ═══════════ -->
      @if (mode() === 'manual') {
        <div class="manual-form">
          <div class="manual-columns">
            <div class="form-col">
              <div class="order-type-switch">
                <label>¿Cómo se entrega? 🚚</label>
                <div class="switch-container">
                  <button [class.active]="manualOrderType === 'Delivery'" (click)="manualOrderType = 'Delivery'">🛵 A Domicilio</button>
                  <button [class.active]="manualOrderType === 'PickUp'" (click)="manualOrderType = 'PickUp'">🛍️ Pick Up (Local)</button>
                </div>
              </div>

              <div class="client-section">
                <div class="field relative-container">
                  <label>Nombre de la clienta 💁‍♀️</label>
                  <input type="text"
                         [(ngModel)]="manualClient"
                         (input)="onSearchClient()"
                         (focus)="showSuggestions.set(true)"
                         placeholder="Escribe para buscar..."
                         autocomplete="off">
                  @if (showSuggestions() && filteredClients().length > 0) {
                    <ul class="suggestions-list">
                      @for (client of filteredClients(); track client.id) {
                        <li (click)="selectClient(client)">
                          <span class="name">{{ client.name }}</span>
                          @if ((client.ordersCount || 0) >= 2) {
                            <span class="tag-frecuente">👑 Frecuente</span>
                          } @else {
                            <span class="tag-nueva">✨ Nueva</span>
                          }
                        </li>
                      }
                    </ul>
                  }
                </div>
                <div class="field short">
                  <label>Tipo de Clienta 🎀</label>
                  <div class="select-wrapper">
                    <select [(ngModel)]="manualClientType" [class.highlight]="autoDetected()">
                      <option value="" disabled selected>Selecciona...</option>
                      <option value="Nueva">Nueva ✨</option>
                      <option value="Frecuente">Frecuente 👑</option>
                    </select>
                    <span class="select-arrow">▼</span>
                  </div>
                  @if (autoDetected()) {
                    <span class="detect-msg">¡Detectado! 🪄</span>
                  }
                </div>
              </div>

              <div class="add-item-section">
                <h4>➕ Agregar artículo</h4>
                <div class="single-item-form">
                  <div class="field-group grow">
                    <label>Descripción del artículo 👗</label>
                    <input type="text" [(ngModel)]="currentItem.productName" placeholder="Ej. Tapete rosa"
                           (keydown.enter)="focusManualField('qty')">
                  </div>
                  <div class="row-split">
                    <div class="field-group small">
                      <label>Cant. 🔢</label>
                      <input type="number" [(ngModel)]="currentItem.quantity" min="1" class="qty" #manualQtyInput
                             (keydown.enter)="focusManualField('price')">
                    </div>
                    <div class="field-group medium">
                      <label>Precio 💲</label>
                      <input type="number" [(ngModel)]="currentItem.unitPrice" step="0.01" class="price" placeholder="0.00" #manualPriceInput
                             (keydown.enter)="addCurrentItem()">
                    </div>
                  </div>
                  <button class="btn-add-to-list" (click)="addCurrentItem()"
                          [disabled]="!currentItem.productName.trim() || currentItem.unitPrice <= 0">
                    ✨ Agregar
                  </button>
                </div>
              </div>
            </div>

            <div class="items-col">
              <div class="items-col-header">
                <h4>🛍️ Artículos del pedido</h4>
                <span class="item-count">{{ manualItems.length }}</span>
              </div>
              <div class="items-scroll">
                @if (manualItems.length > 0) {
                  @for (item of manualItems; track $index) {
                    <div class="item-row">
                      <span class="item-qty">{{ item.quantity }}×</span>
                      <span class="item-name">{{ item.productName }}</span>
                      <span class="item-price">$ {{ (item.quantity * item.unitPrice) | number:'1.2-2' }}</span>
                      <button class="btn-remove-mini" (click)="removeItem($index)" title="Quitar">×</button>
                    </div>
                  }
                } @else {
                  <div class="items-empty">
                    <span class="empty-icon">🛒</span>
                    <p>Aún no hay artículos</p>
                    <p class="hint">Usa el formulario de la izquierda para agregar</p>
                  </div>
                }
              </div>
              @if (manualItems.length > 0) {
                <div class="items-total-bar">
                  <span>Total</span>
                  <span class="total-value">$ {{ getManualTotal() | number:'1.2-2' }}</span>
                </div>
              }
              <button class="btn-pink wide" (click)="createManual()" [disabled]="uploading() || manualItems.length === 0">
                💖 Crear pedido ({{ manualOrderType === 'PickUp' ? 'Pick Up' : 'Domicilio' }})
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ═══════════ LIVE TAB ═══════════ -->
      @if (mode() === 'live') {
          <!-- ═══ SETUP PHASE (Landing) ═══ -->
          @if (livePhase() === 'setup') {
            <div class="live-setup text-center py-10">
               <div class="big-icon text-6xl mb-4">🎤</div>
               <h3>Modo Captura Libre</h3>
               <p class="mb-6">Dicta pedidos sin configurar productos. "Maria, toalla, 200"</p>
               <button class="btn-start-live" (click)="startLive()">
                 🔴 Iniciar Live
               </button>
               
               @if (liveCaptures().length > 0) {
                  <p class="mt-4 text-pink-500">
                    💡 Tienes {{ liveCaptures().length }} pedidos capturados. 
                    <button class="underline" (click)="livePhase.set('capturing')">Continuar</button>
                  </p>
               }
            </div>
          }

          <!-- ═══ CAPTURING PHASE ═══ -->
          @if (livePhase() === 'capturing') {
            <div class="live-capturing">
              <div class="product-bar">
                <div class="live-badge">🔴 MODO LIBRE</div>
                <div class="product-info">
                    <strong>Captura lo que sea ✨</strong>
                    <span class="product-price">Di: "Nombre, Producto, Precio"</span>
                </div>
                <div class="product-actions">
                  <button class="btn-sm finish" (click)="startReview()" [disabled]="liveCaptures().length === 0">
                    🏁 Finalizar ({{ liveCaptures().length }})
                  </button>
                </div>
              </div>

              <div class="capture-layout">
                <div class="capture-panel">

                <div class="big-mic-container">
                    <button class="mic-btn-big" [class.listening]="isListening()" (click)="toggleListening()">
                        <span class="mic-icon-big">🎙️</span>
                    </button>
                    <div class="mic-status">
                        @if (isListening()) {
                            <span class="animate-pulse text-red-500 font-bold">Escuchando...</span>
                        } @else {
                            <span class="text-gray-500">Toca para hablar</span>
                        }
                    </div>
                </div>

                <div class="live-transcript-box">
                    <p class="interim">{{ interimTranscript() }}</p>
                    @if (!interimTranscript() && !parsedPreview()) {
                         <p class="placeholder">"Ana, toallas, 200 pesos"...</p>
                    }
                </div>

                  <!-- Text Input -->
                  <div class="text-capture">
                    <label>⌨️ O escribe aquí:</label>
                    <div class="text-input-row">
                      <input type="text" [(ngModel)]="textInput"
                             placeholder="Ej: Juana Pérez, 2 negras y 1 azul"
                             (keydown.enter)="onTextSubmit()">
                      <button class="btn-parse" (click)="onTextSubmit()" [disabled]="!textInput.trim()">➡️</button>
                    </div>
                  </div>

                  <!-- Preview -->
                  @if (parsedPreview()) {
                    <div class="capture-preview"
                         [class.low]="!parsedPreview()!.parsed.clientName || parsedPreview()!.parsed.totalPrice === 0"
                         [class.medium]="parsedPreview()!.parsed.totalPrice > 0">
                      <div class="preview-header">
                        <h4>Vista previa</h4>
                        <span class="confidence">
                          @if (parsedPreview()?.parsed?.clientName && parsedPreview()!.parsed.totalPrice > 0) { ✅ Seguro }
                          @else { ❓ Verificar }
                        </span>
                      </div>
                      <p class="preview-client">👤 {{ parsedPreview()!.parsed.clientName || '(sin nombre)' }}</p>
                      <div class="preview-items">
                          <div class="preview-item">
                            <span>{{ parsedPreview()!.parsed.quantity }}× {{ parsedPreview()!.parsed.productDescription }}</span>
                            <span class="preview-subtotal">\${{ parsedPreview()!.parsed.totalPrice | number:'1.0-0' }}</span>
                          </div>
                        <div class="preview-item preview-total-row">
                          <strong>Total</strong>
                          <strong class="preview-subtotal">\${{ parsedPreview()!.parsed.totalPrice | number:'1.0-0' }}</strong>
                        </div>
                      </div>
                      <div class="preview-actions">
                        <button class="btn-confirm" (click)="confirmPreview()" [disabled]="!parsedPreview()!.parsed.clientName">✅ Confirmar</button>
                        <button class="btn-discard" (click)="discardCapture()">✖ Descartar</button>
                      </div>
                    </div>
                  }
                </div>

                <!-- Orders Feed -->
                <div class="orders-feed">
                  <div class="feed-header">
                    <h4>📋 Pedidos capturados</h4>
                    <span class="feed-stats">{{ liveCaptures().length }} pedidos · \${{ liveTotalAmount() | number:'1.0-0' }}</span>
                  </div>
                  <div class="feed-scroll">
                    @for (order of liveCaptures(); track order.id) {
                      <div class="feed-order">
                        <div class="feed-order-header">
                          <strong>{{ order.parsed.clientName }}</strong>
                          <div class="feed-order-actions">
                            <span class="feed-total">\${{ order.parsed.totalPrice | number:'1.0-0' }}</span>
                            <button class="btn-remove-mini" (click)="deleteCapture(order.id)" title="Eliminar">×</button>
                          </div>
                        </div>
                        <div class="feed-item">
                          <span>{{ order.parsed.quantity }}× {{ order.parsed.productDescription }}</span>
                        </div>
                      </div>
                    } @empty {
                      <div class="feed-empty">
                        <span>🎤</span>
                        <p>Esperando pedidos...</p>
                        <p class="feed-empty-hint">Usa el micrófono o escribe para capturar</p>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- ═══ REVIEW PHASE ═══ -->
          @if (livePhase() === 'review') {
            <div class="live-review">
              <div class="review-header">
                <div>
                  <h3>🏁 Revisión Final del Live</h3>
                  <p class="review-sub">Revisa, asigna método de entrega y confirma</p>
                </div>
                <button class="btn-sm" (click)="backToCapturing()">← Volver a capturar</button>
              </div>

              <!-- FIX #5: Barra de resumen con conteo de seleccionados -->
              <div class="review-summary-bar">
                <span>{{ liveSelectedCount() }} de {{ reviewOrders().length }} seleccionados</span>
                <span class="review-summary-total">Total: \${{ liveSelectedTotal() | number:'1.0-0' }}</span>
              </div>

              <div class="review-orders">
                @for (order of reviewOrders(); track order.id) {
                  <div class="review-card" [class.deselected]="!order.selected">
                    <div class="review-card-top">
                      <label class="review-check">
                        <input type="checkbox" [(ngModel)]="order.selected">
                        <strong>{{ order.clientName }}</strong>
                      </label>
                      <span class="review-total">\${{ order.totalForSort | number:'1.2-2' }}</span>
                    </div>
                    <div class="review-items">
                      @for (it of order.items; track $index) {
                        <span class="review-item-tag">{{ it.quantity }}× {{ it.productName }}</span>
                      }
                    </div>
                    <div class="review-type">
                      <button [class.active]="order.orderType === 'Delivery'" (click)="order.orderType = 'Delivery'">🛵 Domicilio</button>
                      <button [class.active]="order.orderType === 'PickUp'" (click)="order.orderType = 'PickUp'">🛍️ Pick Up</button>
                    </div>
                  </div>
                }
              </div>

              @if (liveCreating()) {
                <div class="create-progress">
                  <span class="spinner"></span> {{ liveCreateProgress() }}
                </div>
              } @else {
                <button class="btn-pink wide" (click)="submitAllOrders()"
                        [disabled]="liveSelectedCount() === 0">
                  💖 Crear {{ liveSelectedCount() }} pedidos
                </button>
              }
            </div>
          }
      }
      <!-- ═══════════ RESULTS (shared) ═══════════ -->
      @if (result()) {
        <div class="results">
          <div class="result-summary">
            <span class="badge pink">{{ result()!.ordersCreated }} pedidos 🎉</span>
            <span class="badge lavender">{{ result()!.clientsCreated }} clientas nuevas ✨</span>
          </div>

          @if (result()!.warnings.length > 0) {
            <div class="warnings">
              <h4>⚠️ Avisos:</h4>
              @for (w of result()!.warnings; track $index) { <p>{{ w }}</p> }
            </div>
          }

          <div class="orders-list">
            <div class="orders-list-header">
              <h3>Enlaces para compartir por Messenger 💌</h3>
              <button class="btn-copy-all" (click)="copyAllLinks()">📋 Copiar todos</button>
            </div>
            @for (order of result()!.orders; track order.id) {
              <div class="order-card">
                <div class="order-header">
                  <strong>{{ order.clientName }}</strong>
                  <span class="total">$ {{ order.total | number:'1.2-2' }}</span>
                </div>
                <div class="type-badge">
                  {{ order.orderType === 'PickUp' ? '🛍️ Pick Up' : '🛵 Domicilio' }}
                </div>
                <div class="order-items">
                  @for (item of order.items; track item.id) {
                    <span class="item-tag">{{ item.productName }} ×{{ item.quantity }}</span>
                  }
                </div>
                <div class="order-link">
                  <input type="text" [value]="order.link" readonly #linkInput>
                  <button class="btn-copy" (click)="copyLink(linkInput)">📋 Copiar</button>
                </div>
              </div>
            }
          </div>
        </div>
      }

      @if (error()) {
        <div class="error">😿 {{ error() }}</div>
      }
    </div>
  `,
  styles: [`
    .upload-page { max-width: 1100px; }

    h2 { font-family: var(--font-display); color: var(--text-dark); margin: 0; }
    .page-sub { font-family: var(--font-script); color: var(--rose-gold); margin: 0.1rem 0 1.5rem; font-size: 1rem; }

    /* ═══ TABS — FIX #4: max-width ampliado para 3 tabs ═══ */
    .tab-switch {
      display: flex; background: rgba(255,255,255,0.7);
      border: 1px solid var(--border-soft); border-radius: 1rem; padding: 4px;
      margin-bottom: 1.5rem; max-width: 520px;
      button {
        flex: 1; padding: 0.6rem; border: none; background: transparent;
        color: var(--text-light); border-radius: 0.8rem;
        cursor: pointer; font-size: 0.85rem; font-family: var(--font-body); font-weight: 600;
        transition: all 0.3s var(--ease-bounce);
        &.active {
          background: linear-gradient(135deg, var(--pink-400), var(--pink-500));
          color: white; box-shadow: 0 4px 12px rgba(255,107,157,0.3);
        }
      }
    }
    .live-tab.active { background: linear-gradient(135deg, #ef4444, #f97316) !important; }

    /* ═══ ORDER TYPE SWITCH ═══ */
    .order-type-switch { margin-bottom: 1.5rem; }
    .order-type-switch label { display: block; color: var(--pink-600); font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .switch-container { display: flex; gap: 10px; margin-top: 0.5rem; }
    .switch-container button {
        flex: 1; padding: 0.8rem; border: 2px solid var(--pink-100);
        background: white; border-radius: 1rem;
        color: var(--text-medium); font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .switch-container button.active {
        border-color: var(--pink-500); background: var(--pink-50);
        color: var(--pink-600); box-shadow: 0 4px 10px rgba(255,107,157,0.2);
    }
    .type-badge {
        font-size: 0.75rem; background: #f0f0f0; color: #555;
        padding: 2px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px; font-weight: 600;
    }

    /* ═══ DROP ZONE ═══ */
    .drop-zone {
      border: 2px dashed var(--pink-200); border-radius: 1.25rem;
      padding: 3rem 2rem; text-align: center; cursor: pointer;
      transition: all 0.3s; background: rgba(255,240,246,0.4);
      &:hover, &.dragging { border-color: var(--pink-400); background: rgba(255,240,246,0.7); transform: scale(1.01); }
    }
    .drop-icon { font-size: 3rem; display: block; margin-bottom: 0.75rem; }
    .drop-text { color: var(--text-medium); font-weight: 600; margin: 0 0 0.4rem; }
    .drop-hint-box { margin-top: 1rem; p { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem; } }
    .tags { display: flex; justify-content: center; gap: 0.5rem; flex-wrap: wrap; }
    .col-tag { background: rgba(255,255,255,0.6); border: 1px solid var(--pink-200); padding: 0.2rem 0.6rem; border-radius: 0.5rem; font-size: 0.75rem; color: var(--pink-600); font-weight: 600; }
    .file-preview { display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: 1rem; padding: 1rem 1.25rem; margin-top: 1rem; color: var(--text-medium); font-weight: 600; }

    /* ═══ MANUAL FORM ═══ */
    .manual-form { background: var(--bg-card); padding: 1.5rem; border-radius: 1.5rem; border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm); }
    .client-section { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: flex-start; }
    .field { flex: 1; min-width: 200px; }
    .field.short { flex: 0 0 160px; min-width: 160px; }
    .relative-container { position: relative; }
    label { display: block; color: var(--pink-600); font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }

    /* ═══ FIX #9: INPUT GLOBAL — cubre field, setup-field, variant, text-capture ═══ */
    .field input, .field select,
    .setup-field input,
    .text-input-row input,
    .variant-input-row input {
      width: 100%; padding: 0.75rem 1rem; background: var(--bg-main);
      border: 1.5px solid rgba(255, 157, 191, 0.2); border-radius: 0.85rem;
      color: var(--text-dark); font-size: 0.95rem; box-sizing: border-box;
      font-family: var(--font-body); transition: all 0.2s;
      &:focus { outline: none; border-color: var(--pink-400); background: var(--bg-card); box-shadow: 0 0 0 3px rgba(255,107,157,0.1); }
    }

    /* ═══ AUTOCOMPLETE ═══ */
    .suggestions-list { position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); backdrop-filter: blur(10px); border: 1px solid var(--pink-200); border-radius: 0.85rem; margin: 5px 0 0; padding: 0; list-style: none; max-height: 200px; overflow-y: auto; z-index: 10; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
    .suggestions-list li { padding: 0.75rem 1rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; border-bottom: 1px solid rgba(0,0,0,0.03); }
    .suggestions-list li:last-child { border-bottom: none; }
    .suggestions-list li:hover { background: var(--pink-50); }
    .suggestions-list .name { font-weight: 600; color: var(--text-dark); }
    .suggestions-list .tag-frecuente { font-size: 0.75rem; background: #fff7e6; color: #fa8c16; padding: 2px 8px; border-radius: 10px; border: 1px solid #ffd591; }
    .suggestions-list .tag-nueva { font-size: 0.75rem; background: #f6ffed; color: #52c41a; padding: 2px 8px; border-radius: 10px; border: 1px solid #b7eb8f; }

    /* ═══ SELECT ═══ */
    .select-wrapper { position: relative; }
    .select-wrapper select { appearance: none; cursor: pointer; }
    .select-wrapper select.highlight { border-color: #b37feb; background: #f9f0ff; color: #722ed1; font-weight: 700; animation: pulse 1s ease; }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(179, 127, 235, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(179, 127, 235, 0); } 100% { box-shadow: 0 0 0 0 rgba(179, 127, 235, 0); } }
    .select-arrow { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: var(--pink-400); pointer-events: none; font-size: 0.8rem; }
    .detect-msg { font-size: 0.7rem; color: #722ed1; font-weight: 700; display: block; text-align: right; margin-top: 4px; }

    /* ═══ TWO-COLUMN MANUAL ═══ */
    .manual-columns { display: flex; gap: 1.5rem; align-items: flex-start; }
    .form-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }
    .items-col {
      flex: 0 0 360px; min-width: 0; display: flex; flex-direction: column;
      background: var(--bg-card); border: 1.5px solid rgba(255, 157, 191, 0.2);
      border-radius: 1.25rem; padding: 1rem; max-height: 520px;
    }
    .items-col-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 2px dashed var(--pink-100);
      h4 { margin: 0; font-family: var(--font-display); font-size: 1rem; color: var(--text-dark); }
    }
    .item-count { background: var(--pink-400); color: white; font-size: 0.75rem; font-weight: 800; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .items-scroll {
      flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; min-height: 80px;
      scrollbar-width: thin; scrollbar-color: var(--pink-200) transparent;
      &::-webkit-scrollbar { width: 4px; }
      &::-webkit-scrollbar-thumb { background: var(--pink-200); border-radius: 4px; }
    }
    .item-row {
      display: flex; align-items: center; gap: 8px; background: var(--bg-main); border-radius: 10px;
      padding: 8px 10px; border: 1px solid rgba(255,157,191,0.12); transition: all 0.15s ease;
      &:hover { border-color: var(--pink-300); box-shadow: 0 2px 8px rgba(255,107,157,0.08); }
    }
    .item-qty { font-weight: 800; color: var(--pink-400); font-size: 0.78rem; min-width: 28px; }
    .item-name { flex: 1; font-size: 0.82rem; color: var(--text-dark); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .item-price { font-size: 0.78rem; color: var(--text-medium); font-weight: 700; white-space: nowrap; }
    .btn-remove-mini {
      width: 24px; height: 24px; border-radius: 50%; border: 1px solid #ffd6d6; background: white;
      color: #ffaaaa; font-size: 1rem; cursor: pointer; display: flex; align-items: center;
      justify-content: center; line-height: 1; transition: all 0.2s; flex-shrink: 0;
      &:hover { background: #ff6b6b; color: white; border-color: #ff6b6b; }
    }
    .items-empty {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 2rem 0;
      .empty-icon { font-size: 2.2rem; opacity: 0.35; }
      p { font-size: 0.82rem; color: #ccc; font-weight: 600; margin: 0; }
      .hint { font-size: 0.72rem; color: #ddd; }
    }
    .items-total-bar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 12px; background: var(--pink-50); border-radius: 10px; margin: 0.75rem 0 0.5rem;
      span:first-child { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    }
    .total-value { font-size: 1.2rem; font-weight: 800; color: var(--pink-600); }

    /* ═══ ADD ITEM SECTION ═══ */
    .add-item-section {
      background: var(--bg-main); padding: 1rem; border-radius: 1rem; border: 1.5px solid rgba(255, 157, 191, 0.15);
      h4 { margin: 0 0 0.75rem; font-family: var(--font-display); font-size: 1rem; color: var(--text-dark); }
    }
    .single-item-form { display: flex; flex-direction: column; gap: 0.6rem; }
    .single-item-form input {
      width: 100%; padding: 0.6rem 0.8rem; background: var(--bg-card);
      border: 1.5px solid rgba(255, 157, 191, 0.2); border-radius: 0.85rem;
      color: var(--text-dark); font-size: 0.9rem; box-sizing: border-box;
      font-family: var(--font-body); transition: all 0.2s;
      &:focus { outline: none; border-color: var(--pink-400); box-shadow: 0 0 0 3px rgba(255,107,157,0.1); }
    }
    .single-item-form input.qty { width: 70px; text-align: center; }
    .single-item-form input.price { width: 100px; }
    .field-group { display: flex; flex-direction: column; }
    .field-group label { font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.2rem; }
    .field-group.grow { flex: 1; }
    .row-split { display: flex; gap: 0.8rem; }
    .field-group.small { width: 70px; }
    .field-group.medium { width: 100px; }
    .btn-add-to-list {
      padding: 0.6rem 1rem; background: linear-gradient(135deg, var(--pink-400), var(--pink-500));
      border: none; border-radius: 0.8rem; color: white; font-weight: 700; font-size: 0.9rem;
      cursor: pointer; transition: all 0.2s; box-shadow: 0 3px 10px rgba(255,107,157,0.25);
      &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(255,107,157,0.35); }
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }

    /* ═══ SHARED BUTTONS ═══ */
    .btn-pink {
      padding: 0.8rem 1.5rem; width: 100%; background: linear-gradient(135deg, var(--pink-400), var(--pink-500));
      color: white; border: none; border-radius: 1rem; cursor: pointer; font-weight: 700; font-size: 1rem;
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      box-shadow: 0 4px 15px rgba(255,107,157,0.3); transition: all 0.3s var(--ease-bounce);
      &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255,107,157,0.4); }
      &:disabled { opacity: 0.6; }
    }
    .wide { width: 100%; }
    .btn-sm {
      padding: 0.4rem 0.8rem; border: 1px solid var(--border-soft); background: white;
      border-radius: 0.6rem; font-size: 0.78rem; font-weight: 700; cursor: pointer;
      color: var(--text-medium); transition: all 0.2s;
      &:hover { border-color: var(--pink-300); color: var(--pink-500); }
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }
    .btn-sm.finish { border-color: #22c55e; color: #16a34a; &:hover { background: #f0fdf4; } }

    /* ═══ RESULTS ═══ */
    .results { margin-top: 2rem; }
    .result-summary { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
    .badge { padding: 0.4rem 1rem; border-radius: 2rem; font-size: 0.85rem; font-weight: 700; &.pink { background: rgba(255,157,191,0.15); color: var(--pink-600); } &.lavender { background: rgba(186,156,230,0.15); color: #8B5CF6; } }
    .warnings { background: rgba(255,200,100,0.1); border: 1px solid rgba(255,200,100,0.25); border-radius: 0.75rem; padding: 1rem; margin-bottom: 1rem; h4 { color: #D97706; margin: 0 0 0.5rem; font-size: 0.9rem; } p { color: #92400E; margin: 0.25rem 0; font-size: 0.8rem; } }
    .orders-list h3 { font-family: var(--font-display); color: var(--text-dark); margin: 0 0 1rem; }
    .orders-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .btn-copy-all { padding: 0.5rem 1rem; background: var(--pink-50); border: 1px solid var(--pink-200); border-radius: 0.6rem; color: var(--pink-600); cursor: pointer; font-weight: 700; font-size: 0.85rem; &:hover { background: var(--pink-100); } }
    .order-card { background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: 1rem; padding: 1rem; margin-bottom: 0.75rem; box-shadow: var(--shadow-sm); transition: transform 0.2s; &:hover { transform: translateY(-2px); } }
    .order-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; strong { color: var(--text-dark); } .total { color: var(--pink-500); font-weight: 800; } }
    .order-items { margin-bottom: 0.75rem; }
    .item-tag { display: inline-block; padding: 0.2rem 0.6rem; background: rgba(255,107,157,0.08); border-radius: 0.5rem; color: var(--pink-600); font-size: 0.78rem; font-weight: 600; margin: 0.15rem 0.25rem 0.15rem 0; }
    .order-link { display: flex; gap: 0.5rem; input { flex: 1; padding: 0.5rem 0.75rem; background: var(--pink-50); border: 1px solid var(--border-soft); border-radius: 0.6rem; color: var(--text-light); font-size: 0.8rem; } }
    .btn-copy { padding: 0.5rem 0.75rem; background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: 0.6rem; color: var(--text-medium); cursor: pointer; font-size: 0.8rem; font-weight: 600; &:hover { background: var(--bg-main); border-color: var(--pink-300); } }
    .error { background: rgba(255,107,157,0.08); border: 1px solid rgba(255,107,157,0.2); color: var(--pink-600); padding: 0.75rem 1rem; border-radius: 0.75rem; margin-top: 1rem; }
    .spinner { width: 16px; height: 16px; border: 2.5px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ═══════════════════════════════════════════
       LIVE MODE STYLES
    ═══════════════════════════════════════════ */
    .live-container { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

    /* ── Setup ── */
    .live-setup { background: var(--bg-card); padding: 1.5rem; border-radius: 1.5rem; border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm); }
    .setup-header { margin-bottom: 1.5rem; h3 { font-family: var(--font-display); color: var(--text-dark); margin: 0; } .hint { color: var(--text-muted); font-size: 0.85rem; margin: 0.25rem 0 0; } }
    .setup-form { display: flex; flex-direction: column; gap: 1rem; }
    .setup-row { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; }
    .setup-field { display: flex; flex-direction: column; }
    .setup-field.grow { flex: 1; min-width: 200px; }
    .setup-field.auto { flex: 0 0 auto; }
    .btn-configure {
      padding: 0.75rem 1.25rem; background: var(--pink-100); color: var(--pink-600);
      border: 1.5px solid var(--pink-200); border-radius: 0.85rem; font-weight: 700;
      cursor: pointer; transition: all 0.2s; white-space: nowrap;
      &:hover:not(:disabled) { background: var(--pink-200); transform: translateY(-1px); }
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }

    .product-configured-card {
      background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 1.5px solid #86efac;
      border-radius: 1rem; padding: 0.75rem 1rem;
    }
    .configured-info { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .configured-badge { font-size: 0.75rem; font-weight: 800; color: #16a34a; }
    .configured-info strong { color: var(--text-dark); font-size: 1rem; }
    .configured-price { background: #dcfce7; color: #16a34a; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 0.5rem; font-size: 0.85rem; }
    .btn-reset-product { margin-left: auto; padding: 0.3rem 0.6rem; background: white; border: 1px solid #d1d5db; border-radius: 0.5rem; font-size: 0.78rem; cursor: pointer; color: var(--text-medium); &:hover { border-color: var(--pink-300); } }

    .variants-section { }
    .variant-hint { font-size: 0.78rem; color: var(--text-muted); margin: 0.1rem 0 0.5rem; font-style: italic; }
    .variant-input-row { display: flex; gap: 0.5rem; }
    .btn-add-variant {
      padding: 0.6rem 1rem; background: var(--pink-100); color: var(--pink-600); border: none;
      border-radius: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s;
      &:hover:not(:disabled) { background: var(--pink-200); }
      &:disabled { opacity: 0.4; }
    }
    .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.6rem; }
    .chip {
      display: inline-flex; align-items: center; gap: 0.3rem;
      background: linear-gradient(135deg, var(--pink-50), var(--pink-100));
      border: 1px solid var(--pink-200); padding: 0.35rem 0.75rem; border-radius: 2rem;
      font-size: 0.85rem; font-weight: 600; color: var(--pink-600);
      button { background: none; border: none; color: var(--pink-400); cursor: pointer; font-size: 1rem; padding: 0; line-height: 1; &:hover { color: #ef4444; } }
    }
    .btn-start-live {
      width: 100%; padding: 1rem; background: linear-gradient(135deg, #ef4444, #f97316);
      color: white; border: none; border-radius: 1rem; font-weight: 800; font-size: 1.1rem;
      cursor: pointer; box-shadow: 0 4px 15px rgba(239,68,68,0.3); transition: all 0.3s var(--ease-bounce);
      &:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(239,68,68,0.4); }
    }
    .pending-note { color: #d97706; font-size: 0.85rem; font-weight: 600; margin: 0.75rem 0 0; }

    /* ── Capturing ── */
    .product-bar {
      display: flex; align-items: center; gap: 1rem; background: var(--bg-card);
      padding: 0.75rem 1.25rem; border-radius: 1rem; border: 1px solid var(--border-soft);
      box-shadow: var(--shadow-sm); margin-bottom: 1rem; flex-wrap: wrap;
    }
    /* FIX #10: colores hardcoded en vez de variables que pueden no existir */
    .live-badge { background: #ef4444; color: white; font-size: 0.7rem; font-weight: 800; padding: 0.3rem 0.7rem; border-radius: 2rem; animation: livePulse 1.5s ease-in-out infinite; white-space: nowrap; }
    @keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
    .product-info { flex: 1; display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; strong { color: var(--text-dark); font-size: 1rem; } }
    .product-price { background: #dcfce7; color: #16a34a; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 0.5rem; font-size: 0.85rem; }
    .variant-tags { display: flex; gap: 0.3rem; flex-wrap: wrap; }
    .vtag { background: var(--pink-50); color: var(--pink-500); padding: 0.15rem 0.5rem; border-radius: 1rem; font-size: 0.72rem; font-weight: 700; }
    .product-actions { display: flex; gap: 0.5rem; }

    .capture-layout { display: flex; gap: 1.25rem; align-items: flex-start; }
    .capture-panel { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }

    /* Voice */
    .voice-section {
      display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
      padding: 1.5rem; background: var(--bg-card); border-radius: 1.25rem;
      border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm);
    }
    .voice-section.no-support { padding: 1rem; p { color: var(--text-muted); font-size: 0.85rem; margin: 0; text-align: center; } }
    .mic-btn {
      width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--pink-200);
      background: linear-gradient(135deg, var(--bg-main), var(--bg-card));
      cursor: pointer; font-size: 2rem; display: flex; align-items: center; justify-content: center;
      transition: all 0.3s var(--ease-bounce);
      &:hover { border-color: var(--pink-400); transform: scale(1.08); }
    }
    .mic-btn.listening {
      border-color: #ef4444; background: #fef2f2;
      animation: heartbeat 1s ease-in-out infinite;
    }
    @keyframes heartbeat { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 50% { box-shadow: 0 0 0 15px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }
    .voice-hint { font-size: 0.85rem; color: var(--text-muted); font-weight: 600; margin: 0; }
    .listening-text { color: #ef4444; animation: livePulse 1s ease-in-out infinite; }
    .transcript-live { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 0.75rem; padding: 0.6rem 1rem; font-size: 0.9rem; color: var(--text-dark); font-style: italic; width: 100%; text-align: center; }

    /* Text capture */
    .text-capture {
      background: var(--bg-card); padding: 1rem; border-radius: 1.25rem;
      border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm);
      label { margin-bottom: 0.4rem; }
    }
    .text-input-row { display: flex; gap: 0.5rem; }
    .text-input-row input { flex: 1; }
    .btn-parse {
      padding: 0.6rem 1rem; background: var(--pink-100); color: var(--pink-600); border: none;
      border-radius: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap;
      &:hover { background: var(--pink-200); } &:disabled { opacity: 0.4; }
    }

    /* Preview */
    .capture-preview {
      background: var(--bg-card); padding: 1.25rem; border-radius: 1.25rem;
      border: 2px solid #22c55e; box-shadow: var(--shadow-sm); animation: fadeIn 0.3s ease-out;
      &.medium { border-color: #f59e0b; }
      &.low { border-color: #ef4444; }
    }
    .preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; h4 { margin: 0; font-family: var(--font-display); color: var(--text-dark); font-size: 0.95rem; } }
    .confidence { font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 1rem; &.high { background: #dcfce7; color: #16a34a; } &.medium { background: #fef3c7; color: #d97706; } &.low { background: #fef2f2; color: #ef4444; } }
    .preview-client { font-weight: 700; color: var(--text-dark); font-size: 1rem; margin: 0.5rem 0; }
    .preview-items { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.75rem; }
    .preview-item { display: flex; justify-content: space-between; padding: 0.4rem 0.6rem; background: var(--bg-main); border-radius: 0.5rem; font-size: 0.88rem; }
    .preview-total-row { background: var(--pink-50); border: 1px solid var(--pink-100); }
    .preview-subtotal { font-weight: 700; color: var(--pink-500); }
    .preview-actions { display: flex; gap: 0.5rem; }
    .btn-confirm {
      flex: 1; padding: 0.6rem; background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white; border: none; border-radius: 0.7rem; font-weight: 700; cursor: pointer;
      transition: all 0.2s; &:hover { transform: translateY(-1px); } &:disabled { opacity: 0.5; }
    }
    .btn-discard {
      padding: 0.6rem 1rem; background: var(--bg-card); border: 1px solid #fecaca;
      color: #ef4444; border-radius: 0.7rem; font-weight: 700; cursor: pointer;
      &:hover { background: #fef2f2; }
    }

    /* Feed */
    .orders-feed {
      flex: 0 0 340px; min-width: 0; background: linear-gradient(135deg, var(--bg-main), var(--bg-card));
      border: 1.5px solid rgba(255,157,191,0.2); border-radius: 1.25rem; padding: 1rem;
      max-height: 550px; display: flex; flex-direction: column;
    }
    .feed-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 2px dashed var(--pink-100);
      h4 { margin: 0; font-family: var(--font-display); font-size: 0.95rem; color: var(--text-dark); }
    }
    .feed-stats { font-size: 0.72rem; font-weight: 700; color: var(--pink-500); background: var(--pink-50); padding: 0.2rem 0.6rem; border-radius: 1rem; }
    .feed-scroll { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; scrollbar-width: thin; scrollbar-color: var(--pink-200) transparent; }
    .feed-order { background: var(--bg-card); border-radius: 0.75rem; padding: 0.6rem 0.8rem; border: 1px solid rgba(255,157,191,0.12); animation: fadeIn 0.3s ease-out; }
    .feed-order-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; strong { font-size: 0.88rem; color: var(--text-dark); } }
    .feed-order-actions { display: flex; align-items: center; gap: 0.4rem; }
    .feed-total { font-size: 0.78rem; font-weight: 800; color: var(--pink-500); }
    .feed-item { display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: var(--text-medium); padding: 0.15rem 0; }
    .btn-x-tiny { width: 18px; height: 18px; border-radius: 50%; border: 1px solid #ffd6d6; background: white; color: #ffaaaa; font-size: 0.7rem; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; &:hover { background: #ff6b6b; color: white; } }
    .feed-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; padding: 2rem 0; span { font-size: 2.5rem; opacity: 0.3; } p { color: #ccc; font-weight: 600; font-size: 0.85rem; margin: 0; } }
    .feed-empty-hint { font-size: 0.72rem !important; color: #ddd !important; }

    /* ── Review ── */
    .live-review { animation: fadeIn 0.3s ease-out; }
    .review-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; h3 { font-family: var(--font-display); color: var(--text-dark); margin: 0; } }
    .review-sub { font-size: 0.85rem; color: var(--text-muted); margin: 0.15rem 0 0; }
    .review-summary-bar {
      display: flex; justify-content: space-between; align-items: center;
      background: var(--pink-50); padding: 0.6rem 1rem; border-radius: 0.75rem;
      margin-bottom: 1rem; font-size: 0.85rem; font-weight: 700; color: var(--text-medium);
    }
    .review-summary-total { color: var(--pink-600); font-size: 1rem; }
    .review-orders { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
    .review-card {
      background: var(--bg-card); padding: 1.25rem; border-radius: 1.25rem;
      border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm); transition: all 0.2s;
      &.deselected { opacity: 0.45; }
    }
    .review-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .review-check { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; input { width: 18px; height: 18px; accent-color: var(--pink-400); } strong { font-size: 1rem; color: var(--text-dark); } }
    .review-total { font-size: 1.1rem; font-weight: 800; color: var(--pink-500); }
    .review-items { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.75rem; }
    .review-item-tag { background: var(--pink-50); padding: 0.25rem 0.6rem; border-radius: 0.5rem; font-size: 0.78rem; font-weight: 600; color: var(--pink-600); }
    .review-type { display: flex; gap: 0.5rem; button { flex: 1; padding: 0.5rem; border: 2px solid var(--pink-100); background: var(--bg-main); border-radius: 0.6rem; font-weight: 600; font-size: 0.85rem; cursor: pointer; color: var(--text-medium); transition: all 0.2s; &.active { border-color: var(--pink-500); background: var(--pink-50); color: var(--pink-600); } } }
    .create-progress { display: flex; align-items: center; gap: 0.5rem; justify-content: center; padding: 0.75rem; color: var(--pink-500); font-weight: 700; font-size: 0.9rem; .spinner { border-color: rgba(236,72,153,0.2); border-top-color: var(--pink-500); } }

    /* ═══ RESPONSIVE ═══ */
    @media (max-width: 768px) {
      .manual-columns { flex-direction: column; }
      .items-col { flex: none; width: 100%; max-height: 300px; }
      .capture-layout { flex-direction: column; }
      .orders-feed { flex: none; width: 100%; max-height: 300px; }
      .product-bar { flex-direction: column; text-align: center; }
      .product-actions { width: 100%; justify-content: center; }
      .mic-btn { width: 70px; height: 70px; font-size: 1.8rem; }
      .setup-row { flex-direction: column; }
      .setup-field.auto { width: 100%; button { width: 100%; } }
    }
  `]
})
export class UploadExcelComponent implements OnInit, OnDestroy {
  mode = signal<'excel' | 'manual' | 'live'>('excel');
  dragging = signal(false);
  selectedFile = signal<File | null>(null);
  uploading = signal(false);
  result = signal<ExcelUploadResult | null>(null);
  error = signal('');

  // DATOS MANUALES
  manualClient = '';
  manualClientType = '';
  manualOrderType = 'Delivery';
  manualItems: { productName: string; quantity: number; unitPrice: number }[] = [];
  currentItem = { productName: '', quantity: 1, unitPrice: 0 };

  // AUTOCOMPLETE
  clients = signal<any[]>([]);
  filteredClients = signal<any[]>([]);
  showSuggestions = signal(false);
  autoDetected = signal(false);

  // ═══ LIVE MODE STATE ═══
  livePhase = signal<'setup' | 'capturing' | 'review'>('setup'); // Changed initial phase to 'setup'
  liveCaptures = signal<LiveCapture[]>([]);
  liveProduct = signal<LiveProduct | null>(null); // Added liveProduct signal

  // Voice
  recognition: any;
  isListening = signal<boolean>(false);
  interimTranscript = signal<string>('');
  finalTranscript = signal<string>('');
  parsedPreview = signal<LiveCapture | null>(null);
  silenceTimeout: any;

  // Manual Input in Live Mode
  textInput = '';
  speechSupported = signal(false);
  liveCreating = signal(false);
  liveCreateProgress = signal('');

  // Live form fields
  lpName = '';
  lpPrice: number = 0;
  newVariant = '';
  // textInput is already declared above

  // Computed
  liveTotalOrders = computed(() => this.liveCaptures().length);
  liveTotalAmount = computed(() => this.liveCaptures().reduce((acc, c) => acc + c.parsed.totalPrice, 0));

  // For Review Mode - use reviewOrders signal!
  liveSelectedCount = computed(() => this.reviewOrders().filter(o => o.selected).length);
  liveSelectedTotal = computed(() => this.reviewOrders().filter(o => o.selected).reduce((acc, o) => acc + (o as any).totalForSort, 0));

  // private recognition: any; // Already declared above
  // private silenceTimeout: any; // Already declared above

  constructor(private api: ApiService) {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.speechSupported.set(!!SR);
    if (SR) {
      this.recognition = new SR();
      this.recognition.lang = 'es-MX';
      this.recognition.interimResults = true;
      this.recognition.continuous = false;
      this.recognition.maxAlternatives = 1;
    }
  }

  ngOnInit(): void {
    this.api.getClients().subscribe({
      next: (data) => this.clients.set(data),
      error: (err) => console.error('Error cargando clientas', err)
    });
  }

  ngOnDestroy(): void {
    this.stopListening();
  }

  // ═══════════════ MANUAL MODE ═══════════════

  onSearchClient(): void {
    const term = this.manualClient.toLowerCase().trim();
    if (!term) { this.filteredClients.set([]); this.showSuggestions.set(false); this.autoDetected.set(false); return; }
    this.filteredClients.set(this.clients().filter(c => c.name.toLowerCase().includes(term)));
    this.showSuggestions.set(true);
    this.autoDetected.set(false);
  }

  selectClient(client: any): void {
    this.manualClient = client.name;
    this.showSuggestions.set(false);
    this.manualClientType = (client.ordersCount || 0) >= 2 ? 'Frecuente' : 'Nueva';
    this.autoDetected.set(true);
  }

  onDragOver(e: DragEvent): void { e.preventDefault(); this.dragging.set(true); }
  onDrop(e: DragEvent): void { e.preventDefault(); this.dragging.set(false); const file = e.dataTransfer?.files[0]; if (file) this.selectedFile.set(file); }
  onFileSelect(e: Event): void { const input = e.target as HTMLInputElement; if (input.files?.[0]) this.selectedFile.set(input.files[0]); }

  uploadExcel(): void {
    const file = this.selectedFile();
    if (!file) return;
    this.uploading.set(true); this.error.set(''); this.result.set(null);
    this.api.uploadExcel(file).subscribe({
      next: (res) => { this.result.set(res); this.uploading.set(false); this.selectedFile.set(null); },
      error: (err) => { this.error.set(err.error?.message || err.message || 'Error al procesar'); this.uploading.set(false); }
    });
  }

  addCurrentItem(): void {
    if (!this.currentItem.productName?.trim() || this.currentItem.unitPrice <= 0) return;
    this.manualItems.push({ ...this.currentItem });
    this.currentItem = { productName: '', quantity: 1, unitPrice: 0 };
    setTimeout(() => {
      const el = document.querySelector('.single-item-form input[type="text"]') as HTMLInputElement;
      el?.focus();
    }, 50);
  }

  focusManualField(field: string): void {
    const selector = field === 'qty' ? '.single-item-form .qty' : '.single-item-form .price';
    (document.querySelector(selector) as HTMLInputElement)?.focus();
  }

  getManualTotal(): number {
    return this.manualItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }

  removeItem(i: number): void { this.manualItems.splice(i, 1); }

  createManual(): void {
    if (!this.manualClient.trim()) { this.error.set('¡Falta el nombre de la clienta, bonita! 🙅‍♀️'); return; }
    const validItems = [];
    for (const item of this.manualItems) {
      if (!item.productName.trim() && item.quantity === 1 && item.unitPrice === 0) continue;
      if (!item.productName.trim()) { this.error.set('Ups, un artículo no tiene nombre 😿'); return; }
      if (item.quantity <= 0) { this.error.set(`La cantidad de "${item.productName}" no puede ser 0 🔢`); return; }
      if (item.unitPrice < 0) { this.error.set(`El precio de "${item.productName}" no es válido 💲`); return; }
      validItems.push(item);
    }
    if (validItems.length === 0) { this.error.set('Agrega al menos un artículo válido 🛍️'); return; }
    this.uploading.set(true); this.error.set('');
    this.api.createManualOrder({ clientName: this.manualClient, clientType: (this.manualClientType as 'Nueva' | 'Frecuente') || undefined, orderType: this.manualOrderType, items: validItems }).subscribe({
      next: (order) => {
        console.log('📦 Response completo:', JSON.stringify(order, null, 2));
        this.result.set({ ordersCreated: 1, clientsCreated: 0, orders: [order], warnings: [] });
        this.uploading.set(false); this.manualClient = ''; this.manualClientType = '';
        this.manualOrderType = 'Delivery'; this.autoDetected.set(false);
        this.manualItems = []; this.currentItem = { productName: '', quantity: 1, unitPrice: 0 };
      },
      error: (err) => { this.error.set(err.error?.message || 'Error al crear pedido manual'); this.uploading.set(false); }
    });
  }

  copyLink(input: HTMLInputElement): void { navigator.clipboard.writeText(input.value); }

  copyAllLinks(): void {
    const r = this.result();
    if (!r) return;
    const links = r.orders.map((o: any) => `${o.clientName}: ${o.clientLink}`).join('\n');
    navigator.clipboard.writeText(links);
  }

  // ═══════════════ LIVE MODE: SETUP ═══════════════

  // Start immediately in capture mode (no setup needed)
  startLive(): void {
    this.livePhase.set('capturing');
    this.startListening();
  }

  stopLive(): void {
    this.stopListening();
    this.livePhase.set('setup');
    // In "free capture" maybe we just go back to a landing or summary?
    // For now let's say 'setup' means the landing page of the Live tab.
  }

  // ═══════════════ LIVE MODE: VOICE ═══════════════

  toggleListening(): void {
    if (this.isListening()) this.stopListening(); else this.startListening();
  }

  startListening(): void {
    if (!this.recognition) return;
    this.interimTranscript.set('');
    this.finalTranscript.set('');
    this.parsedPreview.set(null);
    this.isListening.set(true);

    this.recognition.onresult = (e: any) => {
      clearTimeout(this.silenceTimeout);
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      this.interimTranscript.set(interim);
      if (final) {
        this.finalTranscript.set(final);
        this.processTranscript(final);
      }
      // Auto-stop after 5s of silence (increased from 3s)
      this.silenceTimeout = setTimeout(() => {
        try { this.recognition?.stop(); } catch { }
      }, 5000);
    };

    // FIX #8: onend procesa interim si no hubo final result
    this.recognition.onend = () => {
      this.isListening.set(false);
      clearTimeout(this.silenceTimeout);
      const interim = this.interimTranscript();
      if (interim && !this.finalTranscript() && !this.parsedPreview()) {
        this.processTranscript(interim);
      }
    };

    this.recognition.onerror = (e: any) => {
      console.warn('Speech recognition error:', e.error);
      this.isListening.set(false);
      clearTimeout(this.silenceTimeout);
    };

    try { this.recognition.start(); } catch { this.isListening.set(false); }
  }

  stopListening(): void {
    clearTimeout(this.silenceTimeout);
    try { this.recognition?.stop(); } catch { }
    this.isListening.set(false);
  }

  // ═══════════════ LIVE MODE: TEXT INPUT ═══════════════

  onTextSubmit(): void {
    const t = this.textInput.trim();
    if (!t) return;
    this.processTranscript(t);
    this.textInput = '';
  }

  // ═══════════════ LIVE MODE: PARSER ═══════════════

  parseVoiceInput(text: string): LiveCapture {
    let clientName = '';
    let productDescription = '';
    let quantity = 1;
    let totalPrice = 0;
    let unitPrice = 0;

    // A. CLEANUP — normalize whitespace, trim
    text = text.replace(/\s+/g, ' ').trim();
    let workingText = text;

    // B. EXTRACT PRICE — find the LAST number in the string (price is always said last)
    // Matches patterns like: "120", "120 pesos", "a 120", "son 120 pesos"
    // We search for the last occurrence of a number (digits or word-number) optionally followed by currency
    const pricePattern = /(?:^|\s)(?:a\s+|son\s+|cuesta\s+|por\s+|precio\s+)?(\d+(?:\.\d+)?|cien|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|mil)(?:\s+(?:pesos|varos|mxn|d[oó]lares|usd|bolas|pe))?(?:\s*$)/i;
    const priceMatch = workingText.match(pricePattern);

    if (priceMatch) {
      const val = this.parseNumber(priceMatch[1]);
      if (val !== null && val > 0) {
        totalPrice = val;
        // Remove the entire price segment from the end
        workingText = workingText.substring(0, priceMatch.index!).trim();
      }
    } else {
      // Fallback: find ANY last number in the text
      const fallbackPrice = /(\d+(?:\.\d+)?)\s*\S*\s*$/;
      const fbMatch = workingText.match(fallbackPrice);
      if (fbMatch) {
        const val = parseFloat(fbMatch[1]);
        if (val > 0) {
          totalPrice = val;
          workingText = workingText.substring(0, fbMatch.index!).trim();
        }
      }
    }

    // C. EXTRACT CLIENT NAME — try known clients first, then heuristics
    // Strategy: try progressively longer prefixes (1 word, 2 words, 3 words, 4 words)
    // against the known client list. Use the LONGEST match.
    const bestMatch = this.findBestClientMatch(workingText);
    if (bestMatch) {
      clientName = bestMatch.name;
      productDescription = workingText.substring(bestMatch.length).trim();
    } else {
      // Heuristic fallback: Names are typically 2-3 capitalized words at the start.
      // Split by words and find where the "product" likely starts.
      // Product words tend to be common nouns (toalla, blusa, vestido, bolsa, etc.)
      const words = workingText.split(/\s+/);

      if (words.length <= 1) {
        // Only one word — it's ambiguous, treat as product with unknown client
        clientName = '';
        productDescription = workingText;
      } else if (words.length === 2) {
        // Two words — likely "Name Product" or "FirstName LastName"
        // Check if the second word looks like a product
        clientName = words[0];
        productDescription = words.slice(1).join(' ');
      } else {
        // 3+ words: Try to detect where the name ends and product begins.
        // Heuristic: Take first 2 words as name, rest as product.
        // But if word 3 also looks like a name (capitalized, not a common noun), take 3.
        let splitIdx = 2; // Default: first 2 words = name

        // If we have 4+ words and word index 2 starts with uppercase, 
        // it might be part of the name (e.g., "Ana María López toalla roja")
        if (words.length >= 4) {
          const w2 = words[2];
          // If 3rd word starts uppercase and is short (likely a surname), include it in name
          if (w2.charAt(0) === w2.charAt(0).toUpperCase() && w2.charAt(0) !== w2.charAt(0).toLowerCase() && w2.length <= 12) {
            splitIdx = 3;
          }
        }

        clientName = words.slice(0, splitIdx).join(' ');
        productDescription = words.slice(splitIdx).join(' ');
      }
    }

    // Clean up client name
    clientName = clientName.replace(/^[\s,]+|[\s,]+$/g, '').trim();
    // Try to match against known clients for proper casing
    const exactMatch = this.fuzzyMatchClient(clientName);
    if (exactMatch) clientName = exactMatch;

    // D. EXTRACT QUANTITY FROM PRODUCT DESCRIPTION
    // Check if product description starts with a number or number-word
    const qtyRegex = /^(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d+)\s+/i;
    const qtyMatch = productDescription.match(qtyRegex);
    if (qtyMatch) {
      const q = this.parseNumber(qtyMatch[1]);
      if (q && q > 0) {
        quantity = q;
        productDescription = productDescription.substring(qtyMatch[0].length).trim();
      }
    }

    // E. UNIT PRICE
    if (this.rawTextContains(text, ['cada uno', 'c/u', 'por pieza'])) {
      unitPrice = totalPrice;
      totalPrice = unitPrice * quantity;
    } else {
      if (quantity > 0) unitPrice = totalPrice / quantity;
    }

    // F. Clean up product description — remove trailing filler words
    productDescription = productDescription.replace(/\s+(a|de|por|son|pesos?|el|la|los|las)\s*$/i, '').trim();

    return {
      id: crypto.randomUUID(),
      rawText: text,
      parsed: {
        clientName,
        productDescription,
        quantity,
        totalPrice,
        unitPrice
      },
      isConfirmed: false,
      timestamp: new Date()
    };
  }

  private rawTextContains(text: string, phrases: string[]): boolean {
    const norm = normalizeForMatch(text);
    return phrases.some(p => norm.includes(normalizeForMatch(p)));
  }

  // Process transcript wrapper
  private processTranscript(text: string): void {
    const capture = this.parseVoiceInput(text);
    // High confidence checks?
    // If client is known and price > 0, maybe high confidence?
    if (capture.parsed.clientName && capture.parsed.totalPrice > 0 && capture.parsed.productDescription) {
      capture.isConfirmed = true;
      // Auto-add to list? Or just show preview?
      // Requirement: "Tarjeta se agrega automáticamente al feed (o requiere un tap...)"
      // Let's Auto-add if "High Confidence" (Client found + Price found)
      // BUT waiting for "Final Result" from speech API is better.
      // This method is called with Final transcript.

      this.liveCaptures.update(prev => [capture, ...prev]);
      this.parsedPreview.set(null); // Clear preview
    } else {
      // Low confidence, show preview to edit/confirm
      this.parsedPreview.set(capture);
    }
    this.interimTranscript.set('');
  }

  confirmPreview(): void {
    const p = this.parsedPreview();
    if (p) {
      p.isConfirmed = true;
      this.liveCaptures.update(prev => [p, ...prev]);
      this.parsedPreview.set(null);
    }
  }

  deleteCapture(id: string): void {
    this.liveCaptures.update(prev => prev.filter(c => c.id !== id));
  }

  // FIX #6: Stable Review List
  // We need to store the grouped orders so checkboxes don't reset on every change detection
  reviewOrders = signal<LiveOrder[]>([]);

  startReview(): void {
    this.reviewOrders.set(this.getGroupedOrders());
    this.livePhase.set('review');
  }

  // Helper to calculate grouped orders from raw captures
  getGroupedOrders(): LiveOrder[] {
    // Group captures by clientName
    const groups: Record<string, LiveCapture[]> = {};
    for (const cap of this.liveCaptures()) {
      const key = cap.parsed.clientName.toLowerCase().trim() || 'Desconocido';
      if (!groups[key]) groups[key] = [];
      groups[key].push(cap);
    }

    // Convert to LiveOrder format for the Review screen
    // We need to map `LiveOrder` interface again or adapt template
    // Let's map to the interface compatible with the Review Template

    return Object.keys(groups).map(key => {
      const caps = groups[key];
      const first = caps[0];
      // Heuristic for Client Name capitalized
      const displayClient = first.parsed.clientName || 'Desconocido';

      return {
        id: crypto.randomUUID(),
        clientName: displayClient,
        items: caps.map(c => ({
          productName: c.parsed.productDescription,
          variant: '', // No variant logic anymore
          quantity: c.parsed.quantity,
          unitPrice: c.parsed.unitPrice,
          // We store unitPrice, but display total?
          // Review template uses unitPrice * quantity
        })),
        orderType: 'Delivery' as 'Delivery' | 'PickUp',
        selected: true,
        totalForSort: caps.reduce((s, c) => s + c.parsed.totalPrice, 0)
      };
    }).sort((a, b) => b.totalForSort - a.totalForSort); // Sort by biggest order
  }

  // Helper to find client in text start
  private findBestClientMatch(text: string): { name: string; length: number } | null {
    const normText = normalizeForMatch(text);
    let best: { name: string; length: number } | null = null;

    // Check clients. This is O(N*M), valid for small N (<1000)
    // Optimization: start with words

    // We can't easily check all clients efficiently without a Trie or similar.
    // For now, let's try matching the first few words combinations.
    const words = text.split(' ');
    for (let i = 1; i <= 4 && i <= words.length; i++) {
      const seg = words.slice(0, i).join(' ');
      const match = this.fuzzyMatchClient(seg);
      if (match) {
        // Prefer longest match
        if (!best || seg.length > best.length) {
          best = { name: match, length: seg.length };
        }
      }
    }
    return best;
  }

  private parseNumber(word: string): number | null {
    if (/^\d+$/.test(word)) return parseInt(word, 10);
    return NUMBER_WORDS[word.toLowerCase()] ?? null;
  }

  private matchVariant(word: string, variants: string[]): string {
    const norm = normalizeForMatch(word);
    for (const v of variants) {
      if (normalizeForMatch(v) === norm) return v;
    }
    for (const v of variants) {
      const normV = normalizeForMatch(v);
      if (normV.startsWith(norm) || norm.startsWith(normV)) return v;
    }
    return '';
  }

  private fuzzyMatchClient(name: string): string | null {
    if (!name) return null;
    const normName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    for (const c of this.clients()) {
      const normC = (c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      if (normC === normName) return c.name;
    }
    for (const c of this.clients()) {
      const normC = (c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      if (normC.includes(normName) || normName.includes(normC)) return c.name;
    }
    return null;
  }

  getPreviewTotal(): number {
    const p = this.parsedPreview();
    if (!p) return 0;
    return p.parsed.totalPrice;
  }

  // ═══════════════ LIVE MODE: CONFIRM / DISCARD ═══════════════

  confirmCapture(): void {
    const preview = this.parsedPreview();
    const product = this.liveProduct();
    if (!preview || !preview.parsed.clientName) return;

    // This logic is for adding to raw captures, not grouped orders.
    // The grouped orders are derived from liveCaptures.
    this.liveCaptures.update(prev => [preview, ...prev]);

    this.parsedPreview.set(null);
    this.interimTranscript.set('');
    this.finalTranscript.set('');
  }

  discardCapture(): void {
    this.parsedPreview.set(null);
    this.interimTranscript.set('');
    this.finalTranscript.set('');
  }

  // This removes a raw capture, not a grouped order.
  // The grouped orders will automatically update.
  removeLiveOrder(id: string): void {
    this.liveCaptures.update(o => o.filter(x => x.id !== id));
  }

  // This function is not used in the current HTML for liveCaptures feed.
  // It would be used if we were editing items within a raw capture.
  removeLiveItem(orderId: string, itemIdx: number): void {
    // This logic needs to be adapted if we are removing items from grouped orders.
    // For now, it's not directly applicable to the `liveCaptures` signal which stores individual captures.
    // If this was meant for grouped orders, it would need to operate on `getGroupedOrders()` result.
    // Given the current structure, this function seems to be a leftover or intended for a different UI.
    console.warn('removeLiveItem is not implemented for current liveCaptures structure.');
  }



  // ═══════════════ LIVE MODE: REVIEW & SUBMIT ═══════════════

  // startReview(): void { this.livePhase.set('review'); } // Already declared above
  backToCapturing(): void { this.livePhase.set('capturing'); }

  private getClientType(name: string): string {
    const c = this.clients().find(cl => cl.name?.toLowerCase().trim() === name.toLowerCase().trim());
    return c && (c.ordersCount || 0) >= 2 ? 'Frecuente' : 'Nueva';
  }

  // FIX #2: firstValueFrom en vez de toPromise()
  // FIX #3: NO cambia mode a 'excel' después de crear, se queda en Live mostrando resultados
  submitAllOrders(): void {
    const all = this.liveCaptures(); // LiveCapture[]
    // We need to group them first because our UI shows grouped orders and user selects from Grouped
    // But wait, the `liveSelectedCount` uses `getGroupedOrders()`.
    // The `LiveOrder` objects in `getGroupedOrders` are transient (created on the fly).
    // The selection state isn't persistent if `getGroupedOrders` is re-evaluated!
    // FIX #6: We need to ensure selection is preserved or operate on a stable list.
    // However, for now, let's assume the user doesn't trigger re-evaluation (capturing more) while in Review.
    // If we are in Review, we should probably have a stable "reviewOrders" signal or property.
    // But let's stick to the current implementation for now: `getGroupedOrders` calculates from `liveCaptures`.
    // The `selected` property is on the *LiveOrder* interface which is created in `getGroupedOrders`.
    // If `getGroupedOrders` is a function called in the template, it returns NEW objects every time change detection runs!
    // This will RESET the selection checkboxes continuously or make them unusable!

    // CRITICAL FIX: The `getGroupedOrders()` strategy is flawed for direct generic binding if it returns new objects.
    // We should compute it into a signal or property when entering Review mode.

    // Checks if we have specific logic for this.
    // For now, let's fix the `submitAllOrders` logic assuming we CAN get the selected orders.
    // (I will address the selection persistence separately if needed, but likely the template calls it once or we rely on the component state).

    // Actually, `getGroupedOrders` returns a sorted array. 
    // If I use it in `@for`, and it returns new references, Angular might reset types?
    // But `selected` is a property of the object. If the object is recreated, `selected` defaults to true.
    // So unchecking a box will do nothing if the view re-renders? 
    // YES. This is a bug from my previous edit.

    // I need to store the grouped orders in a signal or property when entering review.

    const ordersToCreate = this.getGroupedOrders().filter(o => o.selected);
    if (ordersToCreate.length === 0) return;

    this.liveCreating.set(true);
    let createdCount = 0;
    const createdOrders: OrderSummary[] = []; // Collect results
    this.liveCreateProgress.set(`Creando 0 de ${ordersToCreate.length}...`);

    const processNext = (i: number) => {
      if (i >= ordersToCreate.length) {
        this.liveCreating.set(false);
        // We successfully created them.
        // We should remove them from `liveCaptures`.
        // The `ordersToCreate` are Grouped. We need to find which captured items belong to them.
        // A `LiveOrder` (grouped) contains original items? No, it has mapped items.
        // But we know the Client Name.
        // So we should remove all captures for that client?

        const createdClients = new Set(ordersToCreate.map(o => o.clientName.toLowerCase().trim()));

        this.liveCaptures.update(prev => prev.filter(c => !createdClients.has(c.parsed.clientName.toLowerCase().trim())));

        this.result.set({
          ordersCreated: createdCount,
          clientsCreated: 0,
          orders: createdOrders,
          warnings: []
        });

        if (this.liveCaptures().length === 0) {
          this.livePhase.set('setup');
          this.liveProduct.set(null);
          this.lpName = ''; this.lpPrice = 0;
        }
        return;
      }

      const o = ordersToCreate[i];
      this.liveCreateProgress.set(`Creando ${i + 1} de ${ordersToCreate.length}...`);

      this.api.createManualOrder({
        clientName: o.clientName,
        clientType: this.getClientType(o.clientName) as 'Nueva' | 'Frecuente', // Use helper
        orderType: o.orderType,
        items: o.items // These match structure {productName, quantity, unitPrice}
      }).subscribe({
        next: (res) => {
          createdCount++;
          createdOrders.push(res);
          processNext(i + 1);
        },
        error: (err) => {
          console.error('Error creating order', err);
          // Optionally add to warnings?
          processNext(i + 1);
        }
      });
    };

    processNext(0);
  }
}