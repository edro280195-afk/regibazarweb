import { Component, OnInit, OnDestroy, signal, ElementRef, ViewChild, Inject, LOCALE_ID } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { SignalRService } from '../../../../core/services/signalr.service';
import { PushNotificationService } from '../../../../core/services/push-notification.service';
import { ClientOrderView, LoyaltySummary } from '../../../../shared/models/models';

declare var google: any;

import { GoogleMapsModule, GoogleMap, MapDirectionsRenderer, MapMarker } from '@angular/google-maps';

@Component({
  selector: 'app-order-view',
  standalone: true,
  imports: [CommonModule, GoogleMapsModule, MapDirectionsRenderer, MapMarker, FormsModule],
  template: `
    <div class="client-page">
      <div class="deco deco-1">🌸</div>
      <div class="deco deco-2">✨</div>
      <div class="deco deco-3">🎀</div>

      @if (loading()) {
        <div class="loading-screen">
          <div class="loader"></div>
          <p>Cargando tu pedido... 🛍️</p>
        </div>
      }

      @if (expired()) {
        <div class="error-screen">
          <span class="error-icon">⏰</span>
          <h2>Enlace expirado</h2>
          <p>Este enlace ya no está disponible. Contacta a tu vendedora para más información 💕</p>
        </div>
      }

      @if (notFound()) {
        <div class="error-screen">
          <span class="error-icon">🔍</span>
          <h2>Pedido no encontrado</h2>
          <p>Verifica que el enlace sea correcto, bonita 💖</p>
        </div>
      }

      @if (order(); as o) {
        <div class="client-header">
          <span class="header-ribbon">🎀</span>
          <h1>¡Hola, {{ o.clientName }}! 💖</h1>
          <p class="subtitle">Aquí está el detalle de tu pedido</p>
          <button class="btn-notify" (click)="enableNotifications(o.clientId)">
            Activar Notificaciones 🔔
          </button>
        </div>

        @if (o.status === 'Pending') {
          <div class="confirm-action-section fade-in">
            <div class="confirm-card">
              <h3>¡Tu pedido está listo! ✨</h3>
              <p>Revisa los detalles abajo y confirma cuando estés lista para recibirlo.</p>
              <button class="btn-confirm-order" (click)="confirmOrder()">
                Sí, Confirmar Pedido 💖
              </button>
            </div>
          </div>
        }

        <!-- ⏳ Countdown Section (Moved UP) -->
        @if (deliveryDate() && (o.status === 'Pending' || o.status === 'InRoute' || o.status === 'InTransit')) {
          <div class="countdown-section">
            <h3>⏳ Tiempo para tu entrega</h3>
            <div class="countdown-timer">
              <div class="time-block">
                <span class="time-val">{{ countdown().days }}</span>
                <span class="time-label">Días</span>
              </div>
              <div class="time-block">
                <span class="time-val">{{ countdown().hours }}</span>
                <span class="time-label">Hrs</span>
              </div>
              <div class="time-block">
                <span class="time-val">{{ countdown().minutes }}</span>
                <span class="time-label">Mins</span>
              </div>
              <div class="time-block">
                <span class="time-val">{{ countdown().seconds }}</span>
                <span class="time-label">Segs</span>
              </div>
            </div>
            <p class="delivery-date-hint">
              @if (o.status === 'Pending') {
                Tu entrega está programada para el <strong>{{ deliveryDateFormatted() }}</strong> 📅
              } @else {
                <strong>{{ deliveryDateFormatted() }}</strong>
              }
              <br>
              <span class="delivery-reason">{{ deliveryReason() }}</span>
            </p>
          </div>
        }

        <div class="timeline-container">
          <div class="timeline-card">
            <h3 class="timeline-title">Estado de tu pedido</h3>
            
            <div class="timeline-track">
              @for (step of timelineSteps(); track $index) {
                <div class="timeline-step" [class.completed]="step.done" [class.active]="step.active">
                  
                  <div class="step-indicator">
                    <div class="step-icon">{{ step.icon }}</div>
                    @if (!$last) {
                      <div class="step-line" [class.filled]="step.done"></div>
                    }
                  </div>
                  
                  <div class="step-content">
                    <span class="step-label">{{ step.label }}</span>
                    @if (step.date) {
                      <span class="step-date">{{ step.date | date:'shortTime' }}</span>
                    } @else {
                      <span class="step-date pending">Pendiente</span>
                    }
                  </div>
                </div>
              }
            </div>
            
            <div class="status-alert" [attr.data-status]="o.status">
              @switch (o.status) {
                @case ('Pending') { <p>Tu pedido está listo, pronto saldrá a entrega ✨</p> }
                @case ('Shipped') { <p>Tu pedido está empacado y listo ✨</p> }
                @case ('InRoute') { 
                  <p>Tu pedido en camino. 
                    @if ((o.deliveriesAhead ?? 0) > 0) {
                      El repartidor tiene entregas antes de ti 💕
                    } @else {
                      ¡Prepárate, eres la siguiente parada! ✨
                    }
                  </p> 
                }
                @case ('InTransit') { <p>¡Prepárate, tu pedido está a punto de llegar! 🎉</p> }
                @case ('Delivered') { <p>Tu pedido fue entregado, muchas gracias por tu compra 🌸</p> }
                @case ('NotDelivered') { <p>No se pudo entregar. Contacta a tu vendedora para reprogramar 💌</p> }
                @default { <p>Consultando estado... 🔍</p> }
              }
            </div>
          </div>
        </div>

        @if (o.status === 'InRoute' && o.queuePosition && o.totalDeliveries) {
          <div class="queue-info">
            @if ((o.deliveriesAhead ?? 0) === 0) {
              <div class="queue-position">
                <span class="queue-label">¡Eres la siguiente entrega en la ruta! 🚗</span>
              </div>
            } @else {
              <div class="queue-position">
                <span class="queue-number">{{ o.deliveriesAhead }}</span>
                <span class="queue-label">entregas antes de la tuya</span>
              </div>
            }

            <div class="queue-bar">
              @for (i of getQueueDots(o); track $index) {
                <div class="queue-dot" [class.done]="i.done" [class.current]="i.current" [class.you]="i.you">
                  @if (i.you) { <span>tú</span> }
                </div>
              }
            </div>
            
            @if ((o.deliveriesAhead ?? 0) > 0) {
              <p class="queue-hint">Eres la entrega #{{ o.queuePosition }} de {{ o.totalDeliveries }} 📍</p>
            }
          </div>
        }

        @if (o.status === 'InTransit') {
          <div class="transit-alert">
            <div class="transit-icon-wrap">
              <span class="transit-icon">🚗</span>
              <div class="transit-pulse"></div>
            </div>
            <p>¡Eres la siguiente entrega! El repartidor viene en camino hacia ti.</p>
          </div>
        }

        @if (showMap()) {
          <div class="map-section">
            <h3>📍 ¿Dónde va tu pedido?</h3>
            
            <div class="map-wrapper-beautiful">
              <google-map 
                #googleMap
                height="100%" 
                width="100%" 
                [options]="mapOptions"
                [center]="centerSignal()"
                [zoom]="zoomSignal()">
                
                @if (driverPos()) {
                  <map-marker 
                    [position]="driverPos()!" 
                    [options]="driverMarkerOptions">
                  </map-marker>
                }

                @if (clientPos()) {
                  <map-marker 
                    [position]="clientPos()!" 
                    [options]="clientMarkerOptions">
                  </map-marker>
                }

                @if (o.status === 'InTransit' && directionsResult()) {
                  <map-directions-renderer 
                    [directions]="directionsResult()!"
                    [options]="rendererOptions">
                  </map-directions-renderer>
                }
              </google-map>
            </div>

            @if (!driverPos()) {
              <p class="map-hint">El repartidor aún no ha compartido su ubicación, espera un poquito ✨</p>
            }
          </div>
        }

        <div class="order-section">
          <div class="order-header-row">
            <h3>Tu pedido 🛍️</h3>
          </div>
          
          <div class="items-list">
            @for (item of o.items; track item.id) {
              <div class="item-row">
                <div class="item-info">
                  <span class="item-name">{{ item.productName }}</span>
                  <span class="item-qty">×{{ item.quantity }}</span>
                </div>
                @if (item.unitPrice > 0) {
                  <span class="item-price">\${{ item.lineTotal | number:'1.2-2' }}</span>
                }
              </div>
            }
          </div>

          <div class="order-totals">
            @if (o.subtotal > 0) {
               <div class="total-row"><span>Subtotal</span><span>\${{ o.subtotal | number:'1.2-2' }}</span></div>
            }
            @if (o.shippingCost > 0) {
               <div class="total-row"><span>Envío 🚗</span><span>\${{ o.shippingCost | number:'1.2-2' }}</span></div>
            }
            <div class="total-row grand"><span>Total a pagar</span><span>\${{ o.total | number:'1.2-2' }}</span></div>
          </div>
        </div>

        @if (loyalty(); as l) {
          <div class="loyalty-banner">
            <div class="lb-icon">💎</div>
            <div class="lb-info">
              <span class="lb-tier">{{ l.tier }}</span>
              <div class="lb-points">
                <strong>{{ l.currentPoints }}</strong> RegiPuntos
              </div>
              <p class="lb-promo">¡Por cada $100 m.n. acumulas 10 RegiPuntos! 🌸 Acumula y obtén beneficios.</p>
            </div>
          </div>
        }
        
        <div class="payment-section">
          <h3>Formas de Pago 💸</h3>
          <p class="pay-hint">Elige cómo quieres pagar hoy ✨</p>
          
          <div class="payment-tabs">
            <button class="pay-tab" [class.active]="paymentTab() === 'cash'" (click)="paymentTab.set('cash')">💵 Efectivo</button>
            <button class="pay-tab" [class.active]="paymentTab() === 'transfer'" (click)="paymentTab.set('transfer')">🏦 Transferencia</button>
            <button class="pay-tab" [class.active]="paymentTab() === 'oxxo'" (click)="paymentTab.set('oxxo')">🏪 Depósito</button>
          </div>

          <div class="payment-content">
            @switch (paymentTab()) {
              @case ('cash') {
                <div class="pay-card cash fade-in">
                  <div class="pay-header">
                     <span class="pay-icon">💵</span>
                     <div><strong>Pago al recibir tu pedido</strong><span class="bank-name">Efectivo</span></div>
                  </div>
                  <p class="cash-hint">Por favor ten el monto exacto listo para agilizar tu entrega 💕</p>
                </div>
              }
              @case ('transfer') {
                <div class="pay-card banamex fade-in">
                  <div class="pay-header">
                    <span class="pay-icon">🏦</span>
                    <div><strong>Transferencia</strong><span class="bank-name">Citibanamex</span></div>
                  </div>
                  <div class="card-details">
                    <div class="card-row">
                      <span class="card-label">Tarjeta:</span>
                      <span class="card-num">5256 7861 3758 3898</span>
                      <button class="btn-copy-card" (click)="copyText('5256786137583898')">Copiar</button>
                    </div>
                    <div class="card-row">
                      <span class="card-label">Nombre:</span>
                      <span class="card-name">Sandra Y Vara Portilla</span>
                    </div>
                  </div>
                  <p class="cash-hint">Envía tu comprobante a la vendedora ✨</p>
                </div>
              }
              @case ('oxxo') {
                <div class="pay-card oxxo fade-in">
                  <div class="pay-header">
                    <span class="pay-icon">🏪</span>
                    <div><strong>Depósito</strong><span class="bank-name">OXXO (BBVA)</span></div>
                  </div>
                  <div class="card-details">
                    <div class="card-row">
                      <span class="card-label">Tarjeta:</span>
                      <span class="card-num">4152 3144 9667 1333</span>
                      <button class="btn-copy-card" (click)="copyText('4152314496671333')">Copiar</button>
                    </div>
                  </div>
                </div>
              }
            }
          </div>
        </div>
        
        <p class="footer-msg">Hecho con 💗 para ti</p>
      }

      @if (toastVisible()) {
        <div class="toast-notification">
          <span class="toast-icon">✨</span>
          <span>{{ toastMessage() }}</span>
        </div>
      }

      @if (order()?.status === 'InRoute' || order()?.status === 'InTransit') {
        <button class="floating-chat-btn" (click)="toggleChat()">
          💬
        </button>
      }

      @if (showChat()) {
        <div class="chat-modal-overlay" (click)="toggleChat()">
          <div class="chat-modal" (click)="$event.stopPropagation()">
            <div class="chat-header">
              <div>
                <strong>Repartidor de Regi Bazar</strong>
                <span class="status-text">En camino 🚗</span>
              </div>
              <button class="btn-close" (click)="toggleChat()">✕</button>
            </div>
            
            <div class="chat-body" #clientChatScroll>
              @if (chatMessages().length === 0) {
                <p class="chat-empty">Escríbele a tu repartidor si necesitas darle indicaciones ✨</p>
              }
              @for (msg of chatMessages(); track msg.id) {
                <div class="msg-bubble" [class.me]="msg.sender === 'Client'" [class.them]="msg.sender === 'Driver'">
                  {{ msg.text }}
                  <span class="time">{{ msg.timestamp | date:'shortTime' }}</span>
                </div>
              }
            </div>

            <div class="chat-input">
              <input type="text" [(ngModel)]="newChatMessage" (keydown.enter)="sendChat()" placeholder="Mensaje...">
              <button (click)="sendChat()" [disabled]="!newChatMessage.trim()">➤</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .client-page { min-height: 100vh; background: linear-gradient(180deg, #FFF0F5 0%, #FFF5F9 50%, #F3E5F5 100%); padding: 1.25rem; padding-bottom: 80px; max-width: 480px; margin: 0 auto; position: relative; overflow-x: hidden; font-family: 'Segoe UI', Roboto, sans-serif; }
    .deco { position: absolute; font-size: 1.8rem; animation: float 5s ease-in-out infinite; opacity: 0.35; pointer-events: none; }
    .deco-1 { top: 5%; right: 8%; } .deco-2 { top: 40%; left: 5%; animation-delay: 1.5s; font-size: 1.3rem; } .deco-3 { bottom: 10%; right: 12%; animation-delay: 3s; }
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

    .loading-screen, .error-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; color: var(--text-light); position: relative; z-index: 1; p { margin: 0.5rem 0 0; } }
    .loader { width: 40px; height: 40px; border: 3px solid rgba(255,107,157,0.2); border-top-color: var(--pink-500); border-radius: 50%; animation: spin 0.7s linear infinite; margin-bottom: 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-icon { font-size: 3rem; margin-bottom: 1rem; }
    .error-screen h2 { color: var(--text-dark); margin: 0 0 0.5rem; font-family: var(--font-display); }

    .client-header { text-align: center; margin-bottom: 1.5rem; position: relative; z-index: 1;
      .header-ribbon { font-size: 2rem; display: block; margin-bottom: 0.25rem; animation: bow-sway 3s ease-in-out infinite; }
      @keyframes bow-sway { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
      h1 { font-family: var(--font-display); color: var(--pink-600); font-size: 1.6rem; margin: 0; text-shadow: 0 2px 4px rgba(236,72,153,0.1); }
      .subtitle { font-family: var(--font-script); color: var(--rose-gold); font-size: 1.1rem; margin: 0.15rem 0 0; }
      .btn-notify { margin-top: 1rem; background: var(--pink-100); color: var(--pink-600); border: 2px solid var(--pink-200); padding: 8px 16px; border-radius: 20px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-size: 0.85rem; box-shadow: 0 4px 10px rgba(255,107,157,0.1); }
      .btn-notify:hover { background: var(--pink-500); color: white; border-color: var(--pink-400); transform: translateY(-2px); }
    }

    /* 🔥 TIMELINE V2 (AMAZON STYLE) 🔥 */
    .timeline-container { position: relative; z-index: 1; margin-bottom: 1.5rem; animation: fadeInUp 0.5s ease; }
    .timeline-card { background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); border-radius: 1.5rem; padding: 1.25rem; box-shadow: 0 6px 20px rgba(0,0,0,0.04); border: 1px solid rgba(255,255,255,0.6); }
    .timeline-title { color: var(--text-dark); font-family: var(--font-display); font-size: 1.1rem; margin: 0 0 1rem 0; text-align: center; }
    
    .timeline-track { display: flex; flex-direction: column; gap: 0; margin-bottom: 1rem; padding-left: 0.5rem; }
    .timeline-step { display: flex; gap: 1rem; position: relative; min-height: 60px; opacity: 0.6; transition: opacity 0.3s ease; }
    .timeline-step.completed, .timeline-step.active { opacity: 1; }
    
    .step-indicator { display: flex; flex-direction: column; align-items: center; width: 36px; z-index: 2; }
    .step-icon { width: 32px; height: 32px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 1rem; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.05); z-index: 2; transition: all 0.3s ease; }
    .timeline-step.completed .step-icon { background: var(--pink-100); border-color: var(--pink-400); transform: scale(1.05); }
    .timeline-step.active .step-icon { background: var(--pink-500); border-color: white; box-shadow: 0 0 0 4px rgba(236,72,153,0.2); animation: pulse-icon 2s infinite; font-size: 1.1rem; }
    
    .step-line { width: 3px; flex-grow: 1; background: #e5e7eb; margin: 4px 0; border-radius: 2px; transition: background 0.3s ease; }
    .step-line.filled { background: var(--pink-400); }
    
    .step-content { flex: 1; padding-top: 4px; padding-bottom: 1rem; }
    .step-label { display: block; font-weight: 700; color: var(--text-dark); font-size: 0.95rem; margin-bottom: 0.15rem; }
    .step-date { display: block; font-size: 0.75rem; color: var(--text-medium); font-family: monospace; }
    .step-date.pending { color: #a1a1aa; font-style: italic; }
    
    .timeline-step.active .step-label { color: var(--pink-600); font-size: 1.05rem; }
    .timeline-step.active .step-date { color: var(--pink-500); font-weight: 600; }
    
    .status-alert { margin-top: 0.5rem; padding: 0.8rem; border-radius: 0.75rem; background: rgba(243,244,246,0.6); font-size: 0.85rem; text-align: center; color: var(--text-dark); border: 1px dashed rgba(0,0,0,0.1); }
    .status-alert p { margin: 0; line-weight: 1.4; font-weight: 500; }
    
    @keyframes pulse-icon { 0% { box-shadow: 0 0 0 0 rgba(236,72,153,0.4); } 70% { box-shadow: 0 0 0 8px rgba(236,72,153,0); } 100% { box-shadow: 0 0 0 0 rgba(236,72,153,0); } }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

    .loyalty-banner { background: linear-gradient(135deg, rgba(255,240,247,0.8) 0%, rgba(255,255,255,0.8) 100%); backdrop-filter: blur(10px); border: 1px solid rgba(252, 231, 243, 0.6); border-radius: 1.25rem; padding: 1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem; position: relative; z-index: 1; box-shadow: 0 8px 20px rgba(236, 72, 153, 0.08); }
    .lb-icon { font-size: 2rem; background: rgba(255,255,255,0.8); width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid #fce7f3; }
    .lb-info { flex: 1; }
    .lb-tier { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; color: var(--pink-600); font-weight: 800; background: rgba(252, 231, 243, 0.5); padding: 2px 8px; border-radius: 10px; }
    .lb-points { font-size: 1rem; color: var(--text-dark); margin: 2px 0; }
    .lb-points strong { color: var(--pink-600); font-weight: 800; font-size: 1.2rem; }
    .lb-promo { font-size: 0.7rem; color: #888; font-style: italic; margin: 0; line-height: 1.2; }

    .queue-info { background: rgba(255,255,255,0.6); backdrop-filter: blur(10px); border: 1px solid rgba(96,165,250,0.2); border-radius: 1.25rem; padding: 1rem; margin-bottom: 1rem; text-align: center; position: relative; z-index: 1; }
    .queue-number { font-size: 2rem; font-weight: 800; color: #3B82F6; font-family: var(--font-display); line-height: 1; }
    .queue-label { font-size: 0.8rem; color: var(--text-medium); font-weight: 600; }
    .queue-bar { display: flex; justify-content: center; gap: 0.4rem; margin-bottom: 0.5rem; }
    .queue-dot { width: 18px; height: 18px; border-radius: 50%; background: #E5E7EB; display: flex; align-items: center; justify-content: center; font-size: 0.5rem; font-weight: 800; color: white;
      &.done { background: #34D399; } &.current { background: #3B82F6; animation: pulse-dot 1.5s infinite; }
      &.you { background: var(--pink-500); width: 24px; height: 24px; border: 2px solid white; box-shadow: 0 2px 8px rgba(255,61,127,0.3); }
    }
    @keyframes pulse-dot { 0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); } 50% { box-shadow: 0 0 0 6px rgba(59,130,246,0); } }

    .transit-alert { display: flex; align-items: center; gap: 1rem; background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(96,165,250,0.08)); border: 1.5px solid rgba(59,130,246,0.2); border-radius: 1.25rem; padding: 1rem; margin-bottom: 1rem; position: relative; z-index: 1; p { color: #1D4ED8; font-weight: 600; font-size: 0.9rem; margin: 0; } }
    .transit-icon { font-size: 2rem; }
    .transit-pulse { position: absolute; inset: -4px; border-radius: 50%; background: rgba(59,130,246,0.2); animation: transit-ring 1.5s infinite; }

    /* 🗺️ ESTILOS DEL MAPA MEJORADOS */
    .map-section { margin-bottom: 1.5rem; position: relative; z-index: 1; h3 { color: var(--text-dark); font-size: 0.95rem; margin: 0 0 0.5rem; font-family: var(--font-display); } }
    .map-wrapper-beautiful { width: 100%; height: 250px; border-radius: 1.5rem; overflow: hidden; border: 3px solid white; box-shadow: 0 8px 25px rgba(255,107,157,0.2); }
    .map-hint { color: var(--text-muted); font-size: 0.8rem; margin: 0.5rem 0 0; text-align: center; font-style: italic; }

    .order-section { position: relative; z-index: 1; background: rgba(255,255,255,0.65); backdrop-filter: blur(12px); border-radius: 1.25rem; padding: 1rem; border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 4px 20px rgba(0,0,0,0.02); margin-bottom: 1.25rem; transition: all 0.3s ease; }
    .order-header-row { display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }
    .items-list { margin-top: 0.5rem; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 0.5rem; }
    .item-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px dashed rgba(0,0,0,0.05); &:last-child { border-bottom: none; } }
    .item-name { color: var(--text-dark); font-size: 0.9rem; font-weight: 600; }
    .item-qty { color: var(--text-muted); font-size: 0.8rem; }
    .item-price { color: var(--pink-500); font-weight: 700; font-size: 0.9rem; }
    
    .order-totals { margin-top: 0.5rem; }
    .total-row { display: flex; justify-content: space-between; padding: 0.2rem 0; color: var(--text-medium); font-size: 0.85rem; &.grand { margin-top: 0.3rem; color: var(--pink-600); font-weight: 800; font-size: 1.1rem; font-family: var(--font-display); border-top: 1px solid rgba(0,0,0,0.05); padding-top: 0.5rem; } }
    
    .payment-section { margin-top: 1rem; position: relative; z-index: 1; h3 { color: var(--text-dark); font-size: 0.95rem; margin: 0 0 0.2rem; font-family: var(--font-display); } }
    .pay-hint { font-size: 0.8rem; color: var(--text-medium); margin-bottom: 0.8rem; }
    .payment-tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; background: rgba(255,255,255,0.4); padding: 4px; border-radius: 12px; }
    .pay-tab { flex: 1; border: none; background: none; padding: 8px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; color: var(--text-medium); cursor: pointer; transition: all 0.2s; &:hover { background: rgba(255,255,255,0.5); } &.active { background: white; color: var(--pink-600); box-shadow: 0 2px 5px rgba(0,0,0,0.05); } }

    .payment-content { min-height: 120px; }
    .pay-card { background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,245,248,0.9)); border: 1px solid white; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 10px 30px rgba(255,107,157,0.1); position: relative; overflow: hidden; animation: scaleIn 0.3s ease-out; }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    .pay-card::before { content: '🎀'; position: absolute; top: -10px; right: -10px; font-size: 4rem; opacity: 0.05; transform: rotate(15deg); }
    
    .pay-header { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.8rem; }
    .pay-icon { font-size: 1.6rem; background: var(--pink-100); padding: 0.4rem; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
    .pay-header strong { display: block; color: var(--text-dark); font-size: 0.9rem; }
    .bank-name { color: var(--pink-600); font-weight: 700; font-size: 0.8rem; }

    .card-details { background: rgba(255,255,255,0.5); border-radius: 0.75rem; padding: 0.8rem; border: 1px dashed var(--pink-200); }
    .card-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; font-size: 0.8rem; &:last-child { margin-bottom: 0; } }
    .card-label { color: var(--text-muted); }
    .card-num { font-family: monospace; font-size: 0.95rem; font-weight: 700; color: var(--text-dark); letter-spacing: 0.5px; }
    .card-name { font-weight: 600; color: var(--text-dark); }
    
    .btn-copy-card { background: var(--pink-500); color: white; border: none; border-radius: 0.5rem; padding: 0.2rem 0.6rem; font-size: 0.7rem; font-weight: 700; cursor: pointer; box-shadow: 0 2px 5px rgba(236,72,153,0.3); transition: all 0.2s; &:active { transform: scale(0.95); } }
    
    .footer-msg { text-align: center; margin-top: 2rem; font-family: var(--font-script); color: var(--rose-gold); font-size: 0.9rem; position: relative; z-index: 1; opacity: 0.8; }
    .fade-in { animation: fadeIn 0.3s ease-out; }

    .countdown-section { background: rgba(255, 255, 255, 0.5); backdrop-filter: blur(8px); border: 1px dashed var(--pink-300); border-radius: 1rem; padding: 0.8rem; margin-bottom: 1.25rem; text-align: center; position: relative; z-index: 1; h3 { color: var(--text-dark); font-size: 0.9rem; margin: 0 0 0.5rem; font-family: var(--font-display); } }
    .countdown-timer { display: flex; justify-content: center; gap: 0.6rem; margin-bottom: 0.4rem; }
    .time-block { display: flex; flex-direction: column; align-items: center; background: white; padding: 0.3rem 0.6rem; border-radius: 0.6rem; box-shadow: 0 2px 8px rgba(255, 107, 157, 0.1); min-width: 44px; }
    .time-val { font-size: 1.1rem; font-weight: 800; color: var(--pink-600); font-family: monospace; }
    .time-label { font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

    .toast-notification { position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); background: rgba(40, 40, 40, 0.85); backdrop-filter: blur(12px); color: white; padding: 0.75rem 1.5rem; border-radius: 2rem; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.1); z-index: 9999; animation: toastFadeIn 0.3s ease-out; font-size: 0.9rem; font-weight: 500; }
    @keyframes toastFadeIn { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }

    /* CHAT FLOTANTE Y MODAL */
    .floating-chat-btn { position: fixed; bottom: 20px; right: 20px; width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #ec4899, #db2777); color: white; border: none; font-size: 1.8rem; box-shadow: 0 8px 20px rgba(236,72,153,0.4); cursor: pointer; z-index: 1000; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    .floating-chat-btn:hover { transform: scale(1.1); }
    
    .chat-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(5px); z-index: 2000; display: flex; align-items: flex-end; }
    .chat-modal { width: 100%; background: white; border-radius: 25px 25px 0 0; height: 85vh; display: flex; flex-direction: column; overflow: hidden; animation: slideUpChat 0.3s ease; }
    @keyframes slideUpChat { from { transform: translateY(100%); } to { transform: translateY(0); } }
    
    .chat-header { background: #fdf2f8; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #fce7f3; }
    .chat-header strong { display: block; color: var(--pink-600); font-size: 1.05rem; }
    .chat-header .status-text { font-size: 0.8rem; color: #10b981; font-weight: 600; display: flex; align-items: center; gap: 4px; }
    .chat-header .status-text::before { content: ''; width: 8px; height: 8px; background: #10b981; border-radius: 50%; }
    .btn-close { background: none; border: none; font-size: 1.4rem; color: #999; cursor: pointer; }
    
    .chat-body { flex: 1; padding: 15px; overflow-y: auto; background: #f9fafb; display: flex; flex-direction: column; gap: 12px; }
    .chat-empty { text-align: center; color: #aaa; font-size: 0.9rem; font-style: italic; margin: auto; }
    .msg-bubble { max-width: 80%; padding: 12px 16px; border-radius: 18px; font-size: 0.95rem; line-height: 1.4; position: relative; word-wrap: break-word; }
    .msg-bubble.me { background: var(--pink-500); color: white; align-self: flex-end; border-bottom-right-radius: 4px; box-shadow: 0 4px 12px rgba(236,72,153,0.2); }
    .msg-bubble.them { background: white; color: #1f2937; align-self: flex-start; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.03); }
    .msg-bubble .time { display: block; font-size: 0.65rem; text-align: right; opacity: 0.7; margin-top: 5px; }
    
    .chat-input { padding: 15px; background: white; border-top: 1px solid #f3f4f6; display: flex; gap: 10px; padding-bottom: env(safe-area-inset-bottom, 20px); }
    .chat-input input { flex: 1; border: 1px solid #e5e7eb; border-radius: 30px; padding: 12px 20px; outline: none; font-size: 0.95rem; }
    .chat-input input:focus { border-color: var(--pink-400); }
    .chat-input button { background: var(--pink-500); color: white; border: none; border-radius: 50%; width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.1rem; }
    .chat-input button:disabled { background: #f3f4f6; color: #9ca3af; }
  `]
})
export class OrderViewComponent implements OnInit, OnDestroy {
  @ViewChild('googleMap') mapComponent!: GoogleMap;
  @ViewChild('clientChatScroll') clientChatScroll?: ElementRef;

  order = signal<ClientOrderView | null>(null);
  loading = signal(true);
  expired = signal(false);
  notFound = signal(false);
  showMap = signal(false);

  loyalty = signal<LoyaltySummary | null>(null);
  paymentTab = signal<'transfer' | 'cash' | 'oxxo'>('transfer');

  deliveryDate = signal<Date | null>(null);
  deliveryDateFormatted = signal('');
  deliveryReason = signal<string>('');
  countdown = signal({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  showChat = signal(false);
  chatMessages = signal<any[]>([]);
  newChatMessage = '';

  // Flags para notificaciones (evita duplicados)
  private proximityNotified = false;      // Solo notificar 1 vez que está cerca
  private inTransitNotified = false;       // Solo notificar 1 vez que va en camino
  private deliveredNotified = false;       // Solo notificar 1 vez que se entregó
  private previousStatus = '';             // Para detectar cambios de estado

  toastVisible = signal(false);
  toastMessage = signal('');
  private timerInterval: any;

  // Timeline signals
  timelineSteps = signal<{ label: string, date: Date | null, done: boolean, active: boolean, icon: string }[]>([]);

  // 🗺️ Maps State
  centerSignal = signal<google.maps.LatLngLiteral>({ lat: 27.4861, lng: -99.5069 });
  zoomSignal = signal(14);
  driverPos = signal<google.maps.LatLngLiteral | null>(null);
  clientPos = signal<google.maps.LatLngLiteral | null>(null);
  directionsResult = signal<google.maps.DirectionsResult | undefined>(undefined);

  mapOptions: google.maps.MapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    styles: [
      { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#e9e9e9" }, { "lightness": 17 }] },
      { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }, { "lightness": 20 }] },
      { "featureType": "road.highway", "elementType": "geometry.fill", "stylers": [{ "color": "#ffffff" }, { "lightness": 17 }] },
      { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }, { "lightness": 16 }] }
    ]
  };

  // 🚀 ICONOS MEJORADOS (Carrito y Casita)
  driverMarkerOptions: google.maps.MarkerOptions = {
    icon: {
      url: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png', // Un carrito bonito
      scaledSize: new google.maps.Size(45, 45)
    },
    title: 'Repartidor 🚗',
    zIndex: 999
  };

  clientMarkerOptions: google.maps.MarkerOptions = {
    icon: {
      url: 'https://cdn-icons-png.flaticon.com/512/2555/2555572.png', // Una casita
      scaledSize: new google.maps.Size(40, 40)
    },
    title: 'Tu hogar 💖'
  };

  rendererOptions: google.maps.DirectionsRendererOptions = {
    suppressMarkers: true, // Importante: Oculta los marcadores por defecto de la ruta
    polylineOptions: { strokeColor: '#FF6B9D', strokeOpacity: 0.8, strokeWeight: 6 } // Ruta color rosa
  };

  private accessToken = '';
  private locationSub?: Subscription;
  private deliverySub?: Subscription;
  private signalrConnected = false;
  private directionsService = new google.maps.DirectionsService();

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private signalr: SignalRService,
    private pushService: PushNotificationService,
    @Inject(LOCALE_ID) private locale: string
  ) { }

  ngOnInit(): void {
    this.accessToken = this.route.snapshot.paramMap.get('token') || '';
    this.loadOrder();

    this.pushService.requestPermission().then(granted => {
      if (granted) {
        console.log('✅ Notificaciones habilitadas para la clienta');
      }
    });
  }

  ngOnDestroy(): void {
    this.locationSub?.unsubscribe();
    this.deliverySub?.unsubscribe();
    this.signalr.disconnect();
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  enableNotifications(clientId?: number) {
    if (clientId && !this.previousStatus) {
      this.pushService.subscribeToNotifications('client', { clientId });
    }
    this.showToast('🔔 ¡Suscripción solicitada!');
  }

  private async loadOrder(): Promise<void> {
    this.api.getClientOrder(this.accessToken).subscribe({
      next: async (order: any) => {

        // 🚀 MAGIA DE GEOCODING: Si no hay lat/lng pero hay dirección, buscamos las coordenadas
        if ((!order.clientLatitude || !order.clientLongitude) && order.clientAddress) {
          const coords = await this.geocodeAddress(order.clientAddress);
          if (coords) {
            order.clientLatitude = coords.lat;
            order.clientLongitude = coords.lng;
          }
        }

        this.order.set(order);
        if (order.clientId && !this.previousStatus) {
          this.pushService.subscribeToNotifications(order.clientId);
        }

        // 🔔 PUSH: Detectar cambio de estado → InTransit
        if (order.status === 'InTransit' && this.previousStatus !== 'InTransit' && !this.inTransitNotified) {
          this.inTransitNotified = true;
          this.pushService.notifyDriverEnRoute();
        }

        // 🔔 PUSH: Detectar cambio de estado → Delivered
        if (order.status === 'Delivered' && this.previousStatus !== 'Delivered' && !this.deliveredNotified) {
          this.deliveredNotified = true;
          this.pushService.notifyDelivered();
        }

        this.previousStatus = order.status;
        this.loading.set(false);

        let isFrecuente = (order.clientType || '').toLowerCase() === 'frecuente';
        const createdStr = order.createdAt || new Date().toISOString();
        this.calculateDelivery(createdStr, isFrecuente);

        const needsMap = order.status === 'InRoute' || order.status === 'InTransit';
        this.showMap.set(needsMap);

        if (needsMap) {
          this.updateMapState(order);
          if (!this.signalrConnected) {
            this.connectRealtime();
          }
        }

        const defaultLoyalty: LoyaltySummary = {
          clientId: order.clientId || 0,
          clientName: order.clientName,
          currentPoints: 0,
          lifetimePoints: 0,
          tier: 'Bronce'
        };
        this.loyalty.set(defaultLoyalty);

        if (order.clientId) {
          this.api.getLoyaltySummary(order.clientId).subscribe({
            next: (res) => this.loyalty.set(res),
            error: (err) => console.warn('Keeping default loyalty', err)
          });
        }

        this.updateTimeline(order);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 410) this.expired.set(true);
        else this.notFound.set(true);
      }
    });
  }

  // 1️⃣ CAMBIAMOS A GOOGLE GEOCODER (Es súper exacto)
  private async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    if (!address) return null;

    return new Promise((resolve) => {
      const geocoder = new google.maps.Geocoder();
      // Le agregamos la ciudad para ayudar a Google
      const fullAddress = `${address}, Nuevo Laredo, Tamaulipas, México`;

      geocoder.geocode({ address: fullAddress }, (results: any, status: any) => {
        if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
          console.log('✅ Dirección encontrada por Google:', fullAddress);
          resolve({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          });
        } else {
          console.warn('❌ Google no encontró la dirección:', fullAddress, status);
          resolve(null);
        }
      });
    });
  }

  // 2️⃣ ACTUALIZAMOS MAP STATE (Trazamos la ruta si el chofer ya reportó)
  private updateMapState(order: any): void {
    const lat = order.clientLatitude || order.latitude || order.clientLat;
    const lng = order.clientLongitude || order.longitude || order.clientLng;

    if (lat && lng) {
      this.clientPos.set({ lat: Number(lat), lng: Number(lng) });

      // 🚀 Si ya tenemos al chofer y a la clienta, trazamos la ruta de una vez
      if (this.driverPos() && (order.status === 'InTransit' || order.status === 'InRoute')) {
        this.calculateRoute(this.driverPos()!, this.clientPos()!);
      }
    }

    if (order.driverLocation && order.driverLocation.latitude) {
      this.updateDriverPosition(order.driverLocation.latitude, order.driverLocation.longitude);
    }
  }

  // 3️⃣ ACTUALIZAMOS DRIVER POSITION (Reparado para tiempos exactos)
  private updateDriverPosition(lat: number, lng: number): void {
    if (!lat || !lng) return;
    const driver = { lat, lng };
    this.driverPos.set(driver);

    // Centramos la cámara en el carrito
    if (this.mapComponent && this.mapComponent.googleMap) {
      this.mapComponent.googleMap.panTo(driver);
    } else if (!this.clientPos()) {
      this.centerSignal.set(driver);
    }

    // Trazamos la ruta solo si la clienta ya tiene coordenadas
    if ((this.order()?.status === 'InTransit' || this.order()?.status === 'InRoute') && this.clientPos()) {
      this.calculateRoute(driver, this.clientPos()!);
    }

    this.checkDriverProximity(lat, lng);
  }

  private checkDriverProximity(driverLat: number, driverLng: number): void {
    // Si ya notificamos, no repetir
    if (this.proximityNotified) return;

    const clientCoords = this.clientPos();
    if (!clientCoords) return;

    const { isNearby, distance } = this.pushService.checkProximity(
      driverLat, driverLng,
      clientCoords.lat, clientCoords.lng,
      500 // umbral en metros
    );

    if (isNearby) {
      this.proximityNotified = true;
      this.pushService.notifyDriverNearby(distance);
      this.showToast('📍 ¡El repartidor está muy cerca de tu domicilio!');
      console.log(`📍 Chofer a ${Math.round(distance)}m del domicilio`);
    }
  }

  private calculateRoute(origin: google.maps.LatLngLiteral, dest: google.maps.LatLngLiteral) {
    console.log('🛣️ [8] Solicitando ruta a Google Maps de', origin, 'a', dest);
    this.directionsService.route({
      origin,
      destination: dest,
      travelMode: google.maps.TravelMode.DRIVING
    }, (result: any, status: any) => {
      console.log(`🏁 [9] Respuesta de Google Maps: Status = ${status}`);
      // @ts-ignore
      if (status === 'OK' && result) {
        console.log('✅ [10] ¡Ruta calculada con éxito! Guardando en directionsResult.');
        this.directionsResult.set(result);

        // Use Maps ETA to update countdown timer
        // @ts-ignore
        const routeLeg = result.routes[0]?.legs[0];
        if (routeLeg?.duration) {
          const durationSeconds = routeLeg.duration.value;
          const etaDate = new Date(Date.now() + durationSeconds * 1000);
          this.deliveryDate.set(etaDate);
          this.deliveryDateFormatted.set('¡Repartidor en Camino!');

          if ((this.order()?.deliveriesAhead ?? 0) > 0) {
            this.deliveryReason.set(`⏳ ETA: ${routeLeg.duration.text} desde ubicación del repartidor (El tiempo puede variar por otras entregas)`);
          } else {
            this.deliveryReason.set(`⏳ ETA: Llegará aproximadamente en ${routeLeg.duration.text} 🚗`);
          }
          this.startCountdown();
        }
      } else {
        console.error('❌ [10] Error al calcular la ruta de Google Maps. Respuesta completa:', result);
      }
    });
  }

  private async connectRealtime(): Promise<void> {
    try {
      await this.signalr.connectPublic();
      await this.signalr.joinOrder(this.accessToken);
      this.signalrConnected = true;

      this.locationSub = this.signalr.locationUpdate$.subscribe(loc => {
        this.updateDriverPosition(loc.latitude, loc.longitude);
      });

      this.deliverySub = this.signalr.deliveryUpdate$.subscribe(() => {
        this.reloadOrder();
      });

      this.signalr.clientChatUpdate$.subscribe(msg => {
        // Prevención de duplicados
        if (!this.chatMessages().some(m => m.id === msg.id)) {
          this.chatMessages.update(msgs => [...msgs, msg]);
          if (this.showChat()) {
            this.scrollChat();
          } else {
            this.showToast('💬 Nuevo mensaje del repartidor');
            this.pushService.notifyNewMessage(
              'Repartidor',
              msg.text || msg.message || 'Nuevo mensaje',
              'client'
            );
          }
        }


      });
    } catch (err) {
      console.error('SignalR connection failed:', err);
      this.startPolling();
    }
  }

  private pollingInterval?: any;
  private startPolling(): void {
    this.pollingInterval = setInterval(() => this.reloadOrder(), 15000);
  }

  private reloadOrder(): void {
    this.api.getClientOrder(this.accessToken).subscribe({
      next: (order) => {
        // 🔔 PUSH: Detectar cambio de estado en reload
        const prevStatus = this.order()?.status;

        this.order.set(order);
        this.updateTimeline(order);

        // 🔔 PUSH: InTransit notification
        if (order.status === 'InTransit' && prevStatus !== 'InTransit' && !this.inTransitNotified) {
          this.inTransitNotified = true;
          this.pushService.notifyDriverEnRoute();
          this.showToast('🚗 ¡Tu repartidor va en camino!');
        }

        // 🔔 PUSH: Delivered notification
        if (order.status === 'Delivered' && prevStatus !== 'Delivered' && !this.deliveredNotified) {
          this.deliveredNotified = true;
          this.pushService.notifyDelivered();
        }

        const needsMap = order.status === 'InRoute' || order.status === 'InTransit';
        this.showMap.set(needsMap);
        if (needsMap) {
          this.updateMapState(order);
          if (!this.signalrConnected) this.connectRealtime();
        }
      }
    });
  }

  // 🔥 UPDATE TIMELINE
  private updateTimeline(o: any) {
    const created = new Date(o.createdAt);
    const now = new Date();

    // Generar tiempos estimados si no están en DB
    const confirmed = new Date(created.getTime() + 15 * 60000); // +15 min
    let enRuta = new Date(created.getTime() + 24 * 60 * 60000); // +1 dia default
    let entregado = null;

    const weight = this.getStatusWeight(o.status);

    // Si ya está en ruta, usamos ahora si no tenemos el dato real, 
    // pero para que no baile la fecha, usamos una constante basada en created o el today a las 10am
    if (weight >= 2) {
      enRuta = new Date();
      enRuta.setHours(10, 0, 0, 0);
    }

    if (weight >= 4) {
      entregado = new Date();
    }

    const steps = [
      {
        label: 'Pedido Recibido',
        date: created,
        done: weight >= 0,
        active: weight === 0,
        icon: '📝'
      },
      {
        label: 'Confirmado',
        date: weight >= 1 ? confirmed : null,
        done: weight >= 1,
        active: weight === 1,
        icon: '✨'
      },
      {
        label: 'En Ruta',
        date: weight >= 2 ? enRuta : null,
        done: weight >= 2,
        active: weight === 2 || weight === 3,
        icon: '🚗'
      },
      {
        label: 'Entregado',
        date: weight >= 4 ? entregado : null,
        done: weight >= 4,
        active: weight === 4,
        icon: '💝'
      }
    ];

    this.timelineSteps.set(steps);
  }

  private getStatusWeight(status: string): number {
    switch (status) {
      case 'Pending': return 0;
      case 'Confirmed': case 'Shipped': return 1;
      case 'InRoute': return 2;
      case 'InTransit': return 3;
      case 'Delivered': return 4;
      default: return -1;
    }
  }

  confirmOrder() {
    if (!confirm('¿Confirmas que has recibido tu pedido? ✨')) return;
    this.api.confirmClientOrder(this.accessToken).subscribe({
      next: () => {
        this.showToast('¡Pedido confirmado! Gracias 💕');
        this.loadOrder();
      },
      error: () => this.showToast('Error al confirmar, intenta de nuevo 😿')
    });
  }

  getQueueDots(o: ClientOrderView): { done: boolean; current: boolean; you: boolean }[] {
    if (!o.queuePosition || !o.totalDeliveries) return [];
    const total = Math.min(o.totalDeliveries, 10);
    const myPos = Math.min(o.queuePosition, total);
    const deliveriesDone = o.totalDeliveries - (o.deliveriesAhead ?? 0) - 1;
    const dots = [];
    for (let i = 1; i <= total; i++) {
      const isMe = i === myPos;
      dots.push({
        done: i <= deliveriesDone && !isMe,
        current: !isMe && (i === deliveriesDone + 1),
        you: isMe
      });
    }
    return dots;
  }

  copyText(val: string) {
    navigator.clipboard.writeText(val);
    this.showToast('¡Número de tarjeta copiado! 💳');
  }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    this.toastVisible.set(true);
    setTimeout(() => this.toastVisible.set(false), 3000);
  }

  private calculateDelivery(createdAtStr: string, isFrecuente: boolean) {
    const created = new Date(createdAtStr);
    const delivery = new Date(created);
    const dayOfWeek = created.getDay();
    let daysUntilSunday = (7 - dayOfWeek) % 7;
    if (daysUntilSunday === 0) daysUntilSunday = 7;
    let addDays = daysUntilSunday;

    if (isFrecuente) {
      addDays += 7;
      this.deliveryReason.set('✨ Por ser clienta frecuente, tu entrega es el segundo domingo 💕');
    } else {
      this.deliveryReason.set('🌸 Por ser clienta nueva, tu entrega es este próximo domingo ✨');
    }

    delivery.setDate(created.getDate() + addDays);
    delivery.setHours(12, 0, 0, 0);

    const fmt = formatDate(delivery, "EEEE d 'de' MMMM", this.locale);
    this.deliveryDateFormatted.set(fmt.charAt(0).toUpperCase() + fmt.slice(1));
    this.deliveryDate.set(delivery);
    this.startCountdown();
  }

  private startCountdown() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    const update = () => {
      const target = this.deliveryDate();
      if (!target) return;
      const now = new Date();
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        this.countdown.set({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      this.countdown.set({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60)
      });
    };
    update();
    this.timerInterval = setInterval(update, 1000);
  }

  toggleChat() {
    this.showChat.update(v => !v);
    if (this.showChat()) {
      this.loadChat();
    }
  }

  loadChat() {
    this.api.getClientChat(this.accessToken).subscribe(msgs => {
      this.chatMessages.set(msgs);
      this.scrollChat();
    });
  }

  sendChat() {
    if (!this.newChatMessage.trim()) return;
    const text = this.newChatMessage.trim();
    this.newChatMessage = '';

    // Agregamos el mensaje a la vista localmente cuando la API responda exitosamente
    this.api.sendClientMessage(this.accessToken, text).subscribe(newMsg => {
      if (!this.chatMessages().some(m => m.id === newMsg.id)) {
        this.chatMessages.update(msgs => [...msgs, newMsg]);
        this.scrollChat();
      }
    });
  }

  scrollChat() {
    setTimeout(() => {
      if (this.clientChatScroll) {
        this.clientChatScroll.nativeElement.scrollTop = this.clientChatScroll.nativeElement.scrollHeight;
      }
    }, 60);
  }
}