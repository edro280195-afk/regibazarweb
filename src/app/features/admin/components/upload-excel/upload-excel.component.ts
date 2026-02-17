import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ExcelUploadResult, Client } from '../../../../shared/models/models';

@Component({
  selector: 'app-upload-excel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="upload-page">
      <h2>Cargar Pedidos 📦</h2>
      <p class="page-sub">Sube tu Excel del Live o captura a mano, tú decides bonita ✨</p>

      <div class="tab-switch">
        <button [class.active]="mode() === 'excel'" (click)="mode.set('excel')">📄 Subir Excel</button>
        <button [class.active]="mode() === 'manual'" (click)="mode.set('manual')">✏️ Captura manual</button>
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

    .file-preview { display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.8); border: 1px solid var(--border-soft); border-radius: 1rem; padding: 1rem 1.25rem; margin-top: 1rem; color: var(--text-medium); font-weight: 600; }

    /* FORMULARIO MANUAL */
    .manual-form { background: white; padding: 1.5rem; border-radius: 1.5rem; border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm); }
    .client-section { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: flex-start; }
    .field { flex: 1; min-width: 200px; }
    .field.short { flex: 0 0 160px; min-width: 160px; }
    .relative-container { position: relative; }
    
    label { display: block; color: var(--pink-600); font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }

    /* INPUTS GENERALES */
    input, select { width: 100%; padding: 0.75rem 1rem; background: var(--pink-50); border: 1.5px solid rgba(255, 157, 191, 0.2); border-radius: 0.85rem; color: var(--text-dark); font-size: 0.95rem; box-sizing: border-box; font-family: var(--font-body); transition: all 0.2s; &:focus { outline: none; border-color: var(--pink-400); background: white; box-shadow: 0 0 0 3px rgba(255,107,157,0.1); } }

    /* AUTOCOMPLETE */
    .suggestions-list { position: absolute; top: 100%; left: 0; right: 0; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border: 1px solid var(--pink-200); border-radius: 0.85rem; margin: 5px 0 0; padding: 0; list-style: none; max-height: 200px; overflow-y: auto; z-index: 10; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
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
    .item-card { display: flex; gap: 0.8rem; align-items: flex-end; background: linear-gradient(to right, #fffbfd, #fff); padding: 0.8rem; border-radius: 1rem; border: 1px solid rgba(255, 157, 191, 0.15); transition: transform 0.2s; &:hover { border-color: var(--pink-300); } }
    .field-group { display: flex; flex-direction: column; }
    .field-group label { font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.2rem; }
    .field-group.grow { flex: 1; }
    .row-split { display: flex; gap: 0.8rem; }
    .field-group.small { width: 70px; }
    .field-group.medium { width: 100px; }
    .item-card input { background: white; border-color: #eee; padding: 0.5rem 0.8rem; font-size: 0.9rem; &:focus { border-color: var(--pink-400); } }
    .btn-add { padding: 0.4rem 1rem; background: rgba(255,107,157,0.1); border: 1px solid var(--pink-300); border-radius: 2rem; color: var(--pink-600); cursor: pointer; font-weight: 700; font-size: 0.85rem; transition: all 0.2s; &:hover { background: var(--pink-500); color: white; } }
    .btn-remove { width: 36px; height: 36px; border-radius: 50%; background: white; border: 1px solid #ffd6d6; color: #ff6b6b; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; &:hover { background: #ff6b6b; color: white; border-color: #ff6b6b; transform: rotate(90deg); } }
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
      background: linear-gradient(135deg, #fffbfd, #fef4ff);
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
      background: rgba(255,255,255,0.85); border-radius: 10px; padding: 8px 10px;
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
      background: linear-gradient(to right, #fffbfd, #fff); padding: 1rem;
      border-radius: 1rem; border: 1.5px solid rgba(255, 157, 191, 0.15);
      h4 { margin: 0 0 0.75rem; font-family: var(--font-display); font-size: 1rem; color: var(--text-dark); }
    }
    .single-item-form {
      display: flex; flex-direction: column; gap: 0.6rem;
    }
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
    .order-card { background: rgba(255,255,255,0.8); border: 1px solid var(--border-soft); border-radius: 1rem; padding: 1rem; margin-bottom: 0.75rem; box-shadow: var(--shadow-sm); transition: transform 0.2s; &:hover { transform: translateY(-2px); } }
    .order-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; strong { color: var(--text-dark); } .total { color: var(--pink-500); font-weight: 800; } }
    .order-items { margin-bottom: 0.75rem; }
    .item-tag { display: inline-block; padding: 0.2rem 0.6rem; background: rgba(255,107,157,0.08); border-radius: 0.5rem; color: var(--pink-600); font-size: 0.78rem; font-weight: 600; margin: 0.15rem 0.25rem 0.15rem 0; }
    .order-link { display: flex; gap: 0.5rem; input { flex: 1; padding: 0.5rem 0.75rem; background: var(--pink-50); border: 1px solid var(--border-soft); border-radius: 0.6rem; color: var(--text-light); font-size: 0.8rem; } }
    .btn-copy { padding: 0.5rem 0.75rem; background: rgba(255,255,255,0.8); border: 1px solid var(--border-soft); border-radius: 0.6rem; color: var(--text-medium); cursor: pointer; font-size: 0.8rem; font-weight: 600; &:hover { background: white; border-color: var(--pink-300); } }
    .error { background: rgba(255,107,157,0.08); border: 1px solid rgba(255,107,157,0.2); color: var(--pink-600); padding: 0.75rem 1rem; border-radius: 0.75rem; margin-top: 1rem; }
    .spinner { width: 16px; height: 16px; border: 2.5px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class UploadExcelComponent implements OnInit {
  mode = signal<'excel' | 'manual'>('excel');
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

  constructor(private api: ApiService) { }

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
}