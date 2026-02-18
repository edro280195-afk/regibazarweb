import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ExcelUploadResult, Client } from '../../../../shared/models/models';

interface LiveOrderItem {
  productName: string;
  variant: string;
  quantity: number;
  unitPrice: number;
}
interface LiveOrder {
  id: string;
  clientName: string;
  items: LiveOrderItem[];
  orderType: 'Delivery' | 'PickUp';
  selected: boolean;
}
interface ParsedCapture {
  clientName: string;
  items: { variant: string; quantity: number }[];
  confidence: 'high' | 'medium' | 'low';
}

const NUMBER_WORDS: Record<string, number> = {
  'un': 1, 'una': 1, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
  'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10
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
        <button [class.active]="mode() === 'excel'" (click)="mode.set('excel')">📄 Subir Excel</button>
        <button [class.active]="mode() === 'manual'" (click)="mode.set('manual')">✏️ Captura manual</button>
        <button [class.active]="mode() === 'live'" (click)="mode.set('live')" class="live-tab">🔴 Modo Live</button>
      </div>

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

      @if (mode() === 'manual') {
        <div class="manual-form">
          <div class="manual-columns">
            <!-- ── Columna Izquierda: Formulario ── -->
            <div class="form-col">
              <div class="order-type-switch">
                <label>¿Cómo se entrega? 🚚</label>
                <div class="switch-container">
                  <button [class.active]="manualOrderType === 'Delivery'" (click)="manualOrderType = 'Delivery'">
                    🛵 A Domicilio
                  </button>
                  <button [class.active]="manualOrderType === 'PickUp'" (click)="manualOrderType = 'PickUp'">
                    🛍️ Pick Up (Local)
                  </button>
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

            <!-- ── Columna Derecha: Listado de artículos ── -->
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

      @if (mode() === 'live') {
        <div class="live-container">
          @if (livePhase() === 'setup') {
            <!-- ═══ SETUP PHASE ═══ -->
            <div class="live-setup">
              <div class="setup-header">
                <h3>🎬 Configura el producto del Live</h3>
                <p class="hint">Define el producto que vas a mostrar en cámara</p>
              </div>
              <div class="setup-form">
                <div class="setup-row">
                  <div class="field grow">
                    <label>Nombre del producto 🏷️</label>
                    <input type="text" [(ngModel)]="lpName" placeholder="Ej. Toallas, Cojines..." (keydown.enter)="setupProduct()">
                  </div>
                  <div class="field" style="width:130px">
                    <label>Precio 💲</label>
                    <input type="number" [(ngModel)]="lpPrice" placeholder="0" min="1">
                  </div>
                </div>
                @if (liveProduct()) {
                  <div class="variants-section">
                    <label>Variantes (colores, tallas...) 🎨</label>
                    <div class="variant-input-row">
                      <input type="text" [(ngModel)]="newVariant" placeholder="Ej. Negro, Azul, King..." (keydown.enter)="addVariant()">
                      <button class="btn-add-variant" (click)="addVariant()">+ Agregar</button>
                    </div>
                    <div class="chips">
                      @for (v of liveProduct()!.variants; track $index) {
                        <span class="chip">{{ v }} <button (click)="removeVariant($index)">×</button></span>
                      }
                    </div>
                  </div>
                }
                <button class="btn-start-live" (click)="startLive()" [disabled]="!lpName.trim() || lpPrice <= 0">
                  ▶️ Iniciar Live
                </button>
                @if (livePendingOrders().length > 0) {
                  <p class="pending-note">💡 Tienes {{ livePendingOrders().length }} pedidos pendientes del Live anterior</p>
                }
              </div>
            </div>
          }

          @if (livePhase() === 'capturing') {
            <!-- ═══ CAPTURING PHASE ═══ -->
            <div class="live-capturing">
              <!-- Product Bar -->
              <div class="product-bar">
                <div class="live-badge">🔴 EN VIVO</div>
                <div class="product-info">
                  <strong>{{ liveProduct()!.name }}</strong>
                  <span class="product-price">\${{ liveProduct()!.price | number:'1.0-0' }}</span>
                  @if (liveProduct()!.variants.length > 0) {
                    <div class="variant-tags">
                      @for (v of liveProduct()!.variants; track $index) {
                        <span class="vtag">{{ v }}</span>
                      }
                    </div>
                  }
                </div>
                <div class="product-actions">
                  <button class="btn-sm" (click)="changeProductKeepOrders()">🔄 Cambiar</button>
                  <button class="btn-sm finish" (click)="startReview()" [disabled]="livePendingOrders().length === 0">🏁 Finalizar</button>
                </div>
              </div>

              <div class="capture-layout">
                <!-- Capture Panel -->
                <div class="capture-panel">
                  <!-- Voice -->
                  @if (speechSupported()) {
                    <div class="voice-section">
                      <button class="mic-btn" [class.listening]="isListening()" (click)="toggleListening()">
                        <span class="mic-icon">🎙️</span>
                      </button>
                      <p class="voice-hint">
                        @if (isListening()) { <span class="listening-text">Escuchando...</span> }
                        @else { Toca para hablar }
                      </p>
                      @if (interimTranscript()) {
                        <div class="transcript-live">{{ interimTranscript() }}</div>
                      }
                    </div>
                  }

                  <!-- Text Input -->
                  <div class="text-capture">
                    <label>⌨️ O escribe aquí:</label>
                    <div class="text-input-row">
                      <input type="text" [(ngModel)]="textInput" placeholder='Ej: Juana Pérez, 2 negras y 1 azul' (keydown.enter)="onTextSubmit()">
                      <button class="btn-parse" (click)="onTextSubmit()" [disabled]="!textInput.trim()">Parsear</button>
                    </div>
                  </div>

                  <!-- Preview -->
                  @if (parsedPreview()) {
                    <div class="capture-preview" [class.low]="parsedPreview()!.confidence === 'low'" [class.medium]="parsedPreview()!.confidence === 'medium'">
                      <div class="preview-header">
                        <h4>Vista previa del pedido</h4>
                        <span class="confidence" [class]="parsedPreview()!.confidence">
                          @if (parsedPreview()!.confidence === 'high') { ✅ Seguro }
                          @else if (parsedPreview()!.confidence === 'medium') { ⚠️ Revisar }
                          @else { ❓ Verificar }
                        </span>
                      </div>
                      <p class="preview-client">👤 {{ parsedPreview()!.clientName || '(sin nombre)' }}</p>
                      <div class="preview-items">
                        @for (it of parsedPreview()!.items; track $index) {
                          <div class="preview-item">
                            <span>{{ it.quantity }}× {{ liveProduct()!.name }} {{ it.variant }}</span>
                            <span class="preview-subtotal">\${{ it.quantity * liveProduct()!.price | number:'1.0-0' }}</span>
                          </div>
                        }
                      </div>
                      <div class="preview-actions">
                        <button class="btn-confirm" (click)="confirmCapture()" [disabled]="!parsedPreview()!.clientName">✅ Confirmar</button>
                        <button class="btn-discard" (click)="discardCapture()">✖ Descartar</button>
                      </div>
                    </div>
                  }
                </div>

                <!-- Orders Feed -->
                <div class="orders-feed">
                  <div class="feed-header">
                    <h4>📋 Pedidos capturados</h4>
                    <span class="feed-stats">{{ liveTotalOrders() }} pedidos | \${{ liveTotalAmount() | number:'1.0-0' }}</span>
                  </div>
                  <div class="feed-scroll">
                    @for (order of livePendingOrders(); track order.id) {
                      <div class="feed-order">
                        <div class="feed-order-header">
                          <strong>{{ order.clientName }}</strong>
                          <div class="feed-order-actions">
                            <span class="feed-total">\${{ getOrderTotal(order) | number:'1.0-0' }}</span>
                            <button class="btn-remove-mini" (click)="removeLiveOrder(order.id)" title="Eliminar">×</button>
                          </div>
                        </div>
                        @for (it of order.items; track $index) {
                          <div class="feed-item">
                            <span>{{ it.quantity }}× {{ it.productName }}</span>
                            <button class="btn-x-tiny" (click)="removeLiveItem(order.id, $index)">×</button>
                          </div>
                        }
                      </div>
                    } @empty {
                      <div class="feed-empty">
                        <span>🎤</span>
                        <p>Esperando pedidos...</p>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
          }

          @if (livePhase() === 'review') {
            <!-- ═══ REVIEW PHASE ═══ -->
            <div class="live-review">
              <div class="review-header">
                <h3>🏁 Revisión Final del Live</h3>
                <button class="btn-sm" (click)="backToCapturing()">← Volver a capturar</button>
              </div>
              <div class="review-orders">
                @for (order of livePendingOrders(); track order.id) {
                  <div class="review-card" [class.deselected]="!order.selected">
                    <div class="review-card-top">
                      <label class="review-check">
                        <input type="checkbox" [(ngModel)]="order.selected">
                        <strong>{{ order.clientName }}</strong>
                      </label>
                      <span class="review-total">\${{ getOrderTotal(order) | number:'1.2-2' }}</span>
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
              }

              <button class="btn-pink wide" (click)="submitAllOrders()" [disabled]="liveCreating() || livePendingOrders().length === 0">
                💖 Crear {{ livePendingOrders().length }} pedidos
              </button>
            </div>
          }
        </div>
      }

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
            <h3>Enlaces para compartir por Messenger 💌</h3>
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
                  <input type="text" [value]="order.clientLink" readonly #linkInput>
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

    /* TABS */
    .tab-switch {
      display: flex; background: rgba(255,255,255,0.7);
      border: 1px solid var(--border-soft); border-radius: 1rem; padding: 4px;
      margin-bottom: 1.5rem; max-width: 380px;
      button {
        flex: 1; padding: 0.6rem; border: none; background: transparent;
        color: var(--text-light); border-radius: 0.8rem;
        cursor: pointer; font-size: 0.88rem; font-family: var(--font-body); font-weight: 600;
        transition: all 0.3s var(--ease-bounce);
        &.active {
          background: linear-gradient(135deg, var(--pink-400), var(--pink-500));
          color: white; box-shadow: 0 4px 12px rgba(255,107,157,0.3);
        }
      }
    }

    /* SWITCH DE TIPO DE PEDIDO */
    .order-type-switch { margin-bottom: 1.5rem; }
    .order-type-switch label { display: block; color: var(--pink-600); font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .switch-container { display: flex; gap: 10px; margin-top: 0.5rem; }
    .switch-container button {
        flex: 1; padding: 0.8rem; border: 2px solid var(--pink-100);
        background: white; border-radius: 1rem;
        color: var(--text-medium); font-weight: 600; cursor: pointer;
        transition: all 0.2s;
    }
    .switch-container button.active {
        border-color: var(--pink-500); background: var(--pink-50);
        color: var(--pink-600); box-shadow: 0 4px 10px rgba(255,107,157,0.2);
    }
    
    .type-badge {
        font-size: 0.75rem; background: #f0f0f0; color: #555;
        padding: 2px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px; font-weight: 600;
    }

    /* DROP ZONE */
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

    /* FORMULARIO MANUAL */
    .manual-form { background: var(--bg-card); padding: 1.5rem; border-radius: 1.5rem; border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm); }
    .client-section { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: flex-start; }
    .field { flex: 1; min-width: 200px; }
    .field.short { flex: 0 0 160px; min-width: 160px; }
    .relative-container { position: relative; }
    
    label { display: block; color: var(--pink-600); font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }

    /* INPUTS GENERALES */
    .field input, .field select { width: 100%; padding: 0.75rem 1rem; background: var(--bg-main); border: 1.5px solid rgba(255, 157, 191, 0.2); border-radius: 0.85rem; color: var(--text-dark); font-size: 0.95rem; box-sizing: border-box; font-family: var(--font-body); transition: all 0.2s; &:focus { outline: none; border-color: var(--pink-400); background: var(--bg-card); box-shadow: 0 0 0 3px rgba(255,107,157,0.1); } }

    /* AUTOCOMPLETE */
    .suggestions-list { position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); backdrop-filter: blur(10px); border: 1px solid var(--pink-200); border-radius: 0.85rem; margin: 5px 0 0; padding: 0; list-style: none; max-height: 200px; overflow-y: auto; z-index: 10; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
    .suggestions-list li { padding: 0.75rem 1rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; border-bottom: 1px solid rgba(0,0,0,0.03); }
    .suggestions-list li:last-child { border-bottom: none; }
    .suggestions-list li:hover { background: var(--pink-50); }
    .suggestions-list .name { font-weight: 600; color: var(--text-dark); }
    .suggestions-list .tag-frecuente { font-size: 0.75rem; background: #fff7e6; color: #fa8c16; padding: 2px 8px; border-radius: 10px; border: 1px solid #ffd591; }
    .suggestions-list .tag-nueva { font-size: 0.75rem; background: #f6ffed; color: #52c41a; padding: 2px 8px; border-radius: 10px; border: 1px solid #b7eb8f; }

    /* SELECT PERSONALIZADO */
    .select-wrapper { position: relative; }
    .select-wrapper select { appearance: none; cursor: pointer; }
    .select-wrapper select.highlight { border-color: #b37feb; background: #f9f0ff; color: #722ed1; font-weight: 700; animation: pulse 1s ease; }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(179, 127, 235, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(179, 127, 235, 0); } 100% { box-shadow: 0 0 0 0 rgba(179, 127, 235, 0); } }
    .select-arrow { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: var(--pink-400); pointer-events: none; font-size: 0.8rem; }
    .detect-msg { font-size: 0.7rem; color: #722ed1; font-weight: 700; display: block; text-align: right; margin-top: 4px; }

    .items-header { display: flex; justify-content: space-between; align-items: center; margin: 0 0 1rem; border-bottom: 2px dashed var(--pink-100); padding-bottom: 0.5rem; h4 { color: var(--text-dark); margin: 0; font-family: var(--font-display); font-size: 1.1rem; } }
    .items-list { display: flex; flex-direction: column; gap: 0.8rem; margin-bottom: 1.5rem; }
    .item-card { display: flex; gap: 0.8rem; align-items: flex-end; background: var(--bg-card); padding: 0.8rem; border-radius: 1rem; border: 1px solid rgba(255, 157, 191, 0.15); transition: transform 0.2s; &:hover { border-color: var(--pink-300); } }
    .field-group { display: flex; flex-direction: column; }
    .field-group label { font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.2rem; }
    .field-group.grow { flex: 1; }
    .row-split { display: flex; gap: 0.8rem; }
    .field-group.small { width: 70px; }
    .field-group.medium { width: 100px; }
    .item-card input { background: var(--bg-main); color: var(--text-dark); border-color: var(--border-soft); padding: 0.5rem 0.8rem; font-size: 0.9rem; &:focus { border-color: var(--pink-400); background: var(--bg-card); } }
    .btn-add { padding: 0.4rem 1rem; background: rgba(255,107,157,0.1); border: 1px solid var(--pink-300); border-radius: 2rem; color: var(--pink-600); cursor: pointer; font-weight: 700; font-size: 0.85rem; transition: all 0.2s; &:hover { background: var(--pink-500); color: white; } }
    .btn-remove { width: 36px; height: 36px; border-radius: 50%; background: var(--bg-card); border: 1px solid #ffd6d6; color: #ff6b6b; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; &:hover { background: #ff6b6b; color: white; border-color: #ff6b6b; transform: rotate(90deg); } }
    .btn-pink { padding: 0.8rem 1.5rem; width: 100%; background: linear-gradient(135deg, var(--pink-400), var(--pink-500)); color: white; border: none; border-radius: 1rem; cursor: pointer; font-weight: 700; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 4px 15px rgba(255,107,157,0.3); transition: all 0.3s var(--ease-bounce); &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255,107,157,0.4); } &:disabled { opacity: 0.6; } }

    /* TWO-COLUMN MANUAL LAYOUT */
    .manual-columns {
      display: flex; gap: 1.5rem; align-items: flex-start;
    }
    .form-col {
      flex: 1; min-width: 0;
      display: flex; flex-direction: column; gap: 1rem;
    }
    .items-col {
      flex: 0 0 360px; min-width: 0;
      display: flex; flex-direction: column;
      background: var(--bg-card);
      border: 1.5px solid rgba(255, 157, 191, 0.2);
      border-radius: 1.25rem; padding: 1rem;
      max-height: 520px;
    }
    .items-col-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 0.75rem; padding-bottom: 0.5rem;
      border-bottom: 2px dashed var(--pink-100);
      h4 { margin: 0; font-family: var(--font-display); font-size: 1rem; color: var(--text-dark); }
    }
    .item-count {
      background: var(--pink-400); color: white; font-size: 0.75rem; font-weight: 800;
      width: 24px; height: 24px; border-radius: 50%; display: flex;
      align-items: center; justify-content: center;
    }
    .items-scroll {
      flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;
      min-height: 80px;
      scrollbar-width: thin; scrollbar-color: var(--pink-200) transparent;
      &::-webkit-scrollbar { width: 4px; }
      &::-webkit-scrollbar-thumb { background: var(--pink-200); border-radius: 4px; }
    }
    .item-row {
      display: flex; align-items: center; gap: 8px;
      background: var(--bg-main); border-radius: 10px; padding: 8px 10px;
      border: 1px solid rgba(255,157,191,0.12);
      transition: all 0.15s ease;
      &:hover { border-color: var(--pink-300); box-shadow: 0 2px 8px rgba(255,107,157,0.08); }
    }
    .item-qty { font-weight: 800; color: var(--pink-400); font-size: 0.78rem; min-width: 28px; }
    .item-name { flex: 1; font-size: 0.82rem; color: var(--text-dark); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .item-price { font-size: 0.78rem; color: var(--text-medium); font-weight: 700; white-space: nowrap; }
    .btn-remove-mini {
      width: 24px; height: 24px; border-radius: 50%; border: 1px solid #ffd6d6;
      background: white; color: #ffaaaa; font-size: 1rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center; line-height: 1;
      transition: all 0.2s; flex-shrink: 0;
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
      padding: 10px 12px; background: var(--pink-50); border-radius: 10px;
      margin: 0.75rem 0 0.5rem;
      span:first-child { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    }
    .total-value { font-size: 1.2rem; font-weight: 800; color: var(--pink-600); }

    /* ADD ITEM SECTION */
    .add-item-section {
      background: var(--bg-main); padding: 1rem;
      border-radius: 1rem; border: 1.5px solid rgba(255, 157, 191, 0.15);
      h4 { margin: 0 0 0.75rem; font-family: var(--font-display); font-size: 1rem; color: var(--text-dark); }
    }
    .single-item-form {
      display: flex; flex-direction: column; gap: 0.6rem;
    }
    .single-item-form input {
      width: 100%; padding: 0.6rem 0.8rem; background: var(--bg-card);
      border: 1.5px solid rgba(255, 157, 191, 0.2); border-radius: 0.85rem;
      color: var(--text-dark); font-size: 0.9rem; box-sizing: border-box;
      font-family: var(--font-body); transition: all 0.2s;
      &:focus { outline: none; border-color: var(--pink-400); background: var(--bg-card); box-shadow: 0 0 0 3px rgba(255,107,157,0.1); }
    }
    .single-item-form input.qty { width: 70px; text-align: center; }
    .single-item-form input.price { width: 100px; }
    .btn-add-to-list {
      padding: 0.6rem 1rem; background: linear-gradient(135deg, var(--pink-400), var(--pink-500));
      border: none; border-radius: 0.8rem; color: white; font-weight: 700; font-size: 0.9rem;
      cursor: pointer; transition: all 0.2s; box-shadow: 0 3px 10px rgba(255,107,157,0.25);
      &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(255,107,157,0.35); }
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }

    @media (max-width: 768px) {
      .manual-columns { flex-direction: column; }
      .items-col { flex: none; width: 100%; max-height: 300px; }
    }
    
    /* RESULTADOS */
    .results { margin-top: 2rem; }
    .result-summary { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
    .badge { padding: 0.4rem 1rem; border-radius: 2rem; font-size: 0.85rem; font-weight: 700; &.pink { background: rgba(255,157,191,0.15); color: var(--pink-600); } &.lavender { background: rgba(186,156,230,0.15); color: #8B5CF6; } }
    .warnings { background: rgba(255,200,100,0.1); border: 1px solid rgba(255,200,100,0.25); border-radius: 0.75rem; padding: 1rem; margin-bottom: 1rem; h4 { color: #D97706; margin: 0 0 0.5rem; font-size: 0.9rem; } p { color: #92400E; margin: 0.25rem 0; font-size: 0.8rem; } }
    .orders-list h3 { font-family: var(--font-display); color: var(--text-dark); margin: 0 0 1rem; }
    .order-card { background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: 1rem; padding: 1rem; margin-bottom: 0.75rem; box-shadow: var(--shadow-sm); transition: transform 0.2s; &:hover { transform: translateY(-2px); } }
    .order-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; strong { color: var(--text-dark); } .total { color: var(--pink-500); font-weight: 800; } }
    .order-items { margin-bottom: 0.75rem; }
    .item-tag { display: inline-block; padding: 0.2rem 0.6rem; background: rgba(255,107,157,0.08); border-radius: 0.5rem; color: var(--pink-600); font-size: 0.78rem; font-weight: 600; margin: 0.15rem 0.25rem 0.15rem 0; }
    .order-link { display: flex; gap: 0.5rem; input { flex: 1; padding: 0.5rem 0.75rem; background: var(--pink-50); border: 1px solid var(--border-soft); border-radius: 0.6rem; color: var(--text-light); font-size: 0.8rem; } }
    .btn-copy { padding: 0.5rem 0.75rem; background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: 0.6rem; color: var(--text-medium); cursor: pointer; font-size: 0.8rem; font-weight: 600; &:hover { background: var(--bg-main); border-color: var(--pink-300); } }
    .error { background: rgba(255,107,157,0.08); border: 1px solid rgba(255,107,157,0.2); color: var(--pink-600); padding: 0.75rem 1rem; border-radius: 0.75rem; margin-top: 1rem; }
    .spinner { width: 16px; height: 16px; border: 2.5px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ═══ LIVE MODE ═══ */
    .live-tab.active { background: linear-gradient(135deg, #ef4444, #f97316) !important; }

    .live-container { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

    /* SETUP */
    .live-setup { background: var(--bg-card); padding: 1.5rem; border-radius: 1.5rem; border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm); }
    .setup-header { margin-bottom: 1.5rem; h3 { font-family: var(--font-display); color: var(--text-dark); margin: 0; } .hint { color: var(--text-muted); font-size: 0.85rem; margin: 0.25rem 0 0; } }
    .setup-row { display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .field.grow { flex: 1; min-width: 200px; }
    .variants-section { margin-bottom: 1rem; }
    .variant-input-row { display: flex; gap: 0.5rem; margin-top: 0.4rem; }
    .btn-add-variant { padding: 0.6rem 1rem; background: var(--pink-100); color: var(--pink-600); border: none; border-radius: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s; &:hover { background: var(--pink-200); } }
    .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.6rem; }
    .chip { display: inline-flex; align-items: center; gap: 0.3rem; background: linear-gradient(135deg, var(--pink-50), var(--pink-100)); border: 1px solid var(--pink-200); padding: 0.35rem 0.75rem; border-radius: 2rem; font-size: 0.85rem; font-weight: 600; color: var(--pink-600); button { background: none; border: none; color: var(--pink-400); cursor: pointer; font-size: 1rem; padding: 0; line-height: 1; &:hover { color: #ef4444; } } }
    .btn-start-live { width: 100%; padding: 1rem; background: linear-gradient(135deg, #ef4444, #f97316); color: white; border: none; border-radius: 1rem; font-weight: 800; font-size: 1.1rem; cursor: pointer; box-shadow: 0 4px 15px rgba(239,68,68,0.3); transition: all 0.3s var(--ease-bounce); &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(239,68,68,0.4); } &:disabled { opacity: 0.5; cursor: not-allowed; } }
    .pending-note { color: #d97706; font-size: 0.85rem; font-weight: 600; margin: 0.75rem 0 0; }

    /* CAPTURING */
    .product-bar { display: flex; align-items: center; gap: 1rem; background: var(--bg-card); padding: 0.75rem 1.25rem; border-radius: 1rem; border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm); margin-bottom: 1rem; flex-wrap: wrap; }
    .live-badge { background: var(--color-danger); color: white; font-size: 0.7rem; font-weight: 800; padding: 0.3rem 0.7rem; border-radius: 2rem; animation: livePulse 1.5s ease-in-out infinite; white-space: nowrap; }
    @keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
    .product-info { flex: 1; display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; strong { color: var(--text-dark); font-size: 1rem; } }
    .product-price { background: var(--color-success-bg); color: var(--color-success); font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 0.5rem; font-size: 0.85rem; }
    .variant-tags { display: flex; gap: 0.3rem; flex-wrap: wrap; }
    .vtag { background: var(--pink-50); color: var(--pink-500); padding: 0.15rem 0.5rem; border-radius: 1rem; font-size: 0.72rem; font-weight: 700; }
    .product-actions { display: flex; gap: 0.5rem; }
    .btn-sm { padding: 0.4rem 0.8rem; border: 1px solid var(--border-soft); background: white; border-radius: 0.6rem; font-size: 0.78rem; font-weight: 700; cursor: pointer; color: var(--text-medium); transition: all 0.2s; &:hover { border-color: var(--pink-300); color: var(--pink-500); } &:disabled { opacity: 0.4; cursor: not-allowed; } }
    .btn-sm.finish { border-color: #22c55e; color: #16a34a; &:hover { background: #f0fdf4; } }

    .capture-layout { display: flex; gap: 1.25rem; align-items: flex-start; }
    .capture-panel { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }

    /* Mic */
    .voice-section { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 1.5rem; background: var(--bg-card); border-radius: 1.25rem; border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm); }
    .mic-btn { width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--pink-200); background: linear-gradient(135deg, var(--bg-main), var(--bg-card)); cursor: pointer; font-size: 2rem; display: flex; align-items: center; justify-content: center; transition: all 0.3s var(--ease-bounce); &:hover { border-color: var(--pink-400); transform: scale(1.08); } }
    .mic-btn.listening { border-color: var(--color-danger); background: var(--color-danger-bg); animation: heartbeat 1s ease-in-out infinite; box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
    @keyframes heartbeat { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 50% { box-shadow: 0 0 0 15px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }
    .voice-hint { font-size: 0.85rem; color: var(--text-muted); font-weight: 600; margin: 0; }
    .listening-text { color: var(--color-danger); animation: livePulse 1s ease-in-out infinite; }
    .transcript-live { background: var(--color-warning-bg); border: 1px solid var(--color-warning); border-radius: 0.75rem; padding: 0.6rem 1rem; font-size: 0.9rem; color: var(--text-dark); font-style: italic; width: 100%; text-align: center; }

    /* Text capture */
    .text-capture { background: var(--bg-card); padding: 1rem; border-radius: 1.25rem; border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm); label { margin-bottom: 0.4rem; } }
    .text-input-row { display: flex; gap: 0.5rem; }
    .text-input-row input { flex: 1; }
    .btn-parse { padding: 0.6rem 1rem; background: var(--pink-100); color: var(--pink-600); border: none; border-radius: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap; &:hover { background: var(--pink-200); } &:disabled { opacity: 0.4; } }

    /* Preview */
    .capture-preview { background: var(--bg-card); padding: 1.25rem; border-radius: 1.25rem; border: 2px solid var(--color-success); box-shadow: var(--shadow-sm); animation: fadeIn 0.3s ease-out; &.medium { border-color: var(--color-warning); } &.low { border-color: var(--color-danger); } }
    .preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; h4 { margin: 0; font-family: var(--font-display); color: var(--text-dark); font-size: 0.95rem; } }
    .confidence { font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 1rem; &.high { background: var(--color-success-bg); color: var(--color-success); } &.medium { background: var(--color-warning-bg); color: var(--color-warning); } &.low { background: var(--color-danger-bg); color: var(--color-danger); } }
    .preview-client { font-weight: 700; color: var(--text-dark); font-size: 1rem; margin: 0.5rem 0; }
    .preview-items { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.75rem; }
    .preview-item { display: flex; justify-content: space-between; padding: 0.4rem 0.6rem; background: var(--bg-main); border-radius: 0.5rem; font-size: 0.88rem; }
    .preview-subtotal { font-weight: 700; color: var(--pink-500); }
    .preview-actions { display: flex; gap: 0.5rem; }
    .btn-confirm { flex: 1; padding: 0.6rem; background: linear-gradient(135deg, var(--color-success), var(--color-success)); color: white; border: none; border-radius: 0.7rem; font-weight: 700; cursor: pointer; transition: all 0.2s; &:hover { transform: translateY(-1px); } &:disabled { opacity: 0.5; } }
    .btn-discard { padding: 0.6rem 1rem; background: var(--bg-card); border: 1px solid var(--color-danger-bg); color: var(--color-danger); border-radius: 0.7rem; font-weight: 700; cursor: pointer; &:hover { background: var(--color-danger-bg); } }

    /* Feed */
    .orders-feed { flex: 0 0 340px; min-width: 0; background: linear-gradient(135deg, var(--bg-main), var(--bg-card)); border: 1.5px solid rgba(255,157,191,0.2); border-radius: 1.25rem; padding: 1rem; max-height: 550px; display: flex; flex-direction: column; }
    .feed-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 2px dashed var(--pink-100); h4 { margin: 0; font-family: var(--font-display); font-size: 0.95rem; color: var(--text-dark); } }
    .feed-stats { font-size: 0.72rem; font-weight: 700; color: var(--pink-500); background: var(--pink-50); padding: 0.2rem 0.6rem; border-radius: 1rem; }
    .feed-scroll { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; scrollbar-width: thin; scrollbar-color: var(--pink-200) transparent; }
    .feed-order { background: var(--bg-card); border-radius: 0.75rem; padding: 0.6rem 0.8rem; border: 1px solid rgba(255,157,191,0.12); animation: fadeIn 0.3s ease-out; }
    .feed-order-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; strong { font-size: 0.88rem; color: var(--text-dark); } }
    .feed-order-actions { display: flex; align-items: center; gap: 0.4rem; }
    .feed-total { font-size: 0.78rem; font-weight: 800; color: var(--pink-500); }
    .feed-item { display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: var(--text-medium); padding: 0.15rem 0; }
    .btn-x-tiny { width: 18px; height: 18px; border-radius: 50%; border: 1px solid #ffd6d6; background: white; color: #ffaaaa; font-size: 0.7rem; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; &:hover { background: #ff6b6b; color: white; } }
    .feed-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; padding: 2rem 0; span { font-size: 2.5rem; opacity: 0.3; } p { color: #ccc; font-weight: 600; font-size: 0.85rem; margin: 0; } }

    /* REVIEW */
    .live-review { animation: fadeIn 0.3s ease-out; }
    .review-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; h3 { font-family: var(--font-display); color: var(--text-dark); margin: 0; } }
    .review-orders { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
    .review-card { background: var(--bg-card); padding: 1.25rem; border-radius: 1.25rem; border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm); transition: all 0.2s; &.deselected { opacity: 0.45; } }
    .review-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .review-check { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; input { width: 18px; height: 18px; accent-color: var(--pink-400); } strong { font-size: 1rem; color: var(--text-dark); } }
    .review-total { font-size: 1.1rem; font-weight: 800; color: var(--pink-500); }
    .review-items { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.75rem; }
    .review-item-tag { background: var(--pink-50); padding: 0.25rem 0.6rem; border-radius: 0.5rem; font-size: 0.78rem; font-weight: 600; color: var(--pink-600); }
    .review-type { display: flex; gap: 0.5rem; button { flex: 1; padding: 0.5rem; border: 2px solid var(--pink-100); background: var(--bg-main); border-radius: 0.6rem; font-weight: 600; font-size: 0.85rem; cursor: pointer; color: var(--text-medium); transition: all 0.2s; &.active { border-color: var(--pink-500); background: var(--pink-50); color: var(--pink-600); } } }
    .create-progress { display: flex; align-items: center; gap: 0.5rem; justify-content: center; padding: 0.75rem; color: var(--pink-500); font-weight: 700; font-size: 0.9rem; }
    .wide { width: 100%; }

    @media (max-width: 768px) {
      .capture-layout { flex-direction: column; }
      .orders-feed { flex: none; width: 100%; max-height: 300px; }
      .product-bar { flex-direction: column; text-align: center; }
      .product-actions { width: 100%; justify-content: center; }
      .mic-btn { width: 70px; height: 70px; font-size: 1.8rem; }
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
  manualOrderType = 'Delivery'; // Default: Domicilio

  manualItems: { productName: string; quantity: number; unitPrice: number }[] = [];

  // Current item being entered
  currentItem = { productName: '', quantity: 1, unitPrice: 0 };

  // LOGICA DE AUTOCOMPLETE Y CLIENTES 💅
  clients = signal<any[]>([]); // Lista completa
  filteredClients = signal<any[]>([]); // Lista filtrada
  showSuggestions = signal(false);
  autoDetected = signal(false);

  // ═══ LIVE MODE STATE ═══
  livePhase = signal<'setup' | 'capturing' | 'review'>('setup');
  liveProduct = signal<{ name: string; price: number; variants: string[] } | null>(null);
  livePendingOrders = signal<LiveOrder[]>([]);
  isListening = signal(false);
  interimTranscript = signal('');
  finalTranscript = signal('');
  parsedPreview = signal<ParsedCapture | null>(null);
  speechSupported = signal(false);
  liveCreating = signal(false);
  liveCreateProgress = signal('');
  liveResults = signal<any[] | null>(null);

  // Live form fields
  lpName = ''; lpPrice: number = 0; newVariant = ''; textInput = '';

  liveTotalOrders = computed(() => this.livePendingOrders().length);
  liveTotalAmount = computed(() => this.livePendingOrders().reduce((s, o) => s + o.items.reduce((si, i) => si + i.quantity * i.unitPrice, 0), 0));

  private recognition: any;
  private silenceTimeout: any;

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
      next: (data) => {
        this.clients.set(data);
      },
      error: (err) => console.error('Error cargando clientas', err)
    });
  }

  // 1. Filtrado en tiempo real mientras escribes
  onSearchClient(): void {
    const term = this.manualClient.toLowerCase().trim();
    if (!term) {
      this.filteredClients.set([]);
      this.showSuggestions.set(false);
      this.autoDetected.set(false);
      return;
    }

    const filtered = this.clients().filter(c => c.name.toLowerCase().includes(term));
    this.filteredClients.set(filtered);
    this.showSuggestions.set(true);

    // Si no selecciona de la lista, reseteamos la detección
    this.autoDetected.set(false);
  }

  // 2. Selección mágica ✨
  selectClient(client: any): void {
    this.manualClient = client.name;
    this.showSuggestions.set(false);

    // REGLA DE NEGOCIO: Si tiene 2 o más pedidos = Frecuente
    const count = client.ordersCount || 0;

    if (count >= 2) {
      this.manualClientType = 'Frecuente';
    } else {
      this.manualClientType = 'Nueva';
    }

    this.autoDetected.set(true); // Activa el brillo morado en el select
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(true);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(false);
    const file = e.dataTransfer?.files[0];
    if (file) this.selectedFile.set(file);
  }

  onFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) this.selectedFile.set(input.files[0]);
  }

  uploadExcel(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.uploading.set(true);
    this.error.set('');
    this.result.set(null);

    this.api.uploadExcel(file).subscribe({
      next: (res) => {
        this.result.set(res);
        this.uploading.set(false);
        this.selectedFile.set(null);
      },
      error: (err) => {
        const msg = err.error?.message || err.message || 'Error al procesar';
        this.error.set(msg);
        this.uploading.set(false);
      }
    });
  }

  addItem(): void {
    this.manualItems.push({ productName: '', quantity: 1, unitPrice: 0 });
  }

  addCurrentItem(): void {
    if (!this.currentItem.productName?.trim() || this.currentItem.unitPrice <= 0) return;
    this.manualItems.push({ ...this.currentItem });
    this.currentItem = { productName: '', quantity: 1, unitPrice: 0 };
    // Focus back to product name
    setTimeout(() => {
      const el = document.querySelector('.single-item-form input[type="text"]') as HTMLInputElement;
      el?.focus();
    }, 50);
  }

  focusManualField(field: string): void {
    const selector = field === 'qty' ? '.single-item-form .qty' : '.single-item-form .price';
    const el = document.querySelector(selector) as HTMLInputElement;
    el?.focus();
  }

  getManualTotal(): number {
    return this.manualItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }

  removeItem(i: number): void {
    this.manualItems.splice(i, 1);
  }

  createManual(): void {
    // 1. VALIDACIÓN DE CLIENTE
    if (!this.manualClient.trim()) {
      this.error.set('¡Falta el nombre de la clienta, bonita! 🙅‍♀️');
      return;
    }

    // 2. FILTRADO DE ÍTEMS VACÍOS Y VALIDACIÓN DE DATOS
    const validItems = [];

    for (const item of this.manualItems) {
      // Ignorar filas totalmente vacías (sin nombre y con valores por defecto)
      if (!item.productName.trim() && item.quantity === 1 && item.unitPrice === 0) {
        continue;
      }

      // Validar Nombre
      if (!item.productName.trim()) {
        this.error.set('Ups, un artículo no tiene nombre 😿');
        return;
      }

      // Validar Cantidad
      if (item.quantity <= 0) {
        this.error.set(`La cantidad de "${item.productName}" no puede ser 0 🔢`);
        return;
      }

      // Validar Precio
      if (item.unitPrice < 0) { // Se permite 0 si es regalo, pero no negativo
        this.error.set(`El precio de "${item.productName}" no es válido 💲`);
        return;
      }

      validItems.push(item);
    }

    // 3. VALIDACIÓN FINAL: ¿Hay algo que guardar?
    if (validItems.length === 0) {
      this.error.set('Agrega al menos un artículo válido 🛍️');
      this.uploading.set(false);
      return;
    }

    this.uploading.set(true);
    this.error.set('');

    const req: any = {
      clientName: this.manualClient,
      clientType: this.manualClientType,
      orderType: this.manualOrderType, // Mandamos 'Delivery' o 'PickUp'
      items: validItems
    };

    this.api.createManualOrder(req).subscribe({
      next: (order) => {
        this.result.set({
          ordersCreated: 1,
          clientsCreated: 0,
          orders: [order],
          warnings: []
        });
        this.uploading.set(false);
        this.manualClient = '';
        this.manualClientType = '';
        this.manualOrderType = 'Delivery'; // Reset al default
        this.autoDetected.set(false);
        this.manualItems = [];
        this.currentItem = { productName: '', quantity: 1, unitPrice: 0 };
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al crear pedido manual');
        this.uploading.set(false);
      }
    });
  }

  copyLink(input: HTMLInputElement): void {
    navigator.clipboard.writeText(input.value);
  }

  ngOnDestroy(): void {
    this.stopListening();
  }

  // ═══ LIVE: PRODUCT SETUP ═══
  addVariant(): void {
    const v = this.newVariant.trim();
    if (!v) return;
    const p = this.liveProduct();
    if (p) { p.variants.push(v); this.liveProduct.set({ ...p }); }
    this.newVariant = '';
  }
  removeVariant(i: number): void {
    const p = this.liveProduct();
    if (p) { p.variants.splice(i, 1); this.liveProduct.set({ ...p }); }
  }
  setupProduct(): void {
    if (!this.lpName.trim() || this.lpPrice <= 0) return;
    this.liveProduct.set({ name: this.lpName.trim(), price: this.lpPrice, variants: [] });
  }
  startLive(): void {
    if (!this.liveProduct()) this.setupProduct();
    if (this.liveProduct()) this.livePhase.set('capturing');
  }
  changeProduct(): void {
    this.lpName = ''; this.lpPrice = 0; this.newVariant = '';
    this.liveProduct.set(null);
    this.livePhase.set('setup');
  }
  changeProductKeepOrders(): void {
    this.lpName = ''; this.lpPrice = 0; this.newVariant = '';
    this.liveProduct.set(null);
    this.livePhase.set('setup');
  }

  // ═══ LIVE: VOICE ═══
  toggleListening(): void {
    if (this.isListening()) this.stopListening(); else this.startListening();
  }
  startListening(): void {
    if (!this.recognition) return;
    this.interimTranscript.set(''); this.finalTranscript.set('');
    this.parsedPreview.set(null);
    this.isListening.set(true);
    this.recognition.onresult = (e: any) => {
      clearTimeout(this.silenceTimeout);
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      this.interimTranscript.set(interim);
      if (final) { this.finalTranscript.set(final); this.processTranscript(final); }
      this.silenceTimeout = setTimeout(() => this.recognition?.stop(), 3000);
    };
    this.recognition.onend = () => { this.isListening.set(false); clearTimeout(this.silenceTimeout); };
    this.recognition.onerror = () => { this.isListening.set(false); clearTimeout(this.silenceTimeout); };
    try { this.recognition.start(); } catch { this.isListening.set(false); }
  }
  stopListening(): void {
    clearTimeout(this.silenceTimeout);
    try { this.recognition?.stop(); } catch { }
    this.isListening.set(false);
  }

  // ═══ LIVE: TEXT INPUT ═══
  onTextSubmit(): void {
    const t = this.textInput.trim();
    if (!t) return;
    this.processTranscript(t);
    this.textInput = '';
  }

  // ═══ LIVE: PARSER ═══
  private processTranscript(text: string): void {
    const p = this.liveProduct();
    if (!p) return;
    const parsed = this.parseCapture(text, p.variants);
    this.parsedPreview.set(parsed);
  }

  parseCapture(text: string, variants: string[]): ParsedCapture {
    let clientName = '', itemsPart = '';
    const commaIdx = text.indexOf(',');
    if (commaIdx > 0) {
      clientName = text.substring(0, commaIdx).trim();
      itemsPart = text.substring(commaIdx + 1).trim();
    } else {
      // try to find where name ends by looking for a number or variant
      const words = text.split(/\s+/);
      let splitAt = words.length;
      for (let i = 0; i < words.length; i++) {
        const w = words[i].toLowerCase();
        if (/^\d+$/.test(w) || NUMBER_WORDS[w] || variants.some(v => normalizeForMatch(w) === normalizeForMatch(v))) {
          splitAt = i; break;
        }
      }
      clientName = words.slice(0, splitAt).join(' ');
      itemsPart = words.slice(splitAt).join(' ');
    }
    clientName = clientName.replace(/^\s*,|,\s*$/g, '').trim();

    // fuzzy match client name against existing clients
    const matchedClient = this.fuzzyMatchClient(clientName);
    if (matchedClient) clientName = matchedClient;

    const items: { variant: string; quantity: number }[] = [];
    if (!itemsPart) {
      items.push({ variant: '', quantity: 1 });
      return { clientName, items, confidence: 'low' };
    }

    const segments = itemsPart.split(/\s+y\s+|\s*&\s*/i);
    let confidence: 'high' | 'medium' | 'low' = 'high';

    for (const seg of segments) {
      const tokens = seg.trim().split(/\s+/);
      let qty = 1; let variantWord = '';
      for (const tok of tokens) {
        const num = this.parseNumber(tok);
        if (num !== null) { qty = num; }
        else { variantWord += (variantWord ? ' ' : '') + tok; }
      }
      const matchedVariant = variantWord ? this.matchVariant(variantWord, variants) : '';
      if (variantWord && !matchedVariant && variants.length > 0) confidence = 'medium';
      items.push({ variant: matchedVariant || variantWord, quantity: qty });
    }
    if (!clientName) confidence = 'low';
    return { clientName, items, confidence };
  }

  private parseNumber(word: string): number | null {
    if (/^\d+$/.test(word)) return parseInt(word, 10);
    const n = NUMBER_WORDS[word.toLowerCase()];
    return n !== undefined ? n : null;
  }

  private matchVariant(word: string, variants: string[]): string {
    const norm = normalizeForMatch(word);
    for (const v of variants) {
      if (normalizeForMatch(v) === norm) return v;
    }
    // partial match
    for (const v of variants) {
      if (normalizeForMatch(v).startsWith(norm) || norm.startsWith(normalizeForMatch(v))) return v;
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
    // partial
    for (const c of this.clients()) {
      const normC = (c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      if (normC.includes(normName) || normName.includes(normC)) return c.name;
    }
    return null;
  }

  // ═══ LIVE: CONFIRM / EDIT ═══
  confirmCapture(): void {
    const preview = this.parsedPreview();
    const product = this.liveProduct();
    if (!preview || !product || !preview.clientName) return;

    const newItems: LiveOrderItem[] = preview.items.map(i => ({
      productName: i.variant ? `${product.name} ${i.variant}` : product.name,
      variant: i.variant,
      quantity: i.quantity,
      unitPrice: product.price
    }));
    const clientKey = preview.clientName.toLowerCase().trim();
    const orders = [...this.livePendingOrders()];
    const existing = orders.find(o => o.clientName.toLowerCase().trim() === clientKey);
    if (existing) {
      existing.items.push(...newItems);
      this.livePendingOrders.set([...orders]);
    } else {
      orders.push({ id: crypto.randomUUID(), clientName: preview.clientName, items: newItems, orderType: 'Delivery', selected: true });
      this.livePendingOrders.set(orders);
    }
    this.parsedPreview.set(null); this.interimTranscript.set(''); this.finalTranscript.set('');
  }
  discardCapture(): void {
    this.parsedPreview.set(null); this.interimTranscript.set(''); this.finalTranscript.set('');
  }
  removeLiveOrder(id: string): void {
    this.livePendingOrders.update(o => o.filter(x => x.id !== id));
  }
  removeLiveItem(orderId: string, itemIdx: number): void {
    const orders = [...this.livePendingOrders()];
    const order = orders.find(o => o.id === orderId);
    if (order) { order.items.splice(itemIdx, 1); if (order.items.length === 0) { this.removeLiveOrder(orderId); return; } }
    this.livePendingOrders.set([...orders]);
  }
  getOrderTotal(o: LiveOrder): number {
    return o.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  }

  // ═══ LIVE: REVIEW & SUBMIT ═══
  startReview(): void { this.livePhase.set('review'); }
  backToCapturing(): void { this.livePhase.set('capturing'); }

  private getClientType(name: string): string {
    const c = this.clients().find(cl => cl.name?.toLowerCase().trim() === name.toLowerCase().trim());
    return c && (c.ordersCount || 0) >= 2 ? 'Frecuente' : 'Nueva';
  }

  async submitAllOrders(): Promise<void> {
    const orders = this.livePendingOrders().filter(o => o.selected);
    if (orders.length === 0) return;
    this.liveCreating.set(true);
    const results: any[] = [];
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      this.liveCreateProgress.set(`Creando ${i + 1} de ${orders.length}...`);
      try {
        const res = await this.api.createManualOrder({
          clientName: o.clientName,
          clientType: this.getClientType(o.clientName),
          orderType: o.orderType,
          items: o.items.map(it => ({ productName: it.productName, quantity: it.quantity, unitPrice: it.unitPrice }))
        }).toPromise();
        results.push(res);
      } catch (e) { console.error('Error creating order for', o.clientName, e); }
    }
    this.liveCreating.set(false);
    this.liveCreateProgress.set('');
    this.liveResults.set(results);
    this.result.set({ ordersCreated: results.length, clientsCreated: 0, orders: results, warnings: [] });
    this.livePendingOrders.set([]);
    this.livePhase.set('setup');
    this.liveProduct.set(null);
    this.mode.set('excel'); // go back to results view
  }

  resetLive(): void {
    this.livePhase.set('setup'); this.liveProduct.set(null);
    this.livePendingOrders.set([]); this.parsedPreview.set(null);
    this.interimTranscript.set(''); this.finalTranscript.set('');
    this.lpName = ''; this.lpPrice = 0; this.newVariant = ''; this.textInput = '';
    this.liveResults.set(null);
  }

  copyAllLinks(): void {
    const r = this.result();
    if (!r) return;
    const links = r.orders.map((o: any) => `${o.clientName}: ${o.clientLink}`).join('\n');
    navigator.clipboard.writeText(links);
  }
}