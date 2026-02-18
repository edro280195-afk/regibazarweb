import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';

// Definimos la interfaz aquí mismo para rápido, o muévela a models.ts
interface Client {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  tag: string; // 'None', 'RisingStar', 'Vip', 'Blacklist'
  ordersCount: number;
  totalSpent: number;
}

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
          <input type="text" [(ngModel)]="searchTerm" placeholder="Buscar por nombre...">
        </div>

        <div class="actions-header">
          <button class="btn-nuke" (click)="onWipeClients()">
            💀 Borrar TODAS las clientas
          </button>
        </div>
      </div>

      <div class="clients-grid">
        @for (client of filteredClients(); track client.id) {
          <div class="client-card" [attr.data-tag]="client.tag" (click)="openEdit(client)">
            
            <button class="btn-delete-card" (click)="$event.stopPropagation(); deleteClient(client)" title="Eliminar clienta">
              🗑️
            </button>

            <div class="card-top">
              <div class="avatar">
                {{ client.name.charAt(0).toUpperCase() }}
              </div>
              <div class="info">
                <h3>{{ client.name }}</h3>
                <span class="tag-badge" [attr.data-tag]="client.tag">
                  {{ getTagLabel(client.tag) }}
                </span>
              </div>
            </div>

            <div class="stats-row">
              <div class="stat">
                <small>Pedidos</small>
                <strong>{{ client.ordersCount }}</strong>
              </div>
              <div class="stat">
                <small>Total Gastado</small>
                <strong>$ {{ client.totalSpent | number:'1.0-0' }}</strong>
              </div>
            </div>

            @if (client.phone || client.address) {
              <div class="contact-mini">
                @if (client.phone) { <span>📞 {{ client.phone }}</span> }
                @if (client.address) { <span>📍 {{ client.address }}</span> }
              </div>
            }
          </div>
        }
      </div>

      @if (clientToEdit()) {
        <div class="modal-overlay">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Editar Clienta ✨</h3>
              <button class="close-btn" (click)="clientToEdit.set(null)">✕</button>
            </div>

            <div class="form-group">
              <label>Nombre</label>
              <input type="text" [(ngModel)]="editData.name">
            </div>

            <div class="row">
              <div class="form-group">
                <label>Teléfono</label>
                <input type="text" [(ngModel)]="editData.phone" placeholder="Sin teléfono">
              </div>
              <div class="form-group">
                <label>Etiqueta 🏷️</label>
                <select [(ngModel)]="editData.tag" class="tag-select">
                  <option value="None">Normal 🌸</option>
                  <option value="RisingStar">En Ascenso 🚀</option>
                  <option value="Vip">Consentida 👑</option>
                  <option value="Blacklist">Lista Negra 🚫</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Dirección</label>
              <textarea [(ngModel)]="editData.address" rows="2" placeholder="Dirección de entrega"></textarea>
            </div>

            <div class="modal-footer">
              <button class="btn-save" (click)="saveClient()">Guardar Cambios 💾</button>
            </div>
          </div>
        </div>
      }
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
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .client-card {
      background: var(--bg-card);
      border-radius: 1.25rem; padding: 1.5rem;
      border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm);
      position: relative; overflow: hidden; cursor: pointer;
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
    }
    .client-card:hover .btn-delete-card { opacity: 1; }
    .btn-delete-card:hover { background: #fff0f0; border-color: #ffaaaa; transform: scale(1.1); }

    .card-top { display: flex; gap: 15px; align-items: center; margin-bottom: 1rem; padding-left: 10px; }
    .avatar {
        width: 50px; height: 50px; background: var(--bg-main); border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.5rem; font-weight: 800; color: var(--pink-500);
        box-shadow: 0 4px 10px rgba(0,0,0,0.05); border: 2px solid var(--pink-50);
      }
      .info { flex: 1; overflow: hidden; }
      .info h3 { margin: 0; font-size: 1.1rem; color: var(--text-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    
    .tag-badge {
      font-size: 0.7rem; padding: 3px 10px; border-radius: 12px; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; display: inline-block;
    }
    .tag-badge[data-tag="Vip"] { background: #fffbe6; color: #d48806; border: 1px solid #ffe58f; }
    .tag-badge[data-tag="RisingStar"] { background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; }
    .tag-badge[data-tag="Blacklist"] { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    .tag-badge[data-tag="None"] { background: #fdf2f8; color: var(--pink-600); border: 1px solid var(--pink-200); }

    .stats-row {
      background: var(--bg-main); border-radius: 16px; padding: 10px 15px;
      display: flex; justify-content: space-between; margin-bottom: 1rem; margin-left: 6px;
    }
    .stat { display: flex; flex-direction: column; text-align: center; }
    .stat small { font-size: 0.7rem; color: #999; font-weight: 700; text-transform: uppercase; }
    .stat strong { color: var(--pink-600); font-size: 1rem; }

    .contact-mini {
      margin-left: 6px; font-size: 0.85rem; color: #666; display: flex; flex-direction: column; gap: 4px;
    }

    /* MODAL */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
      z-index: 1000; display: flex; align-items: center; justify-content: center;
      padding: 1rem; animation: fadeIn 0.3s;
    }
    .modal-card {
      background: var(--bg-card); width: 100%; max-width: 450px; border-radius: 30px; padding: 2rem;
      box-shadow: 0 25px 60px rgba(0,0,0,0.25); border: 4px solid var(--bg-card);
      animation: popIn 0.4s var(--ease-bounce);
    }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .modal-header h3 { margin: 0; font-family: var(--font-display); font-size: 1.8rem; color: var(--pink-600); }
    .close-btn { background: none; border: none; font-size: 1.5rem; color: #ccc; cursor: pointer; transition: 0.2s; }
    .close-btn:hover { color: var(--pink-500); transform: rotate(90deg); }

    .form-group { margin-bottom: 1.2rem; }
    .row { display: flex; gap: 1rem; }
    label { display: block; font-weight: 700; font-size: 0.85rem; color: #888; margin-bottom: 6px; }
    
    input, textarea, select {
      width: 100%; padding: 12px; border-radius: 12px; border: 2px solid var(--border-soft);
      font-size: 0.95rem; font-family: inherit; transition: 0.3s; background: var(--bg-main);
      color: var(--text-dark);
      &:focus { border-color: var(--pink-300); background: var(--bg-card); outline: none; box-shadow: 0 4px 12px rgba(255,107,157,0.1); }
    }
    
    .tag-select { font-weight: 700; color: var(--pink-600); }
    
    .modal-footer { margin-top: 2rem; }
    .btn-save {
      width: 100%; padding: 14px; border-radius: 16px; border: none;
      background: linear-gradient(135deg, var(--pink-500), #db2777);
      color: white; font-weight: 800; font-size: 1.1rem; cursor: pointer;
      box-shadow: 0 8px 20px rgba(236,72,153,0.3); transition: 0.2s;
      &:hover { transform: translateY(-2px); box-shadow: 0 12px 25px rgba(236,72,153,0.4); }
    }

    /* TOAST */
    .toast-notification {
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: var(--bg-overlay); backdrop-filter: blur(10px); color: var(--text-dark);
      padding: 12px 24px; border-radius: 50px; font-weight: 700; z-index: 2000;
      box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid var(--pink-100);
      animation: slideDown 0.4s var(--ease-bounce);
    }
    @keyframes slideDown { from { transform: translate(-50%, -50px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }

    /* MEDIA QUERIES */
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
  searchTerm = '';
  clientToEdit = signal<Client | null>(null);

  // Datos del formulario
  editData = { name: '', phone: '', address: '', tag: 'None' };
  toastMessage = signal('');

  constructor(
    private api: ApiService,
    private confirm: ConfirmationService
  ) { }

  ngOnInit() {
    this.loadClients();
  }

  loadClients() {
    this.api.getClientsWithStats().subscribe(data => this.allClients.set(data));
  }

  // Filtrado computado
  filteredClients = computed(() => {
    const term = this.searchTerm.toLowerCase();
    return this.allClients().filter(c =>
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term))
    );
  });

  openEdit(client: Client) {
    this.clientToEdit.set(client);
    this.editData = {
      name: client.name,
      phone: client.phone || '',
      address: client.address || '',
      tag: client.tag
    };
  }

  saveClient() {
    const client = this.clientToEdit();
    if (!client) return;

    this.api.updateClient(client.id, this.editData).subscribe({
      next: () => {
        // Actualizar localmente para no recargar
        this.allClients.update(clients => clients.map(c =>
          c.id === client.id ? { ...c, ...this.editData } : c
        ));
        this.clientToEdit.set(null);
        this.showToast('¡Clienta actualizada! ✨');
      },
      error: () => this.showToast('Error al guardar 😓')
    });
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
