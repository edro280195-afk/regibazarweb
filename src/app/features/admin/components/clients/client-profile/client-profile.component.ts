import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { ApiService } from '../../../../../core/services/api.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';
import { Client, OrderSummary, LoyaltySummary, LoyaltyTransaction } from '../../../../../shared/models/models';
import { NgxEchartsDirective, provideEcharts } from 'ngx-echarts';

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, NgxEchartsDirective, FormsModule],
  providers: [
    provideEcharts(),
    ConfirmationService
  ],
  template: `
    <div class="profile-page fade-in">
      <!-- ═══════════════ HEADER ═══════════════ -->
      <div class="page-header">
        <button class="btn-back" routerLink="/admin/clients">← Volver</button>
        <div class="header-content">
          <div class="avatar-large">
            {{ client()?.name?.charAt(0) }}
            @if(client()?.tag === 'VIP') { <span class="crown">👑</span> }
          </div>
          <div class="header-text">
             @if (isEditing()) {
               <input type="text" [(ngModel)]="editForm.name" class="input-name" placeholder="Nombre Clienta">
             } @else {
               <h2>{{ client()?.name }}</h2>
             }
             
             <div class="badges">
               @if (isEditing()) {
                 <select [(ngModel)]="editForm.tag" class="select-tag">
                    <option value="None">Normal 🌸</option>
                    <option value="RisingStar">Ascenso 🚀</option>
                    <option value="VIP">VIP 👑</option>
                    <option value="Blacklist">Blacklist 🚫</option>
                 </select>
               } @else {
                 <span class="badge-tag" [attr.data-tag]="client()?.tag">{{ client()?.tag || 'Nuevo' }}</span>
               }
               <span class="badge-type" [class.frecuente]="isFrecuente()" [class.nueva]="!isFrecuente()">
                  {{ isFrecuente() ? '💎 Frecuente' : '🌱 Nueva' }}
               </span>
               <span class="badge-id">ID: {{ client()?.id }}</span>
             </div>
          </div>
          
          <div class="header-actions">
            @if (isEditing()) {
              <button class="btn-cancel" (click)="toggleEdit()">Cancelar</button>
              <button class="btn-save" (click)="saveChanges()">Guardar</button>
            } @else {
              <button class="btn-edit" (click)="toggleEdit()">✏️ Editar</button>
            }
          </div>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner-cute"></div>
          <p>Cargando perfil de la reina... ✨</p>
        </div>
      } @else {
        
        <!-- ═══════════════ STATS CARDS ═══════════════ -->
        <div class="stats-row">
          <div class="stat-card pink">
            <span class="stat-label">Total Gastado (LTV)</span>
            <span class="stat-value">$ {{ stats().totalSpent | number:'1.0-0' }}</span>
          </div>
          <div class="stat-card purple">
            <span class="stat-label">Pedidos Totales</span>
            <span class="stat-value">{{ stats().totalOrders }}</span>
          </div>
          <!-- <div class="stat-card blue">
             <span class="stat-label">Ticket Promedio</span>
             <span class="stat-value">$ {{ stats().avgTicket | number:'1.0-0' }}</span>
          </div> -->
          <div class="stat-card orange">
             <span class="stat-label">Último Pedido</span>
             <span class="stat-value text-sm">{{ stats().lastOrderDate | date:'mediumDate' }}</span>
          </div>
        </div>

        <div class="profile-grid">
          <!-- ═══════════════ LEFT: INFO & CONTACT ═══════════════ -->
          <div class="col-left">
            <div class="info-card">
              <h3>📝 Datos Personales</h3>
              
              @if (isEditing()) {
                <div class="form-group">
                  <label>Teléfono</label>
                  <input type="text" [(ngModel)]="editForm.phone" placeholder="Ej. 81..." class="input-field">
                </div>
                <div class="form-group">
                  <label>Dirección</label>
                  <textarea [(ngModel)]="editForm.address" placeholder="Ej. Calle 123..." class="input-field" rows="3"></textarea>
                </div>
                
                <div class="delete-section">
                  <button class="btn-delete" (click)="deleteClient()">💀 Eliminar Clienta</button>
                </div>

              } @else {
                <div class="info-row">
                  <span class="icon">📞</span>
                  <div class="data">
                    <label>Teléfono</label>
                    <p>{{ client()?.phone || 'No registrado' }}</p>
                    @if(client()?.phone) {
                      <a [href]="'https://wa.me/52' + cleanPhone(client()!.phone!)" target="_blank" class="wa-link">Abrir WhatsApp</a>
                    }
                  </div>
                </div>
                <div class="info-row">
                  <span class="icon">🏠</span>
                  <div class="data">
                    <label>Dirección</label>
                    <p>{{ client()?.address || 'Sin dirección' }}</p>
                  </div>
                </div>
              }
            </div>


            <!-- TOP PRODUCTS CHART -->
             <!-- <div class="chart-card">
               <h3>🏆 Productos Favoritos</h3>
               <div echarts [options]="topProductsOption" class="echart-container"></div>
             </div> -->

             <!-- ═══════════════ LOYALTY CARD ═══════════════ -->
             <div class="info-card loyalty-card">
               <div class="loyalty-header">
                  <h3>💎 RegiPuntos</h3>
                  @if (loyalty()) {
                    <span class="tier-badge">{{ loyalty()?.tier }}</span>
                  }
               </div>

               @if (loyalty()) {
                 <div class="points-circle">
                   <span class="points-val">{{ loyalty()?.currentPoints }}</span>
                   <span class="points-lbl">Puntos Disponibles</span>
                 </div>
                 
                 <div class="loyalty-stats">
                   <div class="l-stat">
                     <label>De por vida</label>
                     <span>{{ loyalty()?.lifetimePoints }}</span>
                   </div>
                   <div class="l-stat">
                     <label>Último mov.</label>
                     <span>{{ loyalty()?.lastAccrual | date:'shortDate' }}</span>
                   </div>
                 </div>

                 <div class="loyalty-actions">
                   <button class="btn-points add" (click)="openPointsModal('add')">🎁 Regalar</button>
                   <button class="btn-points sub" (click)="openPointsModal('subtract')">🛍️ Canjear</button>
                 </div>

                 <div class="loyalty-history">
                   <h4>Historial reciente</h4>
                   @for (t of loyaltyHistory().slice(0, 5); track t.id) {
                     <div class="l-row">
                       <span class="l-date">{{ t.date | date:'shortDate' }}</span>
                       <span class="l-reason">{{ t.reason }}</span>
                       <span class="l-points" [class.pos]="t.points > 0" [class.neg]="t.points < 0">
                         {{ t.points > 0 ? '+' : '' }}{{ t.points }}
                       </span>
                     </div>
                   }
                   @if (loyaltyHistory().length === 0) {
                     <p class="no-history">Sin movimientos aún</p>
                   }
                 </div>

               } @else {
                 <div class="loyalty-loading">
                   <p>Cargando puntos...</p>
                 </div>
               }
             </div>
          </div>

          <!-- ═══════════════ RIGHT: ORDER HISTORY ═══════════════ -->
          <div class="col-right">
            <div class="history-card">
               <h3>🛍️ Historial de Pedidos</h3>
               <div class="orders-list">
                 @for (order of orders(); track order.id) {
                   <div class="order-item" [routerLink]="['/admin/orders', order.id]">
                     <div class="order-left">
                       <span class="order-id">#{{ order.id }}</span>
                       <span class="order-date">{{ order.createdAt | date:'shortDate' }}</span>
                     </div>
                     <div class="order-center">
                        <span class="status-pill" [attr.data-status]="order.status">{{ statusLabel(order.status) }}</span>
                        <span class="items-count">{{ order.items.length }} artículos</span>
                     </div>
                     <div class="order-right">
                        <span class="order-total">$ {{ order.total | number:'1.0-0' }}</span>
                        <span class="arrow">→</span>
                     </div>
                   </div>
                 } @empty {
                   <div class="empty-history">
                     <p>Aún no ha realizado pedidos 😿</p>
                   </div>
                 }
               </div>
            </div>
          </div>
        </div>
      }


      <!-- ═══════════════ MODAL: AJUSTAR PUNTOS ═══════════════ -->
      @if (showPointsModal()) {
        <div class="modal-overlay" (click)="showPointsModal.set(false)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>{{ pointsMode === 'add' ? '🎁 Regalar Puntos' : '🛍️ Canjear Puntos' }}</h3>
            
            <div class="form-group">
              <label>Puntos</label>
              <input type="number" [(ngModel)]="pointsForm.amount" min="1" class="input-field" placeholder="0">
            </div>

            <div class="form-group">
              <label>Motivo</label>
              <input type="text" [(ngModel)]="pointsForm.reason" class="input-field" 
                     [placeholder]="pointsMode === 'add' ? 'Ej. Cumpleaños, Promoción...' : 'Ej. Descuento $50, Gorra de regalo...'">
            </div>

            <div class="modal-actions">
              <button class="btn-cancel" (click)="showPointsModal.set(false)">Cancelar</button>
              <button class="btn-save" (click)="submitPoints()" [disabled]="!pointsForm.amount || !pointsForm.reason">
                {{ pointsMode === 'add' ? '✨ Enviar Regalo' : '✅ Aplicar Canje' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; padding: 2rem; max-width: 1200px; margin: 0 auto; }
    .fade-in { animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .page-header { margin-bottom: 2rem; }
    .btn-back { background: none; border: none; color: #666; cursor: pointer; font-weight: 600; margin-bottom: 1rem; transition: color 0.2s; &:hover { color: var(--pink-500); } }
    
    .header-content { display: flex; align-items: center; gap: 1.5rem; }
    .avatar-large {
      width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #fce7f3, #fae8ff);
      display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 800; color: var(--pink-600);
      position: relative; box-shadow: 0 10px 25px rgba(236,72,153,0.15); border: 4px solid white; flex-shrink: 0;
    }
    .crown { position: absolute; top: -10px; right: -5px; font-size: 1.5rem; transform: rotate(15deg); }
    
    .header-text h2 { margin: 0; font-family: var(--font-display); font-size: 2.5rem; color: var(--text-dark); }
    .badges { display: flex; gap: 10px; margin-top: 5px; align-items: center; }
    .badge-tag {
      background: #f3f4f6; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; color: #666;
      &[data-tag="VIP"] { background: linear-gradient(135deg, #FFD700, #ffb347); color: white; }
      &[data-tag="Problema"] { background: #fee2e2; color: #ef4444; }
    }
    
    .badge-type {
        font-size: 0.8rem; padding: 4px 10px; border-radius: 20px; font-weight: 800; text-transform: uppercase;
        &.nueva { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        &.frecuente { background: #fce7f3; color: #be185d; border: 1px solid #fbcfe8; }
    }

    .badge-id { font-size: 0.8rem; color: #ccc; letter-spacing: 1px; }

    /* Stats Grid */
    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .stat-card {
      background: white; padding: 1.5rem; border-radius: 20px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column;
      border: 1px solid white; transition: transform 0.2s;
      &:hover { transform: translateY(-3px); }
    }
    .stat-label { font-size: 0.75rem; color: #999; text-transform: uppercase; font-weight: 700; margin-bottom: 5px; }
    .stat-value { font-size: 1.8rem; font-weight: 800; color: var(--text-dark); font-family: var(--font-body); }
    .stat-value.text-sm { font-size: 1.2rem; }
    .stat-card.pink .stat-value { color: var(--pink-500); }
    .stat-card.purple .stat-value { color: #9333ea; }
    .stat-card.blue .stat-value { color: #0ea5e9; }
    .stat-card.orange .stat-value { color: #f97316; }

    /* Profile Grid */
    .profile-grid { display: grid; grid-template-columns: 350px 1fr; gap: 2rem; }
    @media (max-width: 900px) { .profile-grid { grid-template-columns: 1fr; } }

    .info-card, .chart-card, .history-card {
      background: white; border-radius: 24px; padding: 1.5rem; box-shadow: var(--shadow-sm); border: 1px solid white;
    }
    h3 { margin: 0 0 1.5rem; font-size: 1.1rem; color: var(--text-dark); font-weight: 800; }

    .info-card { margin-bottom: 2rem; }
    .info-row { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
    .info-row:last-child { margin-bottom: 0; }
    .icon { width: 40px; height: 40px; background: var(--bg-main); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
    .data { display: flex; flex-direction: column; }
    .data label { font-size: 0.75rem; color: #999; font-weight: 700; text-transform: uppercase; }
    .data p { margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-dark); }
    .wa-link { font-size: 0.8rem; color: #25D366; text-decoration: none; font-weight: 700; margin-top: 2px; }

    .echart-container { height: 250px; width: 100%; }

    /* Orders List */
    .orders-list { display: flex; flex-direction: column; gap: 1rem; max-height: 500px; overflow-y: auto; padding-right: 4px; }
    .order-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem; border-radius: 16px; border: 1px solid var(--border-soft); background: var(--bg-list-item);
      transition: all 0.2s; cursor: pointer;
      &:hover { background: white; border-color: var(--pink-200); transform: translateX(5px); box-shadow: 0 4px 15px rgba(0,0,0,0.03); }
    }
    .order-left { display: flex; flex-direction: column; gap: 2px; width: 80px; }
    .order-id { font-weight: 800; color: #ccc; font-size: 0.8rem; }
    .order-date { font-weight: 600; font-size: 0.9rem; }
    
    .status-pill { font-size: 0.7rem; padding: 4px 8px; border-radius: 12px; background: #eee; width: fit-content; }
    .status-pill[data-status="Pending"] { background: #fff7ed; color: #c2410c; }
    .status-pill[data-status="Delivered"] { background: #f0fdf4; color: #15803d; }
    
    .items-count { font-size: 0.8rem; color: #888; display: block; margin-top: 4px; }

    .order-right { text-align: right; }
    .order-total { display: block; font-weight: 800; font-size: 1.1rem; color: var(--pink-600); }
    .arrow { color: #ddd; font-size: 1.2rem; }

    .loading-state { text-align: center; padding: 4rem; color: #999; }
    .spinner-cute { width: 40px; height: 40px; border: 4px solid var(--pink-200); border-top-color: var(--pink-500); border-radius: 50%; animation: spin 1s infinite; margin: 0 auto 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }


    /* EDIT STYLES */
    .header-actions { margin-left: auto; display: flex; gap: 10px; }
    .btn-edit, .btn-cancel, .btn-save {
        padding: 8px 16px; border-radius: 20px; border: none; font-weight: 700; cursor: pointer; transition: 0.2s;
    }
    .btn-edit { background: var(--pink-100); color: var(--pink-600); &:hover { background: var(--pink-200); } }
    .btn-cancel { background: #fee2e2; color: #ef4444; &:hover { background: #fecaca; } }
    .btn-save { background: #dcfce7; color: #166534; &:hover { background: #bbf7d0; } }

    .input-name { font-size: 2rem; border: 1px solid #ddd; border-radius: 8px; padding: 4px 8px; width: 100%; font-family: var(--font-display); }
    .select-tag { padding: 4px; border-radius: 8px; border: 1px solid #ddd; }
    
    .form-group { margin-bottom: 15px; }
    .input-field { width: 100%; border: 1px solid #eee; background: #f9f9f9; padding: 10px; border-radius: 10px; font-family: inherit; }
    
    .delete-section { margin-top: 2rem; border-top: 1px dashed #fee2e2; padding-top: 1rem; text-align: center; }
    .btn-delete { background: #fee2e2; color: #b91c1c; border: none; padding: 10px 20px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; &:hover { background: #fecaca; } }
    
    /* LOYALTY CARD STYLES */
    .loyalty-card { background: linear-gradient(135deg, #fff0f7 0%, #fff 100%); border: 1px solid #fce7f3; }
    .loyalty-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .tier-badge { background: var(--pink-100); color: var(--pink-600); font-weight: 800; font-size: 0.75rem; padding: 4px 8px; border-radius: 12px; border: 1px solid var(--pink-200); }
    
    .points-circle { text-align: center; padding: 1.5rem; background: white; border-radius: 50%; width: 140px; height: 140px; margin: 0 auto 1.5rem; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 8px 20px rgba(236,72,153,0.1); border: 4px solid var(--pink-50); }
    .points-val { font-size: 2.5rem; font-weight: 800; color: var(--pink-500); line-height: 1; display: block; }
    .points-lbl { font-size: 0.7rem; text-transform: uppercase; color: #999; font-weight: 700; margin-top: 5px; }

    .loyalty-stats { display: flex; justify-content: space-around; margin-bottom: 1.5rem; text-align: center; }
    .l-stat label { font-size: 0.7rem; color: #aaa; font-weight: 700; display: block; margin-bottom: 2px; text-transform: uppercase; }
    .l-stat span { font-weight: 700; color: #555; font-size: 0.95rem; }

    .loyalty-actions { display: flex; gap: 10px; margin-bottom: 1.5rem; }
    .btn-points { flex: 1; border: none; padding: 8px; border-radius: 12px; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: transform 0.2s; }
    .btn-points:hover { transform: translateY(-2px); }
    .btn-points.add { background: #dcfce7; color: #166534; }
    .btn-points.sub { background: #fff7ed; color: #c2410c; }

    .loyalty-history h4 { font-size: 0.9rem; margin: 0 0 10px; color: #888; border-bottom: 1px solid #fce7f3; padding-bottom: 5px; }
    .l-row { display: flex; justify-content: space-between; font-size: 0.85rem; padding: 6px 0; border-bottom: 1px dashed #fce7f3; }
    .l-date { color: #999; font-size: 0.75rem; width: 60px; }
    .l-reason { flex: 1; color: var(--text-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 10px; }
    .l-points { font-weight: 700; }
    .l-points.pos { color: #16a34a; }
    .l-points.neg { color: #ef4444; }
    .no-history { text-align: center; color: #ccc; font-style: italic; font-size: 0.8rem; margin: 10px 0; }

    /* Modal Styles */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); animation: fadeIn 0.2s; }
    .modal-card { background: white; padding: 2rem; border-radius: 20px; width: 90%; max-width: 400px; box-shadow: 0 20px 50px rgba(0,0,0,0.2); animation: slideUp 0.3s; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 1.5rem; }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `]
})
export class ClientProfileComponent implements OnInit {
  client = signal<Client | null>(null);

  // Loyalty
  loyalty = signal<LoyaltySummary | null>(null);
  loyaltyHistory = signal<LoyaltyTransaction[]>([]);
  showPointsModal = signal(false);
  pointsMode: 'add' | 'subtract' = 'add';
  pointsForm = { amount: 0, reason: '' };


  orders = signal<OrderSummary[]>([]);
  loading = signal(true);
  stats = computed(() => {
    const orders = this.orders();
    const totalSpent = orders.reduce((acc, o) => acc + o.total, 0);
    const totalOrders = orders.length;
    const avgTicket = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const lastOrderDate = orders.length > 0 ? orders[0].createdAt : null; // Assuming sorted desc
    return { totalSpent, totalOrders, avgTicket, lastOrderDate };
  });

  isFrecuente = computed(() => {
    const c = this.client();
    if (!c) return false;
    return (c.orderCount > 1) || c.clientType === 'Frecuente';
  });

  topProductsOption: any;


  // EDIT STATE
  isEditing = signal(false);
  editForm = { name: '', phone: '', address: '', tag: '' };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private confirm: ConfirmationService
  ) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      if (id) this.loadData(id);
    });
  }

  loadData(clientId: number) {
    this.loading.set(true);
    // Fetch client details and their orders
    // In a real app we might have a specific endpoint. 
    // Here we might need to fetch all orders and filter (mock style)

    // ForkJoin isn't optimal if we don't have endpoints, but let's assume we use what we have.
    // We'll get all clients to find this one, and all orders to filter by this client.
    // Optimally: api.getClient(id) and api.getClientOrders(id)

    // Using existing generic methods for now:
    this.api.getClients().subscribe(clients => {
      const c = clients.find(x => x.id === clientId);
      this.client.set(c || null);


    });

    // Load Loyalty
    this.api.getLoyaltySummary(clientId).subscribe({
      next: (res) => this.loyalty.set(res),
      error: () => console.log('Sin datos de loyalty o error')
    });
    this.api.getLoyaltyHistory(clientId).subscribe({
      next: (hist) => this.loyaltyHistory.set(hist),
      error: () => { }
    });

    this.api.getOrders().subscribe(allOrders => {
      // Filter by client name matching... flawed if names aren't unique ids.
      // Ideally OrderSummary has clientId. Let's assume we filter by clientName for now as per mock structure.
      // Or wait, clients have IDs. Orders might not link perfectly in mock.
      // Let's match by clientName if client is loaded.

      // Wait for client to be set?
      // Let's look at OrderSummary model.. it has clientName.
      // We'll match loosely on name.
      const c = this.client();
      if (c) {
        const clientOrders = allOrders.filter(o => o.clientName === c.name).sort((a, b) => b.id - a.id);
        this.orders.set(clientOrders);
        this.prepareCharts(clientOrders);
      }
      this.loading.set(false);
    });
  }

  prepareCharts(orders: OrderSummary[]) {
    // Calculate top products
    const productCounts: Record<string, number> = {};
    orders.forEach(o => {
      o.items.forEach(i => {
        productCounts[i.productName] = (productCounts[i.productName] || 0) + i.quantity;
      });
    });

    const sorted = Object.entries(productCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    this.topProductsOption = {
      tooltip: { trigger: 'item' },
      series: [
        {
          name: 'Favoritos',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 12, fontWeight: 'bold' } },
          data: sorted.map(([name, value]) => ({ value, name }))
        }
      ]
    };
  }

  cleanPhone(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      'Pending': 'Pendiente', 'InRoute': 'En Ruta', 'Delivered': 'Entregado', 'Canceled': 'Cancelado', 'Postponed': 'Pospuesto'
    };
    return map[s] || s;
  }

  // ═══════════════ ACTIONS ═══════════════

  toggleEdit() {
    const c = this.client();
    if (!c) return;

    if (!this.isEditing()) {
      // Start edit
      this.editForm = {
        name: c.name,
        phone: c.phone || '',
        address: c.address || '',
        tag: c.tag || 'None'
      };
    }
    this.isEditing.update(v => !v);
  }

  saveChanges() {
    const c = this.client();
    if (!c) return;

    this.api.updateClient(c.id, this.editForm).subscribe({
      next: (updated: any) => {
        // If API returns the updated object, use it. If not, maybe re-fetch or use local copy.
        // Assuming API returns the object or we just update local state optimistically/merge.
        const newClient = { ...c, ...this.editForm };
        this.client.set(updated || newClient);
        this.isEditing.set(false);
      },
      error: (e) => alert('Error al guardar cambios')
    });
  }

  async deleteClient() {
    const c = this.client();
    if (!c) return;

    const confirmed = await this.confirm.confirm({
      title: '¿Eliminar clienta?',
      message: 'Se borrará permanentemente junto con su historial.',
      confirmText: 'Sí, eliminar',
      type: 'danger',
      icon: '🗑️'
    });

    if (confirmed) {
      this.api.deleteClient(c.id).subscribe({
        next: () => {
          this.router.navigate(['/admin/clients']);
        },
        error: () => alert('Error al eliminar')
      });
    }
  }

  // ═══════════════ LOYALTY ACTIONS ═══════════════
  openPointsModal(mode: 'add' | 'subtract') {
    this.pointsMode = mode;
    this.pointsForm = { amount: 0, reason: '' };
    this.showPointsModal.set(true);
  }

  submitPoints() {
    const c = this.client();
    if (!c || !this.pointsForm.amount) return;

    const points = this.pointsMode === 'add' ? this.pointsForm.amount : -this.pointsForm.amount;

    this.api.adjustLoyaltyPoints({
      clientId: c.id,
      points: points,
      reason: this.pointsForm.reason
    }).subscribe({
      next: (res) => {
        // Refresh loyalty data
        this.api.getLoyaltySummary(c.id).subscribe(l => this.loyalty.set(l));
        this.api.getLoyaltyHistory(c.id).subscribe(h => this.loyaltyHistory.set(h));

        this.showPointsModal.set(false);
        alert(res.message || 'Puntos actualizados ✨');
      },
      error: (err) => {
        alert(err.error || 'Error al ajustar puntos');
      }
    });
  }
}
