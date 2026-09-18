import { Component, inject, signal, OnInit, HostListener, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TandaService } from '../../../core/services/tanda.service';
import { ToastService } from '../../../core/services/toast.service';
import { ApiService } from '../../../core/services/api.service';
import { environment } from '../../../../environments/environment';
import { gsap } from 'gsap';
import { TandaPaymentProofPublicDto, TandaViewDto, TandaParticipantPublicViewDto } from '../../../core/models';

const BASE_MESSENGER_URL = 'https://m.me/regi.bazar.852309';

@Component({
  selector: 'app-tanda-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative min-h-screen overflow-hidden bg-gradient-to-b from-pink-50 via-rose-50 to-purple-50 pb-24 font-sans text-stone-800"
         (scroll)="onScroll($event)">
      
      <!-- Parallax Background Layers -->
      <div class="fixed inset-0 pointer-events-none z-0">
        <div class="absolute inset-0 opacity-40 transition-transform duration-75 ease-out"
             [style.transform]="'translateY(' + scrollY() * 0.1 + 'px)'">
          <div class="absolute top-[10%] left-[5%] text-4xl animate-pulse-slow">✨</div>
          <div class="absolute top-[40%] right-[10%] text-5xl opacity-50">🌸</div>
          <div class="absolute top-[75%] left-[15%] text-4xl animate-float">🎀</div>
        </div>
        <div class="absolute inset-0 opacity-60 transition-transform duration-75 ease-out"
             [style.transform]="'translateY(' + scrollY() * 0.25 + 'px)'">
          <div class="absolute top-[20%] right-[15%] text-3xl animate-float-delayed">💖</div>
          <div class="absolute top-[60%] left-[8%] text-5xl">✨</div>
          <div class="absolute top-[85%] right-[20%] text-3xl animate-bounce-slow">🌷</div>
        </div>
      </div>

      <div class="relative z-10 max-w-md mx-auto p-4 sm:p-6 pt-10 space-y-8">
        
        @if (loading()) {
          <div class="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div class="w-12 h-12 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin mb-4"></div>
            <p class="text-pink-600 font-medium animate-pulse Irish Grover">Cargando tu tanda... 🎀</p>
          </div>
        } @else if (error()) {
          <div class="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
            <span class="text-6xl mb-4 drop-shadow-md">🔍</span>
            <h2 class="text-2xl font-black text-pink-900 mb-2 font-display">Tanda no encontrada</h2>
            <p class="text-pink-600 px-4">Verifica que el enlace sea correcto, hermosa 💖</p>
          </div>
        } @else if (tanda(); as t) {
          
          <!-- Header Hero -->
          <div class="text-center animate-slide-down relative mb-8">
             <div class="text-5xl mb-2 animate-wiggle inline-block drop-shadow-sm">🎀</div>
             <h1 class="text-3xl font-black text-pink-600 tracking-tight font-display mb-1">
               {{ t.name }}
             </h1>
             <p class="text-rose-500 font-medium text-sm">
                ¡Creciendo juntas en grupo! ✨
             </p>
          </div>

          <!-- Sticky Nav Tabs -->
          <div id="nav-tabs" class="flex p-1.5 bg-white/60 backdrop-blur-xl rounded-[2rem] mb-8 border border-white sticky top-4 z-30 shadow-sm">
            <button class="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all duration-300" 
                    [ngClass]="activeTab() === 'summary' ? 'bg-white text-pink-600 shadow-sm scale-105' : 'text-pink-300'" 
                    (click)="activeTab.set('summary')">
              <span class="text-lg">🌸</span>
              <span class="text-[10px] font-black uppercase tracking-widest">Mi Tanda</span>
            </button>
            <button class="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all duration-300" 
                    [ngClass]="activeTab() === 'transparency' ? 'bg-white text-pink-600 shadow-sm scale-105' : 'text-pink-300'" 
                    (click)="activeTab.set('transparency')">
              <span class="text-lg">💎</span>
              <span class="text-[10px] font-black uppercase tracking-widest">Grupo</span>
            </button>
          </div>

          @if (activeTab() === 'summary') {
            <!-- ════════════ TAB: MI TANDA (RESUMEN) ════════════ -->
            <div class="animate-fade-in-up space-y-8">
              
              <!-- Weekly Progress Card -->
              <div class="card-coquette bg-white/90 p-6 shadow-xl border-pink-100 flex flex-col items-center text-center">
                <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-4">Estado de la Tanda</p>
                
                <div class="relative w-32 h-32 flex items-center justify-center mb-4">
                  <svg class="w-full h-full -rotate-90">
                    <circle cx="64" cy="64" r="58" stroke="currentColor" stroke-width="8" fill="transparent" class="text-pink-50" />
                    <circle cx="64" cy="64" r="58" stroke="currentColor" stroke-width="8" fill="transparent" 
                            class="text-pink-500 transition-all duration-1000"
                            [attr.stroke-dasharray]="364.4"
                            [attr.stroke-dashoffset]="364.4 - (364.4 * (t.currentWeek / t.totalWeeks))" />
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span class="text-3xl font-black text-pink-950 leading-none">{{ t.currentWeek }}</span>
                    <span class="text-[9px] font-bold text-pink-400 uppercase tracking-tighter">Semana</span>
                  </div>
                </div>

                <div class="space-y-1">
                  <p class="text-sm font-bold text-pink-900">
                    Semana <span class="text-pink-600">{{ t.currentWeek }}</span> de <span class="text-pink-600">{{ t.totalWeeks }}</span>
                  </p>
                  <div class="bg-pink-100/50 px-4 py-2 rounded-2xl flex items-center gap-2">
                    <span class="text-lg">💰</span>
                    <span class="text-xs font-black text-pink-700">Abono Semanal: {{ (t.currentParticipant?.weeklyAmount ?? t.weeklyAmount) | currency:'MXN':'symbol-narrow':'1.0-0' }}</span>
                  </div>
                </div>
              </div>

              <!-- Delivery Turn Hero -->
              @if (isWinnerThisWeek()) {
                <div class="bg-gradient-to-br from-pink-500 to-rose-500 rounded-[2.5rem] p-8 text-white text-center shadow-xl animate-bounce-in relative overflow-hidden">
                   <div class="absolute -right-6 -top-6 text-7xl opacity-20 rotate-12">🎁</div>
                   <h3 class="text-xl font-bold uppercase tracking-widest mb-2 font-display">¡ES TU TURNO! ✨</h3>
                   <p class="text-xs font-medium opacity-90">Esta semana el producto es para ti. ¡Abre tu regalo de tanda! 💖</p>
                </div>
              }

              @if (t.currentParticipant; as me) {
                <section class="rounded-[2.5rem] border-2 border-pink-200 bg-white/95 p-6 shadow-xl shadow-pink-100/40 animate-fade-in-up space-y-5" aria-label="Enviar comprobante de pago">
                  <!-- Encabezado -->
                  <div class="flex items-start gap-3">
                    <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-rose-200 text-2xl shadow-inner">
                      📸
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-[10px] font-black uppercase tracking-widest text-pink-500">Tu comprobante</span>
                        <span class="rounded-full bg-pink-100 px-2 py-0.5 text-[9px] font-bold text-pink-700">Cualquier día ✨</span>
                      </div>
                      <h3 class="text-lg font-black text-pink-950 leading-tight mt-0.5">Sube tu comprobante de abono</h3>
                      <p class="mt-1 text-xs font-medium leading-relaxed text-pink-700">
                        Transfiere el día que prefieras, tómale foto a tu ticket y elígelo aquí. Nosotros validaremos tu pago con mucho cariño. 💕
                      </p>
                    </div>
                  </div>

                  @if (me.items && me.items.length > 0) {
                    <div class="mt-5 rounded-2xl border border-purple-100 bg-purple-50/60 p-4">
                      <p class="mb-2 text-[10px] font-black uppercase tracking-widest text-purple-600">Tus artículos</p>
                      <div class="space-y-2">
                        @for (item of me.items; track item.id) {
                          <div class="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs">
                            <span class="font-bold text-pink-900">{{ item.quantity }}× {{ item.productName }}{{ item.variant ? ' · ' + item.variant : '' }}</span>
                            <span class="shrink-0 font-black text-purple-700">{{ ((item.weeklyAmount ?? 0) * item.quantity) | currency:'MXN':'symbol-narrow':'1.0-0' }}/sem</span>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  @if (isAllWeeksPaid()) {
                    <!-- Estado: Tanda Liquidada 100% -->
                    <div class="rounded-3xl bg-gradient-to-br from-emerald-50 via-teal-50 to-white p-6 text-center border-2 border-emerald-200 shadow-sm space-y-2 animate-bounce-in">
                      <span class="text-4xl inline-block animate-wiggle">🎉🎀</span>
                      <h4 class="text-base font-black text-emerald-950">¡Tanda 100% Pagada!</h4>
                      <p class="text-xs font-medium text-emerald-700 leading-relaxed">
                        ¡Felicidades, hermosa! Has completado todas las semanas de esta tanda. Muchísimas gracias por tu confianza y cumplimiento. ✨
                      </p>
                    </div>
                  } @else {
                    <!-- Selector de Semana a Reportar -->
                    <div class="space-y-2 rounded-2xl bg-pink-50/70 p-4 border border-pink-100">
                      <div class="flex items-center justify-between gap-2">
                        <label for="proof-week-select" class="text-[10px] font-black uppercase tracking-widest text-pink-700 flex items-center gap-1.5">
                          <span>🗓️</span> ¿Qué semana estás pagando?
                        </label>
                        @if (selectedWeekStatus(); as status) {
                          <span class="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tight"
                                [ngClass]="status.badgeClass">
                            {{ status.badge }}
                          </span>
                        }
                      </div>

                      <div class="relative">
                        <select id="proof-week-select"
                                [ngModel]="selectedProofWeek()"
                                (ngModelChange)="selectWeekForProof($event)"
                                class="w-full appearance-none bg-white border-2 border-pink-200 rounded-2xl px-4 py-3 text-xs font-black text-pink-900 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200 transition-all cursor-pointer shadow-sm pr-10">
                          @for (opt of weekOptions(); track opt.week) {
                            <option [value]="opt.week">
                              {{ opt.label }}
                            </option>
                          }
                        </select>
                        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-pink-400">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                      </div>

                      <!-- Resumen de la Semana Seleccionada -->
                      <div class="flex items-center justify-between pt-1 px-1 text-xs">
                        <span class="text-[11px] font-bold text-pink-600">
                          Abono correspondiente:
                        </span>
                        <span class="font-black text-pink-950 text-sm">
                          {{ me.weeklyAmount | currency:'MXN':'symbol-narrow':'1.0-0' }}
                        </span>
                      </div>
                    </div>

                    <!-- Detalle de estado para la semana seleccionada -->
                    @if (selectedWeekStatus(); as status) {
                      @if (status.status === 'paid') {
                        <div class="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3.5 text-xs text-emerald-800 flex items-center gap-3">
                          <span class="text-2xl">✅</span>
                          <div>
                            <p class="font-black">Semana {{ status.week }} ya está liquidada</p>
                            <p class="mt-0.5 text-[11px] font-medium text-emerald-700">Tu pago de esta semana ya quedó registrado. Si deseas adelantar un abono futuro, selecciona otra semana arriba. 💕</p>
                          </div>
                        </div>
                      } @else if (status.status === 'pending_review') {
                        <div class="rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3.5 text-xs text-amber-800 space-y-1">
                          <div class="flex items-center gap-2">
                            <span class="text-base animate-pulse">⏳</span>
                            <p class="font-black">Comprobante en revisión para la Semana {{ status.week }}</p>
                          </div>
                          <p class="text-[11px] font-medium leading-relaxed pl-6 text-amber-700">
                            Ya tenemos tu foto y estamos revisándola. Te avisaremos en cuanto tu pago quede aplicado automáticamente. ¡Gracias por avisar, hermosa! 💖
                          </p>
                          @if (status.proof) {
                            <p class="text-[10px] font-bold text-amber-600 pl-6 pt-1">
                              Enviado: {{ status.proof.submittedAt | date:'dd MMM yyyy, HH:mm' }} · Monto: {{ status.proof.amountClaimed | currency:'MXN':'symbol-narrow':'1.0-0' }}
                            </p>
                          }
                        </div>
                      } @else {
                        <!-- Habilitado para subir comprobante (actual, atrasada, adelanto o rechazada) -->
                        @if (status.status === 'rejected') {
                          <div class="rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 space-y-1">
                            <p class="font-black flex items-center gap-1.5">
                              <span>💌</span> Necesitamos una nueva foto para la Semana {{ status.week }}
                            </p>
                            <p class="text-[11px] font-medium text-rose-700 pl-5">
                              Motivo: {{ status.proof?.rejectionReason || 'El comprobante previo no se pudo validar con claridad.' }}
                            </p>
                            <p class="text-[10px] font-bold text-rose-600 pl-5">
                              Toma una nueva foto nítida de tu comprobante a continuación 👇
                            </p>
                          </div>
                        }

                        <!-- Zona de Carga de Foto -->
                        <div class="space-y-3 pt-1">
                          @if (!proofPreviewUrl()) {
                            <div class="rounded-2xl border-2 border-dashed border-pink-300 bg-gradient-to-b from-pink-50/70 to-rose-50/40 p-4 transition-all">
                              <p class="mb-3 text-center text-[10px] font-black uppercase tracking-widest text-pink-500">
                                Adjuntar foto del comprobante
                              </p>
                              <div class="grid grid-cols-2 gap-3">
                                <label class="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl bg-white p-3 text-center text-[10px] font-black uppercase tracking-wide text-pink-600 shadow-sm border border-pink-100 hover:bg-pink-50 active:scale-95 transition-all">
                                  <span class="text-2xl">📷</span>
                                  <span>Tomar foto</span>
                                  <input type="file" class="hidden" accept="image/jpeg,image/png,image/webp" capture="environment" (change)="onProofSelected($event)">
                                </label>
                                <label class="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl bg-white p-3 text-center text-[10px] font-black uppercase tracking-wide text-pink-600 shadow-sm border border-pink-100 hover:bg-pink-50 active:scale-95 transition-all">
                                  <span class="text-2xl">🖼️</span>
                                  <span>Galería</span>
                                  <input type="file" class="hidden" accept="image/jpeg,image/png,image/webp" (change)="onProofSelected($event)">
                                </label>
                              </div>
                              <p class="mt-3 text-center text-[9px] font-bold text-pink-400">
                                Formatos permitidos: JPG, PNG, WEBP (hasta 8 MB)
                              </p>
                            </div>
                          } @else {
                            <!-- Vista previa de foto seleccionada -->
                            <div class="relative rounded-2xl border-2 border-pink-300 bg-white p-3 shadow-md space-y-2 animate-fade-in">
                              <div class="flex items-center justify-between gap-2 pb-1 border-b border-pink-100">
                                <span class="text-[10px] font-black uppercase tracking-wider text-pink-600 flex items-center gap-1.5">
                                  <span>✨</span> Vista previa de tu foto
                                </span>
                                <button type="button" (click)="clearSelectedProof()"
                                        class="rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 px-2.5 py-1 text-[10px] font-black transition-colors flex items-center gap-1"
                                        title="Quitar foto">
                                  <span>✕</span> Cambiar foto
                                </button>
                              </div>

                              <div class="relative max-h-52 overflow-hidden rounded-xl bg-pink-50 flex items-center justify-center border border-pink-100">
                                <img [src]="proofPreviewUrl()" alt="Comprobante seleccionado" class="max-h-52 w-full object-contain rounded-xl">
                              </div>

                              <div class="flex items-center justify-between text-[10px] text-pink-700 font-bold px-1">
                                <span class="truncate max-w-[200px]">{{ proofFileName() }}</span>
                                <span class="text-pink-500 font-black">Lista para enviar ✨</span>
                              </div>
                            </div>
                          }

                          @if (proofError()) {
                            <div class="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 animate-fade-in flex items-center gap-2">
                              <span>⚠️</span>
                              <span>{{ proofError() }}</span>
                            </div>
                          }

                          <button type="button"
                                  (click)="submitPaymentProof()"
                                  [disabled]="!proofFile() || proofUploading()"
                                  class="w-full rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-pink-200 hover:shadow-pink-300 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-2">
                            @if (proofUploading()) {
                              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>ENVIANDO COMPROBANTE... ✨</span>
                            } @else {
                              <span>ENVIAR COMPROBANTE (SEMANA {{ status.week }}) 💖</span>
                            }
                          </button>
                        </div>
                      }
                    }
                  }

                  <!-- Acordeón / Historial de Comprobantes de la Clienta -->
                  @if (me.paymentProofs && me.paymentProofs.length > 0) {
                    <div class="pt-3 border-t border-pink-100">
                      <button type="button"
                              (click)="showProofHistory.update(v => !v)"
                              class="w-full flex items-center justify-between text-left py-1 text-pink-700 hover:text-pink-950 transition-colors">
                        <span class="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                          <span>💌</span> Historial de comprobantes ({{ me.paymentProofs.length }})
                        </span>
                        <span class="text-xs font-black text-pink-400 transition-transform duration-300"
                              [class.rotate-180]="showProofHistory()">
                          ▼
                        </span>
                      </button>

                      @if (showProofHistory()) {
                        <div class="mt-3 space-y-2 animate-fade-in">
                          @for (p of me.paymentProofs; track p.id) {
                            <div class="rounded-xl border p-3 text-xs flex items-center justify-between gap-2"
                                 [ngClass]="p.status === 'Pending' ? 'border-amber-200 bg-amber-50/60' : p.status === 'Rejected' ? 'border-rose-200 bg-rose-50/60' : 'border-emerald-200 bg-emerald-50/60'">
                              <div class="min-w-0">
                                <p class="font-black text-pink-950">
                                  Semana {{ p.weekNumber }} · {{ p.amountClaimed | currency:'MXN':'symbol-narrow':'1.0-0' }}
                                </p>
                                @if (p.ocrAmount || p.depositDate) {
                                  <p class="text-[10px] font-bold text-pink-600 opacity-80">OCR: {{ p.ocrAmount || p.amountClaimed | currency:'MXN':'symbol-narrow':'1.2-2' }}{{ p.depositDate ? ' · ' + (p.depositDate | date:'dd/MM/yyyy HH:mm') : '' }}</p>
                                }
                                <p class="text-[10px] text-pink-600 font-medium">
                                  {{ p.submittedAt | date:'dd MMM yyyy, HH:mm' }}
                                  @if (p.rejectionReason) {
                                    <span class="block text-rose-700 font-bold mt-0.5">Motivo: {{ p.rejectionReason }}</span>
                                  }
                                </p>
                              </div>
                              <span class="shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-tight"
                                    [ngClass]="p.status === 'Pending' ? 'bg-amber-100 text-amber-800' : p.status === 'Rejected' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'">
                                {{ p.status === 'Pending' ? 'En revisión ⏳' : p.status === 'Rejected' ? 'Rechazado 💌' : 'Aprobado ✅' }}
                              </span>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }
                </section>
              }

              <!-- Payment Methods Section -->
              <div id="payment-methods" class="relative z-10">
                <h3 class="text-center text-pink-950 font-black text-lg font-display mb-1 flex items-center justify-center gap-2">
                  <span>💸</span> Formas de Pago
                </h3>
                <p class="text-center text-[10px] text-pink-700/70 font-bold uppercase tracking-widest mb-4">Toca para copiar los datos</p>

                <!-- Payment Tabs -->
                <div class="flex p-1 bg-white/50 backdrop-blur-md rounded-2xl mb-4 border border-white/50">
                  <button class="flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
                          [ngClass]="paymentTab() === 'card' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-400'"
                          (click)="setPaymentTab('card')">💳 Tarjeta</button>
                  <button class="flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
                          [ngClass]="paymentTab() === 'transfer' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-400'"
                          (click)="setPaymentTab('transfer')">🏦 Transfer</button>
                  <button class="flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
                          [ngClass]="paymentTab() === 'oxxo' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-400'"
                          (click)="setPaymentTab('oxxo')">🏪 OXXO</button>
                  <button class="flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
                          [ngClass]="paymentTab() === 'cash' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-400'"
                          (click)="setPaymentTab('cash')">💵 Cash</button>
                </div>

                <!-- Tab Content -->
                <div class="min-h-[160px]">
                  @switch (paymentTab()) {
                    @case ('card') {
                      <div class="bg-white/90 backdrop-blur-sm rounded-[2rem] p-6 border border-pink-100 shadow-xl animate-fade-in space-y-4">
                        
                        @if (!mpResult()) {
                          <div class="space-y-4">
                            <!-- Participant Selector -->
                            @if (!t.currentParticipant) {
                            <div class="space-y-2">
                              <label class="text-[10px] font-black text-pink-400 uppercase tracking-widest ml-2">¿Quién eres? ✨</label>
                              <select class="w-full bg-pink-50/50 border-2 border-pink-100 rounded-2xl px-4 py-3 text-sm font-bold text-pink-900 focus:outline-none focus:border-pink-300 transition-all"
                                      [(ngModel)]="selectedParticipantId">
                                <option [value]="null" disabled>Selecciona tu nombre...</option>
                                @for (p of t.participants; track p.id) {
                                  <option [value]="p.id">{{ p.name }} (Semana {{ p.assignedTurn }})</option>
                                }
                              </select>
                            </div>
                            } @else {
                              <div class="rounded-2xl bg-pink-50 px-4 py-3 text-xs font-bold text-pink-700">Pagando como <strong>{{ t.currentParticipant.name }}</strong> · semana {{ selectedProofWeek() || t.currentWeek }}</div>
                            }

                            <!-- MP Form -->
                            <form id="mp-card-form" class="space-y-3">
                              <div id="mp-cardNumber" class="h-12 bg-pink-50/30 border border-pink-100 rounded-xl px-4 flex items-center"></div>
                              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div id="mp-expirationDate" class="h-12 bg-pink-50/30 border border-pink-100 rounded-xl px-4 flex items-center"></div>
                                <div id="mp-securityCode" class="h-12 bg-pink-50/30 border border-pink-100 rounded-xl px-4 flex items-center"></div>
                              </div>
                               <input type="text" id="mp-cardholderName" 
                                      class="h-12 w-full bg-pink-50/30 border border-pink-100 rounded-xl px-4 text-sm font-bold text-pink-900 placeholder:text-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-200 transition-all"
                                      placeholder="Nombre en la tarjeta">
                              
                              <select id="mp-issuer" class="hidden"></select>
                              <select id="mp-installments" class="hidden"></select>
                              <input type="email" id="mp-cardholderEmail" class="hidden" value="cliente@regibazar.com">

                              @if (mpFetching()) {
                                <div class="flex items-center justify-center gap-2 py-1">
                                  <div class="w-3 h-3 border-2 border-pink-300 border-t-pink-500 rounded-full animate-spin"></div>
                                  <span class="text-[11px] text-pink-500 font-bold">Identificando tarjeta...</span>
                                </div>
                              }

                              <button type="submit" 
                                      class="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-pink-200 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                                      [disabled]="mpProcessing() || !selectedParticipantId()">
                                {{ mpProcessing() ? 'PROCESANDO... ✨' : 'PAGAR MI SEMANA 💖' }}
                              </button>
                            </form>
                          </div>
                        } @else {
                          <!-- Result View -->
                          <div class="text-center py-6 animate-bounce-in">
                            @if (mpResult()?.status === 'approved') {
                              <div class="text-5xl mb-4">🎉</div>
                              <h4 class="text-xl font-black text-pink-900 mb-1">¡Abono Realizado!</h4>
                              <p class="text-pink-600 text-xs font-medium px-4 mb-6">Tu pago de la semana {{ selectedProofWeek() || t.currentWeek }} ha sido registrado con éxito. ✨</p>
                              
                              <a [href]="messengerUrl" target="_blank" rel="noopener"
                                 class="flex items-center justify-center gap-3 bg-[#0099FF] text-white font-black text-xs py-4 px-5 rounded-2xl active:scale-95 transition-all shadow-xl w-full">
                                <svg class="w-6 h-6 fill-white" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.672V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8.1l3.131 3.26 5.887-3.26-6.559 6.863z"/></svg>
                                AVISAR POR MESSENGER 🎀
                              </a>
                            } @else {
                              <div class="text-5xl mb-4">❌</div>
                              <h4 class="text-xl font-black text-rose-900 mb-1">Pago no procesado</h4>
                              <p class="text-rose-600 text-xs font-medium px-4 mb-6">{{ mpResult()?.message || 'Hubo un problema. Intenta de nuevo, hermosa.' }}</p>
                              <button (click)="retryCardPayment()" class="text-xs font-black text-pink-600 underline uppercase tracking-widest">Reintentar Pago</button>
                            }
                          </div>
                        }

                        <p class="text-[9px] text-pink-400 text-center font-bold uppercase tracking-tighter opacity-50">
                          Protegido por Mercado Pago 🛡️
                        </p>
                      </div>
                    }
                    @case ('transfer') {
                      <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[2rem] p-6 border border-blue-100 shadow-sm animate-fade-in relative overflow-hidden">
                        <div class="absolute -right-4 -top-4 text-7xl opacity-10 rotate-12">🏦</div>
                        <div class="flex items-center gap-3 mb-4 relative z-10">
                          <div class="text-3xl">🏦</div>
                          <div>
                            <h4 class="font-black text-blue-900 text-xs leading-tight uppercase tracking-widest">Transferencia</h4>
                            <span class="text-[10px] font-bold text-blue-600 uppercase">MercadoPago</span>
                          </div>
                        </div>
                        <div class="bg-white/60 rounded-2xl p-4 border border-blue-200/50 mb-3 relative z-10 cursor-pointer active:scale-95 transition-all" (click)="copyText('722969017661718376')">
                          <p class="text-[9px] text-blue-700/70 font-black uppercase mb-1">Cuenta CLABE</p>
                          <p class="font-mono font-black text-blue-900 text-sm tracking-widest">722969017661718376</p>
                        </div>
                        <p class="text-[9px] text-blue-700/80 text-center font-black uppercase">A nombre de: Yazmin Vara ✨</p>
                      </div>
                    }
                    @case ('oxxo') {
                      <div class="bg-gradient-to-br from-red-50 to-orange-50 rounded-[2rem] p-6 border border-red-100 shadow-sm animate-fade-in relative overflow-hidden">
                        <div class="absolute -right-4 -top-4 text-6xl opacity-10 rotate-12">🏪</div>
                        <h4 class="font-black text-red-900 text-xs mb-3 uppercase tracking-widest">BBVA (OXXO)</h4>
                        <div class="bg-white/60 rounded-2xl p-4 border border-red-200/50 mb-3 cursor-pointer active:scale-95 transition-all" (click)="copyText('4152314496671333')">
                          <p class="text-[9px] text-red-700/70 font-black uppercase mb-1">Número de Tarjeta</p>
                          <p class="font-mono font-black text-red-900 text-sm tracking-widest">4152 3144 9667 1333</p>
                        </div>
                        <p class="text-[9px] text-red-700/80 font-black uppercase">Envía foto de tu ticket 📸</p>
                      </div>
                    }
                    @case ('cash') {
                      <div class="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-[2rem] p-6 border border-emerald-100 shadow-sm animate-fade-in flex flex-col items-center justify-center text-center">
                        <div class="text-4xl mb-2">💵</div>
                        <h4 class="font-black text-emerald-900 text-xs uppercase tracking-widest">Pago en Efectivo</h4>
                        <p class="text-[10px] text-emerald-700 mt-2 font-medium leading-relaxed px-4">Recibimos tus abonos directamente en el bazar los viernes y sábados. 💕</p>
                      </div>
                    }
                  }
                </div>

                <!-- General Contact -->
                <div class="mt-6 pt-6 border-t border-pink-100/50">
                  <p class="text-center text-[10px] text-pink-400 font-black uppercase tracking-[0.2em] mb-4">¿Dudas o Comprobantes? ✨</p>
                  <a [href]="messengerUrl" target="_blank" rel="noopener"
                     class="flex items-center justify-center gap-3 bg-[#0099FF] text-white font-black text-xs py-4 px-5 rounded-2xl active:scale-95 transition-all shadow-xl w-full">
                    <svg class="w-6 h-6 fill-white" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.672V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8.1l3.131 3.26 5.887-3.26-6.559 6.863z"/></svg>
                    CONTACTAR POR MESSENGER 🎀
                  </a>
                </div>
              </div>

              <!-- Rules Section -->
              <div class="bg-pink-950/5 text-pink-900 border border-pink-200/50 rounded-[2rem] p-6 text-center">
                 <h4 class="text-xs font-black uppercase tracking-widest mb-3">🌸 Políticas de Tanda</h4>
                 <p class="text-[11px] leading-relaxed font-medium">
                   Entregas los <strong class="text-pink-600">Domingos</strong> a la ganadora de la semana. <br>
                   ¡Ahorrar juntas es más divertido! ✨
                 </p>
              </div>

            </div>
          }

          @if (activeTab() === 'transparency') {
            <!-- ════════════ TAB: GRUPO (TRANSPARENCIA) ════════════ -->
            <div class="animate-fade-in-up space-y-4">
              <h3 class="text-center text-pink-950 font-black text-lg font-display flex items-center justify-center gap-2">
                <span>💎</span> Transparencia de Pagos
              </h3>
              
              <div id="transparency-timeline" class="bg-white/90 rounded-[2.5rem] p-8 shadow-sm border border-white relative overflow-hidden">
                 <div class="absolute top-0 right-0 w-32 h-32 bg-pink-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
                 
                 <div class="space-y-8 relative z-10">
                   @for (p of t.participants; track p.assignedTurn) {
                     <div class="flex gap-6 group">
                       <!-- Left Indicator Column -->
                       <div class="flex flex-col items-center w-10">
                          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black shadow-sm transition-all duration-500"
                               [ngClass]="{
                                 'bg-pink-600 text-white scale-110 shadow-lg shadow-pink-100': p.assignedTurn === t.currentWeek,
                                 'bg-white text-pink-400 border border-pink-100': p.assignedTurn !== t.currentWeek
                               }">
                             {{ p.assignedTurn }}
                          </div>
                          @if (!$last) {
                            <div class="w-0.5 flex-grow bg-pink-50 my-2 rounded-full"></div>
                          }
                       </div>
  
                       <!-- Content Column -->
                       <div class="flex-1 pt-1">
                          <div class="flex justify-between items-start mb-1">
                             <div>
                               <p class="text-sm font-black text-pink-900 leading-tight">{{ p.name }}</p>
                               <div class="flex items-center gap-1.5 mt-0.5">
                                 @if (p.variant) {
                                    <span class="text-[9px] font-black text-pink-400 uppercase tracking-widest">{{ p.variant }}</span>
                                    <span class="text-pink-200 text-[8px]">•</span>
                                 }
                                 @if (p.items.length > 0) {
                                    <span class="text-[9px] font-bold text-purple-500">🛍️ {{ p.items.length }} artículos</span>
                                    <span class="text-pink-200 text-[8px]">•</span>
                                 }
                                 <span class="text-[9px] font-bold text-pink-500 uppercase tracking-tight">
                                    📅 {{ getDeliveryDate(t.startDate, p.assignedTurn) | date:'EEE d MMM' : '' : 'es-MX' | uppercase }}
                                 </span>
                               </div>
                             </div>
                             <div class="flex gap-2 items-center">
                                <!-- Payment Track (Hearts) -->
                                <div class="flex flex-col items-end gap-1">
                                   <div class="flex flex-wrap justify-end gap-0.5 max-w-[120px]">
                                      @for (week of weeksArray(); track week) {
                                        <span class="text-[10px] transition-all duration-300"
                                              [class.grayscale]="!p.paidWeeks.includes(week)"
                                              [class.opacity-30]="!p.paidWeeks.includes(week)"
                                              [title]="'Semana ' + week">
                                          💖
                                        </span>
                                      }
                                   </div>
                                   <span class="text-[8px] font-black text-pink-400 uppercase tracking-tighter">
                                     {{ p.paidWeeks.length }} de {{ t.totalWeeks }} abonos ✨
                                   </span>
                                </div>
  
                                <!-- Delivery Status Badge -->
                                @if (p.assignedTurn <= t.currentWeek) {
                                  <div class="w-10 h-10 rounded-2xl flex flex-col items-center justify-center transition-all bg-gradient-to-br"
                                       [ngClass]="p.isDelivered ? 'from-emerald-400 to-teal-500 shadow-emerald-100 shadow-lg' : 'from-pink-100 to-rose-200 opacity-50'">
                                     <span class="text-lg">{{ p.isDelivered ? '🎁' : '📍' }}</span>
                                     <span class="text-[6px] font-black text-white uppercase tracking-tighter">{{ p.isDelivered ? 'LISTO' : 'RUTA' }}</span>
                                  </div>
                                }
                             </div>
                          </div>
                          <div class="h-1 w-full bg-pink-50 rounded-full mt-2 overflow-hidden">
                             <div class="h-full bg-pink-300 transition-all duration-1000" [style.width]="(p.paidWeeks.length / t.totalWeeks * 100) + '%'"></div>
                          </div>
                       </div>
                     </div>
                   }
                 </div>
              </div>
            </div>
          }
        }
      </div>

       <!-- Assistant Widget -->
       @if (tanda() && !loading()) {
        <div class="fixed bottom-6 right-6 z-40 flex items-end justify-end gap-3 pointer-events-none">
          @if (showAssistantBubble()) {
            <div class="bg-white/95 backdrop-blur-2xl rounded-[1.5rem] p-4 shadow-2xl border border-pink-100 max-w-[200px] pointer-events-auto animate-fade-in-up relative group/bubble">
              <button (click)="showAssistantBubble.set(false)" 
                      class="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white text-pink-500 shadow-lg border border-pink-50 flex items-center justify-center hover:bg-pink-500 hover:text-white transition-all z-30 active:scale-90" 
                      title="Cerrar mensaje">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>

              <div class="flex items-center gap-2 mb-1">
                <span class="text-[9px] font-black text-pink-500 uppercase">Asistente Virtual</span>
              </div>
              <p class="text-[10px] text-pink-900 font-medium italic">"¡Recuerda que estamos ahorrando juntas! Si tienes dudas sobre tu pago, escríbenos. ✨"</p>
            </div>
          }
          <button (click)="showAssistantBubble.set(true)" class="shrink-0 w-14 h-14 bg-gradient-to-br from-pink-100 to-rose-200 rounded-full flex items-center justify-center text-3xl shadow-xl border-4 border-white pointer-events-auto hover:scale-110 active:scale-95 transition-all animate-bounce-subtle">
            👩🏻‍💻
          </button>
        </div>
       }

       <!-- Toast Notification -->
       @if (toastVisible()) {
        <div class="fixed bottom-24 left-0 right-0 z-[100] flex justify-center pointer-events-none px-4">
          <div class="animate-bounce-up-y-only pointer-events-auto">
            <div class="bg-pink-950/95 backdrop-blur-md text-white text-[11px] font-black uppercase tracking-widest pl-6 pr-12 py-4 rounded-full shadow-2xl flex items-center gap-2.5 border border-pink-500/30 relative">
              <span class="text-lg">✨</span>
              <span>{{ toastMessage() }}</span>
              <button (click)="toastVisible.set(false)" class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all z-20">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          </div>
        </div>
       }
    </div>
  `,
  styles: [`
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }
    @keyframes float-delayed { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    @keyframes pulse-slow { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }
    @keyframes wiggle { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
    @keyframes fade-in-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes bounce-subtle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
    
    @keyframes bounce-up-y-only { 0% { opacity: 0; transform: translateY(100vh); } 60% { opacity: 1; transform: translateY(-15px); } 80% { transform: translateY(5px); } 100% { transform: translateY(0); } }
    
    .animate-float { animation: float 6s ease-in-out infinite; }
    .animate-float-delayed { animation: float-delayed 5s ease-in-out infinite; animation-delay: 2s; }
    .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
    .animate-wiggle { animation: wiggle 3s ease-in-out infinite; }
    .animate-fade-in-up { animation: fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .animate-fade-in { animation: fade-in 0.4s ease-out both; }
    .animate-bounce-subtle { animation: bounce-subtle 2s infinite; }
    .animate-bounce-up-y-only { animation: bounce-up-y-only 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
  `]
})
export class TandaViewComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private tandaService = inject(TandaService);
  private api = inject(ApiService);

  tanda = signal<TandaViewDto | null>(null);
  loading = signal(true);
  error = signal(false);
  scrollY = signal(0);
  accessToken: string = '';

  activeTab = signal<'summary' | 'transparency'>('summary');
  paymentTab = signal<'transfer' | 'cash' | 'oxxo' | 'card'>('transfer');

  // Mercado Pago Signals
  mp: any;
  cardFormInstance: any;
  mpSdkLoaded = signal(false);
  mpProcessing = signal(false);
  mpResult = signal<{ status: string; message: string } | null>(null);
  mpFetching = signal(false);
  selectedParticipantId = signal<string | null>(null);
  selectedProofWeek = signal<number>(1);
  proofFile = signal<File | null>(null);
  proofFileName = signal('');
  proofPreviewUrl = signal<string | null>(null);
  proofUploading = signal(false);
  proofError = signal('');
  showProofHistory = signal(false);
  showAssistantBubble = signal(true);
  private bubbleTimeout: any;

  get messengerUrl() {
    const t = this.tanda();
    if (!t) return BASE_MESSENGER_URL;
    let ref = `tanda_${t.id}`;

    // Si ya seleccionó quién es, lo incluimos en el ref para que sepas quién te escribe
    const pId = this.selectedParticipantId();
    if (pId) {
      const p = t.participants.find((x: any) => x.id === pId);
      if (p) ref += `_cli_${p.name.replace(/\s/g, '_')}`;
    }

    return `${BASE_MESSENGER_URL}?ref=${ref}`;
  }

  toastVisible = signal(false);
  toastMessage = signal('');
  private toastTimeout: any;

  isWinnerThisWeek = computed(() => {
    const t = this.tanda();
    return !!t?.currentParticipant && t.currentParticipant.assignedTurn === t.currentWeek;
  });

  weekOptions = computed(() => {
    const t = this.tanda();
    const me = t?.currentParticipant;
    if (!t || !me) return [];

    const options = [];
    for (let w = 1; w <= t.totalWeeks; w++) {
      const isPaid = me.paidWeeks?.includes(w) ?? false;
      const proof = me.paymentProofs?.find(p => p.weekNumber === w);
      const isPendingProof = proof?.status === 'Pending';
      const isRejectedProof = proof?.status === 'Rejected';

      let status: 'paid' | 'pending_review' | 'rejected' | 'current' | 'overdue' | 'future_advance';
      let label: string;
      let badge: string;
      let badgeClass: string;
      let canUpload: boolean;

      if (isPaid) {
        status = 'paid';
        label = `Semana ${w} · Pagada ✅`;
        badge = 'Pagada ✅';
        badgeClass = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
        canUpload = false;
      } else if (isPendingProof) {
        status = 'pending_review';
        label = `Semana ${w} · En revisión ⏳`;
        badge = 'En revisión ⏳';
        badgeClass = 'bg-amber-100 text-amber-800 border border-amber-200';
        canUpload = false;
      } else if (isRejectedProof) {
        status = 'rejected';
        label = `Semana ${w} · Foto rechazada (Reenviar) 💌`;
        badge = 'Requiere foto 💌';
        badgeClass = 'bg-rose-100 text-rose-800 border border-rose-200';
        canUpload = true;
      } else if (w === t.currentWeek) {
        status = 'current';
        label = `Semana ${w} · Abono de esta semana ⭐`;
        badge = 'Semana actual ⭐';
        badgeClass = 'bg-pink-100 text-pink-800 border border-pink-200';
        canUpload = true;
      } else if (w < t.currentWeek) {
        status = 'overdue';
        label = `Semana ${w} · Semana pendiente / atrasada ⚠️`;
        badge = 'Abono pendiente ⚠️';
        badgeClass = 'bg-orange-100 text-orange-800 border border-orange-200';
        canUpload = true;
      } else {
        status = 'future_advance';
        label = `Semana ${w} · Adelantar abono 🚀`;
        badge = 'Adelanto 🚀';
        badgeClass = 'bg-purple-100 text-purple-800 border border-purple-200';
        canUpload = true;
      }

      options.push({
        week: w,
        status,
        label,
        badge,
        badgeClass,
        canUpload,
        proof
      });
    }

    return options;
  });

  selectedWeekStatus = computed(() => {
    const week = this.selectedProofWeek();
    const options = this.weekOptions();
    return options.find(o => o.week === week) || options[0] || null;
  });

  isAllWeeksPaid = computed(() => {
    const t = this.tanda();
    const me = t?.currentParticipant;
    if (!t || !me || t.totalWeeks <= 0) return false;
    for (let w = 1; w <= t.totalWeeks; w++) {
      if (!me.paidWeeks?.includes(w)) return false;
    }
    return true;
  });

  @HostListener('window:scroll', ['$event'])
  onScroll(event?: any) {
    this.scrollY.set(window.scrollY);
  }

  copyText(val: string) {
    navigator.clipboard.writeText(val).then(() => {
      this.showToast('Número Copiado 📋✨');
    });
  }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    this.toastVisible.set(true);
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.toastVisible.set(false), 3000);
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.accessToken = params['token'];
      if (this.accessToken) this.loadTanda(this.accessToken);
    });

    // Auto-dismiss assistant after 10 seconds
    this.bubbleTimeout = setTimeout(() => {
      this.showAssistantBubble.set(false);
    }, 10000);
  }

  setPaymentTab(tab: 'transfer' | 'cash' | 'oxxo' | 'card') {
    if (this.paymentTab() === 'card' && tab !== 'card') {
      this.unmountCardForm();
      this.mpResult.set(null);
    }
    this.paymentTab.set(tab);
    if (tab === 'card') {
      this.onCardTabSelected();
    }
  }

  private loadMpScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).MercadoPago) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.crossOrigin = 'anonymous'; // Crucial for detailed error logging
      script.onload = () => {
        console.log('✅ MP SDK Loaded Successfully');
        resolve();
      };
      script.onerror = (e) => {
        console.error('❌ MP SDK Load Failed:', e);
        reject(new Error('MP SDK script error or blocked by adblocker'));
      };
      document.body.appendChild(script);
    });
  }

  private async onCardTabSelected() {
    console.log('💳 Card Tab Selected');
    if (!this.mpSdkLoaded()) {
      try {
        await this.loadMpScript();
        if ((window as any).MercadoPago) {
          console.log('Initializing MP with Key:', environment.mpPublicKey);
          this.mp = new (window as any).MercadoPago(environment.mpPublicKey, { locale: 'es-MX' });
          this.mpSdkLoaded.set(true);
        } else {
          throw new Error('MercadoPago object not found after script load');
        }
      } catch (err: any) {
        console.error('🛑 MP Initialization Error:', {
          message: err.message,
          stack: err.stack,
          cause: err.cause
        });
        this.showToast('Error al cargar pagos con tarjeta 💔');
        return;
      }
    }

    // Give Angular time to render the form container
    setTimeout(() => {
      const formEl = document.getElementById('mp-card-form');
      console.log('🔍 Checking for card form element:', !!formEl);
      if (formEl) {
        try {
          this.mountCardForm();
        } catch (mountErr: any) {
          console.error('🛑 MP Mounting Error:', mountErr);
        }
      } else {
        console.warn('⚠️ Card form element not found, retrying...');
        setTimeout(() => this.mountCardForm(), 300);
      }
    }, 200);
  }

  private mountCardForm() {
    console.log('🔨 Mounting Card Form...');
    if (!this.mp) {
      console.error('❌ Cannot mount: MP not initialized');
      return;
    }
    if (this.cardFormInstance) {
      console.warn('⚠️ Card form already mounted');
      return;
    }

    const formEl = document.getElementById('mp-card-form');
    if (!formEl) {
      console.error('❌ Cannot mount: Form element missing');
      return;
    }

    try {
      this.cardFormInstance = this.mp.cardForm({
        amount: String(this.tanda()?.weeklyAmount || '0'),
        iframe: true,
        form: {
          id: 'mp-card-form',
          cardNumber: { id: 'mp-cardNumber', placeholder: 'Número de tarjeta' },
          expirationDate: { id: 'mp-expirationDate', placeholder: 'MM/AA' },
          securityCode: { id: 'mp-securityCode', placeholder: 'CVV' },
          cardholderName: { id: 'mp-cardholderName', placeholder: 'Nombre' },
          issuer: { id: 'mp-issuer' },
          installments: { id: 'mp-installments' },
          cardholderEmail: { id: 'mp-cardholderEmail' }
        },
        callbacks: {
          onFormMounted: (error: any) => {
            if (error) return console.warn('Form Mounted Error:', error);
            console.log('✅ MP Form Mounted');
          },
          onSubmit: (event: Event) => {
            event.preventDefault();
            this.submitCardPayment();
          },
          onFetching: (resource: string) => {
            console.log('Fetching resource:', resource);
            this.mpFetching.set(true);
            setTimeout(() => this.mpFetching.set(false), 2000); // Reset if it gets stuck
          }
        }
      });
      console.log('✨ Card Form Instance Created:', !!this.cardFormInstance);
    } catch (e: any) {
      console.error('🛑 MP cardForm Initialization Error:', JSON.stringify(e));
      if (Array.isArray(e)) {
        e.forEach((err, idx) => console.error(`Error [${idx}]:`, err));
      }
    }
  }

  private unmountCardForm() {
    if (this.cardFormInstance) {
      this.cardFormInstance.unmount();
      this.cardFormInstance = null;
    }
  }

  private submitCardPayment() {
    const participantId = this.selectedParticipantId();
    const t = this.tanda();
    if (!participantId || !t) return;

    const data = this.cardFormInstance.getCardFormData();
    if (!data.token) {
      this.showToast('Completa los datos de tu tarjeta 💳');
      return;
    }

    this.mpProcessing.set(true);

    this.api.publicTandaCardPayment(this.accessToken, {
      participantId: participantId,
      weekNumber: this.selectedProofWeek() || t.currentWeek,
      cardToken: data.token,
      paymentMethodId: data.paymentMethodId
    }).subscribe({
      next: (res) => {
        this.mpProcessing.set(false);
        this.mpResult.set({ status: res.status, message: 'Pago aprobado' });
        if (res.status === 'approved') {
          this.showToast('¡Pago Realizado! 🎉');
          // Actualizar UI local (opcional: recargar tanda)
          this.loadTanda(this.accessToken);
        }
        this.unmountCardForm();
      },
      error: (err) => {
        this.mpProcessing.set(false);
        this.mpResult.set({ status: 'error', message: err.error?.message || 'Error al procesar el pago' });
      }
    });
  }

  retryCardPayment() {
    this.mpResult.set(null);
    setTimeout(() => this.mountCardForm(), 150);
  }

  ngOnDestroy() {
    if (this.bubbleTimeout) clearTimeout(this.bubbleTimeout);
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.revokePreviewUrl();
  }

  private revokePreviewUrl() {
    const url = this.proofPreviewUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.proofPreviewUrl.set(null);
    }
  }

  loadTanda(token: string) {
    this.loading.set(true);
    this.tandaService.getPublicTanda(token).subscribe({
      next: (data) => {
        this.tanda.set(data);
        this.selectedParticipantId.set(data.currentParticipant?.id ?? null);
        this.clearSelectedProof();
        if (data.currentParticipant) {
          this.autoSelectBestWeek(data.currentParticipant, data.currentWeek, data.totalWeeks);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  autoSelectBestWeek(participant: TandaParticipantPublicViewDto, currentWeek: number, totalWeeks: number) {
    // 1. Verificar si la semana actual está pendiente y sin comprobante en revisión
    const isCurrentPaid = participant.paidWeeks?.includes(currentWeek) ?? false;
    const hasPendingCurrent = participant.paymentProofs?.some(p => p.weekNumber === currentWeek && p.status === 'Pending') ?? false;
    if (!isCurrentPaid && !hasPendingCurrent && currentWeek >= 1 && currentWeek <= totalWeeks) {
      this.selectedProofWeek.set(currentWeek);
      return;
    }

    // 2. Buscar la primera semana pendiente de pago sin comprobante en revisión
    for (let w = 1; w <= totalWeeks; w++) {
      const isPaid = participant.paidWeeks?.includes(w) ?? false;
      const hasPending = participant.paymentProofs?.some(p => p.weekNumber === w && p.status === 'Pending') ?? false;
      if (!isPaid && !hasPending) {
        this.selectedProofWeek.set(w);
        return;
      }
    }

    // 3. Fallback a la semana actual o 1
    this.selectedProofWeek.set(currentWeek >= 1 && currentWeek <= totalWeeks ? currentWeek : 1);
  }

  selectWeekForProof(week: any) {
    const num = typeof week === 'string' ? parseInt(week, 10) : week;
    if (!isNaN(num)) {
      this.selectedProofWeek.set(num);
      this.clearSelectedProof();
    }
  }

  getProofForWeek(proofs: TandaPaymentProofPublicDto[] | undefined, week: number): TandaPaymentProofPublicDto | undefined {
    return proofs?.find(proof => proof.weekNumber === week);
  }

  onProofSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.proofError.set('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.clearSelectedProof();
      this.proofError.set('Selecciona una imagen JPG, PNG o WEBP.');
      return;
    }
    if (file.size > 8_000_000) {
      this.clearSelectedProof();
      this.proofError.set('La imagen no puede superar 8 MB.');
      return;
    }
    this.revokePreviewUrl();
    this.proofFile.set(file);
    this.proofFileName.set(file.name);
    this.proofPreviewUrl.set(URL.createObjectURL(file));
  }

  clearSelectedProof() {
    this.revokePreviewUrl();
    this.proofFile.set(null);
    this.proofFileName.set('');
    this.proofError.set('');
  }

  submitPaymentProof() {
    const tanda = this.tanda();
    const participant = tanda?.currentParticipant;
    const file = this.proofFile();
    const week = this.selectedProofWeek();
    if (!tanda || !participant || !file || this.proofUploading()) return;

    this.proofUploading.set(true);
    this.proofError.set('');
    this.tandaService.uploadTandaPaymentProof(
      this.accessToken,
      week,
      participant.weeklyAmount,
      file
    ).subscribe({
      next: result => {
        this.proofUploading.set(false);
        this.clearSelectedProof();
        this.showToast(result.message + ' ✨');
        this.loadTanda(this.accessToken);
      },
      error: error => {
        this.proofUploading.set(false);
        this.proofError.set(error.error?.message || 'No se pudo enviar el comprobante. Intenta nuevamente.');
      }
    });
  }

  weeksArray = computed(() => {
    const t = this.tanda();
    if (!t) return [];
    return Array.from({ length: t.totalWeeks }, (_, i) => i + 1);
  });

  getDeliveryDate(startDate: string, turn: number): Date {
    if (!startDate) return new Date();

    // Extraemos las partes de la fecha (YYYY-MM-DD)
    const datePart = startDate.split('T')[0];
    const parts = datePart.split('-');

    // Forzamos el parseo local para evitar saltos de día por UTC
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const date = new Date(year, month, day, 12, 0, 0); // 12:00 PM local para ser súper seguros

    // Sumamos las semanas según el turno
    date.setDate(date.getDate() + (turn - 1) * 7);

    // Ajustamos al domingo de esa semana (Las entregas son los domingos)
    // En JS getDay(): 0=Domingo, 1=Lunes, ..., 6=Sábado
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0) {
      // Sumamos los días necesarios para llegar al domingo (7 - dayOfWeek)
      date.setDate(date.getDate() + (7 - dayOfWeek) % 7);
    }

    return date;
  }
}
