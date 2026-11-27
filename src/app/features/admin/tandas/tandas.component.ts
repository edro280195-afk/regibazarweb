import { Component, computed, inject, signal, OnInit, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TandaService } from '../../../core/services/tanda.service';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { CreateTandaDto, TandaDto, ClientDto, TandaProductDto, TandaStatus } from '../../../core/models';
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
  currency: string;
  itemCost?: number;
  exchangeRate?: number;
}

@Component({
  selector: 'app-tandas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="relative min-h-[calc(100dvh-6rem)] overflow-hidden -m-4 p-3 sm:p-4 lg:-m-8 lg:p-8 bg-gradient-to-br from-pink-50/70 via-white to-purple-50/70">
      <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div class="absolute -right-16 top-16 text-7xl opacity-25 blur-[1px]">✨</div>
        <div class="absolute -left-10 bottom-32 text-7xl opacity-20">🌸</div>
        <div class="absolute right-[18%] top-[35%] text-4xl opacity-20">♡</div>
      </div>

      <div class="relative z-10 mx-auto max-w-6xl space-y-5 pb-28 lg:pb-8">
        <header class="flex items-center justify-between gap-3 animate-slide-down">
          <div class="min-w-0">
            <p class="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-pink-500">Organización bonita</p>
            <h1 class="font-display text-3xl font-black leading-none text-pink-950 sm:text-4xl">Mis tandas 💕</h1>
            <p class="mt-2 text-xs font-medium text-pink-500 sm:text-sm">Pagos y turnos, pasito a pasito.</p>
          </div>
          <button (click)="openCreateModal()" class="btn-coquette btn-pink shrink-0 !min-h-11 !rounded-2xl px-3 text-xs shadow-lg sm:px-5 sm:text-sm">
            <span class="text-base">＋</span> <span class="hidden sm:inline">Nueva tanda</span><span class="sm:hidden">Nueva</span>
          </button>
        </header>

        @if (!loadingTandas()) {
          <section class="overflow-x-auto rounded-[1.4rem] border border-white/80 bg-white/70 p-2 shadow-[8px_10px_24px_rgba(193,106,161,0.1)] backdrop-blur-md" aria-label="Resumen de tandas">
            <div class="grid min-w-[345px] grid-cols-3 gap-2">
              <div class="rounded-2xl bg-white/80 px-3 py-3 shadow-[inset_2px_3px_8px_rgba(193,106,161,0.06)]">
                <p class="text-[9px] font-black uppercase tracking-wider text-pink-400">Activas</p>
                <p class="mt-1 text-2xl font-black leading-none text-pink-950">{{ activeTandasCount() }}</p>
              </div>
              <div class="rounded-2xl bg-white/80 px-3 py-3 shadow-[inset_2px_3px_8px_rgba(193,106,161,0.06)]">
                <p class="text-[9px] font-black uppercase tracking-wider text-pink-400">Lugares</p>
                <p class="mt-1 text-2xl font-black leading-none text-pink-950">{{ occupiedPlacesCount() }}</p>
              </div>
              <div class="rounded-2xl bg-white/80 px-3 py-3 shadow-[inset_2px_3px_8px_rgba(193,106,161,0.06)]">
                <p class="text-[9px] font-black uppercase tracking-wider text-pink-400">Por cobrar</p>
                <p class="mt-1 text-xl font-black leading-none text-rose-700">{{ totalBalance() | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
              </div>
            </div>
          </section>
        }

        <section class="rounded-[1.45rem] border border-white/80 bg-white/65 p-3 shadow-[inset_2px_3px_10px_rgba(193,106,161,0.08),8px_10px_24px_rgba(193,106,161,0.08)] backdrop-blur-md" aria-label="Buscar y filtrar tandas">
          <label class="relative block">
            <span class="sr-only">Buscar tanda o producto</span>
            <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-pink-400">⌕</span>
            <input class="input-coquette !h-11 !rounded-2xl !bg-white/90 pl-11 text-sm"
                   type="search"
                   [ngModel]="searchQuery()"
                   (ngModelChange)="searchQuery.set($event)"
                   placeholder="Busca una tanda o producto..."
                   aria-label="Buscar tanda o producto" />
          </label>
          <div class="mt-3 flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide" aria-label="Estados de tandas">
            <button type="button" (click)="statusFilter.set('')" [class.bg-pink-200]="statusFilter() === ''" [class.text-pink-800]="statusFilter() === ''" class="min-h-8 shrink-0 rounded-full border border-pink-100 bg-white/80 px-3 text-[11px] font-black text-pink-400 transition-colors">Todas</button>
            <button type="button" (click)="statusFilter.set('Active')" [class.bg-pink-200]="statusFilter() === 'Active'" [class.text-pink-800]="statusFilter() === 'Active'" class="min-h-8 shrink-0 rounded-full border border-pink-100 bg-white/80 px-3 text-[11px] font-black text-pink-400 transition-colors">Activas</button>
            <button type="button" (click)="statusFilter.set('Draft')" [class.bg-pink-200]="statusFilter() === 'Draft'" [class.text-pink-800]="statusFilter() === 'Draft'" class="min-h-8 shrink-0 rounded-full border border-pink-100 bg-white/80 px-3 text-[11px] font-black text-pink-400 transition-colors">Por revisar</button>
            <button type="button" (click)="statusFilter.set('Completed')" [class.bg-pink-200]="statusFilter() === 'Completed'" [class.text-pink-800]="statusFilter() === 'Completed'" class="min-h-8 shrink-0 rounded-full border border-pink-100 bg-white/80 px-3 text-[11px] font-black text-pink-400 transition-colors">Finalizadas</button>
            <button type="button" (click)="statusFilter.set('Cancelled')" [class.bg-pink-200]="statusFilter() === 'Cancelled'" [class.text-pink-800]="statusFilter() === 'Cancelled'" class="min-h-8 shrink-0 rounded-full border border-pink-100 bg-white/80 px-3 text-[11px] font-black text-pink-400 transition-colors">Canceladas</button>
          </div>
        </section>

        <div class="flex items-center justify-between gap-3 px-1">
          <h2 class="text-base font-black text-pink-950 sm:text-lg">Tus tandas</h2>
          @if (!loadingTandas()) {
            <span class="text-[11px] font-bold text-pink-400">{{ filteredTandas().length }} en total</span>
          }
        </div>

        @if (loadingTandas()) {
          <div class="space-y-3" aria-label="Cargando tandas">
            @for (i of [1,2,3,4]; track i) {
              <div class="shimmer h-24 rounded-[1.35rem]"></div>
            }
          </div>
        } @else {
          <div class="space-y-3 pb-8">
            @for (tanda of filteredTandas(); track tanda.id) {
              <a [routerLink]="['/admin/tandas', tanda.id]"
                 class="tanda-card-anim group flex min-h-[94px] items-center gap-3 rounded-[1.35rem] border border-white/80 bg-white/85 p-3 opacity-0 shadow-[8px_10px_24px_rgba(193,106,161,0.1)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[10px_14px_30px_rgba(193,106,161,0.16)] focus:outline-none focus:ring-2 focus:ring-pink-300 sm:gap-4 sm:p-4">
                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 text-xl shadow-inner sm:h-12 sm:w-12">{{ tanda.product ? '🎁' : '🪄' }}</span>
                <span class="min-w-0 flex-1">
                  <span class="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span class="truncate text-sm font-black text-pink-950 sm:text-base">{{ tanda.name }}</span>
                    <span class="badge shrink-0 text-[10px]" [class]="statusClass(tanda.status)">{{ statusLabel(tanda.status) }}</span>
                    @if (tanda.currency === 'USD') {
                      <span class="shrink-0 rounded-md border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[9px] font-black text-purple-700">USD</span>
                    }
                  </span>
                  <span class="mt-1 block truncate text-[11px] font-medium text-pink-400">{{ tanda.product?.name || 'Producto por definir' }} <span class="mx-1">·</span> Semana {{ tanda.currentWeek > tanda.totalWeeks ? tanda.totalWeeks : (tanda.currentWeek || 0) }} de {{ tanda.totalWeeks }} <span class="mx-1">·</span> {{ tanda.participantCount }} lugares</span>
                  <span class="mt-2 block h-1.5 overflow-hidden rounded-full bg-pink-100" aria-label="Avance de cobro">
                    <span class="block h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400 transition-[width] duration-300" [style.width.%]="tanda.progressPercentage"></span>
                  </span>
                </span>
                <span class="flex shrink-0 items-center gap-2 text-right">
                  <span class="hidden sm:block"><span class="block text-sm font-black text-pink-700">{{ tanda.weeklyAmount | currency:'MXN':'symbol-narrow':'1.0-0' }}</span><span class="mt-0.5 block text-[10px] font-semibold text-pink-400">por semana</span></span>
                  <span class="text-xl font-light text-pink-300">›</span>
                </span>
              </a>
            } @empty {
              <div class="card-coquette p-10 text-center sm:p-16">
                <div class="mb-4 text-5xl">🦋</div>
                <h3 class="mb-2 text-xl font-black text-pink-900">No encontré tandas</h3>
                <p class="mb-6 text-sm font-medium text-pink-500">Prueba con otra búsqueda o crea una nueva tanda.</p>
                <button (click)="openCreateModal()" class="btn-coquette btn-pink mx-auto">Nueva tanda ✨</button>
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

                  <!-- Moneda y Valor del Artículo -->
                  <div class="p-3 bg-pink-50/70 border border-pink-100 rounded-2xl space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-black text-pink-900">💵 Moneda y Valor del Artículo</span>
                      <div class="flex rounded-xl bg-white p-0.5 border border-pink-200">
                        <button type="button" (click)="setCurrency('MXN')"
                                [class.bg-pink-500]="newTanda.currency === 'MXN'"
                                [class.text-white]="newTanda.currency === 'MXN'"
                                [class.text-pink-700]="newTanda.currency !== 'MXN'"
                                class="px-2.5 py-1 text-xs font-black rounded-lg transition-all">MXN ($)</button>
                        <button type="button" (click)="setCurrency('USD')"
                                [class.bg-pink-500]="newTanda.currency === 'USD'"
                                [class.text-white]="newTanda.currency === 'USD'"
                                [class.text-pink-700]="newTanda.currency !== 'USD'"
                                class="px-2.5 py-1 text-xs font-black rounded-lg transition-all">USD ($)</button>
                      </div>
                    </div>

                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label class="text-[10px] font-bold text-pink-700">Valor Artículo ({{ newTanda.currency }})</label>
                        <input class="input-coquette py-1.5 text-xs font-bold" type="number" step="0.01" min="0"
                               placeholder="Ej. 1200"
                               [(ngModel)]="newTanda.itemCost"
                               (ngModelChange)="onItemCostOrRateChange()"
                               name="itemCost" />
                      </div>
                      @if (newTanda.currency === 'USD') {
                        <div>
                          <label class="text-[10px] font-bold text-pink-700">Tipo de Cambio (MXN/USD)</label>
                          <input class="input-coquette py-1.5 text-xs font-bold" type="number" step="0.01" min="0"
                                 placeholder="Ej. 19.50"
                                 [(ngModel)]="newTanda.exchangeRate"
                                 (ngModelChange)="onItemCostOrRateChange()"
                                 name="exchangeRate" />
                        </div>
                      } @else {
                        <div class="flex flex-col justify-end">
                          <p class="text-[11px] text-pink-500 italic pb-1.5">Pago regular en moneda nacional</p>
                        </div>
                      }
                    </div>

                    @if (newTanda.currency === 'USD' && newTanda.itemCost && newTanda.exchangeRate) {
                      <div class="text-[11px] font-semibold text-purple-700 bg-purple-50/80 px-2.5 py-1.5 rounded-xl border border-purple-100 flex justify-between">
                        <span>Equivalente en pesos:</span>
                        <span class="font-black">{{ (newTanda.itemCost * newTanda.exchangeRate) | currency:'MXN':'symbol-narrow':'1.0-0' }}</span>
                      </div>
                    }
                  </div>

                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label class="label-coquette">📅 Lugares / semanas</label>
                      <input class="input-coquette" type="number" name="weeks"
                             [ngModel]="newTanda.totalWeeks"
                             (ngModelChange)="onTotalWeeksChange($event)"
                             min="1" max="52" required />
                    </div>
                    <div>
                      <label class="label-coquette">💰 Abono semanal (MXN)</label>
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
                          <div class="flex flex-wrap items-center gap-3">
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

                          <div class="ml-auto flex items-center gap-1">
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
                          <div class="mt-3 ml-[52px] grid grid-cols-1 sm:grid-cols-2 gap-2" (click)="$event.stopPropagation()">
                            <input class="input-coquette py-1.5 text-xs"
                                   [name]="'variant-' + place.assignedTurn"
                                   [ngModel]="place.variant"
                                   (ngModelChange)="updatePlaceVariant(place.assignedTurn, $event)"
                                   placeholder="Variante, color o talla" />
                            <input class="input-coquette py-1.5 text-xs font-bold"
                                   type="number"
                                   [name]="'weeklyAmount-' + place.assignedTurn"
                                   [ngModel]="place.weeklyAmount"
                                   (ngModelChange)="updatePlaceWeeklyAmount(place.assignedTurn, $event)"
                                   placeholder="Abono ($/sem opcional)" />
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
  searchQuery = signal('');
  statusFilter = signal<TandaStatus | ''>('');
  
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
    startDate: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD local
    currency: 'MXN',
    itemCost: undefined,
    exchangeRate: undefined
  };

  filteredTandas = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    return this.tandas().filter(t => {
      const matchesSearch = !q
        || t.name.toLowerCase().includes(q)
        || t.product?.name.toLowerCase().includes(q);
      return matchesSearch && (!status || t.status === status);
    });
  });

  activeTandasCount = computed(() => this.tandas().filter(t => t.status === 'Active').length);
  occupiedPlacesCount = computed(() => this.tandas().reduce((total, t) => total + t.participantCount, 0));
  totalCollected = computed(() => this.tandas().reduce((total, t) => total + t.collectedAmount, 0));
  totalBalance = computed(() => this.tandas().reduce((total, t) => total + t.balanceDue, 0));

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
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.scrollY.set(window.scrollY);
    }
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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set('.tanda-card-anim', { opacity: 1, y: 0 });
      return;
    }
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
    this.onItemCostOrRateChange();
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
      && this.newTanda.weeklyAmount > 0
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
      currency: this.newTanda.currency,
      itemCost: this.newTanda.itemCost || undefined,
      exchangeRate: this.newTanda.currency === 'USD' ? this.newTanda.exchangeRate : undefined,
      participants: this.tandaPlaces().map(place => ({
        customerId: place.client!.id,
        assignedTurn: place.assignedTurn,
        variant: place.variant.trim() || undefined,
        weeklyAmount: place.weeklyAmount,
        currency: place.currency || undefined,
        itemCost: place.itemCost || undefined,
        exchangeRate: place.exchangeRate || undefined
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

  setCurrency(curr: string) {
    this.newTanda.currency = curr;
    if (curr === 'USD' && !this.newTanda.exchangeRate) {
      this.newTanda.exchangeRate = 19.50;
    }
    this.onItemCostOrRateChange();
  }

  onItemCostOrRateChange() {
    if (this.newTanda.itemCost && this.newTanda.itemCost > 0 && this.newTanda.totalWeeks > 0) {
      let totalMxn = this.newTanda.itemCost;
      if (this.newTanda.currency === 'USD' && this.newTanda.exchangeRate) {
        totalMxn = this.newTanda.itemCost * this.newTanda.exchangeRate;
      }
      this.newTanda.weeklyAmount = Math.ceil(totalMxn / this.newTanda.totalWeeks);
    }
  }

  updatePlaceWeeklyAmount(assignedTurn: number, amount: any) {
    const val = amount ? Number(amount) : undefined;
    this.tandaPlaces.update(places => places.map(place =>
      place.assignedTurn === assignedTurn ? { ...place, weeklyAmount: val } : place
    ));
  }

  resetForm() {
    this.newTanda = {
      name: '',
      totalWeeks: 10,
      weeklyAmount: 100,
      startDate: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD local
      currency: 'MXN',
      itemCost: undefined,
      exchangeRate: undefined
    };
    this.productSearch = '';
    this.selectedProduct.set(null);
    this.placeSearch = '';
    this.selectedPlaceTurn.set(1);
    this.showPlaceSuggestions.set(false);
    this.tandaPlaces.set(resizeTandaPlaces([], this.newTanda.totalWeeks));
  }

  statusLabel(status: TandaStatus): string {
    const labels: Record<TandaStatus, string> = {
      Draft: 'Borrador',
      Active: 'Activa',
      Completed: 'Completada',
      Cancelled: 'Cancelada'
    };
    return labels[status];
  }

  statusClass(status: TandaStatus): string {
    const classes: Record<TandaStatus, string> = {
      Draft: 'badge-pending',
      Active: 'badge-confirmed',
      Completed: 'badge-delivered',
      Cancelled: 'badge-canceled'
    };
    return classes[status];
  }
}
