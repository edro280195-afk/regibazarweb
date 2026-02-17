import { Component, OnInit, OnDestroy, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { SignalRService } from '../../../../core/services/signalr.service';
import { ClientOrderView } from '../../../../shared/models/models';
import * as L from 'leaflet';

@Component({
  selector: 'app-order-view',
  standalone: true,
  imports: [CommonModule],
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
              <div><strong>¡Entregado!</strong><p>Tu pedido fue entregado con mucho cariño 🌸</p></div>
            }
            @case ('NotDelivered') {
              <span class="status-icon">😿</span>
              <div><strong>No se pudo entregar</strong><p>Contacta a tu vendedora para reprogramar 💌</p></div>
            }
          }
        </div>

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
        @if (showMap()) {
          <div class="map-section">
            <h3>📍 ¿Dónde va tu pedido?</h3>
            <div class="map-container" #mapContainer></div>
            @if (!o.driverLocation) {
              <p class="map-hint">El repartidor aún no ha compartido su ubicación, espera un poquito ✨</p>
            }
            @if (o.status === 'InTransit' && o.driverLocation) {
              <div class="map-legend">
                <span class="legend-item"><span class="legend-dot driver"></span> Repartidor</span>
                <span class="legend-line"></span>
                <span class="legend-item"><span class="legend-dot you"></span> Tu entrega</span>
              </div>
            }
          </div>
        }

        <!-- Order items -->
        <div class="order-section">
          <h3>Tu pedido 🛍️</h3>
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
        
        <!-- Payment Info -->
        <div class="payment-section">
          <h3>Formas de Pago 💸</h3>
          <p class="pay-hint">Elige la opción que prefieras para tu pago ✨</p>
          
          <!-- 1. TRANSFERENCIAS (BANAMEX) -->
          <div class="pay-card banamex">
            <div class="pay-header">
              <span class="pay-icon">🏦</span>
              <div>
                <strong>Transferencia (Preferido)</strong>
                <span class="bank-name">Citibanamex</span>
              </div>
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
          </div>

          <!-- 2. DEPÓSITOS (OXXO) -->
          <div class="pay-card oxxo">
            <div class="pay-header">
              <span class="pay-icon">🏪</span>
              <div>
                <strong>Depósito OXXO</strong>
                <span class="bank-name">Tarjeta Spin / Saldazo</span>
              </div>
            </div>
            <div class="card-details">
              <div class="card-row">
                <span class="card-label">Tarjeta:</span>
                <span class="card-num">4152 3144 9667 1333</span>
                <button class="btn-copy-card" (click)="copyText('4152314496671333')">Copiar</button>
              </div>
            </div>
            <div class="store-logos">
              <div class="store-badge">🏪 OXXO</div>
            </div>
          </div>

        </div>
        <p class="footer-msg">Hecho con 💗 para ti</p>
      }
    </div>
  `,
  styles: [`
    .client-page {
      min-height: 100vh;
      background: linear-gradient(180deg, #FFF5F9 0%, #FFE0EB 40%, #E8D5F5 100%);
      padding: 1.25rem; max-width: 500px; margin: 0 auto;
      position: relative; overflow: hidden;
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
      h1 { font-family: var(--font-display); color: var(--pink-600); font-size: 1.5rem; margin: 0; }
      .subtitle { font-family: var(--font-script); color: var(--rose-gold); font-size: 1.05rem; margin: 0.15rem 0 0; }
    }

    .status-banner {
      display: flex; align-items: center; gap: 1rem; padding: 1.15rem; border-radius: 1.25rem;
      margin-bottom: 1.25rem; backdrop-filter: blur(10px); animation: fadeInUp 0.5s ease; position: relative; z-index: 1;
      .status-icon { font-size: 2rem; &.pulse { animation: heartbeat 1.2s infinite; } }
      @keyframes heartbeat { 0%, 100% { transform: scale(1); } 25% { transform: scale(1.2); } }
      strong { color: var(--text-dark); display: block; font-family: var(--font-display); }
      p { margin: 0.1rem 0 0; font-size: 0.85rem; }
      &[data-status="Pending"] { background: rgba(255,248,220,0.7); border: 1px solid rgba(251,191,36,0.25); p { color: #92400E; } }
      &[data-status="InRoute"] { background: rgba(219,234,254,0.7); border: 1px solid rgba(96,165,250,0.25); p { color: #1E40AF; } }
      &[data-status="InTransit"] { background: linear-gradient(135deg, rgba(219,234,254,0.8), rgba(191,219,254,0.8)); border: 2px solid rgba(59,130,246,0.4); box-shadow: 0 0 0 4px rgba(59,130,246,0.08); p { color: #1D4ED8; } }
      &[data-status="Delivered"] { background: rgba(209,250,229,0.7); border: 1px solid rgba(52,211,153,0.25); p { color: #065F46; } }
      &[data-status="NotDelivered"] { background: rgba(255,228,230,0.7); border: 1px solid rgba(255,107,157,0.25); p { color: #9F1239; } }
    }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

    .queue-info { background: rgba(255,255,255,0.75); backdrop-filter: blur(10px); border: 1px solid rgba(96,165,250,0.2); border-radius: 1.25rem; padding: 1.25rem; margin-bottom: 1.25rem; text-align: center; position: relative; z-index: 1; }
    .queue-position { display: flex; flex-direction: column; align-items: center; margin-bottom: 0.75rem; }
    .queue-number { font-size: 2.5rem; font-weight: 800; color: #3B82F6; font-family: var(--font-display); line-height: 1; }
    .queue-label { font-size: 0.85rem; color: var(--text-medium); font-weight: 600; }
    .queue-bar { display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 0.5rem; }
    .queue-dot { width: 24px; height: 24px; border-radius: 50%; background: #E5E7EB; display: flex; align-items: center; justify-content: center; font-size: 0.55rem; font-weight: 800; color: white; transition: all 0.3s;
      &.done { background: #34D399; } &.current { background: #3B82F6; animation: pulse-dot 1.5s infinite; }
      &.you { background: var(--pink-500); width: 30px; height: 30px; border: 2px solid white; box-shadow: 0 2px 8px rgba(255,61,127,0.3); }
    }
    @keyframes pulse-dot { 0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); } 50% { box-shadow: 0 0 0 6px rgba(59,130,246,0); } }
    .queue-hint { font-size: 0.8rem; color: var(--text-muted); margin: 0; }

    .transit-alert { display: flex; align-items: center; gap: 1rem; background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(96,165,250,0.08)); border: 1.5px solid rgba(59,130,246,0.2); border-radius: 1.25rem; padding: 1rem; margin-bottom: 1.25rem; position: relative; z-index: 1;
      p { color: #1D4ED8; font-weight: 600; font-size: 0.9rem; margin: 0; }
    }
    .transit-icon-wrap { position: relative; }
    .transit-icon { font-size: 2rem; position: relative; z-index: 1; }
    .transit-pulse { position: absolute; inset: -4px; border-radius: 50%; background: rgba(59,130,246,0.2); animation: transit-ring 1.5s infinite; }
    @keyframes transit-ring { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }

    .map-section { margin-bottom: 1.5rem; position: relative; z-index: 1;
      h3 { color: var(--text-dark); font-size: 1rem; margin: 0 0 0.75rem; font-family: var(--font-display); }
    }
    .map-container { width: 100%; height: 280px; border-radius: 1.25rem; overflow: hidden; border: 2px solid rgba(255,157,191,0.2); box-shadow: var(--shadow-md); }
    .map-hint { color: var(--text-muted); font-size: 0.8rem; margin: 0.5rem 0 0; text-align: center; font-style: italic; }

    .map-legend {
      display: flex; align-items: center; justify-content: center; gap: 0.75rem;
      margin-top: 0.5rem; font-size: 0.78rem; color: var(--text-medium); font-weight: 600;
    }
    .legend-item { display: flex; align-items: center; gap: 0.3rem; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block;
      &.driver { background: #FF3D7F; box-shadow: 0 0 6px rgba(255,61,127,0.4); }
      &.you { background: #3B82F6; box-shadow: 0 0 6px rgba(59,130,246,0.4); }
    }
    .legend-line { width: 30px; height: 2px; background: repeating-linear-gradient(90deg, #3B82F6, #3B82F6 4px, transparent 4px, transparent 8px); }

    .order-section { position: relative; z-index: 1;
      h3 { color: var(--text-dark); font-size: 1rem; margin: 0 0 0.75rem; font-family: var(--font-display); }
    }
    .items-list { background: rgba(255,255,255,0.75); backdrop-filter: blur(10px); border: 1px solid rgba(255,157,191,0.2); border-radius: 1rem; overflow: hidden; box-shadow: var(--shadow-sm); }
    .item-row { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,107,157,0.06); &:last-child { border-bottom: none; } }
    .item-info { display: flex; gap: 0.5rem; align-items: center; }
    .item-name { color: var(--text-dark); font-size: 0.95rem; font-weight: 600; }
    .item-qty { color: var(--text-muted); font-size: 0.85rem; }
    .item-price { color: var(--pink-500); font-weight: 700; }
    .order-totals { margin-top: 0.75rem; padding: 0.5rem 0; }
    .total-row { display: flex; justify-content: space-between; padding: 0.3rem 0; color: var(--text-medium); font-size: 0.9rem;
      &.grand { border-top: 2px solid var(--border-pink); margin-top: 0.5rem; padding-top: 0.75rem; color: var(--pink-600); font-weight: 800; font-size: 1.2rem; font-family: var(--font-display); }
    }
    .footer-msg { text-align: center; margin-top: 2rem; font-family: var(--font-script); color: var(--rose-gold); font-size: 1rem; position: relative; z-index: 1; }

    /* PAYMENT SECTION */
    .payment-section { margin-top: 1.5rem; position: relative; z-index: 1; }
    .payment-section h3 { color: var(--text-dark); font-size: 1rem; margin: 0 0 0.5rem; font-family: var(--font-display); }
    .pay-hint { font-size: 0.85rem; color: var(--text-medium); margin-bottom: 1rem; }
    
    .pay-card {
      background: linear-gradient(135deg, white, #FFF0F5);
      border: 1px solid var(--pink-200); border-radius: 1rem; padding: 1.25rem;
      box-shadow: 0 4px 15px rgba(255,107,157,0.15); margin-bottom: 1rem;
      position: relative; overflow: hidden;
    }
    .pay-card::before {
       content: '🎀'; position: absolute; top: -10px; right: -10px; font-size: 4rem; opacity: 0.1; transform: rotate(15deg);
    }
    
    .pay-header { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1rem; }
    .pay-icon { font-size: 1.8rem; background: var(--pink-100); padding: 0.5rem; border-radius: 50%; }
    .pay-header strong { display: block; color: var(--text-dark); font-size: 0.95rem; }
    .bank-name { color: var(--pink-600); font-weight: 700; font-size: 0.85rem; }

    .card-details { background: rgba(255,255,255,0.6); border-radius: 0.75rem; padding: 0.8rem; border: 1px dashed var(--pink-300); }
    .card-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem; &:last-child { margin-bottom: 0; } }
    .card-label { color: var(--text-muted); }
    .card-num { font-family: monospace; font-size: 1rem; font-weight: 700; color: var(--text-dark); letter-spacing: 1px; }
    .card-name { font-weight: 600; color: var(--text-dark); }
    
    .btn-copy-card {
      background: var(--pink-500); color: white; border: none; border-radius: 0.5rem;
      padding: 0.2rem 0.6rem; font-size: 0.75rem; font-weight: 700; cursor: pointer;
      transition: all 0.2s;
      &:active { transform: scale(0.95); }
    }
    
    .store-logos { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; opacity: 0.8; }
    .store-badge {
       background: white; border: 1px solid #ddd; padding: 0.4rem 0.8rem; border-radius: 20px;
       font-size: 0.75rem; font-weight: 600; color: #555;
    }
  `]
})
export class OrderViewComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer') mapEl?: ElementRef;

  order = signal<ClientOrderView | null>(null);
  loading = signal(true);
  expired = signal(false);
  notFound = signal(false);
  showMap = signal(false);

  private map?: L.Map;
  private driverMarker?: L.Marker;
  private destinationMarker?: L.Marker;
  private routeLine?: L.Polyline;
  private accessToken = '';
  private locationSub?: Subscription;
  private deliverySub?: Subscription;
  private signalrConnected = false;
  private lastDriverLat = 0;
  private lastDriverLng = 0;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private signalr: SignalRService
  ) { }

  ngOnInit(): void {
    this.accessToken = this.route.snapshot.paramMap.get('token') || '';
    this.loadOrder();
  }

  ngOnDestroy(): void {
    this.locationSub?.unsubscribe();
    this.deliverySub?.unsubscribe();
    this.signalr.disconnect();
    this.destroyMap();
  }

  private loadOrder(): void {
    this.api.getClientOrder(this.accessToken).subscribe({
      next: (order) => {
        const prevStatus = this.order()?.status;
        this.order.set(order);
        this.loading.set(false);

        const needsMap = order.status === 'InRoute' || order.status === 'InTransit';
        this.showMap.set(needsMap);

        if (needsMap) {
          // Destroy old map if status changed (template recreated the div)
          if (prevStatus && prevStatus !== order.status) {
            this.destroyMap();
          }
          // Wait for Angular to render the map container
          setTimeout(() => this.ensureMap(order), 200);

          // Connect SignalR only once
          if (!this.signalrConnected) {
            this.connectRealtime();
          }
        } else {
          this.destroyMap();
        }
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 410) this.expired.set(true);
        else this.notFound.set(true);
      }
    });
  }

  // ═══ MAP MANAGEMENT ═══

  private destroyMap(): void {
    if (this.map) {
      this.map.remove();
      this.map = undefined;
      this.driverMarker = undefined;
      this.destinationMarker = undefined;
      this.routeLine = undefined;
    }
  }

  private ensureMap(order: ClientOrderView): void {
    if (!this.mapEl) return;

    // If map already exists on THIS element, just update
    if (this.map) {
      this.updateMapContent(order);
      return;
    }

    // Create new map
    this.map = L.map(this.mapEl.nativeElement, {
      zoomControl: true,
      attributionControl: false
    }).setView([25.75, -100.3], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OSM'
    }).addTo(this.map);

    this.updateMapContent(order);
  }

  private updateMapContent(order: ClientOrderView): void {
    if (!this.map) return;

    const driverLoc = order.driverLocation;
    if (driverLoc) {
      this.lastDriverLat = driverLoc.latitude;
      this.lastDriverLng = driverLoc.longitude;
      this.setDriverMarker(driverLoc.latitude, driverLoc.longitude);
    }

    // Center the map intelligently
    if (this.lastDriverLat && this.lastDriverLng && !isNaN(this.lastDriverLat) && !isNaN(this.lastDriverLng)) {
      this.map.setView([this.lastDriverLat, this.lastDriverLng], 15);
    }
  }

  private setDriverMarker(lat: number, lng: number): void {
    if (!this.map || !lat || !lng || isNaN(lat) || isNaN(lng)) return;

    const driverIcon = L.divIcon({
      html: `<div style="
        background:#FF3D7F; width:18px; height:18px; border-radius:50%;
        border:3px solid white; box-shadow:0 0 14px rgba(255,61,127,0.5);
      "></div>`,
      iconSize: [24, 24], iconAnchor: [12, 12], className: ''
    });

    if (!this.driverMarker) {
      this.driverMarker = L.marker([lat, lng], { icon: driverIcon, zIndexOffset: 1000 }).addTo(this.map);
    } else {
      this.driverMarker.setLatLng([lat, lng]);
    }

    // Auto-follow: keep map centered on driver
    this.map.panTo([lat, lng], { animate: true, duration: 0.5 });
  }

  // Draws a dashed line from driver to client destination
  private drawRouteLine(driverLat: number, driverLng: number, destLat: number, destLng: number): void {
    if (!this.map || !driverLat || !driverLng || !destLat || !destLng) return;
    if (isNaN(driverLat) || isNaN(driverLng) || isNaN(destLat) || isNaN(destLng)) return;

    // Remove old line
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
    }

    this.routeLine = L.polyline(
      [[driverLat, driverLng], [destLat, destLng]],
      { color: '#3B82F6', weight: 3, opacity: 0.7, dashArray: '8, 8' }
    ).addTo(this.map);

    // Destination marker (client's location)
    const destIcon = L.divIcon({
      html: `<div style="
        background:#3B82F6; width:14px; height:14px; border-radius:50%;
        border:3px solid white; box-shadow:0 0 10px rgba(59,130,246,0.5);
      "></div>`,
      iconSize: [20, 20], iconAnchor: [10, 10], className: ''
    });

    if (!this.destinationMarker) {
      this.destinationMarker = L.marker([destLat, destLng], { icon: destIcon }).addTo(this.map);
      this.destinationMarker.bindPopup('<b>Tu ubicación de entrega</b>');
    } else {
      this.destinationMarker.setLatLng([destLat, destLng]);
    }

    // Fit both points in view
    this.map.fitBounds([[driverLat, driverLng], [destLat, destLng]], {
      padding: [50, 50], maxZoom: 16
    });
  }

  // ═══ REAL-TIME ═══

  private async connectRealtime(): Promise<void> {
    try {
      await this.signalr.connectPublic();
      await this.signalr.joinOrder(this.accessToken);
      this.signalrConnected = true;

      this.locationSub = this.signalr.locationUpdate$.subscribe(loc => {
        this.lastDriverLat = loc.latitude;
        this.lastDriverLng = loc.longitude;
        this.setDriverMarker(loc.latitude, loc.longitude);

        // If InTransit and we have client coords, redraw the line
        const o = this.order();
        if (o?.status === 'InTransit' && o.clientLatitude && o.clientLongitude) {
          this.drawRouteLine(loc.latitude, loc.longitude, o.clientLatitude, o.clientLongitude);
        }
      });

      // Any delivery/status update → full reload
      this.deliverySub = this.signalr.deliveryUpdate$.subscribe(() => {
        this.reloadOrder();
      });
    } catch (err) {
      console.error('SignalR connection failed:', err);
      // Fallback: poll every 15 seconds
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
          if (prevStatus && prevStatus !== order.status) {
            this.destroyMap();
          }
          setTimeout(() => this.ensureMap(order), 200);
        } else {
          this.destroyMap();
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
    // Could add toast here but simple copy is fine for now
    alert('¡Número de tarjeta copiado! 💳');
  }
}
