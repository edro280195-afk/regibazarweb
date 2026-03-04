import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ApiService } from '../../../../core/services/api.service';
import { Dashboard } from '../../../../shared/models/models';

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

    this.api.getDashboard().subscribe({
      next: (dashboard) => {
        this.data.set(dashboard);
        this.processMetricsAndCharts(dashboard);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading dashboard data', err);
        this.loading.set(false);
      }
    });
  }

  processMetricsAndCharts(dashboard: Dashboard): void {
    const totalOrders = dashboard.totalOrders || 1;
    const deliveredCount = dashboard.deliveredOrders || 0;
    const successRate = Math.round((deliveredCount / totalOrders) * 100);

    this.metrics.set({
      salesToday: dashboard.revenueToday || 0,
      salesWeek: 0,
      salesMonth: dashboard.revenueMonth || 0,
      avgTicket: deliveredCount > 0 ? (dashboard.totalRevenue / deliveredCount) : 0,
      pendingCollection: dashboard.activePeriod
        ? Math.max(0, dashboard.activePeriod.totalSales - dashboard.totalRevenue)
        : 0,
      successRate
    });

    this.updateSalesChart(dashboard.salesByMonth || []);
    this.updateClientsChart(dashboard.clientsNueva || 0, dashboard.clientsFrecuente || 0);
    this.updateDeliveryChart(dashboard.ordersDelivery || 0, dashboard.ordersPickUp || 0);
  }

  private updateSalesChart(salesByMonth: { month: string; sales: number }[]) {
    this.salesVsInvOptions = {
      ...this.salesVsInvOptions,
      xAxis: { ...this.salesVsInvOptions.xAxis, data: salesByMonth.map(s => s.month) },
      series: [{ ...this.salesVsInvOptions.series[0], data: salesByMonth.map(s => s.sales) }]
    };
  }

  private updateClientsChart(nueva: number, frecuente: number) {
    this.clientTypeOptions = {
      ...this.clientTypeOptions,
      series: [{
        ...this.clientTypeOptions.series[0],
        data: [
          { name: '🌱 Nueva', value: nueva },
          { name: '💎 Frecuente', value: frecuente }
        ]
      }]
    };
  }

  private updateDeliveryChart(delivery: number, pickup: number) {
    this.deliveryMethodOptions = {
      ...this.deliveryMethodOptions,
      series: [{
        ...this.deliveryMethodOptions.series[0],
        data: [
          { name: '🛵 Domicilio', value: delivery },
          { name: '🛍️ PickUp', value: pickup }
        ]
      }]
    };
  }

  private cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  initCharts(): void {
    const primary = this.cssVar('--pink-500') || '#FF5C96';
    const light = this.cssVar('--pink-300') || '#FFA6C9';
    const muted = this.cssVar('--pink-200') || '#FFC5D9';
    const success = this.cssVar('--color-success') || '#22c55e';
    const warning = this.cssVar('--color-warning') || '#f59e0b';
    const colors = [primary, light, muted, success, warning];

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
          itemStyle: { color: primary },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: primary + '4D' }, { offset: 1, color: primary + '00' }]
            }
          }
        }
      ]
    };

    this.clientTypeOptions = {
      color: [primary, muted],
      tooltip: { trigger: 'item', confine: true },
      legend: { bottom: '0%' },
      series: [{ name: 'Tipo Clienta', type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'], data: [] }]
    };

    this.deliveryMethodOptions = {
      color: [success, primary],
      tooltip: { trigger: 'item', confine: true },
      legend: { bottom: '0%' },
      series: [{ name: 'Método', type: 'pie', radius: '55%', center: ['50%', '45%'], data: [] }]
    };
  }
}