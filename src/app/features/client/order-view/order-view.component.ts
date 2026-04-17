import { Component, OnInit, OnDestroy, signal, computed, HostListener, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { ToastService } from '../../../core/services/toast.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { OrderSummaryDto, OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_EMOJI } from '../../../core/models';
import { environment } from '../../../../environments/environment';
import confetti from 'canvas-confetti';
import gsap from 'gsap';


const API_BASE = environment.apiUrl.replace(/\/api\/?$/, '');


@Component({
  selector: 'app-order-view',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  template: `
    <div class="relative min-h-screen overflow-hidden bg-gradient-to-b from-pink-50 via-rose-50 to-purple-50 pb-24 font-sans text-stone-800"
         (scroll)="onScroll($event)">
         
      <!-- Parallax Background Layers -->
      <div class="fixed inset-0 pointer-events-none z-0">
        <!-- Layer 1: Slowest (Far back) -->
        <div class="absolute inset-0 opacity-40 transition-transform duration-75 ease-out"
             [style.transform]="'translateY(' + scrollY() * 0.1 + 'px)'">
          <div class="absolute top-[10%] left-[5%] text-4xl animate-pulse-slow">✨</div>
          <div class="absolute top-[40%] right-[10%] text-5xl opacity-50">🌸</div>
          <div class="absolute top-[75%] left-[15%] text-4xl animate-float">🎀</div>
        </div>
        
        <!-- Layer 2: Medium speed -->
        <div class="absolute inset-0 opacity-60 transition-transform duration-75 ease-out"
             [style.transform]="'translateY(' + scrollY() * 0.25 + 'px)'">
          <div class="absolute top-[20%] right-[15%] text-3xl animate-float-delayed">💖</div>
          <div class="absolute top-[60%] left-[8%] text-5xl">✨</div>
          <div class="absolute top-[85%] right-[20%] text-3xl animate-bounce-slow">🌷</div>
        </div>
        
        <!-- Layer 3: Fastest (Closest) -->
        <div class="absolute inset-0 opacity-80 transition-transform duration-75 ease-out"
             [style.transform]="'translateY(' + scrollY() * 0.5 + 'px)'">
          <div class="absolute top-[5%] right-[30%] text-2xl blur-[1px]">🌸</div>
          <div class="absolute top-[50%] right-[5%] text-4xl blur-[1px] animate-float">🎀</div>
          <div class="absolute top-[30%] left-[20%] text-2xl blur-[1px]">✨</div>
        </div>
      </div>

      <!-- Unboxing Overlay (Z-40) -->
      @if (order() && !isUnboxed()) {
        <div id="unboxing-overlay" 
             class="fixed inset-0 z-40 bg-pink-100/95 backdrop-blur-xl flex flex-col justify-center items-center overflow-hidden">
            
            <div id="unboxing-gift-container" class="text-center cursor-pointer relative" (click)="openBox()">
              <!-- Glow Aura -->
              <div id="gift-glow" class="absolute inset-0 bg-pink-400/20 blur-[60px] rounded-full scale-150 opacity-0"></div>
              
              <div id="gift-emoji" class="text-9xl relative z-10 drop-shadow-[0_20px_40px_rgba(236,72,153,0.4)] mb-8">🎁</div>
              
              <div id="gift-text-container">
                <h2 class="text-3xl font-black text-pink-600 font-display px-6 mb-3">¡Tienes un envío de Regi Bazar!</h2>
                <p class="text-pink-500 font-medium bg-white/50 inline-block px-5 py-2 rounded-full shadow-sm border border-pink-200">Toca el regalito para abrir 🎀</p>
              </div>
            </div>
            
            <!-- Floating elements in unboxing -->
            <div class="absolute bottom-10 left-10 text-5xl opacity-40 animate-float">🎉</div>
            <div class="absolute top-20 right-10 text-4xl opacity-40 animate-float-delayed">✨</div>
            <div class="absolute bottom-20 right-20 text-5xl opacity-40 animate-float">🌸</div>
        </div>
      }


      <!-- Main Content (Z-10 relative) -->
      <div class="relative z-10 max-w-md mx-auto p-4 sm:p-6 pt-10">
      
        @if (loading()) {
          <div class="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div class="w-12 h-12 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin mb-4"></div>
            <p class="text-pink-600 font-medium animate-pulse">Cargando tu pedido... 🛍️</p>
          </div>
        }

        @if (expired()) {
          <div class="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
            <span class="text-6xl mb-4 drop-shadow-md">⏰</span>
            <h2 class="text-2xl font-black text-pink-900 mb-2 font-display">Enlace expirado</h2>
            <p class="text-pink-600 px-4">Este enlace ya no está disponible. Contacta a tu vendedora para más información 💕</p>
          </div>
        }

        @if (notFound()) {
          <div class="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
            <span class="text-6xl mb-4 drop-shadow-md">🔍</span>
            <h2 class="text-2xl font-black text-pink-900 mb-2 font-display">Pedido no encontrado</h2>
            <p class="text-pink-600 px-4">Verifica que el enlace sea correcto, hermosa 💖</p>
          </div>
        }

        @if (order(); as o) {
          
          <!-- Header -->
          <div id="view-header" class="text-center mb-8 animate-slide-down relative">
            <div class="text-5xl mb-2 animate-wiggle inline-block drop-shadow-[0_0_15px_rgba(244,114,182,0.5)]">🎀</div>
            <h1 class="text-2xl sm:text-3xl font-black text-pink-600 tracking-tight font-display drop-shadow-sm">
              {{ greeting() }}, {{ o.clientName }}! 💖
            </h1>
            <p class="text-rose-500 font-medium mt-1">
              @if (o.status === 'Delivered') {
                ¡Abre tu regalito, esperamos que te encante! 🌸
              } @else if (o.status === 'NotDelivered') {
                Hubo un pequeñito problema con tu entrega 💌
              } @else {
                Aquí está el detalle de tu compra ✨
              }
            </p>
            
            <!-- RegiPuntos (Gamification) -->
            <div class="mt-4 inline-flex items-center gap-1.5 bg-gradient-to-r from-violet-100 to-pink-100 px-4 py-1.5 rounded-full border border-pink-200 shadow-sm animate-fade-in-up group cursor-pointer hover:scale-105 transition-transform" title="¡Gana más puntos compartiendo tu foto!">
              <span class="text-lg animate-pulse-slow">💎</span>
              <span class="text-xs font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-pink-600 uppercase tracking-widest">{{ regiPuntos() }} Puntos VIP</span>
            </div>
          </div>

          <!-- Smart Dashboard Top Bar (Sticky) -->
          <div id="balance-summary" class="sticky top-2 z-30 px-2 -mx-2 mb-6" [style.opacity]="isUnboxed() ? 1 : 0">
            <div class="bg-white/95 backdrop-blur-2xl rounded-3xl p-3 shadow-md border border-pink-100 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-pink-100 flex items-center justify-center text-xl">💰</div>
                <div>
                  <p class="text-[9px] text-pink-500 font-black uppercase tracking-widest leading-none mb-1">Balance</p>
                  <p class="text-xl font-black font-display text-pink-900 leading-none Irish Grover">{{ o.balanceDue | currency:'MXN':'symbol-narrow' }}</p>
                </div>
              </div>
              @if (activeTab() !== 'payment' && (o.balanceDue > 0)) {
                <button (click)="activeTab.set('payment')" class="bg-pink-500 text-white text-[10px] font-black px-4 py-2 rounded-xl shadow-lg">Pagar ✨</button>
              }
            </div>
          </div>

          <!-- Quick Action Tabs -->
          <div id="nav-tabs" class="flex p-1.5 bg-white/60 backdrop-blur-xl rounded-[2rem] mb-6 border border-white sticky top-24 z-20" [style.opacity]="isUnboxed() ? 1 : 0">
            <button class="flex-1 flex flex-col items-center py-2.5 rounded-2xl" [ngClass]="activeTab() === 'details' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-300'" (click)="activeTab.set('details')">
              <span class="text-xl">🛍️</span>
              <span class="text-[10px] font-black uppercase tracking-widest">Pedido</span>
            </button>
            <button class="flex-1 flex flex-col items-center py-2.5 rounded-2xl" [ngClass]="activeTab() === 'payment' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-300'" (click)="activeTab.set('payment')">
              <span class="text-xl">💸</span>
              <span class="text-[10px] font-black uppercase tracking-widest">Pago</span>
            </button>
            <button class="flex-1 flex flex-col items-center py-2.5 rounded-2xl" [ngClass]="activeTab() === 'status' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-300'" (click)="activeTab.set('status')">
              <span class="text-xl">🏠</span>
              <span class="text-[10px] font-black uppercase tracking-widest">Estado</span>
            </button>
          </div>

          @if (activeTab() === 'status') {
            <!-- ════════════ TAB: ESTADO ════════════ -->
            <div class="animate-fade-in-up space-y-6">
              
              <!-- C.A.M.I. AI Greeting (Movida a Widget Flotante) -->

              <!-- Map View (Only if InRoute) -->
              @if ((o.status === 'InRoute' || o.status === 'InTransit') && o.deliveriesAhead === 0 && (o.clientLatitude || clientCoords()?.lat)) {
                <div class="rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl relative h-[420px] bg-gray-100 group">
                  <div id="client-live-map" class="absolute inset-0 z-0"></div>
                  <div class="absolute top-4 inset-x-4 z-10 flex flex-col gap-2">
                    <div class="bg-blue-600/90 backdrop-blur-md text-white px-6 py-3 rounded-full font-black text-[10px] text-center shadow-xl border border-white/20 animate-bounce-subtle tracking-[0.2em]">
                       ¡TU PAQUETE ESTÁ LLEGANDO! 🚗💨
                    </div>
                    <div class="bg-white/95 backdrop-blur-lg rounded-2xl p-3 shadow-xl border border-pink-50 flex items-center justify-between">
                       <div class="flex items-center gap-3">
                         <span class="text-2xl animate-pulse">⏳</span>
                         <span class="text-lg font-black text-pink-950 font-display">Llega en {{ etaText() || '...' }}</span>
                       </div>
                       <div class="flex gap-1">
                         <button (click)="mapZoom(1)" class="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 font-black shadow-sm">+</button>
                         <button (click)="mapZoom(-1)" class="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 font-black shadow-sm">-</button>
                       </div>
                    </div>
                  </div>
                </div>
              }

              <!-- Queue Info -->
              @if ((o.status === 'InRoute' || o.status === 'InTransit') && o.queuePosition) {
                <div id="queue-info" class="bg-blue-50/80 rounded-[2rem] p-6 border border-blue-100 text-center shadow-inner">
                  <div class="text-5xl font-black text-blue-500 font-display mb-2">{{ o.deliveriesAhead }}</div>
                  <p class="text-[10px] font-black uppercase text-blue-400 tracking-[0.2em] mb-4">Entregas antes que la tuya</p>
                  <div class="flex justify-center gap-2 mb-4 h-8 items-center">
                    @for (i of getQueueDots(o); track $index) {
                      <div class="rounded-full transition-all duration-500"
                           [ngClass]="{
                             'w-4 h-4 bg-emerald-400': i.done,
                             'w-5 h-5 bg-blue-500 animate-pulse': i.current,
                             'w-10 h-10 bg-pink-500 border-4 border-white shadow-lg flex items-center justify-center text-xs': i.you,
                             'w-3 h-3 bg-gray-200': !i.done && !i.current && !i.you
                           }">
                        @if(i.you){💖}
                      </div>
                    }
                  </div>
                  <p class="text-xs text-blue-800/60 font-medium">Eres la parada #{{ o.queuePosition }} de hoy 📍</p>
                </div>
              }

              <!-- Main Status Text -->
              <div class="p-5 rounded-[2rem] bg-gradient-to-br from-pink-50 to-white border border-pink-100 border-dashed text-center">
                 <p class="text-sm font-bold text-pink-900 leading-relaxed">{{ getStatusDetailMessage(o.status, o.deliveriesAhead || 0) }}</p>
              </div>

              <!-- Tracking Timeline -->
              <div id="tracking-timeline" class="bg-white/80 rounded-[2.5rem] p-8 shadow-sm border border-white/50">
                <h3 class="text-xs font-black text-pink-300 uppercase tracking-[0.3em] mb-8 text-center">Historial del Pedido</h3>
                <div class="space-y-6">
                  @for (step of timelineSteps(); track $index) {
                    <div class="flex gap-6 relative" [class.opacity-40]="!step.done && !step.active">
                      <div class="flex flex-col items-center w-12">
                        <div class="w-12 h-12 rounded-[1.2rem] flex items-center justify-center text-2xl bg-white border-2 transition-all duration-500 shadow-sm"
                             [ngClass]="{
                               'border-pink-300 bg-pink-50': step.done,
                               'border-pink-600 bg-pink-50 scale-110 shadow-lg shadow-pink-100': step.active,
                               'border-gray-100': !step.done && !step.active
                             }">
                          {{ step.icon }}
                        </div>
                        @if (!$last) {
                          <div class="w-1 flex-grow bg-gray-100 rounded-full my-2" [class.bg-pink-300]="step.done"></div>
                        }
                      </div>
                      <div class="flex-1 pt-1.5">
                        <p class="font-black text-sm mb-1" [class.text-pink-600]="step.active">{{ step.label }}</p>
                        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{{ step.date ? (step.date | date:'MMM d, h:mm a') : 'Pendiente' }}</p>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          }

          @if (activeTab() === 'payment') {
            <!-- ════════════ TAB: PAGAR ════════════ -->
            <div class="animate-fade-in-up space-y-6">
              
              <!-- Financial Summary (Small Inline) -->
              <div class="bg-white/90 rounded-[2.5rem] p-8 border border-pink-100/50 shadow-sm text-center">
                <div class="flex justify-between items-end mb-2 max-w-[200px] mx-auto">
                    <span class="font-black text-pink-950 uppercase text-[10px] tracking-widest">Saldo Restante</span>
                    <span class="text-4xl font-black text-pink-600 font-display leading-none">{{ o.balanceDue | currency:'MXN':'symbol-narrow' }}</span>
                </div>
              </div>

              <!-- Payment Methods -->
              <div id="payment-methods" class="relative z-10">
                <h3 class="text-center text-pink-900 font-black text-lg font-display mb-1">Formas de Pago 💸</h3>
                <p class="text-center text-xs text-pink-700/70 font-medium mb-4">Elige cómo quieres pagar tu saldo restante</p>

                <!-- Custom Tabs -->
                <div class="flex p-1 bg-white/50 backdrop-blur-md rounded-2xl mb-4 border border-white">
                  <button class="flex-1 py-2 text-xs font-bold rounded-xl transition-all"
                          [ngClass]="paymentTab() === 'cash' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-400 hover:text-pink-500'"
                          (click)="paymentTab.set('cash')">💵 Efectivo</button>
                  <button class="flex-1 py-2 text-xs font-bold rounded-xl transition-all"
                          [ngClass]="paymentTab() === 'transfer' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-400 hover:text-pink-500'"
                          (click)="paymentTab.set('transfer')">🏦 Transfer</button>
                  <button class="flex-1 py-2 text-xs font-bold rounded-xl transition-all"
                          [ngClass]="paymentTab() === 'oxxo' ? 'bg-white text-pink-600 shadow-sm' : 'text-pink-400 hover:text-pink-500'"
                          (click)="paymentTab.set('oxxo')">🏪 OXXO</button>
                </div>

                <!-- Tab Content -->
                <div class="min-h-[140px]">
                  @switch (paymentTab()) {
                    @case ('cash') {
                      <div class="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-5 border border-emerald-100 shadow-sm animate-fade-in text-center relative overflow-hidden">
                        <div class="absolute -right-4 -top-4 text-7xl opacity-10 rotate-12">💵</div>
                        <div class="text-4xl mb-2 relative z-10">💵</div>
                        <h4 class="font-bold text-emerald-900 text-sm relative z-10">Pago al Entregar</h4>
                        <p class="text-xs text-emerald-700 mt-2 relative z-10">Por favor ten el monto exacto listo para agilizar tu entrega 💕</p>
                      </div>
                    }
                    @case ('transfer') {
                      <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-5 border border-blue-100 shadow-sm animate-fade-in relative overflow-hidden">
                        <div class="absolute -right-4 -top-4 text-7xl opacity-10 rotate-12">🏦</div>
                        <div class="flex items-center gap-3 mb-4 relative z-10">
                          <div class="text-3xl">🏦</div>
                          <div>
                            <h4 class="font-bold text-blue-900 text-sm leading-tight">Transferencia</h4>
                            <span class="text-xs font-bold text-blue-600 uppercase">Citibanamex</span>
                          </div>
                        </div>
                        <div class="bg-white/60 rounded-xl p-3 border border-blue-200/50 mb-3 relative z-10">
                          <div class="flex justify-between items-center mb-1">
                            <span class="text-[10px] text-blue-700/70 font-bold uppercase tracking-widest">Número de Tarjeta</span>
                          </div>
                          <div class="flex justify-between items-center">
                            <span class="font-mono font-bold text-blue-900 tracking-wider text-sm">5256 7861 3758 3898</span>
                            <button class="bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all" (click)="copyText('5256786137583898')">COPIAR</button>
                          </div>
                        </div>
                        <p class="text-[10px] text-blue-700/80 text-center font-bold">A nombre de: Yazmin Vara ✨</p>
                      </div>
                    }
                    @case ('oxxo') {
                      <div class="bg-gradient-to-br from-red-50 to-orange-50 rounded-3xl p-5 border border-red-100 shadow-sm animate-fade-in relative overflow-hidden">
                        <div class="absolute -right-4 -top-4 text-7xl opacity-10 rotate-12">🏪</div>
                        <div class="flex items-center gap-3 mb-4 relative z-10">
                          <div class="text-3xl">🏪</div>
                          <div>
                            <h4 class="font-bold text-red-900 text-sm leading-tight">Depósito OXXO</h4>
                            <span class="text-xs font-bold text-red-600 uppercase">BBVA</span>
                          </div>
                        </div>
                        <div class="bg-white/60 rounded-xl p-3 border border-red-200/50 relative z-10 mb-3">
                          <div class="flex justify-between items-center mb-1">
                            <span class="text-[10px] text-red-700/70 font-bold uppercase tracking-widest">Número de Tarjeta</span>
                          </div>
                          <div class="flex justify-between items-center">
                            <span class="font-mono font-bold text-red-900 tracking-wider text-sm">4152 3144 9667 1333</span>
                            <button class="bg-red-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all" (click)="copyText('4152314496671333')">COPIAR</button>
                          </div>
                        </div>
                        <p class="text-[10px] text-red-700/80 text-center font-bold">Envía foto del ticket a tu vendedora ✨</p>
                      </div>
                    }
                  }
                </div>
              </div>
            </div>
          }

          @if (activeTab() === 'details') {
            <!-- ════════════ TAB: DETALLE ════════════ -->
            <div class="animate-fade-in-up space-y-6">
              
              <!-- Ticket (Order Items) -->
              <div id="ticket-content" class="bg-white/90 rounded-[2.5rem] p-8 border border-white shadow-sm relative overflow-hidden">
                <div class="absolute -top-10 -right-10 w-40 h-40 bg-pink-50 rounded-full blur-3xl opacity-50"></div>
                <h3 class="text-lg font-black text-pink-900 font-display mb-6 text-center">Tu Ticket 🧾</h3>
                
                <div class="space-y-4 mb-8">
                  @for (item of o.items; track item.id) {
                    <div class="flex justify-between items-center group order-item">
                      <div class="flex flex-col">
                        <span class="font-bold text-pink-950 text-sm leading-tight group-hover:text-pink-600 transition-colors">{{ item.productName }}</span>
                        <div class="flex items-center gap-2">
                           <span class="text-[10px] font-black text-pink-400 uppercase tracking-widest">x{{ item.quantity }}</span>
                           @if (item.variant) {
                              <span class="text-[9px] font-black text-white bg-pink-400 px-1.5 py-0.5 rounded-md uppercase tracking-tighter">{{ item.variant }}</span>
                           }
                        </div>
                      </div>
                      <span class="font-black text-pink-600">{{ item.lineTotal | currency:'MXN':'symbol-narrow' }}</span>
                    </div>
                  }
                </div>

                <div id="ticket-line" class="w-full border-t-2 border-dashed border-pink-100 my-6"></div>

                <div id="ticket-totals" class="space-y-3">
                  <div class="flex justify-between text-xs font-bold text-pink-800/60 uppercase tracking-widest">
                    <span>Subtotal</span>
                    <span>{{ o.subtotal | currency:'MXN':'symbol-narrow' }}</span>
                  </div>
                  @if (o.shippingCost > 0) {
                    <div class="flex justify-between text-xs font-bold text-pink-800/60 uppercase tracking-widest">
                      <span>Envío 🛵</span>
                      <span>{{ o.shippingCost | currency:'MXN':'symbol-narrow' }}</span>
                    </div>
                  }
                  <div class="flex justify-between text-xl font-black text-pink-950 pt-3 border-t border-pink-50">
                    <span class="font-display">Total</span>
                    <span class="font-display">{{ o.total | currency:'MXN':'symbol-narrow' }}</span>
                  </div>
                </div>

                <!-- Pending Confirmation Card (Relocated) -->
                @if (o.status === 'Pending') {
                  <div id="confirm-card" class="mt-8 bg-gradient-to-br from-pink-500 to-rose-500 rounded-[2.5rem] p-8 text-white text-center shadow-xl group animate-bounce-subtle">
                    <h3 class="text-xl font-bold uppercase tracking-widest mb-2 font-display">¡Todo se ve increíble! 🎀</h3>
                    <p class="text-[10px] font-medium opacity-80 mb-6">Confirma tu pedido para empezar a prepararlo con mucho amor.</p>
                    <button id="confirm-btn" (click)="confirmOrder($event)" 
                            class="w-full py-5 rounded-2xl bg-white text-pink-600 font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all text-sm">
                       ✨ SÍ, CONFIRMAR PEDIDO
                    </button>
                  </div>
                }
              </div>

              <!-- Delivery Instructions -->
              <div class="bg-white/90 rounded-[2rem] p-6 border border-pink-100 shadow-sm relative overflow-hidden group">
                <h4 class="text-[10px] font-black text-pink-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  📍 Instrucciones
                  @if (savingInstructions()) { <span class="w-2 h-2 bg-pink-400 rounded-full animate-ping"></span> }
                </h4>
                
                @if (isEditingInstructions()) {
                  <textarea [(ngModel)]="localInstructions" rows="3" class="w-full bg-pink-50/50 border-2 border-pink-100 rounded-2xl p-4 text-sm focus:outline-none focus:border-pink-300 transition-all font-medium" placeholder="Escribe aquí señas particulares..."></textarea>
                  <div class="flex gap-2 mt-3">
                    <button (click)="saveInstructions()" class="flex-1 bg-pink-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest shadow-lg">Guardar✨</button>
                    <button (click)="isEditingInstructions.set(false)" class="px-4 py-3 bg-gray-100 text-gray-500 font-bold rounded-xl text-xs uppercase tracking-widest">Cerrar</button>
                  </div>
                } @else {
                  <div (click)="startEditingInstructions()" class="cursor-pointer min-h-[60px] flex flex-col justify-center">
                    <p class="text-sm text-pink-900 font-medium italic">{{ o.deliveryInstructions || 'Toca para agregar referencias de tu domicilio 💕' }}</p>
                    <span class="text-[9px] font-black text-pink-400 mt-2 uppercase tracking-widest group-hover:text-pink-600 transition-all">Editar Instrucciones ✏️</span>
                  </div>
                }
              </div>

              <!-- Social Invite -->
              <div class="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2.5rem] p-8 text-white text-center shadow-xl relative overflow-hidden group">
                <div class="absolute -right-10 -bottom-10 text-9xl opacity-10 group-hover:scale-125 transition-transform duration-1000">📸</div>
                <h3 class="text-xl font-black font-display mb-2 drop-shadow-md">¡Presume tu estilo! 📸</h3>
                <p class="text-[10px] font-bold opacity-80 mb-6 tracking-wide">Etiquétanos en tus historias de Facebook o IG al recibir tu pedido y gana <strong>RegiPuntos extra</strong> ✨</p>
                <div class="flex justify-center gap-4 relative z-10">
                  <a href="https://www.facebook.com/regi.bazar.852309" target="_blank" class="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-xl hover:scale-110 transition-transform">f</a>
                  <a href="https://www.instagram.com/" target="_blank" class="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-xl hover:scale-110 transition-transform">IG</a>
                </div>
              </div>
            </div>
          }

          <!-- Chat Modal Overlay -->
          @if (isChatOpen()) {
            <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
              <div class="absolute inset-0 bg-pink-900/40 backdrop-blur-sm" (click)="isChatOpen.set(false)"></div>
              
              <div class="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl border border-pink-100 overflow-hidden flex flex-col h-[70vh] animate-bounce-up-y-only">
                <!-- Chat Header -->
                <div class="bg-gradient-to-r from-pink-500 to-rose-400 p-5 shrink-0 flex items-center justify-between">
                  <div class="flex items-center gap-3 text-white">
                    <span class="text-3xl">💖</span>
                    <div>
                      <h3 class="font-black leading-none font-display text-lg">Soporte & Entregas</h3>
                      <p class="text-pink-100 text-[9px] font-bold uppercase tracking-widest mt-1">Chat del pedido 🎀</p>
                    </div>
                  </div>
                  <button (click)="isChatOpen.set(false)" class="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors">✕</button>
                </div>

                <!-- Messages -->
                <div id="modal-chat-box" class="flex-1 overflow-y-auto p-4 space-y-4 bg-pink-50/30">
                  <!-- Security Notice -->
                  <div class="flex justify-center mb-4">
                    <div class="bg-blue-50/50 border border-blue-100 rounded-2xl px-4 py-2 flex items-center gap-2">
                      <span class="text-xs">🛡️</span>
                      <p class="text-[9px] text-blue-600 font-bold uppercase tracking-wider">Chat Seguro & Monitoreado</p>
                    </div>
                  </div>

                  @if (chatMessages().length === 0) {
                    <div class="h-full flex flex-col justify-center items-center opacity-40">
                      <span class="text-5xl mb-3 animate-float">💬</span>
                      <p class="text-pink-800 font-bold text-center text-xs">¡Escríbenos si tienes dudas! 💕</p>
                    </div>
                  }
                  @for (m of chatMessages(); track m.id) {
                    <div class="flex flex-col max-w-[85%]" [ngClass]="m.sender === 'Client' ? 'self-end items-end' : 'self-start items-start'">
                       @if (m.sender !== 'Client') {
                          <span class="text-[8px] font-black uppercase text-pink-400 ml-2 mb-0.5 tracking-wider">
                             {{ m.sender === 'Admin' ? 'Soporte 👩🏻‍💻' : 'Repartidor 🚗' }}
                          </span>
                       }
                       <div class="p-3 shadow-sm border"
                            [ngClass]="m.sender === 'Client' ? 
                               'bg-pink-500 text-white rounded-[1.2rem] rounded-tr-md border-pink-400' : 
                               'bg-white text-pink-900 rounded-[1.2rem] rounded-tl-md border-pink-100'">
                          <p class="text-sm leading-relaxed">{{ m.text }}</p>
                       </div>
                    </div>
                  }
                </div>

                <!-- Input -->
                <div class="p-4 bg-white border-t border-pink-50">
                  <div class="flex gap-2">
                    <input type="text" [(ngModel)]="newChatMessage" (keyup.enter)="sendChatMessage()"
                           class="flex-1 bg-pink-50/50 border-2 border-pink-100 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-pink-300 font-medium"
                           placeholder="Escribe algo... ✨" />
                    <button (click)="sendChatMessage()" [disabled]="!newChatMessage.trim() || sendingChat()"
                            class="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center text-white shadow-lg disabled:opacity-50">
                      <span class="text-xl">✨</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          }

          <p class="text-center mt-12 mb-8 font-script text-rose-300 text-xl opacity-60">
            Hecho con 🎀 para ti
          </p>

          <!-- Action Toast Notification -->
          @if (toastVisible()) {
            <div class="fixed bottom-6 left-0 right-0 z-[100] flex justify-center pointer-events-none">
              <div class="animate-bounce-up-y-only pointer-events-auto">
                <div class="bg-gray-900/90 backdrop-blur-md text-white text-sm font-medium px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-2.5 border border-pink-500/30">
                  <span class="text-xl">✨</span>
                  <span class="whitespace-nowrap font-bold">{{ toastMessage() }}</span>
                </div>
              </div>
            </div>
          }



          <!-- Lightbox de foto de evidencia -->
          @if (evidenceLightbox()) {
            <div class="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
                 (click)="evidenceLightbox.set(null)">
              <img [src]="evidenceLightbox()!" alt="Foto de entrega"
                   class="max-w-full max-h-full rounded-3xl shadow-2xl object-contain border-2 border-white/10" />
              <button class="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 text-white text-xl flex items-center justify-center"
                      (click)="evidenceLightbox.set(null)">✕</button>
            </div>
          }

          <!-- ✦ C.A.M.I. Floating Assistant Widget (Z-40) ✦ -->
          @if (order()) {
            <div id="cami-fab" class="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
              
              <!-- Chat Floating Bubble (New) -->
              <button id="chat-fab" (click)="isChatOpen.set(true); unreadMessages.set(false)" 
                      class="pointer-events-auto w-14 h-14 bg-white rounded-full flex items-center justify-center text-2xl shadow-xl border-2 border-pink-100 hover:scale-110 active:scale-95 transition-all relative group animate-float">
                💬
                @if (unreadMessages()) {
                  <span class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                }
                <!-- Tooltip -->
                <span class="absolute right-full mr-3 bg-gray-900 text-white text-[9px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Chat de Ayuda 💬
                </span>
              </button>

              @if (isUnboxed()) {
                <!-- Speech Bubble (existing) -->
                @if (!isLoadingCami() && camiMessage() && showCamiBubble()) {
                  <div class="bg-white/95 backdrop-blur-2xl rounded-[1.5rem] p-4 shadow-2xl border border-pink-100 max-w-[250px] pointer-events-auto animate-fade-in-up origin-bottom-right relative transition-all">
                    <!-- Close Button -->
                    <button (click)="showCamiBubble.set(false)" class="absolute top-2 right-2 w-6 h-6 rounded-full bg-pink-50 text-pink-400 hover:bg-pink-100 hover:text-pink-600 flex items-center justify-center text-xs transition-colors z-20" title="Cerrar mensaje">✕</button>

                    <!-- Tail of the speech bubble -->
                    <div class="absolute -right-1 bottom-4 w-4 h-4 bg-white border-b border-r border-pink-100 rotate-[-45deg] transform origin-center"></div>
                    
                    <div class="flex items-center gap-2 mb-1.5 relative z-10">
                      <span class="text-[9px] font-black text-pink-500 uppercase tracking-widest leading-none">C.A.M.I. AI</span>
                      <div class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                    </div>
                    <p class="text-xs text-pink-900 font-medium leading-relaxed italic relative z-10 pr-6">"{{ camiMessage() }}"</p>
                    
                    @if (camiAudioUrl()) {
                      <button (click)="playCamiAudio()" class="mt-3 bg-pink-50 hover:bg-pink-100 text-pink-600 w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm">
                         {{ isPlayingCami() ? '🔊 Escuchando...' : '▶️ Escuchar' }}
                      </button>
                    }
                  </div>
                }

                <!-- The Avatar Interactive Button -->
                <button (click)="startTour()" class="shrink-0 w-16 h-16 bg-gradient-to-br from-pink-100 to-rose-200 rounded-full flex items-center justify-center text-4xl shadow-[0_15px_30px_rgba(244,114,182,0.4)] border-4 border-white pointer-events-auto hover:scale-110 active:scale-95 transition-all relative animate-bounce-subtle z-20 group">
                  👩🏻‍💻
                  <!-- Status Dots -->
                  @if (isLoadingCami()) {
                    <span class="absolute -top-1 -right-1 w-4 h-4 bg-pink-400 rounded-full border-2 border-white animate-pulse"></span>
                  } @else if (camiMessage()) {
                    <span class="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white shadow-sm"></span>
                  }
                  
                  <!-- Hover Tooltip -->
                  <span class="absolute -top-8 right-0 bg-gray-900 text-white text-[9px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                    Ver Tour ✨
                  </span>
                </button>
              }
            </div>
          }

          <!-- ✦ C.A.M.I. TOUR OVERLAY ✦ -->
          @if (tourActive()) {
            <div class="fixed inset-0 z-[100] pointer-events-none overflow-hidden animate-fade-in">
              <!-- Spotlight Path Overlay (Even-Odd logic for robust masking) -->
              <svg class="w-full h-full pointer-events-auto">
                <path [attr.d]="tourPath()" 
                      fill="rgba(80, 7, 36, 0.75)" 
                      fill-rule="evenodd"
                      class="backdrop-blur-[2px] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]" />
              </svg>

              <div class="fixed left-0 right-0 z-[101] pointer-events-auto flex justify-center px-4 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] animate-bounce-up-y-only" 
                   [class.top-28]="tourPlacement() === 'top'"
                   [class.bottom-8]="tourPlacement() === 'bottom'">
                <div class="w-full max-w-[380px] bg-white rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(244,114,182,0.4)] border-4 border-pink-300 relative">
                   
                   <div class="flex items-center gap-4 mb-4">
                     <div class="w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center text-4xl border-4 border-white shadow-md animate-bounce-subtle shrink-0">👩🏻‍💻</div>
                     <div>
                       <div class="flex items-center gap-2 mb-1">
                         <span class="text-[10px] font-black text-pink-500 uppercase tracking-[0.2em] leading-none">C.A.M.I. Guía</span>
                         <div class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                       </div>
                       <p class="font-black text-pink-950 leading-none font-display text-lg">Paso {{ currentTourStep() + 1 }} de {{ dynamicTourSteps().length }}</p>
                     </div>
                   </div>
                   
                   <p class="text-[15px] text-pink-900 font-medium leading-relaxed mb-6">
                     {{ dynamicTourSteps()[currentTourStep()].msg }}
                   </p>

                   <div class="flex gap-2">
                     <button (click)="closeTour()" class="px-5 py-3 bg-gray-50 hover:bg-gray-100 text-gray-500 text-xs font-black rounded-2xl uppercase tracking-widest transition-colors">Omitir</button>
                     <div class="flex-grow"></div>
                     @if (currentTourStep() > 0) {
                       <button (click)="prevStep()" class="px-5 py-3 bg-pink-50 hover:bg-pink-100 text-pink-600 text-xs font-black rounded-2xl uppercase tracking-widest transition-colors">Atrás</button>
                     }
                     <button (click)="nextStep()" class="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-black rounded-2xl uppercase tracking-widest shadow-xl shadow-pink-200 active:scale-95 transition-all outline-none focus:ring-4 focus:ring-pink-200">
                       {{ currentTourStep() === dynamicTourSteps().length - 1 ? '¡Listo! ✨' : 'Siguiente ✨' }}
                     </button>
                   </div>
                </div>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-15px); }
    }
    @keyframes float-delayed {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    @keyframes pulse-slow {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.1); }
    }
    @keyframes wiggle {
      0%, 100% { transform: rotate(-5deg); }
      50% { transform: rotate(5deg); }
    }
    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes bounce-subtle {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }
    @keyframes bounce-in-up {
      0% { opacity: 0; transform: translate(-50%, 100vh); }
      60% { opacity: 1; transform: translate(-50%, -15px); }
      80% { transform: translate(-50%, 5px); }
      100% { transform: translate(-50%, 0); }
    }
    @keyframes bounce-up-y-only {
      0% { opacity: 0; transform: translateY(100vh); }
      60% { opacity: 1; transform: translateY(-15px); }
      80% { transform: translateY(5px); }
      100% { transform: translateY(0); }
    }
    @keyframes shimmer {
      100% { transform: translateX(200%); }
    }
    @keyframes glint {
      100% { transform: translateX(200%); }
    }
    
    .animate-float { animation: float 6s ease-in-out infinite; }
    .animate-float-delayed { animation: float-delayed 5s ease-in-out infinite; animation-delay: 2s; }
    .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
    .animate-wiggle { animation: wiggle 3s ease-in-out infinite; }
    .animate-fade-in-up { animation: fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .animate-fade-in { animation: fade-in 0.4s ease-out both; }
    .animate-bounce-subtle { animation: bounce-subtle 2s infinite; }
    .animate-bounce-in-up { animation: bounce-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .animate-bounce-up-y-only { animation: bounce-up-y-only 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .animate-shimmer { animation: shimmer 3s infinite linear; }
    .animate-glint { animation: glint 1.5s infinite; }

    /* Custom Scrollbar for a smoother look */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #fbcfe8; border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: #f9a8d4; }
  `]
})
export class OrderViewComponent implements OnInit, OnDestroy, AfterViewInit {

  private accessToken = '';

  order = signal<any | null>(null);

  // New UI states
  isUnboxed = signal(true); // Default true until loaded
  unboxingAnim = signal(false);
  showSurprise = signal(false);
  totalAbonado = computed(() => {
    const o = this.order();
    if (!o || !o.payments) return 0;
    return o.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
  });

  loading = signal(true);
  expired = signal(false);
  notFound = signal(false);

  // Live Tracking
  driverLocation = signal<{ latitude: number, longitude: number } | null>(null);
  // Geocoded client coordinates (backend may not persist them, so we resolve on the fly)
  clientCoords = signal<{ lat: number, lng: number } | null>(null);
  isNearby = computed(() => {
    const loc = this.driverLocation();
    const ord = this.order();
    if (!loc || !ord || ord.status !== 'InTransit') return false;
    return true;
  });

  // Gamified Map State
  etaText = signal<string>('');


  paymentTab = signal<'transfer' | 'cash' | 'oxxo'>('transfer');

  // Parallax Scroll Tracking
  scrollY = signal(0);

  toastVisible = signal(false);
  toastMessage = signal('');
  private toastTimeout: any;

  evidenceLightbox = signal<string | null>(null);

  resolveImageUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  // Timeline State
  timelineSteps = signal<{ label: string, date: Date | null, done: boolean, active: boolean, icon: string }[]>([]);

  // Delivery Instructions State
  isEditingInstructions = signal(false);
  savingInstructions = signal(false);
  localInstructions = '';

  // UI Layout State
  activeTab = signal<'status' | 'payment' | 'details'>('details');
  isChatOpen = signal(false);

  // Chat State
  chatMessages = signal<any[]>([]);
  newChatMessage = '';
  sendingChat = signal(false);
  unreadMessages = signal(false);

  // --- TOUR STATE ---
  tourActive = signal(false);
  currentTourStep = signal(0);
  tourHole = signal({ top: 0, left: 0, width: 0, height: 0, radius: 24 });
  tourPlacement = signal<'top' | 'bottom'>('bottom');

  // Spotlight Path (Root fix: Even-Odd cutout)
  tourPath = computed(() => {
    const h = this.tourHole();
    const wW = window.innerWidth;
    const wH = window.innerHeight;
    
    // Outer Rectangle (Screen)
    const d0 = `M 0 0 H ${wW} V ${wH} H 0 Z`;
    
    // Inner Rounded Rectangle (Hole with padding and radius)
    const padding = 10;
    const x = h.left - padding;
    const y = h.top - padding;
    const w = h.width + (padding * 2);
    const height = h.height + (padding * 2);
    const r = h.radius || 24;

    const d1 = `M ${x} ${y + r} ` +
               `A ${r} ${r} 0 0 1 ${x + r} ${y} ` +
               `H ${x + w - r} ` +
               `A ${r} ${r} 0 0 1 ${x + w} ${y + r} ` +
               `V ${y + height - r} ` +
               `A ${r} ${r} 0 0 1 ${x + w - r} ${y + height} ` +
               `H ${x + r} ` +
               `A ${r} ${r} 0 0 1 ${x} ${y + height - r} ` +
               `Z`;
               
    return `${d0} ${d1}`;
  });
  
  dynamicTourSteps = computed(() => {
    const o = this.order();
    if (!o) return [];

    const steps: { target: string, msg: string, tab?: 'status' | 'payment' | 'details', modal?: boolean }[] = [
      { target: '#view-header', msg: '¡Hola hermosa! Soy C.A.M.I. ✨ He diseñado este panel para que tengas todo a la mano. ¡Déjame enseñarte!' },
      { target: '#nav-tabs', msg: 'Aquí tienes tus 3 pestañas principales: Detalle de Pedido, Métodos de Pago y Rastreo en Vivo. 🛍️💸🏠' },
      { target: '#ticket-content', msg: 'En "Pedido" tienes tu ticket detallado. ¡Revisa que todo esté perfecto! 🧾', tab: 'details' }
    ];

    // Confirm Step (Relocated)
    if (o.status === 'Pending') {
      steps.push({ target: '#confirm-card', msg: 'Una vez que revises tus productos, no olvides confirmar tu pedido aquí abajo. ¡Es el paso más importante! 🎀', tab: 'details' });
    }

    // Payment Tab Specifics
    if (o.balanceDue > 0) {
      steps.push({ target: '#payment-methods', msg: 'En la pestaña de "Pago" encontrarás las cuentas para liquidar tu saldo de forma segura. 💸', tab: 'payment' });
    }

    // Status Tab Specifics
    if (o.status === 'InRoute' || o.status === 'InTransit') {
       steps.push({ target: '#nav-tabs', msg: 'En "Estado" podrás seguir al repartidor en tiempo real y ver cuántas entregas faltan. 🚗💨', tab: 'status' });
    }

    // Chat Step (New FAB)
    steps.push({ target: '#chat-fab', msg: 'Si tienes alguna duda, usa esta burbuja para chatear directamente con nosotros o el repartidor. 💬' });

    // Final
    steps.push({ target: '#cami-fab', msg: '¡Eso es todo! Estaré aquí flotando por si necesitas algo más. ¡Que disfrutes tu compra! 👩🏻‍💻✨' });

    return steps;
  });

  startTour() {
    this.tourActive.set(true);
    this.currentTourStep.set(0);
    this.updateHole();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextStep() {
    if (this.currentTourStep() < this.dynamicTourSteps().length - 1) {
      this.currentTourStep.update(s => s + 1);
      this.updateHole();
    } else {
      this.closeTour();
    }
  }

  prevStep() {
    if (this.currentTourStep() > 0) {
      this.currentTourStep.update(s => s - 1);
      this.updateHole();
    }
  }

  closeTour() {
    this.tourActive.set(false);
    localStorage.setItem('cami_tour_done', 'true');
  }

  private checkAndStartTour() {
    const done = localStorage.getItem('cami_tour_done');
    if (!done && this.order() && this.isUnboxed()) {
      // Small delay to let the 'unboxing' fade-out finish and elements settle in DOM
      setTimeout(() => {
        if (!this.tourActive()) {
          this.startTour();
        }
      }, 800); 
    }
  }

  private updateHole(forceTabSwitch = true) {
    if (!this.tourActive()) return;

    // Use requestAnimationFrame to ensure we measure after the last layout pass
    requestAnimationFrame(() => {
      const steps = this.dynamicTourSteps();
      const step = steps[this.currentTourStep()];
      if (!step) return;

      // Auto-switch tabs if the step requires it
      if (forceTabSwitch && step.tab && this.activeTab() !== step.tab) {
        this.activeTab.set(step.tab);
        // Wait for Angular change detection and DOM update
        setTimeout(() => this.updateHole(false), 300); 
        return;
      }

      // Root Fix: Exhaustive Element Search
      const el = document.querySelector(step.target) as HTMLElement;
      
      if (el) {
        const calculateCoordinates = () => {
          const rect = el.getBoundingClientRect();
          
          // Debugging logging if needed (internal)
          // console.log(`[Tour] Highlight target ${step.target}:`, rect);

          // If element is not actually visible or in layout (dimensions 0), retry
          if (rect.width === 0 && rect.height === 0) {
             setTimeout(() => this.updateHole(false), 200);
             return;
          }

          this.tourPlacement.set(rect.top > window.innerHeight / 2 ? 'top' : 'bottom');
          this.tourHole.set({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            radius: 24
          });
        };

        const rect = el.getBoundingClientRect();
        // Handle scrolling if element is not fully in view
        if (rect.top < 100 || rect.bottom > window.innerHeight - 100) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Wait for smooth scroll to finish before final calculation
          setTimeout(calculateCoordinates, 600);
        } else {
          calculateCoordinates();
        }
      } else {
        // Fallback: If element not found, retry once or highlight safe area
        if (forceTabSwitch) {
           setTimeout(() => this.updateHole(false), 500);
        }
      }
    });
  }

  // Señales para C.A.M.I.
  camiMessage = signal<string>('');
  camiAudioUrl = signal<string>('');
  isPlayingCami = signal(false);
  isLoadingCami = signal(true);
  showCamiBubble = signal(true);
  // Stratospheric features
  regiPuntos = computed(() => {
    const o = this.order();
    if (!o) return 0;
    return Math.floor((o.total || 0) / 10); // 1 point per $10 MXN spent
  });
  




  // Countdown State
  countdownText = signal<string>('');
  private countdownInterval: any;

  // --- MAP STEROIDS ---
  private mapInitialized = false;
  private map: any;
  private directionsService: any;
  private directionsRenderer: any;
  private driverMarker: any;
  private geofenceCircle: any;
  private geofenceTriggered = false;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private signalr: SignalRService,
    private toast: ToastService,
    private push: PushNotificationService
  ) { }

  @HostListener('window:scroll', ['$event'])
  onScroll(event: Event) {
    // Basic implementation for window scroll. 
    // Wait, the template binds (scroll)="onScroll($event)" to the main div. 
    // Let's read from window scroll as well to be safe if body scrolls.
    this.scrollY.set(window.scrollY);
  }

  ngOnInit() {
    this.accessToken = this.route.snapshot.paramMap.get('token') || '';
    if (!this.accessToken) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.loadOrder();
    this.initSignalR(this.accessToken);
    this.initPush();
  }

  ngAfterViewInit() {
    this.initHeartbeat();
    this.initTiltListener();
  }

  // --- PREMIUM BUTTON INTERACTIONS ---
  private heartbeatInterval: any;
  private initHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const btn = document.getElementById('btn-heart-icon');
      if (btn) {
        gsap.to(btn, { scale: 1.3, duration: 0.1, yoyo: true, repeat: 1, ease: "power2.inOut" });
      }
    }, 2000);
  }

  private initTiltListener() {
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', (event) => {
        const gamma = event.gamma || 0; // -90 to 90
        const beta = event.beta || 0;   // -180 to 180

        const hologram = document.getElementById('btn-hologram');
        if (hologram) {
          const moveX = (gamma / 90) * 100;
          const moveY = (beta / 90) * 100;
          gsap.to(hologram, {
            xPercent: moveX,
            yPercent: moveY,
            opacity: 0.5,
            duration: 0.5,
            ease: "power2.out"
          });
        }
      });
    }
  }

  btnTouchStart() {
    gsap.to('#confirm-btn', { scale: 0.92, duration: 0.2, ease: "power2.out" });
  }

  btnTouchEnd() {
    gsap.to('#confirm-btn', { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.3)" });
  }

  btnMouseMove(e: MouseEvent) {
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Magnetic Pull
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const moveX = (x - centerX) * 0.15;
    const moveY = (y - centerY) * 0.3;

    gsap.to(btn, { x: moveX, y: moveY, duration: 0.3, ease: "power2.out" });

    // Move hologram based on mouse
    const hologram = document.getElementById('btn-hologram');
    if (hologram) {
      const hX = (x / rect.width) * 200 - 100;
      gsap.to(hologram, { xPercent: hX, opacity: 0.6, duration: 0.3 });
    }
  }

  btnMouseLeave() {
    gsap.to('#confirm-btn', { x: 0, y: 0, scale: 1, duration: 0.5, ease: "elastic.out(1, 0.3)" });
    gsap.to('#btn-hologram', { opacity: 0, xPercent: -100, duration: 0.5 });
  }



  private initPush(): void {
    this.push.requestPermission().then(granted => {
      if (granted) {
        const checkOrder = setInterval(() => {
          const ord = this.order();
          if (ord) {
            this.push.subscribeToNotifications('client', { clientId: ord.id });
            clearInterval(checkOrder);
          }
        }, 1000);
      }
    });
  }

  private initSignalR(token: string): void {
    this.signalr.connect().then(() => {
      this.signalr.joinOrder(token);
    });

    this.signalr.deliveryUpdate$.subscribe(() => {
      this.loadOrder();
      this.showToast('¡Tu pedido tiene una actualización! ✨');
    });

    this.signalr.locationUpdate$.subscribe((loc: any) => {
      this.driverLocation.set(loc);
      const o = this.order();
      if (o && (o.status === 'InRoute' || o.status === 'InTransit') && o.deliveriesAhead === 0) {
        if (this.mapInitialized) {
          this.updateMap();
        } else {
          // If map wasn't initialized yet but we have coordinates
          if (o.clientLatitude || this.clientCoords()?.lat) {
            setTimeout(() => this.initMap(), 300);
          }
        }
      }
    });

    this.signalr.clientChatUpdate$.subscribe((msg) => {
      this.chatMessages.update(msgs => {
         if (msgs.find(m => m.id === msg.id)) return msgs;
         return [...msgs, msg];
      });
      if (!this.isChatOpen()) {
         this.unreadMessages.set(true);
         this.showToast('¡Escribieron en tu chat! 💬💌');
      }
      this.scrollToBottomChat();
    });

    // Feature #9 — CAMI greeting pushed when driver marks InTransit
    this.signalr.camiGreeting$.subscribe((greeting) => {
      this.camiMessage.set(greeting.message);
      if (greeting.audioBase64) {
        this.camiAudioUrl.set('data:audio/mp3;base64,' + greeting.audioBase64);
      }
      this.isLoadingCami.set(false);
      this.showCamiBubble.set(true);
      this.showToast('¡C.A.M.I. tiene un mensaje para ti! 💌');
    });
  }

  // Generate Greeting based on time
  greeting() {
    const hr = new Date().getHours();
    if (hr < 12) return '¡Buenos días';
    if (hr < 19) return '¡Buenas tardes';
    return '¡Buenas noches';
  }

  getStatusDetailMessage(status: string, deliveriesAhead: number): string {
    switch (status) {
      case 'Pending': return 'Tu pedido está listo, confirma para prepararlo ✨';
      case 'Confirmed': return '¡Pedido confirmado! Lo estamos preparando con mucho cariño 🎀';
      case 'Shipped': return 'Tu paquetito está armado y listo para salir ✨';
      case 'InRoute':
        if (deliveriesAhead > 0) {
          return `Tu pedido va en camino. El repartidor visita a ${deliveriesAhead} chicas antes que a ti 💕`;
        }
        return '¡Prepárate, eres la siguiente parada! ✨';
      case 'InTransit': return '¡Prepárate, el auto va directo a tu casa! 🎉';
      case 'Delivered': return 'Tu pedido fue entregado, muchas gracias por hacernos parte de tu estilo 🌸';
      case 'NotDelivered': return 'No se logró entregar. Porfa contacta a tu vendedora 💌';
      case 'Canceled': return 'Este pedido ha sido cancelado. 💔';
      default: return 'Estamos procesando tu pedido, pronto tendrás novedades 💕';
    }
  }

  ngOnDestroy() {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    if (this.countdownInterval) clearInterval(this.countdownInterval);
  }

  loadOrder() {
    this.api.publicGetOrder(this.accessToken).subscribe({
      next: (data) => {
        this.order.set(data);
        this.buildTimeline(data.status);
        this.loading.set(false);
        this.loadChat();

        // Check Unboxing Session Status
        const unboxedKey = `regibazar_unboxed_${data.id}`;
        if (!sessionStorage.getItem(unboxedKey)) {
          this.isUnboxed.set(false);
        } else {
          this.isUnboxed.set(true);
        }

        if (this.isUnboxed()) {
          setTimeout(() => {
            this.animateTicketReveal();
            if (data.status === 'Delivered') this.fireConfetti('unboxing');
            this.checkAndStartTour();
          }, 500);
        }

        // Note: Default tab is 'details' (Pedido) as requested by user.
        this.activeTab.set('details');

        if (data.expiresAt) {
          // Fallback if API hasn't updated its DTO yet or sync Issues
          if (!data.scheduledDeliveryDate) {
            const date = new Date(data.expiresAt);
            date.setDate(date.getDate() - 1);
            data.scheduledDeliveryDate = date.toISOString();
          }
          this.startCountdown(data.expiresAt);
        }


        // Initialize Map if active route and it is their exact turn.
        // Geocode client address first if coordinates are missing from the backend response.
        if ((data.status === 'InRoute' || data.status === 'InTransit') && data.deliveriesAhead === 0) {
          if (!data.clientLatitude && data.clientAddress) {
            this.geocodeClientAddress(data.clientAddress);
          } else {
            // Give Angular a frame to render the map div before init
            setTimeout(() => this.initMap(), 300);
          }
          // Reset geofence trigger if route loaded fresh
          this.geofenceTriggered = false;
        }
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 410) {
          this.expired.set(true);
        } else {
          this.notFound.set(true);
        }
      }
    });

    this.api.publicGetCamiGreeting(this.accessToken).subscribe({
      next: (res) => {
        this.camiMessage.set(res.message);
        this.camiAudioUrl.set('data:audio/mp3;base64,' + res.audioBase64);
        this.isLoadingCami.set(false);
        this.showCamiBubble.set(true);
      },
      error: () => this.isLoadingCami.set(false) // Si falla la IA, simplemente no mostramos la tarjeta
    });
  }

  loadChat() {
     this.api.publicGetChat(this.accessToken).subscribe(msgs => {
        this.chatMessages.set(msgs);
        this.scrollToBottomChat();
     });
  }

  sendChatMessage() {
     if (!this.newChatMessage.trim() || this.sendingChat()) return;
     this.sendingChat.set(true);
     this.api.publicSendChatMessage(this.accessToken, this.newChatMessage).subscribe({
        next: (msg) => {
           this.chatMessages.update(msgs => {
              if (msgs.find(m => m.id === msg.id)) return msgs;
              return [...msgs, msg];
           });
           this.newChatMessage = '';
           this.sendingChat.set(false);
           this.scrollToBottomChat();
        },
        error: () => {
           this.sendingChat.set(false);
           this.showToast('No se pudo enviar el mensaje. 😿');
        }
     });
  }

  scrollToBottomChat() {
     setTimeout(() => {
        const box = document.getElementById('modal-chat-box');
        if (box) {
           box.scrollTop = box.scrollHeight;
        }
     }, 100);
  }

  confirmOrder(event?: MouseEvent | TouchEvent) {
    // 1. Localized Heart Celebration from button
    let originX = 0.5;
    let originY = 0.5;

    if (event) {
      const btn = (event.currentTarget as HTMLElement);
      if (btn) {
        const rect = btn.getBoundingClientRect();
        originX = (rect.left + rect.width / 2) / window.innerWidth;
        originY = (rect.top + rect.height / 2) / window.innerHeight;
      }
    }

    // Safety confirmation prompt
    if (!confirm('¿Segura que deseas confirmar tu pedido? ✨')) {
      return;
    }

    const tl = gsap.timeline();
    // Heartbeat pulse before sending
    tl.to('#confirm-btn', { scale: 1.1, duration: 0.1, yoyo: true, repeat: 1 });
    tl.to('#btn-heart-icon', { rotation: 20, scale: 1.5, duration: 0.2, yoyo: true, repeat: 1 });

    this.api.publicConfirmOrder(this.accessToken).subscribe({
      next: (res) => {
        // Massive Heart Burst from the button!
        this.fireHearts(originX, originY);
        this.showToast(res.message || '¡Pedido confirmado! 💖');

        // Stagger out the card
        gsap.to('#confirm-card', {
          opacity: 0,
          y: 50,
          scale: 0.9,
          duration: 0.5,
          delay: 0.5,
          onComplete: () => this.loadOrder()
        });
      },
      error: (err) => {
        this.showToast(err.error?.message || 'Error al confirmar');
        gsap.to('#confirm-btn', { x: -10, duration: 0.1, repeat: 3, yoyo: true }); // Shake on error

      }
    });
  }

  private fireHearts(x: number, y: number) {
    const scalar = 2.5;
    const heart = confetti.shapeFromText({ text: '💖', scalar });
    const sparkles = confetti.shapeFromText({ text: '✨', scalar });

    const defaults = {
      spread: 90,
      ticks: 100,
      gravity: 0.6,
      decay: 0.94,
      startVelocity: 30,
      shapes: [heart, sparkles],
      origin: { x, y }
    };

    confetti({ ...defaults, particleCount: 40 });
    confetti({ ...defaults, particleCount: 20, flat: true });

    // Extra bursts
    setTimeout(() => {
      confetti({ ...defaults, particleCount: 20, spread: 120, startVelocity: 45 });
    }, 100);
  }


  buildTimeline(status: string) {
    const o = this.order();
    if (!o) return;

    // Define standard timeline progression
    const states = ['Pending', 'Confirmed', 'Shipped', 'InRoute', 'InTransit', 'Delivered'];

    // Check if Canceled or NotDelivered
    if (status === 'Canceled') {
      this.timelineSteps.set([
        { label: 'Pedido Cancelado', date: new Date(), done: false, active: true, icon: '❌' }
      ]);
      return;
    }

    if (status === 'NotDelivered') {
      this.timelineSteps.set([
        { label: 'Pedido Realizado', date: new Date(o.createdAt), done: true, active: false, icon: '📝' },
        { label: 'Entrega Fallida', date: new Date(), done: false, active: true, icon: '❌' }
      ]);
      return;
    }

    // Determine current index in normal flow
    // InTransit and InRoute map similarly for the timeline visual
    let currentIdx = states.indexOf(status);
    if (currentIdx === -1) currentIdx = 0; // Default pending
    if (status === 'InTransit') currentIdx = 3; // Treat as InRoute for base timeline

    const newSteps = [
      {
        label: ORDER_STATUS_LABELS[0],
        date: new Date(o.createdAt),
        done: currentIdx > 0,
        active: currentIdx === 0,
        icon: ORDER_STATUS_EMOJI[0]
      },
      {
        label: ORDER_STATUS_LABELS[6],
        date: currentIdx >= 1 ? new Date() : null,
        done: currentIdx > 1,
        active: currentIdx === 1,
        icon: ORDER_STATUS_EMOJI[6]
      },
      {
        label: ORDER_STATUS_LABELS[7],
        date: currentIdx >= 2 ? new Date() : null,
        done: currentIdx > 2,
        active: currentIdx === 2,
        icon: ORDER_STATUS_EMOJI[7]
      },
      {
        label: ORDER_STATUS_LABELS[1],
        date: currentIdx >= 3 ? new Date() : null,
        done: currentIdx > 3 || status === 'InTransit',
        active: currentIdx === 3 || status === 'InTransit',
        icon: ORDER_STATUS_EMOJI[1]
      },
      {
        label: ORDER_STATUS_LABELS[2],
        date: currentIdx >= 5 ? new Date() : null,
        done: currentIdx === 5,
        active: currentIdx === 5,
        icon: ORDER_STATUS_EMOJI[2]
      }
    ];

    this.timelineSteps.set(newSteps);
  }

  // Geocodes the client's address and stores the result in clientCoords signal.
  private geocodeClientAddress(address: string): void {
    if (typeof (window as any).google === 'undefined') {
      // Google Maps not loaded yet — retry once it's ready
      setTimeout(() => this.geocodeClientAddress(address), 500);
      return;
    }
    const raw = address.trim();
    const full = raw.toLowerCase().includes('nuevo laredo')
      ? `${raw}, Tamaulipas, México`
      : `${raw}, Nuevo Laredo, Tamaulipas, México`;
    const geocoder = new (window as any).google.maps.Geocoder();
    geocoder.geocode({ address: full, region: 'mx' }, (results: any, status: string) => {
      if (status === 'OK' && results?.[0]) {
        this.clientCoords.set({
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng()
        });
        // Coordinates now available, init the map immediately
        if (!this.mapInitialized) {
          setTimeout(() => this.initMap(), 300);
        }
      } else {
        console.warn(`[OrderView] Geocode failed for "${raw}":`, status);
      }
    });
  }

  // --- 🎀 LIVE MAP & ETA LOGIC ---
  private initMap() {
    if (this.mapInitialized) return; // Guard: only initialize once
    if (typeof (window as any).google === 'undefined') return;
    const el = document.getElementById('client-live-map');
    if (!el) return;

    this.map = new (window as any).google.maps.Map(el, {
      zoom: 15,
      disableDefaultUI: true,
      gestureHandling: 'greedy', // Re-enabled for premium mobile experience
      styles: this.getCoquetteMapStyles() // Custom cute map theme
    });

    this.directionsService = new (window as any).google.maps.DirectionsService();

    // We will render the polyline ourselves, but hide default markers
    this.directionsRenderer = new (window as any).google.maps.DirectionsRenderer({
      map: this.map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#db2777', // Magenta pink
        strokeWeight: 5,
        strokeOpacity: 0.8
      }
    });

    this.mapInitialized = true;
    this.updateMap();
  }

  private updateMap() {
    if (!this.mapInitialized || !this.map) return;
    const o = this.order();
    const loc = this.driverLocation();
    const coords = this.clientCoords();

    const clientLat = o?.clientLatitude || coords?.lat;
    const clientLng = o?.clientLongitude || coords?.lng;

    if (!o || !clientLat || !clientLng || o.deliveriesAhead !== 0) return;

    const dest = new (window as any).google.maps.LatLng(clientLat, clientLng);

    // If driver location hasn't arrived yet, place home marker and center on home
    if (!loc || !loc.latitude) {
      if (!this.geofenceCircle) {
        new (window as any).google.maps.Marker({
          position: dest, map: this.map,
          icon: { path: 'M24 0c-13.255 0-24 10.745-24 24s24 24 24 24 24-10.745 24-24-10.745-24-24-24zm0 35c-6.075 0-11-4.925-11-11s4.925-11 11-11 11 4.925 11 11-4.925 11-11 11z', fillColor: '#ec4899', fillOpacity: 1, strokeColor: 'white', strokeWeight: 1, scale: 0.6, anchor: new (window as any).google.maps.Point(24, 48) },
          zIndex: 10
        });
        this.map.panTo(dest);
        this.etaText.set('Calculando...');
      }
      return;
    }

    const origin = new (window as any).google.maps.LatLng(loc.latitude, loc.longitude);

    // GEOFENCE STEROID
    const distMeters = this.getHaversineDistance(loc.latitude, loc.longitude, clientLat, clientLng);

    if (!this.geofenceCircle) {
      this.geofenceCircle = new (window as any).google.maps.Circle({
        strokeColor: '#ec4899', strokeOpacity: 0.8, strokeWeight: 2,
        fillColor: '#fbcfe8', fillOpacity: 0.35,
        map: this.map, center: dest, radius: 300
      });
    }

    if (distMeters <= 300 && !this.geofenceTriggered) {
      this.geofenceTriggered = true;
      this.playArrivalSound();
      this.fireConfetti('celebration');
      this.showToast('¡Tu repartidor ha llegado a tu zona! 🎉🚗');
    }


    // ANIMATED CAR STEROID (Heading & Lerp)
    let heading = 0;
    if (this.driverMarker) {
      const oldPos = this.driverMarker.getPosition();
      if (oldPos) {
        heading = this.getHeading(oldPos.lat(), oldPos.lng(), loc.latitude, loc.longitude);
      }
    }

    if (!this.driverMarker) {
      this.driverMarker = new (window as any).google.maps.Marker({
        position: origin,
        map: this.map,
        icon: {
          path: (window as any).google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#3b82f6', // Bright Blue
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2,
          rotation: heading
        },
        zIndex: 100
      });

      // Client Home gamified marker
      new (window as any).google.maps.Marker({
        position: dest,
        map: this.map,
        icon: {
          path: 'M24 0c-13.255 0-24 10.745-24 24s24 24 24 24 24-10.745 24-24-10.745-24-24-24zm0 35c-6.075 0-11-4.925-11-11s4.925-11 11-11 11 4.925 11 11-4.925 11-11 11z',
          fillColor: '#ec4899', // Pink
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 1,
          scale: 0.6,
          anchor: new (window as any).google.maps.Point(24, 48)
        },
        zIndex: 10
      });
    } else {
      // Animate transition smoothly
      this.animateMarker(this.driverMarker, this.driverMarker.getPosition(), origin, heading);
    }

    // Calculate Route and ETA
    this.directionsService.route({
      origin: origin,
      destination: dest,
      travelMode: (window as any).google.maps.TravelMode.DRIVING
    }, (result: any, status: string) => {
      if (status === 'OK') {
        this.directionsRenderer.setDirections(result);

        const leg = result.routes[0].legs[0];
        if (leg && leg.duration) {
          this.etaText.set(leg.duration.text);
        }

        // Frame the map smoothly (pan/fit)
        const bounds = new (window as any).google.maps.LatLngBounds();
        bounds.extend(origin);
        bounds.extend(dest);
        this.map.fitBounds(bounds, { top: 30, bottom: 40, left: 20, right: 20 });
      }
    });
  }

  // --- MAP MATH UTILS ---
  private getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private getHeading(lat1: number, lng1: number, lat2: number, lng2: number): number {
    if (lat1 === lat2 && lng1 === lng2) return 0;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  private animateMarker(marker: any, start: any, end: any, heading: number) {
    if (!start || !end) {
      marker.setPosition(end);
      return;
    }
    let startTime: number;
    const duration = 1500; // 1.5s fluid glide

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const currentLat = start.lat() + (end.lat() - start.lat()) * progress;
      const currentLng = start.lng() + (end.lng() - start.lng()) * progress;
      marker.setPosition(new (window as any).google.maps.LatLng(currentLat, currentLng));

      if (progress < 1) requestAnimationFrame(step);
    };

    const icon = marker.getIcon();
    if (heading !== 0) icon.rotation = heading; // Update rotation
    marker.setIcon(icon);
    requestAnimationFrame(step);
  }

  private playArrivalSound() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);

      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(800, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.1);

        gain2.gain.setValueAtTime(0, ctx.currentTime);
        gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.5);
      }, 200);
    } catch (e) { console.warn('Audio not supported', e); }
  }

  getQueueDots(o: any) {
    if (!o.totalDeliveries || !o.queuePosition) return [];

    const maxDots = Math.min(o.totalDeliveries, 10); // Cap at 10 dots for UI sanity
    const dots = [];

    // Simplify dots visualization
    // Green (Done) -> Blue Pulse (Current) -> ... -> Big Pink (You) -> Gray (Pending)
    const currentQueueGlobal = (o.totalDeliveries - (o.deliveriesAhead || 0)) - 1; // Roughly the current active queue position

    for (let i = 1; i <= maxDots; i++) {
      const isYou = (i === o.queuePosition);
      const isCurrent = (i === currentQueueGlobal && !isYou);
      const isDone = (i < currentQueueGlobal && !isYou);
      dots.push({ you: isYou, current: isCurrent, done: isDone, idx: i });
    }
    return dots;
  }

  copyText(val: string) {
    navigator.clipboard.writeText(val).then(() => {
      this.showToast('Copiar Cuenta 📋✨');
    });
  }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    this.toastVisible.set(true);
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => this.toastVisible.set(false), 3000);
  }

  // --- MAP UX HELPERS ---
  mapZoom(delta: number) {
    if (!this.map) return;
    const currentZoom = this.map.getZoom() || 15;
    this.map.setZoom(currentZoom + delta);
  }

  private getCoquetteMapStyles() {
    return [
      { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#fbcfe8" }] }, // Light pink water
      { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
      { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#fdeff4" }] }, // Rose roads
      { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
      { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
      { "featureType": "administrative", "elementType": "labels.text.fill", "stylers": [{ "color": "#be185d" }] }, // Pink labels
      { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#db2777" }] }
    ];
  }

  // --- HIGH PERFORMANCE CELEBRATION (CANVAS-CONFETTI) ---
  fireConfetti(type: 'unboxing' | 'celebration' | 'surprise' = 'celebration') {
    const scalar = 2;
    const flower = confetti.shapeFromText({ text: '🌸', scalar });
    const ribbon = confetti.shapeFromText({ text: '🎀', scalar });
    const sparkle = confetti.shapeFromText({ text: '✨', scalar });

    const commonConfig = {
      spread: 70,
      startVelocity: 30,
      ticks: 200,
      gravity: 0.8,
      decay: 0.94,
      colors: ['#f472b6', '#fb7185', '#c084fc', '#fbcfe8', '#ffffff']
    };

    switch (type) {
      case 'unboxing':
        // Big central explosion
        confetti({
          ...commonConfig,
          particleCount: 80,
          origin: { y: 0.6 },
          shapes: [flower, ribbon, sparkle, 'circle'],
          scalar: 1.2
        });
        // Side bursts
        setTimeout(() => {
          confetti({ ...commonConfig, particleCount: 40, angle: 60, origin: { x: 0, y: 0.8 }, shapes: [sparkle] });
          confetti({ ...commonConfig, particleCount: 40, angle: 120, origin: { x: 1, y: 0.8 }, shapes: [sparkle] });
        }, 200);
        break;

      case 'surprise':
        // Constant fountain
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const frame = () => {
          confetti({
            particleCount: 2,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#f472b6', '#c084fc']
          });
          confetti({
            particleCount: 2,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#f472b6', '#c084fc']
          });

          if (Date.now() < animationEnd) {
            requestAnimationFrame(frame);
          }
        };
        frame();
        break;

      default:
        // Standard burst
        confetti({
          ...commonConfig,
          particleCount: 100,
          origin: { y: 0.7 },
          shapes: ['circle', 'square']
        });
        break;
    }
  }

  // --- PREMIUM GSAP UNBOXING SEQUENCE ---
  openBox() {
    const o = this.order();
    if (!o) return;

    const tl = gsap.timeline({
      onComplete: () => {
        this.isUnboxed.set(true);
        sessionStorage.setItem(`regibazar_unboxed_${o.id}`, 'true');
        // Give a tiny frame for Angular to render the ticket before staggering items
        setTimeout(() => {
          this.animateTicketReveal();
          this.checkAndStartTour();
        }, 50);
      }
    });

    // 1. Anticipation: Shaking and Glow
    tl.to('#gift-emoji', { duration: 0.1, x: -10, repeat: 5, yoyo: true, ease: "power1.inOut" });
    tl.to('#gift-glow', { duration: 0.5, opacity: 1, scale: 2, ease: "back.out(2)" }, 0);
    tl.to('#gift-text-container', { duration: 0.3, opacity: 0, scale: 0.8, ease: "power2.in" }, 0);

    // 2. The Burst
    tl.to('#gift-emoji', {
      duration: 0.4,
      scale: 3,
      opacity: 0,
      ease: "expo.out",
      onStart: () => {
        this.fireConfetti('unboxing');
        this.playArrivalSound();
      }
    });

    // 3. Fade out overlay
    tl.to('#unboxing-overlay', {
      duration: 0.8,
      autoAlpha: 0,
      y: -100,
      ease: "power4.inOut"
    }, "-=0.2");
  }

  private animateTicketReveal() {
    const items = document.querySelectorAll('.order-item');
    const line = document.querySelector('#ticket-line');
    const totals = document.querySelector('#ticket-totals');

    if (!items.length || !line || !totals) return;

    const tl = gsap.timeline();

    // Stagger in the order items
    tl.fromTo(items,
      { opacity: 0, x: -20, scale: 0.9 },
      { opacity: 1, x: 0, scale: 1, duration: 0.5, stagger: 0.1, ease: "back.out(1.7)" }
    );

    // Animate the perforation line
    tl.fromTo(line,
      { scaleX: 0, opacity: 0 },
      { scaleX: 1, opacity: 1, duration: 0.8, ease: "expo.out" },
      "-=0.3"
    );

    // Fade in totals
    tl.fromTo(totals,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
      "-=0.4"
    );
  }

  // --- GAMIFICATION LOGIC ---
  revealSurprise() {
    this.fireConfetti('surprise');
    this.showSurprise.set(true);
  }

  // --- DELIVERY INSTRUCTIONS LOGIC ---
  startEditingInstructions() {
    this.localInstructions = this.order()?.deliveryInstructions || '';
    this.isEditingInstructions.set(true);
  }

  saveInstructions() {
    if (!this.accessToken) return;
    this.savingInstructions.set(true);

    this.api.publicUpdateInstructions(this.accessToken, this.localInstructions).subscribe({
      next: (res) => {
        this.order.update(prev => prev ? { ...prev, deliveryInstructions: this.localInstructions } : null);
        this.isEditingInstructions.set(false);
        this.savingInstructions.set(false);
        this.showToast('Instrucciones guardadas ✨');
      },
      error: (err) => {
        this.savingInstructions.set(false);
        this.showToast('Error al guardar 💔');
      }
    });
  }
  playCamiAudio() {
    if (this.isPlayingCami() || !this.camiAudioUrl()) return;

    const audio = new Audio(this.camiAudioUrl());
    this.isPlayingCami.set(true);

    audio.onended = () => this.isPlayingCami.set(false);
    audio.onerror = () => {
      this.isPlayingCami.set(false);
      this.showToast('No se pudo reproducir el audio 💔');
    };

    audio.play();
  }

  private startCountdown(expiresAt: string) {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    
    const targetDate = new Date(expiresAt).getTime();
    
    const update = () => {
      const now = new Date().getTime();
      const distance = targetDate - now;
      
      if (distance < 0) {
        this.countdownText.set('¡Llegó el gran día! 🎀');
        clearInterval(this.countdownInterval);
        return;
      }
      
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      
      let text = '';
      if (days > 0) text += `${days}d `;
      text += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      this.countdownText.set(text);
    };
    
    update();
    this.countdownInterval = setInterval(update, 1000);
  }
}
