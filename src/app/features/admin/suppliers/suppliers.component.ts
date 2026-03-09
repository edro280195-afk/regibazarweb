import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { SupplierDto, InvestmentDto, SalesPeriodDto, CreateInvestmentRequest } from '../../../core/models';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  template: `
    <div class="relative min-h-screen pb-20">
      
      <!-- ═══ HEADER ═══ -->
      <div class="flex flex-wrap items-center justify-between gap-4 mb-8 animate-slide-down">
        <div>
          <h1 class="text-3xl font-black text-pink-900 tracking-tight">🏭 Proveedores</h1>
          <p class="text-pink-500 font-medium">Gestiona tus compras e inversiones con estilo ✨</p>
        </div>
        <button class="btn-coquette btn-pink shadow-lg shadow-pink-200/50 scale-105" (click)="showForm.set(true); resetForm()">
          <span class="mr-2">✨</span> Nuevo Proveedor
        </button>
      </div>

      <!-- ═══ LOADING ═══ -->
      @if (loading()) {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="card-coquette h-32 shimmer rounded-3xl border-none"></div>
          }
        </div>
      } @else {
        <!-- ═══ SUPPLIERS GRID ═══ -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (s of suppliers(); track s.id; let i = $index) {
            <div class="card-coquette group p-6 hover:scale-[1.02] transition-all duration-300 animate-slide-up border-pink-100/50 overflow-hidden relative" 
                 [style.animation-delay]="(i * 50) + 'ms'" style="opacity:0">
              
              <!-- Glint Effect -->
              <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>

              <div class="relative z-10">
                <div class="flex items-start justify-between mb-4">
                  <div class="w-12 h-12 bg-pink-100 rounded-2xl flex items-center justify-center text-2xl group-hover:rotate-12 transition-transform">
                    {{ s.name.charAt(0).toUpperCase() }}
                  </div>
                  <div class="flex gap-1">
                    <button class="w-8 h-8 rounded-full hover:bg-pink-100 text-pink-400 transition-colors flex items-center justify-center" 
                            (click)="editSupplier(s); $event.stopPropagation()" title="Editar">✏️</button>
                    <button class="w-8 h-8 rounded-full hover:bg-red-50 text-red-300 transition-colors flex items-center justify-center" 
                            (click)="deleteSupplier(s.id); $event.stopPropagation()" title="Eliminar">🗑️</button>
                  </div>
                </div>

                <div class="cursor-pointer" (click)="openDetails(s)">
                  <h3 class="text-xl font-black text-pink-900 leading-tight mb-1">{{ s.name }}</h3>
                  <div class="space-y-1">
                    @if (s.contactName) { <p class="text-sm text-pink-600 font-medium flex items-center gap-2">👤 {{ s.contactName }}</p> }
                    @if (s.phone) { <p class="text-xs text-pink-400 flex items-center gap-2">📱 {{ s.phone }}</p> }
                  </div>

                  <div class="mt-4 pt-4 border-t border-pink-50 flex items-center justify-between">
                    <div>
                      <p class="text-xs text-pink-400 font-bold uppercase tracking-wider">Invertido</p>
                      <p class="text-lg font-black text-pink-600">{{ s.totalInvested | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
                    </div>
                    <div class="text-pink-300 group-hover:translate-x-1 transition-transform">➡️</div>
                  </div>
                </div>
              </div>
            </div>
          } @empty {
            <div class="col-span-full card-coquette p-16 text-center animate-bounce-in border-dashed border-2">
              <span class="text-6xl block mb-4">📦</span>
              <h3 class="text-xl font-bold text-pink-900">No hay proveedores registrados</h3>
              <p class="text-pink-400 mb-6 font-medium">Comienza registrando tu primer proveedor ✨</p>
              <button class="btn-coquette btn-pink mx-auto" (click)="showForm.set(true); resetForm()">✨ Registrar Ahora</button>
            </div>
          }
        </div>
      }

      <!-- ═══ SUPPLIER DRAWER (DETAILS & INVESTMENTS) ═══ -->
      @if (selectedSupplier()) {
        <div class="fixed inset-0 z-50 flex justify-end">
          <div class="absolute inset-0 bg-pink-900/20 backdrop-blur-sm animate-fade-in" (click)="closeDetails()"></div>
          
          <div class="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-slide-right overflow-hidden rounded-l-[40px]">
            
            <!-- Drawer Header -->
            <div class="p-8 pb-6 border-b border-pink-50 relative">
              <button class="absolute top-6 right-8 text-pink-300 hover:text-pink-600 transition-colors text-2xl" (click)="closeDetails()">✕</button>
              
              <div class="flex items-center gap-4 mb-4">
                <div class="w-16 h-16 bg-pink-500 text-white rounded-[24px] flex items-center justify-center text-3xl font-black shadow-lg shadow-pink-200">
                  {{ selectedSupplier()!.name.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <h2 class="text-2xl font-black text-pink-900 -mb-1">{{ selectedSupplier()!.name }}</h2>
                  <span class="text-xs font-black text-pink-400 uppercase tracking-[2px]">Proveedor Oficial 🏭</span>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4 mt-6">
                <div class="bg-pink-50/50 p-4 rounded-3xl border border-pink-100/50">
                  <p class="text-[10px] uppercase font-black text-pink-400 tracking-wider mb-1">Inversión Total</p>
                  <p class="text-2xl font-black text-pink-600">{{ totalInvestedInDrawer() | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
                </div>
                <div class="bg-pink-50/50 p-4 rounded-3xl border border-pink-100/50">
                  <p class="text-[10px] uppercase font-black text-pink-400 tracking-wider mb-1">Contacto</p>
                  <p class="text-sm font-bold text-pink-900 truncate">{{ selectedSupplier()!.contactName || 'Sin asignar' }}</p>
                </div>
              </div>
            </div>

            <!-- Drawer Content -->
            <div class="flex-1 overflow-y-auto p-8 pt-6 space-y-8 custom-scrollbar">
              
              <!-- Add Investment Section -->
              <div class="space-y-4">
                <h3 class="text-lg font-black text-pink-900 flex items-center gap-2">
                  <span class="w-8 h-8 bg-pink-100 rounded-xl flex items-center justify-center text-sm">💰</span>
                  Nueva Inversión
                </h3>
                
                <div class="bg-pink-50/30 p-6 rounded-[32px] border border-pink-100/50 space-y-4">
                  <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1">
                      <label class="text-[10px] font-black text-pink-400 uppercase ml-2">Monto</label>
                      <input type="number" class="input-coquette bg-white" [(ngModel)]="newInv.amount" placeholder="0.00" />
                    </div>
                    <div class="space-y-1">
                      <label class="text-[10px] font-black text-pink-400 uppercase ml-2">Moneda</label>
                      <select class="input-coquette bg-white" [(ngModel)]="newInv.currency">
                        <option value="MXN">🇲🇽 MXN</option>
                        <option value="USD">🇺🇸 USD</option>
                      </select>
                    </div>
                  </div>

                  @if (newInv.currency === 'USD') {
                    <div class="space-y-1 animate-slide-down">
                      <label class="text-[10px] font-black text-pink-400 uppercase ml-2">Tipo de Cambio ({{ exchangeRateLabel }})</label>
                      <input type="number" class="input-coquette bg-white" [(ngModel)]="newInv.exchangeRate" placeholder="Ej. 18.50" />
                    </div>
                  }

                  <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1">
                      <label class="text-[10px] font-black text-pink-400 uppercase ml-2">Fecha</label>
                      <input type="date" class="input-coquette bg-white" [(ngModel)]="newInv.date" />
                    </div>
                    <div class="space-y-1">
                      <label class="text-[10px] font-black text-pink-400 uppercase ml-2">Corte de Venta</label>
                      <select class="input-coquette bg-white" [(ngModel)]="newInv.salesPeriodId">
                        <option [ngValue]="null">Sin corte</option>
                        @for (p of salesPeriods(); track p.id) {
                          <option [ngValue]="p.id">{{ p.isActive ? '🟢 ' : '' }}{{ p.name }}</option>
                        }
                      </select>
                    </div>
                  </div>

                  <div class="space-y-1">
                    <label class="text-[10px] font-black text-pink-400 uppercase ml-2">Notas</label>
                    <input class="input-coquette bg-white" [(ngModel)]="newInv.notes" placeholder="¿Qué compraste? (Opcional)" />
                  </div>

                  <button class="btn-coquette btn-pink w-full justify-center h-12 text-sm font-black shadow-lg shadow-pink-200" 
                          (click)="addInvestment(selectedSupplier()!.id)" [disabled]="submittingInv()">
                    @if (submittingInv()) { <span class="animate-spin mr-2">⏳</span> }
                    💰 Registrar Inversión
                  </button>
                </div>
              </div>

              <!-- History Section -->
              <div class="space-y-4">
                <h3 class="text-lg font-black text-pink-900 flex items-center gap-2">
                  <span class="w-8 h-8 bg-pink-100 rounded-xl flex items-center justify-center text-sm">📊</span>
                  Historial de Compras
                </h3>

                @if (loadingInvestments()) {
                  <div class="space-y-3">
                    @for (i of [1,2,3]; track i) { <div class="shimmer h-20 rounded-3xl"></div> }
                  </div>
                } @else {
                  <div class="space-y-3">
                    @for (inv of investments(); track inv.id; let idx = $index) {
                      <div class="group flex items-center gap-4 p-4 hover:bg-pink-50/50 rounded-[28px] border border-pink-50 transition-all animate-slide-up"
                           [style.animation-delay]="(idx * 30) + 'ms'">
                        <div class="w-12 h-12 bg-white rounded-2xl border border-pink-100 flex flex-col items-center justify-center shadow-sm">
                          <span class="text-[10px] font-black text-pink-300 uppercase">{{ inv.date | date:'MMM' }}</span>
                          <span class="text-lg font-black text-pink-900 leading-none">{{ inv.date | date:'dd' }}</span>
                        </div>
                        <div class="flex-1 min-width-0">
                          <div class="flex items-center gap-2">
                            <p class="font-black text-pink-900">{{ inv.amount | currency:(inv.currency || 'MXN'):'symbol-narrow' }}</p>
                            @if (inv.currency === 'USD') {
                              <span class="text-[10px] font-black bg-pink-100 text-pink-500 px-2 py-0.5 rounded-full">USA</span>
                            }
                          </div>
                          @if (inv.currency !== 'MXN') {
                            <p class="text-[10px] font-bold text-pink-400">≈ {{ inv.totalMXN | currency:'MXN':'symbol-narrow' }} (TC: {{ inv.exchangeRate }})</p>
                          }
                          <p class="text-xs text-pink-400 italic truncate">{{ inv.notes || 'Sin descripción' }}</p>
                        </div>
                        <div class="text-right flex flex-col items-end gap-1">
                          @if (inv.salesPeriodName) {
                            <span class="text-[9px] font-black tracking-wider bg-white border border-pink-100 text-pink-400 px-2 py-1 rounded-lg uppercase">
                              {{ inv.salesPeriodName }}
                            </span>
                          }
                          <button class="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 transition-all text-xs p-2" 
                                  (click)="deleteInvestment(selectedSupplier()!.id, inv.id)">🗑️</button>
                        </div>
                      </div>
                    } @empty {
                      <div class="py-12 text-center">
                        <p class="text-pink-300 font-medium">No se han registrado inversiones aún.</p>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Supplier Form Modal -->
      @if (showForm()) {
        <div class="overlay backdrop-blur-md" (click)="showForm.set(false)"></div>
        <div class="modal-container z-[60]">
          <div class="card-coquette w-full max-w-md p-8 animate-scale-in border-none shadow-2xl overflow-hidden relative">
            
            <!-- Modal Header Decorations -->
            <div class="absolute -top-10 -right-10 w-32 h-32 bg-pink-50 rounded-full blur-3xl opacity-50"></div>
            <div class="absolute -bottom-10 -left-10 w-32 h-32 bg-pink-100 rounded-full blur-3xl opacity-50"></div>

            <div class="relative z-10">
              <h2 class="text-2xl font-black text-pink-900 mb-2 flex items-center gap-3">
                <span class="w-10 h-10 bg-pink-500 text-white rounded-2xl flex items-center justify-center text-xl">
                  {{ editingId() ? '✏️' : '✨' }}
                </span>
                {{ editingId() ? 'Editar' : 'Nuevo' }} Proveedor
              </h2>
              <p class="text-pink-400 text-sm font-medium mb-8 ml-13">Completa los detalles del proveedor 🎀</p>
              
              <div class="space-y-5">
                <div class="space-y-1.5">
                  <label class="label-coquette ml-2">Nombre Comercial</label>
                  <input class="input-coquette h-12 shadow-sm focus:shadow-pink-100" [(ngModel)]="form.name" placeholder="Ej. Shein, Liverpool, etc." />
                </div>
                <div class="space-y-1.5">
                  <label class="label-coquette ml-2">Contacto Personal</label>
                  <input class="input-coquette h-12 shadow-sm focus:shadow-pink-100" [(ngModel)]="form.contactName" placeholder="Nombre de la persona" />
                </div>
                <div class="space-y-1.5">
                  <label class="label-coquette ml-2">Teléfono de Contacto</label>
                  <input class="input-coquette h-12 shadow-sm focus:shadow-pink-100" [(ngModel)]="form.phone" placeholder="Ej. 81 1234 5678" />
                </div>
                <div class="space-y-1.5">
                  <label class="label-coquette ml-2">Notas Extra</label>
                  <textarea class="input-coquette min-h-[100px] py-3 shadow-sm focus:shadow-pink-100" [(ngModel)]="form.notes" placeholder="Cualquier detalle relevante..."></textarea>
                </div>

                <div class="flex gap-4 pt-4">
                  <button class="btn-coquette btn-outline-pink flex-1 h-12 font-black" (click)="showForm.set(false)">Cancelar</button>
                  <button class="btn-coquette btn-pink flex-1 h-12 font-black shadow-lg shadow-pink-200/50" (click)="save()">💖 Guardar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class SuppliersComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  suppliers = signal<SupplierDto[]>([]);
  investments = signal<InvestmentDto[]>([]);
  salesPeriods = signal<SalesPeriodDto[]>([]);

  loading = signal(true);
  loadingInvestments = signal(false);
  showForm = signal(false);
  submittingInv = signal(false);

  editingId = signal<number | null>(null);
  selectedSupplier = signal<SupplierDto | null>(null);

  form = { name: '', contactName: '', phone: '', notes: '' };
  newInv = {
    amount: 0,
    currency: 'MXN',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    exchangeRate: 17.50,
    salesPeriodId: null as number | null
  };

  totalInvestedInDrawer = computed(() => {
    return this.investments().reduce((sum, inv) => sum + (inv.totalMXN || inv.amount), 0);
  });

  get exchangeRateLabel(): string {
    return this.newInv.currency === 'USD' ? 'USD → MXN' : '';
  }

  ngOnInit(): void {
    this.loadSuppliers();
    this.loadSalesPeriods();
  }

  loadSuppliers(): void {
    this.loading.set(true);
    this.api.getSuppliers().subscribe({
      next: (s) => { this.suppliers.set(s); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Error al cargar proveedores'); }
    });
  }

  loadSalesPeriods(): void {
    this.api.getSalesPeriods().subscribe({
      next: (periods) => {
        this.salesPeriods.set(periods);
        // Auto-select active period
        const active = periods.find(p => p.isActive);
        if (active) this.newInv.salesPeriodId = active.id;
      }
    });
  }

  openDetails(s: SupplierDto): void {
    this.selectedSupplier.set(s);
    this.loadInvestments(s.id);

    // Reset investment form for new supplier, but keep active period if possible
    const activePeriod = this.salesPeriods().find(p => p.isActive);
    this.newInv = {
      amount: 0,
      currency: 'MXN',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      exchangeRate: 17.50,
      salesPeriodId: activePeriod?.id || null
    };
  }

  closeDetails(): void {
    this.selectedSupplier.set(null);
    this.investments.set([]);
  }

  loadInvestments(supplierId: number): void {
    this.loadingInvestments.set(true);
    this.api.getInvestments(supplierId).subscribe({
      next: (inv) => { this.investments.set(inv.sort((a, b) => b.id - a.id)); this.loadingInvestments.set(false); },
      error: () => { this.loadingInvestments.set(false); this.toast.error('Error al cargar inversiones'); }
    });
  }

  addInvestment(supplierId: number): void {
    if (!this.newInv.amount || this.newInv.amount <= 0) {
      this.toast.warning('Ingresa un monto válido');
      return;
    }

    this.submittingInv.set(true);
    const req: CreateInvestmentRequest = {
      amount: this.newInv.amount,
      date: this.newInv.date,
      notes: this.newInv.notes || undefined,
      currency: this.newInv.currency,
      exchangeRate: this.newInv.currency === 'USD' ? this.newInv.exchangeRate : undefined,
      salesPeriodId: this.newInv.salesPeriodId || undefined
    };

    this.api.addInvestment(supplierId, req).subscribe({
      next: () => {
        this.toast.success('¡Inversión registrada! 💰');
        this.loadInvestments(supplierId);
        this.loadSuppliers(); // Refresh totals on grid
        this.submittingInv.set(false);

        // Clear amount and notes but keep other settings
        this.newInv.amount = 0;
        this.newInv.notes = '';
      },
      error: (err) => {
        this.submittingInv.set(false);
        this.toast.error(err.error?.message || 'Error al registrar inversión');
      }
    });
  }

  deleteInvestment(supplierId: number, investmentId: number): void {
    if (!confirm('¿Seguro que quieres eliminar esta inversión? Esta acción afectará el total del proveedor.')) return;
    this.api.deleteInvestment(supplierId, investmentId).subscribe({
      next: () => {
        this.toast.success('Inversión eliminada ✨');
        this.loadInvestments(supplierId);
        this.loadSuppliers();
      },
      error: () => this.toast.error('Error al eliminar inversión')
    });
  }

  editSupplier(s: SupplierDto): void {
    this.editingId.set(s.id);
    this.form = { name: s.name, contactName: s.contactName || '', phone: s.phone || '', notes: s.notes || '' };
    this.showForm.set(true);
  }

  resetForm(): void {
    this.editingId.set(null);
    this.form = { name: '', contactName: '', phone: '', notes: '' };
  }

  save(): void {
    if (!this.form.name?.trim()) { this.toast.warning('El nombre es requerido'); return; }
    const obs = this.editingId()
      ? this.api.updateSupplier(this.editingId()!, this.form)
      : this.api.createSupplier(this.form);

    obs.subscribe({
      next: (saved) => {
        this.toast.success(this.editingId() ? 'Proveedor actualizado' : 'Proveedor creado ✨');
        this.showForm.set(false);
        this.loadSuppliers();
        if (this.selectedSupplier()?.id === saved.id) {
          this.selectedSupplier.set(saved);
        }
      },
      error: () => this.toast.error('Error al guardar')
    });
  }

  deleteSupplier(id: number): void {
    if (!confirm('¿Eliminar este proveedor? Se perderán todas sus inversiones asociadas. Esta acción no se puede deshacer.')) return;
    this.api.deleteSupplier(id).subscribe({
      next: () => {
        this.toast.success('Proveedor eliminado 🗑️');
        this.loadSuppliers();
        if (this.selectedSupplier()?.id === id) this.closeDetails();
      },
      error: () => this.toast.error('Error al eliminar')
    });
  }
}
