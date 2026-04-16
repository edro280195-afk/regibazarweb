import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TandaService } from '../../../core/services/tanda.service';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { TandaDto, TandaParticipantDto, ClientDto, CLIENT_TAG_LABELS } from '../../../core/models';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-tanda-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
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
                    <h3 class="text-2xl font-black text-pink-900 font-display">Entrega Dominical</h3>
                    @if (sundayParticipant(); as sp) {
                      <p class="text-pink-500 font-bold flex items-center gap-2 mt-1">
                        <span class="animate-pulse">💖</span> {{ sp.customerName }} recibe hoy
                      </p>
                      <div class="flex gap-2 mt-3">
                        <span class="px-3 py-1 bg-pink-100 text-pink-700 text-[10px] font-black rounded-lg uppercase tracking-wider">Turno #{{ sp.assignedTurn }}</span>
                        <span class="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg uppercase tracking-wider">Entrega: Próx. Domingo</span>
                      </div>
                    } @else {
                      <p class="text-pink-400 italic mt-1 font-medium italic">Pendiente por asignar turno de entrega...</p>
                    }
                  </div>
                </div>
                
                @if (sundayParticipant()) {
                  <button class="btn-coquette btn-rose px-8 py-4 shadow-xl">Confirmar Entrega ✨</button>
                }
              </div>
            </div>

            <!-- Weekly Payments Table -->
            <div class="card-coquette p-6 border-pink-100/50">
              <div class="flex items-center justify-between mb-6">
                <h4 class="text-xs font-black text-pink-600 uppercase tracking-widest flex items-center gap-2">
                  <span>📅</span> Control Semanal de Abonos
                </h4>
                <div class="text-[10px] font-bold text-pink-400 bg-pink-50 px-3 py-1 rounded-full border border-pink-100">
                  Desliza horizontalmente ➜
                </div>
              </div>

              <div class="overflow-x-auto rounded-2xl border border-pink-50 shadow-inner scrollbar-hide">
                <table class="table-coquette w-full">
                  <thead>
                    <tr>
                      <th class="sticky left-0 z-20 bg-pink-50 shadow-[4px_0_8px_rgba(131,24,67,0.03)] min-w-[180px]">Clienta</th>
                      @for (w of weeksArray(); track w) {
                        <th class="text-center min-w-[75px]">Sem {{ w }}</th>
                      }
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
                            <!-- Botón de ajustes móvil -->
                            <button (click)="selectedParticipantActions.set(p)" 
                                    class="w-8 h-8 rounded-full bg-pink-50 text-pink-400 flex items-center justify-center text-xs hover:bg-pink-100 hover:text-pink-600 transition-all shrink-0">
                                ⚙️
                            </button>
                          </div>
                        </td>
                        @for (w of weeksArray(); track w) {
                          <td class="text-center p-2">
                            @if (hasPaid(p, w)) {
                              <span class="text-lg drop-shadow-sm animate-bounce-in inline-block" title="Pagado">💖</span>
                            } @else {
                              <button (click)="openPaymentModal(p, w)" 
                                      class="w-full py-1.5 rounded-lg border border-pink-50 text-[11px] font-black text-pink-300 hover:border-pink-300 hover:text-pink-600 hover:bg-white transition-all">
                                {{ t.weeklyAmount }}
                              </button>
                            }
                          </td>
                        }
                        <td class="text-center">
                          <input type="checkbox" [checked]="p.isDelivered" class="w-4 h-4 rounded border-pink-200 text-pink-500 focus:ring-pink-300">
                        </td>
                        <td class="text-center">
                          @if (p.variant) {
                            <span class="text-[10px] font-black text-pink-500 uppercase bg-pink-50 px-2 py-1 rounded-lg border border-pink-100">{{ p.variant }}</span>
                          } @else {
                            <span class="text-pink-200 opacity-30 italic text-[10px]">-</span>
                          }
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
                🎲 Sorteo Aleatorio
              </button>
              <button class="btn-coquette btn-outline-pink w-full justify-center text-[10px] py-3 font-black shadow-sm" (click)="onProcessPenalties()">
                ⚠️ Procesar Retrasos
              </button>
              <button class="bg-rose-50 border border-rose-100 text-rose-300 hover:text-rose-600 hover:bg-rose-100/50 rounded-3xl w-full py-3 text-[10px] font-black transition-all">
                🚫 Cancelar Tanda
              </button>
            </div>
          </div>
        </div>
      }
      
      <!-- PAYMENT MODAL -->
      @if (showPaymentModal()) {
        <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div class="absolute inset-0 bg-pink-900/30 backdrop-blur-md" (click)="showPaymentModal.set(false)"></div>
          <div class="card-coquette bg-white p-8 w-full max-sm relative z-10 animate-scale-in">
             <h3 class="text-xl font-black text-pink-900 mb-6 flex items-center gap-2">
                <span class="text-2xl animate-heartbeat">💖</span> Registrar Abono
             </h3>
             
             <div class="bg-gradient-to-br from-pink-50 to-rose-50 rounded-3xl p-6 border border-pink-100 text-center mb-8">
                <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-1"> Participante </p>
                <p class="text-lg font-black text-pink-900 mb-4">{{ activePayment()?.participant?.customerName }}</p>
                
                <div class="flex items-end justify-center gap-1">
                  <p class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-500 font-display">
                    {{ tanda()?.weeklyAmount | currency:'MXN':'symbol-narrow':'1.0-0' }}
                  </p>
                  <span class="text-pink-400 text-[10px] font-medium uppercase mb-2">/ Sem {{ activePayment()?.week }}</span>
                </div>
             </div>

             <div class="flex gap-4">
                <button (click)="showPaymentModal.set(false)" class="btn-coquette btn-ghost flex-1 justify-center">Regresar</button>
                <button (click)="confirmPayment()" [disabled]="isSavingPay()" class="btn-coquette btn-pink flex-1 justify-center shadow-lg">
                   @if (isSavingPay()) { <span class="animate-spin italic">⌛</span> } @else { Confirmar 💖 }
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
               
               <div>
                 <label class="text-[10px] font-black text-pink-400 uppercase mb-1 block">Semanas Totales</label>
                 <input type="number" [(ngModel)]="editForm().totalWeeks" class="input-coquette py-2" />
               </div>
               
               <div>
                 <label class="text-[10px] font-black text-pink-400 uppercase mb-1 block">Fecha de Inicio</label>
                 <input type="date" [(ngModel)]="editForm().startDate" class="input-coquette py-2" />
               </div>
               
               <div>
                 <label class="text-[10px] font-black text-pink-400 uppercase mb-1 block">Monto Semanal</label>
                 <input type="number" [(ngModel)]="editForm().weeklyAmount" class="input-coquette py-2" />
               </div>
               
               <div>
                 <label class="text-[10px] font-black text-pink-400 uppercase mb-1 block">Penalización</label>
                 <input type="number" [(ngModel)]="editForm().penaltyAmount" class="input-coquette py-2" />
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
        <div class="fixed inset-0 z-[110] flex items-end justify-center sm:items-center p-0 sm:p-4 animate-fade-in">
          <div class="absolute inset-0 bg-pink-900/20 backdrop-blur-sm" (click)="selectedParticipantActions.set(null)"></div>
          <div class="bg-white w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 relative z-10 animate-slide-up shadow-2xl border-t border-pink-100">
             <div class="w-12 h-1.5 bg-pink-100 rounded-full mx-auto mb-6 sm:hidden"></div>
             
             <div class="text-center mb-8">
               <div class="w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-400 rounded-3xl mx-auto flex items-center justify-center text-white text-2xl shadow-lg mb-4">
                  {{ p.customerName?.charAt(0) }}
               </div>
               <h3 class="text-xl font-black text-pink-900">{{ p.customerName }}</h3>
               <p class="text-xs font-bold text-pink-400 uppercase tracking-widest mt-1">Turno #{{ p.assignedTurn }}</p>
             </div>

             <div class="space-y-3">
                <button (click)="editingTurnId.set(p.id); selectedParticipantActions.set(null)" 
                        class="w-full py-4 bg-pink-50 hover:bg-pink-100 text-pink-600 font-black rounded-2xl flex items-center justify-center gap-3 transition-all border border-pink-100">
                  <span class="text-lg">🔢</span> Cambiar Turno
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
    </div>
  `,
  styles: []
})
export class TandaDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private tandaService = inject(TandaService);
  private apiService = inject(ApiService);
  private toastService = inject(ToastService);

  tanda = signal<TandaDto | null>(null);
  participants = signal<TandaParticipantDto[]>([]);
  weeksArray = signal<number[]>([]);
  sundayParticipant = signal<TandaParticipantDto | null>(null);
  loading = signal(true);

  // Inscripción
  allClients = signal<ClientDto[]>([]);
  clientSearch = signal('');
  showOnlyFrequent = signal(true);
  showSuggestions = signal(false);
  selectedSuggestionIdx = signal(-1);
  selectedClient = signal<ClientDto | null>(null);
  enrollTurn = 1;
  enrollVariant = '';
  isEnrolling = signal(false);

  // Pago
  showPaymentModal = signal(false);
  isSavingPay = signal(false);
  activePayment = signal<{participant: TandaParticipantDto, week: number} | null>(null);

  // Edición
  showEditModal = signal(false);
  isUpdatingTanda = signal(false);
  editForm = signal({
    name: '',
    totalWeeks: 10,
    weeklyAmount: 0,
    penaltyAmount: 0,
    startDate: ''
  });

  // Reordenamiento y Eliminación
  editingTurnId = signal<string | null>(null);
  editingVariantId = signal<string | null>(null);
  editVariantValue = '';
  isUpdatingVariant = signal(false);
  selectedParticipantActions = signal<TandaParticipantDto | null>(null);
  showRemoveConfirm = signal<TandaParticipantDto | null>(null);

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
    this.route.params.subscribe(params => {
      this.loadTanda(params['id']);
    });
    this.loadAllClients();
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
          this.participants.set([...data.participants].sort((a,b) => a.assignedTurn - b.assignedTurn));
        }
        this.weeksArray.set(Array.from({length: data.totalWeeks}, (_, i) => i + 1));
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

  hasPaid(participant: TandaParticipantDto, week: number): boolean {
    return participant.payments?.some(p => p.weekNumber === week) || false;
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
    const t = this.tanda();
    if (t) {
      if (confirm('¿Estás segura de sortear los lugares? Esta acción no se puede deshacer. 🎲')) {
        this.tandaService.shuffleParticipants(t.id).subscribe({
          next: (res) => {
            this.toastService.success(res.message);
            this.loadTanda(t.id);
          },
          error: (err) => this.toastService.error(err.error?.message || 'Error al realizar el sorteo')
        });
      }
    }
  }

  selectClientToEnroll(client: ClientDto) {
    this.selectedClient.set(client);
    this.clientSearch.set('');
    this.showSuggestions.set(false);
    this.selectedSuggestionIdx.set(-1);
    this.enrollTurn = this.participants().length + 1;
    this.enrollVariant = '';
  }

  onAddParticipant() {
    const t = this.tanda();
    const sc = this.selectedClient();
    if (t && sc && !this.isEnrolling()) {
      this.isEnrolling.set(true);
      this.tandaService.addParticipant({
        tandaId: t.id,
        customerId: sc.id.toString(),
        assignedTurn: this.enrollTurn,
        variant: this.enrollVariant
      }).subscribe({
        next: () => {
          this.toastService.success(`${sc.name} inscrita con éxito ✨`);
          this.loadTanda(t.id);
          this.selectedClient.set(null);
          this.enrollVariant = '';
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
    this.activePayment.set({participant, week});
    this.showPaymentModal.set(true);
    this.isSavingPay.set(false);
  }

  confirmPayment() {
    const pay = this.activePayment();
    const t = this.tanda();
    if (pay && t && !this.isSavingPay()) {
      this.isSavingPay.set(true);
      this.tandaService.registerPayment({
        participantId: pay.participant.id,
        weekNumber: pay.week,
        amountPaid: t.weeklyAmount
      }).subscribe({
        next: () => {
          this.toastService.success('Abono registrado correctamente 💅');
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
        name: t.name,
        totalWeeks: t.totalWeeks,
        weeklyAmount: t.weeklyAmount,
        penaltyAmount: t.penaltyAmount || 0,
        startDate: new Date(t.startDate).toISOString().split('T')[0]
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

  onUpdateTurn(p: TandaParticipantDto, event: any) {
    const newTurn = parseInt(event.target.value);
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
}
