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
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
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