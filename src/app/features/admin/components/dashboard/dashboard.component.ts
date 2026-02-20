import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgxEchartsDirective } from 'ngx-echarts';
import { forkJoin, map, switchMap, of } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { Dashboard, OrderSummary, Investment, Client } from '../../../../shared/models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, NgxEchartsDirective],
  template: `
    <div class="dashboard-container">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>

      <!-- ═══ HEADER ═══ -->
      <header class="dash-header">
        <div class="greeting">
          <h1>Hola👑</h1>
          <p class="subtitle">Así van las cosas en Regi Bazar✨</p>
        </div>
        <div class="date-badge">
          📅 {{ today | date:'EEEE d MMMM' }}
        </div>
      </header>

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner">🎀</div>
          <p>Cargando tus éxitos...</p>
        </div>
      } @else {
        @if (data(); as d) {

          <!-- ═══ KPIs PRINCIPALES ═══ -->
          <div class="kpi-row fade-in">
            <div class="kpi-card">
              <span class="kpi-icon">💰</span>
              <div class="kpi-data">
                <span class="kpi-label">Ventas Hoy</span>
                <span class="kpi-value">{{ metrics().salesToday | currency:'MXN':'symbol-narrow':'1.0-0' }}</span>
              </div>
            </div>
            <div class="kpi-card">
              <span class="kpi-icon">📊</span>
              <div class="kpi-data">
                <span class="kpi-label">Esta Semana</span>
                <span class="kpi-value">{{ metrics().salesWeek | currency:'MXN':'symbol-narrow':'1.0-0' }}</span>
              </div>
            </div>
            <div class="kpi-card">
              <span class="kpi-icon">📈</span>
              <div class="kpi-data">
                <span class="kpi-label">Este Mes</span>
                <span class="kpi-value">{{ metrics().salesMonth | currency:'MXN':'symbol-narrow':'1.0-0' }}</span>
              </div>
            </div>
            <div class="kpi-card highlight">
              <span class="kpi-icon">⚠️</span>
              <div class="kpi-data">
                <span class="kpi-label">Por Cobrar</span>
                <span class="kpi-value text-red">{{ metrics().pendingCollection | currency:'MXN':'symbol-narrow':'1.0-0' }}</span>
              </div>
            </div>
          </div>

          <!-- ═══ STATS GRID ═══ -->
          <div class="stats-grid">

            <div class="stat-card revenue-card">
              <div class="card-content">
                <div class="card-icon">💸</div>
                <div class="card-data">
                  <span class="label">Ingresos Totales</span>
                  <span class="value">$ {{ d.totalRevenue | number:'1.0-0' }}</span>
                </div>
              </div>
              <div class="sparkles">✨</div>
            </div>

            <div class="stat-card pink-glass">
              <div class="stat-header">
                <span class="emoji">💁‍♀️</span>
                <span class="trend">Clientas</span>
              </div>
              <span class="stat-number">{{ d.totalClients }}</span>
            </div>

            <div class="stat-card purple-glass">
              <div class="stat-header">
                <span class="emoji">🛍️</span>
                <span class="trend">Pedidos</span>
              </div>
              <span class="stat-number">{{ d.totalOrders }}</span>
            </div>

            <div class="stat-card peach-glass">
              <div class="stat-header">
                <span class="emoji">⏳</span>
                <span class="trend">Pendientes</span>
              </div>
              <span class="stat-number">{{ d.pendingOrders }}</span>
            </div>

            <div class="stat-card mint-glass">
              <div class="stat-header">
                <span class="emoji">💝</span>
                <span class="trend">Entregados</span>
              </div>
              <div>
                <span class="stat-number">{{ d.deliveredOrders }}</span>
                <span class="sub-stat">({{ metrics().successRate }}%)</span>
              </div>
            </div>

            <div class="stat-card blue-glass">
              <div class="stat-header">
                <span class="emoji">🚗</span>
                <span class="trend">Rutas</span>
              </div>
              <span class="stat-number">{{ d.activeRoutes }}</span>
            </div>

          </div>

          <!-- ═══ CHARTS ═══ -->
          <div class="charts-grid">
            <div class="chart-card wide">
              <h3>📈 Ventas vs Inversión</h3>
              <div echarts [options]="salesVsInvOptions" class="chart-container"></div>
            </div>

            <div class="chart-card">
              <h3>🎀 Tipos de Clientas</h3>
              <div echarts [options]="clientTypeOptions" class="chart-container"></div>
            </div>

            <div class="chart-card">
              <h3>🚚 Envíos vs PickUp</h3>
              <div echarts [options]="deliveryMethodOptions" class="chart-container"></div>
            </div>
          </div>

        }
      }
    </div>
  `,
  styles: [`
    /* ═══════════════════════════════════════════
       BASE & TOKENS
       ═══════════════════════════════════════════ */
    :host {
      display: block;
      --glass-bg: rgba(255, 255, 255, 0.75);
      --glass-border: rgba(255, 255, 255, 0.9);
      --shadow-soft: 0 8px 30px rgba(255, 105, 180, 0.15);
      --bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }

    .dashboard-container {
      padding: 1rem;
      padding-bottom: 5rem;
      max-width: 1100px;
      margin: 0 auto;
      position: relative;
      overflow-x: hidden;
    }

    /* ═══ BLOBS (decoración) ═══ */
    .blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      z-index: -1;
      opacity: 0.4;
      pointer-events: none;
    }
    .blob-1 {
      width: 250px; height: 250px;
      background: #ffe0f0;
      top: -40px; left: -40px;
      animation: float 6s infinite ease-in-out;
    }
    .blob-2 {
      width: 200px; height: 200px;
      background: #e0f0ff;
      bottom: 100px; right: -30px;
      animation: float 8s infinite ease-in-out reverse;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-20px); }
    }

    /* ═══════════════════════════════════════════
       HEADER
       ═══════════════════════════════════════════ */
    .dash-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 1.5rem;
      gap: 0.75rem;
      flex-wrap: wrap;
      animation: fadeIn 0.5s ease;
    }

    h1 {
      font-family: var(--font-display, inherit);
      font-size: 2rem;
      color: var(--pink-600, #db2777);
      margin: 0;
      line-height: 1.1;
    }
    .subtitle {
      color: var(--text-medium, #6b7280);
      margin: 4px 0 0;
      font-weight: 600;
      font-size: 0.85rem;
    }
    .date-badge {
      background: white;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.78rem;
      color: var(--pink-500, #ec4899);
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(255,182,193,0.15);
      border: 1px solid var(--pink-100, #fce7f3);
      white-space: nowrap;
    }

    /* ═══════════════════════════════════════════
       KPI ROW
       ═══════════════════════════════════════════ */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .kpi-card {
      background: white;
      border-radius: 14px;
      padding: 12px;
      border: 1.5px solid var(--pink-100, #fce7f3);
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      display: flex;
      align-items: center;
      gap: 10px;
      transition: transform 0.2s;
    }
    .kpi-card:active { transform: scale(0.97); }

    .kpi-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
    }
    .kpi-data {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .kpi-label {
      font-size: 0.65rem;
      color: var(--text-muted, #9ca3af);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .kpi-value {
      font-size: 1.1rem;
      font-weight: 800;
      color: var(--pink-600, #db2777);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .kpi-card.highlight {
      background: #fff1f2;
      border-color: #fecdd3;
    }
    .text-red { color: #e11d48 !important; }

    /* ═══════════════════════════════════════════
       STATS GRID
       ═══════════════════════════════════════════ */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .stat-card {
      background: var(--bg-card, white);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1.5px solid var(--border-soft, #f3f4f6);
      border-radius: 16px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 90px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      transition: transform 0.3s ease;
      animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
    }

    .stat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.3rem;
    }
    .stat-header .emoji {
      font-size: 1.3rem;
      background: var(--bg-main, #fdf2f8);
      border-radius: 50%;
      width: 34px; height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.04);
    }
    .stat-header .trend {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-light, #9ca3af);
      text-transform: uppercase;
    }

    .stat-number {
      font-size: 1.6rem;
      font-weight: 800;
      color: var(--text-dark, #1f2937);
    }
    .sub-stat {
      font-size: 0.7rem;
      color: #15803d;
      font-weight: 700;
      margin-left: 3px;
    }

    /* Revenue Card */
    .revenue-card {
      grid-column: 1 / -1;
      background: linear-gradient(135deg, var(--bg-main, #fdf2f8) 0%, var(--bg-card, white) 100%);
      border: 1.5px solid var(--border-soft, #fce7f3);
      min-height: auto;
      padding: 16px;
      position: relative;
      overflow: hidden;
    }
    .revenue-card .card-content {
      display: flex;
      align-items: center;
      gap: 14px;
      position: relative;
      z-index: 2;
    }
    .revenue-card .card-icon {
      font-size: 2rem;
      background: var(--bg-glass, rgba(255,255,255,0.8));
      padding: 10px;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .revenue-card .label {
      display: block;
      font-size: 0.75rem;
      color: var(--text-medium, #6b7280);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .revenue-card .value {
      font-size: 1.8rem;
      font-weight: 800;
      color: var(--pink-600, #db2777);
    }
    .revenue-card .sparkles {
      position: absolute;
      right: 8px; top: -8px;
      font-size: 3.5rem;
      opacity: 0.2;
      transform: rotate(20deg);
      animation: shimmer 3s infinite linear;
    }
    @keyframes shimmer {
      0%, 100% { opacity: 0.2; }
      50%      { opacity: 0.4; }
    }

    /* Card Colors */
    .pink-glass   { border-color: var(--pink-200, #fbcfe8); }
    .purple-glass { border-color: var(--pink-200, #fbcfe8); }
    .peach-glass  { border-color: var(--pink-200, #fbcfe8); }
    .mint-glass   { border-color: var(--color-success-bg, #d1fae5); }
    .blue-glass   { border-color: var(--pink-200, #fbcfe8); }

    /* Animation delays */
    .stat-card:nth-child(1) { animation-delay: 0.05s; }
    .stat-card:nth-child(2) { animation-delay: 0.1s; }
    .stat-card:nth-child(3) { animation-delay: 0.15s; }
    .stat-card:nth-child(4) { animation-delay: 0.2s; }
    .stat-card:nth-child(5) { animation-delay: 0.25s; }
    .stat-card:nth-child(6) { animation-delay: 0.3s; }

    /* ═══════════════════════════════════════════
       CHARTS
       ═══════════════════════════════════════════ */
    .charts-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .chart-card {
      background: var(--glass-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 18px;
      padding: 1rem;
      box-shadow: var(--shadow-soft);
      border: 1.5px solid var(--glass-border);
      height: 300px;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s;
      overflow: hidden;
    }

    .chart-card h3 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
      color: var(--pink-600, #db2777);
      font-weight: 700;
      flex-shrink: 0;
    }

    .chart-container {
      flex: 1;
      width: 100%;
      min-height: 0;
    }

    /* ═══ LOADING ═══ */
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 300px;
      color: var(--pink-400, #f472b6);
      letter-spacing: 0.5px;
    }
    .loading-state .spinner {
      font-size: 3rem;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }

    .fade-in { animation: fadeIn 0.5s ease; }

    @keyframes spin   { to { transform: rotate(360deg); } }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes popIn   { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }

    /* ═══════════════════════════════════════════
       RESPONSIVE: TABLET (con sidebar ~250px)
       A 768px el contenido real puede ser ~520px
       ═══════════════════════════════════════════ */
    @media (min-width: 600px) {
      .dashboard-container { padding: 1.25rem; }

      .kpi-row {
        grid-template-columns: repeat(4, 1fr);
      }

      .stats-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
      }
      .revenue-card {
        grid-column: span 2;
      }

      .stat-number { font-size: 1.8rem; }

      .charts-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .chart-card { height: 340px; padding: 1.25rem; }
      .chart-card.wide { grid-column: 1 / -1; }
    }

    /* ═══ DESKTOP / TABLET LANDSCAPE ═══ */
    @media (min-width: 900px) {
      .dashboard-container { padding: 1.5rem 2rem; }

      h1 { font-size: 2.3rem; }

      .kpi-card { padding: 14px 16px; }
      .kpi-value { font-size: 1.25rem; }

      .stats-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 1.25rem;
      }
      .stat-card { padding: 18px; min-height: 110px; }
      .stat-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 25px rgba(0,0,0,0.08);
      }

      .revenue-card .value { font-size: 2.2rem; }

      .chart-card { height: 380px; border-radius: 22px; padding: 1.5rem; }
      .chart-card:hover { transform: translateY(-3px); }
      .chart-card h3 { font-size: 1.15rem; }
    }

    /* ═══ LARGE DESKTOP ═══ */
    @media (min-width: 1200px) {
      .stats-grid {
        grid-template-columns: repeat(3, 1fr);
      }
      .revenue-card { grid-column: span 2; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  data = signal<Dashboard | null>(null);
  loading = signal(true);
  today = new Date();

  metrics = signal({
    salesToday: 0,
    salesWeek: 0,
    salesMonth: 0,
    avgTicket: 0,
    pendingCollection: 0,
    successRate: 0
  });

  // Chart Options
  salesVsInvOptions: any;
  clientTypeOptions: any;
  deliveryMethodOptions: any;

  constructor(private api: ApiService) { }

  ngOnInit(): void {
    this.initCharts();
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    const obs$ = forkJoin({
      dashboard: this.api.getDashboard(),
      orders: this.api.getOrders(),
      suppliers: this.api.getSuppliers(),
      clients: this.api.getClients()
    });

    obs$.pipe(
      switchMap((res: any) => {
        const suppliers = res.suppliers || [];
        if (suppliers.length === 0) {
          return of({ ...res, investments: [] });
        }

        const invObservables = suppliers.map((s: any) => this.api.getInvestments(s.id));
        return forkJoin(invObservables).pipe(
          map((invGroups: any) => ({
            ...res,
            investments: invGroups.flat()
          }))
        );
      })
    ).subscribe({
      next: (fullData: any) => {
        this.data.set(fullData.dashboard);
        this.processCharts(fullData.orders, fullData.investments, fullData.clients);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading dashboard data', err);
        this.loading.set(false);
      }
    });
  }

  processCharts(orders: OrderSummary[], investments: Investment[], clients: Client[]): void {
    // ─── FECHAS (sin mutar el objeto original) ───
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Inicio de la semana (domingo)
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);

    // Inicio del mes
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let salesToday = 0;
    let salesWeek = 0;
    let salesMonth = 0;
    let totalSales = 0;
    let pendingCollection = 0;
    let deliveredCount = 0;

    const productCounts: Record<string, number> = {};

    orders.forEach(o => {
      if (o.status === 'Canceled') return;

      const createdDate = new Date(o.createdAt);
      if (isNaN(createdDate.getTime())) return;

      // ─── VENTAS HOY: Solo pedidos ENTREGADOS hoy ───
      // Usa deliveredAt si existe, si no usa createdAt para pedidos Delivered
      if (o.status === 'Delivered') {
        const deliveredDate = (o as any).deliveredAt
          ? new Date((o as any).deliveredAt)
          : createdDate;

        if (!isNaN(deliveredDate.getTime())) {
          if (deliveredDate >= startOfToday) salesToday += o.total;
          if (deliveredDate >= startOfWeek) salesWeek += o.total;
          if (deliveredDate >= startOfMonth) salesMonth += o.total;
        }

        deliveredCount++;
        totalSales += o.total;
      }

      // ─── POR COBRAR: Solo pedidos activos NO entregados ───
      if (o.status !== 'Delivered' && o.status !== 'Canceled') {
        pendingCollection += (o.amountDue ?? o.total);
      }

      // Count products
      if (o.items) {
        o.items.forEach(item => {
          const name = item.productName.trim();
          productCounts[name] = (productCounts[name] || 0) + item.quantity;
        });
      }
    });

    const activeOrders = orders.filter(o => o.status !== 'Canceled').length;
    const avgTicket = deliveredCount > 0 ? totalSales / deliveredCount : 0;
    const successRate = activeOrders > 0 ? Math.round((deliveredCount / activeOrders) * 100) : 0;

    this.metrics.set({
      salesToday,
      salesWeek,
      salesMonth,
      avgTicket,
      pendingCollection,
      successRate
    });

    // ─── 1. Sales vs Investment (by month) ───
    const salesByMonth = new Map<string, number>();
    const invByMonth = new Map<string, number>();
    const months = new Set<string>();

    orders.forEach(o => {
      if (o.status === 'Canceled') return;

      const date = new Date(o.createdAt);
      if (isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      months.add(key);
      salesByMonth.set(key, (salesByMonth.get(key) || 0) + o.total);
    });

    investments.forEach(i => {
      const date = new Date(i.date);
      if (isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      months.add(key);
      invByMonth.set(key, (invByMonth.get(key) || 0) + i.amount);
    });

    const sortedMonths = Array.from(months).sort();
    const salesData = sortedMonths.map(m => salesByMonth.get(m) || 0);
    const invData = sortedMonths.map(m => invByMonth.get(m) || 0);
    const monthLabels = sortedMonths.map(m => {
      const [y, month] = m.split('-');
      const date = new Date(parseInt(y), parseInt(month) - 1, 1);
      return date.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
    });

    this.salesVsInvOptions = {
      ...this.salesVsInvOptions,
      xAxis: { ...this.salesVsInvOptions.xAxis, data: monthLabels },
      series: [
        { ...this.salesVsInvOptions.series[0], data: salesData },
        { ...this.salesVsInvOptions.series[1], data: invData }
      ]
    };

    // ─── 2. Client Types ───
    let countNueva = 0;
    let countFrecuente = 0;

    clients.forEach(c => {
      const isFrecuente =
        (c.orderCount > 1) ||
        ((c as any).ordersCount || 0) > 1 ||
        c.type === 'Frecuente';
      if (isFrecuente) countFrecuente++;
      else countNueva++;
    });

    this.clientTypeOptions = {
      ...this.clientTypeOptions,
      series: [{
        ...this.clientTypeOptions.series[0],
        data: [
          { name: '🌱 Nueva', value: countNueva },
          { name: '🔥 Frecuente', value: countFrecuente }
        ]
      }]
    };

    // ─── 3. Delivery Methods ───
    const deliveryMethods = orders.reduce((acc, o) => {
      if (o.status === 'Canceled') return acc;
      const type = o.orderType === 'Delivery' ? 'Domicilio'
        : (o.orderType === 'PickUp' ? 'PickUp' : o.orderType);
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const methodData = Object.keys(deliveryMethods).map(key => ({
      name: key,
      value: deliveryMethods[key]
    }));

    this.deliveryMethodOptions = {
      ...this.deliveryMethodOptions,
      series: [{ ...this.deliveryMethodOptions.series[0], data: methodData }]
    };
  }

  initCharts(): void {
    const colors = ['#FF85B3', '#5CDBD3', '#B37FEB', '#FFC069', '#FF9C6E'];

    this.salesVsInvOptions = {
      color: colors,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderColor: '#fce7f3',
        textStyle: { color: '#374151', fontSize: 12 },
        confine: true
      },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '5%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: [],
        axisLine: { lineStyle: { color: '#E8A0BF' } },
        axisLabel: { fontSize: 10, rotate: 0 }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { type: 'dashed', color: '#FFE0EB' } },
        axisLabel: { fontSize: 10 }
      },
      series: [
        {
          name: 'Ventas', type: 'line', smooth: true,
          data: [],
          itemStyle: { color: '#FF5C96' },
          lineStyle: { width: 3, shadowBlur: 8, shadowColor: 'rgba(255, 92, 150, 0.2)' },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(255, 92, 150, 0.3)' },
                { offset: 1, color: 'rgba(255, 255, 255, 0)' }
              ]
            }
          }
        },
        {
          name: 'Inversión', type: 'line', smooth: true,
          data: [],
          itemStyle: { color: '#85E3D5' },
          lineStyle: { width: 2.5, type: 'dashed' }
        }
      ]
    };

    this.clientTypeOptions = {
      color: ['#FF9DBF', '#FFC5D9', '#E8A0BF', '#D4C4D4'],
      tooltip: { trigger: 'item', confine: true },
      legend: { bottom: '0%', textStyle: { fontSize: 11 } },
      series: [
        {
          name: 'Tipo Clienta', type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 12, borderColor: '#fff', borderWidth: 2 },
          label: { show: false, position: 'center' },
          emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
          data: []
        }
      ]
    };

    this.deliveryMethodOptions = {
      color: ['#87E8DE', '#FFD666', '#FF85C0'],
      tooltip: { trigger: 'item', confine: true },
      legend: { bottom: '0%', textStyle: { fontSize: 11 } },
      series: [
        {
          name: 'Método', type: 'pie',
          radius: '55%',
          center: ['50%', '45%'],
          data: [],
          itemStyle: { borderRadius: 12, borderColor: '#fff', borderWidth: 2 },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.1)' }
          }
        }
      ]
    };
  }
}