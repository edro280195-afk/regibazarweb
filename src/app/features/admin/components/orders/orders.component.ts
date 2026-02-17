import { Component, OnInit, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { OrderSummary, OrderItem, ExcelUploadResult } from '../../../../shared/models/models';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="orders-page">
      
      <!-- ═══════════════ TOAST ═══════════════ -->
      @if (toastMessage()) {
        <div class="toast-notification" [class.error]="toastIsError()">
          <span class="toast-icon">{{ toastIsError() ? '😿' : '✨' }}</span>
          <span>{{ toastMessage() }}</span>
        </div>
      }

      <!-- ═══════════════ MODAL: BORRAR PEDIDO ═══════════════ -->


      <!-- ═══════════════ MODAL: GESTIONAR PEDIDO ═══════════════ -->
      @if (orderToEdit()) {
        <div class="modal-overlay" (click)="orderToEdit.set(null)">
          <div class="modal-card edit-modal" (click)="$event.stopPropagation()">

            <div class="edit-modal-header">
              <div class="edit-modal-bg-blur"></div>
              <div class="sparkle-row">
                <span>✨</span><span>💖</span><span>✨</span>
              </div>
              <h3>Gestionar Pedido</h3>
              <p class="client-title">{{ orderToEdit()?.clientName }}</p>
              <button class="btn-close-modal" (click)="orderToEdit.set(null)">✕</button>
            </div>

            <div class="edit-modal-body">
              <div class="edit-section">
                <label class="field-label">📦 Método de Entrega</label>
                <div class="type-switch">
                  <button [class.active]="editData.orderType === 'Delivery'" (click)="editData.orderType = 'Delivery'">
                    <span class="switch-icon">🛵</span><span>Envío</span>
                  </button>
                  <button [class.active]="editData.orderType === 'PickUp'" (click)="editData.orderType = 'PickUp'">
                    <span class="switch-icon">🛍️</span><span>Local</span>
                  </button>
                </div>
              </div>

              <div class="edit-section">
                <label class="field-label">🎀 Estatus del Pedido</label>
                <div class="status-pills-selector">
                  <button class="status-pill-btn" [class.active]="editData.status === 'Pending'"   (click)="editData.status = 'Pending'">⏳ Pendiente</button>
                  <button class="status-pill-btn" [class.active]="editData.status === 'Delivered'" (click)="editData.status = 'Delivered'">💝 Entregado</button>
                  <button class="status-pill-btn" [class.active]="editData.status === 'Canceled'"  (click)="editData.status = 'Canceled'">🚫 Cancelado</button>
                  <button class="status-pill-btn" [class.active]="editData.status === 'Postponed'" (click)="editData.status = 'Postponed'">📅 Posponer</button>
                </div>
              </div>

              @if (editData.status === 'Postponed') {
                <div class="postponed-box">
                  <div class="field">
                    <label class="field-label">📅 ¿Cuándo entregamos?</label>
                    <input type="datetime-local" [(ngModel)]="editData.postponedAt" class="fancy-input">
                  </div>
                  <div class="field">
                    <label class="field-label">📝 Nota rápida</label>
                    <input type="text" [(ngModel)]="editData.postponedNote" placeholder="Ej. Cambio de horario" class="fancy-input">
                  </div>
                </div>
              }
            </div>

            <div class="edit-modal-footer">
              <button class="btn-modal-cancel" (click)="orderToEdit.set(null)">Cerrar</button>
              <button class="btn-modal-pink" (click)="saveEdit()">💾 Guardar cambios</button>
            </div>
          </div>
        </div>
      }

      <!-- ═══════════════ DRAWER: AGREGAR ARTÍCULO ═══════════════ -->
      @if (drawerOrder()) {
        <div class="drawer-overlay" (click)="closeDrawer()">
          <div class="drawer-panel" [class.open]="drawerOpen()" (click)="$event.stopPropagation()">
            
            <div class="drawer-header">
              <div class="drawer-grab"></div>
              <h3>Agregar artículo</h3>
              <p class="drawer-subtitle">{{ drawerOrder()?.clientName }} 🛍️</p>
              <button class="btn-close-drawer" (click)="closeDrawer()">✕</button>
            </div>

            <div class="drawer-body">
              <div class="drawer-field">
                <label>Producto</label>
                <input type="text" [(ngModel)]="newItem.productName" 
                       placeholder="Ej. Edredón King rosa"
                       class="drawer-input" 
                       (keydown.enter)="focusField('qty')">
              </div>

              <div class="drawer-row">
                <div class="drawer-field half">
                  <label>Cantidad</label>
                  <div class="qty-stepper">
                    <button (click)="newItem.quantity = Math.max(1, newItem.quantity - 1)">−</button>
                    <input type="number" [(ngModel)]="newItem.quantity" min="1" #qtyInput
                           class="drawer-input center" (keydown.enter)="focusField('price')">
                    <button (click)="newItem.quantity = newItem.quantity + 1">+</button>
                  </div>
                </div>
                <div class="drawer-field half">
                  <label>Precio unitario</label>
                  <div class="price-input-wrap">
                    <span class="currency">$</span>
                    <input type="number" [(ngModel)]="newItem.unitPrice" min="0" #priceInput
                           class="drawer-input with-prefix" (keydown.enter)="addItemToOrder()">
                  </div>
                </div>
              </div>

              @if (newItem.productName && newItem.unitPrice > 0) {
                <div class="preview-line">
                  <span class="preview-qty">{{ newItem.quantity }}x</span>
                  <span class="preview-name">{{ newItem.productName }}</span>
                  <span class="preview-total">$ {{ (newItem.quantity * newItem.unitPrice) | number:'1.2-2' }}</span>
                </div>
              }

              <button class="btn-add-item" (click)="addItemToOrder()" 
                      [disabled]="!newItem.productName || newItem.unitPrice <= 0">
                ✨ Agregar al pedido
              </button>

              <!-- Items ya en el pedido -->
              @if (drawerOrder()?.items?.length) {
                <div class="drawer-current-items">
                  <label class="section-label">En este pedido:</label>
                  @for (item of drawerOrder()!.items; track item.id) {
                    <div class="mini-item-chip">
                      <span class="chip-qty">{{ item.quantity }}×</span>
                      <span class="chip-name">{{ item.productName }}</span>
                      <span class="chip-price">$ {{ item.lineTotal | number:'1.2-2' }}</span>
                    </div>
                  }
                  <div class="drawer-total-row">
                    <span>Total actual</span>
                    <span class="drawer-total-value">$ {{ drawerOrder()!.total | number:'1.2-2' }}</span>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- ═══════════════ MODAL: RESULTADO UPLOAD EXCEL ═══════════════ -->
      @if (uploadResult()) {
        <div class="modal-overlay" (click)="uploadResult.set(null)">
          <div class="modal-card upload-result-modal" (click)="$event.stopPropagation()">
            <div class="modal-petals">
              <span class="petal p1">📄</span>
              <span class="petal p2">✨</span>
              <span class="petal p3">🎉</span>
            </div>
            <div class="modal-icon-circle success">🎉</div>
            <h3>¡Excel cargado!</h3>
            <div class="upload-stats">
              <div class="stat-bubble">
                <span class="stat-num">{{ uploadResult()!.ordersCreated }}</span>
                <span class="stat-txt">Pedidos</span>
              </div>
              <div class="stat-bubble">
                <span class="stat-num">{{ uploadResult()!.clientsCreated }}</span>
                <span class="stat-txt">Clientes nuevos</span>
              </div>
            </div>
            @if (uploadResult()!.warnings?.length) {
              <div class="upload-warnings">
                <label>⚠️ Notas:</label>
                @for (w of uploadResult()!.warnings; track w) {
                  <p>{{ w }}</p>
                }
              </div>
            }
            <div class="modal-actions">
              <button class="btn-modal-pink" (click)="uploadResult.set(null)">¡Perfecto! 💅</button>
            </div>
          </div>
        </div>
      }

      <!-- ═══════════════ PÁGINA PRINCIPAL ═══════════════ -->
      <div class="page-header">
        <div class="header-text">
          <h2>Pedidos 🛒</h2>
          <p class="page-sub">Administra tus ventas, CEO ✨</p>
        </div>
        <div class="header-controls">
          <div class="actions-toolbar">
            <button class="btn-nuke" (click)="onWipeOrders()">
              🗑️ Borrar TODO
            </button>
          </div>
          <button class="btn-toggle-select" [class.active]="selectionMode()" (click)="toggleSelectionMode()">
            {{ selectionMode() ? '❌ Salir' : '✨ Organizar Ruta' }}
          </button>
          <button class="btn-icon-circle" (click)="loadOrders()" title="Recargar">🔄</button>

          <!-- Upload rápido -->
          <label class="btn-upload-quick" title="Cargar Excel">
            <span>📄</span>
            <input type="file" accept=".xlsx,.xls" (change)="onQuickUpload($event)" hidden>
          </label>

          <select [(ngModel)]="statusFilter" (change)="applyFilter()" class="filter-select">
            <option value="">Todos</option>
            <option value="Pending">⏳ Pendientes</option>
            <option value="InRoute">🚗 En ruta</option>
            <option value="Delivered">💝 Entregados</option>
            <option value="Postponed">📅 Pospuestos</option>
            <option value="Canceled">🚫 Cancelados</option>
          </select>

          

          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" [(ngModel)]="searchTerm" (input)="applyFilter()" 
                   placeholder="Buscar cliente..." class="search-input">
            @if (searchTerm) {
              <button class="search-clear" (click)="searchTerm = ''; applyFilter()">✕</button>
            }
          </div>
        </div>
      </div>

      <!-- Quick stats -->
      <div class="quick-stats">
        <div class="qs-chip">
          <span class="qs-num">{{ orderStats().total }}</span>
          <span class="qs-label">Total</span>
        </div>
        <div class="qs-chip pending">
          <span class="qs-num">{{ orderStats().pending }}</span>
          <span class="qs-label">Pendientes</span>
        </div>
        <div class="qs-chip delivered">
          <span class="qs-num">{{ orderStats().delivered }}</span>
          <span class="qs-label">Entregados</span>
        </div>
        <div class="qs-chip revenue">
          <span class="qs-num">$ {{ orderStats().revenue | number:'1.0-0' }}</span>
          <span class="qs-label">Venta total</span>
        </div>
      </div>

      <!-- Upload Drop Zone (drag & drop) -->
      <div class="drop-zone" 
           [class.active]="isDragging()"
           (dragover)="onDragOver($event)" 
           (dragleave)="isDragging.set(false)" 
           (drop)="onDrop($event)">
        @if (uploading()) {
          <div class="upload-progress">
            <div class="spinner-cute"></div>
            <p>Procesando Excel... ✨</p>
          </div>
        } @else {
          <div class="drop-content">
            <span class="drop-icon">📄</span>
            <p class="drop-text">Arrastra tu archivo Excel aquí</p>
            <p class="drop-hint">o usa el botón 📄 de arriba</p>
          </div>
        }
      </div>

      <!-- ═══════════════ ROUTE BASKET (DOCK) ═══════════════ -->
      @if (selectionMode() || selectedIds().size > 0) {
        <div class="route-dock-container">
          <div class="route-dock">
            
            <div class="dock-left">
              <div class="dock-icon-wrapper">
                <span class="dock-icon">🛵</span>
                <span class="badge-count">{{ selectedIds().size }}</span>
              </div>
              <div class="dock-info">
                <h4>Ruta en proceso</h4>
                <p>Total: <strong>$ {{ selectedOrdersTotal() | number:'1.0-0' }}</strong></p>
              </div>
            </div>

            <div class="dock-avatars">
              @for (order of selectedOrdersList(); track order.id) {
                <div class="mini-avatar" [title]="order.clientName">
                  {{ order.clientName.charAt(0) }}
                  <span class="check-mini">✓</span>
                </div>
              }
              @if (selectedIds().size === 0) {
                <span class="empty-hint">Toca las tarjetas para agregar...</span>
              }
            </div>

            <button class="btn-create-route-dock" (click)="createRoute()" 
                    [disabled]="selectedIds().size === 0 || loading()">
              <span>Crear Ruta</span>
              <span class="arrow">→</span>
            </button>
          </div>
        </div>
      }

      <!-- Orders grid -->
      <div class="orders-grid">
        @for (order of filteredOrders(); track order.id) {
          <div class="order-card" 
               [class.selection-mode]="selectionMode()"
               [class.selected]="selectedIds().has(order.id)"
               [attr.data-status]="order.status"
               (click)="selectionMode() ? toggleOrder(order.id) : null">
            
            @if (selectionMode() && selectedIds().has(order.id)) {
              <div class="selection-stamp">
                <span>🎀</span>
              </div>
            }
            
            <div class="card-header">
              <div class="client-meta">
                <span class="order-id">#{{ order.id }}</span>
                <span class="order-type-tag" [class.pickup]="order.orderType === 'PickUp'">
                  {{ order.orderType === 'PickUp' ? '🛍️ LOCAL' : '🛵 ENVÍO' }}
                </span>
              </div>
              <span class="status-pill" [attr.data-status]="order.status">
                {{ statusLabel(order.status) }}
              </span>
            </div>

            <div class="card-body">
              <div class="client-info">
                <div class="name-check">
                  @if (order.status === 'Pending' && order.orderType === 'Delivery') {
                    <label class="custom-checkbox" (click)="$event.stopPropagation()">
                      <input type="checkbox" [checked]="selectedIds().has(order.id)" (change)="toggleOrder(order.id)">
                      <span class="checkmark"></span>
                    </label>
                  }
                  <h3 class="client-name">{{ order.clientName }}</h3>
                </div>
                @if (order.clientType === 'Frecuente') {
                  <span class="badge-vip">👑 CLIENTA VIP</span>
                }
              </div>

              @if (order.status === 'Postponed' && order.postponedAt) {
                <div class="postponed-alert">
                  <span class="alert-icon">📅</span>
                  <div>
                    <p class="date">{{ order.postponedAt | date:'fullDate' }}</p>
                    @if (order.postponedNote) { <p class="note">"{{ order.postponedNote }}"</p> }
                  </div>
                </div>
              }

              <div class="items-scroll-row">
                <div class="items-track">
                  @for (item of order.items; track item.id) {
                    <div class="item-chip">
                      <span class="qty">{{ item.quantity }}×</span>
                      <span class="name">{{ item.productName }}</span>
                      <span class="price">$ {{ item.lineTotal | number:'1.0-0' }}</span>
                      @if (order.status === 'Pending') {
                        <button class="btn-del-item" (click)="$event.stopPropagation(); askDeleteItem(order, item)">✕</button>
                      }
                    </div>
                  }
                  @if (order.status === 'Pending') {
                    <button class="item-chip add-chip" (click)="openDrawer(order)">
                      <span class="plus">＋</span>
                    </button>
                  }
                </div>
              </div>
              @if (order.items.length > 0) {
                <div class="items-summary">
                  <span>{{ order.items.length }} artículo{{ order.items.length > 1 ? 's' : '' }}</span>
                  <span class="swipe-hint">desliza →</span>
                </div>
              }
            </div>

            <div class="card-footer">
              <div class="total-section">
                <span class="total-label">Total</span>
                <span class="total-amount">$ {{ order.total | number:'1.2-2' }}</span>
              </div>
              <div class="card-buttons">
                <button class="action-btn edit" (click)="openEdit(order)" title="Gestionar">⚙️</button>
                <button class="action-btn link" (click)="copyLink(order.clientLink)" title="Copiar Link">📋</button>
                <button class="action-btn delete" (click)="askDeleteOrder(order)" title="Eliminar">🗑️</button>
              </div>
            </div>
          </div>
        } @empty {
          <div class="empty-state">
            <div class="empty-icon">🛍️</div>
            <h3>No hay pedidos</h3>
            <p>Carga un Excel o crea un pedido manual</p>
          </div>
        }
      </div>

      <!-- Route success -->
      @if (routeCreated()) {
        <div class="route-success-card">
          <div class="icon">🚗💨</div>
          <div class="info">
            <h4>¡Ruta creada con éxito!</h4>
            <p>Envía este link al repartidor:</p>
            <div class="copy-box">
              <input type="text" [value]="routeCreated()!.driverLink" readonly>
              <button (click)="copyDriverLink()">Copiar</button>
            </div>
          </div>
          <button class="close-btn" (click)="routeCreated.set(null)">✕</button>
        </div>
      }
    </div>
  `,
  styles: [`
    /* ═══════════════════════════════════════════
       DESIGN TOKENS
    ═══════════════════════════════════════════ */
    :host {
      --pink-50:  #fdf2f8;
      --pink-100: #fce7f3;
      --pink-200: #fbcfe8;
      --pink-300: #f9a8d4;
      --pink-400: #f472b6;
      --pink-500: #ec4899;
      --pink-600: #db2777;
      --rose-gold: #b76e79;
      --purple-50:  #faf5ff;
      --purple-100: #f3e8ff;
      --purple-200: #e9d5ff;
      --purple-500: #a855f7;
      --green-50:  #f0fdf4;
      --green-500: #22c55e;
      --amber-50:  #fffbeb;
      --amber-600: #d97706;
      --radius-xl: 24px;
      --radius-lg: 16px;
      --radius-md: 12px;
      --shadow-soft: 0 8px 25px rgba(255, 107, 157, 0.08);
      --shadow-lift: 0 15px 35px rgba(255, 107, 157, 0.14);
      --gradient-pink: linear-gradient(135deg, #ff6b9d, #c084fc);
      --gradient-danger: linear-gradient(135deg, #ff6b9d, #e0395c);
      --ease-bounce: cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    /* ═════════ SELECTION TOGGLE ═════════ */
    .btn-toggle-select {
      padding: 0.6rem 1.2rem; border-radius: 20px; border: 2px solid var(--pink-200);
      background: white; color: var(--pink-600); font-weight: 700; cursor: pointer;
      transition: all 0.2s; box-shadow: 0 4px 10px rgba(255,107,157,0.1);
      &:hover { transform: translateY(-2px); border-color: var(--pink-400); }
      &.active { background: var(--pink-100); border-color: var(--pink-400); color: var(--pink-700); }
    }

    /* ═════════ DOCK (BASKET) ═════════ */
    .route-dock-container {
      position: fixed; bottom: 20px; left: 0; right: 0;
      display: flex; justify-content: center; z-index: 1000;
      pointer-events: none; /* Let clicks pass through outside the dock */
      padding: 0 20px;
    }
    .route-dock {
      pointer-events: auto;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(16px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.6);
      box-shadow: 0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,107,157,0.1);
      border-radius: 24px;
      padding: 10px 14px;
      display: flex; align-items: center; gap: 1rem;
      max-width: 800px; width: 100%;
      animation: slideUpDock 0.4s var(--ease-bounce);
    }
    @keyframes slideUpDock { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    .dock-left { display: flex; align-items: center; gap: 10px; }
    .dock-icon-wrapper { position: relative; }
    .dock-icon { font-size: 2rem; }
    .badge-count {
      position: absolute; top: -5px; right: -5px;
      background: var(--pink-500); color: white; border-radius: 50%;
      width: 20px; height: 20px; font-size: 0.75rem; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    .dock-info h4 { margin: 0; font-size: 0.8rem; text-transform: uppercase; color: #999; font-weight: 800; letter-spacing: 0.5px; }
    .dock-info p { margin: 0; color: var(--text-dark); font-size: 1rem; }

    .dock-avatars {
      flex: 1; display: flex; align-items: center; gap: -8px; overflow-x: auto;
      padding: 4px; mask-image: linear-gradient(to right, transparent, black 10px, black 90%, transparent);
    }
    .mini-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: white; border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.8rem; font-weight: 800; color: var(--pink-600);
      position: relative; flex-shrink: 0; margin-right: -10px; transition: transform 0.2s;
      &:hover { transform: translateY(-4px) scale(1.1); z-index: 10; margin-right: 2px; }
      &:nth-child(even) { background: var(--pink-50); }
      &:nth-child(odd) { background: var(--purple-50); }
    }
    .check-mini {
      position: absolute; bottom: -2px; right: -2px;
      background: var(--green-500); color: white; border-radius: 50%;
      width: 12px; height: 12px; font-size: 0.55rem;
      display: flex; align-items: center; justify-content: center;
    }
    .empty-hint { font-size: 0.85rem; color: #bbb; font-style: italic; white-space: nowrap; margin-left: 10px; }

    .btn-create-route-dock {
      background: var(--gradient-pink); color: white;
      border: none; padding: 0.8rem 1.5rem; border-radius: 16px;
      font-weight: 800; font-size: 1rem; cursor: pointer;
      display: flex; align-items: center; gap: 8px;
      box-shadow: 0 8px 20px rgba(255, 107, 157, 0.4);
      transition: all 0.3s;
      &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 25px rgba(255, 107, 157, 0.5); }
      &:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; filter: grayscale(1); }
      .arrow { transition: transform 0.2s; }
      &:hover .arrow { transform: translateX(3px); }
    }

    /* ═════════ SELECTION MODE — CARD ═════════ */
    .order-card.selection-mode {
      cursor: crosshair; /* Or pointer */
      
      &:not(.selected) {
        transform: scale(0.96); opacity: 0.7; filter: grayscale(0.4);
        &:hover { opacity: 0.9; transform: scale(0.98); filter: grayscale(0); }
      }

      &.selected {
        transform: scale(1); opacity: 1; filter: none;
        box-shadow: 0 0 0 3px var(--pink-400), var(--shadow-lift);
        z-index: 2;
      }
    }

    .selection-stamp {
      position: absolute; top: 10px; right: 10px;
      width: 40px; height: 40px; background: white;
      border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.15);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem; animation: stampPop 0.3s var(--ease-bounce);
      z-index: 10; border: 2px solid var(--pink-200);
    }
    @keyframes stampPop { from { transform: scale(0) rotate(-45deg); } to { transform: scale(1) rotate(0); } }

    /* ═══════════════════════════════════════════
       PAGE BASE
    ═══════════════════════════════════════════ */
    .orders-page {
      padding: 1rem 1.25rem 6rem;
      max-width: 1360px;
      margin: 0 auto;
      background: #fdfafb;
      min-height: 100vh;
    }

    /* ═══════════════════════════════════════════
       TOAST
    ═══════════════════════════════════════════ */
    .toast-notification {
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(12px);
      border: 1.5px solid var(--pink-200);
      padding: 12px 24px; border-radius: 50px;
      display: flex; align-items: center; gap: 8px;
      z-index: 600; font-weight: 700; font-size: 0.9rem; color: #555;
      box-shadow: 0 10px 30px rgba(255, 107, 157, 0.15);
      animation: toastSlide 0.4s var(--ease-bounce);
      &.error { border-color: #fca5a5; }
    }
    @keyframes toastSlide { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
    .toast-icon { font-size: 1.2rem; }

    /* ═══════════════════════════════════════════
       MODAL OVERLAY
    ═══════════════════════════════════════════ */
    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(8px);
      z-index: 500;
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn 0.3s forwards;
    }

    .modal-card {
      background: white; border-radius: var(--radius-xl);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      padding: 0; width: 90%; max-width: 400px;
      position: relative;
      animation: scaleUp 0.3s var(--ease-bounce);
    }
    @keyframes scaleUp { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    /* ═══════════════════════════════════════════
       HEADER
    ═══════════════════════════════════════════ */
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      margin-bottom: 2rem; gap: 1rem;
    }
    .header-text h2 {
      font-family: var(--font-display); font-size: 2.2rem; margin: 0; color: var(--pink-600);
      text-shadow: 2px 2px 0px white;
    }
    .page-sub { margin: 5px 0 0; color: #777; font-weight: 600; font-size: 0.95rem; font-family: var(--font-body); }

    .header-controls {
      display: flex; align-items: center; gap: 12px;
    }

    .search-box {
      position: relative;
      background: white; border-radius: 25px;
      box-shadow: 0 4px 15px rgba(236, 72, 153, 0.08); /* Pink shadow */
      transition: all 0.3s;
    }
    .search-box:focus-within {
      box-shadow: 0 6px 20px rgba(236, 72, 153, 0.2); 
      transform: translateY(-2px);
    }
    .search-input {
      border: none; background: transparent; padding: 10px 20px 10px 40px;
      font-size: 0.95rem; border-radius: 25px; width: 220px;
      font-weight: 600; color: #444; outline: none; transition: width 0.3s;
    }
    .search-input:focus { width: 280px; }
    .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); opacity: 0.5; font-size: 1rem; }
    .search-clear {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      background: #eee; border: none; border-radius: 50%; width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center; cursor: pointer; color: #666;
    }

    .btn-icon-circle {
      width: 44px; height: 44px; border-radius: 50%;
      background: white; border: 1px solid #fce7f3;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.2rem; cursor: pointer; transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      &:hover { transform: translateY(-3px) rotate(10deg); box-shadow: 0 8px 20px rgba(236,72,153,0.15); }
    }
    .btn-upload-quick {
      @extend .btn-icon-circle;
      position: relative; overflow: hidden;
      input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    }

    /* ═══════════════════════════════════════════
       QUICK STATS
    ═══════════════════════════════════════════ */
    .quick-stats {
      display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap;
    }
    .qs-chip {
      background: white; border-radius: 16px; padding: 10px 20px;
      display: flex; flex-direction: column; min-width: 100px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid white;
      transition: all 0.3s;
    }
    .qs-chip:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(0,0,0,0.06); }
    .qs-num { font-size: 1.4rem; font-weight: 800; color: #444; font-family: var(--font-body); }
    .qs-label { font-size: 0.75rem; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }

    .qs-chip.pending { background: #fffbeb; border-color: #fef3c7; .qs-num { color: #d97706; } }
    .qs-chip.delivered { background: #f0fdf4; border-color: #dcfce7; .qs-num { color: #16a34a; } }
    .qs-chip.revenue { background: linear-gradient(135deg, #fff1f2, #fff); border-color: #ffe4e6; .qs-num { color: #e11d48; } }

    /* ═══════════════════════════════════════════
       DROP ZONE
    ═══════════════════════════════════════════ */
    .drop-zone {
      border: 2px dashed var(--pink-200); border-radius: 20px;
      padding: 1.5rem; text-align: center; background: rgba(255,255,255,0.4);
      margin-bottom: 2rem; transition: all 0.3s; cursor: pointer;
    }
    .drop-zone:hover, .drop-zone.active {
      border-color: var(--pink-500); background: var(--pink-50);
      transform: scale(1.01);
    }
    .drop-content { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .drop-icon { font-size: 2rem; opacity: 0.6; }
    .drop-text { font-weight: 700; color: var(--pink-600); margin: 0; }
    .drop-hint { font-size: 0.8rem; color: #888; margin: 0; }
    .spinner-cute {
      width: 24px; height: 24px; border: 3px solid var(--pink-200); border-top-color: var(--pink-500);
      border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 10px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ═══════════════════════════════════════════
       ORDERS GRID & CARD
    ═══════════════════════════════════════════ */
    .orders-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 1.5rem;
    }

    .order-card {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(10px);
      border-radius: 24px;
      border: 1px solid white;
      box-shadow: 0 10px 30px rgba(0,0,0,0.04);
      padding: 1.5rem;
      position: relative; overflow: hidden;
      display: flex; flex-direction: column; gap: 1rem;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    .order-card[data-status="Delivered"] { background: rgba(240, 253, 244, 0.7); }
    .order-card[data-status="Canceled"] { background: rgba(254, 242, 242, 0.7); opacity: 0.85; }

    .order-card:hover {
      transform: translateY(-8px) scale(1.02);
      box-shadow: 0 20px 40px rgba(255, 107, 157, 0.15);
      z-index: 5;
    }

    /* Card Header */
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .order-id { font-size: 0.8rem; font-weight: 800; color: #ccc; letter-spacing: 1px; }
    
    .order-type-tag {
      font-size: 0.65rem; font-weight: 800; padding: 4px 8px; border-radius: 8px;
      margin-top: 4px; display: inline-block; text-transform: uppercase;
    }
    .order-type-tag:not(.pickup) { background: #e0f2fe; color: #0284c7; } /* Delivery */
    .order-type-tag.pickup { background: #f3e8ff; color: #9333ea; } /* Pickup */

    .status-pill {
      font-size: 0.75rem; font-weight: 800; padding: 6px 12px; border-radius: 20px;
      text-transform: uppercase; letter-spacing: 0.5px; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }

    /* Card Body */
    .card-body { display: flex; flex-direction: column; gap: 1rem; flex: 1; }
    .client-info .name-check { display: flex; align-items: center; gap: 8px; }
    .client-name { font-size: 1.2rem; font-weight: 700; color: #333; margin: 0; line-height: 1.2; }
    .badge-vip {
      font-size: 0.65rem; background: linear-gradient(135deg, #FFD700, #ffb347);
      color: white; padding: 2px 8px; border-radius: 8px; font-weight: 800;
      text-shadow: 0 1px 2px rgba(0,0,0,0.1); margin-top: 4px; display: inline-block;
    }

    .postponed-alert {
      background: #fdf4ff; border: 1px dashed #d8b4fe; border-radius: 12px;
      padding: 10px; display: flex; gap: 10px; align-items: flex-start;
      margin-top: 5px;
    }
    .alert-icon { font-size: 1.2rem; }
    .postponed-alert .date { font-weight: 700; color: #7e22ce; margin: 0; font-size: 0.9rem; }
    .postponed-alert .note { font-size: 0.8rem; color: #666; margin: 2px 0 0; font-style: italic; }

    /* Order Items */
    .items-scroll-row { overflow-x: auto; padding-bottom: 5px; margin: 0 -5px; padding: 5px; }
    .items-track { display: flex; gap: 8px; }
    .item-chip {
      background: white; border-radius: 12px; padding: 6px 10px;
      display: flex; align-items: center; gap: 6px;
      border: 1px solid #f0f0f0; box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      flex-shrink: 0; font-size: 0.85rem;
    }
    .qty { font-weight: 800; color: var(--pink-500); background: var(--pink-50); padding: 2px 6px; border-radius: 6px; font-size: 0.75rem; }
    .name { max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #555; }
    .price { font-weight: 600; color: #999; font-size: 0.75rem; }
    .btn-del-item {
      width: 20px; height: 20px; border-radius: 50%; border: none; background: #fee2e2;
      color: #ef4444; display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 1rem; line-height: 1; padding: 0; margin-left: auto;
    }
    .add-chip { background: #f0f9ff; border: 1px dashed #bae6fd; color: #0ea5e9; cursor: pointer; justify-content: center; width: 32px; }

    .items-summary {
      display: flex; justify-content: space-between; font-size: 0.75rem; color: #bbb; font-weight: 700; text-transform: uppercase;
    }
    .swipe-hint { color: var(--pink-300); }

    /* Footer & Card Actions */
    .card-footer {
      border-top: 1px dashed #eee; padding-top: 1rem; margin-top: auto;
      display: flex; justify-content: space-between; align-items: flex-end;
    }
    .total-label { font-size: 0.7rem; font-weight: 800; color: #ccc; text-transform: uppercase; letter-spacing: 0.5px; }
    .total-amount { font-size: 1.4rem; font-weight: 800; color: var(--pink-600); line-height: 1; }
    
    .card-buttons { display: flex; gap: 8px; }
    .action-btn {
      width: 36px; height: 36px; border-radius: 12px; border: none;
      display: flex; align-items: center; justify-content: center; font-size: 1.1rem;
      cursor: pointer; transition: 0.2s; background: #f8f8f8; color: #666;
    }
    .action-btn:hover { transform: translateY(-3px); }
    .action-btn.edit:hover { background: #f0fdf4; color: #16a34a; }
    .action-btn.link:hover { background: #fff7ed; color: #ea580c; }
    .action-btn.delete:hover { background: #fef2f2; color: #ef4444; }

    /* Empty State */
    .empty-state {
      grid-column: 1 / -1; text-align: center; padding: 4rem 1rem;
      color: #ccc;
    }
    .empty-icon { font-size: 4rem; opacity: 0.3; margin-bottom: 1rem; }

    /* Route Success */
    .route-success-card {
      position: fixed; bottom: 20px; right: 20px; width: 320px;
      background: white; border-radius: 20px; padding: 1.5rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      border-left: 5px solid var(--pink-500);
      display: flex; gap: 1rem; align-items: flex-start;
      animation: slideInRight 0.4s var(--ease-bounce);
      z-index: 2000;
    }
    @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    .route-success-card .icon { font-size: 2rem; }
    .route-success-card h4 { margin: 0 0 5px; font-size: 1rem; }
    .route-success-card p { margin: 0 0 10px; font-size: 0.85rem; color: #666; }
    .copy-box { display: flex; gap: 5px; }
    .copy-box input { border: 1px solid #eee; padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; width: 100%; color: #888; }
    .copy-box button { background: var(--pink-500); color: white; border: none; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 0.8rem; font-weight: 700; }
    .close-btn { position: absolute; top: 10px; right: 10px; background: transparent; border: none; font-size: 1.2rem; cursor: pointer; color: #ccc; }

    /* ═══════════════════════════════════════════
       MOBILE & RESPONSIVE
    ═══════════════════════════════════════════ */
    @media (max-width: 1024px) {
      .orders-grid {
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 1rem;
      }
      .page-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
      .header-controls { 
        justify-content: flex-start; width: 100%; flex-wrap: wrap; gap: 8px;
        .search-box { flex-grow: 1; min-width: 200px; }
        .search-input { width: 100%; }
        .search-input:focus { width: 100%; }
      }
      
      .route-dock { max-width: 90%; flex-direction: column; align-items: stretch; gap: 0.8rem; padding: 16px; }
      .dock-left { justify-content: space-between; width: 100%; }
      .dock-avatars { order: 2; padding-bottom: 5px; width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .btn-create-route-dock { order: 3; width: 100%; justify-content: center; padding: 12px; }
    }

    @media (max-width: 480px) {
      .orders-page { padding: 0.75rem 0.75rem 5rem; }
      h2 { font-size: 1.8rem; }
      
      .orders-grid { grid-template-columns: 1fr; }
      
      .quick-stats { flex-direction: column; gap: 0.5rem; }
      .qs-chip { width: 100%; justify-content: space-between; }
      
      .card-footer { flex-direction: column; gap: 1rem; align-items: stretch; }
      .total-section { justify-content: space-between; width: 100%; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; margin-bottom: 0.5rem; flex-direction: row; align-items: center; }
      .card-buttons { justify-content: space-between; width: 100%; gap: 10px; }
      .action-btn { flex: 1; justify-content: center; height: 40px; }

      .edit-modal { max-width: 100%; border-radius: 20px 20px 0 0; }
      .status-pills-selector { gap: 6px; }
      .status-pill-btn { font-size: 0.72rem; padding: 6px 10px; }
    }

    /* 🌸 MODAL & DRAWER BASE STYLES REUSED 🌸 */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(5px);
      z-index: 2000; display: flex; align-items: center; justify-content: center;
      animation: fadeIn 0.3s;
    }
    .modal-card {
      background: white; border-radius: 30px; padding: 2rem;
      max-width: 90vw; width: 400px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.2);
    }
  `]
})
export class OrdersComponent implements OnInit {
  Math = Math;

  // ── Data ──
  orders = signal<OrderSummary[]>([]);
  filteredOrders = signal<OrderSummary[]>([]);
  selectedIds = signal<Set<number>>(new Set());
  routeCreated = signal<any>(null);

  // ── UI state ──
  selectionMode = signal(false); // New!
  loading = signal(false);
  toastMessage = signal('');
  toastIsError = signal(false);
  isDragging = signal(false);
  uploading = signal(false);
  uploadResult = signal<ExcelUploadResult | null>(null);

  // ── Modals ──
  orderToEdit = signal<OrderSummary | null>(null);
  editData = { status: '', orderType: '', postponedAt: '', postponedNote: '' };

  // ── Drawer ──
  drawerOrder = signal<OrderSummary | null>(null);
  drawerOpen = signal(false);
  newItem = { productName: '', quantity: 1, unitPrice: 0 };

  // ── Filters ──
  statusFilter = '';
  searchTerm = '';

  // ── Computed stats ──
  orderStats = computed(() => {
    const all = this.orders();
    return {
      total: all.length,
      pending: all.filter(o => o.status === 'Pending').length,
      delivered: all.filter(o => o.status === 'Delivered').length,
      revenue: all.reduce((sum, o) => sum + o.total, 0)
    };
  });

  // Lista de objetos orden completos seleccionados (para el Dock)
  selectedOrdersList = computed(() => {
    const ids = this.selectedIds();
    return this.orders().filter(o => ids.has(o.id));
  });

  selectedOrdersTotal = computed(() => {
    return this.selectedOrdersList().reduce((sum, o) => sum + o.total, 0);
  });

  constructor(
    private api: ApiService,
    private confirm: ConfirmationService
  ) { }

  ngOnInit(): void {
    this.loadOrders();
  }

  // ═══════════════ DATA ═══════════════

  loadOrders(): void {
    this.loading.set(true);
    this.api.getOrders().subscribe({
      next: (o) => {
        this.orders.set(o);
        this.applyFilter();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Error al cargar pedidos 😿', true);
      }
    });
  }

  applyFilter(): void {
    let list = this.orders();

    if (this.statusFilter) {
      list = list.filter(o => o.status === this.statusFilter);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      list = list.filter(o => o.clientName.toLowerCase().includes(term));
    }

    list.sort((a, b) => b.id - a.id);
    this.filteredOrders.set(list);
  }

  // ═══════════════ SELECTION & ROUTE ═══════════════

  toggleOrder(id: number): void {
    const ids = new Set(this.selectedIds());
    ids.has(id) ? ids.delete(id) : ids.add(id);
    this.selectedIds.set(ids);
  }

  toggleSelectionMode(): void {
    const current = this.selectionMode();
    this.selectionMode.set(!current);
    if (current) {
      // Al salir del modo selección, ¿limpiamos?
      // Opcional: this.selectedIds.set(new Set());
      // Dejémoslo activo por si se arrepiente, pero el dock se ocultará si condicionamos al modo
    }
  }

  createRoute(): void {
    if (this.selectedIds().size === 0) return;
    this.loading.set(true);
    this.api.createRoute(Array.from(this.selectedIds())).subscribe({
      next: (route) => {
        this.routeCreated.set(route);
        this.selectedIds.set(new Set());
        this.loadOrders();
        this.showToast('¡Ruta lista! 🚗💨');
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Error al crear ruta 😿', true);
      }
    });
  }

  // ═══════════════ EDIT MODAL ═══════════════

  openEdit(order: OrderSummary): void {
    this.orderToEdit.set(order);
    this.editData = {
      status: order.status,
      orderType: order.orderType,
      postponedAt: order.postponedAt ? new Date(order.postponedAt).toISOString().slice(0, 16) : '',
      postponedNote: order.postponedNote || ''
    };
  }

  saveEdit(): void {
    const order = this.orderToEdit();
    if (!order) return;

    const payload = {
      status: this.editData.status,
      orderType: this.editData.orderType,
      postponedAt: (this.editData.status === 'Postponed' && this.editData.postponedAt)
        ? this.editData.postponedAt : null,
      postponedNote: this.editData.postponedNote || null
    };

    this.api.updateOrderStatus(order.id, payload).subscribe({
      next: (updated) => {
        const current = this.orders();
        const idx = current.findIndex(o => o.id === order.id);
        if (idx !== -1) {
          current[idx] = updated;
          this.orders.set([...current]);
          this.applyFilter();
        }
        this.orderToEdit.set(null);
        this.showToast('¡Pedido actualizado! ✨💅');
      },
      error: () => this.showToast('Error al guardar 😿', true)
    });
  }

  // ═══════════════ DELETE ACTIONS ═══════════════

  async askDeleteOrder(order: OrderSummary) {
    const confirmed = await this.confirm.confirm({
      title: '¿Borrar pedido?',
      message: `Se eliminará el registro de ${order.clientName} para siempre 💔`,
      confirmText: 'Sí, borrar',
      type: 'danger',
      icon: '🗑️'
    });

    if (confirmed) {
      this.api.deleteOrder(order.id).subscribe({
        next: () => {
          this.loadOrders();
          this.showToast('Pedido eliminado 🗑️');
        },
        error: () => this.showToast('Error al eliminar 😿', true)
      });
    }
  }

  async askDeleteItem(order: OrderSummary, item: OrderItem) {
    const confirmed = await this.confirm.confirm({
      title: '¿Quitar artículo?',
      message: `Eliminaráss ${item.productName} de este pedido, ¿segura? 🌸`,
      confirmText: 'Sí, quitar',
      type: 'danger',
      icon: '🛍️'
    });

    if (confirmed) {
      this.api.deleteOrderItem(order.id, item.id).subscribe({
        next: (updated) => {
          const current = this.orders();
          const idx = current.findIndex(o => o.id === order.id);
          if (idx !== -1) {
            current[idx] = updated;
            this.orders.set([...current]);
            this.applyFilter();
          }
          this.showToast('Artículo eliminado ✨');
        },
        error: () => this.showToast('Error al quitar artículo 😿', true)
      });
    }
  }

  // ═══════════════ DRAWER: ADD ITEM ═══════════════

  openDrawer(order: OrderSummary): void {
    this.drawerOrder.set(order);
    this.newItem = { productName: '', quantity: 1, unitPrice: 0 };
    // Small delay for animation
    setTimeout(() => this.drawerOpen.set(true), 30);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    setTimeout(() => this.drawerOrder.set(null), 350);
  }

  focusField(field: string): void {
    const el = document.querySelector(
      field === 'qty' ? '.qty-stepper input' : '.price-input-wrap input'
    ) as HTMLInputElement;
    el?.focus();
  }

  addItemToOrder(): void {
    const order = this.drawerOrder();
    if (!order || !this.newItem.productName.trim() || this.newItem.unitPrice <= 0) return;

    const payload = {
      productName: this.newItem.productName.trim(),
      quantity: this.newItem.quantity,
      unitPrice: this.newItem.unitPrice
    };

    this.api.addOrderItem(order.id, payload).subscribe({
      next: (updated) => {
        // Update local data
        const current = this.orders();
        const idx = current.findIndex(o => o.id === order.id);
        if (idx !== -1) {
          current[idx] = updated;
          this.orders.set([...current]);
          this.applyFilter();
        }
        // Update drawer reference
        this.drawerOrder.set(updated);
        // Reset form
        this.newItem = { productName: '', quantity: 1, unitPrice: 0 };
        this.showToast('¡Artículo agregado! 🎀');
      },
      error: () => this.showToast('Error al agregar 😿', true)
    });
  }

  async onWipeOrders() {
    const confirmed1 = await this.confirm.confirm({
      title: '⚠️ ¡CUIDADO! ⚠️',
      message: '¿Estás segura de que quieres ELIMINAR TODOS los pedidos? Esta acción no se puede deshacer.',
      confirmText: 'Entiendo, continuar',
      type: 'danger',
      icon: '🧨'
    });

    if (!confirmed1) return;

    const confirmed2 = await this.confirm.confirm({
      title: '¿De verdad?',
      message: 'Se borrará todo el historial para siempre.',
      confirmText: 'Sí, borrar todo',
      type: 'danger',
      icon: '💀'
    });

    if (confirmed2) {
      this.api.deleteAllOrders().subscribe({
        next: () => {
          this.showToast('Se limpió la base de datos ✨');
          this.loadOrders();
        },
        error: () => this.showToast('Error al limpiar 😿')
      });
    }
  }

  // ═══════════════ EXCEL UPLOAD ═══════════════

  onQuickUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.processUpload(file);
    input.value = ''; // Reset so same file can be re-uploaded
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      this.processUpload(file);
    } else {
      this.showToast('Solo archivos Excel (.xlsx, .xls) 📄', true);
    }
  }

  private processUpload(file: File): void {
    this.uploading.set(true);
    this.api.uploadExcel(file).subscribe({
      next: (result) => {
        this.uploading.set(false);
        this.uploadResult.set(result);
        this.loadOrders(); // Refresh list
      },
      error: (err) => {
        this.uploading.set(false);
        const msg = err.error?.message || 'Error al procesar Excel';
        this.showToast(msg + ' 😿', true);
      }
    });
  }

  // ═══════════════ UTILITIES ═══════════════

  copyLink(link: string): void {
    navigator.clipboard.writeText(link);
    this.showToast('¡Enlace copiado! 📋✨');
  }

  copyDriverLink(): void {
    navigator.clipboard.writeText(this.routeCreated()?.driverLink);
    this.showToast('¡Link copiado! 🏎️');
  }

  showToast(msg: string, isError = false): void {
    this.toastMessage.set(msg);
    this.toastIsError.set(isError);
    setTimeout(() => this.toastMessage.set(''), 3000);
  }

  statusLabel(s: string): string {
    const labels: Record<string, string> = {
      Pending: '⏳ Pendiente',
      InRoute: '🚗 En ruta',
      Delivered: '💝 Entregado',
      NotDelivered: '😿 Fallido',
      Canceled: '🚫 Cancelado',
      Postponed: '📅 Pospuesto'
    };
    return labels[s] || s;
  }
}
