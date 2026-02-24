import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../../../core/services/api.service';
import { ReportData } from '../../../../shared/models/models';

type TabKey = 'financial' | 'orders' | 'routes' | 'clients' | 'payments' | 'suppliers';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective],
  template: `
    <div class="reports-page">
      <div class="reports-header">
        <div>
          <h1>📊 Centro de Reportes</h1>
          <p class="subtitle">Análisis detallado de tu negocio</p>
        </div>
        <div class="date-controls">
          <input type="date" [(ngModel)]="startDate" (change)="loadData()" class="date-input">
          <span class="date-sep">→</span>
          <input type="date" [(ngModel)]="endDate" (change)="loadData()" class="date-input">
        </div>
      </div>

      <!-- TABS -->
      <div class="tab-bar">
        @for (tab of tabs; track tab.key) {
          <button class="tab-btn"
                  [class.active]="activeTab() === tab.key"
                  (click)="activeTab.set(tab.key)">
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        }
      </div>

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner">🎀</div>
          <p>Generando reporte...</p>
        </div>
      } @else if (data()) {

        <!-- ══════════ FINANCIERO ══════════ -->
        @if (activeTab() === 'financial') {
          <div class="tab-content fade-in">
            <div class="kpi-grid-4">
              <div class="kpi green">
                <span class="kpi-label">Ingresos</span>
                <span class="kpi-value">\${{ data()!.totalRevenue | number:'1.0-0' }}</span>
              </div>
              <div class="kpi pink">
                <span class="kpi-label">Inversión</span>
                <span class="kpi-value">\${{ data()!.totalInvestment | number:'1.0-0' }}</span>
              </div>
              <div class="kpi orange">
                <span class="kpi-label">Gastos Operativos</span>
                <span class="kpi-value">\${{ data()!.totalExpenses | number:'1.0-0' }}</span>
              </div>
              <div class="kpi" [class.green]="data()!.netProfit >= 0" [class.red]="data()!.netProfit < 0">
                <span class="kpi-label">Utilidad Neta</span>
                <span class="kpi-value">\${{ data()!.netProfit | number:'1.0-0' }}</span>
              </div>
            </div>
            <div class="chart-card">
              <h3>💰 Ingresos vs Inversión vs Gastos</h3>
              <div echarts [options]="financialChartOptions" class="chart-container"></div>
            </div>
          </div>
        }

        <!-- ══════════ PEDIDOS ══════════ -->
        @if (activeTab() === 'orders') {
          <div class="tab-content fade-in">
            <div class="kpi-grid-4">
              <div class="kpi blue">
                <span class="kpi-label">Total Pedidos</span>
                <span class="kpi-value">{{ data()!.totalOrders }}</span>
              </div>
              <div class="kpi green">
                <span class="kpi-label">Entregados</span>
                <span class="kpi-value">{{ data()!.deliveredOrders }}</span>
              </div>
              <div class="kpi orange">
                <span class="kpi-label">Pendientes</span>
                <span class="kpi-value">{{ data()!.pendingOrders }}</span>
              </div>
              <div class="kpi pink">
                <span class="kpi-label">Ticket Promedio</span>
                <span class="kpi-value">\${{ data()!.avgTicket | number:'1.0-0' }}</span>
              </div>
            </div>

            <div class="two-cols">
              <div class="chart-card">
                <h3>📈 Pedidos por Día</h3>
                <div echarts [options]="ordersByDayChartOptions" class="chart-container"></div>
              </div>
              <div class="chart-card">
                <h3>🚚 Delivery vs PickUp</h3>
                <div echarts [options]="deliveryTypeChartOptions" class="chart-container"></div>
              </div>
            </div>

            @if (data()!.topProducts.length > 0) {
              <div class="chart-card">
                <h3>🏆 Top 10 Productos</h3>
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>#</th><th>Producto</th><th>Cantidad</th><th>Ingreso</th></tr></thead>
                    <tbody>
                      @for (p of data()!.topProducts; track p.name; let i = $index) {
                        <tr><td>{{ i + 1 }}</td><td>{{ p.name }}</td><td>{{ p.quantity }}</td><td>\${{ p.revenue | number:'1.0-0' }}</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </div>
        }

        <!-- ══════════ RUTAS ══════════ -->
        @if (activeTab() === 'routes') {
          <div class="tab-content fade-in">
            <div class="kpi-grid-4">
              <div class="kpi blue">
                <span class="kpi-label">Rutas Creadas</span>
                <span class="kpi-value">{{ data()!.totalRoutes }}</span>
              </div>
              <div class="kpi green">
                <span class="kpi-label">Completadas</span>
                <span class="kpi-value">{{ data()!.completedRoutes }}</span>
              </div>
              <div class="kpi pink">
                <span class="kpi-label">Tasa de Éxito</span>
                <span class="kpi-value">{{ data()!.successRate }}%</span>
              </div>
              <div class="kpi orange">
                <span class="kpi-label">Gastos Chofer</span>
                <span class="kpi-value">\${{ data()!.totalDriverExpenses | number:'1.0-0' }}</span>
              </div>
            </div>
          </div>
        }

        <!-- ══════════ CLIENTAS ══════════ -->
        @if (activeTab() === 'clients') {
          <div class="tab-content fade-in">
            <div class="kpi-grid-3">
              <div class="kpi blue">
                <span class="kpi-label">Clientas Activas</span>
                <span class="kpi-value">{{ data()!.activeClients }}</span>
              </div>
              <div class="kpi pink">
                <span class="kpi-label">Nuevas</span>
                <span class="kpi-value">{{ data()!.newClients }}</span>
              </div>
              <div class="kpi green">
                <span class="kpi-label">Frecuentes</span>
                <span class="kpi-value">{{ data()!.frequentClients }}</span>
              </div>
            </div>

            @if (data()!.topClients.length > 0) {
              <div class="chart-card">
                <h3>👑 Top 10 Clientas por Monto</h3>
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>#</th><th>Clienta</th><th>Pedidos</th><th>Total Gastado</th></tr></thead>
                    <tbody>
                      @for (c of data()!.topClients; track c.name; let i = $index) {
                        <tr><td>{{ i + 1 }}</td><td>{{ c.name }}</td><td>{{ c.orders }}</td><td>\${{ c.totalSpent | number:'1.0-0' }}</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </div>
        }

        <!-- ══════════ COBROS ══════════ -->
        @if (activeTab() === 'payments') {
          <div class="tab-content fade-in">
            <div class="kpi-grid-4">
              <div class="kpi green">
                <span class="kpi-label">💵 Efectivo</span>
                <span class="kpi-value">{{ data()!.cashOrders }}</span>
                <span class="kpi-sub">\${{ data()!.cashAmount | number:'1.0-0' }}</span>
              </div>
              <div class="kpi blue">
                <span class="kpi-label">💳 Transferencia</span>
                <span class="kpi-value">{{ data()!.transferOrders }}</span>
                <span class="kpi-sub">\${{ data()!.transferAmount | number:'1.0-0' }}</span>
              </div>
              <div class="kpi purple">
                <span class="kpi-label">🏦 Depósito</span>
                <span class="kpi-value">{{ data()!.depositOrders }}</span>
                <span class="kpi-sub">\${{ data()!.depositAmount | number:'1.0-0' }}</span>
              </div>
              <div class="kpi red">
                <span class="kpi-label">⚠️ Sin Asignar</span>
                <span class="kpi-value">{{ data()!.unassignedPaymentOrders }}</span>
              </div>
            </div>
            <div class="chart-card">
              <h3>💵 Distribución de Cobros</h3>
              <div echarts [options]="paymentChartOptions" class="chart-container"></div>
            </div>
          </div>
        }

        <!-- ══════════ PROVEEDORES ══════════ -->
        @if (activeTab() === 'suppliers') {
          <div class="tab-content fade-in">
            @if (data()!.supplierSummaries.length > 0) {
              <div class="chart-card">
                <h3>📦 Inversión por Proveedor</h3>
                <div echarts [options]="supplierChartOptions" class="chart-container"></div>
              </div>
              <div class="chart-card">
                <h3>📋 Detalle de Proveedores</h3>
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Proveedor</th><th>Inversiones</th><th>Total Invertido</th></tr></thead>
                    <tbody>
                      @for (s of data()!.supplierSummaries; track s.name) {
                        <tr><td>{{ s.name }}</td><td>{{ s.investmentCount }}</td><td>\${{ s.totalInvested | number:'1.0-0' }}</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            } @else {
              <div class="empty-state">
                <span>📦</span>
                <p>No hay inversiones en este periodo</p>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .reports-page {
      max-width: 1200px;
      margin: 0 auto;
      font-family: var(--font-body, 'Segoe UI', Roboto, sans-serif);
    }

    .reports-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .reports-header h1 { margin: 0; font-size: 1.5rem; color: var(--text-dark, #1f2937); }
    .subtitle { color: var(--text-muted, #9ca3af); font-size: 0.85rem; margin: 4px 0 0; }

    .date-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .date-input {
      padding: 8px 12px;
      border-radius: 10px;
      border: 1.5px solid var(--border-soft, #e5e7eb);
      background: white;
      font-size: 0.85rem;
      font-weight: 600;
      outline: none;
      color: var(--text-dark, #374151);
      cursor: pointer;
    }
    .date-input:focus { border-color: #ec4899; }
    .date-sep { color: var(--text-muted, #9ca3af); font-weight: 700; }

    /* TABS */
    .tab-bar {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      padding-bottom: 4px;
      margin-bottom: 1.5rem;
      -webkit-overflow-scrolling: touch;
    }
    .tab-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 10px 16px;
      border-radius: 12px;
      border: 1.5px solid transparent;
      background: var(--bg-glass, rgba(255,255,255,0.6));
      font-size: 0.82rem; font-weight: 700;
      color: var(--text-medium, #6b7280);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .tab-btn:hover { background: rgba(255,107,157,0.06); color: #ec4899; }
    .tab-btn.active {
      background: linear-gradient(135deg, rgba(255,107,157,0.12), rgba(232,160,191,0.08));
      color: #be185d;
      border-color: rgba(255,107,157,0.2);
      box-shadow: 0 2px 8px rgba(236,72,153,0.1);
    }
    .tab-icon { font-size: 1rem; }

    /* LOADING */
    .loading-state {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; min-height: 300px; gap: 1rem;
    }
    .loading-state .spinner { font-size: 2rem; animation: spin 1s linear infinite; }
    .loading-state p { color: var(--text-muted, #9ca3af); }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* TAB CONTENT */
    .tab-content { animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

    /* KPI GRIDS */
    .kpi-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 1.5rem; }
    .kpi-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 1.5rem; }

    .kpi {
      background: var(--bg-glass, rgba(255,255,255,0.7));
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 1.25rem;
      border: 1.5px solid var(--border-soft, #f3f4f6);
      display: flex; flex-direction: column; gap: 4px;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .kpi:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
    .kpi-label { font-size: 0.75rem; font-weight: 700; color: var(--text-muted, #9ca3af); text-transform: uppercase; letter-spacing: 0.3px; }
    .kpi-value { font-size: 1.4rem; font-weight: 800; color: var(--text-dark, #1f2937); }
    .kpi-sub { font-size: 0.82rem; font-weight: 700; color: var(--text-medium, #6b7280); }

    .kpi.green { border-left: 4px solid #10b981; }
    .kpi.pink { border-left: 4px solid #ec4899; }
    .kpi.blue { border-left: 4px solid #3b82f6; }
    .kpi.orange { border-left: 4px solid #f59e0b; }
    .kpi.red { border-left: 4px solid #ef4444; }
    .kpi.purple { border-left: 4px solid #8b5cf6; }

    /* CHARTS */
    .chart-card {
      background: var(--bg-glass, rgba(255,255,255,0.7));
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 1.25rem;
      border: 1.5px solid var(--border-soft, #f3f4f6);
      margin-bottom: 1.5rem;
    }
    .chart-card h3 { margin: 0 0 1rem; font-size: 0.95rem; color: var(--text-dark, #374151); }
    .chart-container { width: 100%; height: 300px; }

    .two-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

    /* TABLES */
    .table-wrap { overflow-x: auto; }
    table {
      width: 100%; border-collapse: collapse;
      font-size: 0.85rem;
    }
    th {
      text-align: left; padding: 10px 12px;
      background: rgba(255,107,157,0.05);
      color: var(--text-medium, #6b7280);
      font-weight: 700; font-size: 0.75rem;
      text-transform: uppercase; letter-spacing: 0.3px;
      border-bottom: 1.5px solid var(--border-soft, #f3f4f6);
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border-soft, #f3f4f6);
      color: var(--text-dark, #374151);
    }
    tr:hover td { background: rgba(255,107,157,0.02); }

    /* EMPTY */
    .empty-state {
      text-align: center; padding: 3rem;
      color: var(--text-muted, #9ca3af);
    }
    .empty-state span { font-size: 3rem; display: block; margin-bottom: 1rem; }

    /* RESPONSIVE */
    @media (max-width: 768px) {
      .kpi-grid-4 { grid-template-columns: repeat(2, 1fr); }
      .kpi-grid-3 { grid-template-columns: 1fr; }
      .two-cols { grid-template-columns: 1fr; }
      .reports-header { flex-direction: column; }
      .tab-bar { gap: 2px; }
      .tab-btn { padding: 8px 10px; font-size: 0.75rem; }
      .tab-label { display: none; }
      .tab-icon { font-size: 1.2rem; }
    }
  `]
})
export class ReportsComponent implements OnInit {
  data = signal<ReportData | null>(null);
  loading = signal(true);
  activeTab = signal<TabKey>('financial');

  startDate = '';
  endDate = '';

  tabs: { key: TabKey; icon: string; label: string }[] = [
    { key: 'financial', icon: '💰', label: 'Financiero' },
    { key: 'orders', icon: '🛒', label: 'Pedidos' },
    { key: 'routes', icon: '🚗', label: 'Rutas' },
    { key: 'clients', icon: '💁‍♀️', label: 'Clientas' },
    { key: 'payments', icon: '💵', label: 'Cobros' },
    { key: 'suppliers', icon: '📦', label: 'Proveedores' },
  ];

  // Chart options
  financialChartOptions: any = {};
  ordersByDayChartOptions: any = {};
  deliveryTypeChartOptions: any = {};
  paymentChartOptions: any = {};
  supplierChartOptions: any = {};

  constructor(private api: ApiService) { }

  ngOnInit(): void {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    this.startDate = start.toISOString().split('T')[0];
    this.endDate = now.toISOString().split('T')[0];
    this.loadData();
  }

  loadData(): void {
    if (!this.startDate || !this.endDate) return;
    this.loading.set(true);

    this.api.getReportData(this.startDate, this.endDate).subscribe({
      next: (d) => {
        this.data.set(d);
        this.buildCharts(d);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  private buildCharts(d: ReportData): void {
    const coquetteColors = ['#ec4899', '#f472b6', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

    // Financial
    this.financialChartOptions = {
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: ['Ingresos', 'Inversión', 'Gastos', 'Utilidad'] },
      yAxis: { type: 'value' },
      series: [{
        type: 'bar',
        data: [
          { value: d.totalRevenue, itemStyle: { color: '#10b981' } },
          { value: d.totalInvestment, itemStyle: { color: '#ec4899' } },
          { value: d.totalExpenses, itemStyle: { color: '#f59e0b' } },
          { value: d.netProfit, itemStyle: { color: d.netProfit >= 0 ? '#10b981' : '#ef4444' } },
        ],
        barWidth: '50%',
        itemStyle: { borderRadius: [8, 8, 0, 0] }
      }]
    };

    // Orders by day
    this.ordersByDayChartOptions = {
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: d.ordersByDay.map(o => o.date.substring(5)) },
      yAxis: { type: 'value' },
      series: [{
        type: 'line',
        data: d.ordersByDay.map(o => o.count),
        smooth: true,
        areaStyle: { color: 'rgba(236,72,153,0.1)' },
        lineStyle: { color: '#ec4899', width: 3 },
        itemStyle: { color: '#ec4899' }
      }]
    };

    // Delivery vs PickUp
    this.deliveryTypeChartOptions = {
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: [
          { value: d.deliveryOrders, name: 'Delivery', itemStyle: { color: '#3b82f6' } },
          { value: d.pickUpOrders, name: 'PickUp', itemStyle: { color: '#f59e0b' } }
        ],
        label: { show: true, formatter: '{b}: {c}' }
      }]
    };

    // Payments
    this.paymentChartOptions = {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [{
        type: 'pie',
        radius: ['35%', '65%'],
        data: [
          { value: d.cashAmount, name: 'Efectivo', itemStyle: { color: '#10b981' } },
          { value: d.transferAmount, name: 'Transferencia', itemStyle: { color: '#3b82f6' } },
          { value: d.depositAmount, name: 'Depósito', itemStyle: { color: '#8b5cf6' } },
        ].filter(x => x.value > 0),
        label: { show: true, formatter: '{b}\n${c}' }
      }]
    };

    // Suppliers
    if (d.supplierSummaries.length > 0) {
      this.supplierChartOptions = {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: d.supplierSummaries.map(s => s.name), axisLabel: { rotate: 30 } },
        yAxis: { type: 'value' },
        series: [{
          type: 'bar',
          data: d.supplierSummaries.map((s, i) => ({
            value: s.totalInvested,
            itemStyle: { color: coquetteColors[i % coquetteColors.length] }
          })),
          barWidth: '60%',
          itemStyle: { borderRadius: [8, 8, 0, 0] }
        }]
      };
    }
  }
}
