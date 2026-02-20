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

      <div class="page-header">
        <div>
          <h2>Clientas 👯‍♀️</h2>
          <p class="page-sub">Gestiona tu directorio y consiente a las VIP</p>
        </div>
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" [ngModel]="searchTerm()" (ngModelChange)="searchTerm.set($event)" placeholder="Buscar por nombre...">
        </div>

        <div class="actions-header">
          <button class="btn-nuke" (click)="onWipeClients()">
            💀 Borrar TODAS
          </button>
        </div>
      </div>

      <div class="clients-grid">
        @for (client of filteredClients(); track client.id) {
          <div class="client-card" [attr.data-tag]="client.tag" [routerLink]="['/admin/clients', client.id]">
            
            <button class="btn-delete-card" (click)="$event.stopPropagation(); deleteClient(client)" title="Eliminar clienta">
              🗑️
            </button>

            <div class="card-top">
              <div class="avatar">
                {{ client.name.charAt(0).toUpperCase() }}
              </div>
              <div class="info">
                <div class="name-row">
                    <h3>{{ client.name }}</h3>
                    <!-- TIPO DE CLIENTA BADGE -->
                    <span class="client-type-badge" 
                          [class.frecuente]="isFrecuente(client)" 
                          [class.nueva]="!isFrecuente(client)">
                        {{ isFrecuente(client) ? '💎 Frecuente' : '🌱 Nueva' }}
                    </span>
                </div>
                
                <span class="tag-badge" [attr.data-tag]="client.tag">
                  {{ getTagLabel(client.tag || 'None') }}
                </span>

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
      max-width: 1200px;
      margin: 0 auto;
      min-height: 100vh;
    }

    /* HEADER */
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      margin-bottom: 2rem; gap: 1rem; flex-wrap: wrap;
    }
    h2 {
      font-family: var(--font-display); font-size: 2.5rem; color: var(--pink-600);
      margin: 0; text-shadow: 2px 2px 0 white;
    }
    .page-sub {
      font-family: var(--font-body); color: var(--text-medium); margin: 5px 0 0; font-weight: 600;
    }

    .actions-header { display: flex; gap: 10px; align-items: center; }

    /* SEARCH BOX */
    .search-box {
      position: relative; width: 100%; max-width: 320px;
      input {
        width: 100%; padding: 12px 20px 12px 45px; border-radius: 25px;
        border: 2px solid transparent; background: var(--bg-card);
        box-shadow: 0 4px 15px rgba(255,107,157,0.08);
        font-family: var(--font-body); font-weight: 600; color: var(--text-medium);
        transition: all 0.3s; margin-left: auto;
        &:focus { outline: none; border-color: var(--pink-300); box-shadow: 0 6px 20px rgba(255,107,157,0.2); }
      }
      .search-icon {
        position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
        font-size: 1.1rem; opacity: 0.5; pointer-events: none;
      }
    }

    .btn-nuke {
      background: var(--bg-card); color: var(--color-danger); border: 1px solid var(--pink-200);
      padding: 8px 16px; border-radius: 20px; font-weight: 700;
      cursor: pointer; transition: 0.2s; font-size: 0.8rem;
      &:hover { background: var(--pink-50); transform: translateY(-2px); }
    }

    /* GRID */
    .clients-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .client-card {
      background: var(--bg-card);
      border-radius: 1.25rem; padding: 1.5rem;
      border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm);
      position: relative; overflow: hidden;
      transition: all 0.3s var(--ease-bounce);
      
      &:hover { transform: translateY(-5px); box-shadow: var(--shadow-md); z-index: 5; border-color: var(--pink-200); }
      
      /* Status Lines */
      &::before {
        content: ''; position: absolute; top: 0; left: 0; bottom: 0; width: 6px;
        background: var(--pink-100); transition: 0.3s;
      }
      &[data-tag="Vip"]::before { background: linear-gradient(to bottom, #FFD700, #FDB931); }
      &[data-tag="RisingStar"]::before { background: linear-gradient(to bottom, #d8b4fe, #a855f7); }
      &[data-tag="Blacklist"]::before { background: linear-gradient(to bottom, #fca5a5, #ef4444); }
      &[data-tag="None"]::before { background: var(--pink-200); }
    }

    .btn-delete-card {
      position: absolute; top: 10px; right: 10px; z-index: 10;
      width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border-soft);
      background: var(--bg-card); cursor: pointer; font-size: 0.85rem;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      color: #e11d48;
    }
    .client-card:hover .btn-delete-card { opacity: 1; }
    .btn-delete-card:hover { background: #fff0f0; border-color: #ffaaaa; transform: scale(1.1); }

    .card-top { display: flex; gap: 15px; align-items: flex-start; margin-bottom: 1rem; padding-left: 10px; }
    .avatar {
        width: 45px; height: 45px; background: var(--bg-main); border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.3rem; font-weight: 800; color: var(--pink-500);
        box-shadow: 0 4px 10px rgba(0,0,0,0.05); border: 2px solid var(--pink-50);
        flex-shrink: 0;
      }
      .info { flex: 1; overflow: hidden; }
      .name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
      .info h3 { margin: 0; font-size: 1.1rem; color: var(--text-dark); }

      .contact-info { margin-top: 6px; display: flex; flex-direction: column; gap: 2px; }
      .u-phone, .u-addr { margin: 0; font-size: 0.75rem; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .u-phone { color: var(--pink-500); font-weight: 600; }
    
    .client-type-badge {
        font-size: 0.65rem; padding: 2px 8px; border-radius: 10px; font-weight: 800; text-transform: uppercase;
        &.nueva { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        &.frecuente { background: #fce7f3; color: #be185d; border: 1px solid #fbcfe8; }
    }

    .tag-badge {
      font-size: 0.65rem; padding: 2px 8px; border-radius: 10px; font-weight: 700;
      text-transform: uppercase; display: inline-block;
    }
    .tag-badge[data-tag="Vip"] { background: #fffbe6; color: #d48806; border: 1px solid #ffe58f; }
    .tag-badge[data-tag="RisingStar"] { background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; }
    .tag-badge[data-tag="Blacklist"] { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    .tag-badge[data-tag="None"] { display: none; }

    /* INLINE EDIT */
    .inline-edit-section {
        background: rgba(255,255,255,0.5); border-radius: 12px; padding: 8px;
        margin-bottom: 1rem; display: flex; flex-direction: column; gap: 6px;
    }
    .edit-row { display: flex; align-items: center; gap: 8px; }
    .icon { width: 20px; text-align: center; font-size: 0.9rem; opacity: 0.6; }
    .edit-row input {
        flex: 1; border: none; background: transparent; border-bottom: 1px solid transparent;
        font-size: 0.9rem; padding: 4px; color: #555; font-family: inherit;
        transition: 0.2s; border-radius: 4px;
        &:focus { background: white; border-bottom-color: var(--pink-400); outline: none; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        &::placeholder { color: #ccc; }
    }
    .mini-select {
        flex: 1; border: none; background: transparent; font-size: 0.85rem; color: #555; 
        font-weight: 600; padding: 4px; border-radius: 4px; cursor: pointer;
        &:hover { background: rgba(255,255,255,0.8); }
    }

    .stats-row {
      background: var(--bg-main); border-radius: 16px; padding: 10px 15px;
      display: flex; justify-content: space-between; margin-left: 6px;
    }
    .stat { display: flex; flex-direction: column; text-align: center; }
    .stat small { font-size: 0.7rem; color: #999; font-weight: 700; text-transform: uppercase; }
    .stat strong { color: var(--pink-600); font-size: 1rem; }

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
      .page-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
      .search-box { max-width: 100%; }
      .actions-header { width: 100%; justify-content: flex-end; }
      .clients-grid { grid-template-columns: 1fr; }
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
    return (client.orderCount > 1) || (client.ordersCount || 0) > 1 || client.Type === 'Frecuente';
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
