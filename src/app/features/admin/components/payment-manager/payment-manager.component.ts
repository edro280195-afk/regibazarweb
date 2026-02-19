import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { OrderSummary } from '../../../../shared/models/models';

@Component({
  selector: 'app-payment-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="payments-container fade-in">
      <div class="header">
        <div>
          <h2>💸 Gestión de Cobranza</h2>
          <p class="subtitle">Confirma entregas y controla tus cobros ✨</p>
        </div>
        <div class="stats-bar">
          <div class="stat-card">
            <span class="label">Por Cobrar</span>
            <span class="value text-red">{{ totalPending() | currency:'MXN' }}</span>
          </div>
          <div class="stat-card">
            <span class="label">Cobrado Hoy</span>
            <span class="value text-green">{{ totalCollectedToday() | currency:'MXN' }}</span>
          </div>
          <div class="stat-card">
            <span class="label">% Cobrado</span>
            <span class="value text-blue">{{ percentCollected() }}%</span>
          </div>
        </div>
      </div>

      <div class="toolbar">
        <div class="search-box">
          <span>🔍</span>
          <input type="text" placeholder="Buscar clienta o pedido..." [(ngModel)]="searchTerm">
        </div>
        <div class="filters">
          <button (click)="filter.set('all')" [class.active]="filter() === 'all'">Todos</button>
          <button (click)="filter.set('pending')" [class.active]="filter() === 'pending'">Por Cobrar</button>
          <button (click)="filter.set('delivered')" [class.active]="filter() === 'delivered'">Cobrados</button>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner">🎀</div>
          <p>Cargando pedidos...</p>
        </div>
      } @else {
        <div class="orders-grid">
          @for (order of filteredOrders(); track order.id) {
            <div class="order-card" [class.paid]="order.status === 'Delivered'" [class.canceled]="order.status === 'Canceled'">
              <div class="card-header">
                <span class="order-id">#{{ order.id }}</span>
                <span class="status-badge" [attr.data-status]="order.status">
                  {{ orderStatusLabel(order) }}
                </span>
              </div>
              
              <div class="card-body">
                <h3>{{ order.clientName }}</h3>
                <p class="date">{{ order.createdAt | date:'mediumDate' }}</p>

                <div class="order-type">
                  <span class="type-tag" [class.pickup]="order.orderType === 'PickUp'">
                    {{ order.orderType === 'PickUp' ? '🛍️ Recoge en local' : '🛵 Envío a domicilio' }}
                  </span>
                </div>

                <div class="items-preview">
                  @for (item of order.items.slice(0, 3); track item.id) {
                    <span class="item-mini">{{ item.quantity }}× {{ item.productName }}</span>
                  }
                  @if (order.items.length > 3) {
                    <span class="item-mini more">+{{ order.items.length - 3 }} más</span>
                  }
                </div>
                
                <div class="financials">
                  <div class="row">
                    <span>Total:</span>
                    <strong>{{ order.total | currency:'MXN' }}</strong>
                  </div>
                </div>
              </div>

              <div class="card-actions">
                @if (isPendingPayment(order)) {
                  <button class="btn-pay" (click)="openConfirmModal(order)">
                    💰 Confirmar Cobro
                  </button>
                } @else if (order.status === 'Delivered') {
                  <div class="paid-badge">✅ Entregado y Cobrado</div>
                } @else if (order.status === 'Canceled') {
                  <div class="canceled-badge">🚫 Cancelado</div>
                }
              </div>
            </div>
          } @empty {
            <div class="empty-state">
              <div class="empty-icon">💸</div>
              <h3>No hay pedidos</h3>
              <p>No se encontraron pedidos con los filtros actuales</p>
            </div>
          }
        </div>
      }

      <!-- CONFIRM PAYMENT MODAL -->
      @if (selectedOrder) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Confirmar Cobro #{{ selectedOrder.id }}</h3>
              <button class="btn-close" (click)="closeModal()">✕</button>
            </div>
            <div class="modal-body">
              <div class="confirm-summary">
                <p class="client-name">{{ selectedOrder.clientName }}</p>
                <p class="order-type-label">
                  {{ selectedOrder.orderType === 'PickUp' ? '🛍️ Recoge en local' : '🛵 Envío a domicilio' }}
                </p>
                <div class="items-list">
                  @for (item of selectedOrder.items; track item.id) {
                    <div class="item-row">
                      <span>{{ item.quantity }}× {{ item.productName }}</span>
                      <span>{{ item.lineTotal | currency:'MXN' }}</span>
                    </div>
                  }
                </div>
                <div class="total-row">
                  <strong>Total a Cobrar:</strong>
                  <strong class="total-value">{{ selectedOrder.total | currency:'MXN' }}</strong>
                </div>
              </div>

              <div class="form-group">
                <label>Método de Pago</label>
                <div class="method-grid">
                  <button [class.selected]="paymentMethod === 'Efectivo'" (click)="paymentMethod = 'Efectivo'">💵 Efectivo</button>
                  <button [class.selected]="paymentMethod === 'Transferencia'" (click)="paymentMethod = 'Transferencia'">🏦 Transfer</button>
                  <button [class.selected]="paymentMethod === 'OXXO'" (click)="paymentMethod = 'OXXO'">🏪 OXXO</button>
                  <button [class.selected]="paymentMethod === 'Tarjeta'" (click)="paymentMethod = 'Tarjeta'">💳 Tarjeta</button>
                </div>
              </div>

              <div class="modal-actions">
                <button class="btn-cancel" (click)="closeModal()">Cancelar</button>
                <button class="btn-confirm" [disabled]="confirming()" (click)="confirmPayment()">
                  @if (confirming()) {
                    Procesando...
                  } @else {
                    ✅ Confirmar Entrega y Cobro
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- TOAST -->
      @if (toastMessage()) {
        <div class="toast" [class.error]="toastIsError()">{{ toastMessage() }}</div>
      }
    </div>
  `,
  styles: [`
    .payments-container { padding: 1.5rem; max-width: 1200px; margin: 0 auto; color: var(--text-dark); }
    .fade-in { animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
    h2 { font-family: var(--font-display); font-size: 2rem; margin: 0; color: var(--pink-600); }
    .subtitle { color: var(--text-muted); margin: 0.5rem 0 0; }

    .stats-bar { display: flex; gap: 1rem; flex-wrap: wrap; }
    .stat-card {
      background: var(--bg-card, white); padding: 0.8rem 1.2rem; border-radius: 1rem;
      box-shadow: var(--shadow-sm); border: 1px solid var(--border-soft);
      display: flex; flex-direction: column; min-width: 130px;
    }
    .stat-card .label { font-size: 0.8rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; }
    .stat-card .value { font-size: 1.4rem; font-weight: 800; }
    .text-red { color: #ef4444; } .text-green { color: #22c55e; } .text-blue { color: #3b82f6; }

    .toolbar {
      display: flex; justify-content: space-between; margin-bottom: 1.5rem;
      background: var(--bg-card, white); padding: 0.8rem; border-radius: 1rem; box-shadow: var(--shadow-sm);
      flex-wrap: wrap; gap: 1rem;
    }
    .search-box {
      flex: 1; min-width: 250px; display: flex; align-items: center; gap: 0.5rem;
      background: var(--bg-main); padding: 0.5rem 1rem; border-radius: 2rem;
    }
    .search-box input { border: none; background: transparent; flex: 1; outline: none; font-size: 0.95rem; color: var(--text-dark); }
    .filters { display: flex; gap: 0.5rem; overflow-x: auto; }
    .filters button {
      border: none; background: transparent; padding: 0.5rem 1rem;
      border-radius: 2rem; font-weight: 600; color: var(--text-muted); cursor: pointer;
      transition: all 0.2s; white-space: nowrap;
    }
    .filters button:hover { background: var(--pink-50); color: var(--pink-500); }
    .filters button.active { background: var(--pink-100); color: var(--pink-600); }

    .orders-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;
    }
    .order-card {
      background: var(--bg-card, white); border-radius: 1.2rem; padding: 1.2rem;
      box-shadow: var(--shadow-sm); border: 1px solid var(--border-soft);
      display: flex; flex-direction: column; gap: 1rem; transition: transform 0.2s;
    }
    .order-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
    .order-card.paid { border-left: 5px solid #22c55e; }
    .order-card.canceled { border-left: 5px solid #ef4444; opacity: 0.6; }

    .card-header { display: flex; justify-content: space-between; align-items: center; }
    .order-id { font-weight: 800; color: var(--text-muted); font-size: 0.9rem; }
    .status-badge {
      padding: 0.3rem 0.8rem; border-radius: 2rem; font-size: 0.75rem; font-weight: 700;
    }
    .status-badge[data-status="Pending"] { background: #fee2e2; color: #ef4444; }
    .status-badge[data-status="InRoute"] { background: #dbeafe; color: #2563eb; }
    .status-badge[data-status="Delivered"] { background: #dcfce7; color: #16a34a; }
    .status-badge[data-status="Canceled"] { background: #f3f4f6; color: #6b7280; }
    .status-badge[data-status="Postponed"] { background: #f3e8ff; color: #7c3aed; }

    .card-body h3 { margin: 0; font-size: 1.1rem; color: var(--text-dark); }
    .date { margin: 0; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem; }

    .order-type { margin-bottom: 0.5rem; }
    .type-tag {
      font-size: 0.8rem; padding: 4px 10px; border-radius: 10px;
      background: #e0f2fe; color: #0284c7; font-weight: 700;
    }
    .type-tag.pickup { background: #f3e8ff; color: #9333ea; }

    .items-preview { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 0.5rem; }
    .item-mini {
      font-size: 0.75rem; background: var(--bg-main, #f9fafb); padding: 3px 8px;
      border-radius: 6px; color: var(--text-medium); font-weight: 600;
    }
    .item-mini.more { background: var(--pink-50); color: var(--pink-500); }

    .financials .row { display: flex; justify-content: space-between; margin-bottom: 0.3rem; font-size: 1rem; }
    .financials .row strong { color: var(--pink-600); font-size: 1.1rem; }

    .card-actions { margin-top: auto; }
    .btn-pay {
      width: 100%; border: none; padding: 0.7rem; border-radius: 0.8rem;
      font-weight: 700; cursor: pointer; transition: all 0.2s;
      background: var(--pink-100); color: var(--pink-600); font-size: 0.95rem;
    }
    .btn-pay:hover { background: var(--pink-200); transform: translateY(-2px); }

    .paid-badge {
      text-align: center; padding: 0.6rem; border-radius: 0.8rem;
      background: #dcfce7; color: #16a34a; font-weight: 700; font-size: 0.9rem;
    }
    .canceled-badge {
      text-align: center; padding: 0.6rem; border-radius: 0.8rem;
      background: #f3f4f6; color: #6b7280; font-weight: 700; font-size: 0.9rem;
    }

    /* Modal */
    .modal-backdrop {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;
      backdrop-filter: blur(4px); animation: fadeIn 0.2s;
    }
    .modal-content {
      background: var(--bg-card, white); width: 90%; max-width: 480px; border-radius: 1.5rem;
      padding: 1.5rem; box-shadow: var(--shadow-lg, 0 20px 50px rgba(0,0,0,0.3)); animation: slideUp 0.3s;
    }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .modal-header h3 { margin: 0; font-family: var(--font-display); color: var(--text-dark); }
    .btn-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted); }

    .confirm-summary { margin-bottom: 1.5rem; }
    .client-name { font-size: 1.2rem; font-weight: 800; margin: 0 0 0.3rem; color: var(--text-dark); }
    .order-type-label { margin: 0 0 1rem; color: var(--text-muted); font-weight: 600; }
    .items-list { border-top: 1px solid var(--border-soft); padding-top: 0.8rem; margin-bottom: 0.8rem; }
    .item-row {
      display: flex; justify-content: space-between; padding: 0.3rem 0;
      font-size: 0.9rem; color: var(--text-medium);
    }
    .total-row {
      display: flex; justify-content: space-between; padding-top: 0.8rem;
      border-top: 2px solid var(--pink-200); font-size: 1.1rem;
    }
    .total-value { color: var(--pink-600); }

    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-weight: 700; margin-bottom: 0.5rem; color: var(--text-dark); }
    .method-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
    .method-grid button {
      padding: 0.8rem; border: 1px solid var(--border-soft); background: var(--bg-card, white);
      border-radius: 0.8rem; cursor: pointer; font-weight: 600; transition: all 0.2s;
      color: var(--text-dark);
    }
    .method-grid button:hover { background: var(--bg-main); }
    .method-grid button.selected { border-color: var(--pink-500); background: var(--pink-50); color: var(--pink-600); }

    .modal-actions { display: flex; gap: 1rem; margin-top: 1.5rem; }
    .modal-actions button { flex: 1; padding: 0.8rem; border-radius: 0.8rem; border: none; font-weight: 700; cursor: pointer; font-size: 0.95rem; }
    .btn-cancel { background: #f3f4f6; color: var(--text-dark); }
    .btn-confirm { background: #22c55e; color: white; }
    .btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Toast */
    .toast {
      position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
      background: #1e293b; color: white; padding: 0.8rem 1.5rem; border-radius: 1rem;
      font-weight: 700; z-index: 1100; animation: slideUp 0.3s;
    }
    .toast.error { background: #ef4444; }

    /* Loading */
    .loading-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 300px; color: var(--pink-400); font-family: var(--font-display);
    }
    .spinner { font-size: 3rem; animation: spin 1s infinite linear; margin-bottom: 1rem; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    .empty-state {
      grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--text-muted);
    }
    .empty-icon { font-size: 4rem; margin-bottom: 1rem; }
    .empty-state h3 { margin: 0 0 0.5rem; color: var(--text-dark); }

    @media (max-width: 768px) {
      .header { flex-direction: column; align-items: flex-start; }
      .stats-bar { width: 100%; }
      .stat-card { flex: 1; min-width: 0; }
      .orders-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class PaymentManagerComponent implements OnInit {
  orders = signal<OrderSummary[]>([]);
  loading = signal(true);
  searchTerm = '';
  filter = signal<'all' | 'pending' | 'delivered'>('all');

  selectedOrder: OrderSummary | null = null;
  paymentMethod: string = 'Efectivo';
  confirming = signal(false);

  toastMessage = signal('');
  toastIsError = signal(false);

  constructor(private api: ApiService) { }

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders() {
    this.loading.set(true);
    this.api.getOrders().subscribe({
      next: (data) => {
        // Solo pedidos activos (excluir cancelados del cálculo, pero mostrar en lista)
        this.orders.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.showToast('Error al cargar pedidos 😿', true);
        this.loading.set(false);
      }
    });
  }

  filteredOrders = computed(() => {
    let list = this.orders();
    const term = this.searchTerm.toLowerCase();
    const f = this.filter();

    // Excluir cancelados y pospuestos de la vista de cobranza
    list = list.filter(o => o.status !== 'Canceled' && o.status !== 'Postponed');

    if (f === 'pending') {
      list = list.filter(o => this.isPendingPayment(o));
    } else if (f === 'delivered') {
      list = list.filter(o => o.status === 'Delivered');
    }

    if (term) {
      list = list.filter(o =>
        o.clientName.toLowerCase().includes(term) ||
        o.id.toString().includes(term)
      );
    }

    return list;
  });

  // ═══════════════ KPIs REALES ═══════════════

  totalPending = computed(() => {
    return this.orders()
      .filter(o => this.isPendingPayment(o))
      .reduce((acc, o) => acc + o.total, 0);
  });

  totalCollectedToday = computed(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return this.orders()
      .filter(o => {
        if (o.status !== 'Delivered') return false;
        const created = new Date(o.createdAt);
        return created >= startOfDay;
      })
      .reduce((acc, o) => acc + o.total, 0);
  });

  percentCollected = computed(() => {
    const activeOrders = this.orders().filter(o =>
      o.status !== 'Canceled' && o.status !== 'Postponed'
    );
    const total = activeOrders.length;
    const delivered = activeOrders.filter(o => o.status === 'Delivered').length;
    return total > 0 ? Math.round((delivered / total) * 100) : 0;
  });

  // ═══════════════ HELPERS ═══════════════

  isPendingPayment(order: OrderSummary): boolean {
    return order.status === 'Pending' || order.status === 'InRoute';
  }

  orderStatusLabel(order: OrderSummary): string {
    const labels: Record<string, string> = {
      'Pending': '⏳ Pendiente',
      'InRoute': '🚗 En Ruta',
      'Delivered': '💝 Entregado',
      'Canceled': '🚫 Cancelado',
      'Postponed': '📅 Pospuesto'
    };
    return labels[order.status] || order.status;
  }

  // ═══════════════ CONFIRM COBRO ═══════════════

  openConfirmModal(order: OrderSummary) {
    this.selectedOrder = order;
    this.paymentMethod = 'Efectivo';
  }

  closeModal() {
    this.selectedOrder = null;
  }

  confirmPayment() {
    if (!this.selectedOrder) return;
    this.confirming.set(true);

    const orderId = this.selectedOrder.id;

    // Llamar al API real: marcar como Entregado
    this.api.updateOrderStatus(orderId, { status: 'Delivered' }).subscribe({
      next: (updatedOrder) => {
        // Actualizar estado local
        this.orders.update(prev => prev.map(o =>
          o.id === orderId ? { ...o, status: 'Delivered' } : o
        ));
        this.confirming.set(false);
        this.closeModal();
        this.showToast(`Pedido #${orderId} marcado como entregado y cobrado ✅`);
      },
      error: (err) => {
        this.confirming.set(false);
        const msg = err.error?.message || 'Error al confirmar el pago';
        this.showToast(msg + ' 😿', true);
      }
    });
  }

  // ═══════════════ TOAST ═══════════════

  showToast(msg: string, isError = false) {
    this.toastMessage.set(msg);
    this.toastIsError.set(isError);
    setTimeout(() => this.toastMessage.set(''), 3000);
  }
}
