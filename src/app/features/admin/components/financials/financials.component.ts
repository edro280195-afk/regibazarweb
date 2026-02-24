import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { FinancialReport, DriverExpense, Investment, OrderSummary } from '../../../../shared/models/models';

@Component({
  selector: 'app-financials',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="financials-page">
      <header class="page-header">
        <div>
          <h2>Finanzas y Reportes 📈</h2>
          <p class="page-sub">Balance de ingresos, egresos e inversiones 💰</p>
        </div>
        
        <div class="date-controls">
          <div class="control-group">
            <label>Desde</label>
            <input type="date" [(ngModel)]="startDate" (change)="loadData()">
          </div>
          <div class="control-group">
            <label>Hasta</label>
            <input type="date" [(ngModel)]="endDate" (change)="loadData()">
          </div>
          <button class="btn-refresh" (click)="loadData()" [disabled]="loading()">
            {{ loading() ? 'Cargando...' : '🔄 Actualizar' }}
          </button>
        </div>
      </header>
      
      <!-- ═══ SUMMARY CARDS ═══ -->
      <div class="summary-grid">
        <div class="summary-card income">
          <div class="card-icon">💸</div>
          <div class="card-data">
            <span class="label">Ingresos (Ventas)</span>
            <span class="value">$ {{ report()?.totalIncome | number:'1.2-2' }}</span>
          </div>
        </div>

        <div class="summary-card investment">
          <div class="card-icon">📦</div>
          <div class="card-data">
            <span class="label">Inversión (Proveedores)</span>
            <span class="value">$ {{ report()?.totalInvestment | number:'1.2-2' }}</span>
          </div>
        </div>

        <div class="summary-card expense">
          <div class="card-icon">⛽</div>
          <div class="card-data">
            <span class="label">Gastos Operativos (Drivers)</span>
            <span class="value">$ {{ report()?.totalExpenses | number:'1.2-2' }}</span>
          </div>
        </div>

        <div class="summary-card profit" [class.negative]="(report()?.netProfit || 0) < 0">
          <div class="card-icon">🚀</div>
          <div class="card-data">
            <span class="label">Utilidad Neta</span>
            <span class="value">$ {{ report()?.netProfit | number:'1.2-2' }}</span>
          </div>
        </div>
      </div>

      <!-- ═══ DETAILS TABS ═══ -->
      <div class="details-section">
        <div class="tabs">
          <button [class.active]="activeTab() === 'investments'" (click)="activeTab.set('investments')">
            📦 Inversiones
          </button>
          <button [class.active]="activeTab() === 'expenses'" (click)="activeTab.set('expenses')">
            ⛽ Gastos Drivers
          </button>
        </div>

        <div class="tab-content">
          @if (activeTab() === 'investments') {
            <table class="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Nota</th>
                  <th class="text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                @for (inv of report()?.details?.investments; track inv.id) {
                  <tr>
                    <td>{{ inv.date | date:'dd/MM/yyyy' }}</td>
                    <td>{{ inv.supplierName }}</td>
                    <td>{{ inv.notes || '-' }}</td>
                    <td class="text-right font-bold">$ {{ inv.amount | number:'1.2-2' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="empty">No hay inversiones en este periodo.</td></tr>
                }
              </tbody>
            </table>
          }

          @if (activeTab() === 'expenses') {
            <div class="tab-actions" style="display:flex; justify-content: flex-end; padding: 1rem 1.5rem 0;">
                <button class="btn-refresh" (click)="openExpenseModal()">+ Añadir Gasto</button>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Ruta</th>
                  <th>Chofer</th>
                  <th>Tipo</th>
                  <th>Nota</th>
                  <th class="text-right">Monto</th>
                  <th class="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (exp of report()?.details?.expenses; track exp.id) {
                  <tr>
                    <td>{{ exp.date | date:'dd/MM/yyyy' }}</td>
                    <td>{{ exp.routeName || ('Ruta ' + exp.driverRouteId) || 'N/A' }}</td>
                    <td>{{ exp.driverName || 'N/A' }}</td>
                    <td><span class="badge">{{ exp.expenseType }}</span></td>
                    <td>{{ exp.notes || '-' }}</td>
                    <td class="text-right font-bold">$ {{ exp.amount | number:'1.2-2' }}</td>
                    <td class="text-center" style="display:flex; justify-content:center; gap:0.5rem;">
                       <button class="btn-icon" (click)="openExpenseModal(exp)" title="Editar">✏️</button>
                       <button class="btn-icon" style="color:red; background: #fee2e2" (click)="deleteExpense(exp.id)" title="Eliminar">🗑️</button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="empty">No hay gastos registrados en este periodo.</td></tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>

      <!-- MODAL GASTOS -->
@if (showExpenseModal()) {
        <div class="modal-backdrop" (click)="showExpenseModal.set(false)">
          <div class="modal-content coquette-modal" (click)="$event.stopPropagation()">
            
            <div class="sparkle s1">✨</div>
            <div class="sparkle s2">🌸</div>

            <div class="modal-header">
              <div class="header-title">
                <h3>{{ isEditingExpense() ? 'Editar Magia' : 'Nuevo Gasto' }} 🎀</h3>
                <p class="modal-subtitle">Registra los movimientos de tus rutas</p>
              </div>
              <button class="btn-close" (click)="showExpenseModal.set(false)">✖</button>
            </div>
            
            <div class="modal-body form-grid">
              
              <div class="form-group full-width">
                <label>📍 Ruta (Requerida)</label>
                <select [(ngModel)]="expenseForm.driverRouteId" class="form-input custom-select">
                  <option [ngValue]="null" disabled selected>Selecciona la ruta...</option>
                  @for (r of routes(); track r.id) {
                    <option [ngValue]="r.id">{{ r.name }}</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label>💸 Monto ($)</label>
                <div class="input-with-icon">
                  <input type="number" [(ngModel)]="expenseForm.amount" class="form-input" placeholder="Ej. 500">
                </div>
              </div>

              <div class="form-group">
                <label>🏷️ Tipo de Gasto</label>
                <select [(ngModel)]="expenseForm.expenseType" class="form-input custom-select">
                  @for (t of expenseTypes; track t) {
                    <option [value]="t">{{t}}</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label>📅 Fecha</label>
                <input type="date" [(ngModel)]="expenseForm.date" class="form-input">
              </div>

              <div class="form-group full-width">
                <label>📝 Notas Extra</label>
                <textarea [(ngModel)]="expenseForm.notes" class="form-input" rows="2" placeholder="Un pequeño detalle (Opcional)..."></textarea>
              </div>

            </div>
            <div class="modal-footer">
              <button class="btn-coquette-outline" (click)="showExpenseModal.set(false)">Cancelar</button>
              <button class="btn-coquette-solid" (click)="saveExpense()">Guardar ✨</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .financials-page { max-width: 1200px; animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .page-header {
      display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem;
      flex-wrap: wrap; gap: 1rem;
      h2 { font-family: var(--font-display); color: var(--text-dark); margin: 0; }
      .page-sub { font-family: var(--font-script); color: var(--rose-gold); margin: 0; font-size: 1.1rem; }
    }

    .date-controls {
      display: flex; gap: 1rem; align-items: flex-end;
      background: var(--bg-card); padding: 1rem; border-radius: 1rem;
      box-shadow: var(--shadow-sm); border: 1px solid var(--border-soft);
    }
    .control-group {
      display: flex; flex-direction: column; gap: 0.3rem;
      label { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
      input {
        padding: 0.5rem; border: 1px solid var(--border-soft); border-radius: 0.5rem;
        font-family: var(--font-body); color: var(--text-dark);
      }
    }
    .btn-refresh {
      padding: 0.6rem 1.2rem; background: var(--pink-100); color: var(--pink-600);
      border: none; border-radius: 0.6rem; font-weight: 700; cursor: pointer;
      transition: all 0.2s; height: 38px;
      &:hover { background: var(--pink-200); }
      &:disabled { opacity: 0.6; cursor: default; }
    }

    /* SUMMARY CARDS */
    .summary-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem;
    }
    .summary-card {
      background: var(--bg-card); padding: 1.5rem; border-radius: 1.5rem;
      border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm);
      display: flex; align-items: center; gap: 1rem;
      transition: transform 0.2s;
      &:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
      
      .card-icon {
        width: 50px; height: 50px; border-radius: 12px; font-size: 1.8rem;
        display: flex; align-items: center; justify-content: center;
        background: var(--bg-main);
      }
      .card-data { display: flex; flex-direction: column; }
      .label { font-size: 0.85rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.2rem; }
      .value { font-size: 1.4rem; font-weight: 800; color: var(--text-dark); }

      &.income .card-icon { background: #E0F2FE; }
      &.income .value { color: #0284C7; }

      &.investment .card-icon { background: #FEF3C7; }
      &.investment .value { color: #D97706; }

      &.expense .card-icon { background: #FEE2E2; }
      &.expense .value { color: #DC2626; }

      &.profit .card-icon { background: #D1FAE5; }
      &.profit .value { color: #059669; }
      &.profit.negative .value { color: #DC2626; }
    }

    /* DETAILS */
    .details-section {
      background: var(--bg-card); border-radius: 1.5rem; border: 1px solid var(--border-soft);
      box-shadow: var(--shadow-sm); overflow: hidden;
    }
    .tabs {
      display: flex; border-bottom: 1px solid var(--border-soft); background: var(--bg-main);
      button {
        padding: 1rem 1.5rem; border: none; background: none; cursor: pointer;
        font-weight: 700; color: var(--text-medium); border-bottom: 3px solid transparent;
        transition: all 0.2s;
        &.active { color: var(--pink-600); border-bottom-color: var(--pink-500); background: var(--bg-card); }
        &:hover:not(.active) { color: var(--pink-400); }
      }
    }
    .tab-content { padding: 0; }

    .data-table {
      width: 100%; border-collapse: collapse;
      th, td { padding: 1rem 1.5rem; text-align: left; }
      th { background: var(--bg-main); font-weight: 700; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; }
      td { border-bottom: 1px solid #f0f0f0; color: var(--text-dark); font-size: 0.95rem; }
      tr:last-child td { border-bottom: none; }
      .text-right { text-align: right; }
      .font-bold { font-weight: 700; }
      .empty { text-align: center; color: var(--text-muted); font-style: italic; padding: 2rem; }
      .badge {
        background: var(--pink-100); color: var(--pink-700);
        padding: 0.25rem 0.6rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 700;
      }
    }

    @media (max-width: 768px) {
      .page-header { flex-direction: column; align-items: flex-start; }
      .date-controls { width: 100%; justify-content: space-between; flex-wrap: wrap; }
      .summary-grid { grid-template-columns: 1fr; }
    }

/* ═══════════════════════════════════════════
       MODAL COQUETTE STYLES
       ═══════════════════════════════════════════ */
    .modal-backdrop { 
      position: fixed; inset: 0; 
      background: rgba(255, 255, 255, 0.4); 
      backdrop-filter: blur(8px); /* Efecto cristal en el fondo */
      -webkit-backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center; 
      z-index: 1000; animation: fadeIn 0.2s ease-out; 
    }
    
    .coquette-modal { 
      background: linear-gradient(135deg, #ffffff 0%, #fff0f6 100%);
      width: 95%; max-width: 480px; 
      border-radius: 2rem; /* Súper redondeado */
      padding: 2.5rem 2rem; 
      box-shadow: 0 20px 50px rgba(236, 72, 153, 0.15); /* Sombra rosa suave */
      border: 2px solid #fce7f3;
      position: relative;
      transform: translateY(0); 
      animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
    }
    @keyframes popIn { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }

    /* Decoraciones flotantes */
    .sparkle { position: absolute; font-size: 1.5rem; opacity: 0.6; animation: float 3s ease-in-out infinite; }
    .sparkle.s1 { top: -15px; right: -10px; font-size: 2rem; }
    .sparkle.s2 { bottom: -10px; left: -10px; animation-delay: 1s; }

    .modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
    .header-title h3 { 
      margin: 0; 
      font-family: 'Georgia', serif; 
      font-size: 1.6rem;
      color: #be185d; 
      font-weight: 800; 
    }
    .modal-subtitle { margin: 4px 0 0; font-size: 0.85rem; color: #f472b6; font-weight: 600; }
    
    .btn-close { 
      background: #fdf2f8; border: none; width: 36px; height: 36px; border-radius: 50%;
      font-size: 1.2rem; color: #f472b6; cursor: pointer; transition: 0.2s; 
      display: flex; align-items: center; justify-content: center;
    }
    .btn-close:hover { background: #fbcfe8; color: #db2777; transform: rotate(90deg); }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
    .full-width { grid-column: 1 / -1; }
    
    .form-group label { 
      font-size: 0.75rem; font-weight: 800; color: #831843; 
      text-transform: uppercase; letter-spacing: 0.5px; 
    }
    
    .form-input { 
      padding: 0.9rem 1rem; 
      border-radius: 1rem; 
      border: 1.5px solid #fbcfe8; 
      background: #fdf2f8; 
      font-family: inherit; font-size: 0.95rem; color: #4c1d95; font-weight: 500;
      transition: all 0.2s; 
      box-shadow: inset 0 2px 4px rgba(251, 207, 232, 0.2);
    }
    .form-input::placeholder { color: #f472b6; opacity: 0.7; }
    .form-input:focus { 
      border-color: #f472b6; outline: none; background: white; 
      box-shadow: 0 0 0 4px rgba(244, 114, 182, 0.15); 
    }

    /* Selects customizados para que no se vean tan genéricos */
    .custom-select { appearance: none; background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23f472b6%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E"); background-repeat: no-repeat; background-position: right 1rem top 50%; background-size: 0.65rem auto; cursor: pointer; }

    .modal-footer { margin-top: 2rem; display: flex; justify-content: flex-end; gap: 1rem; }
    
    /* Botones mágicos */
    .btn-coquette-solid { 
      background: linear-gradient(135deg, #ec4899, #db2777); 
      color: white; border: none; padding: 0.8rem 1.8rem; border-radius: 1rem; 
      font-weight: 800; font-size: 0.95rem; cursor: pointer; transition: 0.2s; 
      box-shadow: 0 4px 15px rgba(236,72,153,0.3);
    }
    .btn-coquette-solid:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(236,72,153,0.4); }
    .btn-coquette-solid:active { transform: translateY(0); }

    .btn-coquette-outline { 
      background: white; color: #db2777; border: 1.5px solid #fbcfe8; 
      padding: 0.8rem 1.5rem; border-radius: 1rem; font-weight: 800; font-size: 0.95rem;
      cursor: pointer; transition: 0.2s; 
    }
    .btn-coquette-outline:hover { background: #fdf2f8; border-color: #f472b6; }
  `]
})
export class FinancialsComponent implements OnInit {
  startDate: string = '';
  endDate: string = '';
  loading = signal(false);
  report = signal<FinancialReport | null>(null);
  activeTab = signal<'investments' | 'expenses'>('investments');

  // Modal Gastos
  showExpenseModal = signal(false);
  isEditingExpense = signal(false);
  expenseForm = { id: 0, driverRouteId: null as number | null, amount: 0, expenseType: 'Gasolina', date: '', notes: '' };
  expenseTypes = ['Gasolina', 'Comida', 'Mantenimiento', 'Refacciones', 'Insumos de Empaque', 'Otros'];
  routes = signal<{ id: number, name: string }[]>([]);

  constructor(private api: ApiService) {
    // Default to current fortnight (simple logic for now: start of month to today, or similar)
    const now = new Date();
    this.endDate = now.toISOString().split('T')[0];
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    this.startDate = start.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    if (!this.startDate || !this.endDate) return;

    this.loading.set(true);
    this.api.getFinancialReport(this.startDate, this.endDate).subscribe({
      next: (data) => {
        this.report.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading financials', err);
        this.loading.set(false);
      }
    });
  }

  openExpenseModal(expense?: DriverExpense) {
    if (expense) {
      this.isEditingExpense.set(true);
      this.expenseForm = {
        id: expense.id,
        driverRouteId: expense.driverRouteId || null,
        amount: expense.amount,
        expenseType: expense.expenseType || 'Gasolina',
        date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        notes: expense.notes || ''
      };
    } else {
      this.isEditingExpense.set(false);
      this.expenseForm = {
        id: 0,
        driverRouteId: null,
        amount: 0,
        expenseType: 'Gasolina',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      };
    }

    // Cargar rutas disponibles
    this.api.getRoutes().subscribe(res => {
      this.routes.set(res.map(r => ({ id: r.id, name: r.name || `Ruta ${r.id}` })));
    });

    this.showExpenseModal.set(true);
  }

  saveExpense() {
    if (this.expenseForm.amount <= 0 || !this.expenseForm.driverRouteId) {
      alert('Rellena los campos obligatorios: Monto y Ruta.');
      return;
    }
    const data = {
      amount: this.expenseForm.amount,
      expenseType: this.expenseForm.expenseType,
      date: new Date(this.expenseForm.date).toISOString(),
      notes: this.expenseForm.notes,
      deliveryRouteId: this.expenseForm.driverRouteId
    };

    if (this.isEditingExpense()) {
      this.api.updateAdminExpense(this.expenseForm.id, data).subscribe(() => { this.showExpenseModal.set(false); this.loadData(); });
    } else {
      this.api.createAdminExpense(data).subscribe(() => { this.showExpenseModal.set(false); this.loadData(); });
    }
  }

  deleteExpense(id: number) {
    if (confirm('¿Eliminar gasto operativo?')) {
      this.api.deleteAdminExpense(id).subscribe(() => this.loadData());
    }
  }
}
