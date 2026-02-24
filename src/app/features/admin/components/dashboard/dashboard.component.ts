import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgxEchartsDirective } from 'ngx-echarts';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { Dashboard, OrderSummary, Client } from '../../../../shared/models/models';

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

    // 🚀 OPTIMIZACIÓN: Solo pedimos las órdenes completas y el dashboard.
    // Lo ideal a futuro es que TODO esto venga calculado directo del getDashboard() en C#.
    forkJoin({
      dashboard: this.api.getDashboard(),
      orders: this.api.getOrders(),
      clients: this.api.getClients()
    }).subscribe({
      next: (res) => {
        this.data.set(res.dashboard);
        this.processMetricsAndCharts(res.orders, res.clients);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading dashboard data', err);
        this.loading.set(false);
      }
    });
  }

  processMetricsAndCharts(orders: OrderSummary[], clients: Client[]): void {
    // ─── FECHAS (Corrección de Zona Horaria) ───
    const now = new Date();

    // Función para obtener la fecha local en formato YYYY-MM-DD para evitar fallos de Timezone
    const getLocalYYYYMMDD = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayStr = getLocalYYYYMMDD(now);

    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let salesToday = 0;
    let salesWeek = 0;
    let salesMonth = 0;
    let totalSales = 0;
    let pendingCollection = 0;
    let deliveredCount = 0;

    const salesByMonth = new Map<string, number>();

    orders.forEach(o => {
      if (o.status === 'Canceled') return;

      const createdDate = new Date(o.createdAt);
      if (isNaN(createdDate.getTime())) return;

      // ─── POR COBRAR ───
      if (o.status !== 'Delivered') {
        // Asumiendo que amountDue existe, si no, usa el total
        pendingCollection += ((o as any).amountDue ?? o.total);
      }

      // ─── VENTAS Y ENTREGAS ───
      if (o.status === 'Delivered') {
        const deliveredDate = (o as any).deliveredAt ? new Date((o as any).deliveredAt) : createdDate;

        if (!isNaN(deliveredDate.getTime())) {
          const deliveredStr = getLocalYYYYMMDD(deliveredDate);

          // 🚀 BUG ARREGLADO: Ahora compara strings precisos (ej. "2026-02-23" === "2026-02-23")
          if (deliveredStr === todayStr) salesToday += o.total;
          if (deliveredDate >= startOfWeek) salesWeek += o.total;
          if (deliveredDate >= startOfMonth) salesMonth += o.total;

          // Datos para Gráfico de Ventas Mensuales
          const monthKey = `${deliveredDate.getFullYear()}-${String(deliveredDate.getMonth() + 1).padStart(2, '0')}`;
          salesByMonth.set(monthKey, (salesByMonth.get(monthKey) || 0) + o.total);
        }

        deliveredCount++;
        totalSales += o.total;
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

    // ─── ACTUALIZAR GRÁFICOS ───
    this.updateSalesChart(salesByMonth);
    this.updateClientsChart(clients);
    this.updateDeliveryChart(orders);
  }

  private updateSalesChart(salesByMonth: Map<string, number>) {
    // Ordenar los meses cronológicamente
    const sortedMonths = Array.from(salesByMonth.keys()).sort();
    const salesData = sortedMonths.map(m => salesByMonth.get(m) || 0);

    const monthLabels = sortedMonths.map(m => {
      const [y, month] = m.split('-');
      const date = new Date(parseInt(y), parseInt(month) - 1, 1);
      // Capitaliza la primera letra del mes
      let label = date.toLocaleDateString('es-MX', { month: 'short' });
      return label.charAt(0).toUpperCase() + label.slice(1);
    });

    this.salesVsInvOptions = {
      ...this.salesVsInvOptions,
      xAxis: { ...this.salesVsInvOptions.xAxis, data: monthLabels },
      series: [
        { ...this.salesVsInvOptions.series[0], data: salesData }
        // Se quitó la serie de Inversiones temporalmente para evitar la sobrecarga N+1
      ]
    };
  }

  private updateClientsChart(clients: Client[]) {
    let countNueva = 0;
    let countFrecuente = 0;

    clients.forEach(c => {
      const isFrecuente = (c as any).orderCount > 1 || c.type === 'Frecuente';
      if (isFrecuente) countFrecuente++;
      else countNueva++;
    });

    this.clientTypeOptions = {
      ...this.clientTypeOptions,
      series: [{
        ...this.clientTypeOptions.series[0],
        data: [
          { name: '🌱 Nueva', value: countNueva },
          { name: '💎 Frecuente', value: countFrecuente }
        ]
      }]
    };
  }

  private updateDeliveryChart(orders: OrderSummary[]) {
    const deliveryMethods = orders.reduce((acc, o) => {
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
  }

  initCharts(): void {
    const colors = ['#FF85B3', '#5CDBD3', '#B37FEB', '#FFC069', '#FF9C6E'];

    this.salesVsInvOptions = {
      color: colors,
      tooltip: { trigger: 'axis', confine: true },
      legend: { bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '5%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: [] },
      yAxis: { type: 'value' },
      series: [
        {
          name: 'Ventas', type: 'line', smooth: true,
          data: [],
          itemStyle: { color: '#FF5C96' },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: 'rgba(255, 92, 150, 0.3)' }, { offset: 1, color: 'rgba(255, 255, 255, 0)' }]
            }
          }
        }
      ]
    };

    this.clientTypeOptions = {
      color: ['#FF9DBF', '#D4C4D4'],
      tooltip: { trigger: 'item', confine: true },
      legend: { bottom: '0%' },
      series: [{ name: 'Tipo Clienta', type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'], data: [] }]
    };

    this.deliveryMethodOptions = {
      color: ['#87E8DE', '#FF85C0'],
      tooltip: { trigger: 'item', confine: true },
      legend: { bottom: '0%' },
      series: [{ name: 'Método', type: 'pie', radius: '55%', center: ['50%', '45%'], data: [] }]
    };
  }
}