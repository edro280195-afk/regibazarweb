import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe, CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { FinancialReportDto, SalesPeriodDto, PeriodReportDto, DriverExpenseDto } from '../../../core/models';
import { NgxEchartsDirective } from 'ngx-echarts';
import { EChartsOption } from 'echarts';

@Component({
  selector: 'app-financials',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, NgxEchartsDirective],
  template: `
    <div class="space-y-6 pb-20">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 animate-slide-down">
        <div>
          <h1 class="text-4xl font-black text-pink-900 tracking-tighter flex items-end gap-2">
             💰 Finanzas <span class="font-accent text-pink-400 text-5xl lowercase">sin fugas</span>
          </h1>
          <p class="text-[10px] font-black text-pink-300 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
            <span class="animate-pulse">🎀</span> Balance consolidado y auditoría de flujo
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
      <div class="card-coquette p-6 border-pink-100 bg-white/60 backdrop-blur-md sticky top-0 z-30 shadow-sm animate-slide-up">
        <div class="flex flex-wrap gap-6 items-end">
          <div class="flex-1 min-w-[200px]">
            <label class="label-coquette text-pink-800 font-bold mb-2 block text-xs tracking-widest uppercase">📅 Rango Personalizado</label>
            <div class="flex items-center gap-2 group">
              <input type="date" class="input-coquette flex-1 shadow-inner focus:ring-pink-300 transition-all border-pink-50" [(ngModel)]="startDate" (change)="onDateChange()" />
              <span class="text-pink-200 font-black">/</span>
              <input type="date" class="input-coquette flex-1 shadow-inner focus:ring-pink-300 transition-all border-pink-50" [(ngModel)]="endDate" (change)="onDateChange()" />
            </div>
          </div>
          
          <div class="min-w-[240px]">
            <label class="label-coquette text-pink-800 font-bold mb-2 block text-xs tracking-widest uppercase">✂️ Por Corte de Venta</label>
            <select class="input-coquette w-full bg-white/50 border-pink-50" (change)="onPeriodChange($any($event.target).value)">
              <option value="">Selecciona un corte...</option>
              @for (p of periods(); track p.id) {
                <option [value]="p.id">{{ p.name }} ({{ p.startDate | date:'dd MMM' }})</option>
              }
            </select>
          </div>

          <div class="flex gap-2">
            <button class="btn-coquette btn-pink h-[42px] px-8 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg active:shadow-inner" 
                    [disabled]="loading()"
                    (click)="loadReport()">
              @if(loading()){ <span class="animate-spin text-xl">🦄</span> }
              @else { <span>🔍</span> }
              <span class="font-black text-xs uppercase tracking-tighter">Consultar</span>
            </button>

            <button (click)="exportToExcel()" class="btn-coquette bg-green-500 text-white h-[42px] px-4 hover:bg-green-600 shadow-md group">
              <span class="group-hover:scale-110 transition-transform block italic font-black">📥 XL</span>
            </button>
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
      } @else if (report()) {
        
        <!-- DASHBOARD TAB -->
        @if (activeTab() === 'dashboard') {
          <div class="space-y-6 animate-fade-in">
            <!-- Reconciliation Summary (The "Sin Fugas" Logic) -->
            <div class="card-coquette p-6 bg-pink-50/30 border-pink-200 border-2 border-dashed relative overflow-hidden group">
               <div class="absolute -right-4 -top-4 text-9xl opacity-5 grayscale group-hover:rotate-12 transition-transform">⚖️</div>
               <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative">
                 <div>
                    <h4 class="text-sm font-black text-pink-900 uppercase tracking-tighter mb-1">🏦 Conciliación de Caja</h4>
                    <p class="text-xs text-pink-400 font-bold italic">Cotejo de ventas facturadas vs dinero real ingresado</p>
                 </div>
                 <div class="flex gap-8">
                    <div class="text-center">
                      <p class="text-[10px] font-black text-pink-400 uppercase">Facturado (Meta)</p>
                      <p class="text-xl font-black text-pink-900">{{ report()!.totalBilled | currency:'MXN' }}</p>
                    </div>
                    <div class="text-center">
                      <p class="text-[10px] font-black text-green-400 uppercase">Cobrado (Real)</p>
                      <p class="text-xl font-black text-green-900">{{ report()!.totalCollected | currency:'MXN' }}</p>
                    </div>
                    <div class="text-center">
                      <p class="text-[10px] font-black uppercase" [class]="report()!.totalPending > 0 ? 'text-red-400 animate-pulse' : 'text-pink-300'">Pendiente/Fuga</p>
                      <p class="text-xl font-black" [class]="report()!.totalPending > 0 ? 'text-red-600' : 'text-pink-900'">{{ report()!.totalPending | currency:'MXN' }}</p>
                    </div>
                 </div>
               </div>
               @if (report()!.totalPending > 0) {
                 <div class="mt-4 p-2 bg-red-100/50 rounded-xl border border-red-200 flex items-center gap-2 animate-bounce-in">
                    <span class="text-lg">⚠️</span>
                    <p class="text-[10px] font-black text-red-700 uppercase tracking-tighter">Atención: Hay una diferencia de {{ report()!.totalPending | currency:'MXN' }} entre lo vendido y lo cobrado.</p>
                 </div>
               }
            </div>

            <!-- Main Metrics -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
              <div class="card-metric overflow-hidden relative group border-b-green-500">
                <div class="bg-green-500 w-1 h-full absolute left-0 top-0"></div>
                <div class="absolute -right-2 -bottom-2 text-7xl opacity-5 grayscale group-hover:scale-110 transition-transform">�</div>
                <p class="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">Dinero en Mano</p>
                <h3 class="text-3xl font-black text-green-900 tracking-tighter">{{ report()!.cashBalance | currency:'MXN' }}</h3>
                <div class="mt-2 text-[10px] font-bold text-green-600 flex items-center gap-1">
                  Cobrado - Gastos - Inv
                </div>
              </div>

              <div class="card-metric overflow-hidden relative group border-b-blue-500">
                <div class="bg-blue-500 w-1 h-full absolute left-0 top-0"></div>
                <div class="absolute -right-2 -bottom-2 text-7xl opacity-5 grayscale group-hover:scale-110 transition-transform">📦</div>
                <p class="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Inversión (Compras)</p>
                <h3 class="text-3xl font-black text-blue-900 tracking-tighter">{{ report()!.totalInvestment | currency:'MXN' }}</h3>
                <div class="mt-2 text-[10px] font-bold text-blue-600 flex items-center gap-1">
                  Mercancía adquirida
                </div>
              </div>

              <div class="card-metric overflow-hidden relative group border-b-amber-500">
                <div class="bg-amber-500 w-1 h-full absolute left-0 top-0"></div>
                <div class="absolute -right-2 -bottom-2 text-7xl opacity-5 grayscale group-hover:scale-110 transition-transform">⛽</div>
                <p class="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Gastos Op.</p>
                <h3 class="text-3xl font-black text-amber-900 tracking-tighter">{{ report()!.totalExpenses | currency:'MXN' }}</h3>
                <div class="mt-2 text-[10px] font-bold text-amber-600 flex items-center gap-1">
                  Gasolina y mantenimiento
                </div>
              </div>

              <div class="card-metric overflow-hidden relative group border-b-pink-500">
                <div class="bg-pink-500 w-1 h-full absolute left-0 top-0"></div>
                <div class="absolute -right-2 -bottom-2 text-7xl opacity-5 grayscale group-hover:scale-110 transition-transform">�</div>
                <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-1">Utilidad Neta Teórica</p>
                <h3 class="text-3xl font-black text-pink-900 tracking-tighter">{{ report()!.netProfit | currency:'MXN' }}</h3>
                <div class="mt-2 text-[10px] font-bold text-pink-600 flex items-center gap-1">
                  Billed - Inv - Exp
                </div>
              </div>
            </div>

            <!-- Charts Row -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div class="card-coquette p-6 bg-white/40">
                <div class="flex items-center justify-between mb-6">
                  <h4 class="text-sm font-black text-pink-900 uppercase tracking-tighter">📊 Flujo Real vs Facturado</h4>
                  <span class="metric-pill text-[10px] font-black text-pink-500 uppercase">Conciliación Acumulada</span>
                </div>
                <div echarts [options]="cashFlowOption" class="h-80"></div>
              </div>

              <div class="card-coquette p-6 bg-white/40">
                <div class="flex items-center justify-between mb-6">
                  <h4 class="text-sm font-black text-pink-900 uppercase tracking-tighter">🍩 Distribución de Gastos</h4>
                  <span class="metric-pill text-[10px] font-black text-amber-500 uppercase">Operativos</span>
                </div>
                <div echarts [options]="expenseDonutOption" class="h-80"></div>
              </div>
            </div>
          </div>
        }

        <!-- AUDIT TAB -->
        @if (activeTab() === 'audit') {
          <div class="space-y-6 animate-fade-in">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Incomes Table -->
              <div class="card-coquette p-6 bg-white/40 h-fit">
                <h4 class="text-sm font-black text-green-900 uppercase tracking-tighter mb-4 flex items-center gap-2">
                  <span>💵</span> Detalle de Ingresos ({{ report()!.details.incomes.length }})
                </h4>
                <div class="max-h-[500px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  @for (inc of report()!.details.incomes; track inc.id) {
                    <div class="flex items-center justify-between p-3 bg-white/60 rounded-xl hover:scale-[1.02] transition-all border border-green-50/50">
                      <div>
                        <p class="font-black text-green-900 text-sm tracking-tighter leading-none">{{ inc.clientName }}</p>
                        <p class="text-[10px] text-green-500 mt-1 font-bold">{{ inc.createdAt | date:'dd MMM yyyy' }} · {{ inc.orderType }}</p>
                      </div>
                      <span class="text-sm font-black text-green-600 tracking-tighter">{{ inc.total | currency:'MXN' }}</span>
                    </div>
                  } @empty {
                    <div class="text-center py-10 opacity-40 italic text-sm">Sin registros</div>
                  }
                </div>
              </div>

              <!-- Investments Table -->
              <div class="card-coquette p-6 bg-white/40 h-fit">
                <h4 class="text-sm font-black text-blue-900 uppercase tracking-tighter mb-4 flex items-center gap-2">
                  <span>📦</span> Inversiones ({{ report()!.details.investments.length }})
                </h4>
                <div class="max-h-[500px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  @for (inv of report()!.details.investments; track inv.id) {
                    <div class="flex items-center justify-between p-3 bg-white/60 rounded-xl hover:scale-[1.02] transition-all border border-blue-50/50">
                      <div>
                        <p class="font-black text-blue-900 text-sm tracking-tighter leading-none">{{ inv.supplierName }}</p>
                        <p class="text-[10px] text-blue-500 mt-1 font-bold">{{ inv.date | date:'dd MMM yyyy' }}</p>
                        @if (inv.notes) { <p class="text-[10px] text-blue-300 italic">{{ inv.notes }}</p> }
                      </div>
                      <span class="text-sm font-black text-blue-600 tracking-tighter">{{ inv.amount | currency:'MXN' }}</span>
                    </div>
                  } @empty {
                    <div class="text-center py-10 opacity-40 italic text-sm">Sin registros</div>
                  }
                </div>
              </div>
            </div>

            <!-- Expenses Full Width -->
            <div class="card-coquette p-6 bg-white/40">
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-sm font-black text-amber-900 uppercase tracking-tighter flex items-center gap-2">
                  <span>⛽</span> Gastos Operativos ({{ report()!.details.expenses.length }})
                </h4>
                <button (click)="openExpenseModal()" class="btn-coquette btn-pink text-[10px] px-4 py-1.5 h-auto">
                  + Registrar Gasto
                </button>
              </div>
              <div class="overflow-x-auto">
                <table class="table-coquette">
                  <thead>
                    <tr>
                      <th class="text-[10px]">Tipo</th>
                      <th class="text-[10px]">Fecha</th>
                      <th class="text-[10px]">Ruta</th>
                      <th class="text-[10px]">Notas</th>
                      <th class="text-[10px] text-right">Monto</th>
                      <th class="text-[10px] text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (exp of report()!.details.expenses; track exp.id) {
                      <tr class="group hover:bg-amber-50/30 transition-colors">
                        <td class="font-black text-amber-900 text-xs tracking-tighter">{{ exp.expenseType }}</td>
                        <td class="text-xs text-pink-400 font-bold">{{ exp.date | date:'dd/MM/yyyy' }}</td>
                        <td class="text-xs font-bold text-amber-700">{{ exp.routeName || '-' }}</td>
                        <td class="text-xs text-amber-400 italic max-w-xs truncate">{{ exp.notes || '-' }}</td>
                        <td class="text-right font-black text-amber-900 text-xs">{{ exp.amount | currency:'MXN' }}</td>
                        <td class="text-center">
                          <button (click)="deleteExpense(exp.id)" class="text-red-400 hover:text-red-600 p-2 transform hover:scale-125 transition-all outline-none">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    } @empty {
                      <tr><td colspan="6" class="text-center py-20 opacity-40 italic text-sm">No hay gastos en este periodo</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        }
      } @else {
        <div class="card-coquette py-40 px-12 text-center animate-bounce-in bg-white/40 border-dashed border-2 border-pink-200">
          <p class="text-7xl mb-6">💰</p>
          <h3 class="text-2xl font-black text-pink-900 tracking-tighter">Sin datos cargados</h3>
          <p class="text-pink-400 font-bold max-w-sm mx-auto mt-2">Usa los filtros de arriba para generar tu auditoría financiera al millón.</p>
        </div>
      }
    </div>

    <!-- EXPENSE MODAL -->
    @if (showExpenseModal()) {
      <div class="fixed inset-0 bg-pink-950/20 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="card-coquette w-full max-w-md p-8 animate-scale-in border-none shadow-2xl overflow-hidden relative">
          <div class="bg-gradient-to-br from-amber-400/20 to-transparent absolute inset-0 pointer-events-none"></div>
          
          <div class="relative">
            <div class="flex justify-between items-start mb-6">
              <div>
                <h3 class="text-2xl font-black text-amber-900 tracking-tighter">Registrar Gasto ⛽</h3>
                <p class="text-xs font-bold text-amber-600 uppercase tracking-widest mt-1">Control Operativo</p>
              </div>
              <button (click)="showExpenseModal.set(false)" class="text-amber-300 hover:text-amber-600 transition-colors text-2xl font-black">×</button>
            </div>

            <div class="space-y-4">
              <div>
                <label class="label-coquette text-[10px]">📍 Ruta Asociada</label>
                <select class="input-coquette" [(ngModel)]="expenseForm.driverRouteId">
                  <option [ngValue]="null">General (Sin ruta)</option>
                  @for (r of routes(); track r.id) {
                    <option [ngValue]="r.id">{{ r.name }}</option>
                  }
                </select>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="label-coquette text-[10px]">🏷️ Tipo</label>
                  <select class="input-coquette" [(ngModel)]="expenseForm.expenseType">
                    @for (t of expenseTypes; track t) {
                      <option [value]="t">{{ t }}</option>
                    }
                  </select>
                </div>
                <div>
                  <label class="label-coquette text-[10px]">💸 Monto</label>
                  <input type="number" class="input-coquette font-black text-amber-900" [(ngModel)]="expenseForm.amount" placeholder="0.00" />
                </div>
              </div>

              <div>
                <label class="label-coquette text-[10px]">📅 Fecha</label>
                <input type="date" class="input-coquette" [(ngModel)]="expenseForm.date" />
              </div>

              <div>
                <label class="label-coquette text-[10px]">📝 Notas</label>
                <textarea class="input-coquette min-h-[80px]" [(ngModel)]="expenseForm.notes" placeholder="Detalles extra..."></textarea>
              </div>
            </div>

            <div class="flex gap-3 mt-8">
              <button (click)="showExpenseModal.set(false)" class="btn-coquette flex-1 bg-white border-none italic font-black text-amber-800 hover:bg-amber-50">Cancelar</button>
              <button (click)="saveExpense()" class="btn-coquette flex-1 bg-amber-500 text-white font-black shadow-amber-200">Guardar ✨</button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class FinancialsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  report = signal<FinancialReportDto | null>(null);
  periods = signal<SalesPeriodDto[]>([]);
  loading = signal(false);
  activeTab = signal<'dashboard' | 'audit'>('dashboard');

  tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'audit', label: 'Auditoría', icon: '📑' }
  ] as const;

  startDate = '';
  endDate = '';

  // ECharts Options
  cashFlowOption: EChartsOption = {};
  expenseDonutOption: EChartsOption = {};

  // Expense Form
  showExpenseModal = signal(false);
  expenseForm = {
    driverRouteId: null as number | null,
    amount: 0,
    expenseType: 'Gasolina',
    date: '',
    notes: ''
  };
  expenseTypes = ['Gasolina', 'Comida', 'Mantenimiento', 'Insumos', 'Otros'];
  routes = signal<{ id: number, name: string }[]>([]);

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

  onPeriodChange(periodId: any): void {
    const id = periodId;
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
    this.api.getFinancials(this.startDate, this.endDate).subscribe({
      next: (r) => {
        this.report.set(r);
        this.buildCharts(r);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error al cargar reporte');
      }
    });
  }

  buildCharts(r: FinancialReportDto): void {
    // 1. Reconciliation Chart (Billed vs Collected vs Expenses/Investments)
    this.cashFlowOption = {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { color: '#831843' } },
      xAxis: { type: 'category', data: ['Billed vs Collected'], show: false },
      yAxis: { type: 'value', axisLabel: { color: '#db2777' } },
      series: [
        { name: 'Vendido (Meta)', type: 'bar', data: [r.totalBilled], itemStyle: { color: '#ec4899', borderRadius: [10, 10, 0, 0] } },
        { name: 'Cobrado (Real)', type: 'bar', data: [r.totalCollected], itemStyle: { color: '#10b981', borderRadius: [10, 10, 0, 0] } },
        { name: 'Inversión', type: 'bar', data: [r.totalInvestment], itemStyle: { color: '#3b82f6', borderRadius: [10, 10, 0, 0] } },
        { name: 'Gastos', type: 'bar', data: [r.totalExpenses], itemStyle: { color: '#f59e0b', borderRadius: [10, 10, 0, 0] } }
      ]
    };

    // 2. Expense Donut Option
    const expData = Array.from(
      r.details.expenses.reduce((acc, exp) => {
        const existing = acc.get(exp.expenseType) || 0;
        acc.set(exp.expenseType, existing + exp.amount);
        return acc;
      }, new Map<string, number>())
    ).map(([name, value]) => ({ name, value }));

    this.expenseDonutOption = {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, icon: 'circle', textStyle: { color: '#831843' } },
      series: [{
        type: 'pie',
        radius: ['50%', '80%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: expData.length > 0 ? expData : [{ name: 'Sin Gastos', value: 0 }]
      }]
    };
  }

  openExpenseModal(): void {
    this.expenseForm = {
      driverRouteId: null,
      amount: 0,
      expenseType: 'Gasolina',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    };

    this.api.getRoutes().subscribe(res => {
      this.routes.set(res.map(r => ({ id: r.id, name: `Ruta ${r.id}` })));
    });

    this.showExpenseModal.set(true);
  }

  saveExpense(): void {
    if (this.expenseForm.amount <= 0) {
      this.toast.error('Ingresa un monto válido');
      return;
    }

    const request = {
      amount: this.expenseForm.amount,
      expenseType: this.expenseForm.expenseType,
      notes: this.expenseForm.notes,
      date: new Date(this.expenseForm.date).toISOString(),
      driverRouteId: this.expenseForm.driverRouteId || undefined
    };

    this.api.createExpense(request).subscribe({
      next: () => {
        this.toast.success('Gasto registrado ✨');
        this.showExpenseModal.set(false);
        this.loadReport();
      },
      error: () => this.toast.error('Error al registrar gasto')
    });
  }

  deleteExpense(id: number): void {
    if (confirm('¿Eliminar este gasto?')) {
      this.api.deleteExpense(id).subscribe({
        next: () => {
          this.toast.success('Gasto eliminado');
          this.loadReport();
        },
        error: () => this.toast.error('Error al eliminar')
      });
    }
  }

  exportToExcel(): void {
    this.toast.info('Generando auditoría financiera... 📁');
    window.open(`${this.api.getApiUrl()}/orders/export/financial?start=${this.startDate}&end=${this.endDate}`, '_blank');
  }
}
