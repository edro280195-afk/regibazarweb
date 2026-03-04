import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { FinancialReport, DriverExpense, Investment, OrderSummary, SalesPeriod, PeriodReport } from '../../../../shared/models/models';

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
      </header>
        
      <!-- ═══ SECCIÓN PRINCIPAL: REPORTE POR CORTE (EL CORAZÓN) ═══ -->
      <div class="period-report-section main-focus">
        <div class="section-header">
          <div>
            <h3>📊 Reporte por Corte de Venta</h3>
            <p class="section-sub">Métricas exactas del ciclo de venta seleccionado</p>
          </div>
          <div class="period-selector">
            <select [(ngModel)]="selectedPeriodId" (ngModelChange)="loadPeriodReport($event)"
                    id="period-select" [disabled]="periodsLoading()">
              <option [ngValue]="null">— Selecciona un Corte —</option>
              @for (p of allPeriods(); track p.id) {
                <option [ngValue]="p.id">
                  {{ p.isActive ? '🟢 ' : '' }}{{ p.name }}
                </option>
              }
            </select>
          </div>
        </div>

        @if (periodReportLoading()) {
          <div class="pr-loading"><span class="pr-spinner"></span> Calculando corte...</div>
        }

        @if (periodReport(); as pr) {
          <div class="pr-summary-grid">
            <div class="pr-card sales">
              <span class="pr-icon">💸</span>
              <span class="pr-label">Ventas Cobradas</span>
              <span class="pr-value">$ {{ totalSales() | number:'1.0-0' }}</span>
            </div>
            <div class="pr-card invest">
              <span class="pr-icon">📦</span>
              <span class="pr-label">Inversión Realizada</span>
              <span class="pr-value">$ {{ totalInvestments() | number:'1.0-0' }}</span>
            </div>
            <div class="pr-card profit" [class.negative]="netProfit() < 0">
              <span class="pr-icon">🚀</span>
              <span class="pr-label">Utilidad Neta</span>
              <span class="pr-value">$ {{ netProfit() | number:'1.0-0' }}</span>
            </div>
          </div>

          <div class="pr-suppliers">
            <h4>🏭 Inversión por Proveedor en este Corte</h4>
            <table class="data-table" id="period-suppliers-table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th class="text-right">Inversión (MXN)</th>
                  <th class="text-right">No. Compras</th>
                </tr>
              </thead>
              <tbody>
                @for (s of pr.investmentsBySupplier; track s.supplierName) {
                  <tr>
                    <td>{{ s.supplierName }}</td>
                    <td class="text-right font-bold">$ {{ s.totalInvested | number:'1.0-0' }}</td>
                    <td class="text-right">{{ s.investmentCount }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="3" class="empty">No hay inversiones registradas para este corte.</td></tr>
                }
              </tbody>
            </table>
          </div>
        }

        @if (!periodReport() && !periodReportLoading() && selectedPeriodId) {
          <div class="pr-empty">No se encontró información para este corte.</div>
        }
      </div>

      <!-- ═══ SECCIÓN SECUNDARIA: MÉTRICAS AVANZADAS POR FECHA ═══ -->
      <div class="advanced-reports">
        <div class="section-title-alt">
          <h4>🗄️ Métricas Avanzadas (Histórico por Fechas)</h4>
          <p>Usa esta sección para auditorías contables o rangos específicos.</p>
        </div>

        <div class="date-controls-inline">
          <div class="control-group">
            <label>Inicio</label>
            <input type="date" [(ngModel)]="startDate" (change)="loadData()">
          </div>
          <div class="control-group">
            <label>Fin</label>
            <input type="date" [(ngModel)]="endDate" (change)="loadData()">
          </div>
          <button class="btn-refresh" (click)="loadData()" [disabled]="loading()">
            {{ loading() ? '...' : 'Actualizar' }}
          </button>
        </div>

        <!-- SUMMARY CARDS MINIMIZADOS -->
        <div class="summary-grid-mini">
          <div class="mini-card">
            <span class="label">Ingresos</span>
            <span class="value">$ {{ report()?.totalIncome | number:'1.0-0' }}</span>
          </div>
          <div class="mini-card">
            <span class="label">Inversión</span>
            <span class="value">$ {{ report()?.totalInvestment | number:'1.0-0' }}</span>
          </div>
          <div class="mini-card">
            <span class="label">Gastos Ops</span>
            <span class="value">$ {{ report()?.totalExpenses | number:'1.0-0' }}</span>
          </div>
          <div class="mini-card">
            <span class="label">Utilidad</span>
            <span class="value">$ {{ report()?.netProfit | number:'1.0-0' }}</span>
          </div>
        </div>

        <!-- ═══ DETAILS TABS (Investments/Expenses) ═══ -->
        <div class="details-section">
          <div class="tabs">
            <button [class.active]="activeTab() === 'investments'" (click)="activeTab.set('investments')">
              📦 Detalle Inversiones
            </button>
            <button [class.active]="activeTab() === 'expenses'" (click)="activeTab.set('expenses')">
              ⛽ Detalle Gastos Drivers
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
                      <td class="text-right font-bold">$ {{ inv.amount | number:'1.0-0' }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4" class="empty">Nada que mostrar.</td></tr>
                  }
                </tbody>
              </table>
            }

            @if (activeTab() === 'expenses') {
              <div class="tab-actions" style="display:flex; justify-content: flex-end; padding: 0.5rem 1rem 0;">
                  <button class="btn-mini-add" (click)="openExpenseModal()">+ Añadir Gasto</button>
              </div>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Ruta</th>
                    <th>Tipo</th>
                    <th class="text-right">Monto</th>
                    <th class="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (exp of report()?.details?.expenses; track exp.id) {
                    <tr>
                      <td>{{ exp.date | date:'dd/MM/yyyy' }}</td>
                      <td>{{ exp.routeName || ('Ruta ' + exp.driverRouteId) || 'N/A' }}</td>
                      <td><span class="badge">{{ exp.expenseType }}</span></td>
                      <td class="text-right font-bold">$ {{ exp.amount | number:'1.0-0' }}</td>
                      <td class="text-center">
                         <button class="btn-icon" (click)="openExpenseModal(exp)">✏️</button>
                         <button class="btn-icon del" (click)="deleteExpense(exp.id)">🗑️</button>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="empty">Nada que mostrar.</td></tr>
                  }
                </tbody>
              </table>
            }
          </div>
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
    .financials-page { max-width: 1200px; padding: 1.5rem; animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .page-header {
      margin-bottom: 2rem;
      h2 { font-family: 'Georgia', serif; font-size: 2rem; color: #be185d; margin: 0; font-weight: 800; }
      .page-sub { color: #f472b6; margin: 0.2rem 0 0; font-size: 1rem; font-weight: 500; }
    }

    /* Sales Period Report Styling */
    .period-report-section.main-focus {
      margin-bottom: 3rem; background: white; border-radius: 2rem;
      border: 2px solid #fbbf24; box-shadow: 0 15px 40px rgba(251, 191, 36, 0.1);
      overflow: hidden;
    }
    .section-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 1.5rem 2rem; background: #fffbeb; border-bottom: 1px solid #fef3c7;
      h3 { margin: 0; font-size: 1.3rem; color: #92400e; font-weight: 800; }
      .section-sub { margin: 0; font-size: 0.85rem; color: #b45309; }
    }
    .period-selector select {
      padding: 0.8rem 1.2rem; border-radius: 1rem; border: 1.5px solid #fbbf24;
      background: white; font-weight: 600; min-width: 260px;
    }

    .pr-loading { display: flex; align-items: center; gap: 0.75rem; padding: 2rem; color: var(--text-muted); }
    .pr-spinner { width: 20px; height: 20px; border: 2px solid var(--pink-100); border-top-color: var(--pink-400); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .pr-summary-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; padding: 2rem;
    }
    .pr-card {
      padding: 1.5rem; border-radius: 1.5rem; text-align: center; display: flex; flex-direction: column; gap: 0.5rem;
      .pr-icon { font-size: 2rem; }
      .pr-label { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #64748b; }
      .pr-value { font-size: 1.8rem; font-weight: 900; }
      &.sales { background: #f0fdf4; .pr-value { color: #16a34a; } }
      &.invest { background: #fffcf0; .pr-value { color: #d97706; } }
      &.profit { background: #fdf2f8; .pr-value { color: #db2777; } &.negative { background: #fee2e2; .pr-value { color: #dc2626; } } }
    }
    .pr-suppliers {
      padding: 0 1.5rem 1.5rem;
      h4 { margin: 0 0 1rem; font-family: var(--font-display); color: var(--text-dark); font-size: 0.95rem; }
    }
    .pr-empty { text-align: center; padding: 2rem; color: var(--text-muted); font-style: italic; }

    @media(max-width: 768px) {
      .section-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
      .pr-summary-grid { grid-template-columns: 1fr; }
    }

    /* Advanced Reports Styling */
    .advanced-reports {
      border-top: 2px dashed #e2e8f0; padding-top: 2rem;
    }
    .section-title-alt {
      margin-bottom: 1.5rem;
      h4 { margin: 0; color: #64748b; font-size: 1.1rem; }
      p { margin: 0; font-size: 0.85rem; color: #94a3b8; }
    }
    .date-controls-inline {
      display: flex; gap: 1rem; align-items: flex-end; margin-bottom: 1.5rem;
      .control-group { display: flex; flex-direction: column; gap: 0.3rem; }
      label { font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase; }
      input { padding: 0.6rem; border: 1.5px solid #e2e8f0; border-radius: 0.8rem; }
    }
    .btn-refresh {
      padding: 0.6rem 1.2rem; background: var(--pink-100); color: var(--pink-600);
      border: none; border-radius: 0.6rem; font-weight: 700; cursor: pointer;
      transition: all 0.2s; height: 38px;
      &:hover { background: var(--pink-200); }
      &:disabled { opacity: 0.6; cursor: default; }
    }

    .summary-grid-mini {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;
    }
    .mini-card {
      background: #f8fafc; padding: 1rem; border-radius: 1rem; border: 1px solid #e2e8f0;
      display: flex; flex-direction: column;
      .label { font-size: 0.65rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
      .value { font-size: 1.1rem; font-weight: 800; color: #475569; }
    }

    .details-section { background: white; border-radius: 1.5rem; border: 1.5px solid #e2e8f0; overflow: hidden; }
    .tabs {
      display: flex; background: #f1f5f9;
      button {
        padding: 1rem 1.5rem; border: none; background: none; font-weight: 800; color: #94a3b8; cursor: pointer;
        &.active { background: white; color: #be185d; border-bottom: 3px solid #ec4899; }
      }
    }
    .tab-content { padding: 0; }

    .data-table {
      width: 100%; border-collapse: collapse;
      th { padding: 1rem 1.5rem; background: #f8fafc; font-size: 0.75rem; color: #64748b; text-transform: uppercase; text-align: left; }
      td { padding: 1rem 1.5rem; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
      .text-right { text-align: right; }
      .font-bold { font-weight: 800; }
      .empty { text-align: center; padding: 2rem; color: #94a3b8; }
    }

    .btn-icon { background: none; border: none; font-size: 1.1rem; cursor: pointer; }
    .btn-mini-add { background: #fdf2f8; color: #db2777; border: 1.5px solid #fbcfe8; padding: 0.5rem 1rem; border-radius: 0.8rem; font-weight: 800; cursor: pointer; margin-bottom: 0.5rem; }
    .badge { background: #fdf2f8; color: #db2777; padding: 0.2rem 0.5rem; border-radius: 0.5rem; font-size: 0.7rem; font-weight: 700; }

    /* MODAL STYLES */
    .modal-backdrop { 
      position: fixed; inset: 0; background: rgba(255, 255, 255, 0.4); 
      backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .coquette-modal { 
      background: white; width: 95%; max-width: 480px; border-radius: 2rem; padding: 2.5rem 2rem; 
      box-shadow: 0 20px 50px rgba(236, 72, 153, 0.15); border: 2px solid #fce7f3; position: relative;
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

  // Period Report
  allPeriods = signal<SalesPeriod[]>([]);
  periodsLoading = signal(false);
  selectedPeriodId: number | null = null;
  periodReport = signal<PeriodReport | null>(null);
  periodReportLoading = signal(false);

  // Computed from period report
  totalSales = computed(() => this.periodReport()?.totalSales ?? 0);
  totalInvestments = computed(() => this.periodReport()?.totalInvestments ?? 0);
  netProfit = computed(() => this.periodReport()?.netProfit ?? 0);

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
    this.loadPeriods();
  }

  loadPeriods(): void {
    this.periodsLoading.set(true);
    this.api.getSalesPeriods().subscribe({
      next: (data) => {
        this.allPeriods.set(data);
        this.periodsLoading.set(false);
        // Pre-seleccionar el activo si existe
        const active = data.find(p => p.isActive);
        if (active) {
          this.selectedPeriodId = active.id;
          this.loadPeriodReport(active.id);
        }
      },
      error: () => this.periodsLoading.set(false)
    });
  }

  loadPeriodReport(id: number | null): void {
    if (!id) { this.periodReport.set(null); return; }
    this.periodReportLoading.set(true);
    this.api.getPeriodReport(id).subscribe({
      next: (data) => { this.periodReport.set(data); this.periodReportLoading.set(false); },
      error: () => this.periodReportLoading.set(false)
    });
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
