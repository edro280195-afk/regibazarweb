import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { OrderSummary, Payment } from '../../../../shared/models/models';

@Component({
    selector: 'app-payment-manager',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="payments-container fade-in">
      <div class="header">
        <div>
          <h2>💸 Gestión de Cobranza</h2>
          <p class="subtitle">Administra los pagos pendientes y confirma ingresos.</p>
        </div>
        <div class="stats-bar">
          <div class="stat-card">
            <span class="label">Total Pendiente</span>
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
          <i class="fas fa-search"></i>
          <input type="text" placeholder="Buscar clienta o pedido..." [(ngModel)]="searchTerm">
        </div>
        <div class="filters">
          <button (click)="filter.set('all')" [class.active]="filter() === 'all'">Todos</button>
          <button (click)="filter.set('Unpaid')" [class.active]="filter() === 'Unpaid'">Pendientes</button>
          <button (click)="filter.set('Partial')" [class.active]="filter() === 'Partial'">Parciales</button>
          <button (click)="filter.set('Paid')" [class.active]="filter() === 'Paid'">Pagados</button>
        </div>
      </div>

      <div class="orders-grid">
        <div class="order-card" *ngFor="let order of filteredOrders()" [class.paid]="order.paymentStatus === 'Paid'">
          <div class="card-header">
            <span class="order-id">#{{ order.id }}</span>
            <span class="status-badge" [ngClass]="order.paymentStatus || 'Unpaid'">
              {{ getStatusLabel(order.paymentStatus || 'Unpaid') }}
            </span>
          </div>
          
          <div class="card-body">
            <h3>{{ order.clientName }}</h3>
            <p class="date">{{ order.createdAt | date:'mediumDate' }}</p>
            
            <div class="financials">
              <div class="row">
                <span>Total:</span>
                <strong>{{ order.total | currency:'MXN' }}</strong>
              </div>
              <div class="row paid text-green" *ngIf="order.amountPaid && order.amountPaid > 0">
                <span>Pagado:</span>
                <strong>{{ order.amountPaid | currency:'MXN' }}</strong>
              </div>
              <div class="row pending text-red" *ngIf="(order.amountDue ?? order.total) > 0">
                <span>Resta:</span>
                <strong>{{ (order.amountDue ?? order.total) | currency:'MXN' }}</strong>
              </div>
            </div>

            <div class="progress-bar" *ngIf="order.amountPaid && order.amountPaid > 0">
              <div class="fill" [style.width.%]="(order.amountPaid / order.total) * 100"></div>
            </div>
          </div>

          <div class="card-actions">
            <button class="btn-history" (click)="viewHistory(order)" title="Ver historial">
              📜
            </button>
            <button class="btn-pay" *ngIf="order.paymentStatus !== 'Paid'" (click)="openPaymentModal(order)">
              💰 Registrar Pago
            </button>
            <button class="btn-receipt" *ngIf="order.paymentStatus === 'Paid'" (click)="generateReceipt(order)">
              🧾 Recibo
            </button>
          </div>
        </div>
      </div>

      <!-- PAYMENT MODAL -->
      <div class="modal-backdrop" *ngIf="selectedOrder" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Registrar Pago #{{ selectedOrder.id }}</h3>
            <button class="btn-close" (click)="closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="amount-info">
              <p>Total del pedido: <strong>{{ selectedOrder.total | currency:'MXN' }}</strong></p>
              <p>Monto restante: <strong class="text-red">{{ (selectedOrder.amountDue ?? selectedOrder.total) | currency:'MXN' }}</strong></p>
            </div>

            <div class="form-group">
              <label>Monto a pagar</label>
              <div class="input-prefix">
                <span>$</span>
                <input type="number" [(ngModel)]="paymentForm.amount" (input)="validateAmount()">
              </div>
              <div class="quick-amounts">
                <button (click)="setAmount('total')">Total Restante</button>
                <button (click)="setAmount('half')">50%</button>
              </div>
            </div>

            <div class="form-group">
              <label>Método de Pago</label>
              <div class="method-grid">
                <button [class.selected]="paymentForm.method === 'Efectivo'" (click)="paymentForm.method = 'Efectivo'">💵 Efectivo</button>
                <button [class.selected]="paymentForm.method === 'Transferencia'" (click)="paymentForm.method = 'Transferencia'">🏦 Transfer</button>
                <button [class.selected]="paymentForm.method === 'OXXO'" (click)="paymentForm.method = 'OXXO'">🏪 OXXO</button>
                <button [class.selected]="paymentForm.method === 'Tarjeta'" (click)="paymentForm.method = 'Tarjeta'">💳 Tarjeta</button>
              </div>
            </div>

            <div class="form-group">
              <label>Referencia / Notas (Opcional)</label>
              <input type="text" [(ngModel)]="paymentForm.notes" placeholder="#12345 o Comentarios...">
            </div>

            <div class="modal-actions">
              <button class="btn-cancel" (click)="closeModal()">Cancelar</button>
              <button class="btn-confirm" [disabled]="!isValidPayment()" (click)="confirmPayment()">
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      </div>
       <!-- HISTORY MODAL -->
      <div class="modal-backdrop" *ngIf="showHistory && historyOrder" (click)="closeHistory()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Historial de Pagos #{{ historyOrder.id }}</h3>
            <button class="btn-close" (click)="closeHistory()">✕</button>
          </div>
          <div class="modal-body">
            <div class="history-list" *ngIf="historyOrder.payments?.length; else noPayments">
              <div class="history-item" *ngFor="let p of historyOrder.payments">
                <div class="h-left">
                  <span class="h-method">{{ p.method }}</span>
                  <span class="h-date">{{ p.date | date:'short' }}</span>
                </div>
                <div class="h-right">
                  <strong class="h-amount">+{{ p.amount | currency:'MXN' }}</strong>
                </div>
              </div>
            </div>
            <ng-template #noPayments>
              <p class="empty-state">No hay pagos registrados aún.</p>
            </ng-template>
          </div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .payments-container { padding: 1.5rem; max-width: 1200px; margin: 0 auto; color: var(--text-dark); }
    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
    h2 { font-family: var(--font-display); font-size: 2rem; margin: 0; color: var(--pink-600); }
    .subtitle { color: var(--text-muted); margin: 0.5rem 0 0; }

    .stats-bar { display: flex; gap: 1rem; }
    .stat-card {
      background: white; padding: 0.8rem 1.2rem; border-radius: 1rem;
      box-shadow: var(--shadow-sm); border: 1px solid var(--border-soft);
      display: flex; flex-direction: column; min-width: 140px;
    }
    .stat-card .label { font-size: 0.8rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; }
    .stat-card .value { font-size: 1.4rem; font-weight: 800; }
    .text-red { color: #ef4444; } .text-green { color: #22c55e; } .text-blue { color: #3b82f6; }

    .toolbar {
      display: flex; justify-content: space-between; margin-bottom: 1.5rem;
      background: white; padding: 0.8rem; border-radius: 1rem; box-shadow: var(--shadow-sm);
      flex-wrap: wrap; gap: 1rem;
    }
    .search-box {
      flex: 1; min-width: 250px; display: flex; align-items: center; gap: 0.5rem;
      background: var(--bg-main); padding: 0.5rem 1rem; border-radius: 2rem;
      i { color: var(--text-muted); }
      input { border: none; background: transparent; flex: 1; outline: none; font-size: 0.95rem; }
    }
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
      background: white; border-radius: 1.2rem; padding: 1.2rem;
      box-shadow: var(--shadow-sm); border: 1px solid var(--border-soft);
      display: flex; flex-direction: column; gap: 1rem; transition: transform 0.2s;
    }
    .order-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
    .order-card.paid { border-left: 5px solid #22c55e; }

    .card-header { display: flex; justify-content: space-between; align-items: center; }
    .order-id { font-weight: 800; color: var(--text-muted); font-size: 0.9rem; }
    .status-badge {
      padding: 0.3rem 0.8rem; border-radius: 2rem; font-size: 0.75rem; font-weight: 700;
    }
    .status-badge.Unpaid { background: #fee2e2; color: #ef4444; }
    .status-badge.Partial { background: #fef3c7; color: #d97706; }
    .status-badge.Paid { background: #dcfce7; color: #16a34a; }

    .card-body h3 { margin: 0; font-size: 1.1rem; color: var(--text-dark); }
    .date { margin: 0; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem; }
    .financials .row { display: flex; justify-content: space-between; margin-bottom: 0.3rem; font-size: 0.9rem; }
    .progress-bar { height: 6px; background: #f3f4f6; border-radius: 3px; overflow: hidden; margin-top: 0.5rem; }
    .progress-bar .fill { height: 100%; background: #22c55e; transition: width 0.3s ease; }

    .card-actions { display: flex; gap: 0.5rem; margin-top: auto; }
    .btn-pay, .btn-receipt {
      flex: 1; border: none; padding: 0.6rem; border-radius: 0.6rem;
      font-weight: 700; cursor: pointer; transition: all 0.2s;
    }
    .btn-pay { background: var(--pink-100); color: var(--pink-600); }
    .btn-pay:hover { background: var(--pink-200); }
    .btn-receipt { background: #f3f4f6; color: var(--text-dark); }
    .btn-receipt:hover { background: #e5e7eb; }
    .btn-history { background: none; border: 1px solid var(--border-soft); border-radius: 0.6rem; padding: 0.6rem; cursor: pointer; }

    /* Modal */
    .modal-backdrop {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;
      backdrop-filter: blur(4px); animation: fadeIn 0.2s;
    }
    .modal-content {
      background: white; width: 90%; max-width: 450px; border-radius: 1.5rem;
      padding: 1.5rem; box-shadow: var(--shadow-lg); animation: slideUp 0.3s;
    }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .modal-header h3 { margin: 0; }
    .btn-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; }

    .input-prefix {
      display: flex; align-items: center; background: var(--bg-main);
      border-radius: 0.8rem; padding: 0 1rem; border: 1px solid var(--border-soft);
      span { font-weight: bold; color: var(--text-muted); }
      input { flex: 1; border: none; background: transparent; padding: 0.8rem; font-size: 1.2rem; font-weight: 700; outline: none; }
    }
    .quick-amounts { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
    .quick-amounts button {
      flex: 1; border: 1px solid var(--pink-200); background: var(--pink-50);
      color: var(--pink-600); padding: 0.4rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.8rem;
    }

    .method-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
    .method-grid button {
      padding: 0.8rem; border: 1px solid var(--border-soft); background: white;
      border-radius: 0.8rem; cursor: pointer; font-weight: 600; transition: all 0.2s;
    }
    .method-grid button:hover { background: var(--bg-main); }
    .method-grid button.selected { border-color: var(--pink-500); background: var(--pink-50); color: var(--pink-600); }

    .modal-actions { display: flex; gap: 1rem; margin-top: 2rem; }
    .modal-actions button { flex: 1; padding: 0.8rem; border-radius: 0.8rem; border: none; font-weight: 700; cursor: pointer; }
    .btn-cancel { background: #f3f4f6; color: var(--text-dark); }
    .btn-confirm { background: #22c55e; color: white; }
    .btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

    .history-item { display: flex; justify-content: space-between; padding: 0.8rem 0; border-bottom: 1px solid var(--border-soft); }
    .h-method { display: block; font-weight: 700; font-size: 0.9rem; }
    .h-date { font-size: 0.75rem; color: var(--text-muted); }
    .h-amount { color: #22c55e; }

    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `]
})
export class PaymentManagerComponent implements OnInit {
    orders = signal<OrderSummary[]>([]);
    searchTerm = '';
    filter = signal<'all' | 'Unpaid' | 'Partial' | 'Paid'>('all');

    selectedOrder: OrderSummary | null = null;
    historyOrder: OrderSummary | null = null;
    showHistory = false;

    paymentForm = {
        amount: 0,
        method: 'Efectivo' as Payment['method'],
        notes: ''
    };

    constructor(private api: ApiService) { }

    ngOnInit() {
        this.api.getOrders().subscribe(data => {
            // Mock Data Enriched for demo if info missing
            const enriched = data.map(o => ({
                ...o,
                paymentStatus: o.paymentStatus || 'Unpaid',
                amountPaid: o.amountPaid || 0,
                amountDue: o.amountDue ?? o.total,
                payments: o.payments || []
            }));
            this.orders.set(enriched);
        });
    }

    filteredOrders = computed(() => {
        let list = this.orders();
        const term = this.searchTerm.toLowerCase();
        const f = this.filter();

        if (f !== 'all') {
            list = list.filter(o => o.paymentStatus === f);
        }

        if (term) {
            list = list.filter(o =>
                o.clientName.toLowerCase().includes(term) ||
                o.id.toString().includes(term)
            );
        }
        return list;
    });

    totalPending = computed(() =>
        this.orders().reduce((acc, o) => acc + (o.amountDue ?? o.total), 0)
    );

    totalCollectedToday = computed(() => {
        // Mock logic: Sum of payments with today's date
        // For now showing total gathered in the mock data
        return this.orders().reduce((acc, o) => acc + (o.amountPaid || 0), 0);
    });

    percentCollected = computed(() => {
        const total = this.orders().reduce((acc, o) => acc + o.total, 0);
        const paid = this.orders().reduce((acc, o) => acc + (o.amountPaid || 0), 0);
        return total > 0 ? Math.round((paid / total) * 100) : 0;
    });

    getStatusLabel(status: string) {
        const map: any = { 'Unpaid': 'Pendiente', 'Partial': 'Parcial', 'Paid': 'Pagado' };
        return map[status] || status;
    }

    openPaymentModal(order: OrderSummary) {
        this.selectedOrder = order;
        this.paymentForm = {
            amount: order.amountDue ?? order.total,
            method: 'Efectivo',
            notes: ''
        };
    }

    closeModal() {
        this.selectedOrder = null;
    }

    setAmount(type: 'total' | 'half') {
        if (!this.selectedOrder) return;
        const due = this.selectedOrder.amountDue ?? this.selectedOrder.total;
        if (type === 'total') this.paymentForm.amount = due;
        if (type === 'half') this.paymentForm.amount = Math.floor(due / 2);
    }

    validateAmount() {
        if (!this.selectedOrder) return;
        const due = this.selectedOrder.amountDue ?? this.selectedOrder.total;
        if (this.paymentForm.amount > due) this.paymentForm.amount = due;
        if (this.paymentForm.amount < 0) this.paymentForm.amount = 0;
    }

    isValidPayment() {
        return this.paymentForm.amount > 0;
    }

    confirmPayment() {
        if (!this.selectedOrder) return;

        // Simulate API call
        const payment: Payment = {
            id: Math.floor(Math.random() * 10000),
            orderId: this.selectedOrder.id,
            amount: this.paymentForm.amount,
            method: this.paymentForm.method,
            date: new Date().toISOString(),
            notes: this.paymentForm.notes,
            createdAt: new Date().toISOString()
        };

        // Update Local State (Optimistic UI)
        this.orders.update(prev => prev.map(o => {
            if (o.id === this.selectedOrder!.id) {
                const newPaid = (o.amountPaid || 0) + payment.amount;
                const newDue = o.total - newPaid;
                const newStatus = newDue <= 0.5 ? 'Paid' : 'Partial'; // 0.5 tolerance for float math

                return {
                    ...o,
                    amountPaid: newPaid,
                    amountDue: newDue,
                    paymentStatus: newStatus,
                    payments: [...(o.payments || []), payment]
                };
            }
            return o;
        }));

        this.closeModal();
        // Here we would call this.api.addPayment(payment)
    }

    viewHistory(order: OrderSummary) {
        this.historyOrder = order;
        this.showHistory = true;
    }

    closeHistory() {
        this.showHistory = false;
        this.historyOrder = null;
    }

    generateReceipt(order: OrderSummary) {
        alert(`Generando recibo para Orden #${order.id}...\n(Próximamente descarga PDF)`);
    }
}
