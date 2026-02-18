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

      <header class="dash-header">
        <div class="greeting">
          <h1>Hola👑</h1>
          <p class="subtitle">Asi van las cosas en Regi Bazar✨</p>
        </div>
        <div class="date-badge">
          📅 {{ today | date:'fullDate' }}
        </div>
      </header>

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner">🎀</div>
          <p>Cargando tus éxitos...</p>
        </div>
      } @else {
        @if (data(); as d) {
          
          <!-- NEW BUSINESS KPIs -->
          <div class="kpi-row fade-in">
             <div class="kpi-card">
               <span class="kpi-label">Ventas Hoy</span>
               <span class="kpi-value">{{ metrics().salesToday | currency:'MXN' }}</span>
             </div>
             <div class="kpi-card">
               <span class="kpi-label">Esta Semana</span>
               <span class="kpi-value">{{ metrics().salesWeek | currency:'MXN' }}</span>
             </div>
             <div class="kpi-card">
               <span class="kpi-label">Este Mes</span>
               <span class="kpi-value">{{ metrics().salesMonth | currency:'MXN' }}</span>
             </div>
             <div class="kpi-card">
                <span class="kpi-label">Ticket Promedio</span>
                <span class="kpi-value">{{ metrics().avgTicket | currency:'MXN' }}</span>
             </div>
             <div class="kpi-card highlight">
                <span class="kpi-label">Por Cobrar</span>
                <span class="kpi-value text-red">{{ metrics().pendingCollection | currency:'MXN' }}</span>
             </div>
          </div>

          <div class="stats-grid">
            
            <div class="stat-card revenue-card">
              <div class="card-content">
                <div class="card-icon">💸</div>
                <div class="card-data">
                  <span class="label">Ingresos Totales</span>
                  <span class="value">$ {{ d.totalRevenue | number:'1.2-2' }}</span>
                </div>
              </div>
              <div class="sparkles">✨</div>
            </div>

            <div class="stat-card pink-glass">
              <div class="stat-header">
                <span class="emoji">💁‍♀️</span>
                <span class="trend up">Clientas</span>
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
                <span class="sub-stat">({{ metrics().successRate }}% éxito)</span>
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

          <!-- CHARTS SECTION -->
           <div class="charts-grid">
             <!-- Chart 1: Sales vs Investment -->
             <div class="chart-card wide">
               <h3>📈 Ventas vs Inversión</h3>
               <div echarts [options]="salesVsInvOptions" class="chart-container"></div>
             </div>
             
             <!-- Chart 2: Top Products (NEW) -->
             <div class="chart-card">
               <h3>💄 Top Productos</h3>
               <div echarts [options]="topProductsOptions" class="chart-container"></div>
             </div>

             <!-- Chart 3: Top Clients -->
             <div class="chart-card">
               <h3>👑 Top Clientas</h3>
               <div echarts [options]="topClientsOptions" class="chart-container"></div>
             </div>

             <!-- Chart 4: Client Types (Pie) -->
             <div class="chart-card">
               <h3>🎀 Tipos de Clientas</h3>
               <div echarts [options]="clientTypeOptions" class="chart-container"></div>
             </div>

             <!-- Chart 5: Delivery Methods (Pie) -->
             <div class="chart-card">
               <h3>🚚 Envíos vs PickUp</h3>
               <div echarts [options]="deliveryMethodOptions" class="chart-container"></div>
             </div>
           </div>

                  <!-- Quick Actions removed as per user request -->
        }
      }
    </div>
  `,
  styles: [`
    :host {
      --glass-bg: rgba(255, 255, 255, 0.75);
      --glass-border: rgba(255, 255, 255, 0.9);
      --shadow-soft: 0 8px 30px rgba(255, 105, 180, 0.15);
      --bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }

    .dashboard-container {
      padding: 1rem;
      max-width: 1200px;
      margin: 0 auto;
      position: relative;
    }
    
    /* CHARTS GRID */
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 1.5rem;
      margin-bottom: 3rem;
    }

    /* KPI ROW */
    .kpi-row {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem; margin-bottom: 2rem;
    }
    .kpi-card {
      background: white; border-radius: 1rem; padding: 1rem;
      border: 1px solid var(--pink-100); box-shadow: var(--shadow-sm);
      display: flex; flex-direction: column; align-items: flex-start;
      transition: transform 0.2s;
    }
    .kpi-card:hover { transform: translateY(-3px); }
    .kpi-label { font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; }
    .kpi-value { font-size: 1.3rem; font-weight: 800; color: var(--pink-600); }
    .kpi-card.highlight { background: #fff1f2; border-color: #fecdd3; }
    .text-red { color: #e11d48; }
    .sub-stat { font-size: 0.75rem; color: #15803d; font-weight: 700; margin-left: 5px; }
    
    .chart-card {
      background: var(--glass-bg);
      backdrop-filter: blur(12px);
      border-radius: 2rem;
      padding: 1.5rem;
      box-shadow: var(--shadow-soft);
      border: 1px solid var(--glass-border);
      height: 400px;
      display: flex; flex-direction: column;
      transition: transform 0.3s;
    }
    .chart-card:hover { transform: translateY(-5px); }

    .chart-card.wide { grid-column: 1 / -1; }
    
    .chart-card h3 {
      margin: 0 0 1rem;
      font-size: 1.2rem; color: var(--pink-600);
      font-weight: 700;
      font-family: var(--font-display);
    }
    
    .chart-container { flex: 1; width: 100%; height: 100%; min-height: 0; }

    /* DECORACIÓN DE FONDO */
    .blob {
      position: absolute; border-radius: 50%; filter: blur(80px); z-index: -1; opacity: 0.5;
    }
    .blob-1 { width: 300px; height: 300px; background: #ffe0f0; top: -50px; left: -100px; animation: float 6s infinite ease-in-out; }
    .blob-2 { width: 250px; height: 250px; background: #e0f0ff; bottom: 0; right: -50px; animation: float 8s infinite ease-in-out reverse; }

    /* HEADER */
    .dash-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      margin-bottom: 2.5rem; animation: fadeIn 0.8s ease;
    }

    h1 {
      font-family: var(--font-display);
      font-size: 2.5rem;
      color: var(--pink-600);
      margin: 0;
      text-shadow: 2px 2px 0px rgba(255,255,255,0.8);
    }

    .subtitle {
      font-family: var(--font-body);
      color: var(--text-medium);
      margin: 5px 0 0;
      font-weight: 600;
    }

    .date-badge {
      background: white; padding: 8px 16px; border-radius: 20px;
      font-size: 0.9rem; color: var(--pink-500); font-weight: 700;
      box-shadow: 0 4px 10px rgba(255, 182, 193, 0.2);
      border: 1px solid var(--pink-100);
    }

    /* GRID DE ESTADÍSTICAS */
    .stats-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1.2rem; margin-bottom: 3rem;
    }

    .stat-card {
      background: var(--bg-card);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-soft);
      border-radius: 1.8rem;
      padding: 1.2rem;
      display: flex; flex-direction: column; justify-content: space-between;
      height: 120px;
      box-shadow: var(--shadow-sm);
      transition: all 0.4s var(--bounce);
      cursor: default;
      animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
    }
    
    .stat-card:hover { transform: translateY(-8px) scale(1.02); box-shadow: var(--shadow-md); }

    /* Estilos específicos de tarjetas */
    /* Estilos específicos de tarjetas */
    .revenue-card {
      grid-column: 1 / -1;
      background: linear-gradient(135deg, var(--bg-main) 0%, var(--bg-card) 100%);
      border: 1px solid var(--border-soft);
      height: auto; padding: 1.5rem 2rem; position: relative; overflow: hidden;
    }
    
    @media (min-width: 600px) { .revenue-card { grid-column: span 2; } }

    .revenue-card .card-content { display: flex; align-items: center; gap: 1.5rem; position: relative; z-index: 2; }
    .revenue-card .card-icon { font-size: 2.5rem; background: var(--bg-glass); padding: 12px; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
    .revenue-card .label { display: block; font-size: 0.9rem; color: var(--text-medium); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .revenue-card .value { font-size: 2.5rem; font-weight: 800; color: var(--pink-600); font-family: var(--font-body); }
    .revenue-card .sparkles { position: absolute; right: 10px; top: -10px; font-size: 5rem; opacity: 0.3; transform: rotate(20deg); animation: shimmer 3s infinite linear; }

    /* Colores pastel adaptados a tema */
    .pink-glass { background: var(--bg-card); border-color: var(--pink-200); }
    .purple-glass { background: var(--bg-card); border-color: var(--pink-200); }
    .peach-glass { background: var(--bg-card); border-color: var(--pink-200); }
    .mint-glass { background: var(--bg-card); border-color: var(--color-success-bg); }
    .blue-glass { background: var(--bg-card); border-color: var(--pink-200); }

    .stat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .stat-header .emoji { font-size: 1.5rem; background: var(--bg-main); border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .stat-header .trend { font-size: 0.85rem; font-weight: 700; color: var(--text-light); }
    
    .stat-number { font-size: 2rem; font-weight: 800; color: var(--text-dark); }

    /* Anim delays */
    .stat-card:nth-child(1) { animation-delay: 0.1s; }
    .stat-card:nth-child(2) { animation-delay: 0.2s; }
    .stat-card:nth-child(3) { animation-delay: 0.3s; }
    .stat-card:nth-child(4) { animation-delay: 0.4s; }
    .stat-card:nth-child(5) { animation-delay: 0.5s; }
    .stat-card:nth-child(6) { animation-delay: 0.6s; }

    /* SECCIÓN DE ACCIONES */
    .section-title h3 {
      font-size: 1.4rem; color: var(--text-dark); margin-bottom: 1rem;
      font-weight: 700; margin-top: 1rem; font-family: var(--font-display);
    }

    .actions-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem;
    }

    .action-btn {
      background: white;
      border-radius: 1.5rem;
      padding: 1.5rem 1rem;
      text-decoration: none;
      display: flex; flex-direction: column; align-items: center;
      gap: 12px;
      transition: all 0.3s var(--bounce);
      border: 2px solid transparent;
      box-shadow: var(--shadow-sm);
    }

    .action-btn:hover {
      transform: translateY(-5px);
      box-shadow: var(--shadow-md);
      border-color: var(--pink-200);
      background: var(--pink-50);
    }

    .icon-circle {
      width: 55px; height: 55px; border-radius: 20px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.8rem; transition: transform 0.3s;
    }

    /* Colores de iconos */
    .upload .icon-circle { background: #fff0f6; color: #eb2f96; }
    .orders .icon-circle { background: #e6f7ff; color: #1890ff; }
    .routes .icon-circle { background: #f9f0ff; color: #722ed1; }
    .clients .icon-circle { background: #fff7e6; color: #fa8c16; }
    .suppliers .icon-circle { background: #f6ffed; color: #52c41a; }

    .action-btn:hover .icon-circle { transform: scale(1.1) rotate(5deg); }
    
    .action-btn span {
      font-weight: 700; color: var(--text-medium); font-size: 0.95rem;
    }

    /* LOADING */
    .loading-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 300px; color: var(--pink-400); font-family: var(--font-display); letter-spacing: 1px;
    }
    
    .spinner { font-size: 3rem; animation: spin 1s infinite linear; margin-bottom: 1rem; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes popIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }

    /* MEDIA QUERIES */
    @media (max-width: 1024px) {
      .stats-grid { gap: 1rem; grid-template-columns: repeat(3, 1fr); }
      .revenue-card { grid-column: 1 / -1; }
      
      .charts-grid { grid-template-columns: 1fr 1fr; gap: 1rem; }
      .chart-card { height: 340px; }
      
      .dash-header { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
      .date-badge { align-self: flex-start; margin-top: 0.5rem; }
    }

    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .charts-grid { grid-template-columns: 1fr; }
      .chart-card { height: 320px; padding: 1rem; }
    }

    @media (max-width: 480px) {
      .stats-grid { grid-template-columns: 1fr; }
      .stat-card { height: auto; min-height: 100px; }
      .stat-number { font-size: 2rem; }
      .revenue-card .value { font-size: 2.2rem; }
      .actions-grid { grid-template-columns: 1fr 1fr; }
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
  topClientsOptions: any;
  clientTypeOptions: any;
  deliveryMethodOptions: any;
  topProductsOptions: any;

  constructor(private api: ApiService) { }

  ngOnInit(): void {
    this.initCharts();
    this.loadData();
  }

  loadData() {
    this.loading.set(true);

    // 1. Fetch Core Data
    const obs$ = forkJoin({
      dashboard: this.api.getDashboard(),
      orders: this.api.getOrders(),
      suppliers: this.api.getSuppliers(),
      clients: this.api.getClients()
    });

    obs$.pipe(
      switchMap((res: any) => {
        // 2. Fetch Investments for all Suppliers
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

  processCharts(orders: OrderSummary[], investments: Investment[], clients: Client[]) {
    // ── CALCULAR KPIs DE NEGOCIO ──
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())); // Sunday
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    let salesToday = 0;
    let salesWeek = 0;
    let salesMonth = 0;
    let totalSales = 0;
    let pendingCol = 0;
    let deliveredCount = 0;

    // Use a flattened list of items for product popularity
    const productCounts: Record<string, number> = {};

    orders.forEach(o => {
      if (o.status === 'Canceled') return;

      const orderDate = new Date(o.createdAt);
      if (isNaN(orderDate.getTime())) return;

      if (orderDate >= startOfToday) salesToday += o.total;
      if (orderDate >= startOfWeek) salesWeek += o.total;
      if (orderDate >= startOfMonth) salesMonth += o.total;

      totalSales += o.total;
      pendingCol += (o.amountDue ?? o.total); // From payment features

      if (o.status === 'Delivered') deliveredCount++;

      // Count products
      if (o.items) {
        o.items.forEach(item => {
          const name = item.productName.trim();
          productCounts[name] = (productCounts[name] || 0) + item.quantity;
        });
      }
    });

    const activeOrders = orders.filter(o => o.status !== 'Canceled').length;
    const avgTicket = activeOrders > 0 ? totalSales / activeOrders : 0;
    const successRate = activeOrders > 0 ? Math.round((deliveredCount / activeOrders) * 100) : 0;

    this.metrics.set({
      salesToday,
      salesWeek,
      salesMonth,
      avgTicket,
      pendingCollection: pendingCol,
      successRate
    });

    // ── 1. Sales vs Investment (Last 12 months) ──
    const salesByMonth = new Map<string, number>();
    const invByMonth = new Map<string, number>();
    const months = new Set<string>();

    // Process Orders (Sales)
    orders.forEach(o => {
      // Exclude Canceled? Assuming active orders only for revenue
      if (o.status === 'Canceled') return;

      const date = new Date(o.createdAt || o.expiresAt); // Fallback
      if (isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`; // YYYY-MM
      months.add(key);
      salesByMonth.set(key, (salesByMonth.get(key) || 0) + o.total);
    });

    // Process Investments
    investments.forEach(i => {
      const date = new Date(i.date);
      if (isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`; // YYYY-MM
      months.add(key);
      invByMonth.set(key, (invByMonth.get(key) || 0) + i.amount);
    });

    // Sort Months
    const sortedMonths = Array.from(months).sort();

    // Fill Data Arrays
    const salesData = sortedMonths.map(m => salesByMonth.get(m) || 0);
    const invData = sortedMonths.map(m => invByMonth.get(m) || 0);
    // Format Month Labels (e.g. "Ago 24")
    const monthLabels = sortedMonths.map(m => {
      const [y, month] = m.split('-');
      const date = new Date(parseInt(y), parseInt(month) - 1, 1);
      return date.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
    });

    // Update Chart Options
    this.salesVsInvOptions = {
      ...this.salesVsInvOptions,
      xAxis: { ...this.salesVsInvOptions.xAxis, data: monthLabels },
      series: [
        { ...this.salesVsInvOptions.series[0], data: salesData },
        { ...this.salesVsInvOptions.series[1], data: invData }
      ]
    };

    // ── 2. Top Clients (by Order Count) ──
    const sortedClients = [...clients]
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 5);

    this.topClientsOptions = {
      ...this.topClientsOptions,
      yAxis: { ...this.topClientsOptions.yAxis, data: sortedClients.map(c => c.name) },
      series: [{
        ...this.topClientsOptions.series[0],
        data: sortedClients.map(c => c.orderCount)
      }]
    };

    // ── 3. Client Types (by Tag) ──
    const clientTypes = clients.reduce((acc, c) => {
      // Assuming 'tag' exists or infer it. If 'tag' is missing, fallback to 'None'
      const tag = (c as any).tag || 'None';
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Map tags to user-friendly names
    const typeMap: Record<string, string> = {
      'None': '✨ Normal', 'Frequent': '🔥 Frecuente', 'New': '🌱 Nueva', 'Problematic': '⚠️ Cuidado'
    };

    const typeData = Object.keys(clientTypes).map(key => ({
      name: typeMap[key] || key,
      value: clientTypes[key]
    }));

    this.clientTypeOptions = {
      ...this.clientTypeOptions,
      series: [{ ...this.clientTypeOptions.series[0], data: typeData }]
    };

    // ── 4. Delivery Methods ──
    const deliveryMethods = orders.reduce((acc, o) => {
      // Only count active?
      if (o.status === 'Canceled') return acc;
      const type = o.orderType === 'Delivery' ? 'Domicilio' : (o.orderType === 'PickUp' ? 'PickUp' : o.orderType);
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

    // ── 5. Top Products (NEW) ──
    const sortedProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    this.topProductsOptions = {
      ...this.topClientsOptions, // Reuse style from top clients
      yAxis: { ...this.topClientsOptions.yAxis, data: sortedProducts.map(p => p[0]) },
      series: [{
        ...this.topClientsOptions.series[0],
        name: 'Unidades',
        itemStyle: { color: '#FF85B3', borderRadius: [0, 20, 20, 0] },
        data: sortedProducts.map(p => p[1])
      }]
    };
  }

  initCharts() {
    // 🎨 PALETA COQUETTE PARA GRÁFICAS
    const colors = ['#FF85B3', '#5CDBD3', '#B37FEB', '#FFC069', '#FF9C6E'];

    this.salesVsInvOptions = {
      color: colors,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'var(--bg-overlay)',
        borderColor: 'var(--pink-200)',
        textStyle: { color: 'var(--text-medium)' }
      },
      legend: { bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: [], axisLine: { lineStyle: { color: '#E8A0BF' } } },
      yAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { type: 'dashed', color: '#FFE0EB' } } },
      series: [
        {
          name: 'Ventas', type: 'line', smooth: true,
          data: [],
          itemStyle: { color: '#FF5C96' },
          lineStyle: { width: 4, shadowBlur: 10, shadowColor: 'rgba(255, 92, 150, 0.3)' },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(255, 92, 150, 0.4)' }, { offset: 1, color: 'rgba(255, 255, 255, 0)' }] } }
        },
        {
          name: 'Inversión', type: 'line', smooth: true,
          data: [],
          itemStyle: { color: '#85E3D5' },
          lineStyle: { width: 3, type: 'dashed' }
        }
      ]
    };

    this.topClientsOptions = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value', splitLine: { show: false } },
      yAxis: { type: 'category', data: [], axisTick: { show: false }, axisLine: { show: false } },
      series: [
        {
          name: 'Compras', type: 'bar',
          data: [],
          itemStyle: { color: '#B37FEB', borderRadius: [0, 20, 20, 0] },
          barWidth: '50%'
        }
      ]
    };

    // (Code continues for other charts...)
    this.clientTypeOptions = {
      color: ['#FF9DBF', '#FFC5D9', '#E8A0BF', '#D4C4D4'],
      tooltip: { trigger: 'item' },
      legend: { bottom: '0%' },
      series: [
        {
          name: 'Tipo Clienta', type: 'pie', radius: ['45%', '75%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 15, borderColor: '#fff', borderWidth: 3 },
          label: { show: false, position: 'center' },
          emphasis: { label: { show: true, fontSize: '20', fontWeight: 'bold' } },
          data: []
        }
      ]
    };

    this.deliveryMethodOptions = {
      color: ['#87E8DE', '#FFD666', '#FF85C0'],
      tooltip: { trigger: 'item' },
      legend: { bottom: '0%' },
      series: [
        {
          name: 'Método', type: 'pie', radius: '60%',
          data: [],
          itemStyle: { borderRadius: 15, borderColor: '#fff', borderWidth: 3 },
          emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.1)' } }
        }
      ]
    };
  }
}