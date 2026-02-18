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
                    <td>Proveedor #{{ inv.supplierId }}</td>
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
            <table class="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Driver</th>
                  <th>Tipo</th>
                  <th>Nota</th>
                  <th class="text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                @for (exp of report()?.details?.expenses; track exp.id) {
                  <tr>
                    <td>{{ exp.date | date:'dd/MM/yyyy' }}</td>
                    <td>{{ exp.driverName || 'Driver' }}</td>
                    <td><span class="badge">{{ exp.expenseType }}</span></td>
                    <td>{{ exp.notes || '-' }}</td>
                    <td class="text-right font-bold">$ {{ exp.amount | number:'1.2-2' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="empty">No hay gastos registrados en este periodo.</td></tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>

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
  `]
})
export class FinancialsComponent implements OnInit {
  startDate: string = '';
  endDate: string = '';
  loading = signal(false);
  report = signal<FinancialReport | null>(null);
  activeTab = signal<'investments' | 'expenses'>('investments');

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
}
