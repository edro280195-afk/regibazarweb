import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ApiService } from '../../../core/services/api.service';
import { DashboardDto } from '../../../core/models';

gsap.registerPlugin(ScrollTrigger);
Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, AfterViewInit {
  private readonly api = inject(ApiService);

  @ViewChild('salesChart') salesChartRef!: ElementRef<HTMLCanvasElement>;

  readonly data = signal<DashboardDto | null>(null);
  readonly loading = signal(true);
  readonly aiInsight = signal<string | null>(null);
  readonly loadingInsight = signal(false);

  private chartInstance: Chart | null = null;

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngAfterViewInit(): void { }

  getInProcessOrders(dashboard: DashboardDto): number {
    return Math.max(0, dashboard.totalOrders - dashboard.deliveredOrders - dashboard.pendingOrders - dashboard.notDeliveredOrders);
  }

  orderShare(value: number, total: number): number {
    return total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  }

  getStatusEmoji(status: string): string {
    switch (status) {
      case 'Pending': return '⏳';
      case 'Confirmed': return '💖';
      case 'InRoute': return '🚗';
      case 'Delivered': return '✅';
      case 'Canceled': return '❌';
      default: return '📦';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'Pending': return 'Pendiente';
      case 'Confirmed': return 'Confirmado';
      case 'InRoute': return 'En ruta';
      case 'Delivered': return 'Entregado';
      case 'Canceled': return 'Cancelado';
      case 'NotDelivered': return 'No entregado';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Pending': return 'is-pending';
      case 'Confirmed': return 'is-confirmed';
      case 'InRoute': return 'is-route';
      case 'Delivered': return 'is-delivered';
      case 'Canceled':
      case 'NotDelivered': return 'is-canceled';
      default: return 'is-neutral';
    }
  }

  dashboardStatus(): string {
    const dashboard = this.data();
    if (!dashboard) return 'Todo bajo control';
    if (dashboard.pendingOrders > 0) return 'Tu prioridad está clara';
    return 'Todo bajo control';
  }

  dashboardStatusDetail(): string {
    const dashboard = this.data();
    if (!dashboard) return 'Cargando el resumen de tu negocio.';
    if (dashboard.pendingOrders > 0) return `${dashboard.pendingOrders.toLocaleString('es-MX')} pedidos esperan revisión.`;
    return 'No tienes pendientes que requieran atención inmediata.';
  }

  loadAiInsight(): void {
    const dashboard = this.data();
    if (!dashboard || this.loadingInsight()) return;

    this.loadingInsight.set(true);
    this.api.getDashboardInsight({
      revenueToday: dashboard.revenueToday,
      revenueMonth: dashboard.revenueMonth,
      pendingOrders: dashboard.pendingOrders,
      deliveredOrders: dashboard.deliveredOrders,
      activeRoutes: dashboard.activeRoutes,
      pendingAmount: dashboard.pendingAmount,
      totalClients: dashboard.totalClients
    }).subscribe({
      next: response => {
        this.aiInsight.set(response.text);
        this.loadingInsight.set(false);
      },
      error: () => {
        this.aiInsight.set(null);
        this.loadingInsight.set(false);
      }
    });
  }

  loadDashboard(): void {
    this.loading.set(true);
    this.api.getDashboard().subscribe({
      next: dashboard => {
        this.data.set(dashboard);
        this.loading.set(false);
        setTimeout(() => {
          this.buildChart(dashboard);
          this.initDashboardAnimations();
        }, 100);
      },
      error: () => this.loading.set(false)
    });
  }

  private initDashboardAnimations(): void {
    const timeline = gsap.timeline();

    timeline.to('.rb-dashboard-header', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });
    timeline.to('.rb-dash-hero, .rb-dash-kpi', {
      opacity: 1,
      y: 0,
      duration: 0.7,
      stagger: 0.08,
      ease: 'power2.out'
    }, '-=0.35');
    timeline.to('.rb-dash-panel, .rb-dash-action-card, .rb-dash-insight-card', {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.6,
      stagger: 0.08,
      ease: 'back.out(1.3)'
    }, '-=0.35');

    document.querySelectorAll('.rb-dash-count-val').forEach(counter => {
      const value = Number(counter.getAttribute('data-value') || 0);
      const animated = { value: 0 };

      gsap.to(animated, {
        value,
        duration: 1.5,
        ease: 'power3.out',
        onUpdate: () => {
          counter.textContent = Math.floor(animated.value).toLocaleString('es-MX');
        },
        scrollTrigger: {
          trigger: counter,
          start: 'top 90%'
        }
      });
    });
  }

  private buildChart(dashboard: DashboardDto): void {
    if (!this.salesChartRef?.nativeElement || !dashboard.salesByMonth?.length) return;

    this.chartInstance?.destroy();

    const canvas = this.salesChartRef.nativeElement;
    const context = canvas.getContext('2d');
    if (!context) return;

    const gradient = context.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(255, 95, 162, 0.27)');
    gradient.addColorStop(1, 'rgba(216, 198, 247, 0.03)');

    this.chartInstance = new Chart(context, {
      type: 'line',
      data: {
        labels: dashboard.salesByMonth.map(item => item.month),
        datasets: [{
          label: 'Ventas',
          data: dashboard.salesByMonth.map(item => item.sales),
          borderColor: '#db3f84',
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: '#ff5fa2',
          pointBorderColor: '#fffafc',
          pointBorderWidth: 2,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#63314e',
            titleFont: { family: 'Quicksand' },
            bodyFont: { family: 'Quicksand' },
            padding: 11,
            cornerRadius: 12,
            callbacks: { label: context => `$${Number(context.raw).toLocaleString('es-MX')}` }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#ad7d98', font: { family: 'Quicksand', size: 11 } }
          },
          y: {
            grid: { color: 'rgba(235, 194, 216, .35)' },
            ticks: {
              color: '#ad7d98',
              font: { family: 'Quicksand', size: 11 },
              callback: value => `$${Number(value).toLocaleString('es-MX')}`
            }
          }
        }
      }
    });
  }
}
