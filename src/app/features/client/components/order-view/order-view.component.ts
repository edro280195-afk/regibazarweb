import { Component, OnInit, OnDestroy, signal, ElementRef, ViewChild, Inject, LOCALE_ID } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { SignalRService } from '../../../../core/services/signalr.service';
import { ClientOrderView, LoyaltySummary } from '../../../../shared/models/models';

declare var google: any;

import { GoogleMapsModule, MapDirectionsRenderer, MapMarker } from '@angular/google-maps';

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
        </div>

        <!-- Status banner -->
        <div class="status-banner" [attr.data-status]="o.status">
          @switch (o.status) {
            @case ('Pending') {
              <span class="status-icon">📦</span>
              <div><strong>Pedido confirmado</strong><p>Tu pedido está listo, pronto saldrá a entrega ✨</p></div>
            }
            @case ('Shipped') {
              <span class="status-icon">🚚</span>
              <div><strong>Pedido confirmado</strong><p>Tu pedido está listo, pronto saldrá a entrega ✨</p></div>
            }
            @case ('InRoute') {
              <span class="status-icon">🚗</span>
              <div><strong>En ruta de entrega</strong><p>Tu pedido está en camino. El repartidor tiene entregas antes de ti 💕</p></div>
            }
            @case ('InTransit') {
              <span class="status-icon pulse">🏃💨</span>
              <div><strong>¡El repartidor viene hacia ti!</strong><p>Prepárate, tu pedido está a punto de llegar 🎉</p></div>
            }
            @case ('Delivered') {
              <span class="status-icon">💝</span>
              <div><strong>¡Entregado!</strong><p>Tu pedido fue entregado, muchas gracias por tu compra 🌸</p></div>
            }
            @case ('NotDelivered') {
              <span class="status-icon">😿</span>
              <div><strong>No se pudo entregar</strong><p>Contacta a tu vendedora para reprogramar 💌</p></div>
            }
          }
        </div>

        <!-- LOYALTY BANNER -->
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

        <!-- Queue position -->
        @if (o.status === 'InRoute' && o.queuePosition && o.totalDeliveries) {
          <div class="queue-info">
            <div class="queue-position">
              <span class="queue-number">{{ o.deliveriesAhead ?? 0 }}</span>
              <span class="queue-label">entregas antes de la tuya</span>
            </div>
            <div class="queue-bar">
              @for (i of getQueueDots(o); track $index) {
                <div class="queue-dot" [class.done]="i.done" [class.current]="i.current" [class.you]="i.you">
                  @if (i.you) { <span>tú</span> }
                </div>
              }
            </div>
            <p class="queue-hint">Eres la entrega #{{ o.queuePosition }} de {{ o.totalDeliveries }} 📍</p>
          </div>
        }

        <!-- In Transit alert -->
        @if (o.status === 'InTransit') {
          <div class="transit-alert">
            <div class="transit-icon-wrap">
              <span class="transit-icon">🚗</span>
              <div class="transit-pulse"></div>
            </div>
            <p>¡Eres la siguiente entrega! El repartidor viene en camino hacia ti.</p>
          </div>
        }

        <!-- MAP — always visible when InRoute or InTransit -->
        <!-- MAP — always visible when InRoute or InTransit -->
        @if (showMap()) {
          <div class="map-section">
            <h3>📍 ¿Dónde va tu pedido?</h3>
            
            <google-map 
              height="300px" 
              width="100%" 
              [options]="mapOptions"
              [center]="centerSignal()"
              [zoom]="zoomSignal()">
              
              <!-- Driver Marker -->
              @if (driverPos()) {
                <map-marker 
                  [position]="driverPos()!" 
                  [options]="driverMarkerOptions">
                </map-marker>
              }

              <!-- Client Marker -->
              @if (clientPos()) {
                <map-marker 
                  [position]="clientPos()!" 
                  [options]="clientMarkerOptions">
                </map-marker>
              }

              <!-- Directions (Only InTransit) -->
              @if (o.status === 'InTransit' && directionsResult()) {
                <map-directions-renderer 
                  [directions]="directionsResult()!"
                  [options]="rendererOptions">
                </map-directions-renderer>
              }
            </google-map>

            @if (!driverPos()) {
              <p class="map-hint">El repartidor aún no ha compartido su ubicación, espera un poquito ✨</p>
            }
          </div>
        }

        <!-- Delivery Countdown (Only if Pending or similar status where date matters) -->
        @if (deliveryDate() && (o.status === 'Pending' || o.status === 'InRoute')) {
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
              Tu entrega está programada para el <strong>{{ deliveryDateFormatted() }}</strong> 📅
              <br>
              <span class="delivery-reason">{{ deliveryReason() }}</span>
            </p>
          </div>
        }


        <!-- Order items (Full List) -->
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
        
        <!-- Payment Info (Tabbed) -->
        <div class="payment-section">
          <h3>Formas de Pago 💸</h3>
          <p class="pay-hint">Elige cómo quieres pagar hoy ✨</p>
          
          <div class="payment-tabs">
            <button class="pay-tab" [class.active]="paymentTab() === 'cash'" (click)="paymentTab.set('cash')">
              💵 Efectivo
            </button>
            <button class="pay-tab" [class.active]="paymentTab() === 'transfer'" (click)="paymentTab.set('transfer')">
              🏦 Transferencia
            </button>
            <button class="pay-tab" [class.active]="paymentTab() === 'oxxo'" (click)="paymentTab.set('oxxo')">
              🏪 Deposito
            </button>
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
    </div>
    @if (order()?.status === 'InRoute' || order()?.status === 'InTransit') {
        <button class="floating-chat-btn" (click)="toggleChat()" [class.unread]="false">
          💬
        </button>
      }

      @if (showChat()) {
        <div class="chat-modal">
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
      }
  `,
  styles: [`
    .client-page {
      min-height: 100vh;
      background: linear-gradient(180deg, #FFF0F5 0%, #FFF5F9 50%, #F3E5F5 100%);
      padding: 1.25rem; max-width: 480px; margin: 0 auto;
      position: relative; overflow-x: hidden;
    }
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
    }

    .status-banner {
      display: flex; align-items: center; gap: 1rem; padding: 1rem; border-radius: 1.25rem;
      margin-bottom: 1rem; backdrop-filter: blur(12px); animation: fadeInUp 0.5s ease; position: relative; z-index: 1;
      box-shadow: 0 4px 15px rgba(0,0,0,0.03); border: 1px solid rgba(255,255,255,0.4);
      .status-icon { font-size: 2rem; &.pulse { animation: heartbeat 1.2s infinite; } }
      @keyframes heartbeat { 0%, 100% { transform: scale(1); } 25% { transform: scale(1.2); } }
      strong { color: var(--text-dark); display: block; font-family: var(--font-display); font-size: 0.95rem; }
      p { margin: 0.1rem 0 0; font-size: 0.8rem; line-height: 1.3; }
      &[data-status="Pending"] { background: rgba(255,253,240,0.6); p { color: #92400E; } }
      &[data-status="Shipped"] { background: rgba(243, 232, 255, 0.6); border: 1px solid #e9d5ff; p { color: #6b21a8; } }
      &[data-status="InRoute"] { background: rgba(239,246,255,0.6); p { color: #1E40AF; } }
      &[data-status="InTransit"] { background: linear-gradient(135deg, rgba(219,234,254,0.8), rgba(191,219,254,0.8)); border: 2px solid rgba(59,130,246,0.4); p { color: #1D4ED8; } }
      &[data-status="Delivered"] { background: rgba(236,253,245,0.6); p { color: #065F46; } }
    }
    .btn-confirm-order {
      margin-top: 1rem; width: 100%;
      background: linear-gradient(135deg, #10b981, #059669); 
      color: white; border: none; padding: 12px 20px; 
      border-radius: 12px; font-weight: 800; cursor: pointer; 
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
      font-size: 1rem; letter-spacing: 0.5px;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: all 0.2s; 
      &:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5); }
      &:active { transform: scale(0.98); }
    }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

    .loyalty-banner {
      background: linear-gradient(135deg, rgba(255,240,247,0.8) 0%, rgba(255,255,255,0.8) 100%);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(252, 231, 243, 0.6);
      border-radius: 1.25rem; padding: 1rem; margin-bottom: 1rem;
      display: flex; align-items: center; gap: 1rem;
      position: relative; z-index: 1;
      box-shadow: 0 8px 20px rgba(236, 72, 153, 0.08);
    }
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

    .transit-alert { display: flex; align-items: center; gap: 1rem; background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(96,165,250,0.08)); border: 1.5px solid rgba(59,130,246,0.2); border-radius: 1.25rem; padding: 1rem; margin-bottom: 1rem; position: relative; z-index: 1;
      p { color: #1D4ED8; font-weight: 600; font-size: 0.9rem; margin: 0; }
    }
    .transit-icon { font-size: 2rem; }
    .transit-pulse { position: absolute; inset: -4px; border-radius: 50%; background: rgba(59,130,246,0.2); animation: transit-ring 1.5s infinite; }

    .map-section { margin-bottom: 1.5rem; position: relative; z-index: 1;
      h3 { color: var(--text-dark); font-size: 0.95rem; margin: 0 0 0.5rem; font-family: var(--font-display); }
    }
    .map-container { width: 100%; height: 240px; border-radius: 1.25rem; overflow: hidden; border: 2px solid rgba(255,157,191,0.2); box-shadow: var(--shadow-md); }
    .map-hint { color: var(--text-muted); font-size: 0.8rem; margin: 0.5rem 0 0; text-align: center; font-style: italic; }

    .order-section { position: relative; z-index: 1; background: rgba(255,255,255,0.65); backdrop-filter: blur(12px); border-radius: 1.25rem; padding: 1rem; border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 4px 20px rgba(0,0,0,0.02); margin-bottom: 1.25rem; transition: all 0.3s ease; }
    .order-header-row { display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }
    .toggle-icon { font-size: 0.8rem; color: var(--pink-400); font-weight: bold; }
    .order-summary-text { font-size: 0.85rem; color: var(--text-medium); margin: 0.25rem 0 0.5rem; font-style: italic; }
    
    .items-list { margin-top: 0.5rem; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 0.5rem; }
    .item-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px dashed rgba(0,0,0,0.05); &:last-child { border-bottom: none; } }
    .item-name { color: var(--text-dark); font-size: 0.9rem; font-weight: 600; }
    .item-qty { color: var(--text-muted); font-size: 0.8rem; }
    .item-price { color: var(--pink-500); font-weight: 700; font-size: 0.9rem; }
    
    .order-totals { margin-top: 0.5rem; }
    .total-row { display: flex; justify-content: space-between; padding: 0.2rem 0; color: var(--text-medium); font-size: 0.85rem;
      &.grand { margin-top: 0.3rem; color: var(--pink-600); font-weight: 800; font-size: 1.1rem; font-family: var(--font-display); border-top: 1px solid rgba(0,0,0,0.05); padding-top: 0.5rem; }
    }
    
    .payment-section { margin-top: 1rem; position: relative; z-index: 1; }
    .payment-section h3 { color: var(--text-dark); font-size: 0.95rem; margin: 0 0 0.2rem; font-family: var(--font-display); }
    .pay-hint { font-size: 0.8rem; color: var(--text-medium); margin-bottom: 0.8rem; }
    
    .payment-tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; background: rgba(255,255,255,0.4); padding: 4px; border-radius: 12px; }
    .pay-tab { flex: 1; border: none; background: none; padding: 8px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; color: var(--text-medium); cursor: pointer; transition: all 0.2s;
       &:hover { background: rgba(255,255,255,0.5); }
       &.active { background: white; color: var(--pink-600); box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
    }

    .payment-content { min-height: 120px; }
    .pay-card {
      background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,245,248,0.9));
      border: 1px solid white; border-radius: 1rem; padding: 1.25rem;
      box-shadow: 0 10px 30px rgba(255,107,157,0.1);
      position: relative; overflow: hidden;
      animation: scaleIn 0.3s ease-out;
    }
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
    
    .btn-copy-card {
      background: var(--pink-500); color: white; border: none; border-radius: 0.5rem;
      padding: 0.2rem 0.6rem; font-size: 0.7rem; font-weight: 700; cursor: pointer;
      box-shadow: 0 2px 5px rgba(236,72,153,0.3);
      transition: all 0.2s; &:active { transform: scale(0.95); }
    }
    
    .store-logos { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; opacity: 0.8; font-size: 0.75rem; font-weight: 600; color: #555; }
    .footer-msg { text-align: center; margin-top: 2rem; font-family: var(--font-script); color: var(--rose-gold); font-size: 0.9rem; position: relative; z-index: 1; opacity: 0.8; }
    
    .fade-in { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* COUNTDOWN */
    .countdown-section {
      background: rgba(255, 255, 255, 0.5); backdrop-filter: blur(8px);
      border: 1px dashed var(--pink-300);
      border-radius: 1rem; padding: 0.8rem; margin-bottom: 1.25rem;
      text-align: center; position: relative; z-index: 1;
    }
    .countdown-section h3 { color: var(--text-dark); font-size: 0.9rem; margin: 0 0 0.5rem; font-family: var(--font-display); }
    .countdown-timer { display: flex; justify-content: center; gap: 0.6rem; margin-bottom: 0.4rem; }
    .time-block { display: flex; flex-direction: column; align-items: center; background: white; padding: 0.3rem 0.6rem; border-radius: 0.6rem; box-shadow: 0 2px 8px rgba(255, 107, 157, 0.1); min-width: 44px; }
    .time-val { font-size: 1.1rem; font-weight: 800; color: var(--pink-600); font-family: monospace; }
    .time-label { font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

    /* TOAST */
    .toast-notification {
      position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
      background: rgba(40, 40, 40, 0.85); backdrop-filter: blur(12px);
      color: white; padding: 0.75rem 1.5rem; border-radius: 2rem;
      display: flex; align-items: center; gap: 0.5rem;
      box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.1);
      z-index: 9999; animation: toastFadeIn 0.3s ease-out; font-size: 0.9rem; font-weight: 500;
    }

    /* CHAT FLOTANTE */
    .floating-chat-btn { position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; border-radius: 50%; background: var(--pink-500); color: white; border: none; font-size: 1.8rem; box-shadow: 0 4px 15px rgba(236,72,153,0.4); cursor: pointer; z-index: 1000; transition: 0.2s; }
    .floating-chat-btn:hover { transform: scale(1.1); }
    
    .chat-modal { position: fixed; bottom: 90px; right: 20px; width: calc(100% - 40px); max-width: 350px; background: white; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); z-index: 1000; display: flex; flex-direction: column; height: 400px; overflow: hidden; border: 1px solid var(--pink-100); animation: slideUp 0.3s ease; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    
    .chat-modal .chat-header { background: var(--pink-50); padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--pink-100); }
    .chat-modal .chat-header strong { display: block; color: var(--pink-600); font-size: 0.95rem; }
    .chat-modal .chat-header .status-text { font-size: 0.75rem; color: #888; }
    .chat-modal .btn-close { background: none; border: none; font-size: 1.2rem; color: #888; cursor: pointer; }
    
    .chat-modal .chat-body { flex: 1; padding: 15px; overflow-y: auto; background: #fafafa; display: flex; flex-direction: column; gap: 10px; }
    .chat-empty { text-align: center; color: #aaa; font-size: 0.85rem; font-style: italic; margin: auto; }
    .msg-bubble { max-width: 80%; padding: 8px 12px; border-radius: 15px; font-size: 0.9rem; position: relative; }
    .msg-bubble.me { background: var(--pink-500); color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
    .msg-bubble.them { background: white; color: #444; align-self: flex-start; border: 1px solid #eee; border-bottom-left-radius: 4px; }
    .msg-bubble .time { display: block; font-size: 0.65rem; text-align: right; opacity: 0.7; margin-top: 4px; }
    
    .chat-modal .chat-input { padding: 10px; background: white; border-top: 1px solid #eee; display: flex; gap: 8px; }
    .chat-modal .chat-input input { flex: 1; border: 1px solid #ddd; border-radius: 20px; padding: 8px 15px; outline: none; }
    .chat-modal .chat-input input:focus { border-color: var(--pink-400); }
    .chat-modal .chat-input button { background: var(--pink-500); color: white; border: none; border-radius: 50%; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
  `]
})
export class OrderViewComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer') mapEl?: ElementRef;

  order = signal<ClientOrderView | null>(null);
  loading = signal(true);
  expired = signal(false);
  notFound = signal(false);
  showMap = signal(false);

  loyalty = signal<LoyaltySummary | null>(null);

  // UI States
  // showOrderDetails = signal(false); // Removed as per user request
  paymentTab = signal<'transfer' | 'cash' | 'oxxo'>('transfer');

  // Countdown & Toast
  deliveryDate = signal<Date | null>(null);
  deliveryDateFormatted = signal('');
  deliveryReason = signal<string>('');
  countdown = signal({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  showChat = signal(false);
  chatMessages = signal<any[]>([]);
  newChatMessage = '';
  @ViewChild('clientChatScroll') clientChatScroll?: ElementRef;

  toastVisible = signal(false);
  toastMessage = signal('');
  private timerInterval: any;

  // Maps State
  centerSignal = signal<google.maps.LatLngLiteral>({ lat: 25.6866, lng: -100.3161 }); // MTY
  zoomSignal = signal(12);
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

  driverMarkerOptions: google.maps.MarkerOptions = {
    icon: { url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' },
    title: 'Repartidor 🚗'
  };

  clientMarkerOptions: google.maps.MarkerOptions = {
    icon: { url: 'http://maps.google.com/mapfiles/ms/icons/pink-dot.png' },
    title: 'Tú 💖'
  };

  rendererOptions: google.maps.DirectionsRendererOptions = {
    suppressMarkers: true,
    polylineOptions: { strokeColor: '#3B82F6', strokeOpacity: 0.7, strokeWeight: 5 }
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
    @Inject(LOCALE_ID) private locale: string
  ) { }

  ngOnInit(): void {
    this.accessToken = this.route.snapshot.paramMap.get('token') || '';
    this.loadOrder();
  }

  ngOnDestroy(): void {
    this.locationSub?.unsubscribe();
    this.deliverySub?.unsubscribe();
    this.signalr.disconnect();
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  private loadOrder(): void {
    this.api.getClientOrder(this.accessToken).subscribe({
      next: (order) => {
        const prevStatus = this.order()?.status;
        this.order.set(order);
        this.loading.set(false);

        // 1. Initial Delivery Calculation
        let isFrecuente = (order.clientType || '').toLowerCase() === 'frecuente';
        const createdStr = order.createdAt || new Date().toISOString();
        this.calculateDelivery(createdStr, isFrecuente);

        // 2. Map Setup
        const needsMap = order.status === 'InRoute' || order.status === 'InTransit';
        this.showMap.set(needsMap);

        if (needsMap) {
          this.updateMapState(order);
          if (!this.signalrConnected) {
            this.connectRealtime();
          }
        }

        // 3. Loyalty & Client Info
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
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 410) this.expired.set(true);
        else this.notFound.set(true);
      }
    });
  }

  // ═══ REAL-TIME UPDATES & MAP LOGIC ═══

  private updateMapState(order: ClientOrderView): void {
    // 1. Client Position
    const lat = (order as any).latitude || (order as any).clientLat || order.clientLatitude;
    const lng = (order as any).longitude || (order as any).clientLng || order.clientLongitude;

    if (lat && lng) {
      this.clientPos.set({ lat: Number(lat), lng: Number(lng) });
      this.centerSignal.set({ lat: Number(lat), lng: Number(lng) });
      this.zoomSignal.set(14);
    }

    // 2. Driver Position (Init)
    if (order.driverLocation && order.driverLocation.latitude) {
      this.updateDriverPosition(order.driverLocation.latitude, order.driverLocation.longitude);
    }
  }

  private updateDriverPosition(lat: number, lng: number): void {
    if (!lat || !lng) return;
    const driver = { lat, lng };
    this.driverPos.set(driver);
    // If not client pos, center on driver
    if (!this.clientPos()) {
      this.centerSignal.set(driver);
    }

    // 3. Routing (Only if InTransit)
    if (this.order()?.status === 'InTransit' && this.clientPos()) {
      this.calculateRoute(driver, this.clientPos()!);
    } else {
      this.directionsResult.set(undefined);
    }
  }

  private calculateRoute(origin: google.maps.LatLngLiteral, dest: google.maps.LatLngLiteral) {
    this.directionsService.route({
      origin,
      destination: dest,
      travelMode: google.maps.TravelMode.DRIVING
    }, (result: any, status: any) => {
      // @ts-ignore
      if (status === 'OK' && result) {
        this.directionsResult.set(result);
      }
    });
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
        if (this.showChat()) {
          this.chatMessages.update(msgs => [...msgs, msg]);
          this.scrollChat();
        } else {
          this.showToast('💬 Nuevo mensaje del repartidor');
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
        const prevStatus = this.order()?.status;
        this.order.set(order);

        const needsMap = order.status === 'InRoute' || order.status === 'InTransit';
        this.showMap.set(needsMap);

        if (needsMap) {
          this.updateMapState(order);
          if (!this.signalrConnected) {
            this.connectRealtime();
          }
        }
      }
    });
  }

  // ═══ QUEUE DOTS ═══

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

  // toggleOrderDetails() { this.showOrderDetails.update(v => !v); }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    this.toastVisible.set(true);
    setTimeout(() => this.toastVisible.set(false), 3000);
  }

  private calculateDelivery(createdAtStr: string, isFrecuente: boolean) {
    const created = new Date(createdAtStr);
    const delivery = new Date(created);

    // Logic:
    // If order is created Mon-Sat -> Delivery is *This coming Sunday*
    // If order is created Sun -> Delivery is *Next Sunday* (7 days later) or *Today*?
    // Assumption: "Cierre de pedidos" is usually mid-week. If I order Sunday, it's for next Sunday.
    // Standard rule: Delivery is always on Sunday.
    // Calculate days until next Sunday.

    // 0=Sun, 1=Mon, ..., 6=Sat
    const dayOfWeek = created.getDay();
    // Days to add to reach next Sunday
    // If Today is Sun(0), target is next Sun(0) => +7 days
    // If Today is Mon(1), target is Sun(0) => +6 days
    // If Today is Sat(6), target is Sun(0) => +1 days
    let daysUntilSunday = (7 - dayOfWeek) % 7;
    if (daysUntilSunday === 0) daysUntilSunday = 7; // If today is Sunday, move to next Sunday

    let addDays = daysUntilSunday;

    // If client is "Frecuente":
    // "Second Sunday" means +7 days on top of the next Sunday.
    if (isFrecuente) {
      addDays += 7;
      this.deliveryReason.set('✨ Por ser clienta frecuente, tu entrega es el segundo domingo (para que juntes más pedidos) 💕');
    } else {
      this.deliveryReason.set('🌸 Por ser clienta nueva, tu entrega es este próximo domingo ✨');
    }

    // Apply date change
    delivery.setDate(created.getDate() + addDays);
    delivery.setHours(12, 0, 0, 0); // Noon

    const fmt = formatDate(delivery, "EEEE d 'de' MMMM", this.locale);
    // Capitalize first letter
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
      setTimeout(() => this.scrollChat(), 50);
    });
  }

  sendChat() {
    if (!this.newChatMessage.trim()) return;
    const text = this.newChatMessage.trim();
    this.newChatMessage = '';

    this.api.sendClientMessage(this.accessToken, text).subscribe(msg => {
      this.chatMessages.update(msgs => [...msgs, msg]);
      this.scrollChat();
    });
  }

  scrollChat() {
    setTimeout(() => {
      if (this.clientChatScroll) {
        this.clientChatScroll.nativeElement.scrollTop = this.clientChatScroll.nativeElement.scrollHeight;
      }
    }, 50);
  }
}
