import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { ApiService } from '../../../../../core/services/api.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';
import { Client, OrderSummary, LoyaltySummary, LoyaltyTransaction } from '../../../../../shared/models/models';
import { GoogleAutocompleteDirective } from '../../../../../shared/directives/google-autocomplete.directive';

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, GoogleAutocompleteDirective],
  providers: [
    ConfirmationService
  ],
  template: `
    <div class="profile-page fade-in">
      <!-- ═══════════════ HEADER ═══════════════ -->
      <div class="page-header glass-header">
        <button class="btn-back" routerLink="/admin/clients">← Regresar</button>
        <div class="header-content">
          <div class="avatar-large">
            {{ client()?.name?.charAt(0) }}
            @if(client()?.tag === 'VIP') { <span class="crown">👑</span> }
          </div>
          <div class="header-text">
             @if (isEditing()) {
               <input type="text" [(ngModel)]="editForm.name" class="input-name" placeholder="Nombre Clienta">
             } @else {
               <h2 class="client-name">{{ client()?.name }}</h2>
             }
             
             <div class="badges-row">
               @if (isEditing()) {
                 <select [(ngModel)]="editForm.tag" class="select-tag">
                    <option value="None">Normal 🌸</option>
                    <option value="RisingStar">Ascenso 🚀</option>
                    <option value="VIP">VIP 👑</option>
                    <option value="Blacklist">Blacklist 🚫</option>
                 </select>
                 <select [(ngModel)]="editForm.clientType" class="select-tag">
                    <option value="Nueva">Nueva 🌱</option>
                    <option value="Frecuente">Frecuente 💎</option>
                 </select>
               } @else {
                 <span class="tag-badge" [attr.data-tag]="client()?.tag">{{ client()?.tag || 'Normal' }}</span>
               }
               <span class="client-type-badge" [class.frecuente]="isFrecuente()" [class.nueva]="!isFrecuente()">
                  {{ isFrecuente() ? '💎 Frecuente' : '🌱 Nueva' }}
               </span>
               <span class="badge-id">ID: {{ client()?.id }}</span>
             </div>
          </div>
          
          <div class="header-actions">
            @if (isEditing()) {
              <button class="btn-action cancel" (click)="toggleEdit()">Cancelar</button>
              <button class="btn-action save" (click)="saveChanges()">Guardar</button>
            } @else {
              <button class="btn-action edit" (click)="toggleEdit()">✏️ Editar Perfil</button>
            }
          </div>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner-cute"></div>
          <p>Consultando perfil... ✨</p>
        </div>
      } @else {
        
        <!-- ═══════════════ STATS CARDS ═══════════════ -->
        <div class="stats-row">
          <div class="stat-card pink">
            <span class="stat-label">Total Gastado</span>
            <span class="stat-value">$ {{ stats().totalSpent | number:'1.0-0' }}</span>
          </div>
          <div class="stat-card purple">
            <span class="stat-label">Pedidos Totales</span>
            <span class="stat-value">{{ stats().totalOrders }}</span>
          </div>
          <div class="stat-card blue">
             <span class="stat-label">Ticket Promedio</span>
             <span class="stat-value">$ {{ stats().avgTicket | number:'1.0-0' }}</span>
          </div>
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
                  <textarea 
                    appGoogleAutocomplete
                    (onAddressChange)="handleAddressChange($event)"
                    [(ngModel)]="editForm.address" 
                    placeholder="Ej. Calle 123..." 
                    class="input-field" 
                    rows="3"></textarea>
                </div>
                
                <div class="delete-section">
                  <button class="btn-delete" (click)="deleteClient()">💀 Eliminar Clienta</button>
                </div>

              } @else {
                <div class="info-row">
                  <div class="icon-wrap"><span class="icon">📞</span></div>
                  <div class="data">
                    <label>Teléfono</label>
                    <p>{{ client()?.phone || 'No registrado' }}</p>
                    @if(client()?.phone) {
                      <a [href]="'https://wa.me/52' + cleanPhone(client()!.phone!)" target="_blank" class="wa-link">Abrir WhatsApp <span>→</span></a>
                    }
                  </div>
                </div>
                <div class="info-row">
                  <div class="icon-wrap"><span class="icon">📍</span></div>
                  <div class="data">
                    <label>Dirección</label>
                    <p class="address-text">{{ client()?.address || 'Sin dirección' }}</p>
                  </div>
                </div>
              }
            </div>

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
                       <div class="l-date-reason">
                         <span class="l-date">{{ t.date | date:'dd/MM' }}</span>
                         <span class="l-reason">{{ t.reason }}</span>
                       </div>
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
                     [placeholder]="pointsMode === 'add' ? 'Ej. Cumpleaños...' : 'Ej. Descuento $50...'">
            </div>

            <div class="modal-actions">
              <button class="btn-action cancel" (click)="showPointsModal.set(false)">Cancelar</button>
              <button class="btn-action save" (click)="submitPoints()" [disabled]="!pointsForm.amount || !pointsForm.reason">
                {{ pointsMode === 'add' ? '✨ Enviar Regalo' : '✅ Aplicar Canje' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    /* ═══════════════════════════════════════════
       DESIGN TOKENS & BASE
    ═══════════════════════════════════════════ */
    :host { 
      display: block; padding: 2rem 1.25rem 6rem; max-width: 1200px; margin: 0 auto; 
      --glass-bg: rgba(255, 255, 255, 0.7);
      --glass-border: rgba(255, 255, 255, 0.8);
      --shadow-soft: 0 10px 40px rgba(255, 107, 157, 0.1);
      --ease-bounce: cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .fade-in { animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    /* HEADER */
    .page-header { margin-bottom: 2rem; }
    .glass-header {
      background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(12px);
      padding: 1.5rem; border-radius: 24px; border: 1px solid white;
      box-shadow: 0 8px 32px rgba(255,107,157,0.08);
    }
    .btn-back { 
      background: none; border: none; color: #888; cursor: pointer; font-weight: 700; font-size: 0.9rem;
      margin-bottom: 1rem; transition: color 0.2s; 
      &:hover { color: var(--pink-600); } 
    }
    
    .header-content { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
    .avatar-large {
      width: 90px; height: 90px; border-radius: 30px; 
      background: linear-gradient(135deg, var(--pink-100), #fff);
      display: flex; align-items: center; justify-content: center; font-size: 3rem; font-weight: 800; color: var(--pink-500);
      position: relative; box-shadow: 0 10px 25px rgba(236,72,153,0.15); border: 3px solid white; flex-shrink: 0;
    }
    .crown { position: absolute; top: -12px; right: -8px; font-size: 2rem; transform: rotate(15deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1)); }
    
    .header-text { flex: 1; min-width: 250px; }
    .client-name { margin: 0 0 8px; font-family: var(--font-display); font-size: 2.2rem; color: var(--text-dark); letter-spacing: -0.5px; line-height: 1.1; }
    
    .badges-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    
    .client-type-badge, .tag-badge {
        font-size: 0.75rem; padding: 4px 12px; border-radius: 12px; font-weight: 800; text-transform: uppercase;
        display: inline-flex; align-items: center; justify-content: center; letter-spacing: 0.5px;
    }
    .client-type-badge.nueva { background: #dcfce7; color: #166534; }
    .client-type-badge.frecuente { background: #fce7f3; color: #be185d; }
    
    .tag-badge[data-tag="Vip"] { background: #fef08a; color: #854d0e; }
    .tag-badge[data-tag="RisingStar"] { background: #e9d5ff; color: #6b21a8; }
    .tag-badge[data-tag="Blacklist"] { background: #fecaca; color: #991b1b; }
    .tag-badge[data-tag="None"] { display: none; }

    .badge-id { font-size: 0.8rem; color: #ccc; letter-spacing: 1px; font-weight: 700; margin-left: auto; }

    /* EDIT ACTIONS */
    .header-actions { display: flex; gap: 10px; }
    .btn-action {
      height: 44px; padding: 0 20px; border-radius: 14px; border: none; font-weight: 700; font-size: 0.9rem;
      display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
    }
    .btn-action.edit { background: var(--pink-50); color: var(--pink-600); &:hover { background: var(--pink-100); transform: translateY(-2px); } }
    .btn-action.cancel { background: #fff1f2; color: #e11d48; &:hover { background: #ffe4e6; transform: translateY(-2px); } }
    .btn-action.save { background: #f0fdf4; color: #16a34a; &:hover { background: #dcfce7; transform: translateY(-2px); } }

    .input-name { font-size: 2rem; border: 2px dashed var(--pink-200); border-radius: 12px; padding: 4px 12px; width: 100%; font-family: var(--font-display); background: rgba(255,255,255,0.8); outline: none; margin-bottom: 8px; color: var(--text-dark); &:focus { border-color: var(--pink-400); } }
    .select-tag { padding: 8px; border-radius: 12px; border: 2px solid #eee; font-family: var(--font-body); font-weight: 600; color: #555; outline: none; &:focus { border-color: var(--pink-300); } }
    .input-money { padding: 8px; border-radius: 12px; border: 2px solid #eee; width: 100px; font-weight: 700; outline: none; &:focus { border-color: var(--pink-300); } }

    /* STATS ROW */
    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .stat-card {
      background: white; padding: 1.5rem; border-radius: 24px; box-shadow: var(--shadow-soft); display: flex; flex-direction: column;
      border: 2px solid transparent; transition: all 0.4s var(--ease-bounce); position: relative; overflow: hidden;
      &:hover { transform: translateY(-5px); box-shadow: 0 15px 35px rgba(255,107,157,0.15); border-color: var(--pink-100); }
    }
    .stat-label { font-size: 0.75rem; color: #999; text-transform: uppercase; font-weight: 800; margin-bottom: 8px; letter-spacing: 0.5px; z-index: 2; }
    .stat-value { font-size: 2rem; font-weight: 800; color: var(--text-dark); font-family: var(--font-display); z-index: 2; line-height: 1; }
    .stat-value.text-sm { font-size: 1.3rem; font-family: var(--font-body); }
    
    .stat-card.pink .stat-value { color: var(--pink-600); }
    .stat-card.purple .stat-value { color: #9333ea; }
    .stat-card.blue .stat-value { color: #0ea5e9; }
    .stat-card.orange .stat-value { color: #ea580c; }

    /* PROFILE GRID */
    .profile-grid { display: grid; grid-template-columns: 380px 1fr; gap: 2rem; }
    
    .info-card, .history-card {
      background: white; border-radius: 24px; padding: 1.8rem; box-shadow: var(--shadow-soft); border: 2px solid transparent;
    }
    h3 { margin: 0 0 1.5rem; font-size: 1.25rem; color: var(--text-dark); font-weight: 800; letter-spacing: -0.5px; }

    .info-card { margin-bottom: 2rem; }
    .info-row { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
    .info-row:last-child { margin-bottom: 0; }
    .icon-wrap { width: 44px; height: 44px; border-radius: 14px; background: var(--pink-50); display: flex; align-items: center; justify-content: center; }
    .icon { font-size: 1.3rem; }
    .data { display: flex; flex-direction: column; justify-content: center; flex: 1; overflow: hidden; }
    .data label { font-size: 0.75rem; color: #999; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
    .data p { margin: 2px 0 0; font-size: 1.05rem; font-weight: 700; color: var(--text-dark); }
    .address-text { white-space: normal; line-height: 1.4; }
    .wa-link { font-size: 0.85rem; color: #16a34a; text-decoration: none; font-weight: 800; margin-top: 4px; display: inline-flex; align-items: center; gap: 4px; transition: 0.2s; &:hover { color: #15803d; span { transform: translateX(3px); } } }

    /* FORM STYLES */
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; font-size: 0.8rem; font-weight: 800; color: #666; margin-bottom: 6px; text-transform: uppercase; }
    .input-field { width: 100%; border: 2px solid #eee; background: #fdfdfd; padding: 12px 16px; border-radius: 14px; font-family: inherit; font-weight: 600; font-size: 0.95rem; color: var(--text-dark); transition: all 0.2s; outline: none; &:focus { border-color: var(--pink-300); background: white; box-shadow: 0 4px 15px rgba(255,107,157,0.1); } }
    
    .delete-section { margin-top: 2rem; border-top: 2px dashed #fee2e2; padding-top: 1.5rem; text-align: center; }
    .btn-delete { background: #fff1f2; color: #e11d48; border: none; padding: 12px 24px; border-radius: 14px; font-weight: 800; cursor: pointer; transition: 0.2s; &:hover { background: #ffe4e6; transform: scale(1.05); } }

    /* LOYALTY CARD */
    .loyalty-card { background: linear-gradient(135deg, #fff5f8 0%, #ffffff 100%); border: 2px solid #fce7f3; }
    .loyalty-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .tier-badge { background: white; color: var(--pink-600); font-weight: 800; font-size: 0.8rem; padding: 6px 14px; border-radius: 16px; border: 2px solid var(--pink-200); box-shadow: 0 4px 10px rgba(255,107,157,0.1); }
    
    .points-circle { text-align: center; padding: 1.5rem; background: white; border-radius: 50%; width: 160px; height: 160px; margin: 0 auto 1.5rem; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 10px 30px rgba(236,72,153,0.15); border: 6px solid var(--pink-50); transition: transform 0.3s var(--ease-bounce); &:hover { transform: scale(1.05) rotate(2deg); border-color: var(--pink-100); } }
    .points-val { font-size: 3rem; font-weight: 800; color: var(--pink-500); line-height: 1; font-family: var(--font-display); display: block; }
    .points-lbl { font-size: 0.75rem; text-transform: uppercase; color: var(--pink-400); font-weight: 800; margin-top: 5px; letter-spacing: 0.5px; }

    .loyalty-stats { display: flex; justify-content: space-around; margin-bottom: 1.5rem; text-align: center; background: rgba(255,255,255,0.6); border-radius: 16px; padding: 10px; }
    .l-stat label { font-size: 0.7rem; color: #999; font-weight: 800; display: block; margin-bottom: 2px; text-transform: uppercase; }
    .l-stat span { font-weight: 800; color: var(--text-dark); font-size: 1.1rem; }

    .loyalty-actions { display: flex; gap: 12px; margin-bottom: 1.5rem; }
    .btn-points { flex: 1; border: none; height: 44px; border-radius: 14px; font-weight: 800; font-size: 0.95rem; cursor: pointer; transition: transform 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
    .btn-points:hover { transform: translateY(-3px); box-shadow: 0 6px 15px rgba(0,0,0,0.05); }
    .btn-points.add { background: #dcfce7; color: #166534; }
    .btn-points.sub { background: #fff7ed; color: #c2410c; }

    .loyalty-history h4 { font-size: 1rem; margin: 0 0 12px; color: var(--text-dark); font-weight: 800; border-bottom: 2px dashed #fce7f3; padding-bottom: 8px; }
    .l-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; padding: 10px 0; border-bottom: 1px dashed #fce7f3; }
    .l-date-reason { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow: hidden; padding-right: 10px; }
    .l-date { color: #999; font-size: 0.75rem; font-weight: 700; border-bottom: none!important; }
    .l-reason { color: var(--text-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
    .l-points { font-weight: 800; font-family: var(--font-display); font-size: 1.1rem; border-bottom: none!important;}
    .l-points.pos { color: #16a34a; }
    .l-points.neg { color: #ef4444; }
    .no-history { text-align: center; color: #ccc; font-style: italic; font-size: 0.9rem; margin: 20px 0; font-weight: 600; }

    /* Orders List */
    .orders-list { display: flex; flex-direction: column; gap: 1rem; max-height: 600px; overflow-y: auto; padding-right: 6px; 
      &::-webkit-scrollbar { width: 6px; }
      &::-webkit-scrollbar-track { background: transparent; }
      &::-webkit-scrollbar-thumb { background: #ddd; border-radius: 10px; }
    }
    .order-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.2rem; border-radius: 20px; border: 2px solid transparent; background: #fafafa;
      transition: all 0.3s var(--ease-bounce); cursor: pointer;
      &:hover { background: white; border-color: var(--pink-200); transform: translateX(5px); box-shadow: var(--shadow-soft); }
    }
    .order-left { display: flex; flex-direction: column; gap: 4px; width: 80px; }
    .order-id { font-weight: 800; color: #bbb; font-size: 0.85rem; letter-spacing: 0.5px; }
    .order-date { font-weight: 800; font-size: 0.95rem; color: var(--text-dark); }
    
    .status-pill { font-size: 0.75rem; padding: 4px 10px; border-radius: 12px; background: #eee; width: fit-content; font-weight: 800; }
    .status-pill[data-status="Pending"] { background: #fff7ed; color: #c2410c; }
    .status-pill[data-status="InRoute"] { background: #e0f2fe; color: #0284c7; }
    .status-pill[data-status="Delivered"] { background: #f0fdf4; color: #15803d; }
    .status-pill[data-status="Canceled"] { background: #fef2f2; color: #dc2626; }
    
    .items-count { font-size: 0.85rem; color: #888; display: block; margin-top: 6px; font-weight: 600; }

    .order-right { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .order-total { display: block; font-weight: 800; font-size: 1.2rem; color: var(--pink-600); font-family: var(--font-display); }
    .arrow { color: #ddd; font-size: 1.2rem; font-weight: 800; }

    .empty-history { text-align: center; padding: 3rem 1rem; color: var(--pink-400); font-weight: 700; background: var(--pink-50); border-radius: 20px; border: 2px dashed var(--pink-200); }
    
    .loading-state { text-align: center; padding: 5rem; color: #999; font-weight: 700; }
    .spinner-cute { width: 50px; height: 50px; border: 4px solid var(--pink-100); border-top-color: var(--pink-500); border-radius: 50%; animation: spin 1s infinite; margin: 0 auto 1.5rem; }

    /* Modal Styles */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 2000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); animation: fadeIn 0.3s; }
    .modal-card { background: white; padding: 2.5rem; border-radius: 24px; width: 90%; max-width: 420px; box-shadow: 0 25px 50px rgba(0,0,0,0.25); animation: slideUp 0.4s var(--ease-bounce); border: 1px solid white; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 2rem; }
    @keyframes slideUp { from { transform: translateY(30px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }

    /* MOBILE RESPONSIVE */
    @media (max-width: 900px) { 
      :host { padding: 1rem 1rem 6rem; }
      .profile-grid { grid-template-columns: 1fr; gap: 1.5rem; } 
      .page-header { margin-bottom: 1.5rem; }
      .header-actions { width: 100%; margin-top: 1rem; justify-content: stretch; }
      .btn-action { flex: 1; }
      .stats-row { grid-template-columns: repeat(2, 1fr); gap: 1rem; }
      .stat-card { padding: 1.2rem 1rem; }
      .stat-value { font-size: 1.6rem; }
      .stat-value.text-sm { font-size: 1.1rem; }
    }
    @media (max-width: 480px) {
      .header-content { flex-direction: column; align-items: center; text-align: center; gap: 1rem; }
      .badges-row { justify-content: center; }
      .badge-id { margin: 0 auto; display: block; width: 100%; text-align: center; margin-top: 8px; }
      .stats-row { grid-template-columns: 1fr; }
    }
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
    return (c.orderCount > 1) || c.type === 'Frecuente';
  });

  topProductsOption: any;


  // EDIT STATE
  isEditing = signal(false);
  editForm = { name: '', phone: '', address: '', tag: '', clientType: '', totalSpent: 0, latitude: 0, longitude: 0 };

  handleAddressChange(place: any) {
    this.editForm.address = place.address;
    this.editForm.latitude = place.lat;
    this.editForm.longitude = place.lng;
  }


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
        tag: c.tag || 'None',
        clientType: c.type || 'Nueva',
        totalSpent: c.totalSpent || 0,
        latitude: c.latitude || 0,
        longitude: c.longitude || 0
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
