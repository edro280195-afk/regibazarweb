import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../../../core/services/api.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';
import { WhatsAppService } from '../../../../../core/services/whatsapp.service';
import { OrderSummary, OrderItem } from '../../../../../shared/models/models';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- ═══════════════ TOAST ═══════════════ -->
    @if (toastMessage()) {
      <div class="toast" [class.error]="toastIsError()">
        <span class="toast-icon">{{ toastIsError() ? '😿' : '✨' }}</span>
        <span>{{ toastMessage() }}</span>
      </div>
    }

    @if (loading()) {
      <div class="detail-page">
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Cargando pedido...</p>
        </div>
      </div>
    } @else if (!order()) {
      <div class="detail-page">
        <div class="empty-state">
          <span class="empty-icon">🔍</span>
          <h3>Pedido no encontrado</h3>
          <p>No pudimos encontrar el pedido solicitado</p>
          <button class="btn-back-main" (click)="goBack()">← Volver a Pedidos</button>
        </div>
      </div>
    } @else {
      <div class="detail-page fade-in">

        <!-- ═══════════════ TOP BAR ═══════════════ -->
        <div class="detail-top-bar">
          <button class="btn-back" (click)="goBack()">
            <span class="back-arrow">←</span>
            <span>Pedidos</span>
          </button>
          <div class="order-badge">
            <span class="order-id">#{{ order()!.id }}</span>
            <span class="status-pill" [attr.data-status]="order()!.status">
              {{ statusLabel(order()!.status) }}
            </span>
          </div>
        </div>

        <!-- ═══════════════ CLIENT HERO ═══════════════ -->
        <div class="client-hero">
          <div class="hero-avatar">{{ order()!.clientName.charAt(0) }}</div>
          <div class="hero-info">
            <h2>{{ order()!.clientName }}</h2>
            <div class="hero-meta">
              @if (order()!.clientType === 'Frecuente') {
                <span class="badge-vip">💎 Frecuente</span>
              } @else {
                <span class="badge-new">🌱 Nueva</span>
              }
              <span class="type-pill" [class.pickup]="order()!.orderType === 'PickUp'">
                {{ order()!.orderType === 'PickUp' ? '🛍️ Local' : '🛵 Envío' }}
              </span>
            </div>
          </div>
          <button class="btn-icon-action copy" (click)="copyLink(order()!.link)" title="Copiar link">📋</button>
        </div>

        <!-- ═══════════════ MAIN CONTENT GRID ═══════════════ -->
        <div class="detail-grid">

          <!-- ── LEFT COLUMN: Info & Status ── -->
          <div class="detail-col">

            <!-- CLIENT DATA -->
            <section class="detail-card">
              <h3 class="section-title">👤 Datos del Cliente</h3>
              <div class="field-group">
                <div class="field">
                  <label>Nombre</label>
                  <input type="text" [(ngModel)]="editData.clientName" class="field-input"
                         (blur)="markDirty()">
                </div>
                <div class="field">
                  <label>Dirección</label>
                  <input type="text" [(ngModel)]="editData.clientAddress" class="field-input"
                         placeholder="Sin dirección" (blur)="markDirty()">
                </div>
                <div class="field">
                  <label>Teléfono</label>
                  <input type="text" [(ngModel)]="editData.clientPhone" class="field-input"
                         placeholder="Sin teléfono" (blur)="markDirty()">
                </div>
              </div>
            </section>

            <!-- DELIVERY TYPE -->
            <section class="detail-card">
              <h3 class="section-title">📦 Método de Entrega</h3>
              <div class="type-switch">
                <button [class.active]="editData.orderType === 'Delivery'" 
                        (click)="editData.orderType = 'Delivery'; markDirty()">
                  <span>🛵</span> Envío
                </button>
                <button [class.active]="editData.orderType === 'PickUp'" 
                        (click)="editData.orderType = 'PickUp'; markDirty()">
                  <span>🛍️</span> Local
                </button>
              </div>
              @if (editData.orderType === 'Delivery') {
                <div class="field" style="margin-top: 12px">
                  <label>Hora estipulada</label>
                  <input type="time" [(ngModel)]="editData.deliveryTime" class="field-input" (change)="markDirty()">
                </div>
              } @else {
                <div class="field" style="margin-top: 12px">
                  <label>Fecha de recolección</label>
                  <input type="date" [(ngModel)]="editData.pickupDate" class="field-input" (change)="markDirty()">
                </div>
                <div class="field" style="margin-top: 8px">
                  <label>Hora</label>
                  <input type="time" [(ngModel)]="editData.deliveryTime" class="field-input" (change)="markDirty()">
                </div>
              }
            </section>

            <!-- STATUS -->
            <section class="detail-card">
              <h3 class="section-title">🎀 Estatus</h3>
              <div class="status-pills">
                <button class="status-btn" [class.active]="editData.status === 'Pending'"   (click)="editData.status = 'Pending'; markDirty()">⏳ Pendiente</button>
                <button class="status-btn" [class.active]="editData.status === 'Delivered'" (click)="editData.status = 'Delivered'; markDirty()">💝 Entregado</button>
                <button class="status-btn" [class.active]="editData.status === 'Canceled'"  (click)="editData.status = 'Canceled'; markDirty()">🚫 Cancelado</button>
                <button class="status-btn" [class.active]="editData.status === 'Postponed'" (click)="editData.status = 'Postponed'; markDirty()">📅 Posponer</button>
              </div>

              @if (editData.status === 'Postponed') {
                <div class="postponed-fields">
                  <div class="field">
                    <label>📅 ¿Cuándo entregamos?</label>
                    <input type="datetime-local" [(ngModel)]="editData.postponedAt" class="field-input" (change)="markDirty()">
                  </div>
                  <div class="field">
                    <label>📝 Nota rápida</label>
                    <input type="text" [(ngModel)]="editData.postponedNote" placeholder="Ej. Cambio de horario" 
                           class="field-input" (blur)="markDirty()">
                  </div>
                </div>
              }
            </section>

            <!-- TAGS -->
            <section class="detail-card">
              <h3 class="section-title">🏷️ Etiquetas</h3>
              <div class="tags-selector">
                @for (tag of availableTags; track tag) {
                  <button class="tag-btn" [class.active]="editData.tags.includes(tag)" 
                          (click)="toggleTag(tag)">{{ tag }}</button>
                }
              </div>
            </section>

            <!-- WHATSAPP -->
            <section class="detail-card">
              <h3 class="section-title">📱 WhatsApp</h3>
              <div class="wa-buttons">
                <button class="btn-wa" (click)="sendWa('confirm')">✅ Confirmación</button>
                <button class="btn-wa" (click)="sendWa('onway')">🚗 En Camino</button>
                <button class="btn-wa" (click)="sendWa('payment')">💸 Cobro</button>
              </div>
            </section>
          </div>

          <!-- ── RIGHT COLUMN: Products ── -->
          <div class="detail-col">
            <section class="detail-card products-card">
              <div class="section-header-row">
                <h3 class="section-title">🛒 Productos</h3>
                <span class="items-count">{{ order()!.items.length }} artículo{{ order()!.items.length !== 1 ? 's' : '' }}</span>
              </div>

              <div class="items-list">
                @for (item of order()!.items; track item.id) {
                  <div class="product-row" [class.editing]="editingItemId() === item.id">
                    @if (editingItemId() === item.id) {
                      <!-- EDIT MODE -->
                      <div class="product-edit-form">
                        <input type="text" [(ngModel)]="itemEdit.productName" class="field-input" placeholder="Producto">
                        <div class="edit-row">
                          <div class="qty-stepper">
                            <button (click)="itemEdit.quantity = Math.max(1, itemEdit.quantity - 1)">−</button>
                            <input type="number" [(ngModel)]="itemEdit.quantity" min="1" class="field-input center">
                            <button (click)="itemEdit.quantity = itemEdit.quantity + 1">+</button>
                          </div>
                          <div class="price-wrap">
                            <span class="currency">$</span>
                            <input type="number" [(ngModel)]="itemEdit.unitPrice" min="0" class="field-input">
                          </div>
                        </div>
                        <div class="edit-actions">
                          <button class="btn-sm cancel" (click)="cancelItemEdit()">Cancelar</button>
                          <button class="btn-sm save" (click)="saveItemEdit(item)">💾 Guardar</button>
                        </div>
                      </div>
                    } @else {
                      <!-- VIEW MODE -->
                      <div class="product-info">
                        <span class="product-qty">{{ item.quantity }}×</span>
                        <span class="product-name">{{ item.productName }}</span>
                      </div>
                      <div class="product-actions">
                        <span class="product-price">$ {{ item.lineTotal | number:'1.2-2' }}</span>
                        <button class="btn-icon-mini" (click)="startItemEdit(item)" title="Editar">✏️</button>
                        <button class="btn-icon-mini danger" (click)="askDeleteItem(item)" title="Eliminar">🗑️</button>
                      </div>
                    }
                  </div>
                } @empty {
                  <div class="empty-items">
                    <p>No hay productos aún 🛍️</p>
                  </div>
                }
              </div>

              <!-- ADD NEW ITEM -->
              <div class="add-item-section">
                @if (showAddForm()) {
                  <div class="add-item-form">
                    <input type="text" [(ngModel)]="newItem.productName" class="field-input" 
                           placeholder="Nombre del producto" (keydown.enter)="focusField('newQty')">
                    <div class="edit-row">
                      <div class="qty-stepper">
                        <button (click)="newItem.quantity = Math.max(1, newItem.quantity - 1)">−</button>
                        <input type="number" [(ngModel)]="newItem.quantity" min="1" class="field-input center" 
                               #newQtyInput (keydown.enter)="focusField('newPrice')">
                        <button (click)="newItem.quantity = newItem.quantity + 1">+</button>
                      </div>
                      <div class="price-wrap">
                        <span class="currency">$</span>
                        <input type="number" [(ngModel)]="newItem.unitPrice" min="0" class="field-input" 
                               #newPriceInput (keydown.enter)="addItem()">
                      </div>
                    </div>
                    @if (newItem.productName && newItem.unitPrice > 0) {
                      <div class="preview-line">
                        <span>{{ newItem.quantity }}× {{ newItem.productName }}</span>
                        <span class="preview-total">$ {{ (newItem.quantity * newItem.unitPrice) | number:'1.2-2' }}</span>
                      </div>
                    }
                    <div class="edit-actions">
                      <button class="btn-sm cancel" (click)="showAddForm.set(false)">Cancelar</button>
                      <button class="btn-sm save" (click)="addItem()" 
                              [disabled]="!newItem.productName || newItem.unitPrice <= 0">✨ Agregar</button>
                    </div>
                  </div>
                } @else {
                  <button class="btn-add-product" (click)="showAddForm.set(true)">
                    <span>＋</span> Agregar producto
                  </button>
                }
              </div>

              <!-- TOTALS -->
              <div class="totals-section">
                <div class="total-row">
                  <span>Subtotal</span>
                  <span>$ {{ order()!.subtotal | number:'1.2-2' }}</span>
                </div>
                <div class="total-row">
                  <span>Envío</span>
                  <span>$ {{ order()!.shippingCost | number:'1.2-2' }}</span>
                </div>
                <div class="total-row grand">
                  <span>Total</span>
                  <span>$ {{ order()!.total | number:'1.2-2' }}</span>
                </div>
              </div>
            </section>
          </div>
        </div>

        <!-- ═══════════════ BOTTOM ACTION BAR ═══════════════ -->
        <div class="bottom-bar">
          <button class="btn-danger-outline" (click)="askDeleteOrder()">🗑️ Eliminar Pedido</button>
          <div class="bottom-right">
            <span class="grand-total">Total: <strong>$ {{ order()!.total | number:'1.2-2' }}</strong></span>
            <button class="btn-save-main" (click)="saveChanges()" [disabled]="!isDirty() || saving()">
              {{ saving() ? 'Guardando...' : '💾 Guardar cambios' }}
            </button>
          </div>
        </div>

      </div>
    }
  `,
  styles: [`
    /* ═══════════════════════════════════════════
       DETAIL PAGE — Coquette Theme Harmony
    ═══════════════════════════════════════════ */
    :host { display: block; }

    .detail-page {
      padding: 1rem 1.25rem 6rem;
      max-width: 1200px;
      margin: 0 auto;
      min-height: 80vh;
    }

    .fade-in { animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    /* ═════════ TOAST ═════════ */
    .toast {
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: var(--bg-overlay);
      backdrop-filter: blur(12px);
      border: 1.5px solid var(--pink-200);
      padding: 12px 24px; border-radius: 50px;
      display: flex; align-items: center; gap: 8px;
      z-index: 600; font-weight: 700; font-size: 0.9rem; color: var(--text-dark);
      box-shadow: 0 10px 30px rgba(255, 107, 157, 0.15);
      animation: toastSlide 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      &.error { border-color: #fca5a5; }
    }
    @keyframes toastSlide { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
    .toast-icon { font-size: 1.2rem; }

    /* ═════════ LOADING & EMPTY ═════════ */
    .loading-state, .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 400px; gap: 1rem; color: var(--text-muted);
    }
    .spinner {
      width: 40px; height: 40px; border-radius: 50%;
      border: 3px solid var(--pink-100); border-top-color: var(--pink-500);
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-icon { font-size: 3rem; }
    .empty-state h3 { color: var(--text-dark); font-family: var(--font-display); }
    .empty-state p { color: var(--text-medium); }
    .btn-back-main {
      background: var(--pink-50); border: 1.5px solid var(--pink-200); color: var(--pink-600);
      padding: 10px 20px; border-radius: 14px; font-weight: 700; cursor: pointer;
      font-family: var(--font-body); transition: all 0.2s;
      &:hover { background: var(--pink-100); transform: translateY(-1px); }
    }

    /* ═════════ TOP BAR ═════════ */
    .detail-top-bar {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.5rem;
    }
    .btn-back {
      display: flex; align-items: center; gap: 8px;
      background: var(--bg-card); border: 1.5px solid var(--border-soft);
      padding: 8px 16px; border-radius: 14px; cursor: pointer;
      color: var(--text-medium); font-weight: 700; font-size: 0.9rem;
      font-family: var(--font-body);
      transition: all 0.2s; backdrop-filter: blur(8px);
      &:hover { border-color: var(--pink-300); color: var(--pink-600); transform: translateX(-3px); }
    }
    .back-arrow { font-size: 1.1rem; }
    .order-badge { display: flex; align-items: center; gap: 10px; }
    .order-id {
      background: var(--bg-card); border: 1.5px solid var(--border-soft);
      padding: 6px 14px; border-radius: 12px; font-weight: 800;
      color: var(--text-dark); font-size: 0.9rem;
    }

    /* Status */
    .status-pill {
      font-size: 0.75rem; padding: 5px 12px; border-radius: 10px;
      font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px;
      background: var(--pink-50); color: var(--text-medium);
    }
    .status-pill[data-status="Pending"]   { background: #fffbeb; color: #d97706; }
    .status-pill[data-status="InRoute"]   { background: #eff6ff; color: #2563eb; }
    .status-pill[data-status="Delivered"] { background: #f0fdf4; color: #16a34a; }
    .status-pill[data-status="Canceled"]  { background: #fef2f2; color: #dc2626; }
    .status-pill[data-status="Postponed"] { background: #faf5ff; color: #9333ea; }

    /* ═════════ CLIENT HERO ═════════ */
    .client-hero {
      display: flex; align-items: center; gap: 1rem;
      background: var(--bg-card); backdrop-filter: blur(12px);
      border: 1px solid var(--border-soft);
      border-radius: 20px; padding: 1.25rem 1.5rem;
      box-shadow: var(--shadow-sm);
      margin-bottom: 1.5rem;
    }
    .hero-avatar {
      width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, var(--pink-400), var(--pink-600));
      color: white; display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1.4rem;
      box-shadow: 0 4px 12px rgba(255, 107, 157, 0.3);
    }
    .hero-info { flex: 1; }
    .hero-info h2 {
      margin: 0; font-family: var(--font-display); font-size: 1.5rem;
      color: var(--pink-600); line-height: 1.2;
    }
    .hero-meta { display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
    .badge-vip {
      font-size: 0.7rem; padding: 3px 10px; border-radius: 8px;
      background: linear-gradient(135deg, #fef3c7, #fde68a); color: #92400e; font-weight: 800;
    }
    .badge-new {
      font-size: 0.7rem; padding: 3px 10px; border-radius: 8px;
      background: #ecfdf5; color: #065f46; font-weight: 800;
    }
    .type-pill {
      font-size: 0.7rem; padding: 3px 10px; border-radius: 8px;
      background: #e0f2fe; color: #0284c7; font-weight: 800;
    }
    .type-pill.pickup { background: #f3e8ff; color: #9333ea; }
    .btn-icon-action {
      width: 42px; height: 42px; border-radius: 50%; border: 1.5px solid var(--border-soft);
      background: var(--bg-main); cursor: pointer; font-size: 1.1rem;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
      &:hover { border-color: var(--pink-300); background: var(--pink-50); transform: scale(1.05); }
    }

    /* ═════════ GRID LAYOUT ═════════ */
    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      align-items: start;
    }
    .detail-col { display: flex; flex-direction: column; gap: 1rem; }

    /* ═════════ CARD SECTIONS ═════════ */
    .detail-card {
      background: var(--bg-card); backdrop-filter: blur(12px);
      border: 1px solid var(--border-soft);
      border-radius: 20px; padding: 1.25rem;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s;
    }
    .section-title {
      font-size: 0.8rem; font-weight: 800; color: var(--pink-500);
      text-transform: uppercase; letter-spacing: 0.5px;
      margin: 0 0 1rem; padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border-soft);
    }
    .section-header-row {
      display: flex; justify-content: space-between; align-items: center;
    }
    .items-count {
      font-size: 0.8rem; color: var(--text-muted); font-weight: 700;
      background: var(--pink-50); padding: 3px 10px; border-radius: 8px;
    }

    /* ═════════ FORM FIELDS ═════════ */
    .field-group { display: flex; flex-direction: column; gap: 10px; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field label {
      font-size: 0.75rem; font-weight: 700; color: var(--text-medium);
      text-transform: uppercase; letter-spacing: 0.3px;
    }
    .field-input {
      width: 100%; border: 1.5px solid var(--border-soft); border-radius: 12px;
      padding: 10px 14px; font-family: var(--font-body); font-size: 0.9rem;
      outline: none; transition: all 0.2s;
      background: var(--bg-main); color: var(--text-dark);
      &:focus { border-color: var(--pink-400); box-shadow: 0 0 0 3px rgba(236,72,153,0.1); background: var(--bg-card); }
      &.center { text-align: center; }
    }

    /* Type Switch */
    .type-switch {
      display: flex; background: var(--bg-main); padding: 4px; border-radius: 14px;
      border: 1px solid var(--border-soft);
    }
    .type-switch button {
      flex: 1; border: none; background: transparent; padding: 10px; border-radius: 10px;
      font-weight: 700; color: var(--text-muted); cursor: pointer; transition: all 0.2s;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      font-size: 0.9rem; font-family: var(--font-body);
    }
    .type-switch button.active {
      background: var(--bg-card); color: var(--pink-600);
      box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid var(--border-soft);
    }

    /* Status Pills */
    .status-pills { display: flex; flex-wrap: wrap; gap: 6px; }
    .status-btn {
      flex: 1; min-width: 100px; white-space: nowrap;
      border: 1.5px solid var(--border-soft); background: var(--bg-main);
      color: var(--text-medium); padding: 10px 12px; border-radius: 12px;
      font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;
      display: flex; align-items: center; justify-content: center; gap: 4px;
      font-family: var(--font-body);
      &:hover { background: var(--pink-50); }
      &.active { background: var(--pink-100); border-color: var(--pink-400); color: var(--pink-600); }
    }

    .postponed-fields { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }

    /* Tags */
    .tags-selector { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag-btn {
      padding: 6px 14px; border-radius: 20px;
      border: 1.5px solid var(--border-soft); background: var(--bg-main);
      color: var(--text-medium); font-weight: 700; font-size: 0.8rem;
      cursor: pointer; transition: all 0.2s; font-family: var(--font-body);
      &:hover { background: var(--pink-50); }
      &.active { background: var(--pink-100); border-color: var(--pink-400); color: var(--pink-600); }
    }

    /* WhatsApp */
    .wa-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
    .btn-wa {
      flex: 1; min-width: 110px; padding: 10px 14px; border-radius: 12px;
      border: 1.5px solid #25d366; background: rgba(37, 211, 102, 0.08);
      color: #128C7E; font-weight: 700; font-size: 0.8rem; cursor: pointer;
      transition: all 0.2s; font-family: var(--font-body);
      &:hover { background: rgba(37, 211, 102, 0.15); transform: translateY(-1px); }
    }

    /* ═════════ PRODUCTS ═════════ */
    .products-card { padding-bottom: 0; }
    .items-list { display: flex; flex-direction: column; gap: 2px; }

    .product-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; border-radius: 12px; transition: all 0.2s;
      border: 1.5px solid transparent;
      &:hover { background: var(--pink-50); }
      &.editing { 
        border-color: var(--pink-300); background: var(--bg-main); 
        padding: 12px; flex-direction: column; align-items: stretch;
      }
    }

    .product-info { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
    .product-qty { 
      font-weight: 800; color: var(--pink-500); font-size: 0.85rem;
      background: var(--pink-50); padding: 2px 6px; border-radius: 6px; flex-shrink: 0;
    }
    .product-name { font-weight: 600; color: var(--text-dark); font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .product-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .product-price { font-weight: 800; color: var(--pink-600); font-size: 0.9rem; white-space: nowrap; }
    .btn-icon-mini {
      width: 30px; height: 30px; border-radius: 8px; border: none;
      background: transparent; cursor: pointer; font-size: 0.85rem;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
      &:hover { background: var(--pink-50); transform: scale(1.1); }
      &.danger:hover { background: var(--color-danger-bg); }
    }

    /* Edit Form */
    .product-edit-form, .add-item-form {
      display: flex; flex-direction: column; gap: 10px; width: 100%;
    }
    .edit-row { display: flex; gap: 10px; }
    .qty-stepper {
      display: flex; align-items: center; background: var(--bg-main);
      border: 1.5px solid var(--border-soft); border-radius: 12px; overflow: hidden;
    }
    .qty-stepper button {
      width: 36px; height: 36px; border: none; background: transparent;
      font-size: 1.1rem; font-weight: 800; cursor: pointer;
      color: var(--pink-500); transition: background 0.2s;
      &:hover { background: var(--pink-50); }
    }
    .qty-stepper input {
      width: 50px; border: none; border-left: 1px solid var(--border-soft);
      border-right: 1px solid var(--border-soft);
    }
    .price-wrap {
      display: flex; align-items: center; border: 1.5px solid var(--border-soft);
      border-radius: 12px; overflow: hidden; flex: 1; background: var(--bg-main);
    }
    .currency { padding: 0 8px; font-weight: 800; color: var(--text-muted); font-size: 0.9rem; }
    .price-wrap .field-input { border: none; border-radius: 0; }

    .edit-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .btn-sm {
      padding: 8px 16px; border-radius: 10px; font-weight: 700; font-size: 0.8rem;
      cursor: pointer; transition: all 0.2s; border: none; font-family: var(--font-body);
      &.cancel { background: var(--bg-main); border: 1.5px solid var(--border-soft); color: var(--text-medium); }
      &.cancel:hover { background: var(--pink-50); }
      &.save { background: linear-gradient(135deg, var(--pink-400), var(--pink-600)); color: white; }
      &.save:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(255,107,157,0.3); }
      &.save:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    .preview-line {
      display: flex; justify-content: space-between; padding: 8px 12px;
      background: var(--pink-50); border-radius: 10px; font-weight: 600;
      font-size: 0.85rem; color: var(--text-medium);
    }
    .preview-total { color: var(--pink-600); font-weight: 800; }

    /* Add Item */
    .add-item-section { padding: 12px 0; border-top: 1px solid var(--border-soft); margin-top: 8px; }
    .btn-add-product {
      width: 100%; padding: 12px; border-radius: 12px; 
      border: 2px dashed var(--pink-200); background: transparent;
      color: var(--pink-500); font-weight: 700; font-size: 0.9rem;
      cursor: pointer; transition: all 0.2s; font-family: var(--font-body);
      display: flex; align-items: center; justify-content: center; gap: 8px;
      &:hover { border-color: var(--pink-400); background: var(--pink-50); }
    }

    .empty-items { text-align: center; padding: 2rem; color: var(--text-muted); font-weight: 600; }

    /* Totals */
    .totals-section {
      padding: 1rem 1.25rem; border-top: 1px solid var(--border-soft);
      margin-top: 8px;
    }
    .total-row {
      display: flex; justify-content: space-between; padding: 4px 0;
      font-size: 0.9rem; color: var(--text-medium); font-weight: 600;
    }
    .total-row.grand {
      margin-top: 8px; padding-top: 10px; border-top: 2px solid var(--border-soft);
      font-size: 1.15rem; font-weight: 800; color: var(--pink-600);
    }

    /* ═════════ BOTTOM BAR ═════════ */
    .bottom-bar {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: var(--bg-glass); backdrop-filter: blur(16px) saturate(180%);
      border-top: 1px solid var(--border-soft);
      padding: 12px 1.5rem; display: flex; align-items: center; justify-content: space-between;
      z-index: 100;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.05);
    }
    .btn-danger-outline {
      padding: 10px 18px; border-radius: 12px;
      border: 1.5px solid var(--color-danger); background: transparent;
      color: var(--color-danger); font-weight: 700; font-size: 0.85rem;
      cursor: pointer; transition: all 0.2s; font-family: var(--font-body);
      &:hover { background: var(--color-danger-bg); transform: translateY(-1px); }
    }
    .bottom-right { display: flex; align-items: center; gap: 1rem; }
    .grand-total { font-weight: 700; color: var(--text-dark); font-size: 1rem; }
    .grand-total strong { color: var(--pink-600); font-size: 1.15rem; }
    .btn-save-main {
      padding: 10px 24px; border-radius: 14px; border: none;
      background: linear-gradient(135deg, var(--pink-400), var(--pink-600));
      color: white; font-weight: 800; font-size: 0.95rem;
      cursor: pointer; transition: all 0.3s; font-family: var(--font-body);
      box-shadow: 0 4px 15px rgba(255, 107, 157, 0.3);
      &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255, 107, 157, 0.4); }
      &:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
    }

    /* ═════════ RESPONSIVE ═════════ */
    @media (max-width: 900px) {
      .detail-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 480px) {
      .detail-page { padding: 0.75rem 0.75rem 5rem; }
      .client-hero { flex-wrap: wrap; padding: 1rem; }
      .hero-info h2 { font-size: 1.2rem; }
      .hero-avatar { width: 42px; height: 42px; font-size: 1.1rem; }
      .detail-card { padding: 1rem; border-radius: 16px; }
      .bottom-bar { flex-direction: column; gap: 8px; padding: 10px 1rem; }
      .bottom-right { width: 100%; justify-content: space-between; }
      .status-pills { flex-direction: column; }
      .status-btn { min-width: unset; }
      .wa-buttons { flex-direction: column; }
      .btn-wa { min-width: unset; }
    }
  `]
})
export class OrderDetailComponent implements OnInit {
  Math = Math;

  order = signal<OrderSummary | null>(null);
  loading = signal(true);
  saving = signal(false);
  isDirty = signal(false);
  toastMessage = signal('');
  toastIsError = signal(false);
  editingItemId = signal<number | null>(null);
  showAddForm = signal(false);

  availableTags = ['Urgente', 'VIP', 'Frágil', 'Regalo', 'Pago pendiente'];

  editData = {
    status: '',
    orderType: '',
    postponedAt: '',
    postponedNote: '',
    clientName: '',
    clientAddress: '',
    clientPhone: '',
    tags: [] as string[],
    deliveryTime: '',
    pickupDate: ''
  };

  itemEdit = { productName: '', quantity: 1, unitPrice: 0 };
  newItem = { productName: '', quantity: 1, unitPrice: 0 };

  private orderId = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private confirm: ConfirmationService,
    private whatsapp: WhatsAppService
  ) { }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.orderId = +id;
      this.loadOrder();
    } else {
      this.loading.set(false);
    }
  }

  loadOrder(): void {
    this.loading.set(true);
    this.api.getOrders().subscribe({
      next: (orders) => {
        const found = orders.find(o => o.id === this.orderId);
        if (found) {
          this.order.set(found);
          this.populateEditData(found);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Error al cargar el pedido 😿', true);
      }
    });
  }

  private populateEditData(o: OrderSummary): void {
    this.editData = {
      status: o.status,
      orderType: o.orderType,
      postponedAt: o.postponedAt ? new Date(o.postponedAt).toISOString().slice(0, 16) : '',
      postponedNote: o.postponedNote || '',
      clientName: o.clientName,
      clientAddress: o.clientAddress || '',
      clientPhone: o.clientPhone || '',
      tags: o.tags ? [...o.tags] : [],
      deliveryTime: o.deliveryTime || '',
      pickupDate: o.pickupDate || ''
    };
    this.isDirty.set(false);
  }

  markDirty(): void {
    this.isDirty.set(true);
  }

  goBack(): void {
    this.router.navigate(['/admin/orders']);
  }

  // ═══════════════ SAVE ORDER CHANGES ═══════════════

  saveChanges(): void {
    if (!this.order()) return;
    this.saving.set(true);

    const payload: any = {
      status: this.editData.status,
      orderType: this.editData.orderType,
      clientName: this.editData.clientName,
      clientAddress: this.editData.clientAddress,
      clientPhone: this.editData.clientPhone,
      tags: this.editData.tags,
      deliveryTime: this.editData.deliveryTime || null,
      pickupDate: this.editData.pickupDate || null
    };

    if (this.editData.status === 'Postponed') {
      payload.postponedAt = this.editData.postponedAt || null;
      payload.postponedNote = this.editData.postponedNote || null;
    }

    this.api.updateOrder(this.order()!.id, payload).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.populateEditData(updated);
        this.saving.set(false);
        this.showToast('Pedido actualizado 💖');
      },
      error: () => {
        this.saving.set(false);
        this.showToast('Error al guardar 😿', true);
      }
    });
  }

  // ═══════════════ TAGS ═══════════════

  toggleTag(tag: string): void {
    const idx = this.editData.tags.indexOf(tag);
    if (idx >= 0) {
      this.editData.tags.splice(idx, 1);
    } else {
      this.editData.tags.push(tag);
    }
    this.markDirty();
  }

  // ═══════════════ ITEMS ═══════════════

  startItemEdit(item: OrderItem): void {
    this.editingItemId.set(item.id);
    this.itemEdit = {
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    };
  }

  cancelItemEdit(): void {
    this.editingItemId.set(null);
  }

  saveItemEdit(item: OrderItem): void {
    if (!this.order()) return;
    this.api.updateOrderItem(this.order()!.id, item.id, {
      productName: this.itemEdit.productName,
      quantity: this.itemEdit.quantity,
      unitPrice: this.itemEdit.unitPrice
    }).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.populateEditData(updated);
        this.editingItemId.set(null);
        this.showToast('Producto actualizado ✨');
      },
      error: () => this.showToast('Error al actualizar producto 😿', true)
    });
  }

  addItem(): void {
    if (!this.order() || !this.newItem.productName || this.newItem.unitPrice <= 0) return;
    this.api.addOrderItem(this.order()!.id, {
      productName: this.newItem.productName,
      quantity: this.newItem.quantity,
      unitPrice: this.newItem.unitPrice
    }).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.populateEditData(updated);
        this.newItem = { productName: '', quantity: 1, unitPrice: 0 };
        this.showAddForm.set(false);
        this.showToast('Producto agregado ✨');
      },
      error: () => this.showToast('Error al agregar producto 😿', true)
    });
  }

  async askDeleteItem(item: OrderItem): Promise<void> {
    if (!this.order()) return;
    const confirmed = await this.confirm.confirm({
      title: 'Eliminar producto',
      message: `¿Eliminar "${item.productName}" del pedido?`,
      confirmText: 'Eliminar',
      type: 'danger',
      icon: '🗑️'
    });
    if (!confirmed) return;

    this.api.deleteOrderItem(this.order()!.id, item.id).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.populateEditData(updated);
        this.showToast('Producto eliminado 🗑️');
      },
      error: () => this.showToast('Error al eliminar producto 😿', true)
    });
  }

  // ═══════════════ DELETE ORDER ═══════════════

  async askDeleteOrder(): Promise<void> {
    if (!this.order()) return;
    const confirmed = await this.confirm.confirm({
      title: 'Eliminar pedido',
      message: `¿Eliminar el pedido #${this.order()!.id} de ${this.order()!.clientName}? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      type: 'danger',
      icon: '🗑️'
    });
    if (!confirmed) return;

    this.api.deleteOrder(this.order()!.id).subscribe({
      next: () => {
        this.router.navigate(['/admin/orders']);
      },
      error: () => this.showToast('Error al eliminar pedido 😿', true)
    });
  }

  // ═══════════════ WHATSAPP ═══════════════

  sendWa(type: string): void {
    const o = this.order();
    if (!o) return;
    switch (type) {
      case 'confirm': this.whatsapp.sendOrderConfirmation(o); break;
      case 'onway': this.whatsapp.sendOnTheWay(o); break;
      case 'payment': this.whatsapp.sendPaymentReminder(o); break;
    }
  }

  // ═══════════════ UTILS ═══════════════

  copyLink(link: string): void {
    navigator.clipboard.writeText(link);
    this.showToast('Link copiado 📋');
  }

  focusField(name: string): void {
    setTimeout(() => {
      const el = document.querySelector(`[#${name}Input]`) as HTMLInputElement;
      el?.focus();
    }, 50);
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      'Pending': 'Pendiente', 'InRoute': 'En Ruta', 'Delivered': 'Entregado',
      'Canceled': 'Cancelado', 'Postponed': 'Pospuesto', 'NotDelivered': 'No Entregado'
    };
    return map[s] || s;
  }

  private showToast(msg: string, isError = false): void {
    this.toastMessage.set(msg);
    this.toastIsError.set(isError);
    setTimeout(() => this.toastMessage.set(''), 3000);
  }
}
