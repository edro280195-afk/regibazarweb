import { Component, inject, signal, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { DashboardDto } from '../../../core/models';
import { Chart, registerables } from 'chart.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, RouterLink, DatePipe],
  template: `
    <div class="dashboard-container space-y-6 lg:space-y-8 pb-10">
      <!-- Title -->
      <div class="dashboard-header opacity-0 translate-y-[-20px]">
        <h1 class="text-2xl lg:text-3xl font-bold text-pink-900">
          Dashboard
          <span class="text-2xl lg:text-3xl" style="font-family: 'Dancing Script', cursive; color: #ec4899;"> ✨ Resumen General</span>
        </h1>
      </div>

      @if (loading()) {
        <!-- Loading Shimmer -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="shimmer h-32 rounded-2xl"></div>
          }
        </div>
      } @else if (data()) {
        <!-- KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <!-- Total Orders -->
          <div class="kpi-card card-coquette p-5 relative overflow-hidden group opacity-0 translate-y-10">
            <div class="absolute top-0 right-0 w-20 h-20 bg-pink-100 rounded-full -translate-y-6 translate-x-6 group-hover:scale-150 transition-transform duration-500"></div>
            <div class="relative">
              <div class="flex items-center gap-2 mb-3">
                <span class="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center text-xl">📦</span>
                <span class="text-xs font-semibold text-pink-400 uppercase tracking-wider">Pedidos Totales</span>
              </div>
              <p class="text-4xl font-bold text-pink-900 flex items-baseline gap-1">
                <span class="count-val" [attr.data-value]="data()?.totalOrders">0</span>
              </p>
              <div class="flex gap-3 mt-2 text-xs">
                <span class="text-green-600">✅ {{ data()!.deliveredOrders }} entregados</span>
                <span class="text-amber-600">⏳ {{ data()!.pendingOrders }} pendientes</span>
              </div>
            </div>
          </div>

          <!-- Revenue Today -->
          <div class="kpi-card card-coquette p-5 relative overflow-hidden group opacity-0 translate-y-10">
            <div class="absolute top-0 right-0 w-20 h-20 bg-green-100 rounded-full -translate-y-6 translate-x-6 group-hover:scale-150 transition-transform duration-500"></div>
            <div class="relative">
              <div class="flex items-center gap-2 mb-3">
                <span class="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-xl">💵</span>
                <span class="text-xs font-semibold text-green-500 uppercase tracking-wider">Ingresos Hoy</span>
              </div>
              <p class="text-4xl font-bold text-green-700 flex items-baseline gap-1">
                <span class="text-2xl font-medium">$</span>
                <span class="count-val" [attr.data-value]="data()?.revenueToday">0</span>
              </p>
            </div>
          </div>

          <!-- Revenue Month -->
          <div class="kpi-card card-coquette p-5 relative overflow-hidden group opacity-0 translate-y-10">
            <div class="absolute top-0 right-0 w-20 h-20 bg-purple-100 rounded-full -translate-y-6 translate-x-6 group-hover:scale-150 transition-transform duration-500"></div>
            <div class="relative">
              <div class="flex items-center gap-2 mb-3">
                <span class="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-xl">💰</span>
                <span class="text-xs font-semibold text-purple-400 uppercase tracking-wider">Ingresos del Mes</span>
              </div>
              <p class="text-4xl font-bold text-purple-700 flex items-baseline gap-1">
                <span class="text-2xl font-medium">$</span>
                <span class="count-val" [attr.data-value]="data()?.revenueMonth">0</span>
              </p>
            </div>
          </div>

          <!-- Total Clients -->
          <div class="kpi-card card-coquette p-5 relative overflow-hidden group opacity-0 translate-y-10">
            <div class="absolute top-0 right-0 w-20 h-20 bg-rose-100 rounded-full -translate-y-6 translate-x-6 group-hover:scale-150 transition-transform duration-500"></div>
            <div class="relative">
              <div class="flex items-center gap-2 mb-3">
                <span class="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-xl">👩‍💼</span>
                <span class="text-xs font-semibold text-rose-400 uppercase tracking-wider">Total Clientas</span>
              </div>
              <p class="text-4xl font-bold text-rose-700 flex items-baseline gap-1">
                <span class="count-val" [attr.data-value]="data()?.totalClients">0</span>
              </p>
              <div class="flex gap-3 mt-2 text-xs">
                <span class="text-pink-500">🌸 {{ data()!.clientsNueva }} nuevas</span>
                <span class="text-purple-500">👑 {{ data()!.clientsFrecuente }} frecuentes</span>
              </div>
            </div>
          </div>

          <!-- Active Routes -->
          <div class="kpi-card card-coquette p-5 relative overflow-hidden group opacity-0 translate-y-10">
            <div class="absolute top-0 right-0 w-20 h-20 bg-blue-100 rounded-full -translate-y-6 translate-x-6 group-hover:scale-150 transition-transform duration-500"></div>
            <div class="relative">
              <div class="flex items-center gap-2 mb-3">
                <span class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xl">🚗</span>
                <span class="text-xs font-semibold text-blue-400 uppercase tracking-wider">Rutas Activas</span>
              </div>
              <p class="text-4xl font-bold text-blue-700 flex items-baseline gap-1">
                <span class="count-val" [attr.data-value]="data()?.activeRoutes">0</span>
              </p>
            </div>
          </div>

          <!-- Pending Amount -->
          <div class="kpi-card card-coquette p-5 relative overflow-hidden group opacity-0 translate-y-10">
            <div class="absolute top-0 right-0 w-20 h-20 bg-amber-100 rounded-full -translate-y-6 translate-x-6 group-hover:scale-150 transition-transform duration-500"></div>
            <div class="relative">
              <div class="flex items-center gap-2 mb-3">
                <span class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl">💳</span>
                <span class="text-xs font-semibold text-amber-500 uppercase tracking-wider">Por Cobrar</span>
              </div>
              <p class="text-4xl font-bold text-amber-700 flex items-baseline gap-1">
                <span class="text-2xl font-medium">$</span>
                <span class="count-val" [attr.data-value]="data()?.pendingAmount">0</span>
              </p>
            </div>
          </div>
        </div>

        <!-- Active Period Card -->
        @if (data()!.activePeriod) {
          <div class="active-period-banner card-coquette p-6 opacity-0 translate-y-10" style="background: linear-gradient(135deg, rgba(253,242,248,0.9), rgba(237,233,254,0.9));">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 class="text-lg font-bold text-pink-900 flex items-center gap-2">
                  📋 Corte Activo: {{ data()!.activePeriod!.name }}
                </h3>
              </div>
              <div class="flex flex-wrap gap-6">
                <div class="text-center">
                  <p class="text-xs text-pink-400 font-semibold uppercase">Ventas</p>
                  <p class="text-xl font-bold text-green-700">{{ data()!.activePeriod!.totalSales | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-pink-400 font-semibold uppercase">Invertido</p>
                  <p class="text-xl font-bold text-red-600">{{ data()!.activePeriod!.totalInvested | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-pink-400 font-semibold uppercase">Utilidad</p>
                  <p class="text-xl font-bold" [class]="data()!.activePeriod!.netProfit >= 0 ? 'text-green-700' : 'text-red-600'">
                    {{ data()!.activePeriod!.netProfit | currency:'MXN':'symbol-narrow':'1.0-0' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Charts & Activity Row -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Monthly Sales Chart -->
          <div class="chart-container card-coquette p-6 opacity-0 translate-y-10">
            <h3 class="text-base font-bold text-pink-900 mb-4 flex items-center gap-2">📈 Ventas por Mes</h3>
            <div class="relative h-64">
              <canvas #salesChart></canvas>
            </div>
          </div>

          <!-- Recent Activity -->
          <div class="recent-activity-card card-coquette p-6 opacity-0 translate-y-10 relative overflow-hidden">
             <!-- Background Decal -->
             <div class="absolute -right-4 -bottom-4 text-8xl opacity-5 rotate-12 pointer-events-none">✨</div>
             
             <div class="flex items-center justify-between mb-4">
               <h3 class="text-base font-bold text-pink-900 flex items-center gap-2">🎀 Actividad Reciente</h3>
               <a routerLink="/admin/orders" class="text-xs font-bold text-pink-500 hover:text-pink-600 transition-colors uppercase tracking-widest">Ver todo</a>
             </div>

             <div class="recent-orders-list space-y-3">
               @for (order of data()?.recentOrders; track order.id) {
                 <div class="recent-order-item p-3 rounded-2xl bg-white/50 border border-pink-50 hover:border-pink-200 transition-all flex items-center justify-between group">
                   <div class="flex items-center gap-3">
                     <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-pink-100/50 group-hover:scale-110 transition-transform">
                       {{ getStatusEmoji(order.status) }}
                     </div>
                     <div>
                       <p class="text-sm font-bold text-pink-900 leading-tight">{{ order.clientName }}</p>
                       <p class="text-[10px] font-medium text-pink-400 uppercase tracking-tighter">
                         {{ order.createdAt | date:'shortTime' }} • {{ order.orderType }}
                       </p>
                     </div>
                   </div>
                   <div class="text-right">
                     <p class="text-sm font-black text-pink-600">{{ order.total | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
                     <span class="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase" [class]="getStatusClass(order.status)">
                       {{ order.status }}
                     </span>
                   </div>
                 </div>
               } @empty {
                 <div class="flex flex-col items-center justify-center py-10 opacity-60">
                    <span class="text-4xl mb-2">🎀</span>
                    <p class="text-xs font-medium text-pink-400">Sin actividad reciente</p>
                 </div>
               }
             </div>
          </div>
        </div>

        <!-- Payment Methods & Quick Actions Row -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <!-- Payment Methods -->
           <div class="payment-methods-card card-coquette p-6 opacity-0 translate-y-10">
            <h3 class="text-base font-bold text-pink-900 mb-4 flex items-center gap-2">💳 Métodos de Pago</h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div class="text-center p-3 rounded-xl bg-green-50 border border-green-100">
                <p class="text-2xl font-bold text-green-700">{{ data()!.totalCashOrders }}</p>
                <p class="text-xs text-green-500 font-medium">💵 Efectivo</p>
                <p class="text-sm font-semibold text-green-600">{{ data()!.totalCashAmount | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
              </div>
              <div class="text-center p-3 rounded-xl bg-blue-50 border border-blue-100">
                <p class="text-2xl font-bold text-blue-700">{{ data()!.totalTransferOrders }}</p>
                <p class="text-xs text-blue-500 font-medium">🏦 Transferencia</p>
                <p class="text-sm font-semibold text-blue-600">{{ data()!.totalTransferAmount | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
              </div>
              <div class="text-center p-3 rounded-xl bg-purple-50 border border-purple-100">
                <p class="text-2xl font-bold text-purple-700">{{ data()!.totalDepositOrders }}</p>
                <p class="text-xs text-purple-500 font-medium">💳 Depósito</p>
                <p class="text-sm font-semibold text-purple-600">{{ data()!.totalDepositAmount | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
              </div>
            </div>
            <div class="flex gap-6 justify-center pt-2 border-t border-pink-100">
              <div class="text-center">
                <p class="text-xl font-bold text-pink-700">{{ data()!.ordersDelivery }}</p>
                <p class="text-xs text-pink-400">🚗 Domicilio</p>
              </div>
              <div class="text-center">
                <p class="text-xl font-bold text-purple-700">{{ data()!.ordersPickUp }}</p>
                <p class="text-xs text-purple-400">🏪 Recoger</p>
              </div>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="grid grid-cols-2 gap-4">
            <a routerLink="/admin/orders"
              class="quick-action card-coquette p-4 text-center hover:shadow-xl transition-all group cursor-pointer opacity-0 scale-90">
              <span class="text-3xl block mb-2 group-hover:scale-110 transition-transform">📦</span>
              <span class="text-sm font-semibold text-pink-900">Pedidos</span>
            </a>
            <a routerLink="/admin/clients"
              class="quick-action card-coquette p-4 text-center hover:shadow-xl transition-all group cursor-pointer opacity-0 scale-90">
              <span class="text-3xl block mb-2 group-hover:scale-110 transition-transform">👩‍💼</span>
              <span class="text-sm font-semibold text-pink-900">Clientas</span>
            </a>
            <a routerLink="/admin/routes"
              class="quick-action card-coquette p-4 text-center hover:shadow-xl transition-all group cursor-pointer opacity-0 scale-90">
              <span class="text-3xl block mb-2 group-hover:scale-110 transition-transform">🚗</span>
              <span class="text-sm font-semibold text-pink-900">Rutas</span>
            </a>
            <a routerLink="/admin/reports"
              class="quick-action card-coquette p-4 text-center hover:shadow-xl transition-all group cursor-pointer opacity-0 scale-90">
              <span class="text-3xl block mb-2 group-hover:scale-110 transition-transform">📊</span>
              <span class="text-sm font-semibold text-pink-900">Reportes</span>
            </a>
          </div>
        </div>

        <!-- CAMI AI Insight Card -->
        <div class="insight-card card-coquette p-6 opacity-0 translate-y-10" style="background: linear-gradient(135deg, rgba(238,242,255,0.95), rgba(253,242,248,0.95)); border: 1px solid rgba(139,92,246,0.15);">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-xl shrink-0">✦</div>
              <div>
                <h3 class="text-sm font-bold text-indigo-900">Insight del día — C.A.M.I.</h3>
                <p class="text-[10px] text-indigo-400 uppercase tracking-widest font-semibold">Análisis con IA</p>
              </div>
            </div>
            <button class="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-1.5"
                    (click)="loadAiInsight()" [disabled]="loadingInsight()">
              @if (loadingInsight()) {
                <span class="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></span>
              } @else {
                <span>✦</span>
              }
              {{ aiInsight() ? 'Actualizar' : 'Generar' }}
            </button>
          </div>
          @if (aiInsight()) {
            <p class="mt-4 text-sm text-indigo-800 leading-relaxed italic">{{ aiInsight() }}</p>
          } @else if (!loadingInsight()) {
            <p class="mt-4 text-xs text-indigo-400 leading-relaxed">Presiona "Generar" para obtener un análisis inteligente del negocio basado en los datos de hoy.</p>
          }
        </div>
      }
    </div>
  `
})
export class DashboardComponent implements OnInit, AfterViewInit {
  private api = inject(ApiService);

  @ViewChild('salesChart') salesChartRef!: ElementRef<HTMLCanvasElement>;

  data = signal<DashboardDto | null>(null);
  loading = signal(true);
  aiInsight = signal<string | null>(null);
  loadingInsight = signal(false);

  private chartInstance: Chart | null = null;

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngAfterViewInit(): void { }

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

  getStatusClass(status: string): string {
    switch (status) {
      case 'Pending': return 'bg-amber-100 text-amber-600';
      case 'Confirmed': return 'bg-pink-100 text-pink-600';
      case 'InRoute': return 'bg-blue-100 text-blue-600';
      case 'Delivered': return 'bg-green-100 text-green-600';
      case 'Canceled': return 'bg-red-100 text-red-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  loadAiInsight(): void {
    const d = this.data();
    if (!d || this.loadingInsight()) return;
    this.loadingInsight.set(true);
    this.api.getDashboardInsight({
      revenueToday: d.revenueToday,
      revenueMonth: d.revenueMonth,
      pendingOrders: d.pendingOrders,
      deliveredOrders: d.deliveredOrders,
      activeRoutes: d.activeRoutes,
      pendingAmount: d.pendingAmount,
      totalClients: d.totalClients
    }).subscribe({
      next: (text) => { this.aiInsight.set(text); this.loadingInsight.set(false); },
      error: () => { this.aiInsight.set(null); this.loadingInsight.set(false); }
    });
  }

  loadDashboard(): void {
    this.loading.set(true);
    this.api.getDashboard().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
        setTimeout(() => {
          this.buildChart(d);
          this.initDashboardAnimations();
        }, 100);
      },
      error: () => this.loading.set(false)
    });
  }

  private initDashboardAnimations(): void {
    const tl = gsap.timeline();

    // 1. Reveal Header
    tl.to('.dashboard-header', {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: 'power3.out'
    });

    // 2. Staggered reveal for KPI cards
    tl.to('.kpi-card', {
      opacity: 1,
      y: 0,
      duration: 0.8,
      stagger: 0.1,
      ease: 'elastic.out(1, 0.8)',
    }, "-=0.4");

    // 3. Count up animation for each metric
    const counters = document.querySelectorAll('.count-val');
    counters.forEach(counter => {
      const val = parseFloat(counter.getAttribute('data-value') || '0');
      const obj = { value: 0 };

      gsap.to(obj, {
        value: val,
        duration: 2,
        ease: 'power3.out',
        onUpdate: () => {
          counter.innerHTML = Math.floor(obj.value).toLocaleString('es-MX');
        },
        scrollTrigger: {
          trigger: counter,
          start: 'top 90%',
        }
      });
    });

    // 4. Reveal banner and charts/activity
    tl.to(['.active-period-banner', '.chart-container', '.recent-activity-card'], {
      opacity: 1,
      y: 0,
      duration: 0.8,
      stagger: 0.15,
      ease: 'power2.out'
    }, "-=0.6");

    // 5. Reveal payments, actions and insight card
    tl.to(['.payment-methods-card', '.quick-action', '.insight-card'], {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.6,
      stagger: 0.1,
      ease: 'back.out(1.7)'
    }, "-=0.4");
  }

  private buildChart(d: DashboardDto): void {
    if (!this.salesChartRef?.nativeElement || !d.salesByMonth?.length) return;

    if (this.chartInstance) this.chartInstance.destroy();

    const ctx = this.salesChartRef.nativeElement.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(236, 72, 153, 0.3)');
    gradient.addColorStop(1, 'rgba(236, 72, 153, 0.01)');

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: d.salesByMonth.map(s => s.month),
        datasets: [{
          label: 'Ventas',
          data: d.salesByMonth.map(s => s.sales),
          borderColor: '#ec4899',
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 5,
          pointBackgroundColor: '#ec4899',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#831843',
            titleFont: { family: 'Outfit' },
            bodyFont: { family: 'Outfit' },
            padding: 12,
            cornerRadius: 12,
            callbacks: {
              label: (c) => `$${Number(c.raw).toLocaleString('es-MX')}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#9d174d', font: { family: 'Outfit', size: 11 } }
          },
          y: {
            grid: { color: 'rgba(249, 168, 212, 0.15)' },
            ticks: {
              color: '#9d174d',
              font: { family: 'Outfit', size: 11 },
              callback: (v) => `$${Number(v).toLocaleString('es-MX')}`
            }
          }
        }
      }
    });
  }
}
