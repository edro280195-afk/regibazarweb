import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { Supplier, Investment } from '../../../../shared/models/models';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="suppliers-page">
      <header class="page-header">
        <div>
          <h2>Mis Proveedores 📦</h2>
          <p class="page-sub">Gestiona tus compras e inversiones 💰</p>
        </div>
        <button class="btn-primary" (click)="openNewSupplierForm()">
          + Nuevo Proveedor
        </button>
      </header>

      @if (loading()) {
        <div class="loading-state">
          <span class="spinner-lg"></span>
          <p>Cargando proveedores...</p>
        </div>
      }

      @if (feedbackMsg()) {
        <div class="feedback-toast" [class.error]="feedbackIsError()">
          {{ feedbackMsg() }}
        </div>
      }

      <!-- ═══ LISTA DE PROVEEDORES ═══ -->
      <div class="suppliers-grid">
        @for (supplier of suppliers(); track supplier.id) {
          <div class="supplier-card">
            <div class="card-top" (click)="openSupplierDetails(supplier)">
              <div class="card-icon">{{ supplier.name.charAt(0).toUpperCase() }}</div>
              <div class="card-info">
                <h3>{{ supplier.name }}</h3>
                <p class="contact-name">👤 {{ supplier.contactName || 'Sin contacto' }}</p>
                <p class="contact-phone">📞 {{ supplier.phone || 'Sin teléfono' }}</p>
              </div>
            </div>
            <div class="card-actions">
              <button class="btn-view" (click)="openSupplierDetails(supplier)">💰 Inversiones</button>
              <button class="btn-edit" (click)="openEditSupplierForm(supplier)">✏️</button>
              <button class="btn-delete" (click)="confirmDeleteSupplier(supplier)">🗑️</button>
            </div>
          </div>
        } @empty {
          @if (!loading()) {
            <div class="empty-state">
              <span class="empty-icon">📦</span>
              <p>No tienes proveedores registrados.</p>
              <button class="btn-link" (click)="openNewSupplierForm()">Registrar el primero ✨</button>
            </div>
          }
        }
      </div>

      <!-- ═══ MODAL: CREAR / EDITAR PROVEEDOR ═══ -->
      @if (showSupplierModal()) {
        <div class="modal-overlay" (click)="closeSupplierModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>{{ editingSupplier() ? '✏️ Editar Proveedor' : '✨ Nuevo Proveedor' }}</h3>
            <div class="form-group">
              <label>Nombre de la Empresa / Marca</label>
              <input type="text" [(ngModel)]="supplierForm.name" placeholder="Ej. Shein, Liverpool...">
            </div>
            <div class="form-group">
              <label>Nombre de Contacto (Opcional)</label>
              <input type="text" [(ngModel)]="supplierForm.contactName" placeholder="Ej. Juan Pérez">
            </div>
            <div class="form-group">
              <label>Teléfono (Opcional)</label>
              <input type="text" [(ngModel)]="supplierForm.phone" placeholder="Ej. 81 1234 5678">
            </div>
            <div class="form-group">
              <label>Notas</label>
              <textarea [(ngModel)]="supplierForm.notes" rows="3" placeholder="Detalles extra..."></textarea>
            </div>
            <div class="modal-actions">
              <button class="btn-cancel" (click)="closeSupplierModal()">Cancelar</button>
              <button class="btn-confirm" (click)="saveSupplier()" 
                      [disabled]="!supplierForm.name?.trim() || savingSupplier()">
                @if (savingSupplier()) { <span class="spinner"></span> }
                {{ editingSupplier() ? 'Actualizar' : 'Guardar' }}
              </button>
            </div>
          </div>
        </div>
      }



      <!-- ═══ DRAWER: DETALLES E INVERSIONES ═══ -->
      @if (selectedSupplier()) {
        <div class="drawer-overlay" (click)="closeDetails()">
          <div class="drawer-panel" (click)="$event.stopPropagation()">
            <div class="drawer-header">
              <button class="close-drawer-btn" (click)="closeDetails()">← Volver</button>
              <div class="drawer-title">
                <h2>{{ selectedSupplier()!.name }}</h2>
                <span class="badge">Proveedor</span>
              </div>
            </div>

            <div class="drawer-content">
              <!-- Info del proveedor -->
              <div class="supplier-summary">
                <div class="summary-item">
                  <label>Contacto</label>
                  <span>{{ selectedSupplier()!.contactName || '-' }}</span>
                </div>
                <div class="summary-item">
                  <label>Teléfono</label>
                  <span>{{ selectedSupplier()!.phone || '-' }}</span>
                </div>
                <div class="summary-item full">
                  <label>Notas</label>
                  <span>{{ selectedSupplier()!.notes || 'Sin notas' }}</span>
                </div>
              </div>

              <!-- Sección Inversiones -->
              <div class="investments-section">
                <div class="section-header">
                  <h3>💰 Historial de Inversiones</h3>
                  <div class="total-invested">
                    <span>Total invertido:</span>
                    <strong>$ {{ totalInvested() | number:'1.2-2' }}</strong>
                  </div>
                </div>

                <!-- Formulario rápido inversión -->
                <div class="add-investment-box">
                  <h4>➕ Nueva Inversión</h4>
                  <div class="inv-form-row">
                    <div class="field">
                      <label>Monto $</label>
                      <input type="number" [(ngModel)]="newInvestment.amount" placeholder="0.00" min="0.01" step="0.01">
                    </div>
                    <div class="field">
                      <label>Fecha</label>
                      <input type="date" [(ngModel)]="newInvestment.date">
                    </div>
                  </div>
                  <div class="field">
                    <input type="text" [(ngModel)]="newInvestment.notes" placeholder="Nota (opcional)"
                           (keydown.enter)="addInvestment()">
                  </div>
                  <button class="btn-add-inv" (click)="addInvestment()"
                          [disabled]="!newInvestment.amount || newInvestment.amount <= 0 || savingInvestment()">
                    @if (savingInvestment()) { <span class="spinner"></span> }
                    Registrar Inversión
                  </button>
                </div>

                <!-- Loading inversiones -->
                @if (loadingInvestments()) {
                  <div class="loading-inv">Cargando inversiones... ⏳</div>
                }

                <!-- Lista de Inversiones -->
                <div class="investments-list">
                  @for (inv of investments(); track inv.id) {
                    <div class="inv-card">
                      <div class="inv-date">
                        <span class="day">{{ inv.date | date:'dd' }}</span>
                        <span class="month">{{ inv.date | date:'MMM yy' }}</span>
                      </div>
                      <div class="inv-details">
                        <span class="inv-amount">$ {{ inv.amount | number:'1.2-2' }}</span>
                        <span class="inv-note">{{ inv.notes || 'Inversión registrada' }}</span>
                      </div>
                      <button class="btn-remove-inv" (click)="confirmDeleteInvestment(inv)" title="Eliminar inversión">
                        ×
                      </button>
                    </div>
                  } @empty {
                    @if (!loadingInvestments()) {
                      <div class="no-inv">Sin inversiones registradas aún. 📊</div>
                    }
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      }


    </div>
  `,
  styles: [`
    .suppliers-page { max-width: 1200px; }

    .page-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;
      h2 { font-family: var(--font-display); color: var(--text-dark); margin: 0; }
      .page-sub { font-family: var(--font-script); color: var(--rose-gold); margin: 0; font-size: 1.1rem; }
    }

    .btn-primary {
      padding: 0.8rem 1.5rem; background: linear-gradient(135deg, var(--pink-400), var(--pink-500));
      color: white; border: none; border-radius: 2rem; font-weight: 700; cursor: pointer;
      transition: all 0.3s var(--ease-bounce);
      box-shadow: 0 4px 12px rgba(255,107,157,0.3);
      &:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(255,107,157,0.4); }
    }

    /* LOADING */
    .loading-state {
      display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
      padding: 3rem; color: var(--text-muted);
    }
    .spinner-lg {
      width: 32px; height: 32px; border: 3px solid var(--pink-100);
      border-top-color: var(--pink-400); border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    /* FEEDBACK TOAST */
    .feedback-toast {
      position: fixed; top: 1.5rem; right: 1.5rem; z-index: 2000;
      padding: 0.75rem 1.25rem; border-radius: 1rem; font-weight: 600; font-size: 0.9rem;
      background: linear-gradient(135deg, #d4edda, #c3e6cb); color: #155724;
      border: 1px solid #b1dfbb; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      animation: slideDown 0.3s ease-out, fadeOut 0.5s ease 2.5s forwards;
      &.error { background: linear-gradient(135deg, #fde8ec, #fdd); color: #c0392b; border-color: #f5c6cb; }
    }
    @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes fadeOut { to { opacity: 0; transform: translateY(-10px); } }

    /* GRID */
    .suppliers-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;
    }

    .supplier-card {
      background: var(--bg-card); border-radius: 1.25rem; overflow: hidden;
      border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm);
      transition: all 0.2s;
      &:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: var(--pink-200); }
    }

    .card-top {
      display: flex; gap: 1rem; padding: 1.25rem 1.25rem 0.75rem; cursor: pointer;
    }

    .card-icon {
      width: 50px; height: 50px; background: linear-gradient(135deg, var(--pink-100), var(--pink-50));
      color: var(--pink-600); border-radius: 12px; display: flex; align-items: center;
      justify-content: center; font-size: 1.5rem; font-weight: 800; font-family: var(--font-display);
      flex-shrink: 0;
    }

    .card-info {
      flex: 1; min-width: 0;
      h3 { margin: 0 0 0.3rem; font-size: 1.05rem; color: var(--text-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    }
    .contact-name, .contact-phone { margin: 0.15rem 0; font-size: 0.85rem; color: var(--text-medium); }

    .card-actions {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem;
      border-top: 1px dashed var(--border-soft);
    }

    .btn-view {
      flex: 1; background: none; border: none; color: var(--pink-500); font-weight: 700;
      font-size: 0.85rem; cursor: pointer; text-align: left; padding: 0.3rem 0;
      &:hover { text-decoration: underline; }
    }

    .btn-edit, .btn-delete {
      width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--border-soft);
      background: var(--bg-card); cursor: pointer; font-size: 0.85rem;
      display: flex; align-items: center; justify-content: center; transition: all 0.2s;
    }
    .btn-edit:hover { background: #f0f7ff; border-color: #a0c4ff; }
    .btn-delete:hover { background: #fff0f0; border-color: #ffaaaa; }

    /* EMPTY STATE */
    .empty-state {
      grid-column: 1 / -1; text-align: center; padding: 4rem 2rem;
      .empty-icon { font-size: 3rem; display: block; margin-bottom: 0.5rem; opacity: 0.4; }
      p { color: var(--text-muted); margin: 0.5rem 0; }
    }
    .btn-link {
      background: none; border: none; color: var(--pink-500); font-weight: 700;
      cursor: pointer; font-size: 1rem; &:hover { text-decoration: underline; }
    }

    /* MODAL */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
      &.top-z { z-index: 1100; }
    }

    .modal-card {
      background: var(--bg-card); width: 90%; max-width: 450px; padding: 2rem;
      border-radius: 1.5rem; box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      animation: modalIn 0.25s ease-out;
      h3 { margin-top: 0; color: var(--pink-600); font-family: var(--font-display); }
    }
    @keyframes modalIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    .confirm-delete {
      max-width: 400px;
      .delete-warning { color: var(--text-medium); line-height: 1.6; strong { color: var(--text-dark); } }
    }

    .form-group {
      margin-bottom: 1rem;
      label { display: block; font-size: 0.8rem; font-weight: 700; color: var(--pink-600); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.5px; }
      input, textarea {
        width: 100%; padding: 0.8rem; border: 1.5px solid rgba(255, 157, 191, 0.2);
        border-radius: 0.85rem; font-family: var(--font-body); background: var(--bg-main);
        color: var(--text-dark); font-size: 0.95rem; box-sizing: border-box; transition: all 0.2s;
        &:focus { outline: none; border-color: var(--pink-400); background: var(--bg-card); box-shadow: 0 0 0 3px rgba(255,107,157,0.1); }
      }
    }

    .modal-actions {
      display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;
      button {
        padding: 0.7rem 1.2rem; border-radius: 0.8rem; border: none; cursor: pointer;
        font-weight: 700; font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem;
        transition: all 0.2s;
      }
      .btn-cancel { background: var(--bg-main); color: var(--text-medium); &:hover { background: var(--pink-50); } }
      .btn-confirm {
        background: linear-gradient(135deg, var(--pink-400), var(--pink-500)); color: white;
        box-shadow: 0 3px 10px rgba(255,107,157,0.25);
        &:disabled { opacity: 0.5; cursor: not-allowed; }
        &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 5px 14px rgba(255,107,157,0.35); }
      }
      .btn-danger {
        background: linear-gradient(135deg, #ff6b6b, #ee5a5a); color: white;
        box-shadow: 0 3px 10px rgba(255,107,107,0.25);
        &:disabled { opacity: 0.5; cursor: not-allowed; }
        &:hover:not(:disabled) { transform: translateY(-1px); }
      }
    }

    /* DRAWER */
    .drawer-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.3); backdrop-filter: blur(8px); z-index: 900;
      display: flex; justify-content: flex-end;
    }

    .drawer-panel {
      width: 520px; max-width: 92vw; background: var(--bg-card); height: 100%;
      box-shadow: -10px 0 30px rgba(0,0,0,0.1);
      display: flex; flex-direction: column;
      animation: slideIn 0.3s ease-out;
    }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

    .drawer-header {
      padding: 1.5rem; border-bottom: 1px solid var(--border-soft); background: var(--bg-main);
    }
    .close-drawer-btn {
      background: none; border: none; color: var(--text-muted); font-weight: 600;
      cursor: pointer; margin-bottom: 0.5rem; font-size: 0.9rem;
      &:hover { color: var(--pink-500); }
    }
    .drawer-title {
      display: flex; align-items: center; justify-content: space-between;
      h2 { margin: 0; font-family: var(--font-display); color: var(--text-dark); font-size: 1.3rem; }
      .badge { background: var(--pink-100); color: var(--pink-600); padding: 0.3rem 0.8rem; border-radius: 1rem; font-size: 0.8rem; font-weight: 700; }
    }

    .drawer-content { flex: 1; overflow-y: auto; padding: 1.5rem; }

    .supplier-summary {
      display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;
      .summary-item {
        label { display: block; font-size: 0.7rem; color: #999; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.2rem; }
        span { font-weight: 600; color: var(--text-dark); font-size: 0.95rem; }
      }
      .summary-item.full { grid-column: span 2; }
    }

    .investments-section { border-top: 2px dashed var(--pink-100); padding-top: 1.5rem; }

    .section-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;
      h3 { margin: 0; font-size: 1.1rem; color: var(--text-dark); font-family: var(--font-display); }
      .total-invested {
        text-align: right;
        span { display: block; font-size: 0.7rem; color: #999; font-weight: 600; text-transform: uppercase; }
        strong { color: var(--pink-600); font-size: 1.2rem; }
      }
    }

    .add-investment-box {
      background: var(--bg-main); padding: 1.25rem;
      border-radius: 1rem; margin-bottom: 1.5rem; border: 1.5px solid var(--border-soft);
      h4 { margin: 0 0 0.8rem; font-size: 0.95rem; color: var(--pink-600); font-family: var(--font-display); }
      .inv-form-row { display: flex; gap: 0.8rem; margin-bottom: 0.6rem; }
      .field { flex: 1; }
      label { display: block; font-size: 0.7rem; font-weight: 700; margin-bottom: 0.3rem; color: var(--pink-600); text-transform: uppercase; letter-spacing: 0.3px; }
      input {
        width: 100%; padding: 0.65rem 0.8rem; border: 1.5px solid rgba(255,157,191,0.2);
        border-radius: 0.7rem; font-family: var(--font-body); background: var(--bg-main); box-sizing: border-box;
        color: var(--text-dark);
        &:focus { outline: none; border-color: var(--pink-400); box-shadow: 0 0 0 3px rgba(255,107,157,0.08); }
      }
      .btn-add-inv {
        width: 100%; margin-top: 0.8rem; padding: 0.7rem;
        background: linear-gradient(135deg, var(--pink-400), var(--pink-500)); color: white;
        border: none; border-radius: 0.8rem; font-weight: 700; cursor: pointer; font-size: 0.9rem;
        display: flex; align-items: center; justify-content: center; gap: 0.4rem;
        box-shadow: 0 3px 10px rgba(255,107,157,0.25); transition: all 0.2s;
        &:disabled { opacity: 0.5; cursor: not-allowed; }
        &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 5px 14px rgba(255,107,157,0.35); }
      }
    }

    .loading-inv { text-align: center; color: var(--text-muted); padding: 1rem; font-size: 0.9rem; }

    .investments-list { display: flex; flex-direction: column; gap: 0.6rem; }

    .inv-card {
      display: flex; gap: 0.8rem; align-items: center; background: var(--bg-card); padding: 0.75rem 0.9rem;
      border-radius: 0.85rem; border: 1px solid var(--border-soft); transition: all 0.15s;
      &:hover { border-color: var(--pink-200); box-shadow: 0 2px 8px rgba(255,107,157,0.06); }
    }

    .inv-date {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: var(--bg-main); padding: 0.5rem 0.6rem; border-radius: 0.6rem; min-width: 52px;
      .day { font-weight: 800; font-size: 1.1rem; color: var(--text-dark); line-height: 1.2; }
      .month { font-size: 0.65rem; text-transform: uppercase; color: #999; font-weight: 700; }
    }

    .inv-details {
      flex: 1; display: flex; flex-direction: column; min-width: 0;
      .inv-amount { font-weight: 800; font-size: 1rem; color: #2e7d32; }
      .inv-note { font-size: 0.82rem; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    }

    .btn-remove-inv {
      width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border-soft);
      background: var(--bg-card); color: #ccc; font-size: 1.1rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: all 0.2s;
      &:hover { background: #ff6b6b; color: white; border-color: #ff6b6b; }
    }

    .no-inv { text-align: center; color: #ccc; font-style: italic; padding: 1.5rem; font-size: 0.9rem; }

    /* SHARED */
    .spinner {
      width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* MEDIA QUERIES */
    @media (max-width: 1024px) {
      .suppliers-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
      .page-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
      .drawer-panel { width: 60%; }
    }

    @media (max-width: 768px) {
      .suppliers-grid { grid-template-columns: 1fr; }
      .drawer-panel { width: 100%; max-width: 100vw; }
      .supplier-summary { grid-template-columns: 1fr; .summary-item.full { grid-column: span 1; } }
      .add-investment-box .inv-form-row { flex-direction: column; }
    }
  `]
})
export class SuppliersComponent implements OnInit {
  // ── Data ──
  suppliers = signal<Supplier[]>([]);
  investments = signal<Investment[]>([]);
  loading = signal(false);
  loadingInvestments = signal(false);

  // ── UI State: Supplier CRUD ──
  showSupplierModal = signal(false);
  editingSupplier = signal<Supplier | null>(null);
  selectedSupplier = signal<Supplier | null>(null);
  savingSupplier = signal(false);

  // ── UI State: Investment CRUD ──
  savingInvestment = signal(false);

  // ── Feedback ──
  feedbackMsg = signal('');
  feedbackIsError = signal(false);

  // ── Forms ──
  supplierForm = { name: '', contactName: '', phone: '', notes: '' };
  newInvestment = { amount: 0, date: this.todayStr(), notes: '' };

  // ── Computed ──
  totalInvested = computed(() =>
    this.investments().reduce((sum, inv) => sum + Number(inv.amount), 0)
  );

  constructor(
    private api: ApiService,
    private confirm: ConfirmationService
  ) { }

  ngOnInit(): void {
    this.loadSuppliers();
  }

  // ═══════════════════════════════════════════
  //  SUPPLIERS
  // ═══════════════════════════════════════════

  loadSuppliers(): void {
    this.loading.set(true);
    this.api.getSuppliers().subscribe({
      next: (data) => {
        this.suppliers.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.showFeedback('Error al cargar proveedores', true);
        console.error(err);
      }
    });
  }

  // ── Create ──
  openNewSupplierForm(): void {
    this.editingSupplier.set(null);
    this.supplierForm = { name: '', contactName: '', phone: '', notes: '' };
    this.showSupplierModal.set(true);
  }

  // ── Edit ──
  openEditSupplierForm(supplier: Supplier): void {
    this.editingSupplier.set(supplier);
    this.supplierForm = {
      name: supplier.name,
      contactName: supplier.contactName || '',
      phone: supplier.phone || '',
      notes: supplier.notes || ''
    };
    this.showSupplierModal.set(true);
  }

  closeSupplierModal(): void {
    this.showSupplierModal.set(false);
    this.editingSupplier.set(null);
  }

  saveSupplier(): void {
    if (!this.supplierForm.name?.trim()) return;

    this.savingSupplier.set(true);
    const editing = this.editingSupplier();

    if (editing) {
      // UPDATE
      this.api.updateSupplier(editing.id, this.supplierForm).subscribe({
        next: (updated) => {
          this.suppliers.update(list =>
            list.map(s => s.id === updated.id ? updated : s)
          );
          // Si el drawer está abierto para este proveedor, actualizar también
          if (this.selectedSupplier()?.id === updated.id) {
            this.selectedSupplier.set(updated);
          }
          this.savingSupplier.set(false);
          this.closeSupplierModal();
          this.showFeedback('Proveedor actualizado ✏️');
        },
        error: (err) => {
          this.savingSupplier.set(false);
          this.showFeedback(err.error?.message || 'Error al actualizar', true);
        }
      });
    } else {
      // CREATE
      this.api.addSupplier(this.supplierForm).subscribe({
        next: (created) => {
          this.suppliers.update(list => [...list, created]);
          this.savingSupplier.set(false);
          this.closeSupplierModal();
          this.showFeedback('Proveedor creado ✨');
        },
        error: (err) => {
          this.savingSupplier.set(false);
          this.showFeedback(err.error?.message || 'Error al crear', true);
        }
      });
    }
  }

  // ── Delete Supplier ──
  async confirmDeleteSupplier(supplier: Supplier) {
    const confirmed = await this.confirm.confirm({
      title: '¿Eliminar proveedor?',
      message: `Se eliminará ${supplier.name} y todas sus inversiones registradas. Esta acción no se puede deshacer.`,
      confirmText: 'Sí, eliminar',
      type: 'danger',
      icon: '🗑️'
    });

    if (confirmed) {
      this.api.deleteSupplier(supplier.id).subscribe({
        next: () => {
          this.suppliers.update(list => list.filter(s => s.id !== supplier.id));
          if (this.selectedSupplier()?.id === supplier.id) {
            this.closeDetails();
          }
          this.showFeedback('Proveedor eliminado 🗑️');
        },
        error: (err) => {
          this.showFeedback(err.error?.message || 'Error al eliminar', true);
        }
      });
    }
  }

  // ═══════════════════════════════════════════
  //  INVESTMENTS
  // ═══════════════════════════════════════════

  openSupplierDetails(supplier: Supplier): void {
    this.selectedSupplier.set(supplier);
    this.investments.set([]); // Limpiar mientras carga
    this.resetInvestmentForm();
    this.loadInvestments(supplier.id);
  }

  closeDetails(): void {
    this.selectedSupplier.set(null);
    this.investments.set([]);
  }

  loadInvestments(supplierId: number): void {
    this.loadingInvestments.set(true);
    this.api.getInvestments(supplierId).subscribe({
      next: (data) => {
        this.investments.set(data);
        this.loadingInvestments.set(false);
      },
      error: (err) => {
        this.loadingInvestments.set(false);
        console.error('Error cargando inversiones', err);
      }
    });
  }

  addInvestment(): void {
    const supplier = this.selectedSupplier();
    if (!supplier || !this.newInvestment.amount || this.newInvestment.amount <= 0) return;

    this.savingInvestment.set(true);
    this.api.addInvestment(supplier.id, this.newInvestment).subscribe({
      next: (created) => {
        this.investments.update(list => [created, ...list]);
        this.savingInvestment.set(false);
        this.resetInvestmentForm();
        this.showFeedback('Inversión registrada 💰');
      },
      error: (err) => {
        this.savingInvestment.set(false);
        this.showFeedback(err.error?.message || 'Error al registrar inversión', true);
      }
    });
  }

  // ── Delete Investment ──
  async confirmDeleteInvestment(inv: Investment) {
    const confirmed = await this.confirm.confirm({
      title: '¿Eliminar inversión?',
      message: `Se eliminará la inversión de $${inv.amount}`,
      confirmText: 'Sí, eliminar',
      type: 'danger',
      icon: '🗑️'
    });

    if (confirmed) {
      const supplier = this.selectedSupplier();
      if (!supplier) return;

      this.api.deleteInvestment(supplier.id, inv.id).subscribe({
        next: () => {
          this.investments.update(list => list.filter(i => i.id !== inv.id));
          this.showFeedback('Inversión eliminada 🗑️');
        },
        error: (err) => {
          this.showFeedback(err.error?.message || 'Error al eliminar inversión', true);
        }
      });
    }
  }

  // ═══════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════

  private resetInvestmentForm(): void {
    this.newInvestment = { amount: 0, date: this.todayStr(), notes: '' };
  }

  private todayStr(): string {
    return new Date().toISOString().split('T')[0];
  }

  private showFeedback(msg: string, isError = false): void {
    this.feedbackMsg.set(msg);
    this.feedbackIsError.set(isError);
    setTimeout(() => this.feedbackMsg.set(''), 3000);
  }
}