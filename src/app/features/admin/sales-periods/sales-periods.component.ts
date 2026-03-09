import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { SalesPeriodDto, PeriodReportDto } from '../../../core/models';

@Component({
  selector: 'app-sales-periods',
  imports: [FormsModule, CurrencyPipe, DatePipe],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4 animate-slide-down">
        <h1 class="text-2xl font-bold text-pink-900">📋 Cortes de Venta</h1>
        <button class="btn-coquette btn-pink" (click)="showForm.set(true)">✨ Nuevo Corte</button>
      </div>

      @if (loading()) {
        <div class="space-y-3">
          @for (i of [1,2,3]; track i) { <div class="shimmer h-24 rounded-2xl"></div> }
        </div>
      } @else {
        <div class="space-y-4">
          @for (period of periods(); track period.id; let i = $index) {
            <div class="card-coquette p-5 animate-slide-up" [style.animation-delay]="(i * 60) + 'ms'" style="opacity:0">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="text-lg font-bold text-pink-900">{{ period.name }}</h3>
                    @if (period.isActive) {
                      <span class="badge bg-green-100 text-green-700 animate-pulse-pink">🟢 Activo</span>
                    }
                  </div>
                  <p class="text-sm text-pink-400">
                    {{ period.startDate | date:'dd MMM yyyy' }} — {{ period.endDate | date:'dd MMM yyyy' }}
                  </p>
                </div>
                <button class="btn-coquette btn-outline-pink text-xs" (click)="viewReport(period.id)">📊 Ver Reporte</button>
              </div>

              <!-- Period Report -->
              @if (expandedPeriod() === period.id && periodReport()) {
                <div class="mt-4 pt-4 border-t border-pink-100 animate-slide-up">
                  <div class="grid grid-cols-3 gap-4 mb-4">
                    <div class="text-center p-3 bg-green-50 rounded-xl">
                      <p class="text-xl font-bold text-green-700">{{ periodReport()!.totalSales | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
                      <p class="text-xs text-green-500">💵 Ventas</p>
                    </div>
                    <div class="text-center p-3 bg-red-50 rounded-xl">
                      <p class="text-xl font-bold text-red-700">{{ periodReport()!.totalInvestments | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
                      <p class="text-xs text-red-500">💸 Inversión</p>
                    </div>
                    <div class="text-center p-3 rounded-xl" [class]="periodReport()!.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'">
                      <p class="text-xl font-bold" [class]="periodReport()!.netProfit >= 0 ? 'text-green-700' : 'text-red-700'">
                        {{ periodReport()!.netProfit | currency:'MXN':'symbol-narrow':'1.0-0' }}
                      </p>
                      <p class="text-xs" [class]="periodReport()!.netProfit >= 0 ? 'text-green-500' : 'text-red-500'">📈 Utilidad</p>
                    </div>
                  </div>

                  @if (periodReport()!.investmentsBySupplier.length) {
                    <h4 class="label-coquette mt-4">🏭 Por Proveedor</h4>
                    <div class="space-y-2">
                      @for (s of periodReport()!.investmentsBySupplier; track s.supplierName) {
                        <div class="flex items-center justify-between py-2 px-3 bg-pink-50/50 rounded-lg text-sm">
                          <span class="font-medium text-pink-900">{{ s.supplierName }}</span>
                          <span class="font-semibold text-red-700">{{ s.totalInvested | currency:'MXN':'symbol-narrow':'1.0-0' }}</span>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>

        @if (periods().length === 0) {
          <div class="card-coquette p-12 text-center animate-bounce-in">
            <p class="text-4xl mb-3">📋</p>
            <p class="text-pink-400 font-medium">No hay cortes de venta</p>
            <p class="text-pink-300 text-sm">Crea tu primer corte para organizar tus ventas</p>
          </div>
        }
      }

      <!-- Create Form Modal -->
      @if (showForm()) {
        <div class="overlay" (click)="showForm.set(false)"></div>
        <div class="modal-container">
          <div class="card-coquette w-full max-w-md p-6 animate-scale-in">
            <h2 class="text-lg font-bold text-pink-900 mb-6">✨ Nuevo Corte de Venta</h2>
            <div class="space-y-4">
              <div>
                <label class="label-coquette">📋 Nombre</label>
                <input class="input-coquette" [(ngModel)]="form.name" placeholder="ej. Marzo 2026 - Q1" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="label-coquette">📅 Inicio</label>
                  <input type="date" class="input-coquette" [(ngModel)]="form.startDate" />
                </div>
                <div>
                  <label class="label-coquette">📅 Fin</label>
                  <input type="date" class="input-coquette" [(ngModel)]="form.endDate" />
                </div>
              </div>
              <div class="flex gap-3">
                <button class="btn-coquette btn-outline-pink flex-1" (click)="showForm.set(false)">Cancelar</button>
                <button class="btn-coquette btn-pink flex-1" (click)="create()" [disabled]="creating()">
                  {{ creating() ? '⏳...' : '💖 Crear Corte' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class SalesPeriodsComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  periods = signal<SalesPeriodDto[]>([]);
  periodReport = signal<PeriodReportDto | null>(null);
  expandedPeriod = signal<number | null>(null);
  loading = signal(true);
  showForm = signal(false);
  creating = signal(false);

  form = { name: '', startDate: '', endDate: '' };

  ngOnInit(): void { this.loadPeriods(); }

  loadPeriods(): void {
    this.loading.set(true);
    this.api.getSalesPeriods().subscribe({
      next: (p) => { this.periods.set(p); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Error al cargar cortes'); }
    });
  }

  viewReport(id: number): void {
    if (this.expandedPeriod() === id) {
      this.expandedPeriod.set(null);
      return;
    }
    this.expandedPeriod.set(id);
    this.periodReport.set(null);
    this.api.getPeriodReport(id).subscribe({
      next: (r) => this.periodReport.set(r),
      error: () => this.toast.error('Error al cargar reporte del corte')
    });
  }

  create(): void {
    if (!this.form.name || !this.form.startDate || !this.form.endDate) {
      this.toast.warning('Completa todos los campos');
      return;
    }
    this.creating.set(true);
    this.api.createSalesPeriod(this.form).subscribe({
      next: () => {
        this.toast.success('Corte creado ✨');
        this.showForm.set(false);
        this.form = { name: '', startDate: '', endDate: '' };
        this.loadPeriods();
        this.creating.set(false);
      },
      error: () => { this.toast.error('Error al crear corte'); this.creating.set(false); }
    });
  }
}
