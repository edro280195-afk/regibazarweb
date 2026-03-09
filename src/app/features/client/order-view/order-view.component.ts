import { Component, OnInit, OnDestroy, signal, computed, HostListener, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { ToastService } from '../../../core/services/toast.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { OrderSummaryDto } from '../../../core/models';
import confetti from 'canvas-confetti';
import gsap from 'gsap';


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
          <div class="text-center mb-8 animate-slide-down">
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
          </div>

          <!-- Live Tracking Gamified Map (TOP PRIORITY) -->
          @if ((o.status === 'InRoute' || o.status === 'InTransit') && o.deliveriesAhead === 0 && (o.clientLatitude || clientCoords()?.lat)) {
             <div class="mb-6 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-[0_20px_50px_rgba(236,72,153,0.3)] relative h-[420px] bg-gray-100 animate-fade-in-up" style="animation-delay: 50ms">
               <!-- Map Container -->
               <div id="client-live-map" class="absolute inset-0 z-0"></div>
               
               <!-- Smart Floating Header (Glassmorphism) -->
               <div class="absolute top-4 inset-x-4 z-10 flex flex-col gap-2">
                 <!-- Arrival Status Pill -->
                 <div class="bg-blue-600/90 backdrop-blur-md text-white px-4 py-2.5 rounded-full font-bold text-xs shadow-lg flex items-center justify-center gap-2 animate-bounce-subtle border border-white/20">
                    <div class="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
                    ¡TU PEDIDO ESTÁ LLEGANDO!
                 </div>

                 <!-- ETA Pill -->
                 <div class="bg-white/95 backdrop-blur-lg rounded-2xl p-3 shadow-xl border border-pink-100 flex items-center justify-between transition-all hover:scale-[1.02]">
                   <div class="flex items-center gap-3">
                     <div class="text-2xl animate-pulse">⏳</div>
                     <div class="text-left">
                       <p class="text-[9px] text-pink-500 font-black uppercase tracking-widest leading-none mb-1">Llega en aprox.</p>
                       @if (etaText()) {
                         <p class="text-xl font-black font-display text-pink-900 leading-none">{{ etaText() }}</p>
                       } @else {
                         <p class="text-lg font-black font-display text-gray-400 leading-none Irish Grover">Calculando...</p>
                       }
                     </div>
                   </div>
                   
                   <!-- Custom Zoom Controls -->
                   <div class="flex gap-1">
                     <button (click)="mapZoom(1)" class="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-pink-600 font-black text-lg shadow-sm border border-pink-100 active:scale-90 transition-transform">+</button>
                     <button (click)="mapZoom(-1)" class="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-pink-600 font-black text-lg shadow-sm border border-pink-100 active:scale-90 transition-transform">-</button>
                   </div>
                 </div>
               </div>
             </div>
          }

          <!-- Queue Alert & Progress (If InRoute/InTransit) -->
          @if ((o.status === 'InRoute' || o.status === 'InTransit') && o.queuePosition && o.totalDeliveries) {
            <div class="bg-blue-50/80 backdrop-blur-xl rounded-3xl p-5 mb-6 shadow-[0_8px_30px_rgb(59,130,246,0.1)] border border-blue-100 text-center animate-fade-in-up" style="animation-delay: 100ms">
              @if ((o.deliveriesAhead ?? 0) === 0) {
                <div class="text-4xl mb-2 animate-bounce">🚗💨</div>
                <div class="text-lg font-black text-blue-600 mb-1">¡Eres la siguiente!</div>
                <p class="text-sm text-blue-800/70 font-medium">El repartidor se dirige a tu ubicación.</p>
              } @else {
                <div class="text-5xl font-black text-blue-500 font-display leading-none mb-1">{{ o.deliveriesAhead }}</div>
                <div class="text-sm font-bold text-blue-400 uppercase tracking-widest mb-3">Entregas Antes</div>
                
                <!-- Queue Visualizer -->
                <div class="flex justify-center gap-1.5 mb-2 h-8 items-center">
                  @for (i of getQueueDots(o); track $index) {
                    <div class="rounded-full flex items-center justify-center font-black text-white text-[8px] transition-all"
                         [ngClass]="{
                           'w-4 h-4 bg-emerald-400': i.done,
                           'w-5 h-5 bg-blue-500 animate-pulse': i.current,
                           'w-7 h-7 bg-pink-500 border-2 border-white shadow-[0_0_10px_rgba(236,72,153,0.5)] z-10': i.you,
                           'w-3 h-3 bg-gray-300': !i.done && !i.current && !i.you
                         }">
                      @if (i.you) { 💖 }
                    </div>
                  }
                </div>
                <p class="text-xs text-blue-400/80 font-medium mb-3">Eres la parada #{{ o.queuePosition }} de {{ o.totalDeliveries }} en la ruta de hoy 📍</p>
                
                <!-- Driver Mini Profile -->
                <div class="bg-white/90 rounded-2xl p-3 flex items-center gap-3 shadow-inner border border-blue-100 text-left">
                  <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl shrink-0 border border-blue-200 shadow-sm animate-bounce-subtle">
                    👨🏻‍✈️
                  </div>
                  <div>
                    <h4 class="font-bold text-blue-900 text-sm leading-none">Repartidor en Camino</h4>
                    <p class="text-[10px] text-blue-600 font-medium">Conduciendo seguro hacia ti 🚗💨</p>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Status Alert Message -->
          <div class="mt-2 p-3 rounded-2xl bg-white/50 border border-pink-100 border-dashed text-center text-sm font-medium text-pink-800 animate-fade-in-up" style="animation-delay: 50ms">
            @switch (o.status) {
              @case ('Pending') { Tu pedido está listo, confirma para prepararlo ✨ }
              @case ('Confirmed') { ¡Pedido confirmado! Lo estamos preparando con mucho cariño 🎀 }
              @case ('Shipped') { Tu paquetito está armado y listo para salir ✨ }
              @case ('InRoute') { 
                Tu pedido va en camino. 
                @if ((o.deliveriesAhead ?? 0) > 0) {
                  El repartidor visita a {{ o.deliveriesAhead }} chicas antes que a ti 💕
                } @else {
                  ¡Prepárate, eres la siguiente parada! ✨
                }
              }
              @case ('InTransit') { ¡Prepárate, el auto va directo a tu casa! 🎉 }
              @case ('Delivered') { Tu pedido fue entregado, muchas gracias por hacernos parte de tu estilo 🌸 }
              @case ('NotDelivered') { No se logró entregar. Porfa contacta a tu vendedora 💌 }
              @case ('Canceled') { Este pedido ha sido cancelado. 💔 }
              @default { Estamos procesando tu pedido, pronto tendrás novedades 💕 }
            }
          </div>

          <!-- Pending Confirmation Card -->
          @if (o.status === 'Pending') {
            <div id="confirm-card" class="bg-white/80 backdrop-blur-xl rounded-3xl p-6 mb-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/80 text-center animate-fade-in-up transform transition duration-500">
              <div class="mx-auto w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mb-3 shadow-inner">
                <span id="confirm-card-icon" class="text-3xl">✨</span>
              </div>
              <h3 class="text-xl font-bold text-pink-900 mb-2 font-display">¡Tu pedido te espera!</h3>
              <p class="text-sm text-pink-700/80 mb-5 px-2">Ya verificamos todo. Confirma aquí abajo para empezar a prepararlo cuidando cada detalle.</p>
              
              <button id="confirm-btn" 
                      class="relative w-full py-5 rounded-full bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500 text-white font-black uppercase tracking-widest overflow-hidden shadow-[0_10px_30px_rgba(244,114,182,0.4)] active:scale-95 transition-transform"
                      (click)="confirmOrder($event)"
                      (touchstart)="btnTouchStart()"
                      (touchend)="btnTouchEnd()"
                      (mousemove)="btnMouseMove($event)"
                      (mouseleave)="btnMouseLeave()">
                
                <!-- Holographic Shine Layer -->
                <div id="btn-hologram" class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-0 pointer-events-none transform -skew-x-12 translate-x-[-100%]"></div>
                
                <span class="relative z-10 flex items-center justify-center gap-3">
                  ¡Sí, Confirmar Pedido! <span id="btn-heart-icon" class="text-xl">💖</span>
                </span>
              </button>
            </div>
          }


          <!-- Tracking Timeline (Amazon Style) -->
          <div class="bg-white/70 backdrop-blur-xl rounded-3xl p-5 mb-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 animate-fade-in-up" style="animation-delay: 150ms">
            <h3 class="text-lg font-black text-pink-900 mb-4 font-display text-center">Historial de tu pedido</h3>
            
            <div class="flex flex-col pl-2">
              @for (step of timelineSteps(); track $index) {
                <div class="flex gap-4 relative min-h-[70px] transition-opacity duration-300"
                     [class.opacity-50]="!step.done && !step.active"
                     [class.opacity-100]="step.done || step.active">
                  
                  <!-- Indicator -->
                  <div class="flex flex-col items-center z-10 w-10">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-white border-2 shadow-sm transition-all duration-500"
                         [ngClass]="{
                           'border-pink-400 bg-pink-50 scale-105': step.done,
                           'border-rose-500 bg-rose-50 shadow-[0_0_15px_rgba(244,63,94,0.3)] scale-110 animate-bounce-subtle': step.active && step.icon !== '❌',
                           'border-red-500 bg-red-50 scale-110': step.icon === '❌',
                           'border-gray-200': !step.done && !step.active
                         }">
                      {{ step.icon }}
                    </div>
                    @if (!$last) {
                      <div class="w-[3px] flex-grow my-1 rounded-full transition-all duration-1000 origin-top"
                           [ngClass]="{
                             'bg-pink-400': step.done,
                             'bg-[length:100%_200%] bg-gradient-to-b from-pink-400 via-pink-200 to-pink-500 animate-shimmer scale-y-100': step.active && step.icon !== '❌',
                             'bg-gray-200': !step.done && !step.active
                           }"></div>
                    }
                  </div>
                  
                  <!-- Content -->
                  <div class="flex-1 pt-2 pb-6">
                    <span class="block font-bold text-sm mb-0.5"
                          [ngClass]="{
                            'text-pink-900': step.done || step.active,
                            'text-rose-600 text-base': step.active && step.icon !== '❌',
                            'text-red-600 text-base': step.icon === '❌',
                            'text-gray-500': !step.done && !step.active
                          }">{{ step.label }}</span>
                    
                    @if (step.date) {
                      <span class="block text-xs font-mono text-pink-500/70">{{ step.date | date:'shortTime' }}</span>
                    } @else {
                      <span class="block text-xs font-mono text-gray-400 italic">Pendiente</span>
                    }
                  </div>
                </div>
              }
            </div>
            
            <!-- Driver Nearby Alert (Timeline context backup) -->
            @if (isNearby() && o.deliveriesAhead !== 0) {
              <div class="mb-4 p-4 rounded-3xl bg-blue-50 border-2 border-blue-200 border-dashed animate-bounce-slow flex items-center gap-3">
                <div class="text-3xl animate-wiggle">🚗</div>
                <div class="flex-1">
                  <p class="font-bold text-blue-900 leading-tight">¡El repartidor está cerca!</p>
                  <p class="text-xs text-blue-700">Ten tu pago listo y mantente atenta ✨</p>
                </div>
                <div class="animate-ping w-3 h-3 bg-blue-500 rounded-full"></div>
              </div>
            }
          </div>

          <!-- Order Items & Totals (TICKET STYLE) -->
          <div id="order-ticket" class="relative items-ticket bg-white/90 backdrop-blur-2xl rounded-3xl p-6 mb-6 shadow-[0_15px_40px_rgb(0,0,0,0.05)] border border-white isolate animate-fade-in-up" style="animation-delay: 300ms">
            <!-- Jagged Top & Bottom Edges (Pseudo elements in CSS handle this) -->
            <div class="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-pink-100/50 rounded-full blur-xl -z-10"></div>
            
            <h3 class="text-xl font-black text-pink-900 mb-5 font-display text-center relative">
              <span class="bg-gradient-to-r from-transparent via-pink-100 to-transparent px-4 py-1 rounded-full absolute -ml-4 -mt-1 opacity-50 inset-0 -z-10 blur-sm"></span>
              Tu Ticket de Compra 🛍️
            </h3>
            
            <!-- Items -->
            <div class="space-y-4 mb-6 relative">
              @for (item of o.items; track item.id) {
                <div class="order-item flex justify-between items-center relative pl-3 group opacity-0">
                  <!-- Cute bullet -->
                  <div class="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-pink-300 group-hover:scale-150 transition-transform"></div>
                  <div class="flex flex-col">
                    <span class="font-bold text-pink-900 text-sm leading-tight">{{ item.productName }}</span>
                    <span class="text-xs text-pink-500/70 font-medium mt-0.5">x{{ item.quantity }} @if(item.quantity>1){<span class="opacity-50 text-[10px]">({{ item.unitPrice | currency:'MXN':'symbol-narrow' }})</span>}</span>
                  </div>
                  @if (item.unitPrice > 0) {
                    <span class="font-black text-pink-600 whitespace-nowrap ml-2">{{ item.lineTotal | currency:'MXN':'symbol-narrow' }}</span>
                  }
                </div>
              }
            </div>

            <!-- Ticket Perforation Line -->
            <div id="ticket-line" class="w-full border-t-[3px] border-dotted border-pink-200 my-5 relative">
              <!-- Side cutouts -->
              <div class="absolute -left-8 -top-[14px] w-6 h-6 bg-gradient-to-r from-pink-50 to-transparent rounded-full border-r border-white/60 shadow-inner"></div>
              <div class="absolute -right-8 -top-[14px] w-6 h-6 bg-gradient-to-l from-pink-50 to-transparent rounded-full border-l border-white/60 shadow-inner"></div>
            </div>

            <!-- Totals -->
            <div id="ticket-totals" class="bg-rose-50/70 rounded-2xl p-5 border border-rose-100/50 relative overflow-hidden opacity-0">
              <div class="absolute right-0 bottom-0 opacity-5 text-8xl -mr-6 -mb-6 rotate-12 pointer-events-none">🧾</div>
              
              <div class="flex justify-between text-sm font-medium text-pink-800/80 mb-2.5">
                <span>Subtotal</span>
                <span>{{ o.subtotal | currency:'MXN':'symbol-narrow' }}</span>
              </div>
              
              @if (o.shippingCost > 0) {
                <div class="flex justify-between text-sm font-medium text-pink-800/80 mb-2.5">
                  <span class="flex items-center gap-1">Envío <span class="text-xs">🛵</span></span>
                  <span>{{ o.shippingCost | currency:'MXN':'symbol-narrow' }}</span>
                </div>
              }

              <div class="flex justify-between text-base font-black text-pink-900 border-t border-pink-200/50 mt-3 pt-3 mb-3">
                <span>Total Final</span>
                <span class="drop-shadow-sm">{{ o.total | currency:'MXN':'symbol-narrow' }}</span>
              </div>

              @if (totalAbonado() > 0) {
                <div class="flex justify-between text-sm font-bold text-emerald-700 bg-emerald-100/60 shadow-inner -mx-3 px-3 py-2 rounded-xl mb-3 border border-emerald-200/50">
                  <span class="flex items-center gap-1">Abonado @if((o.payments?.length ?? 0) > 1) { <small class="opacity-70 bg-emerald-200/50 px-1.5 rounded-md text-[10px]">x{{o.payments?.length}}</small> }</span>
                  <span>- {{ totalAbonado() | currency:'MXN':'symbol-narrow' }}</span>
                </div>
              }

              <div class="flex justify-between items-end mt-4 pt-4 border-t-2 border-pink-200/80 relative"
                   [ngClass]="(o.balanceDue || 0) <= 0 ? 'text-emerald-500' : 'text-rose-600'">
                <span class="font-black text-xs uppercase tracking-wider">{{ (o.balanceDue || 0) <= 0 ? '¡Liquidado! ✅' : 'Restante a Pagar' }}</span>
                @if ((o.balanceDue || 0) > 0) {
                  <span class="font-black text-3xl font-display leading-none drop-shadow-md">{{ o.balanceDue | currency:'MXN':'symbol-narrow' }}</span>
                }
              </div>
            </div>
          </div>


          <!-- Gamification: VIP Reveal (Only when delivered) -->
          @if (o.status === 'Delivered' && (o.clientType === 'Frecuente' || o.clientType === 'VIP')) {
            <div class="bg-gradient-to-r from-purple-100 to-pink-100 rounded-3xl p-5 mb-6 shadow-[0_8px_25px_rgba(216,180,254,0.4)] border border-purple-200/50 animate-fade-in-up transition-all duration-500" style="animation-delay: 400ms">
              @if (!showSurprise()) {
                <div class="text-center cursor-pointer group" (click)="revealSurprise()">
                  <div class="text-5xl drop-shadow-[0_0_15px_rgba(216,180,254,0.8)] animate-pulse mb-3 group-hover:scale-110 transition-transform">💎</div>
                  <h3 class="text-lg font-black text-purple-900 font-display">¡Eres una Chica {{ o.clientType }}!</h3>
                  <p class="text-xs font-bold text-purple-700/80 mb-3">Te hemos preparado una sorpresita...</p>
                  <button class="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold px-6 py-2 rounded-full shadow-md animate-bounce-subtle">
                    Toca para revelar 🎁
                  </button>
                </div>
              } @else {
                <div class="text-center animate-bounce-in-up">
                  <div class="text-5xl mb-3">✨🎉</div>
                  <h3 class="text-xl font-black text-pink-600 font-display">¡Acumulaste {{ o.clientPoints }} RegiPuntos!</h3>
                  <p class="text-sm font-bold text-purple-900/90 leading-snug my-2">En tu próxima compra, indícale a tu vendedora que ya tienes tus puntos para canjear increíbles premios.</p>
                  <div class="inline-block px-4 py-2 bg-white/60 rounded-xl border border-pink-200 border-dashed text-pink-800 font-mono font-bold mt-2 shadow-sm">
                    CÓDIGO: VIP-{{ o.clientName.substring(0,3).toUpperCase() }}{{ o.clientPoints }} ✨
                  </div>
                </div>
              }
            </div>
          } @else if (o.clientType === 'Frecuente' || o.clientType === 'VIP') {
            <!-- Original Loyalty Banner (SHIMMER EFFECT) for non-delivered -->
            <div class="relative overflow-hidden bg-gradient-to-r from-purple-100 to-pink-100 rounded-3xl p-5 mb-6 shadow-[0_8px_25px_rgba(216,180,254,0.4)] border border-purple-200/50 flex items-center gap-4 animate-fade-in-up isolate hover:scale-[1.02] transition-transform" style="animation-delay: 400ms">
              <!-- Holographic Shimmer -->
              <div class="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent -z-10 skew-x-12"></div>
              
              <div class="text-5xl drop-shadow-[0_0_15px_rgba(216,180,254,0.8)] animate-pulse-slow">💎</div>
              <div>
                <span class="inline-block px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full mb-1.5 shadow-md">
                  Chica {{ o.clientType }}
                </span>
                <p class="text-xs font-bold text-purple-900/90 leading-snug">¡Eres lo máximo! ✨ Tienes <span class="bg-purple-200 text-purple-900 px-1 rounded">{{ o.clientPoints }} RegiPuntos</span> acumulados para canjear pronto.</p>
              </div>
            </div>
          }

          <!-- Payment Methods -->
          <div class="relative z-10 animate-fade-in-up" style="animation-delay: 500ms">
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
                      <div class="flex justify-between items-center mb-2">
                        <span class="text-xs text-blue-700/70 font-medium">Número de Tarjeta:</span>
                      </div>
                      <div class="flex justify-between items-center">
                        <span class="font-mono font-bold text-blue-900 tracking-wider text-sm">5256 7861 3758 3898</span>
                        <button class="bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-blue-600 active:scale-95 transition-all"
                                (click)="copyText('5256786137583898')">COPIAR</button>
                      </div>
                    </div>
                    <p class="text-[10px] text-blue-700/80 text-center font-medium relative z-10">A nombre de: Yazmin Vara<br>Envía tu comprobante a tu vendedora ✨</p>
                  </div>
                }
                @case ('oxxo') {
                  <div class="bg-gradient-to-br from-red-50 to-orange-50 rounded-3xl p-5 border border-red-100 shadow-sm animate-fade-in relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 text-7xl opacity-10 rotate-12">🏪</div>
                    <div class="flex items-center gap-3 mb-4 relative z-10">
                      <div class="text-3xl">🏪</div>
                      <div>
                        <h4 class="font-bold text-red-900 text-sm leading-tight">Depósito en Efectivo</h4>
                        <span class="text-xs font-bold text-red-600 uppercase">OXXO (BBVA)</span>
                      </div>
                    </div>
                    <div class="bg-white/60 rounded-xl p-3 border border-red-200/50 relative z-10 mb-3">
                      <div class="flex justify-between items-center mb-2">
                        <span class="text-xs text-red-700/70 font-medium">Número de Tarjeta:</span>
                      </div>
                      <div class="flex justify-between items-center">
                        <span class="font-mono font-bold text-red-900 tracking-wider text-sm">4152 3144 9667 1333</span>
                        <button class="bg-red-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-red-600 active:scale-95 transition-all"
                                (click)="copyText('4152314496671333')">COPIAR</button>
                      </div>
                    </div>
                    <p class="text-[10px] text-red-700/80 text-center font-medium relative z-10">A nombre de: Regi Bazar<br>Envía foto del ticket a tu vendedora ✨</p>
                  </div>
                }
              }
            </div>
          </div>
          
          <!-- Social Media Invite -->
          <div class="bg-gradient-to-br from-indigo-50 to-pink-50 rounded-3xl p-6 mb-6 mt-8 shadow-sm border border-indigo-100/50 text-center animate-fade-in relative overflow-hidden group">
            <div class="absolute -right-6 -bottom-6 text-7xl opacity-5 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-500">📸</div>
            <div class="absolute -left-4 top-2 text-4xl opacity-10 -rotate-12 group-hover:-rotate-45 group-hover:scale-110 transition-transform duration-500">✨</div>
            
            <h3 class="text-pink-600 font-display font-black text-2xl mb-2">¡Presume tu estilo! 📸</h3>
            <p class="text-indigo-900/80 text-xs font-medium px-4 mb-4 leading-relaxed">Etiquétanos en tus historias de Facebook o Instagram al recibir tu pedido y <strong>gana RegiPuntos extra</strong> en tu siguiente compra ✨</p>
            
            <div class="flex justify-center gap-4 relative z-10">
              <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" class="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#1877f2] to-[#1259b6] text-white flex items-center justify-center text-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-110 active:scale-95 transition-all font-serif italic pr-1">
                f
              </a>
              <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white flex items-center justify-center text-xl shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-110 active:scale-95 transition-all font-bold">
                IG
              </a>
            </div>
            <p class="text-[10px] font-bold text-purple-500/70 mt-3 tracking-widest uppercase">@RegiBazar</p>
          </div>
          
          <p class="text-center mt-6 mb-6 font-script text-rose-400 text-lg opacity-80 decoration-wavy underline decoration-pink-200">
            Hecho con 🎀 para ti
          </p>

        } <!-- end if order -->
      </div>
      
      <!-- Action Toast Notification -->
      @if (toastVisible()) {
        <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-bounce-in-up">
          <div class="bg-gray-900/90 backdrop-blur-md text-white text-sm font-medium px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-2.5 border border-pink-500/30">
            <span class="text-xl">✨</span>
            <span class="whitespace-nowrap font-bold">{{ toastMessage() }}</span>
          </div>
        </div>
      }

      <!-- WhatsApp FAB (Z-30) -->
      @if (order() && isUnboxed()) {
        <a href="https://wa.me/?text=Hola,%20tengo%20una%20duda%20sobre%20mi%20pedido%20de%20Regi%20Bazar%20%E2%9C%A8" 
           target="_blank"
           class="fixed bottom-6 right-6 z-30 w-14 h-14 bg-emerald-500/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-[0_10px_25px_rgba(16,185,129,0.5)] border border-emerald-400/50 hover:scale-110 hover:-translate-y-1 transition-all animate-bounce-in-up">
          <span class="text-3xl text-white">💬</span>
          <span class="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
        </a>
      }
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

  // Timeline State
  timelineSteps = signal<{ label: string, date: Date | null, done: boolean, active: boolean, icon: string }[]>([]);

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
  }

  // Generate Greeting based on time
  greeting() {
    const hr = new Date().getHours();
    if (hr < 12) return '¡Buenos días';
    if (hr < 19) return '¡Buenas tardes';
    return '¡Buenas noches';
  }

  ngOnDestroy() {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  loadOrder() {
    this.api.publicGetOrder(this.accessToken).subscribe({
      next: (data) => {
        this.order.set(data);
        this.buildTimeline(data.status);
        this.loading.set(false);

        // Check Unboxing Session Status
        const unboxedKey = `regibazar_unboxed_${data.id}`;
        if (!sessionStorage.getItem(unboxedKey)) {
          this.isUnboxed.set(false);
        } else {
          this.isUnboxed.set(true);
        }

        // Trigger confetti ONLY if Delivered on first load and already unboxed
        if (data.status === 'Delivered' && this.isUnboxed()) {
          setTimeout(() => this.fireConfetti('unboxing'), 500);
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
        label: 'Pedido Recibido',
        date: new Date(o.createdAt),
        done: currentIdx > 0,
        active: currentIdx === 0,
        icon: '📝'
      },
      {
        label: 'Confirmado',
        date: currentIdx >= 1 ? new Date() : null,
        done: currentIdx > 1,
        active: currentIdx === 1,
        icon: '💖'
      },
      {
        label: 'Empacado y Enviado',
        date: currentIdx >= 2 ? new Date() : null,
        done: currentIdx > 2,
        active: currentIdx === 2,
        icon: '📦'
      },
      {
        label: 'En Camino',
        date: currentIdx >= 3 ? new Date() : null,
        done: currentIdx > 3 || status === 'InTransit',
        active: currentIdx === 3 || status === 'InTransit',
        icon: '🚗'
      },
      {
        label: 'Entregado',
        date: currentIdx >= 5 ? new Date() : null,
        done: currentIdx === 5,
        active: currentIdx === 5,
        icon: '✅'
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
        setTimeout(() => this.animateTicketReveal(), 50);
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
    const tl = gsap.timeline();

    // Stagger in the order items
    tl.fromTo('.order-item',
      { opacity: 0, x: -20, scale: 0.9 },
      { opacity: 1, x: 0, scale: 1, duration: 0.5, stagger: 0.1, ease: "back.out(1.7)" }
    );

    // Animate the perforation line
    tl.fromTo('#ticket-line',
      { scaleX: 0, opacity: 0 },
      { scaleX: 1, opacity: 1, duration: 0.8, ease: "expo.out" },
      "-=0.3"
    );

    // Fade in totals
    tl.fromTo('#ticket-totals',
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

}
