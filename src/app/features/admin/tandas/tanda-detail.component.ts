import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TandaService } from '../../../core/services/tanda.service';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  CamiChatResponse,
  ClientDto,
  TandaDto,
  TandaParticipantDto,
  TandaParticipantStatus,
  TandaPaymentDto,
  TandaProductDto,
  TandaStatus,
  UpdateTandaParticipantDto,
  UpdateTandaPaymentDto
} from '../../../core/models';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { RaffleAnimationComponent } from '../raffles/raffle-animation/raffle-animation.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  buildPlaceAssignments,
  buildTandaSlots,
  getVerifiedWeekPaidAmount
} from './tanda-admin.util';

interface PaymentForm {
  amountPaid: number;
  penaltyPaid: number;
  paymentDate: string;
  isVerified: boolean;
  notes: string;
}

interface ParticipantForm {
  customerId: number;
  assignedTurn: number;
  variant: string;
  weeklyAmount?: number;
  currency?: string;
  itemCost?: number;
  exchangeRate?: number;
  status: TandaParticipantStatus;
  isDelivered: boolean;
  deliveryDate: string;
}

interface TandaEditForm {
  productId: string;
  name: string;
  totalWeeks: number;
  weeklyAmount: number;
  penaltyAmount: number;
  startDate: string;
  currency?: string;
  itemCost?: number;
  exchangeRate?: number;
  status: TandaStatus;
}

@Component({
  selector: 'app-tanda-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, FormsModule, DragDropModule, RaffleAnimationComponent],
  template: `
    <div class="space-y-6 max-w-7xl mx-auto animate-fade-in pb-20">
      <!-- Breadcrumbs & Navigation -->
      <div class="flex items-center justify-between mb-2">
        <nav class="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-pink-400">
          <a routerLink="/admin/tandas" class="hover:text-pink-600 transition-colors">Tandas</a>
          <span class="opacity-50">/</span>
          <span class="text-pink-900 font-black flex items-center gap-2">
            {{ tanda()?.name || 'Cargando...' }}
            @if (tanda() && !loading()) {
              <button (click)="openEditModal()" class="text-pink-300 hover:text-pink-500 transition-colors text-sm">✎</button>
            }
          </span>
        </nav>
        <button [routerLink]="['/admin/tandas']" class="btn-coquette btn-ghost text-xs">← Volver</button>
      </div>

      @if (loading()) {
        <div class="card-coquette p-20 text-center">
            <div class="flex flex-col items-center gap-4">
              <div class="w-12 h-12 border-4 border-pink-100 border-t-pink-500 rounded-full animate-spin"></div>
              <p class="text-pink-400 font-bold animate-pulse">Cargando detalles de la tanda... ✨</p>
            </div>
        </div>
      } @else if (tanda(); as t) {
        <section class="rounded-3xl border border-pink-100 bg-white px-5 py-5 shadow-sm" aria-label="Resumen financiero de la tanda">
          <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded-full bg-pink-100 px-3 py-1 text-[11px] font-black text-pink-800">{{ statusLabel(t.status) }}</span>
                <span class="text-xs font-bold text-pink-500">Semana {{ t.currentWeek || 0 }} de {{ t.totalWeeks }}</span>
              </div>
              <h1 class="mt-2 truncate text-2xl font-black text-pink-950">{{ t.name }}</h1>
              <p class="text-sm font-semibold text-pink-600">{{ t.product?.name || 'Producto sin definir' }}</p>
            </div>
            <div class="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
              <div>
                <p class="text-[10px] font-bold uppercase tracking-wider text-pink-500">Lugares</p>
                <p class="text-lg font-black text-pink-950">{{ t.participantCount }}/{{ t.totalWeeks }}</p>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-wider text-pink-500">Cobrado</p>
                <p class="text-lg font-black text-pink-950">{{ t.collectedAmount | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-wider text-pink-500">Pendiente</p>
                <p class="text-lg font-black text-rose-700">{{ t.balanceDue | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-wider text-pink-500">Avance</p>
                <p class="text-lg font-black text-pink-950">{{ t.progressPercentage | number:'1.0-0' }}%</p>
              </div>
            </div>
          </div>
          <div class="mt-4 h-2 overflow-hidden rounded-full bg-pink-100" aria-hidden="true">
            <div class="h-full rounded-full bg-pink-600 transition-[width] duration-300" [style.width.%]="t.progressPercentage"></div>
          </div>
        </section>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <!-- Main Content: Weekly Management -->
          <div class="lg:col-span-2 space-y-6">
            
            <!-- Delivery Hero (SHIMMER) -->
            <div class="card-coquette overflow-hidden relative border-pink-200">
              <div class="absolute inset-0 bg-gradient-to-r from-pink-50 via-white to-rose-50 -z-10"></div>
              
              <div class="p-8 relative flex flex-wrap items-center justify-between gap-6 overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-12 animate-shimmer pointer-events-none"></div>

                <div class="flex items-center gap-6">
                  <div class="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-pink-400 to-rose-500 shadow-lg shadow-pink-200 flex items-center justify-center text-3xl text-white transform hover:rotate-6 transition-transform">
                    📦
                  </div>
                  <div>
                    <h3 class="text-2xl font-black text-pink-900 font-display">Entrega de Tanda</h3>
                    @if (sundayParticipant(); as sp) {
                      @if (sp.isDelivered) {
                        <p class="text-emerald-500 font-bold flex items-center gap-2 mt-1 animate-fade-in">
                          <span class="text-xl">✅</span> ¡PRODUCTO ENTREGADO! ✨
                        </p>
                      } @else {
                        <p class="text-pink-500 font-bold flex items-center gap-2 mt-1">
                          <span class="animate-pulse">💖</span> {{ sp.customerName }} recibe hoy
                        </p>
                      }
                      <div class="flex gap-2 mt-3">
                        <span class="px-3 py-1 bg-pink-100 text-pink-700 text-[10px] font-black rounded-lg uppercase tracking-wider">Turno #{{ sp.assignedTurn }}</span>
                        <span class="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg uppercase tracking-wider">Entrega: Próx. Domingo</span>
                      </div>
                    } @else {
                      <p class="text-pink-400 italic mt-1 font-medium italic">Pendiente por asignar turno de entrega...</p>
                    }
                  </div>
                </div>
                
                @if (sundayParticipant(); as sp) {
                  @if (!sp.isDelivered) {
                    <div class="flex flex-col sm:flex-row gap-2 items-stretch">
                      <button (click)="addToSundayRoute(sp)"
                              [disabled]="addingToRoute()"
                              class="btn-coquette btn-pink px-6 py-4 shadow-xl disabled:opacity-60 disabled:cursor-not-allowed">
                        {{ addingToRoute() ? 'Agregando...' : '📍 Agregar a ruta del domingo' }}
                      </button>
                      <button (click)="onConfirmSundayDelivery(sp)" class="btn-coquette btn-rose px-8 py-4 shadow-xl">Confirmar Entrega ✨</button>
                    </div>
                  } @else {
                    <div class="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-2xl font-black text-xs border border-emerald-100 uppercase tracking-widest">
                       Entrega Completada
                    </div>
                  }
                }
              </div>
            </div>

            <!-- Weekly Payments Table -->
            <div class="card-coquette p-6 border-pink-100/50">
              <div class="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <div>
                   <h4 class="text-xs font-black text-pink-600 uppercase tracking-widest flex items-center gap-2">
                     <span>💎</span> Panel de Gestión de Tanda
                   </h4>
                   <p class="text-[9px] text-pink-400 font-bold mt-1">Control de abonos y logística de entregas</p>
                </div>
                
                <!-- Premium View Switcher -->
                <div class="bg-pink-50 p-1 rounded-2xl flex gap-1 border border-pink-100/50 shadow-inner">
                   <button (click)="viewMode.set('table')" 
                           [class]="viewMode() === 'table' ? 'bg-white text-pink-600 shadow-md scale-105' : 'text-pink-300 hover:text-pink-500'"
                           class="px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2">
                     <span>📋</span> Abonos
                   </button>
                   <button (click)="viewMode.set('visual')" 
                           [class]="viewMode() === 'visual' ? 'bg-white text-pink-600 shadow-md scale-105' : 'text-pink-300 hover:text-pink-500'"
                           class="px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2">
                     <span>🌟</span> Ruta Pro
                   </button>
                </div>
              </div>

              @if (viewMode() === 'table') {
                <!-- VISTA MÓVIL: SEMANA POR SEMANA (< lg) -->
                <div class="block lg:hidden space-y-4 animate-fade-in">
                  <!-- Selector de Semana -->
                  <div class="bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl p-3 border border-pink-100 shadow-sm">
                    <div class="flex items-center justify-between gap-2 mb-2">
                      <button (click)="prevSelectedWeek()" 
                              [disabled]="selectedWeekMobile() <= 1"
                              class="w-9 h-9 rounded-xl bg-white border border-pink-100 text-pink-600 font-black text-base flex items-center justify-center shadow-sm disabled:opacity-40 disabled:pointer-events-none hover:bg-pink-100 active:scale-95 transition-all">
                        ←
                      </button>
                      <div class="text-center">
                        <div class="flex items-center justify-center gap-1.5">
                          <span class="text-base font-black text-pink-900">Semana {{ selectedWeekMobile() }}</span>
                          @if (selectedWeekMobile() === currentWeek()) {
                            <span class="px-2 py-0.5 rounded-full bg-pink-500 text-white text-[9px] font-black uppercase tracking-wider shadow-sm">
                              Actual
                            </span>
                          }
                        </div>
                        <p class="text-[10px] text-pink-500 font-bold">
                          Cobrado: {{ mobileWeekStats().collected | currency:'MXN':'symbol-narrow':'1.0-0' }} · {{ mobileWeekStats().paidCount }}/{{ participants().length }} pagadas
                        </p>
                      </div>
                      <button (click)="nextSelectedWeek()" 
                              [disabled]="selectedWeekMobile() >= (tanda()?.totalWeeks ?? 52)"
                              class="w-9 h-9 rounded-xl bg-white border border-pink-100 text-pink-600 font-black text-base flex items-center justify-center shadow-sm disabled:opacity-40 disabled:pointer-events-none hover:bg-pink-100 active:scale-95 transition-all">
                        →
                      </button>
                    </div>

                    <!-- Píldoras rápidas de semanas -->
                    <div class="flex gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-hide">
                      @for (w of weeksArray(); track w) {
                        <button (click)="selectedWeekMobile.set(w)"
                                [class]="selectedWeekMobile() === w 
                                  ? 'bg-pink-600 text-white font-black shadow-md scale-105' 
                                  : (w === currentWeek() ? 'bg-pink-100 text-pink-800 font-bold border border-pink-300' : 'bg-white text-pink-600 border border-pink-100 font-medium')"
                                class="px-3 py-1 rounded-xl text-xs shrink-0 transition-all">
                          Sem {{ w }}
                        </button>
                      }
                    </div>
                  </div>

                  <!-- Lista de Participantes para la Semana Seleccionada -->
                  <div class="space-y-2.5">
                    @for (p of participants(); track p.id) {
                      <div class="bg-white rounded-2xl p-4 border border-pink-100 shadow-sm flex items-center justify-between gap-3 hover:border-pink-200 transition-all">
                        <!-- Info Clienta -->
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                          <span class="w-7 h-7 rounded-xl bg-pink-800 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-sm">
                            {{ p.assignedTurn }}
                          </span>
                          <div class="min-w-0">
                            <div class="flex items-center gap-1.5">
                              <p class="text-sm font-black text-pink-950 truncate">{{ p.customerName }}</p>
                              @if (p.isDelivered) {
                                <span class="text-[11px]" title="Producto entregado">📦</span>
                              }
                            </div>
                            <div class="flex items-center gap-2 mt-0.5 text-[10px] text-pink-400">
                              <span>Cuota: {{ getParticipantWeeklyAmount(p) | currency:'MXN':'symbol-narrow':'1.0-0' }}</span>
                              @if (p.variant) {
                                <span>· {{ p.variant }}</span>
                              }
                            </div>
                          </div>
                        </div>

                        <!-- Botón de Pago / Estado para la semana -->
                        <div class="flex items-center gap-2 shrink-0">
                          @if (hasPaid(p, selectedWeekMobile())) {
                            <button (click)="openPaymentModal(p, selectedWeekMobile())"
                                    class="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-black text-xs border border-emerald-100 flex items-center gap-1 shadow-sm active:scale-95 transition-all">
                              <span>✓</span> {{ getWeekPaidAmount(p, selectedWeekMobile()) | currency:'MXN':'symbol-narrow':'1.0-0' }}
                            </button>
                          } @else {
                            <button (click)="openPaymentModal(p, selectedWeekMobile())"
                                    class="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-xs shadow-md shadow-pink-200 active:scale-95 transition-all">
                              {{ getWeekPaidAmount(p, selectedWeekMobile()) > 0 ? 'Abonar ' + (getWeekPaidAmount(p, selectedWeekMobile()) | currency:'MXN':'symbol-narrow':'1.0-0') : 'Abonar ' + (getParticipantWeeklyAmount(p) | currency:'MXN':'symbol-narrow':'1.0-0') }}
                            </button>
                          }

                          <button (click)="selectedParticipantActions.set(p)" 
                                  class="w-8 h-8 rounded-full bg-pink-50 text-pink-400 flex items-center justify-center text-xs hover:bg-pink-100 hover:text-pink-600 transition-all shrink-0">
                            ⚙️
                          </button>
                        </div>
                      </div>
                    } @empty {
                      <div class="text-center py-12 text-pink-300 font-medium bg-pink-50/30 rounded-2xl border border-dashed border-pink-100">
                        <div class="text-3xl mb-1">🌸</div>
                        No hay participantes registradas
                      </div>
                    }
                  </div>
                </div>

                <!-- VISTA ESCRITORIO: TABLA COMPLETA (>= lg) -->
                <div class="hidden lg:block overflow-x-auto rounded-2xl border border-pink-50 shadow-inner scrollbar-hide animate-fade-in">
                  <table class="table-coquette w-full">
                    <thead>
                      <tr>
                        <th class="sticky left-0 z-20 bg-pink-50 shadow-[4px_0_8px_rgba(131,24,67,0.03)] min-w-[180px]">Clienta</th>
                        @for (w of weeksArray(); track w) {
                          <th class="text-center min-w-[75px]">Sem {{ w }}</th>
                        }
                        <th class="text-center min-w-[100px]">📅 Entrega</th>
                        <th class="text-center">📦</th>
                        <th class="text-center">⚙️</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (p of participants(); track p.id) {
                        <tr class="group">
                          <td class="sticky left-0 z-20 bg-white group-hover:bg-pink-50/30 transition-colors shadow-[4px_0_8px_rgba(131,24,67,0.03)]">
                            <div class="flex items-center gap-3">
                              <!-- Turno Editable -->
                              @if (editingTurnId() === p.id) {
                                <input type="number" 
                                       [value]="p.assignedTurn" 
                                       (blur)="editingTurnId.set(null)"
                                       (keyup.enter)="onUpdateTurn(p, $event)"
                                       class="w-10 h-8 rounded border-pink-200 text-center font-black text-pink-600 bg-pink-50 p-1"
                                       #turnInput
                                       (focus)="turnInput.select()">
                              } @else {
                                <span (click)="editingTurnId.set(p.id)" 
                                      class="w-6 h-6 rounded bg-pink-800 text-white text-[10px] font-black flex items-center justify-center shrink-0 cursor-pointer hover:bg-pink-600 transition-colors"
                                      title="Clic para cambiar turno">{{ p.assignedTurn }}</span>
                              }
                              <span class="text-sm font-black text-pink-900 truncate flex-1" [title]="p.customerName">{{ p.customerName }}</span>
                              <!-- Botón de ajustes -->
                              <button (click)="selectedParticipantActions.set(p)" 
                                      class="w-8 h-8 rounded-full bg-pink-50 text-pink-400 flex items-center justify-center text-xs hover:bg-pink-100 hover:text-pink-600 transition-all shrink-0">
                                  ⚙️
                              </button>
                            </div>
                          </td>
                          @for (w of weeksArray(); track w) {
                            <td class="text-center p-2">
                              @if (hasPaid(p, w)) {
                                <button (click)="openPaymentModal(p, w)"
                                        class="w-full rounded-lg bg-pink-50 px-1 py-1.5 text-[10px] font-black text-pink-700 hover:bg-pink-100"
                                        [attr.aria-label]="'Ver pagos de la semana ' + w + ' de ' + p.customerName">
                                  ✓ {{ getWeekPaidAmount(p, w) | currency:'MXN':'symbol-narrow':'1.0-0' }}
                                </button>
                              } @else {
                                <button (click)="openPaymentModal(p, w)" 
                                        class="w-full py-1.5 rounded-lg border border-pink-50 text-[11px] font-black text-pink-300 hover:border-pink-300 hover:text-pink-600 hover:bg-white transition-all">
                                  {{ getWeekPaidAmount(p, w) > 0 ? (getWeekPaidAmount(p, w) | currency:'MXN':'symbol-narrow':'1.0-0') : (getParticipantWeeklyAmount(p) | currency:'MXN':'symbol-narrow':'1.0-0') }}
                                </button>
                              }
                            </td>
                          }
                          @if (tanda(); as t) {
                            <td class="text-center">
                              <span class="text-[9px] font-black text-pink-400 uppercase tracking-tight">
                                {{ getDeliveryDate(t.startDate, p.assignedTurn) | date:'dd MMM' : '' : 'es-MX' | uppercase }}
                              </span>
                            </td>
                          }
                          <td class="text-center">
                            <input type="checkbox" [checked]="p.isDelivered"
                                   (click)="$event.preventDefault(); openParticipantEditor(p)"
                                   [attr.aria-label]="'Editar entrega de ' + p.customerName"
                                   class="w-4 h-4 rounded border-pink-200 text-pink-500 focus:ring-pink-300 cursor-pointer">
                          </td>
                          <td class="text-center">
                            <button (click)="selectedParticipantActions.set(p)" class="w-8 h-8 rounded-full bg-pink-50 text-pink-400 flex items-center justify-center text-xs hover:bg-pink-100 hover:text-pink-600 transition-all">
                               ⚙️
                            </button>
                          </td>
                        </tr>
                      } @empty {
                        <tr>
                          <td [attr.colspan]="weeksArray().length + 3" class="text-center py-20 text-pink-300 font-medium">
                            <div class="text-4xl mb-2">🌸</div>
                            Comienza inscribiendo a las participantes
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <!-- RUTA DE ENTREGAS CON ESTEROIDES (Visual View) -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-scale-in">
                  @for (p of participants(); track p.id) {
                    <div class="relative group">
                       <!-- Milestone Card -->
                       <div class="bg-gradient-to-br from-white to-pink-50/20 rounded-[2.5rem] p-6 border-2 transition-all duration-500 min-h-[220px] flex flex-col justify-between"
                            [ngClass]="{
                              'border-pink-200 shadow-xl shadow-pink-100/50 scale-[1.02]': p.assignedTurn === currentWeek(),
                              'border-pink-50 opacity-80 hover:opacity-100 hover:border-pink-100': p.assignedTurn !== currentWeek(),
                              'grayscale-[0.5]': p.isDelivered
                            }">
                          
                          <!-- Card Header: Turn & Date -->
                          <div class="flex justify-between items-start">
                             <div class="flex flex-col">
                                <span class="text-[9px] font-black text-pink-400 tracking-[0.2em] uppercase">Semana {{ p.assignedTurn }}</span>
                                <h5 class="text-lg font-black text-pink-900 leading-tight">
                                   {{ getDeliveryDate(tanda()!.startDate, p.assignedTurn) | date:'EEEE dd' : '' : 'es-MX' | uppercase }}
                                </h5>
                                <p class="text-[10px] text-pink-400 font-bold opacity-60">{{ getDeliveryDate(tanda()!.startDate, p.assignedTurn) | date:'MMMM yyyy' : '' : 'es-MX' | uppercase }}</p>
                             </div>
                             @if (p.assignedTurn === currentWeek()) {
                               <span class="w-10 h-10 rounded-2xl bg-pink-600 text-white flex items-center justify-center text-xl shadow-lg shadow-pink-200 animate-bounce-subtle">📍</span>
                             }
                             @if (p.isDelivered) {
                               <span class="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl">✅</span>
                             }
                          </div>

                          <!-- Card Body: Client -->
                          <div class="my-4">
                             <div class="flex items-center gap-3">
                                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center text-white text-xl font-black shadow-md">
                                   {{ p.customerName?.charAt(0) }}
                                </div>
                                <div>
                                   <p class="text-base font-black text-pink-900 truncate max-w-[150px]">{{ p.customerName }}</p>
                                   <!-- VARIANTE CON ESTILO DE ETIQUETA -->
                                   <div class="mt-1 flex items-center gap-1">
                                      <span class="text-[8px] bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-pink-200">💎 {{ p.variant || 'Sin Variante' }}</span>
                                   </div>
                                </div>
                             </div>
                          </div>

                          <!-- Card Actions -->
                          <div class="pt-2 border-t border-pink-50/50">
                             @if (!p.isDelivered) {
                               <button (click)="onConfirmSundayDelivery(p)" 
                                       class="w-full py-2.5 bg-white hover:bg-pink-600 hover:text-white text-pink-600 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all border border-pink-100 shadow-sm flex items-center justify-center gap-2 group-hover:scale-[1.02]">
                                 🎁 Confirmar Entrega
                               </button>
                             } @else {
                               <div class="text-center py-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                                  ✨ PRODUCTO ENTREGADO ✨
                               </div>
                             }
                          </div>
                       </div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Sidebar: Actions & Info -->
          <div class="space-y-6">
            <!-- Tanda Summary Card -->
            <div class="card-coquette p-6 bg-gradient-to-br from-white to-pink-50/30">
              <h4 class="text-[10px] font-black text-pink-400 uppercase tracking-[0.2em] mb-4">Información General</h4>
              <div class="space-y-4">
                <div class="flex justify-between items-center text-sm">
                  <span class="text-pink-600 font-bold italic">Producto:</span>
                  <span class="text-pink-900 font-black">{{ t.product?.name || 'Informativo' }}</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                  <span class="text-pink-600 font-bold italic">Inicio:</span>
                  <span class="text-pink-900 font-black">{{ t.startDate | date:'dd MMM yyyy' }}</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                  <span class="text-pink-600 font-bold italic">Paga Semanal:</span>
                  <span class="text-base font-black text-pink-600">{{ t.weeklyAmount | currency:'MXN':'symbol-narrow':'1.0-0' }}</span>
                </div>
                @if (t.itemCost) {
                  <div class="flex justify-between items-center text-sm pt-2 border-t border-pink-100">
                    <span class="text-pink-600 font-bold italic">Valor Artículo:</span>
                    <span class="text-sm font-black text-purple-800">
                      {{ t.itemCost | currency:(t.currency || 'MXN'):'symbol-narrow':'1.0-0' }}
                      <span class="text-[10px] uppercase font-bold text-pink-400">({{ t.currency || 'MXN' }})</span>
                    </span>
                  </div>
                }
                @if (t.currency === 'USD' && t.exchangeRate) {
                  <div class="flex justify-between items-center text-xs">
                    <span class="text-pink-500 font-bold">Tipo de Cambio:</span>
                    <span class="font-black text-pink-700">{{ t.exchangeRate | currency:'MXN':'symbol-narrow':'1.2-2' }} MXN/USD</span>
                  </div>
                }
              </div>

              <!-- Enlace de Clienta -->
              @if (t.accessToken) {
                <button (click)="onCopyLink(t.accessToken)" class="mt-6 w-full py-3 bg-pink-100 hover:bg-pink-200 text-pink-600 text-[10px] font-black rounded-2xl uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm border border-pink-200">
                  🔗 Copiar Enlace Clientas
                </button>
              }
            </div>

            <!-- Enrollment Panel -->
            <div class="card-coquette p-6 border-pink-200/60 bg-white/50 relative">
              <div class="absolute -top-4 -right-4 text-4xl opacity-10">🎀</div>
              <h4 class="text-sm font-black text-pink-600 mb-4 flex items-center gap-2">
                <span>➕</span> Inscribir en Tanda
              </h4>
              
                  <div class="flex items-center justify-between gap-2 mb-2">
                    <label class="text-[9px] font-black text-pink-400 uppercase tracking-widest">Clienta</label>
                    <button (click)="showOnlyFrequent.set(!showOnlyFrequent())" 
                            class="text-[9px] font-black px-2 py-0.5 rounded-full border transition-all"
                            [class]="showOnlyFrequent() ? 'bg-pink-100 text-pink-600 border-pink-200' : 'bg-gray-100 text-gray-500 border-gray-200'">
                      {{ showOnlyFrequent() ? '✨ Frecuentes' : '👥 Todas' }}
                    </button>
                  </div>
                  <div class="relative">
                    <input class="input-coquette py-2 text-xs" 
                           [ngModel]="clientSearch()" 
                           (ngModelChange)="onClientSearch($event)"
                           (focus)="showSuggestions.set(true)"
                           (blur)="hideSuggestionsWithDelay()"
                           (keydown)="onClientKeydown($event)"
                           placeholder="Buscar por nombre..." />
                    
                    @if (showSuggestions() && filteredClientsSearch().length > 0) {
                      <div class="absolute top-full left-0 right-0 z-50 mt-1 glass-strong rounded-xl p-1 border border-pink-100 shadow-lg max-h-60 overflow-y-auto scrollbar-hide animate-slide-down">
                        @for (c of filteredClientsSearch(); track c.id; let i = $index) {
                          <div (click)="selectClientToEnroll(c)" 
                               [class.bg-pink-50]="i === selectedSuggestionIdx()"
                               class="p-2.5 hover:bg-pink-50 rounded-lg cursor-pointer transition-colors group flex items-center justify-between gap-3">
                             <div class="min-w-0">
                                <p class="text-xs font-bold text-pink-900 group-hover:text-pink-600 truncate">{{ c.name }}</p>
                                <div class="flex items-center gap-1.5 mt-0.5">
                                  <span class="text-[8px] font-black uppercase tracking-tighter text-pink-400">{{ c.tag }}</span>
                                  @if (c.ordersCount > 0) {
                                    <span class="text-[8px] bg-purple-50 text-purple-600 px-1 rounded border border-purple-100 font-bold">FRECUENTE</span>
                                  }
                                </div>
                             </div>
                             <span class="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">➕</span>
                          </div>
                        }
                      </div>
                    } @else if (showSuggestions() && clientSearch().length >= 2) {
                      <div class="absolute top-full left-0 right-0 z-50 mt-1 glass-strong rounded-xl p-4 text-center border border-pink-100 shadow-lg animate-slide-down">
                        <p class="text-[10px] text-pink-400 font-medium italic">No se encontraron coincidencias 🔍</p>
                      </div>
                    }
                  </div>

                @if (selectedClient(); as sc) {
                  <div class="p-4 bg-gradient-to-br from-pink-50 to-white rounded-2xl border border-pink-200 animate-scale-in">
                    <div class="flex items-center gap-3 mb-4">
                       <div class="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-black text-sm">
                          {{ sc.name.charAt(0) }}
                       </div>
                       <div class="flex-1">
                          <p class="text-sm font-black text-pink-900 leading-tight">{{ sc.name }}</p>
                          <p class="text-[10px] text-pink-400 font-bold uppercase">{{ sc.tag || 'Clienta' }}</p>
                       </div>
                    </div>
                    
                    <div class="space-y-4">
                      <div class="flex gap-4">
                        <div class="flex-1">
                          <label class="text-[9px] font-black text-pink-400 uppercase mb-1 block">Variante (Color/Modelo)</label>
                          <input type="text" [(ngModel)]="enrollVariant" class="input-coquette py-1.5 text-xs font-bold" placeholder="Ej. Rosa Pastel" />
                        </div>
                        <div class="w-20">
                          <label class="text-[9px] font-black text-pink-400 uppercase mb-1 block">Turno #</label>
                          <input type="number" [(ngModel)]="enrollTurn" class="input-coquette py-1.5 text-xs text-center font-black" min="1" [max]="t.totalWeeks" />
                        </div>
                      </div>
                      <div class="grid grid-cols-2 gap-2">
                        <div>
                          <label class="text-[9px] font-black text-pink-400 uppercase mb-1 block">Abono Semanal (MXN)</label>
                          <input type="number" [(ngModel)]="enrollWeeklyAmount" class="input-coquette py-1.5 text-xs font-bold" [placeholder]="t.weeklyAmount.toString()" />
                        </div>
                        <div>
                          <label class="text-[9px] font-black text-pink-400 uppercase mb-1 block">Valor Propio (Opcional)</label>
                          <input type="number" [(ngModel)]="enrollItemCost" class="input-coquette py-1.5 text-xs font-bold" placeholder="Ej. 1200" />
                        </div>
                      </div>
                      <button (click)="onAddParticipant()" [disabled]="isEnrolling()" class="btn-coquette btn-pink w-full py-3 text-[10px] font-black shadow-md">
                        @if (isEnrolling()) { <span class="animate-spin italic">⌛</span> } @else { Inscribir en Tanda 🎀 }
                      </button>
                    </div>
                  </div>
                }
              </div>

              <!-- Tanda Actions -->
            <div class="space-y-3">
              <button class="btn-coquette btn-pink w-full justify-center text-[10px] py-3 font-black shadow-lg" (click)="onShuffle()">
                🎡 Mostrar ruleta de lugares
              </button>
              <button class="btn-coquette btn-purple w-full justify-center text-[10px] py-3 font-black shadow-lg mt-3" (click)="openReorderModal()">
                🔄 Reordenar Lista
              </button>
              <button class="btn-coquette btn-outline-pink w-full justify-center text-[10px] py-3 font-black shadow-sm" (click)="onProcessPenalties()">
                ⚠️ Procesar Retrasos
              </button>
              <button (click)="setTandaStatus(t.status === 'Cancelled' ? 'Active' : 'Cancelled')"
                      class="bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100/50 rounded-3xl w-full py-3 text-[10px] font-black transition-colors">
                {{ t.status === 'Cancelled' ? 'Reactivar tanda' : 'Cancelar tanda' }}
              </button>
            </div>
          </div>
        </div>
      }
      
      <!-- PAYMENT MODAL -->
      @if (showPaymentModal()) {
        <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="payment-title">
          <div class="absolute inset-0 bg-pink-950/35" (click)="showPaymentModal.set(false)"></div>
          <div class="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-pink-100 bg-white p-5 shadow-2xl sm:p-7">
            <div class="mb-5 flex items-start justify-between gap-4">
              <div>
                <p class="text-[11px] font-black uppercase tracking-wider text-pink-500">Semana {{ activePayment()?.week }}</p>
                <h3 id="payment-title" class="text-xl font-black text-pink-950">{{ activePayment()?.participant?.customerName }}</h3>
                <p class="text-sm font-semibold text-pink-600">
                  Cuota {{ getParticipantWeeklyAmount(activePayment()!.participant) | currency:'MXN':'symbol-narrow':'1.0-0' }} ·
                  pagado {{ getWeekPaidAmount(activePayment()!.participant, activePayment()!.week) | currency:'MXN':'symbol-narrow':'1.0-0' }}
                </p>
              </div>
              <button (click)="showPaymentModal.set(false)" class="h-10 w-10 rounded-full bg-pink-50 text-xl text-pink-700" aria-label="Cerrar">×</button>
            </div>

            @if (paymentsForActiveWeek().length > 0) {
              <div class="mb-6 rounded-2xl border border-pink-100 bg-pink-50/60 p-3">
                <p class="mb-2 text-[10px] font-black uppercase tracking-wider text-pink-500">Movimientos registrados</p>
                <div class="space-y-2">
                  @for (payment of paymentsForActiveWeek(); track payment.id) {
                    <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs">
                      <div>
                        <p class="font-black text-pink-950">{{ payment.amountPaid | currency:'MXN':'symbol-narrow':'1.0-0' }}</p>
                        <p class="text-pink-500">{{ payment.paymentDate | date:'dd MMM yyyy, HH:mm' }}{{ payment.notes ? ' · ' + payment.notes : '' }}</p>
                      </div>
                      <div class="flex items-center gap-2">
                        <button (click)="editPayment(payment)" class="rounded-lg px-3 py-2 font-bold text-pink-700 hover:bg-pink-50">Editar</button>
                        <button (click)="requestDeletePayment(payment.id)"
                                class="rounded-lg px-3 py-2 font-bold text-rose-700 hover:bg-rose-50">
                          {{ pendingDeletePaymentId() === payment.id ? 'Confirmar borrado' : 'Eliminar' }}
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="label-coquette" for="payment-amount">Monto abonado</label>
                <input id="payment-amount" type="number" min="0.01" step="0.01" [(ngModel)]="paymentForm().amountPaid" class="input-coquette" />
              </div>
              <div>
                <label class="label-coquette" for="payment-penalty">Penalización pagada</label>
                <input id="payment-penalty" type="number" min="0" step="0.01" [(ngModel)]="paymentForm().penaltyPaid" class="input-coquette" />
              </div>
              <div>
                <label class="label-coquette" for="payment-date">Fecha y hora</label>
                <input id="payment-date" type="datetime-local" [(ngModel)]="paymentForm().paymentDate" class="input-coquette" />
              </div>
              <label class="flex min-h-12 items-center gap-3 rounded-2xl border border-pink-100 bg-pink-50 px-4 font-bold text-pink-800">
                <input type="checkbox" [(ngModel)]="paymentForm().isVerified" class="h-4 w-4" />
                Pago verificado
              </label>
              <div class="sm:col-span-2">
                <label class="label-coquette" for="payment-notes">Notas</label>
                <textarea id="payment-notes" rows="2" [(ngModel)]="paymentForm().notes" class="input-coquette" placeholder="Transferencia, efectivo, referencia..."></textarea>
              </div>
            </div>

            <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              @if (editingPaymentId()) {
                <button (click)="cancelPaymentEdit()" class="btn-coquette btn-ghost justify-center">Nuevo abono</button>
              }
              <button (click)="showPaymentModal.set(false)" class="btn-coquette btn-ghost justify-center">Cerrar</button>
              <button (click)="confirmPayment()" [disabled]="isSavingPay()" class="btn-coquette btn-pink justify-center">
                {{ isSavingPay() ? 'Guardando...' : (editingPaymentId() ? 'Guardar cambios' : 'Registrar abono') }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- EDIT TANDA MODAL -->
      @if (showEditModal()) {
        <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div class="absolute inset-0 bg-pink-900/30 backdrop-blur-md" (click)="showEditModal.set(false)"></div>
          <div class="card-coquette bg-white p-8 w-full max-w-lg relative z-10 animate-scale-in">
             <h3 class="text-xl font-black text-pink-900 mb-6 flex items-center gap-2">
                <span class="text-2xl">📝</span> Editar Detalles de Tanda
             </h3>
             
             <div class="grid grid-cols-2 gap-4 mb-8">
               <div class="col-span-2">
                 <label class="text-[10px] font-black text-pink-400 uppercase mb-1 block">Nombre de la Tanda</label>
                 <input type="text" [(ngModel)]="editForm().name" class="input-coquette py-2" />
               </div>

               <div class="col-span-2">
                 <label class="text-[10px] font-black text-pink-500 uppercase mb-1 block" for="edit-product">Producto</label>
                 <select id="edit-product" [(ngModel)]="editForm().productId" class="input-coquette py-2">
                   @for (product of tandaProducts(); track product.id) {
                     <option [value]="product.id">{{ product.name }}</option>
                   }
                 </select>
               </div>
               
               <div>
                 <label class="text-[10px] font-black text-pink-400 uppercase mb-1 block">Semanas Totales</label>
                 <input type="number" min="1" max="52" [(ngModel)]="editForm().totalWeeks" class="input-coquette py-2" />
               </div>
               
               <div>
                 <label class="text-[10px] font-black text-pink-400 uppercase mb-1 block">Fecha de Inicio</label>
                 <input type="date" [(ngModel)]="editForm().startDate" class="input-coquette py-2" />
               </div>
               
               <div>
                 <label class="text-[10px] font-black text-pink-400 uppercase mb-1 block">Monto Semanal</label>
                 <input type="number" min="0.01" step="0.01" [(ngModel)]="editForm().weeklyAmount" class="input-coquette py-2" />
               </div>
               
               <div>
                 <label class="text-[10px] font-black text-pink-400 uppercase mb-1 block">Penalización</label>
                 <input type="number" min="0" step="0.01" [(ngModel)]="editForm().penaltyAmount" class="input-coquette py-2" />
               </div>

               <div class="col-span-2">
                 <label class="text-[10px] font-black text-pink-500 uppercase mb-1 block" for="edit-status">Estado</label>
                 <select id="edit-status" [(ngModel)]="editForm().status" class="input-coquette py-2">
                   <option value="Draft">Borrador</option>
                   <option value="Active">Activa</option>
                   <option value="Completed">Completada</option>
                   <option value="Cancelled">Cancelada</option>
                 </select>
               </div>
             </div>

             <div class="flex gap-4">
                <button (click)="showEditModal.set(false)" class="btn-coquette btn-ghost flex-1 justify-center">Cancelar</button>
                <button (click)="onUpdateTanda()" [disabled]="isUpdatingTanda()" class="btn-coquette btn-pink flex-1 justify-center shadow-lg">
                   @if (isUpdatingTanda()) { <span class="animate-spin italic">⌛</span> } @else { Guardar Cambios ✨ }
                </button>
             </div>
          </div>
        </div>
      }

      <!-- ACTION SHEET: Participant Management -->
      @if (selectedParticipantActions(); as p) {
        <!-- PARTICIPANT ACTIONS (Mobile Optimized Modal) -->
        <div class="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in">
          <div class="absolute inset-0 bg-pink-900/30 backdrop-blur-sm" (click)="selectedParticipantActions.set(null)"></div>
          <div class="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative z-10 animate-scale-in shadow-2xl border border-pink-100">
             <div class="w-12 h-1.5 bg-pink-100 rounded-full mx-auto mb-6 sm:hidden"></div>
             
             <div class="text-center mb-8">
               <div class="w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-400 rounded-3xl mx-auto flex items-center justify-center text-white text-2xl shadow-lg mb-4">
                  {{ p.customerName?.charAt(0) }}
               </div>
               <h3 class="text-xl font-black text-pink-900">{{ p.customerName }}</h3>
               <p class="text-xs font-bold text-pink-400 uppercase tracking-widest mt-1">Turno #{{ p.assignedTurn }}</p>
             </div>

             <div class="space-y-3">
                <button (click)="openParticipantEditor(p)"
                        class="w-full py-4 bg-pink-50 hover:bg-pink-100 text-pink-600 font-black rounded-2xl flex items-center justify-center gap-3 transition-all border border-pink-100">
                  <span class="text-lg">✎</span> Editar participante
                </button>
                <button (click)="showRemoveConfirm.set(p); selectedParticipantActions.set(null)" 
                        class="w-full py-4 bg-rose-50 hover:bg-rose-100 text-rose-500 font-black rounded-2xl flex items-center justify-center gap-3 transition-all border border-rose-100">
                  <span class="text-lg">🗑️</span> Quitar de esta Tanda
                </button>
                <button (click)="selectedParticipantActions.set(null)" 
                        class="w-full py-4 text-pink-300 font-bold rounded-2xl flex items-center justify-center gap-3 transition-all">
                  Cancelar
                </button>
             </div>
          </div>
        </div>
      }

      @if (editingParticipant(); as participant) {
        <div class="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="participant-editor-title">
          <div class="absolute inset-0 bg-pink-950/35" (click)="editingParticipant.set(null)"></div>
          <div class="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-pink-100 bg-white p-5 shadow-2xl sm:p-7">
            <div class="mb-6">
              <p class="text-[11px] font-black uppercase tracking-wider text-pink-500">Lugar {{ participant.assignedTurn }}</p>
              <h3 id="participant-editor-title" class="text-xl font-black text-pink-950">Editar participante</h3>
              <p class="text-sm text-pink-600">Todos los datos y lugares pueden modificarse.</p>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="sm:col-span-2 relative">
                <label class="label-coquette" for="edit-participant-search">Clienta</label>
                <div class="relative">
                  <input id="edit-participant-search"
                         type="text"
                         class="input-coquette pl-10 text-xs sm:text-sm font-bold"
                         [ngModel]="editParticipantClientSearch()"
                         (ngModelChange)="onEditParticipantSearch($event)"
                         (focus)="showEditParticipantSuggestions.set(true)"
                         (blur)="hideEditParticipantSuggestionsWithDelay()"
                         placeholder="Escribe el nombre de la clienta..." />
                  <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-pink-400">🔍</span>
                  @if (participantForm().customerId) {
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-pink-700 bg-pink-100 px-2 py-0.5 rounded-full">
                      Seleccionada
                    </span>
                  }
                </div>

                @if (showEditParticipantSuggestions() && filteredEditParticipantClients().length > 0) {
                  <div class="absolute top-full left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto rounded-2xl border border-pink-100 bg-white p-2 shadow-2xl animate-slide-down">
                    @for (cl of filteredEditParticipantClients(); track cl.id) {
                      <div (mousedown)="$event.preventDefault()"
                           (click)="selectClientForEditParticipant(cl)"
                           class="flex cursor-pointer items-center justify-between gap-2 rounded-xl p-2.5 transition-colors hover:bg-pink-50"
                           [class.bg-pink-50]="participantForm().customerId === cl.id">
                        <div class="min-w-0">
                          <p class="truncate text-xs font-bold text-pink-900">{{ cl.name }}</p>
                          <p class="text-[10px] text-pink-400">{{ cl.tag || 'Clienta' }} {{ cl.phone ? '· ' + cl.phone : '' }}</p>
                        </div>
                        <span class="text-[11px] font-black text-pink-500">
                          {{ participantForm().customerId === cl.id ? '✓' : 'Elegir' }}
                        </span>
                      </div>
                    }
                  </div>
                } @else if (showEditParticipantSuggestions() && editParticipantClientSearch().trim().length >= 2) {
                  <div class="absolute top-full left-0 right-0 z-50 mt-1 rounded-2xl border border-pink-100 bg-white p-3 text-center shadow-2xl animate-slide-down">
                    <p class="text-xs text-pink-400 italic">No se encontraron clientas con ese nombre 🔍</p>
                  </div>
                }
              </div>
              <div>
                <label class="label-coquette" for="participant-turn">Lugar</label>
                <input id="participant-turn" type="number" min="1" [max]="tanda()?.totalWeeks ?? 52"
                       [(ngModel)]="participantForm().assignedTurn" class="input-coquette" />
                <p class="mt-1 text-[10px] text-pink-500">Si está ocupado, ambas participantes intercambian lugar.</p>
              </div>

              <div>
                <label class="label-coquette" for="participant-amount">Abono Semanal (MXN)</label>
                <input id="participant-amount" type="number" min="0.01" step="0.01"
                       [(ngModel)]="participantForm().weeklyAmount" class="input-coquette"
                       [placeholder]="tanda()?.weeklyAmount?.toString() || 'General'" />
              </div>

              <div>
                <label class="label-coquette" for="participant-cost">Valor del Artículo</label>
                <input id="participant-cost" type="number" min="0" step="0.01"
                       [(ngModel)]="participantForm().itemCost" class="input-coquette"
                       placeholder="Ej. 1200" />
              </div>

              <div>
                <label class="label-coquette" for="participant-curr">Moneda / Tipo de Cambio</label>
                <div class="grid grid-cols-2 gap-2">
                  <select id="participant-curr" [(ngModel)]="participantForm().currency" class="input-coquette">
                    <option value="">(Heredar de Tanda)</option>
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                  </select>
                  <input type="number" step="0.01" [(ngModel)]="participantForm().exchangeRate" class="input-coquette" placeholder="T.C." />
                </div>
              </div>
              <div>
                <label class="label-coquette" for="participant-status">Estado</label>
                <select id="participant-status" [(ngModel)]="participantForm().status" class="input-coquette">
                  <option value="Active">Al corriente</option>
                  <option value="Delinquent">Con retraso</option>
                  <option value="Completed">Completada</option>
                </select>
              </div>
              <div>
                <label class="label-coquette" for="participant-variant">Variante</label>
                <input id="participant-variant" type="text" [(ngModel)]="participantForm().variant" class="input-coquette" placeholder="Color, talla o modelo" />
              </div>
              <div>
                <label class="label-coquette" for="participant-amount">Abono personalizado</label>
                <input id="participant-amount" type="number" min="0.01" step="0.01"
                       [(ngModel)]="participantForm().weeklyAmount" class="input-coquette"
                       [placeholder]="'General: $' + (tanda()?.weeklyAmount ?? 0)" />
              </div>
              <label class="flex min-h-12 items-center gap-3 rounded-2xl border border-pink-100 bg-pink-50 px-4 font-bold text-pink-800">
                <input type="checkbox" [(ngModel)]="participantForm().isDelivered" class="h-4 w-4" />
                Producto entregado
              </label>
              @if (participantForm().isDelivered) {
                <div>
                  <label class="label-coquette" for="participant-delivery-date">Fecha de entrega</label>
                  <input id="participant-delivery-date" type="date" [(ngModel)]="participantForm().deliveryDate" class="input-coquette" />
                </div>
              }
            </div>

            <div class="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button (click)="editingParticipant.set(null)" class="btn-coquette btn-ghost justify-center">Cancelar</button>
              <button (click)="saveParticipant()" [disabled]="isUpdatingParticipant()" class="btn-coquette btn-pink justify-center">
                {{ isUpdatingParticipant() ? 'Guardando...' : 'Guardar participante' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- EDIT VARIANT MODAL -->
      @if (editingVariantId(); as id) {
        <div class="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fade-in">
          <div class="absolute inset-0 bg-pink-900/30 backdrop-blur-md" (click)="editingVariantId.set(null)"></div>
          <div class="card-coquette bg-white p-8 w-full max-w-sm relative z-10 animate-scale-in">
             <h3 class="text-xl font-black text-pink-900 mb-6 flex items-center gap-2">
                <span class="text-2xl">🎨</span> Variante del Producto
             </h3>
             
             <div class="mb-8">
               <label class="text-[10px] font-black text-pink-400 uppercase mb-1 block">Color / Modelo / Variante</label>
               <input type="text" [(ngModel)]="editVariantValue" class="input-coquette py-3 font-bold" placeholder="Escribe la variante aquí..." #vInput (keyup.enter)="onUpdateVariant(id)" />
             </div>

             <div class="flex gap-4">
                <button (click)="editingVariantId.set(null)" class="btn-coquette btn-ghost flex-1 justify-center">Cancelar</button>
                <button (click)="onUpdateVariant(id)" [disabled]="isUpdatingVariant()" class="btn-coquette btn-pink flex-1 justify-center shadow-lg">
                   @if (isUpdatingVariant()) { <span class="animate-spin italic">⌛</span> } @else { Guardar ✨ }
                </button>
             </div>
          </div>
        </div>
      }

      <!-- CUSTOM CONFIRMATION MODAL -->
      @if (showRemoveConfirm(); as p) {
        <div class="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fade-in">
          <div class="absolute inset-0 bg-rose-900/40 backdrop-blur-md"></div>
          <div class="card-coquette bg-white p-8 w-full max-w-sm relative z-10 animate-scale-in border-rose-100">
             <div class="w-20 h-20 bg-rose-100 rounded-full mx-auto flex items-center justify-center text-rose-500 text-4xl mb-6 animate-bounce-slow">
                ⚠️
             </div>
             <h3 class="text-xl font-black text-rose-900 text-center mb-2">¿Estás segura?</h3>
             <p class="text-sm text-rose-400 text-center font-medium leading-relaxed mb-8">
               Vas a quitar a <span class="font-black text-rose-600">{{ p.customerName }}</span> de la tanda. Sus pagos también se borrarán de forma permanente. 🎀
             </p>

             <div class="flex gap-4">
                <button (click)="showRemoveConfirm.set(null)" class="btn-coquette btn-ghost flex-1 justify-center">No, esperar</button>
                <button (click)="confirmRemoveParticipant(p)" class="btn-coquette btn-rose flex-1 justify-center shadow-lg shadow-rose-200">
                   Sí, quitar ✨
                </button>
             </div>
          </div>
        </div>
      }

      <!-- CUSTOM DELIVERY CONFIRMATION MODAL (Mobile Centered) -->
      @if (confirmingDelivery(); as p) {
        <div class="fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div class="fixed inset-0 bg-pink-950/40 backdrop-blur-md" (click)="confirmingDelivery.set(null)"></div>
          <div class="card-coquette bg-white p-6 sm:p-8 w-full max-w-sm relative z-10 my-auto shadow-2xl animate-scale-in">
             <div class="w-20 h-20 bg-pink-100 rounded-full mx-auto flex items-center justify-center text-pink-500 text-4xl mb-6 animate-bounce-subtle">
                🎁
             </div>
             <h3 class="text-xl font-black text-pink-900 text-center mb-2">¿Confirmar Entrega?</h3>
             <p class="text-sm text-pink-400 text-center font-medium leading-relaxed mb-8">
               ¿Confirmas que <span class="font-black text-pink-600">{{ p.customerName }}</span> recibió su producto hoy? ✨
             </p>

             <div class="flex gap-4">
                <button (click)="confirmingDelivery.set(null)" class="btn-coquette btn-ghost flex-1 justify-center">Cancelar</button>
                <button (click)="confirmDelivery(p)" class="btn-coquette btn-pink flex-1 justify-center shadow-lg shadow-pink-200">
                   Sí, confirmar ✨
                </button>
             </div>
          </div>
        </div>
      }
    </div>

    <!-- Ruleta de Sorteo -->
    @if (showRoulette()) {
      <app-raffle-animation
        [customTitle]="tanda()?.name"
        [participants]="rouletteParticipants()"
        [winnerNames]="rouletteWinnerNames()"
        [turnNumbers]="rouletteTurnNumbers()"
        animationType="roulette"
        (close)="showRoulette.set(false)"
        (startRequested)="handleRouletteStart()"
      ></app-raffle-animation>
    }


    <!-- Modal de Reordenamiento Drag & Drop -->
    @if (showReorderModal()) {
      <div class="fixed inset-0 bg-pink-950/50 z-[100] flex items-center justify-center p-4">
        <div class="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          <!-- Header -->
          <div class="p-6 border-b flex justify-between items-center bg-gradient-to-r from-purple-50 to-pink-50">
            <div>
              <h3 class="text-xl font-bold text-pink-950">Mover lugares</h3>
              <p class="text-xs text-pink-600">Arrastra participantes o espacios vacíos. Todo el orden es editable.</p>
            </div>
            <button (click)="showReorderModal.set(false)" class="p-2 hover:bg-white rounded-full transition-colors">
              <span class="text-2xl text-gray-400">×</span>
            </button>
          </div>

          <!-- Draggable List -->
          <div class="flex-1 overflow-y-auto p-6 bg-gray-50/30">
            <div cdkDropList 
                 (cdkDropListDropped)="drop($event)"
                 class="space-y-3">
              @for (p of reorderSlots(); track $index) {
                <div cdkDrag 
                     class="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm flex items-center gap-4 cursor-move hover:border-pink-300 transition-colors group">
                  <div class="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-xs font-bold text-pink-500 group-hover:bg-pink-100 group-hover:text-pink-700 transition-colors">
                    {{ $index + 1 }}
                  </div>
                  <div class="flex-1">
                    @if (p; as participant) {
                      <p class="font-semibold text-pink-950">{{ participant.customerName }}</p>
                      <p class="text-xs text-pink-500">
                        {{ participant.variant || 'Sin variante' }}
                        @if (participant.isDelivered) { · Entregado }
                      </p>
                    } @else {
                      <p class="font-semibold text-pink-400">Lugar disponible</p>
                      <p class="text-xs text-pink-300">Puedes mover este espacio entre participantes</p>
                    }
                  </div>
                  <div class="text-pink-300 group-hover:text-pink-500" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
                    </svg>
                  </div>

                  <!-- Placeholder while dragging -->
                  <div *cdkDragPlaceholder class="bg-pink-50 border-2 border-dashed border-pink-200 h-16 rounded-2xl"></div>
                </div>
              }
            </div>
          </div>

          <!-- Footer -->
          <div class="p-6 bg-white border-t flex gap-3">
            <button (click)="showReorderModal.set(false)" 
                    class="flex-1 px-6 py-3 border border-gray-200 text-gray-600 rounded-2xl hover:bg-gray-50 font-semibold transition-all">
              Cancelar
            </button>
            <button (click)="onSaveReorder()" 
                    [disabled]="isSavingReorder()"
                    class="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl hover:shadow-lg hover:scale-[1.02] active:scale-95 font-semibold transition-all disabled:opacity-50 disabled:scale-100">
              @if (isSavingReorder()) {
                <span>Guardando...</span>
              } @else {
                <span>Guardar Nuevo Orden</span>
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: []
})
export class TandaDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private tandaService = inject(TandaService);
  private apiService = inject(ApiService);
  private toastService = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  tanda = signal<TandaDto | null>(null);
  participants = signal<TandaParticipantDto[]>([]);
  weeksArray = signal<number[]>([]);
  sundayParticipant = signal<TandaParticipantDto | null>(null);
  loading = signal(true);
  viewMode = signal<'table' | 'visual'>('table');
  selectedWeekMobile = signal<number>(1);

  mobileWeekStats = computed(() => {
    const w = this.selectedWeekMobile();
    const parts = this.participants();
    let collected = 0;
    let paidCount = 0;
    for (const p of parts) {
      const paid = this.getWeekPaidAmount(p, w);
      collected += paid;
      if (paid >= this.getParticipantWeeklyAmount(p)) {
        paidCount++;
      }
    }
    return { collected, paidCount };
  });

  currentWeek = computed(() => {
    const t = this.tanda();
    if (!t || !t.startDate) return 0;

    // Parseamos la fecha ignorando zona horaria para consistencia con el backend
    const datePart = t.startDate.split('T')[0];
    const parts = datePart.split('-');
    const startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 0;
    // Lógica espejo del backend: El domingo es el cierre (día 7), el lunes cambia (día 8)
    return Math.floor((diffDays === 0 ? 0 : diffDays - 1) / 7) + 1;
  });

  getDeliveryDate(startDate: string, turn: number): Date {
    if (!startDate) return new Date();
    const datePart = startDate.split('T')[0];
    const parts = datePart.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    // Obtenemos la fecha base (inicio de la tanda)
    let date = new Date(year, month, day, 12, 0, 0);
    
    // Encontramos el domingo de esa misma semana (el primer domingo on or after startDate)
    // getDay(): 0=Sun, 1=Mon, ..., 6=Sat
    const daysToSunday = (7 - date.getDay()) % 7;
    date.setDate(date.getDate() + daysToSunday);
    
    // Ahora sumamos las semanas según el turno
    date.setDate(date.getDate() + (turn - 1) * 7);
    return date;
  }

  // Inscripción
  allClients = signal<ClientDto[]>([]);
  tandaProducts = signal<TandaProductDto[]>([]);
  clientSearch = signal('');
  showOnlyFrequent = signal(true);
  confirmingDelivery = signal<TandaParticipantDto | null>(null);
  addingToRoute = signal(false);
  showSuggestions = signal(false);
  selectedSuggestionIdx = signal(-1);
  selectedClient = signal<ClientDto | null>(null);
  enrollTurn = 1;
  enrollVariant = '';
  enrollWeeklyAmount?: number;
  enrollCurrency = 'MXN';
  enrollItemCost?: number;
  enrollExchangeRate?: number;
  isEnrolling = signal(false);

  // Reordenamiento y Sorteo
  showReorderModal = signal(false);
  reorderSlots = signal<Array<TandaParticipantDto | null>>([]);
  isSavingReorder = signal(false);

  showRoulette = signal(false);
  rouletteParticipants = signal<{ id: string, name: string }[]>([]);
  rouletteWinnerNames = signal<string[]>([]);
  rouletteTurnNumbers = signal<number[]>([]);

  @ViewChild(RaffleAnimationComponent) raffleComponent?: RaffleAnimationComponent;

  // Pago
  showPaymentModal = signal(false);
  isSavingPay = signal(false);
  activePayment = signal<{ participant: TandaParticipantDto, week: number } | null>(null);
  editingPaymentId = signal<string | null>(null);
  pendingDeletePaymentId = signal<string | null>(null);
  paymentForm = signal<PaymentForm>(this.createEmptyPaymentForm());

  paymentsForActiveWeek = computed(() => {
    const active = this.activePayment();
    if (!active) return [];
    return (active.participant.payments ?? [])
      .filter(payment => payment.weekNumber === active.week)
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  });

  // Edición
  showEditModal = signal(false);
  isUpdatingTanda = signal(false);
  editForm = signal<TandaEditForm>({
    productId: '',
    name: '',
    totalWeeks: 10,
    weeklyAmount: 0,
    penaltyAmount: 0,
    startDate: '',
    status: 'Active'
  });

  // Reordenamiento y Eliminación
  editingTurnId = signal<string | null>(null);
  editingVariantId = signal<string | null>(null);
  editVariantValue = '';
  isUpdatingVariant = signal(false);
  selectedParticipantActions = signal<TandaParticipantDto | null>(null);
  showRemoveConfirm = signal<TandaParticipantDto | null>(null);
  editingParticipant = signal<TandaParticipantDto | null>(null);
  isUpdatingParticipant = signal(false);
  editParticipantClientSearch = signal('');
  showEditParticipantSuggestions = signal(false);
  participantForm = signal<ParticipantForm>({
    customerId: 0,
    assignedTurn: 1,
    variant: '',
    weeklyAmount: undefined,
    status: 'Active',
    isDelivered: false,
    deliveryDate: ''
  });

  filteredEditParticipantClients = computed(() => {
    const s = this.editParticipantClientSearch().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const clients = this.allClients();
    if (!s) return clients.slice(0, 10);
    return clients.filter(cl => {
      const name = (cl.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const phone = cl.phone || '';
      return name.includes(s) || phone.includes(s);
    }).slice(0, 12);
  });

  filteredClientsSearch = computed(() => {
    const s = this.clientSearch().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const frequentOnly = this.showOnlyFrequent();
    const clients = this.allClients();

    return clients.filter(c => {
      const clientName = c.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
      const matchesSearch = !s || clientName.includes(s);
      const isFrequent = (c.ordersCount && c.ordersCount >= 1) || c.type === 'Frecuente';

      return matchesSearch && (!frequentOnly || isFrequent);
    }).slice(0, 10);
  });

  ngOnInit() {
    this.route.params
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => this.loadTanda(params['id']));
    this.loadAllClients();
    this.loadTandaProducts();
  }

  loadAllClients() {
    this.apiService.getClients().subscribe({
      next: (data) => this.allClients.set(data),
      error: () => console.error('Error loading clients for search')
    });
  }

  loadTanda(id: string) {
    this.loading.set(true);
    this.tandaService.getTanda(id).subscribe({
      next: (data) => {
        this.tanda.set(data);
        if (data.participants) {
          this.participants.set([...data.participants].sort((a, b) => a.assignedTurn - b.assignedTurn));
        }
        this.weeksArray.set(Array.from({ length: data.totalWeeks }, (_, i) => i + 1));
        const cw = this.currentWeek();
        if (cw > 0 && cw <= data.totalWeeks) {
          this.selectedWeekMobile.set(cw);
        }
        this.loading.set(false);

        this.tandaService.getSundayDelivery(id).subscribe({
          next: (p) => this.sundayParticipant.set(p),
          error: () => this.sundayParticipant.set(null)
        });
      },
      error: () => {
        this.loading.set(false);
        this.toastService.error('Tanda no encontrada o error de servidor 😿');
      }
    });
  }

  prevSelectedWeek() {
    this.selectedWeekMobile.update(w => Math.max(1, w - 1));
  }

  nextSelectedWeek() {
    const total = this.tanda()?.totalWeeks ?? 52;
    this.selectedWeekMobile.update(w => Math.min(total, w + 1));
  }

  hasPaid(participant: TandaParticipantDto, week: number): boolean {
    return this.getWeekPaidAmount(participant, week) >= this.getParticipantWeeklyAmount(participant);
  }

  getWeekPaidAmount(participant: TandaParticipantDto, week: number): number {
    return getVerifiedWeekPaidAmount(participant.payments, week);
  }

  getParticipantWeeklyAmount(p: TandaParticipantDto): number {
    return p.weeklyAmount ?? this.tanda()?.weeklyAmount ?? 0;
  }

  onClientSearch(term: string) {
    this.clientSearch.set(term);
    this.showSuggestions.set(true);
  }

  hideSuggestionsWithDelay() {
    setTimeout(() => this.showSuggestions.set(false), 200);
  }

  onClientKeydown(event: KeyboardEvent) {
    const list = this.filteredClientsSearch();
    if (!this.showSuggestions() || list.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedSuggestionIdx.update(i => (i + 1) % list.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedSuggestionIdx.update(i => (i <= 0 ? list.length - 1 : i - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const idx = this.selectedSuggestionIdx();
      if (idx >= 0) {
        this.selectClientToEnroll(list[idx]);
      }
    } else if (event.key === 'Escape') {
      this.showSuggestions.set(false);
    }
  }

  onShuffle() {
    const participants = [...this.participants()]
      .sort((a, b) => a.assignedTurn - b.assignedTurn);

    if (participants.length === 0) {
      this.toastService.error('La tanda no tiene lugares asignados');
      return;
    }

    this.rouletteParticipants.set(participants.map(p => ({ id: p.id, name: p.customerName || 'Participante' })));
    this.rouletteWinnerNames.set(participants.map(p => p.customerName || 'Participante'));
    this.rouletteTurnNumbers.set(participants.map(p => p.assignedTurn));
    this.showRoulette.set(true);
  }

  loadTandaProducts() {
    this.tandaService.getTandaProducts().subscribe({
      next: products => this.tandaProducts.set(products),
      error: () => this.toastService.error('No se pudo cargar el catálogo de productos')
    });
  }

  handleRouletteStart() {
    const winnerNames = this.rouletteWinnerNames();
    if (winnerNames.length > 0) {
      this.raffleComponent?.setWinnerAndStart(winnerNames);
    }
  }

  openReorderModal() {
    this.reorderSlots.set(buildTandaSlots(
      this.participants(),
      this.tanda()?.totalWeeks ?? 0
    ));
    this.showReorderModal.set(true);
  }

  drop(event: CdkDragDrop<Array<TandaParticipantDto | null>>) {
    const list = [...this.reorderSlots()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.reorderSlots.set(list);
  }

  onSaveReorder() {
    const t = this.tanda();
    if (t && !this.isSavingReorder()) {
      this.isSavingReorder.set(true);
      const assignments = buildPlaceAssignments(this.reorderSlots());
      this.tandaService.updatePlaces(t.id, assignments).subscribe({
        next: () => {
          this.toastService.success('Orden actualizado con éxito ✨');
          this.showReorderModal.set(false);
          this.loadTanda(t.id);
          this.isSavingReorder.set(false);
        },
        error: (err) => {
          this.isSavingReorder.set(false);
          this.toastService.error(err.error?.message || 'Error al reordenar');
        }
      });
    }
  }

  selectClientToEnroll(client: ClientDto) {
    this.selectedClient.set(client);
    this.clientSearch.set('');
    this.showSuggestions.set(false);
    this.selectedSuggestionIdx.set(-1);
    this.enrollTurn = this.findFirstAvailableTurn();
    this.enrollVariant = '';
    this.enrollWeeklyAmount = undefined;
  }

  onAddParticipant() {
    const t = this.tanda();
    const sc = this.selectedClient();
    if (t && sc && !this.isEnrolling()) {
      this.isEnrolling.set(true);
      this.tandaService.addParticipant({
        tandaId: t.id,
        customerId: sc.id,
        assignedTurn: this.enrollTurn,
        variant: this.enrollVariant,
        weeklyAmount: this.enrollWeeklyAmount || undefined,
        currency: this.enrollCurrency || undefined,
        itemCost: this.enrollItemCost || undefined,
        exchangeRate: this.enrollExchangeRate || undefined
      }).subscribe({
        next: () => {
          this.toastService.success(`${sc.name} inscrita con éxito ✨`);
          this.loadTanda(t.id);
          this.selectedClient.set(null);
          this.enrollVariant = '';
          this.enrollWeeklyAmount = undefined;
          this.enrollItemCost = undefined;
          this.enrollExchangeRate = undefined;
          this.isEnrolling.set(false);
        },
        error: (err) => {
          this.isEnrolling.set(false);
          this.toastService.error(err.error?.message || 'Error al inscribir clienta');
        }
      });
    }
  }

  onProcessPenalties() {
    const t = this.tanda();
    if (t) {
      this.tandaService.processPenalties(t.id).subscribe({
        next: (res) => {
          this.toastService.info(res.message);
          this.loadTanda(t.id);
        },
        error: (err) => this.toastService.error(err.error?.message || 'Error al procesar penalizaciones')
      });
    }
  }

  onCopyLink(token: string | undefined) {
    if (!token) return;
    const url = `${window.location.origin}/tanda-view/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      this.toastService.success('¡Enlace copiado al portapapeles! 🎀');
    });
  }

  openPaymentModal(participant: TandaParticipantDto, week: number) {
    this.activePayment.set({ participant, week });
    const remaining = Math.max(
      0,
      this.getParticipantWeeklyAmount(participant) - this.getWeekPaidAmount(participant, week)
    );
    this.paymentForm.set({
      ...this.createEmptyPaymentForm(),
      amountPaid: remaining || this.getParticipantWeeklyAmount(participant)
    });
    this.editingPaymentId.set(null);
    this.pendingDeletePaymentId.set(null);
    this.showPaymentModal.set(true);
    this.isSavingPay.set(false);
  }

  editPayment(payment: TandaPaymentDto) {
    this.editingPaymentId.set(payment.id);
    this.pendingDeletePaymentId.set(null);
    this.paymentForm.set({
      amountPaid: payment.amountPaid,
      penaltyPaid: payment.penaltyPaid,
      paymentDate: this.toDateTimeLocal(payment.paymentDate),
      isVerified: payment.isVerified,
      notes: payment.notes ?? ''
    });
  }

  cancelPaymentEdit() {
    const active = this.activePayment();
    this.editingPaymentId.set(null);
    this.pendingDeletePaymentId.set(null);
    this.paymentForm.set({
      ...this.createEmptyPaymentForm(),
      amountPaid: active ? this.getParticipantWeeklyAmount(active.participant) : 0
    });
  }

  confirmPayment() {
    const pay = this.activePayment();
    const t = this.tanda();
    if (pay && t && !this.isSavingPay()) {
      const form = this.paymentForm();
      if (form.amountPaid <= 0) {
        this.toastService.error('Captura un monto mayor a cero');
        return;
      }

      this.isSavingPay.set(true);
      const editingId = this.editingPaymentId();
      const request = editingId
        ? this.tandaService.updatePayment(editingId, {
            weekNumber: pay.week,
            amountPaid: form.amountPaid,
            penaltyPaid: form.penaltyPaid,
            paymentDate: new Date(form.paymentDate).toISOString(),
            isVerified: form.isVerified,
            notes: form.notes.trim() || undefined
          })
        : this.tandaService.registerPayment({
        participantId: pay.participant.id,
        weekNumber: pay.week,
            amountPaid: form.amountPaid,
            penaltyPaid: form.penaltyPaid,
            paymentDate: new Date(form.paymentDate).toISOString(),
            isVerified: form.isVerified,
            notes: form.notes.trim() || undefined
          });

      request.subscribe({
        next: () => {
          this.toastService.success(editingId ? 'Abono actualizado' : 'Abono registrado correctamente');
          this.showPaymentModal.set(false);
          this.loadTanda(t.id);
          this.isSavingPay.set(false);
        },
        error: (err) => {
          this.isSavingPay.set(false);
          this.toastService.error(err.error?.message || 'Error de pago. Solo Viernes/Sábado.');
        }
      });
    }
  }

  openEditModal() {
    const t = this.tanda();
    if (t) {
      this.editForm.set({
        productId: t.productId,
        name: t.name,
        totalWeeks: t.totalWeeks,
        weeklyAmount: t.weeklyAmount,
        penaltyAmount: t.penaltyAmount || 0,
        startDate: t.startDate.split('T')[0],
        currency: t.currency || 'MXN',
        itemCost: t.itemCost,
        exchangeRate: t.exchangeRate,
        status: t.status
      });
      this.showEditModal.set(true);
    }
  }

  onUpdateTanda() {
    const t = this.tanda();
    if (t && !this.isUpdatingTanda()) {
      this.isUpdatingTanda.set(true);
      this.tandaService.updateTanda(t.id, this.editForm()).subscribe({
        next: () => {
          this.toastService.success('Tanda actualizada con éxito ✨');
          this.showEditModal.set(false);
          this.loadTanda(t.id);
          this.isUpdatingTanda.set(false);
        },
        error: (err) => {
          this.isUpdatingTanda.set(false);
          this.toastService.error(err.error?.message || 'Error al actualizar la tanda');
        }
      });
    }
  }

  onUpdateTurn(p: TandaParticipantDto, event: Event) {
    const input = event.target as HTMLInputElement;
    const newTurn = Number.parseInt(input.value, 10);
    if (isNaN(newTurn) || newTurn === p.assignedTurn) {
      this.editingTurnId.set(null);
      return;
    }

    this.tandaService.updateParticipantTurn(p.id, newTurn).subscribe({
      next: () => {
        this.toastService.success('Turno actualizado ✨');
        this.editingTurnId.set(null);
        this.loadTanda(p.tandaId);
      },
      error: (err) => {
        this.editingTurnId.set(null);
        this.toastService.error(err.error?.message || 'Error al cambiar turno');
      }
    });
  }

  onUpdateVariant(participantId: string) {
    if (!this.editVariantValue.trim()) {
      this.editingVariantId.set(null);
      return;
    }

    this.isUpdatingVariant.set(true);
    this.tandaService.updateParticipantVariant(participantId, this.editVariantValue).subscribe({
      next: () => {
        this.toastService.success('Variante actualizada ✨');
        this.editingVariantId.set(null);
        this.editVariantValue = '';
        this.isUpdatingVariant.set(false);
        const t = this.tanda();
        if (t) this.loadTanda(t.id);
      },
      error: (err) => {
        this.isUpdatingVariant.set(false);
        this.toastService.error(err.error?.message || 'Error al actualizar variante');
      }
    });
  }

  onConfirmSundayDelivery(p: TandaParticipantDto) {
    this.confirmingDelivery.set(p);
  }

  addToSundayRoute(p: TandaParticipantDto) {
    if (this.addingToRoute()) return;
    this.addingToRoute.set(true);

    // Busca una ruta Pending existente. Si hay, agregamos ahí.
    // Si no hay, creamos una ruta nueva con solo esta tanda.
    this.apiService.getRoutes().subscribe({
      next: (routes) => {
        const pendingRoute = routes.find(r => r.status === 'Pending');
        if (pendingRoute) {
          this.apiService.addTandaToRoute(pendingRoute.id, p.id).subscribe({
            next: () => {
              this.addingToRoute.set(false);
              this.toastService.success(`✨ ${p.customerName} agregada a la ruta del domingo`);
            },
            error: (err) => {
              this.addingToRoute.set(false);
              this.toastService.error(err.error?.message || 'No se pudo agregar a la ruta');
            }
          });
        } else {
          this.apiService.createRoute([], false, [p.id]).subscribe({
            next: (res) => {
              this.addingToRoute.set(false);
              if (res.skipped && res.skipped.length > 0) {
                this.toastService.error(res.skipped[0].reason);
              } else {
                this.toastService.success(`✨ Ruta del domingo creada con ${p.customerName}`);
              }
            },
            error: (err) => {
              this.addingToRoute.set(false);
              this.toastService.error(err.error?.message || 'No se pudo crear la ruta');
            }
          });
        }
      },
      error: () => {
        this.addingToRoute.set(false);
        this.toastService.error('No se pudieron cargar las rutas');
      }
    });
  }

  confirmDelivery(p: TandaParticipantDto) {
    this.confirmingDelivery.set(null);
    this.tandaService.confirmParticipantDelivery(p.id).subscribe({
      next: () => {
        this.toastService.success('¡Entrega confirmada con éxito! ✨');
        this.loadTanda(p.tandaId);

        // FEATURE: CAMI Audio Announcement
        this.apiService.getAICamiMessage(`Anuncia con mucha alegría que la clienta ${p.customerName} ha recibido su producto de la tanda hoy.`).subscribe((res: CamiChatResponse) => {
          if (res.audioBase64) {
            const audio = new Audio('data:audio/mp3;base64,' + res.audioBase64);
            audio.play();
          }
        });
      },
      error: (err) => this.toastService.error(err.error?.message || 'Error al confirmar entrega')
    });
  }

  onRemoveParticipant(p: TandaParticipantDto) {
    this.showRemoveConfirm.set(p);
  }

  confirmRemoveParticipant(p: TandaParticipantDto) {
    this.tandaService.removeParticipant(p.id).subscribe({
      next: () => {
        this.toastService.success('Participante retirada con éxito ✨');
        this.showRemoveConfirm.set(null);
        this.loadTanda(p.tandaId);
      },
      error: (err) => {
        const errorMsg = err.error?.message || err.message || 'Error desconocido al eliminar';
        this.toastService.error(`No se pudo eliminar: ${errorMsg} 😿`);
      }
    });
  }

  onRemovePayment(participant: TandaParticipantDto, week: number) {
    this.openPaymentModal(participant, week);
  }

  requestDeletePayment(paymentId: string) {
    if (this.pendingDeletePaymentId() !== paymentId) {
      this.pendingDeletePaymentId.set(paymentId);
      return;
    }

    this.tandaService.deletePayment(paymentId).subscribe({
      next: () => {
        this.toastService.success('Pago eliminado');
        this.showPaymentModal.set(false);
        const tanda = this.tanda();
        if (tanda) this.loadTanda(tanda.id);
      },
      error: err => this.toastService.error(err.error?.message || 'Error al eliminar pago')
    });
  }

  onEditParticipantSearch(term: string) {
    this.editParticipantClientSearch.set(term);
    this.showEditParticipantSuggestions.set(true);
  }

  selectClientForEditParticipant(client: ClientDto) {
    this.participantForm.update(form => ({ ...form, customerId: client.id }));
    this.editParticipantClientSearch.set(client.name);
    this.showEditParticipantSuggestions.set(false);
  }

  hideEditParticipantSuggestionsWithDelay() {
    setTimeout(() => this.showEditParticipantSuggestions.set(false), 250);
  }

  openParticipantEditor(participant: TandaParticipantDto) {
    this.editingParticipant.set(participant);
    this.editParticipantClientSearch.set(participant.customerName || '');
    this.showEditParticipantSuggestions.set(false);
    this.participantForm.set({
      customerId: participant.customerId,
      assignedTurn: participant.assignedTurn,
      variant: participant.variant ?? '',
      weeklyAmount: participant.weeklyAmount,
      currency: participant.currency ?? '',
      itemCost: participant.itemCost,
      exchangeRate: participant.exchangeRate,
      status: participant.status,
      isDelivered: participant.isDelivered,
      deliveryDate: participant.deliveryDate?.split('T')[0] ?? ''
    });
    this.selectedParticipantActions.set(null);
  }

  saveParticipant() {
    const participant = this.editingParticipant();
    const tanda = this.tanda();
    if (!participant || !tanda || this.isUpdatingParticipant()) return;

    const form = this.participantForm();
    const dto: UpdateTandaParticipantDto = {
      customerId: form.customerId,
      assignedTurn: form.assignedTurn,
      variant: form.variant.trim() || undefined,
      weeklyAmount: form.weeklyAmount || undefined,
      currency: form.currency?.trim() || undefined,
      itemCost: form.itemCost || undefined,
      exchangeRate: form.exchangeRate || undefined,
      status: form.status,
      isDelivered: form.isDelivered,
      deliveryDate: form.isDelivered && form.deliveryDate
        ? new Date(`${form.deliveryDate}T12:00:00`).toISOString()
        : undefined
    };

    this.isUpdatingParticipant.set(true);
    this.tandaService.updateParticipant(participant.id, dto).subscribe({
      next: () => {
        this.toastService.success('Participante actualizada');
        this.editingParticipant.set(null);
        this.isUpdatingParticipant.set(false);
        this.loadTanda(tanda.id);
      },
      error: err => {
        this.isUpdatingParticipant.set(false);
        this.toastService.error(err.error?.message || 'No se pudo actualizar la participante');
      }
    });
  }

  setTandaStatus(status: TandaStatus) {
    const tanda = this.tanda();
    if (!tanda || this.isUpdatingTanda()) return;
    this.isUpdatingTanda.set(true);
    this.tandaService.updateTanda(tanda.id, {
      productId: tanda.productId,
      name: tanda.name,
      totalWeeks: tanda.totalWeeks,
      weeklyAmount: tanda.weeklyAmount,
      penaltyAmount: tanda.penaltyAmount,
      startDate: tanda.startDate,
      currency: tanda.currency,
      itemCost: tanda.itemCost,
      exchangeRate: tanda.exchangeRate,
      status
    }).subscribe({
      next: () => {
        this.isUpdatingTanda.set(false);
        this.toastService.success('Estado de la tanda actualizado');
        this.loadTanda(tanda.id);
      },
      error: err => {
        this.isUpdatingTanda.set(false);
        this.toastService.error(err.error?.message || 'No se pudo cambiar el estado');
      }
    });
  }

  private findFirstAvailableTurn(): number {
    const occupied = new Set(this.participants().map(participant => participant.assignedTurn));
    const totalWeeks = this.tanda()?.totalWeeks ?? 1;
    return Array.from({ length: totalWeeks }, (_, index) => index + 1)
      .find(turn => !occupied.has(turn)) ?? totalWeeks;
  }

  private createEmptyPaymentForm(): PaymentForm {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return {
      amountPaid: 0,
      penaltyPaid: 0,
      paymentDate: now.toISOString().slice(0, 16),
      isVerified: true,
      notes: ''
    };
  }

  private toDateTimeLocal(value: string): string {
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
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
}
