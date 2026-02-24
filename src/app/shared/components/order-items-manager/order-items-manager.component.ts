import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { OrderItem, OrderSummary } from '../../models/models';

@Component({
  selector: 'app-order-items-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="items-manager fade-in">
      <div class="section-header-row">
        <h3 class="section-title">🛒 Productos</h3>
        <span class="items-count">{{ order?.items?.length || 0 }} artículo{{ (order?.items?.length !== 1) ? 's' : '' }}</span>
      </div>

      <div class="items-list">
        @for (item of (order?.items || []); track item.id) {
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
                   placeholder="Nombre del producto">
            <div class="edit-row">
              <div class="qty-stepper">
                <button (click)="newItem.quantity = Math.max(1, newItem.quantity - 1)">−</button>
                <input type="number" [(ngModel)]="newItem.quantity" min="1" class="field-input center">
                <button (click)="newItem.quantity = newItem.quantity + 1">+</button>
              </div>
              <div class="price-wrap">
                <span class="currency">$</span>
                <input type="number" [(ngModel)]="newItem.unitPrice" min="0" class="field-input" 
                       (keydown.enter)="addItem()">
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
    </div>
  `,
  styles: [`
    .items-manager { width: 100%; display: flex; flex-direction: column; gap: 8px; }
    .fade-in { animation: fadeIn 0.3s ease-in-out; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    
    .section-title {
      font-size: 0.85rem; font-weight: 800; color: var(--pink-500);
      text-transform: uppercase; letter-spacing: 0.5px;
      margin: 0;
    }
    .section-header-row {
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 2px dashed var(--pink-100); padding-bottom: 8px; margin-bottom: 8px;
    }
    .items-count {
      font-size: 0.8rem; color: var(--pink-600); font-weight: 700;
      background: var(--pink-50); padding: 4px 10px; border-radius: 12px;
    }

    .items-list { display: flex; flex-direction: column; gap: 4px; }
    .product-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; border-radius: 14px; transition: all 0.2s;
      border: 1.5px solid transparent; background: #fafafa;
      &:hover { background: var(--pink-50); border-color: var(--pink-200); }
      &.editing { 
        border-color: var(--pink-300); background: white; 
        padding: 12px; flex-direction: column; align-items: stretch;
      }
    }

    .product-info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
    .product-qty { 
      font-weight: 800; color: var(--pink-500); font-size: 0.85rem;
      background: var(--pink-100); padding: 3px 8px; border-radius: 8px; flex-shrink: 0;
    }
    .product-name { font-weight: 700; color: var(--text-dark); font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .product-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .product-price { font-weight: 800; color: var(--pink-600); font-size: 0.95rem; white-space: nowrap; margin-right: 8px; }
    
    .btn-icon-mini {
      width: 32px; height: 32px; border-radius: 10px; border: none;
      background: white; cursor: pointer; font-size: 0.9rem;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      &:hover { background: var(--pink-100); transform: scale(1.05); }
      &.danger { color: #e11d48; }
      &.danger:hover { background: #fee2e2; }
    }

    /* Edit Form */
    .product-edit-form, .add-item-form {
      display: flex; flex-direction: column; gap: 12px; width: 100%;
    }
    .edit-row { display: flex; gap: 12px; }
    .field-input {
      width: 100%; border: 2px solid #eee; border-radius: 12px;
      padding: 10px 14px; font-family: var(--font-body); font-size: 0.95rem;
      outline: none; transition: all 0.2s; background: #fdfdfd; color: var(--text-dark);
      &:focus { border-color: var(--pink-400); background: white; box-shadow: 0 4px 15px rgba(236,72,153,0.1); }
      &.center { text-align: center; }
    }

    .qty-stepper {
      display: flex; align-items: center; background: white;
      border: 2px solid #eee; border-radius: 12px; overflow: hidden;
      &:focus-within { border-color: var(--pink-400); }
    }
    .qty-stepper button {
      width: 40px; height: 40px; border: none; background: transparent;
      font-size: 1.2rem; font-weight: 800; cursor: pointer;
      color: var(--pink-500); transition: background 0.2s;
      &:hover { background: var(--pink-50); }
    }
    .qty-stepper input {
      width: 50px; border: none; border-left: 2px solid #eee; border-right: 2px solid #eee;
      border-radius: 0;
    }

    .price-wrap {
      display: flex; align-items: center; border: 2px solid #eee;
      border-radius: 12px; overflow: hidden; flex: 1; background: white;
      &:focus-within { border-color: var(--pink-400); }
    }
    .currency { padding: 0 12px; font-weight: 800; color: #aaa; font-size: 1rem; }
    .price-wrap .field-input { border: none; border-radius: 0; }

    .edit-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .btn-sm {
      padding: 10px 18px; border-radius: 12px; font-weight: 800; font-size: 0.85rem;
      cursor: pointer; transition: all 0.2s; border: none; font-family: var(--font-body);
      &.cancel { background: #f3f4f6; color: #6b7280; }
      &.cancel:hover { background: #e5e7eb; }
      &.save { background: linear-gradient(135deg, var(--pink-400), var(--pink-600)); color: white; }
      &.save:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(255,107,157,0.3); }
      &.save:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    .preview-line {
      display: flex; justify-content: space-between; padding: 10px 14px;
      background: var(--pink-50); border-radius: 12px; font-weight: 700;
      font-size: 0.9rem; color: var(--pink-600); border: 1px dashed var(--pink-200);
    }
    .preview-total { color: var(--pink-700); font-weight: 800; }

    /* Add Item */
    .add-item-section { padding-top: 10px; }
    .btn-add-product {
      width: 100%; padding: 14px; border-radius: 14px; 
      border: 2px dashed var(--pink-300); background: transparent;
      color: var(--pink-600); font-weight: 800; font-size: 0.95rem;
      cursor: pointer; transition: all 0.2s; font-family: var(--font-body);
      display: flex; align-items: center; justify-content: center; gap: 8px;
      &:hover { border-color: var(--pink-500); background: var(--pink-50); box-shadow: 0 4px 15px rgba(255,107,157,0.1); }
    }
    .empty-items { text-align: center; padding: 2rem; color: #a1a1aa; font-weight: 600; font-size: 0.9rem; }
  `]
})
export class OrderItemsManagerComponent {
  Math = Math;

  @Input() order: OrderSummary | null = null;
  @Output() orderChanged = new EventEmitter<OrderSummary>();
  @Output() notify = new EventEmitter<{ msg: string, isError: boolean }>();

  editingItemId = signal<number | null>(null);
  showAddForm = signal(false);

  itemEdit = { productName: '', quantity: 1, unitPrice: 0 };
  newItem = { productName: '', quantity: 1, unitPrice: 0 };

  constructor(
    private api: ApiService,
    private confirm: ConfirmationService
  ) { }

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
    if (!this.order) return;
    this.api.updateOrderItem(this.order.id, item.id, {
      productName: this.itemEdit.productName,
      quantity: this.itemEdit.quantity,
      unitPrice: this.itemEdit.unitPrice
    }).subscribe({
      next: (updated) => {
        this.orderChanged.emit(updated);
        this.editingItemId.set(null);
        this.notify.emit({ msg: 'Producto actualizado ✨', isError: false });
      },
      error: () => this.notify.emit({ msg: 'Error al actualizar producto 😿', isError: true })
    });
  }

  addItem(): void {
    if (!this.order || !this.newItem.productName || this.newItem.unitPrice <= 0) return;
    this.api.addOrderItem(this.order.id, {
      productName: this.newItem.productName,
      quantity: this.newItem.quantity,
      unitPrice: this.newItem.unitPrice
    }).subscribe({
      next: (updated) => {
        this.orderChanged.emit(updated);
        this.newItem = { productName: '', quantity: 1, unitPrice: 0 };
        this.showAddForm.set(false);
        this.notify.emit({ msg: 'Producto agregado ✨', isError: false });
      },
      error: () => this.notify.emit({ msg: 'Error al agregar producto 😿', isError: true })
    });
  }

  async askDeleteItem(item: OrderItem): Promise<void> {
    if (!this.order) return;
    const confirmed = await this.confirm.confirm({
      title: 'Eliminar producto',
      message: `¿Segura que deseas eliminar "${item.productName}" del pedido?`,
      confirmText: 'Sí, eliminar',
      type: 'danger',
      icon: '🗑️'
    });
    if (!confirmed) return;

    this.api.deleteOrderItem(this.order.id, item.id).subscribe({
      next: (updated) => {
        this.orderChanged.emit(updated);
        this.notify.emit({ msg: 'Producto eliminado 🗑️', isError: false });
      },
      error: () => this.notify.emit({ msg: 'Error al eliminar producto 😿', isError: true })
    });
  }
}
