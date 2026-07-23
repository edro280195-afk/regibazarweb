import { Component, computed, inject, signal, OnInit, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TandaService } from '../../../core/services/tanda.service';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { CreateTandaDto, TandaDto, ClientDto, TandaProductDto } from '../../../core/models';
import { RouterLink } from '@angular/router';
import { gsap } from 'gsap';
import {
  areTandaPlacesComplete,
  assignClientToPlace,
  resizeTandaPlaces,
  swapTandaPlaces,
  TandaPlaceDraft
} from './tanda-places.util';

interface TandaForm {
  name: string;
  totalWeeks: number;
  weeklyAmount: number;
  startDate: string;
}

@Component({
  selector: 'app-tandas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="relative min-h-[80vh] overflow-hidden -m-4 lg:-m-8 p-4 lg:p-8">
      <!-- Parallax Background Elements (Identidad Regi Bazar) -->
      <div class="absolute inset-0 pointer-events-none z-[-1] overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-br from-pink-50/50 via-purple-50/50 to-rose-50/50"></div>
        
        <div class="absolute inset-0 opacity-40 transition-transform duration-75 ease-out"
             [style.transform]="'translateY(' + scrollY() * 0.1 + 'px)'">
          <div class="absolute top-[10%] left-[5%] text-6xl animate-pulse-slow blur-[1px]">🌸</div>
          <div class="absolute top-[60%] right-[10%] text-5xl opacity-50">✨</div>
        </div>
        
        <div class="absolute inset-0 opacity-60 transition-transform duration-75 ease-out"
             [style.transform]="'translateY(' + scrollY() * 0.25 + 'px)'">
          <div class="absolute top-[20%] right-[20%] text-4xl animate-float-delayed">💖</div>
          <div class="absolute top-[75%] left-[15%] text-5xl animate-bounce-slow blur-[1px]">🎀</div>
        </div>
      </div>

      <div class="space-y-6 relative z-10 max-w-7xl mx-auto">
        <!-- Header Section -->
        <div class="flex flex-wrap items-center justify-between gap-4 animate-slide-down">
          <div>
            <h1 class="text-3xl font-black text-pink-900 font-display flex items-center gap-3">
              <span class="animate-wiggle inline-block drop-shadow-md">🤝</span> 
              Módulo de Tandas
            </h1>
            <p class="text-sm text-pink-500 font-medium ml-1 mt-1">Creciendo juntas, paso a paso 💕</p>
          </div>
          <button (click)="openCreateModal()" class="btn-coquette btn-pink shadow-lg">
            <span>✨</span> Nueva Tanda
          </button>
        </div>

        <!-- Filters & Search (Integrated) -->
        <div class="card-coquette p-5 animate-slide-up delay-100" style="opacity:0; animation-fill-mode: forwards;">
          <div class="flex flex-wrap gap-4 items-end">
            <div class="flex-1 min-w-[300px] relative">
              <label class="label-coquette">🔍 Buscar Tanda o Producto</label>
              <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400">🔍</span>
                <input class="input-coquette pl-10" 
                       placeholder="Nombre de tanda o producto..." 
                       [(ngModel)]="searchQuery" />
              </div>
            </div>

            <div class="w-48">
              <label class="label-coquette">📋 Estado</label>
              <select class="input-coquette py-2">
                <option value="">Todas</option>
                <option value="Active">🟢 Activas</option>
                <option value="Draft">📝 Borradores</option>
                <option value="Completed">💖 Completadas</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Tandas Grid -->
        @if (loadingTandas()) {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            @for (i of [1,2,3]; track i) {
              <div class="shimmer h-64 rounded-3xl"></div>
            }
          </div>
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 pb-8">
            @for (tanda of filteredTandas(); track tanda.id) {
              <div [routerLink]="['/admin/tandas', tanda.id]" 
                   class="tanda-card-anim group relative rounded-[1.75rem] p-[1px] bg-gradient-to-br from-pink-200/60 via-white to-rose-200/60 hover:from-pink-300/80 hover:to-rose-300/80 transition-all duration-500 opacity-0 translate-y-8 cursor-pointer">
                
                <div class="relative bg-white/90 backdrop-blur-xl rounded-[1.7rem] p-6 flex flex-col h-full shadow-[0_8px_32px_rgba(244,114,182,0.08)] group-hover:shadow-[0_20px_50px_rgba(244,114,182,0.18)] transition-shadow duration-500 overflow-hidden">
                  
                  <!-- Card Header -->
                  <div class="flex justify-between items-start mb-4">
                    <div class="flex flex-col gap-1.5">
                      <span class="text-[10px] font-black text-pink-400 tracking-[0.2em] uppercase">Tanda #{{ tanda.id.slice(0,4) }}</span>
                    </div>
                    <span class="badge shadow-sm" [class]="tanda.status === 'Active' ? 'badge-confirmed' : 'badge-pending'">
                      {{ tanda.status === 'Active' ? '🟢 Activa' : '⏳ Borrador' }}
                    </span>
                  </div>

                  <!-- Tanda Name -->
                  <div class="flex-1 mb-5">
                    <h3 class="text-xl font-black text-pink-900 leading-tight mb-2 group-hover:text-pink-600 transition-colors">
                      {{ tanda.name }}
                    </h3>
                    <div class="flex items-center gap-2">
                      <span class="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-lg">🎁</span>
                      <span class="text-xs text-pink-500 font-medium">{{ tanda.product?.name || 'Producto por definir' }}</span>
                    </div>
                  </div>

                  <!-- Financial Stats -->
                  <div class="bg-gradient-to-br from-pink-50/70 via-rose-50/40 to-purple-50/30 rounded-2xl p-4 mb-5 border border-pink-100/40 group-hover:border-pink-200/60 transition-colors shadow-inner">
                    <div class="flex justify-between items-end">
                      <div>
                        <p class="text-[10px] text-pink-400 font-bold mb-1 uppercase tracking-wider">Abono Semanal</p>
                        <p class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-500">
                          {{ tanda.weeklyAmount | currency:'MXN':'symbol-narrow':'1.0-0' }}
                        </p>
                      </div>
                      <div class="text-right">
                        <p class="text-[10px] font-black text-pink-500 bg-white/80 px-2 py-1 rounded-xl shadow-sm border border-pink-100 inline-block">
                        {{ tanda.totalWeeks }} Semanas
                        </p>
                      </div>
                    </div>
                  </div>

                  <button class="btn-coquette btn-pink w-full py-2.5 justify-center text-xs font-black">
                     Gestionar Tanda ➜
                  </button>
                </div>

                <!-- Card Shine Effect -->
                <div class="absolute inset-0 -translate-x-full group-hover:animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 pointer-events-none"></div>
              </div>
            } @empty {
              <div class="card-coquette p-16 text-center col-span-full animate-bounce-in">
                <div class="text-6xl mb-4">🦋</div>
                <h3 class="text-2xl font-black text-pink-900 mb-2">Aún no hay tandas</h3>
                <p class="text-pink-500 font-medium mb-6">Comienza tu viaje de ahorro creando la primera tanda.</p>
                <button (click)="openCreateModal()" class="btn-coquette btn-pink mx-auto">Crear Primera Tanda ✨</button>
              </div>
            }
          </div>
        }
      </div>

      <!-- MODAL CREACIÓN (Official Coquette Style) -->
      @if (showCreateModal()) {
        <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-pink-900/40 backdrop-blur-sm" (click)="showCreateModal.set(false)"></div>
          
          <div class="card-coquette bg-white p-6 lg:p-8 w-full max-w-6xl relative z-10 animate-scale-in max-h-[94vh] overflow-y-auto scrollbar-hide">
            <div class="flex flex-wrap items-start justify-between gap-3 mb-6">
              <div>
                <h3 class="text-2xl font-black text-pink-900 flex items-center gap-3">
                  <span class="text-3xl animate-heartbeat">🎀</span> Configurar Tanda
                </h3>
                <p class="text-xs font-semibold text-pink-400 mt-1">
                  Define desde ahora quién ocupará cada lugar de entrega.
                </p>
              </div>
              <div class="rounded-2xl bg-pink-50 px-4 py-2 text-right border border-pink-100">
                <p class="text-[10px] uppercase tracking-widest font-black text-pink-400">Lugares asignados</p>
                <p class="text-xl font-black text-pink-700">
                  {{ assignedPlacesCount() }} / {{ newTanda.totalWeeks }}
                </p>
              </div>
            </div>

            <form (submit)="onCreateTanda($event)" class="space-y-5">
              <div class="grid grid-cols-1 lg:grid-cols-[minmax(280px,0.8fr)_minmax(420px,1.2fr)] gap-6">
                <div class="space-y-4">
                  <div>
                    <label class="label-coquette">🌸 Nombre de la Tanda</label>
                    <input class="input-coquette" name="name" [(ngModel)]="newTanda.name" placeholder="Ej. Tanda #1 Sartenes" required />
                  </div>

                  <div class="relative">
                    <label class="label-coquette">🎁 Producto del Catálogo</label>
                    <div class="relative">
                      <input class="input-coquette pr-10"
                             placeholder="Buscar o capturar producto..."
                             [(ngModel)]="productSearch"
                             name="productSearch"
                             (input)="onProductSearch()" />
                      @if (selectedProduct()) {
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">✔</span>
                      }
                    </div>

                    @if (productResults().length > 0) {
                      <div class="absolute top-full left-0 right-0 z-50 mt-1 glass-strong rounded-xl p-2 border border-pink-100 shadow-xl overflow-y-auto max-h-40">
                        @for (p of productResults(); track p.id) {
                          <button type="button" (click)="selectProduct(p)" class="w-full p-2 hover:bg-pink-50 rounded-lg text-left text-xs font-bold text-pink-900 flex justify-between">
                            <span>{{ p.name }}</span>
                            <span class="text-[10px] text-pink-400 opacity-50">{{ p.id.slice(0,4) }}</span>
                          </button>
                        }
                      </div>
                    }

                    @if (productSearch.length > 2 && !selectedProduct() && productResults().length === 0) {
                      <p class="text-[10px] text-pink-400 mt-1 italic">✨ Nuevo: "{{ productSearch }}" se agregará al catálogo.</p>
                    }
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="label-coquette">📅 Lugares / semanas</label>
                      <input class="input-coquette" type="number" name="weeks"
                             [ngModel]="newTanda.totalWeeks"
                             (ngModelChange)="onTotalWeeksChange($event)"
                             min="1" max="52" required />
                    </div>
                    <div>
                      <label class="label-coquette">💰 Abono semanal</label>
                      <input class="input-coquette" type="number" name="amount" [(ngModel)]="newTanda.weeklyAmount" min="0" required />
                    </div>
                  </div>

                  <div>
                    <label class="label-coquette">📅 Fecha de inicio</label>
                    <input class="input-coquette" type="date" name="startDate" [(ngModel)]="newTanda.startDate" required />
                  </div>

                  <div class="rounded-2xl border border-purple-100 bg-purple-50/70 p-4">
                    <p class="text-xs font-black text-purple-800">Cómo se usará este orden</p>
                    <p class="text-[11px] leading-relaxed text-purple-600 mt-1">
                      La ruleta mostrará estos lugares exactamente como los captures. No volverá a mezclarlos.
                    </p>
                  </div>
                </div>

                <div class="rounded-3xl border border-pink-100 bg-gradient-to-br from-pink-50/80 to-white p-4 lg:p-5">
                  <div class="flex flex-wrap items-end justify-between gap-3 mb-4">
                    <div>
                      <p class="text-sm font-black text-pink-900">Orden de lugares</p>
                      <p class="text-[11px] text-pink-500">
                        Selecciona un lugar y busca la clienta que lo ocupará.
                      </p>
                    </div>
                    <span class="rounded-full bg-white px-3 py-1 text-[10px] font-black text-pink-600 border border-pink-100">
                      Capturando lugar #{{ selectedPlaceTurn() }}
                    </span>
                  </div>

                  <div class="relative mb-4">
                    <input class="input-coquette pl-10"
                           name="placeClientSearch"
                           [(ngModel)]="placeSearch"
                           (focus)="showPlaceSuggestions.set(true)"
                           (blur)="hidePlaceSuggestions()"
                           placeholder="Buscar clienta por nombre o teléfono..." />
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400">🔍</span>

                    @if (showPlaceSuggestions()) {
                      <div class="absolute top-full left-0 right-0 z-50 mt-1 rounded-2xl bg-white p-2 border border-pink-100 shadow-2xl overflow-y-auto max-h-52">
                        @if (loadingClients()) {
                          <p class="p-3 text-xs font-bold text-pink-400">Cargando clientas...</p>
                        } @else {
                          @for (client of filteredPlaceClients(); track client.id) {
                            <button type="button" (mousedown)="$event.preventDefault()" (click)="assignClient(client)"
                                    class="w-full p-3 hover:bg-pink-50 rounded-xl text-left flex items-center justify-between gap-3">
                              <div class="min-w-0">
                                <p class="text-xs font-black text-pink-900 truncate">{{ client.name }}</p>
                                <p class="text-[10px] text-pink-400">{{ client.phone || 'Sin teléfono' }}</p>
                              </div>
                              <span class="text-[10px] font-black text-pink-500">Asignar #{{ selectedPlaceTurn() }}</span>
                            </button>
                          } @empty {
                            <p class="p-3 text-xs font-bold text-pink-400">No encontré clientas con esa búsqueda.</p>
                          }
                        }
                      </div>
                    }
                  </div>

                  <div class="space-y-2 max-h-[44vh] overflow-y-auto pr-1 scrollbar-hide">
                    @for (place of tandaPlaces(); track place.assignedTurn) {
                      <div (click)="selectPlace(place.assignedTurn)"
                           class="rounded-2xl border p-3 transition-all cursor-pointer"
                           [class.border-pink-400]="selectedPlaceTurn() === place.assignedTurn"
                           [class.ring-2]="selectedPlaceTurn() === place.assignedTurn"
                           [class.ring-pink-100]="selectedPlaceTurn() === place.assignedTurn"
                           [class.bg-white]="place.client"
                           [class.bg-pink-50/50]="!place.client"
                           [class.border-pink-100]="selectedPlaceTurn() !== place.assignedTurn">
                        <div class="flex items-center gap-3">
                          <div class="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-pink-500 to-rose-400 text-white flex items-center justify-center font-black shadow-sm">
                            {{ place.assignedTurn }}
                          </div>

                          <div class="min-w-0 flex-1">
                            @if (place.client; as client) {
                              <p class="text-sm font-black text-pink-900 truncate">{{ client.name }}</p>
                              <p class="text-[10px] font-semibold text-pink-400">{{ client.phone || 'Sin teléfono' }}</p>
                            } @else {
                              <p class="text-sm font-black text-pink-400">Selecciona una clienta</p>
                              <p class="text-[10px] text-pink-300">Este lugar es obligatorio</p>
                            }
                          </div>

                          <div class="flex items-center gap-1">
                            <button type="button" title="Subir" [disabled]="place.assignedTurn === 1"
                                    (click)="movePlace(place.assignedTurn, -1, $event)"
                                    class="w-8 h-8 rounded-lg bg-pink-50 text-pink-500 font-black disabled:opacity-30">↑</button>
                            <button type="button" title="Bajar" [disabled]="place.assignedTurn === newTanda.totalWeeks"
                                    (click)="movePlace(place.assignedTurn, 1, $event)"
                                    class="w-8 h-8 rounded-lg bg-pink-50 text-pink-500 font-black disabled:opacity-30">↓</button>
                            @if (place.client) {
                              <button type="button" title="Quitar clienta"
                                      (click)="clearPlace(place.assignedTurn, $event)"
                                      class="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 font-black">×</button>
                            }
                          </div>
                        </div>

                        @if (place.client) {
                          <div class="mt-3 ml-[52px]" (click)="$event.stopPropagation()">
                            <input class="input-coquette py-2 text-xs"
                                   [name]="'variant-' + place.assignedTurn"
                                   [ngModel]="place.variant"
                                   (ngModelChange)="updatePlaceVariant(place.assignedTurn, $event)"
                                   placeholder="Variante, color o talla (opcional)" />
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              </div>

              <div class="pt-2 flex flex-col-reverse sm:flex-row gap-3 justify-end border-t border-pink-100">
                <button type="button" (click)="showCreateModal.set(false)" class="btn-coquette btn-ghost sm:min-w-36 justify-center">Regresar</button>
                <button type="submit" [disabled]="isSaving() || !canCreateTanda()" class="btn-coquette btn-pink sm:min-w-52 justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  @if (isSaving()) {
                    <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  } @else {
                    Crear con {{ newTanda.totalWeeks }} lugares ✨
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: []
})
export class TandasComponent implements OnInit {
  private tandaService = inject(TandaService);
  private apiService = inject(ApiService);
  private toastService = inject(ToastService);
  
  tandas = signal<TandaDto[]>([]);
  loadingTandas = signal(true);
  showCreateModal = signal(false);
  isSaving = signal(false);
  scrollY = signal(0);
  
  // Filtros / Búsqueda
  searchQuery = '';
  
  // Gestión de Productos en Modal
  productSearch = '';
  productResults = signal<TandaProductDto[]>([]);
  selectedProduct = signal<TandaProductDto | null>(null);

  allClients = signal<ClientDto[]>([]);
  loadingClients = signal(false);
  placeSearch = '';
  showPlaceSuggestions = signal(false);
  selectedPlaceTurn = signal(1);
  tandaPlaces = signal<TandaPlaceDraft[]>(resizeTandaPlaces([], 10));

  newTanda: TandaForm = {
    name: '',
    totalWeeks: 10,
    weeklyAmount: 100,
    startDate: new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local
  };

  filteredTandas = computed(() => {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.tandas();
    return this.tandas().filter(t => 
      t.name.toLowerCase().includes(q) || 
      t.product?.name.toLowerCase().includes(q)
    );
  });

  filteredPlaceClients = () => {
    const query = this.placeSearch.toLowerCase().trim();
    if (!query) {
      return this.allClients().slice(0, 12);
    }

    return this.allClients()
      .filter(client =>
        client.name.toLowerCase().includes(query)
        || client.phone?.toLowerCase().includes(query)
      )
      .slice(0, 20);
  };

  assignedPlacesCount = computed(() =>
    this.tandaPlaces().filter(place => place.client !== null).length
  );

  constructor() {
    effect(() => {
      const list = this.tandas();
      if (!this.loadingTandas() && list.length > 0) {
        setTimeout(() => this.animateList(), 50);
      }
    });
  }

  @HostListener('window:scroll')
  onScroll() {
    this.scrollY.set(window.scrollY);
  }

  ngOnInit() {
    this.loadTandas();
    this.loadClients();
  }

  loadClients() {
    this.loadingClients.set(true);
    this.apiService.getClients().subscribe({
      next: clients => {
        this.allClients.set(
          [...clients].sort((a, b) => a.name.localeCompare(b.name, 'es'))
        );
        this.loadingClients.set(false);
      },
      error: () => {
        this.loadingClients.set(false);
        this.toastService.error('No se pudieron cargar las clientas');
      }
    });
  }

  loadTandas() {
    this.loadingTandas.set(true);
    this.tandaService.getTandas().subscribe({
      next: (data) => {
        this.tandas.set(data);
        this.loadingTandas.set(false);
      },
      error: () => {
        this.loadingTandas.set(false);
        this.toastService.error('No se pudieron cargar las tandas 😿');
      }
    });
  }

  animateList() {
    gsap.set('.tanda-card-anim', { opacity: 0, y: 30 });
    gsap.to('.tanda-card-anim', {
      opacity: 1,
      y: 0,
      duration: 0.4,
      stagger: 0.05,
      ease: 'back.out(1.2)',
      overwrite: true
    });
  }

  // --- Selección de Producto ---
  onProductSearch() {
    this.selectedProduct.set(null);
    if (this.productSearch.length < 2) {
      this.productResults.set([]);
      return;
    }
    
    this.tandaService.getTandaProducts().subscribe(prods => {
      this.productResults.set(
        prods.filter(p => p.name.toLowerCase().includes(this.productSearch.toLowerCase()))
      );
    });
  }

  selectProduct(p: TandaProductDto) {
    this.selectedProduct.set(p);
    this.productSearch = p.name;
    this.productResults.set([]);
  }

  openCreateModal() {
    this.resetForm();
    this.showCreateModal.set(true);
    this.isSaving.set(false);
  }

  onTotalWeeksChange(value: number | string) {
    const parsed = Number(value);
    const totalWeeks = Number.isFinite(parsed)
      ? Math.min(52, Math.max(1, Math.trunc(parsed)))
      : 1;

    this.newTanda.totalWeeks = totalWeeks;
    this.tandaPlaces.update(places => resizeTandaPlaces(places, totalWeeks));

    if (this.selectedPlaceTurn() > totalWeeks) {
      this.selectedPlaceTurn.set(totalWeeks);
    }
  }

  selectPlace(assignedTurn: number) {
    this.selectedPlaceTurn.set(assignedTurn);
    this.placeSearch = '';
    this.showPlaceSuggestions.set(true);
  }

  assignClient(client: ClientDto) {
    const assignedTurn = this.selectedPlaceTurn();
    this.tandaPlaces.update(places =>
      assignClientToPlace(places, assignedTurn, client)
    );

    const nextEmpty = this.tandaPlaces().find(place =>
      place.assignedTurn > assignedTurn && place.client === null
    ) ?? this.tandaPlaces().find(place => place.client === null);

    if (nextEmpty) {
      this.selectedPlaceTurn.set(nextEmpty.assignedTurn);
    }

    this.placeSearch = '';
    this.showPlaceSuggestions.set(false);
  }

  clearPlace(assignedTurn: number, event: Event) {
    event.stopPropagation();
    this.tandaPlaces.update(places =>
      assignClientToPlace(places, assignedTurn, null)
    );
    this.selectedPlaceTurn.set(assignedTurn);
  }

  movePlace(assignedTurn: number, direction: -1 | 1, event: Event) {
    event.stopPropagation();
    this.tandaPlaces.update(places =>
      swapTandaPlaces(places, assignedTurn, direction)
    );
  }

  updatePlaceVariant(assignedTurn: number, variant: string) {
    this.tandaPlaces.update(places => places.map(place =>
      place.assignedTurn === assignedTurn ? { ...place, variant } : place
    ));
  }

  hidePlaceSuggestions() {
    window.setTimeout(() => this.showPlaceSuggestions.set(false), 150);
  }

  canCreateTanda(): boolean {
    return this.newTanda.name.trim().length > 0
      && this.productSearch.trim().length > 0
      && this.newTanda.totalWeeks >= 1
      && this.newTanda.weeklyAmount >= 0
      && this.newTanda.startDate.length > 0
      && areTandaPlacesComplete(this.tandaPlaces(), this.newTanda.totalWeeks);
  }

  onCreateTanda(event: Event) {
    event.preventDefault();
    if (this.isSaving()) return;

    if (!this.canCreateTanda()) {
      this.toastService.error('Completa los datos y asigna una clienta a cada lugar');
      return;
    }

    this.isSaving.set(true);

    // 1. Asegurar el producto
    if (this.selectedProduct()) {
      this.finishCreateTanda(this.selectedProduct()!.id);
    } else {
      // Crear producto nuevo
      this.tandaService.createProduct(this.productSearch).subscribe({
        next: (p) => {
          this.toastService.info('✨ Producto agregado al catálogo');
          this.finishCreateTanda(p.id);
        },
        error: () => {
          this.isSaving.set(false);
          this.toastService.error('Error al registrar el producto');
        }
      });
    }
  }

  private finishCreateTanda(productId: string) {
    const dto: CreateTandaDto = {
      ...this.newTanda,
      productId,
      penaltyAmount: 0,
      participants: this.tandaPlaces().map(place => ({
        customerId: place.client!.id,
        assignedTurn: place.assignedTurn,
        variant: place.variant.trim() || undefined,
        weeklyAmount: place.weeklyAmount
      }))
    };

    this.tandaService.createTanda(dto).subscribe({
      next: () => {
        this.toastService.success('Tanda creada con éxito 🎀');
        this.showCreateModal.set(false);
        this.isSaving.set(false);
        this.loadTandas();
        this.resetForm();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.toastService.error(err.error?.message || 'Error al crear la tanda');
      }
    });
  }

  resetForm() {
    this.newTanda = {
      name: '',
      totalWeeks: 10,
      weeklyAmount: 100,
      startDate: new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local
    };
    this.productSearch = '';
    this.selectedProduct.set(null);
    this.placeSearch = '';
    this.selectedPlaceTurn.set(1);
    this.showPlaceSuggestions.set(false);
    this.tandaPlaces.set(resizeTandaPlaces([], this.newTanda.totalWeeks));
  }
}
