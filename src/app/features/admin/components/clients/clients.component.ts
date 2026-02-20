import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { Client, OrderSummary } from '../../../../shared/models/models';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="clients-page">
      
      @if (toastMessage()) { <div class="toast-notification">{{ toastMessage() }}</div> }

      <div class="page-header glass-header">
        <div class="header-text">
          <h2>Clientas 👯‍♀️</h2>
          <p class="page-sub">Gestiona tu directorio y consiente a las VIP 🎀</p>
        </div>
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" [ngModel]="searchTerm()" (ngModelChange)="searchTerm.set($event)" placeholder="Buscar por clienta...">
        </div>
      </div>

      <div class="clients-grid">
        @for (client of filteredClients(); track client.id) {
          <div class="client-card" [attr.data-tag]="client.tag" [routerLink]="['/admin/clients', client.id]">
            
            <div class="card-content">
              <div class="card-top">
                <div class="avatar-wrapper">
                  <div class="avatar">
                    {{ client.name.charAt(0).toUpperCase() }}
                  </div>
                </div>
                <div class="info">
                  <h3 class="client-name">{{ client.name }}</h3>
                  
                  <div class="badges-row">
                    <span class="client-type-badge" 
                          [class.frecuente]="isFrecuente(client)" 
                          [class.nueva]="!isFrecuente(client)">
                        {{ isFrecuente(client) ? '💎 Frecuente' : '🌱 Nueva' }}
                    </span>
                    <span class="tag-badge" [attr.data-tag]="client.tag">
                      {{ getTagLabel(client.tag || 'None') }}
                    </span>
                  </div>

                  <div class="contact-info">
                     <p class="u-phone">📞 {{ client.phone || 'Sin teléfono' }}</p>
                     <p class="u-addr">📍 {{ client.address || 'Sin dirección' }}</p>
                  </div>
                </div>
              </div>

              <div class="stats-row">
                <div class="stat">
                  <small>Pedidos</small>
                  <strong>{{ client.orderCount || client.ordersCount || 0 }}</strong>
                </div>
                <div class="stat">
                  <small>Gastado</small>
                  <strong>$ {{ (client.totalSpent || 0) | number:'1.0-0' }}</strong>
                </div>
              </div>
            </div>

            <div class="card-actions">
               <div class="btn-action view">Ver Perfil <span>→</span></div>
               <button class="btn-action delete" (click)="$event.stopPropagation(); deleteClient(client)" title="Eliminar clienta">🗑️</button>
            </div>
          </div>
        }
        @empty {
          <div class="empty-state">
            <div class="empty-icon">👯‍♀️</div>
            <h3>No hay clientas</h3>
            <p>Aún no tienes clientas registradas con ese nombre.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    /* ═══════════════════════════════════════════
       DESIGN TOKENS
    ═══════════════════════════════════════════ */
    :host {
      --glass-bg: rgba(255, 255, 255, 0.7);
      --glass-border: rgba(255, 255, 255, 0.8);
      --shadow-soft: 0 10px 40px rgba(255, 107, 157, 0.1);
      --ease-bounce: cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .clients-page {
      padding: 1rem 1.25rem 6rem;
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* HEADER & SEARCH */
    .page-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 2rem; gap: 1rem; flex-wrap: wrap;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(12px);
      padding: 1.5rem;
      border-radius: 24px;
      border: 1px solid white;
      box-shadow: 0 8px 32px rgba(255,107,157,0.08);
    }
    .header-text h2 {
      font-family: var(--font-display); font-size: 2.5rem; color: var(--pink-600);
      margin: 0; text-shadow: 2px 2px 0 white; line-height: 1.1;
    }
    .page-sub {
      font-family: var(--font-body); color: var(--text-medium); margin: 5px 0 0; font-weight: 600;
    }

    .search-box {
      position: relative; width: 100%; max-width: 380px;
      input {
        width: 100%; padding: 14px 20px 14px 48px; border-radius: 30px;
        border: 2px solid white; background: rgba(255,255,255,0.8);
        box-shadow: var(--shadow-soft);
        font-family: var(--font-body); font-weight: 600; color: var(--text-dark); font-size: 1rem;
        transition: all 0.3s ease;
        &:focus { outline: none; border-color: var(--pink-400); background: white; box-shadow: 0 12px 30px rgba(255,107,157,0.15); transform: translateY(-2px); }
        &::placeholder { color: #aaa; font-weight: 500; }
      }
      .search-icon {
        position: absolute; left: 18px; top: 50%; transform: translateY(-50%);
        font-size: 1.2rem; pointer-events: none;
      }
    }

    /* GRID */
    .clients-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
    }

    /* CLIENT CARD */
    .client-card {
      background: #ffffff;
      border-radius: 24px; padding: 1.5rem;
      border: 2px solid transparent; box-shadow: 0 8px 25px rgba(0,0,0,0.04);
      position: relative; overflow: hidden; cursor: pointer;
      display: flex; flex-direction: column; justify-content: space-between;
      transition: all 0.4s var(--ease-bounce);
      
      &:hover { 
        transform: translateY(-6px); 
        box-shadow: 0 15px 35px rgba(255,107,157,0.15); 
        border-color: var(--pink-100); 
        .avatar { transform: scale(1.1) rotate(5deg); }
        .btn-action.view span { transform: translateX(4px); }
      }
      
      /* Status Gradient Line */
      &::before {
        content: ''; position: absolute; top: 0; left: 0; bottom: 0; width: 8px;
        background: var(--pink-200); transition: 0.3s;
      }
      &[data-tag="Vip"]::before { background: linear-gradient(180deg, #FFD700, #FDB931); }
      &[data-tag="RisingStar"]::before { background: linear-gradient(180deg, #d8b4fe, #a855f7); }
      &[data-tag="Blacklist"]::before { background: linear-gradient(180deg, #fca5a5, #ef4444); }
    }

    .card-content { flex: 1; }
    .card-top { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 1.2rem; padding-left: 8px; }
    
    .avatar-wrapper { position: relative; }
    .avatar {
        width: 54px; height: 54px; border-radius: 20px;
        background: linear-gradient(135deg, var(--pink-50), #fff);
        display: flex; align-items: center; justify-content: center;
        font-size: 1.6rem; font-weight: 800; color: var(--pink-500);
        box-shadow: 0 8px 16px rgba(236,72,153,0.15); border: 2px solid white;
        flex-shrink: 0; transition: transform 0.4s var(--ease-bounce);
    }
    
    .info { flex: 1; overflow: hidden; }
    .client-name { margin: 0 0 6px; font-size: 1.25rem; color: var(--text-dark); font-weight: 800; letter-spacing: -0.5px; }
    
    .badges-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    
    .client-type-badge, .tag-badge {
        font-size: 0.7rem; padding: 4px 10px; border-radius: 12px; font-weight: 800; text-transform: uppercase;
        display: inline-flex; align-items: center; justify-content: center; letter-spacing: 0.5px;
    }
    .client-type-badge.nueva { background: #dcfce7; color: #166534; }
    .client-type-badge.frecuente { background: #fce7f3; color: #be185d; }
    
    .tag-badge[data-tag="Vip"] { background: #fef08a; color: #854d0e; }
    .tag-badge[data-tag="RisingStar"] { background: #e9d5ff; color: #6b21a8; }
    .tag-badge[data-tag="Blacklist"] { background: #fecaca; color: #991b1b; }
    .tag-badge[data-tag="None"] { display: none; }

    .contact-info { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
    .u-phone, .u-addr { margin: 0; font-size: 0.8rem; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
    .u-phone { color: var(--pink-500); font-weight: 700; }

    .stats-row {
      background: #fdf2f8; border-radius: 16px; padding: 12px 16px;
      display: flex; justify-content: space-around; margin-left: 8px;
    }
    .stat { display: flex; flex-direction: column; text-align: center; gap: 2px; }
    .stat small { font-size: 0.7rem; color: var(--pink-400); font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat strong { color: var(--pink-600); font-size: 1.15rem; font-family: var(--font-display); }

    /* CARD ACTIONS */
    .card-actions {
      display: flex; gap: 10px; padding-top: 16px; margin-top: 16px;
      border-top: 2px dashed var(--pink-100); margin-left: 8px;
    }
    
    .btn-action {
      height: 44px; border-radius: 14px; border: none; font-weight: 700; font-size: 0.9rem;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      transition: all 0.2s;
    }
    .btn-action.view {
      flex: 1; background: var(--pink-50); color: var(--pink-600); gap: 6px;
      &:hover { background: var(--pink-100); color: var(--pink-700); }
      span { transition: transform 0.2s; font-size: 1.1rem; }
    }
    .btn-action.delete {
      width: 44px; background: #fff1f2; color: #e11d48; font-size: 1.1rem; flex-shrink: 0;
      &:hover { background: #ffe4e6; transform: scale(1.05); }
    }

    /* EMPTY STATE */
    .empty-state {
      grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 4rem 1rem; text-align: center; background: rgba(255,255,255,0.5); border-radius: 24px; border: 2px dashed var(--pink-200);
    }
    .empty-icon { font-size: 4rem; margin-bottom: 1rem; filter: drop-shadow(0 10px 10px rgba(255,107,157,0.2)); }
    .empty-state h3 { color: var(--pink-600); font-family: var(--font-display); font-size: 1.8rem; margin: 0 0 0.5rem; }
    .empty-state p { color: var(--text-medium); font-weight: 600; margin: 0; }

    /* TOAST */
    .toast-notification {
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: var(--bg-overlay); backdrop-filter: blur(10px); color: var(--text-dark);
      padding: 12px 24px; border-radius: 50px; font-weight: 700; z-index: 2000;
      box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid var(--pink-100);
      animation: slideDown 0.4s var(--ease-bounce);
    }
    @keyframes slideDown { from { transform: translate(-50%, -50px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }

    @media (max-width: 768px) {
      .page-header { flex-direction: column; align-items: stretch; padding: 1.2rem; }
      .header-text { margin-bottom: 1rem; text-align: center; }
      .search-box { max-width: 100%; width: 100%; }
      .clients-grid { grid-template-columns: 1fr; gap: 1rem; }
      .card-top { flex-wrap: wrap; }
      .avatar { width: 48px; height: 48px; font-size: 1.4rem; }
      .stats-row { padding: 10px; margin-left: 0; }
      .card-actions { margin-left: 0; }
    }
  `]
})
export class ClientsComponent implements OnInit {
  allClients = signal<Client[]>([]);
  searchTerm = signal('');
  toastMessage = signal('');

  constructor(
    private api: ApiService,
    private confirm: ConfirmationService
  ) { }

  ngOnInit() {
    this.loadClients();
  }

  loadClients() {
    forkJoin({
      clients: this.api.getClients(),
      orders: this.api.getOrders()
    }).subscribe({
      next: ({ clients, orders }) => {
        // Calculate counts map
        const counts = new Map<number, number>(); // ClientID -> Count
        const nameCounts = new Map<string, number>(); // Name -> Count

        orders.forEach(o => {
          // Count by ID if available
          if (o.clientId) {
            counts.set(o.clientId, (counts.get(o.clientId) || 0) + 1);
          }
          // Also count by name as fallback/auxiliary
          const normName = o.clientName.trim().toLowerCase();
          nameCounts.set(normName, (nameCounts.get(normName) || 0) + 1);
        });

        // Merge logic
        const enrichedClients = clients.map(c => {
          let count = 0;
          if (counts.has(c.id)) {
            count = counts.get(c.id)!;
          } else {
            // Fallback to name match
            const normName = c.name.trim().toLowerCase();
            count = nameCounts.get(normName) || 0;
          }

          return {
            ...c,
            orderCount: count,
            // Also update totalSpent if we want to be fancy, but orderCount is the priority
            clientType: count > 1 ? 'Frecuente' : 'Nueva'
          } as Client;
        });

        this.allClients.set(enrichedClients);
      },
      error: (e) => {
        console.error('Error loading clients/orders', e);
        this.showToast('Error al cargar datos 😿');
      }
    });
  }

  // Filtrado computado
  filteredClients = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const list = this.allClients().filter(c =>
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term))
    );
    // Alfa Sort
    return list.sort((a, b) => a.name.localeCompare(b.name));
  });

  isFrecuente(client: Client): boolean {
    // Logic: Frecuente if orders > 1 OR explicitly tagged
    // If orderCount is not populated, fall back to simple check
    return (client.orderCount > 1) || (client.ordersCount || 0) > 1 || client.type === 'Frecuente';
  }



  async onWipeClients() {
    const confirm1 = await this.confirm.confirm({
      title: '⚠️ PELIGRO ⚠️',
      message: '¿Estás segura de que quieres eliminar a TODAS tus clientas? Esto también borrará TODO el historial de pedidos.',
      confirmText: 'Entiendo, continuar',
      type: 'danger',
      icon: '🧨'
    });

    if (!confirm1) return;

    const confirm2 = await this.confirm.confirm({
      title: '¿Segurísima?',
      message: 'Esta acción no se puede deshacer. Quedará todo vacío.',
      confirmText: 'Sí, borrar todo',
      type: 'danger',
      icon: '💀'
    });

    if (confirm2) {
      this.api.deleteAllClients().subscribe({
        next: () => {
          this.showToast('Base de datos de clientas reiniciada ✨');
          this.loadClients();
        },
        error: (e) => {
          console.error(e);
          this.showToast('Hubo un error al intentar borrar 😿');
        }
      });
    }
  }

  getTagLabel(tag: string): string {
    const labels: any = {
      'None': '🌸 Normal',
      'RisingStar': '🚀 En Ascenso',
      'Vip': '👑 Consentida',
      'Blacklist': '🚫 Lista Negra'
    };
    return labels[tag] || tag;
  }

  async deleteClient(client: Client) {
    const confirmed = await this.confirm.confirm({
      title: '¿Eliminar clienta?',
      message: `Se eliminará a "${client.name}" y todo su historial de pedidos.`,
      confirmText: 'Sí, eliminar',
      type: 'danger',
      icon: '🗑️'
    });

    if (confirmed) {
      this.api.deleteClient(client.id).subscribe({
        next: () => {
          this.allClients.update(clients => clients.filter(c => c.id !== client.id));
          this.showToast(`${client.name} eliminada 🗑️`);
        },
        error: () => this.showToast('Error al eliminar 😓')
      });
    }
  }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(''), 3000);
  }
}
