import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DecimalPipe, DatePipe, CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ReportDto, SalesPeriodDto, PeriodReportDto, AiInsight } from '../../../core/models';
import { NgxEchartsDirective } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import { gsap } from 'gsap';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DecimalPipe, DatePipe, NgxEchartsDirective],
  template: `
    <div class="space-y-6 pb-20">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 animate-slide-down">
        <div>
          <h1 class="text-4xl font-black text-pink-900 tracking-tighter">📊 Reportes</h1>
          <p class="text-sm text-pink-400 mt-1 font-semibold flex items-center gap-2">
            <span class="animate-pulse">✨</span> Análisis de precisión y rendimiento operativo
          </p>
        </div>
        
        <!-- Premium Pill Tabs -->
        <div class="bg-white/40 backdrop-blur-xl p-1.5 rounded-2xl border border-white/60 shadow-sm flex gap-1 self-start">
          @for (tab of tabs; track tab.id) {
            <button (click)="activeTab.set(tab.id)" 
                    [class]="activeTab() === tab.id ? 'tab-pill-active' : 'tab-pill-inactive'">
              <span class="mr-1.5">{{ tab.icon }}</span>
              {{ tab.label }}
            </button>
          }
        </div>
      </div>

      <!-- Filters Panel -->
      <div class="card-coquette p-6 border-pink-100 bg-white/60 backdrop-blur-md sticky top-0 z-30 shadow-sm animate-slide-up overflow-hidden">
        <!-- Floating Sparkles Background -->
        <div class="absolute inset-0 pointer-events-none opacity-20">
          <div class="sparkle-1">✨</div>
          <div class="sparkle-2">🌸</div>
          <div class="sparkle-3">💖</div>
        </div>

        <div class="flex flex-wrap gap-6 items-end relative z-10">
          <div class="flex-1 min-w-[200px]">
            <label class="label-coquette text-pink-800 font-black mb-2 block text-xs tracking-widest uppercase">📅 Rango de Fechas</label>
            <div class="flex items-center gap-2 group">
              <input type="date" class="input-coquette flex-1 shadow-inner focus:ring-pink-300 transition-all border-pink-50 calendar-pink" 
                     [(ngModel)]="startDate" (change)="onDateChange()" />
              <span class="text-pink-200 font-black">/</span>
              <input type="date" class="input-coquette flex-1 shadow-inner focus:ring-pink-300 transition-all border-pink-50 calendar-pink" 
                     [(ngModel)]="endDate" (change)="onDateChange()" />
            </div>
          </div>
          
          <div class="min-w-[240px]">
            <label class="label-coquette text-pink-800 font-black mb-2 block text-xs tracking-widest uppercase">✂️ Por Corte de Venta</label>
            <select class="input-coquette w-full bg-white/50 border-pink-50 cursor-pointer" (change)="onPeriodChange($event)">
              <option value="">Selecciona un corte...</option>
              @for (p of periods(); track p.id) {
                <option [value]="p.id">{{ p.name }} ({{ p.startDate | date:'dd MMM' }})</option>
              }
            </select>
          </div>

          <div class="flex gap-2">
            <button (click)="exportToExcel()" class="btn-coquette bg-gradient-to-r from-green-400 to-emerald-500 text-white h-[42px] px-6 hover:scale-105 active:scale-95 shadow-md flex items-center gap-2 group border-0">
              <span class="group-hover:rotate-12 transition-transform block italic font-black text-xs">📥 EXCEL</span>
            </button>
            
            <div *ngIf="loading()" class="h-[42px] px-4 flex items-center bg-pink-50 rounded-2xl border border-pink-100 animate-pulse">
               <span class="animate-spin text-pink-400 text-xl italic">🦄</span>
            </div>
          </div>
        </div>
      </div>

      @if (loading()) {
        <div class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
             @for (i of [1,2,3,4]; track i) { <div class="shimmer h-32 rounded-3xl"></div> }
          </div>
          <div class="shimmer h-96 rounded-3xl"></div>
        </div>
      } @else if (data()) {
        
        <!-- AI BRAIN BUTTON -->
        <div class="mb-6 flex justify-end animate-slide-in-right relative z-20">
             <button (click)="openGeminiModal()" [disabled]="loadingInsights()" 
                     class="btn-coquette bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl px-6 py-3 shadow-xl shadow-purple-200 hover:-translate-y-1 transition-all flex items-center gap-3 relative overflow-hidden group">
                 <div class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                 <span class="text-2xl group-hover:scale-125 transition-transform duration-300">🧠</span>
                 <span class="font-black italic tracking-widest text-sm relative z-10">CONSULTAR A GEMINI</span>
                 <div class="absolute top-2 right-2 w-2 h-2 bg-pink-300 rounded-full animate-ping"></div>
             </button>
        </div>
        
        <!-- CONTENIDO POR PESTAÑAS -->
        
        @if (activeTab() === 'resumen') {
          <div class="space-y-6 animate-fade-in">
            <!-- Main Metrics -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="card-metric report-metric-card overflow-hidden relative group opacity-0 translate-y-6">
                <div class="bg-pink-500 w-1 h-full absolute left-0 top-0"></div>
                <div class="absolute -right-2 -bottom-2 text-7xl opacity-5 grayscale group-hover:scale-110 transition-transform">💰</div>
                <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-1">Total Facturado</p>
                <div class="flex items-end justify-between">
                  <h3 class="text-3xl font-black text-pink-900 tracking-tighter flex items-center gap-0.5">
                    <span class="text-xl">$</span><span class="count-val" [attr.data-value]="data()?.totalRevenue">0</span>
                  </h3>
                  <div *ngIf="revenueGrowth() !== 0" class="flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full shadow-lg mb-1 animate-bounce-in"
                       [class]="revenueGrowth() > 0 ? 'bg-emerald-500 text-white shadow-emerald-200/50' : 'bg-rose-500 text-white shadow-rose-200/50'">
                    {{ revenueGrowth() > 0 ? '📈' : '📉' }} {{ (revenueGrowth() > 0 ? '+' : '') + (revenueGrowth().toFixed(1)) }}%
                  </div>
                </div>
                <div class="mt-2 text-[10px] font-bold text-pink-300 flex items-center gap-1">
                  Pedidos entregados 
                  <span class="bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded-full">{{ data()!.deliveredOrders }}</span>
                </div>
              </div>
              
              <div class="card-metric report-metric-card overflow-hidden relative group opacity-0 translate-y-6">
                <div class="bg-green-500 w-1 h-full absolute left-0 top-0"></div>
                <div class="absolute -right-2 -bottom-2 text-7xl opacity-5 grayscale group-hover:scale-110 transition-transform">💸</div>
                <p class="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1">Total Cobrado</p>
                <div class="flex items-center justify-between">
                  <h3 class="text-3xl font-black text-green-700 tracking-tighter flex items-center gap-0.5">
                    <span class="text-xl">$</span><span class="count-val" [attr.data-value]="data()?.totalCollected">0</span>
                  </h3>
                  <div class="text-[11px] font-black px-2.5 py-1 rounded-full bg-green-500 text-white shadow-lg shadow-green-200/50 mb-1">
                    {{ (data()!.totalCollected / (data()!.totalRevenue || 1)) * 100 | number:'1.0-0' }}% 🎯
                  </div>
                </div>
                <div class="mt-2 text-[10px] font-bold text-green-400 flex items-center gap-1">
                  @if (data()!.totalRevenue > data()!.totalCollected) {
                    <span class="text-amber-500 flex items-center gap-1 animate-pulse">⚠️ \${{ data()!.totalRevenue - data()!.totalCollected | number:'1.0-0' }} faltante</span>
                  } @else {
                    <span class="bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">✅ 100% Cobrado</span>
                  }
                </div>
              </div>

              <div class="card-metric report-metric-card overflow-hidden relative group opacity-0 translate-y-6">
                <div class="bg-amber-500 w-1 h-full absolute left-0 top-0"></div>
                <div class="absolute -right-2 -bottom-2 text-7xl opacity-5 grayscale group-hover:scale-110 transition-transform">⛽</div>
                <p class="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Gasto & Inversión</p>
                <div class="flex items-center justify-between">
                  <h3 class="text-3xl font-black text-amber-900 tracking-tighter flex items-center gap-0.5">
                    <span class="text-xl">$</span><span class="count-val" [attr.data-value]="data()!.totalInvestment + data()!.totalExpenses">0</span>
                  </h3>
                  <div *ngIf="ordersGrowth() !== 0" class="flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full shadow-lg mb-1"
                       [class]="ordersGrowth() > 0 ? 'bg-blue-500 text-white shadow-blue-200/50' : 'bg-gray-400 text-white'">
                    📦 {{ (ordersGrowth() > 0 ? '+' : '') + (ordersGrowth().toFixed(0)) }}%
                  </div>
                </div>
                <div class="mt-2 text-[10px] font-bold text-amber-500">
                  Operación: <span class="font-black">\${{ data()!.totalExpenses | number:'1.0-0' }}</span>
                </div>
              </div>

              <div class="card-metric report-metric-card overflow-hidden relative group shadow-pink-100/50 opacity-0 translate-y-6" 
                   [class]="data()!.cashBalance >= 0 ? 'border-b-4 border-b-purple-500' : 'border-b-4 border-b-red-500'">
                <div class="absolute -right-2 -bottom-2 text-7xl opacity-5 grayscale group-hover:scale-110 transition-transform">💎</div>
                <p class="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-1">Utilidad Real (Mano)</p>
                <h3 class="text-3xl font-black flex items-center gap-0.5" [class]="data()!.cashBalance >= 0 ? 'text-purple-700' : 'text-red-700'">
                  <span class="text-xl">$</span><span class="count-val" [attr.data-value]="data()?.cashBalance">0</span>
                </h3>
                <div class="mt-2 flex items-center gap-2">
                   <div class="h-1 flex-1 bg-pink-100 rounded-full overflow-hidden">
                     <div class="h-full bg-pink-500" [style.width.%]="(data()!.cashBalance / (data()!.totalRevenue || 1)) * 100"></div>
                   </div>
                   <span class="text-[10px] font-black text-pink-400">{{ (data()!.cashBalance / (data()!.totalRevenue || 1)) * 100 | number:'1.0-0' }}%</span>
                </div>
              </div>
            </div>

            <!-- Charts Row 1 -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div class="card-coquette p-6 bg-white/40">
                <h3 class="text-xs font-black text-pink-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-pink-500 animate-ping"></span>
                  Tendencia de Pedidos Diario
                </h3>
                <div echarts [options]="ordersTendencyOption" class="h-80"></div>
              </div>
              
              <div class="card-coquette p-6 bg-white/40">
                <h3 class="text-xs font-black text-pink-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                  Métodos de Cobro Preferidos
                </h3>
                <div echarts [options]="paymentPieOption" class="h-80"></div>
              </div>
            </div>

            <!-- Glow Up Card -->
            <div class="card-coquette p-10 bg-gradient-to-br from-pink-500 via-rose-500 to-purple-600 text-white relative overflow-hidden group shadow-2xl">
               <div class="absolute -right-20 -top-20 text-[20rem] opacity-10 rotate-12 group-hover:rotate-45 transition-transform duration-1000 select-none">🎀</div>
               <div class="relative z-10 flex flex-col md:flex-row gap-10 items-center">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                       <span class="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Meta del Mes</span>
                       <span class="text-xs font-bold text-pink-200 animate-pulse">✨ Alcanzando el brillo</span>
                    </div>
                    <h3 class="text-5xl font-black italic tracking-tighter leading-none mb-6">GLOW UP<br>MOMENT</h3>
                    
                    <!-- Meta Thermometer -->
                    <div class="max-w-xs mb-8">
                       <div class="flex justify-between items-end mb-2">
                          <span class="text-[10px] font-black uppercase">Progreso Real</span>
                          <span class="text-xl font-black">{{ salesProgress() | number:'1.0-0' }}%</span>
                       </div>
                       <div class="h-3 bg-white/20 rounded-full overflow-hidden p-0.5 border border-white/30">
                          <div class="h-full bg-white rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(255,255,255,0.8)]" 
                               [style.width.%]="salesProgress() > 100 ? 100 : salesProgress()"></div>
                       </div>
                       <p class="text-[10px] mt-2 opacity-80 italic font-medium">Meta: MX$100,000.00</p>
                    </div>
                    
                    <div class="flex flex-wrap gap-4">
                      <div class="metric-pill">
                        <span class="text-[10px] opacity-70 uppercase tracking-widest font-black block">Best Seller</span>
                        <span class="font-black text-xl leading-none text-pink-900">{{ data()!.topProducts[0]?.name || 'N/A' }}</span>
                      </div>
                      <div class="metric-pill">
                        <span class="text-[10px] opacity-70 uppercase tracking-widest font-black block">Efectividad</span>
                        <span class="font-black text-2xl leading-none text-pink-900">{{ data()!.successRate }}%</span>
                      </div>
                    </div>
                 </div>

                 <div class="grid grid-cols-2 gap-4 w-full md:w-auto">
                    <div class="bg-white/10 backdrop-blur-xl p-6 rounded-3xl border border-white/20 text-center">
                       <p class="text-4xl font-black">{{ data()!.newClients }}</p>
                       <p class="text-[10px] font-black uppercase tracking-tighter opacity-80 mt-1">Clientas Nuevas</p>
                    </div>
                    <div class="bg-white/10 backdrop-blur-xl p-6 rounded-3xl border border-white/20 text-center">
                       <p class="text-4xl font-black">{{ data()!.completedRoutes }}</p>
                       <p class="text-[10px] font-black uppercase tracking-tighter opacity-80 mt-1">Rutas Listas</p>
                    </div>
                    <div class="bg-white/10 backdrop-blur-xl p-6 rounded-3xl border border-white/20 text-center col-span-2">
                       <p class="text-2xl font-black">{{ data()!.avgTicket | currency:'MXN' }}</p>
                       <p class="text-[10px] font-black uppercase tracking-tighter opacity-80 mt-1">Venta Promedio por Clienta</p>
                    </div>
                 </div>
               </div>
            </div>
          </div>
        }

        @if (activeTab() === 'financiero') {
          <div class="space-y-6 animate-fade-in">
            <!-- Fugas Alert -->
            @if (data()!.unassignedPaymentOrders > 0) {
              <div class="p-8 rounded-3xl bg-red-600 text-white flex flex-col md:flex-row items-center gap-8 relative overflow-hidden shadow-xl shadow-red-200">
                <div class="absolute -right-10 -bottom-10 text-9xl opacity-10 rotate-12">📉</div>
                <div class="text-6xl animate-bounce">🚨</div>
                <div class="flex-1 text-center md:text-left">
                  <h4 class="text-3xl font-black uppercase italic tracking-tighter mb-2">¡ALERTA DE FUGAS DETECTADA!</h4>
                  <p class="text-red-100 font-bold">
                    Hay <b>{{ data()!.unassignedPaymentOrders }}</b> pedidos que se entregaron pero no tienen registrado ningún pago.
                    Estamos perdiendo <b>{{ data()!.unassignedPaymentAmount | currency:'MXN' }}</b> que ya deberían estar en tu bolsa. 💸
                  </p>
                </div>
                <button class="btn-coquette bg-white text-red-600 px-8 py-3 font-black uppercase text-xs tracking-widest shadow-2xl hover:scale-110 active:scale-95 transition-all">
                  Rastrear y Cobrar
                </button>
              </div>
            }

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div class="card-coquette p-8 bg-white/40">
                 <h3 class="text-xs font-black text-pink-900 mb-6 uppercase tracking-widest">💰 Detalle de Ingresos</h3>
                 <div class="space-y-4 stagger-children">
                    @for (item of [
                      { icons: '💵', label: 'Efectivo', amount: data()!.cashAmount, col: 'green', orders: data()!.cashOrders },
                      { icons: '📱', label: 'Transferencia', amount: data()!.transferAmount, col: 'blue', orders: data()!.transferOrders },
                      { icons: '🏦', label: 'Depósito', amount: data()!.depositAmount, col: 'purple', orders: data()!.depositOrders }
                    ]; track item.label) {
                      <div class="flex justify-between items-center p-5 rounded-2xl transition-all hover:translate-x-2 border border-transparent hover:border-pink-100"
                           [class]="'bg-' + item.col + '-50/50'">
                        <div class="flex items-center gap-4">
                           <span class="text-3xl filter drop-shadow-sm">{{ item.icons }}</span>
                           <div>
                             <span class="font-black text-pink-900 block leading-none">{{ item.label }}</span>
                             <span class="text-[10px] font-bold text-pink-400 italic">Total de {{ item.orders }} pagos</span>
                           </div>
                        </div>
                        <span class="text-xl font-black" [class]="'text-' + item.col + '-700'">{{ item.amount | currency:'MXN' }}</span>
                      </div>
                    }
                 </div>
               </div>

               <div class="card-coquette p-8 bg-white/40">
                  <h3 class="text-xs font-black text-pink-900 mb-6 uppercase tracking-widest">🏭 Inversión en Proveedores</h3>
                  <div class="max-h-[400px] overflow-y-auto custom-scrollbar pr-4 space-y-3">
                    @for (s of data()!.supplierSummaries; track s.name) {
                      <div class="flex justify-between items-center p-4 bg-pink-50/30 rounded-2xl border border-pink-50 hover:bg-pink-100/50 transition-colors group">
                        <div class="flex items-center gap-3">
                           <div class="w-2 h-2 rounded-full bg-pink-300 group-hover:bg-pink-500 transition-colors"></div>
                           <span class="text-sm font-black text-pink-900">{{ s.name }}</span>
                        </div>
                        <div class="text-right">
                           <span class="font-black text-pink-700 block text-lg">{{ s.totalInvested | currency:'MXN' }}</span>
                           <span class="text-[10px] uppercase font-bold text-pink-300 italic">{{ s.investmentCount }} Cargas</span>
                        </div>
                      </div>
                    }
                  </div>
               </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div class="card-coquette p-8 bg-white/40">
                <h3 class="text-xs font-black text-pink-900 mb-6 uppercase tracking-widest flex items-center justify-between">
                   Relación: Ventas Facturadas vs Ingreso Real Cobrado
                   <span class="text-[10px] font-bold text-pink-400 italic">Análisis de flujo financiero</span>
                </h3>
                <div echarts [options]="billedVsCollectedOption" class="h-96"></div>
              </div>

              <div class="card-coquette p-8 bg-white/40">
                <h3 class="text-xs font-black text-pink-900 mb-6 uppercase tracking-widest flex items-center justify-between">
                   Inversión por Proveedor
                   <span class="text-[10px] font-bold text-pink-400 italic font-medium">Distribución de capital</span>
                </h3>
                <div echarts [options]="supplierChartOption" class="h-96"></div>
              </div>
            </div>
          </div>
        }

        @if (activeTab() === 'operativo') {
          <div class="space-y-6 animate-fade-in">
            <!-- Operativo Headers -->
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 stagger-children">
              <div class="card-metric p-5 text-center group">
                 <p class="text-[10px] text-pink-400 font-black uppercase tracking-tighter mb-1">Volumen</p>
                 <p class="text-2xl font-black text-pink-900">{{ data()!.totalOrders }} <span class="text-xs opacity-50 italic">pkgs</span></p>
              </div>
              <div class="card-metric p-5 text-center group">
                 <p class="text-[10px] text-green-400 font-black uppercase tracking-tighter mb-1">Delivered</p>
                 <p class="text-2xl font-black text-green-700">{{ data()!.deliveredOrders }}</p>
              </div>
              <div class="card-metric p-5 text-center group">
                 <p class="text-[10px] text-amber-500 font-black uppercase tracking-tighter mb-1">PickUp</p>
                 <p class="text-2xl font-black text-amber-700">{{ data()!.pickUpOrders }}</p>
              </div>
              <div class="card-metric p-5 text-center group border-b-blue-500">
                 <p class="text-[10px] text-blue-400 font-black uppercase tracking-tighter mb-1">Logística</p>
                 <p class="text-2xl font-black text-blue-900">{{ data()!.totalRoutes }} <span class="text-xs opacity-50 italic">Rts</span></p>
              </div>
              <div class="card-metric p-5 text-center group border-b-purple-500">
                 <p class="text-[10px] text-purple-400 font-black uppercase tracking-tighter mb-1">Ticket Prom.</p>
                 <p class="text-2xl font-black text-purple-900">{{ data()!.avgTicket | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
              </div>
              <div class="card-metric p-5 text-center bg-red-50/50 border-b-red-500">
                 <p class="text-[10px] text-red-400 font-black uppercase tracking-tighter mb-1">No Logrados</p>
                 <p class="text-2xl font-black text-red-900">{{ data()!.canceledOrders + data()!.notDeliveredOrders }}</p>
              </div>
            </div>

            <!-- PERFORMANCE SECTION (NEW) -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <!-- Speed Metric Cards -->
               <div class="lg:col-span-1 space-y-4">
                  <div class="card-coquette p-8 bg-gradient-to-br from-indigo-50 to-blue-50 border-blue-100 flex items-center justify-between">
                     <div>
                       <p class="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">🚚 Speed de Entrega</p>
                       <h4 class="text-4xl font-black text-blue-800 tracking-tighter">{{ data()!.avgDeliveryTimeMinutes | number:'1.0-0' }} <span class="text-base">min</span></h4>
                       <p class="text-[10px] font-bold text-blue-400 mt-2 italic">Desde inicio de ruta por parada</p>
                     </div>
                     <div class="text-5xl opacity-40 animate-pulse">⚡</div>
                  </div>
                  
                  <div class="card-coquette p-8 bg-gradient-to-br from-teal-50 to-green-50 border-green-100 flex items-center justify-between">
                     <div>
                       <p class="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1">🏁 Duración de Ruta</p>
                       <h4 class="text-4xl font-black text-green-800 tracking-tighter">{{ data()!.avgRouteTimeMinutes | number:'1.0-0' }} <span class="text-base">min</span></h4>
                       <p class="text-[10px] font-bold text-green-500 mt-2 italic">Promedio de rutas completadas</p>
                     </div>
                     <div class="text-5xl opacity-40">🛣️</div>
                  </div>
                  
                  <div class="card-coquette p-6 bg-white/50 border-pink-100 text-center">
                     <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-4">Eficiencia Logística 🌸</p>
                     <div class="flex justify-center mb-4">
                        <div class="relative w-24 h-24 flex items-center justify-center">
                           <svg class="w-full h-full transform -rotate-90">
                              <circle cx="48" cy="48" r="40" stroke="currentColor" stroke-width="8" fill="transparent" class="text-pink-100"/>
                              <circle cx="48" cy="48" r="40" stroke="currentColor" stroke-width="8" fill="transparent" 
                                      class="text-pink-50" [attr.stroke-dasharray]="251" [attr.stroke-dashoffset]="251 - (251 * data()!.successRate / 100)"/>
                           </svg>
                           <span class="absolute text-xl font-black text-pink-900">{{ data()!.successRate }}%</span>
                        </div>
                     </div>
                     <p class="text-xs font-bold text-pink-800">Tasa de Entregas Exitosas</p>
                  </div>
               </div>

               <!-- Trends Graph -->
                <div class="lg:col-span-2 card-coquette p-8 bg-white/40">
                   <h3 class="text-xs font-black text-pink-900 mb-6 uppercase tracking-widest">Actividad Operativa vs Monto de Venta</h3>
                   <div echarts [options]="operationalLineOption" class="h-80"></div>
                   
                   <div class="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-pink-100 pt-10">
                      <div>
                        <h4 class="text-[10px] font-black text-pink-900 mb-4 uppercase tracking-widest">Preferencia de Entrega</h4>
                        <div echarts [options]="deliveryTypePieOption" class="h-60"></div>
                      </div>
                      <div class="flex flex-col justify-center gap-4">
                         <div class="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                            <p class="text-[10px] font-black text-blue-400 uppercase">Delivery</p>
                            <p class="text-2xl font-black text-blue-800">{{ data()!.deliveryOrders }} <span class="text-xs opacity-50 italic">pedidos</span></p>
                         </div>
                         <div class="bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                            <p class="text-[10px] font-black text-amber-500 uppercase">PickUp</p>
                            <p class="text-2xl font-black text-amber-800">{{ data()!.pickUpOrders }} <span class="text-xs opacity-50 italic">pedidos</span></p>
                         </div>
                      </div>
                   </div>
                </div>
            </div>
          </div>
        }

        @if (activeTab() === 'clientes') {
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
             <div class="card-coquette p-8 bg-white/40">
               <h3 class="text-xs font-black text-pink-900 mb-8 uppercase tracking-widest flex items-center gap-2">
                 <span class="w-2 h-2 rounded-full bg-rose-500"></span>
                 Demanda de Productos (Unidades)
               </h3>
               <div echarts [options]="topProductsOption" class="h-[500px]"></div>
             </div>

             <div class="card-coquette p-8 bg-white/20 overflow-hidden relative">
               <div class="absolute -right-4 top-10 text-[10rem] opacity-5 font-black uppercase rotate-90 select-none">LOYALTY</div>
               <h3 class="text-xs font-black text-pink-900 mb-8 uppercase tracking-widest">Clientas VIP del Periodo 🎀</h3>
               <div class="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar stagger-children">
                  @for (c of data()!.topClients; track c.name; let i = $index) {
                    <div class="p-5 rounded-3xl bg-white/60 border border-white flex items-center justify-between hover:scale-[1.02] hover:bg-pink-50 transition-all group shadow-sm">
                       <div class="flex items-center gap-5">
                         <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white text-2xl font-black shadow-pink-200 shadow-lg group-hover:rotate-6 transition-transform">
                           {{ c.name.charAt(0) }}
                         </div>
                         <div>
                            <p class="font-black text-pink-900 text-lg leading-tight">{{ c.name }}</p>
                            <div class="flex items-center gap-2 mt-1">
                               <span class="text-[10px] font-black uppercase text-pink-400 bg-pink-100 px-2 py-0.5 rounded-full">{{ c.orders }} Pedidos</span>
                               @if(i < 3) { <span class="text-xs animate-bounce">👑</span> }
                            </div>
                         </div>
                       </div>
                       <div class="text-right">
                          <p class="font-black text-pink-700 text-xl tracking-tighter">{{ c.totalSpent | currency:'MXN' }}</p>
                          <p class="text-[10px] uppercase tracking-widest text-pink-400 font-black italic">VIP Rank #{{ i + 1 }}</p>
                       </div>
                    </div>
                  }
               </div>
             </div>
          </div>
        }

      } @else {
        <div class="card-coquette py-40 px-12 text-center animate-bounce-in bg-white/40 border-dashed border-2 border-pink-200">
          <div class="text-9xl mb-10 filter drop-shadow-2xl">📉</div>
          <h2 class="text-3xl font-black text-pink-900 uppercase tracking-tighter italic">Revela el éxito de tu bazar</h2>
          <p class="text-pink-400 font-bold max-w-sm mx-auto mt-4 text-lg">
            Genera un reporte para ver toda la magia operativa y financiera en tiempo real ✨
          </p>
          <div class="mt-10 flex justify-center gap-2">
             <div class="w-2 h-2 rounded-full bg-pink-200 animate-ping"></div>
             <div class="w-2 h-2 rounded-full bg-pink-300 animate-ping delay-75"></div>
             <div class="w-2 h-2 rounded-full bg-pink-400 animate-ping delay-150"></div>
          </div>
        </div>
      }
      
      <!-- ═══════════════════════════════════════════════════
           LOADING OVERLAY INMERSIVO (Gemini Pensando)
           ═══════════════════════════════════════════════════ -->
      @if (loadingInsights()) {
        <div class="fixed inset-0 z-[4000] bg-slate-900/90 backdrop-blur-2xl flex flex-col items-center justify-center animate-fade-in">
           <!-- Glowing AI Core -->
           <div class="relative w-32 h-32 mb-12 flex items-center justify-center">
               <!-- Pulse rings -->
               <div class="absolute inset-0 bg-gradient-to-tr from-fuchsia-600 to-indigo-600 rounded-full blur-[30px] animate-[pulse_3s_ease-in-out_infinite] opacity-60"></div>
               <!-- Inner ripple -->
               <div class="absolute w-24 h-24 bg-white/10 border border-white/30 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
               <!-- Sharp Core -->
               <div class="absolute w-12 h-12 bg-gradient-to-br from-white to-pink-100 rounded-full shadow-[0_0_20px_white] z-10 overflow-hidden">
                   <div class="w-full h-full bg-gradient-to-tr from-purple-500/30 to-pink-500/30 animate-[spin_2s_linear_infinite]"></div>
               </div>
               <!-- Orbiting particle 1 -->
               <div class="absolute w-28 h-28 animate-[spin_4s_linear_infinite]">
                   <div class="w-2 h-2 bg-pink-300 rounded-full shadow-[0_0_10px_#f9a8d4] absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
               </div>
               <!-- Orbiting particle 2 -->
               <div class="absolute w-32 h-32 animate-[spin_5s_linear_infinite_reverse]">
                   <div class="w-1.5 h-1.5 bg-indigo-300 rounded-full shadow-[0_0_10px_#a5b4fc] absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2"></div>
               </div>
           </div>
           
           <h3 class="text-sm font-semibold text-white/80 tracking-[0.4em] uppercase mb-8 font-sans">
              Analizando Datos
           </h3>
           
           <!-- Textos rotativos smooth -->
           <div class="h-6 relative w-full max-w-md text-center flex justify-center mt-2">
              <span class="absolute w-full text-pink-200/90 font-light tracking-wide text-sm animate-cycle-text" style="animation-delay: 0s;">Evaluando rendimiento financiero profundo...</span>
              <span class="absolute w-full text-purple-200/90 font-light tracking-wide text-sm animate-cycle-text" style="animation-delay: 2.5s;">Identificando patrones en compras de clientas...</span>
              <span class="absolute w-full text-indigo-200/90 font-light tracking-wide text-sm animate-cycle-text" style="animation-delay: 5s;">Estructurando consejos estratégicos de negocio...</span>
           </div>
        </div>
      }

      <!-- ═══════════════════════════════════════════════════
           MODAL: RESULTADOS CEREBRO GEMINI
           ═══════════════════════════════════════════════════ -->
      @if (showGeminiModal()) {
        <div class="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-8" 
             [class.animate-fade-in]="!closingGeminiModal()"
             [class.animate-fade-out]="closingGeminiModal()"
             (click)="closeGeminiModal()">
             
          <div class="bg-gradient-to-br from-[#f8f5fc] to-[#fce4ec] w-full max-w-6xl rounded-3xl sm:rounded-[3rem] max-h-[95vh] flex flex-col overflow-hidden shadow-[0_0_80px_rgb(236,72,153,0.3)] border border-pink-200" 
               [class.animate-scale-in]="!closingGeminiModal()"
               [class.animate-scale-out]="closingGeminiModal()"
               (click)="$event.stopPropagation()">
            
            <!-- Modal Header -->
            <div class="px-8 py-6 border-b border-pink-100/50 flex justify-between items-center bg-white/40 sticky top-0 z-20 backdrop-blur-xl">
              <div class="flex items-center gap-4">
                 <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl shadow-lg shadow-pink-200/50">
                   ✨
                 </div>
                 <div>
                   <h2 class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-900 to-pink-700 tracking-tight">Resultados Estratégicos</h2>
                   <p class="text-sm font-bold text-pink-400">Powered by Gemini 1.5 Pro</p>
                 </div>
              </div>
              <button class="w-10 h-10 rounded-full bg-white/80 hover:bg-pink-100 text-pink-500 flex items-center justify-center text-xl shadow-sm transition-colors" (click)="closeGeminiModal()">✕</button>
            </div>

            <div class="flex-1 overflow-y-auto p-4 sm:p-8 relative">
              <div class="absolute -right-20 -top-20 text-[20rem] opacity-[0.03] rotate-12 pointer-events-none">✨</div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                @for (insight of insights(); track insight.title; let i = $index) {
                   <div class="animate-slide-up-fade bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] hover:shadow-[0_20px_40px_-10px_rgba(236,72,153,0.2)] hover:-translate-y-2 transition-all duration-500 group border-b-4"
                        [class.border-b-rose-500]="insight.category === 'Riesgo'"
                        [class.border-b-emerald-500]="insight.category === 'Finanzas'"
                        [class.border-b-blue-500]="insight.category === 'Operación'"
                        [class.border-b-pink-500]="insight.category === 'Clientas'"
                        [class.border-b-amber-500]="insight.category === 'Ventas'"
                        [style.animation-delay]="(i * 150) + 'ms'">
                        
                       <div class="flex items-start gap-4 mb-5">
                          <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
                               [class.bg-rose-50]="insight.category === 'Riesgo'"
                               [class.bg-emerald-50]="insight.category === 'Finanzas'"
                               [class.bg-blue-50]="insight.category === 'Operación'"
                               [class.bg-pink-50]="insight.category === 'Clientas'"
                               [class.bg-amber-50]="insight.category === 'Ventas'">
                            {{ insight.icon }}
                          </div>
                          <div class="pt-1">
                             <span class="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full inline-block mb-2"
                                   [class.bg-rose-100]="insight.category === 'Riesgo'" [class.text-rose-700]="insight.category === 'Riesgo'"
                                   [class.bg-emerald-100]="insight.category === 'Finanzas'" [class.text-emerald-700]="insight.category === 'Finanzas'"
                                   [class.bg-blue-100]="insight.category === 'Operación'" [class.text-blue-700]="insight.category === 'Operación'"
                                   [class.bg-pink-100]="insight.category === 'Clientas'" [class.text-pink-700]="insight.category === 'Clientas'"
                                   [class.bg-amber-100]="insight.category === 'Ventas'" [class.text-amber-700]="insight.category === 'Ventas'">
                               {{ insight.category }}
                             </span>
                             <h4 class="font-black text-gray-900 leading-tight text-lg">{{ insight.title }}</h4>
                          </div>
                       </div>
                       <p class="text-gray-600 text-sm mb-6 leading-relaxed font-medium">{{ insight.description }}</p>
                       
                       <div class="bg-gradient-to-br from-gray-50 to-gray-100/50 p-5 rounded-2xl border border-gray-100 relative overflow-hidden group-hover:border-pink-200 transition-colors">
                          <div class="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-400 to-pink-500"></div>
                          <strong class="text-purple-900 text-[10px] uppercase font-black flex items-center gap-1.5 mb-2">
                             <span class="text-sm">💡</span> Consejo de Gemini
                          </strong>
                          <p class="text-gray-800 text-sm font-bold leading-snug">{{ insight.actionableAdvice }}</p>
                       </div>
                   </div>
                }
              </div>
            </div>
            
            <div class="px-8 py-5 border-t border-pink-100 bg-white/40 backdrop-blur-md flex justify-end">
              <button class="px-8 py-3 rounded-2xl bg-white border-2 border-pink-200 text-pink-600 font-bold hover:bg-pink-50 focus:ring-4 focus:ring-pink-100 transition-all" (click)="closeGeminiModal()">
                 Entendido 👍
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    @keyframes cycleText {
      0% { opacity: 0; transform: translateY(15px); filter: blur(4px); }
      5% { opacity: 1; transform: translateY(0); filter: blur(0); }
      28% { opacity: 1; transform: translateY(0); filter: blur(0); }
      33% { opacity: 0; transform: translateY(-15px); filter: blur(4px); }
      100% { opacity: 0; transform: translateY(-15px); filter: blur(4px); }
    }
    .animate-cycle-text {
      animation: cycleText 7.5s infinite;
      opacity: 0;
    }
  `
})
export class ReportsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  data = signal<ReportDto | null>(null);
  periods = signal<SalesPeriodDto[]>([]);
  loading = signal(false);
  
  // AI Insights State
  insights = signal<AiInsight[] | null>(null);
  loadingInsights = signal(false);
  showGeminiModal = signal(false);
  closingGeminiModal = signal(false);

  activeTab = signal<'resumen' | 'financiero' | 'operativo' | 'clientes'>('resumen');

  tabs = [
    { id: 'resumen', label: 'Resumen', icon: '💎' },
    { id: 'financiero', label: 'Finanzas', icon: '💰' },
    { id: 'operativo', label: 'Operativo', icon: '🚚' },
    { id: 'clientes', label: 'Clientes', icon: '👑' }
  ] as const;

  startDate = '';
  endDate = '';

  // Metas y Growth
  revenueGoal = 100000;
  salesProgress = computed(() => {
    const d = this.data();
    if (!d) return 0;
    return (d.totalRevenue / this.revenueGoal) * 100;
  });

  revenueGrowth = computed(() => {
    const d = this.data() as any;
    if (!d) return 0;
    const prev = d.prevPeriodRevenue ?? d.PrevPeriodRevenue ?? 0;
    if (prev === 0) return 0;
    return ((d.totalRevenue - prev) / prev) * 100;
  });

  ordersGrowth = computed(() => {
    const d = this.data() as any;
    if (!d) return 0;
    const prev = d.prevPeriodOrders ?? d.PrevPeriodOrders ?? 0;
    if (prev === 0) return 0;
    return ((d.totalOrders - prev) / prev) * 100;
  });

  // ECharts Options
  ordersTendencyOption: EChartsOption = {};
  paymentPieOption: EChartsOption = {};
  billedVsCollectedOption: EChartsOption = {};
  operationalLineOption: EChartsOption = {};
  topProductsOption: EChartsOption = {};
  supplierChartOption: EChartsOption = {};
  deliveryTypePieOption: EChartsOption = {};

  ngOnInit(): void {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    this.startDate = firstDay.toISOString().split('T')[0];
    this.endDate = now.toISOString().split('T')[0];

    this.loadPeriods();
    this.loadReport();
  }

  loadPeriods(): void {
    this.api.getSalesPeriods().subscribe({
      next: (p) => this.periods.set(p),
      error: () => this.toast.error('Error al cargar cortes')
    });
  }

  onPeriodChange(event: any): void {
    const id = event.target.value;
    if (!id) return;

    const period = this.periods().find(p => p.id === parseInt(id));
    if (period) {
      this.startDate = period.startDate.toString().split('T')[0];
      this.endDate = period.endDate.toString().split('T')[0];
      this.loadReport();
    }
  }

  onDateChange(): void {
    this.loadReport();
  }

  loadReport(): void {
    if (!this.startDate || !this.endDate) return;
    this.loading.set(true);
    this.api.getReports(this.startDate, this.endDate).subscribe({
      next: (r) => {
        this.data.set(r);
        this.buildCharts(r);
        this.loading.set(false);
        this.insights.set(null); // Clear insights when new report loads
        setTimeout(() => this.initAnimations(), 50);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error al generar reporte');
      }
    });
  }

  buildCharts(r: ReportDto): void {
    // 1. Line Chart: Pedidos vs Tiempo
    this.ordersTendencyOption = {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: r.ordersByDay.map(d => d.date), axisLabel: { color: '#9d174d' } },
      yAxis: { type: 'value', axisLabel: { color: '#9d174d' } },
      series: [{
        data: r.ordersByDay.map(d => d.count),
        type: 'line',
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#fbcfe8' }, { offset: 1, color: '#ffffff00' }]
          }
        },
        itemStyle: { color: '#ec4899' },
        lineStyle: { width: 4 }
      }]
    };

    // 2. Pie Chart: Métodos de Pago
    this.paymentPieOption = {
      tooltip: { trigger: 'item', formatter: '{b}: <b>$ {c}</b> ({d}%)' },
      legend: { bottom: '0', icon: 'circle', textStyle: { color: '#831843' } },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: [
          { value: r.cashAmount, name: 'Efectivo', itemStyle: { color: '#34d399' } },
          { value: r.transferAmount, name: 'Transferencia', itemStyle: { color: '#60a5fa' } },
          { value: r.depositAmount, name: 'Depósito', itemStyle: { color: '#a78bfa' } }
        ]
      }]
    };

    // 3. Bar Chart: Billed vs Collected
    this.billedVsCollectedOption = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['Facturado', 'Cobrado'], textStyle: { color: '#831843' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value', axisLabel: { color: '#9d174d' } },
      yAxis: { type: 'category', data: ['Finanzas del Periodo'], axisLabel: { show: false } },
      series: [
        { name: 'Facturado', type: 'bar', data: [r.totalRevenue], itemStyle: { color: '#f472b6', borderRadius: [0, 20, 20, 0] } },
        { name: 'Cobrado', type: 'bar', data: [r.totalCollected], itemStyle: { color: '#10b981', borderRadius: [0, 20, 20, 0] } }
      ]
    };

    // 4. Line Chart: Operativo (Rutas y Pedidos)
    this.operationalLineOption = {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Monto Pedidos ($)', 'Cantidad'], textStyle: { color: '#831843' } },
      xAxis: { type: 'category', data: r.ordersByDay.map(d => d.date) },
      yAxis: [
        { type: 'value', name: 'Monto ($)' },
        { type: 'value', name: 'Cantidad' }
      ],
      series: [
        { name: 'Monto Pedidos ($)', type: 'bar', data: r.ordersByDay.map(d => d.amount), itemStyle: { color: '#fda4af' } },
        { name: 'Cantidad', type: 'line', yAxisIndex: 1, data: r.ordersByDay.map(d => d.count), itemStyle: { color: '#7c3aed' } }
      ]
    };

    // 5. Horiz Bar: Top Products
    this.topProductsOption = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: r.topProducts.map(p => p.name).reverse() },
      series: [{
        type: 'bar',
        data: r.topProducts.map(p => p.quantity).reverse(),
        encode: { x: 'amount', y: 'product' },
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [{ offset: 0, color: '#fb7185' }, { offset: 1, color: '#f43f5e' }]
          },
          borderRadius: 10
        }
      }]
    };

    // 6. Pie Chart: Delivery vs PickUp
    this.deliveryTypePieOption = {
      tooltip: { trigger: 'item', formatter: '{b}: <b>{c}</b> ({d}%)' },
      series: [{
        type: 'pie',
        radius: ['50%', '80%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 15, borderColor: '#fff', borderWidth: 4 },
        label: { show: false },
        data: [
          { value: r.deliveryOrders, name: 'Delivery', itemStyle: { color: '#3b82f6' } },
          { value: r.pickUpOrders, name: 'PickUp', itemStyle: { color: '#f59e0b' } }
        ]
      }]
    };

    // 7. Bar Chart: Supplier Investment
    this.supplierChartOption = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: r.supplierSummaries.map(s => s.name), axisLabel: { rotate: 30, color: '#9d174d' } },
      yAxis: { type: 'value', axisLabel: { color: '#9d174d' } },
      series: [{
        type: 'bar',
        data: r.supplierSummaries.map(s => s.totalInvested),
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#f472b6' }, { offset: 1, color: '#ec4899' }]
          },
          borderRadius: [15, 15, 0, 0]
        }
      }]
    };
  }

  exportToExcel(): void {
    this.toast.info('Generando Excel con todos los esteroides... 📁');
    window.open(`${this.api.getApiUrl()}/orders/export?start=${this.startDate}&end=${this.endDate}`, '_blank');
  }

  openGeminiModal(): void {
    if (!this.data()) return;
    // Solo consultar si no hay insights previos o forzar recarga si quisieras
    if (!this.insights()) {
       this.askGemini();
    } else {
       this.showGeminiModal.set(true);
    }
  }

  closeGeminiModal(): void {
    if (this.closingGeminiModal()) return;
    this.closingGeminiModal.set(true);
    setTimeout(() => {
      this.showGeminiModal.set(false);
      this.closingGeminiModal.set(false);
    }, 400); // 400ms matches fade-out duration
  }

  askGemini(): void {
    const reportData = this.data();
    if (!reportData) return;
    
    this.loadingInsights.set(true);
    this.api.getReportInsights(reportData).subscribe({
      next: (insights) => {
        this.insights.set(insights);
        this.loadingInsights.set(false);
        this.showGeminiModal.set(true);
        this.toast.success('🧠 Gemini ha terminado su análisis estratégico');
      },
      error: () => {
        this.toast.error('Error al consultar a Gemini 😿');
        this.loadingInsights.set(false);
      }
    });
  }

  private initAnimations(): void {
    const tl = gsap.timeline();
    tl.to('.report-metric-card', {
      opacity: 1,
      y: 0,
      duration: 0.8,
      stagger: 0.1,
      ease: 'elastic.out(1, 0.8)'
    });

    const counters = document.querySelectorAll('.count-val');
    counters.forEach(counter => {
      const val = parseFloat(counter.getAttribute('data-value') || '0');
      const obj = { value: 0 };
      gsap.to(obj, {
        value: val,
        duration: 2,
        ease: 'power4.out',
        onUpdate: () => {
          counter.innerHTML = Math.floor(obj.value).toLocaleString('es-MX');
        }
      });
    });
  }
}
