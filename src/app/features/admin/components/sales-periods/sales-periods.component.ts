import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { SalesPeriod } from '../../../../shared/models/models';

@Component({
  selector: 'app-sales-periods',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sp-page">
      <header class="page-header">
        <div>
          <h2>✂️ Cortes de Venta</h2>
          <p class="page-sub">Gestiona los periodos para reportes exactos 📊</p>
        </div>
        <button class="btn-primary" (click)="openCreateModal()">+ Nuevo Corte</button>
      </header>

      @if (feedbackMsg()) {
        <div class="feedback-toast" [class.error]="feedbackIsError()">{{ feedbackMsg() }}</div>
      }

      @if (loading()) {
        <div class="loading-state"><span class="spinner-lg"></span><p>Cargando cortes...</p></div>
      }

      <div class="periods-list">
        @for (period of periods(); track period.id) {
          <div class="period-card" [class.active]="period.isActive">
            <div class="period-info">
              <div class="period-head">
                <h3>{{ period.name }}</h3>
                @if (period.isActive) {
                  <span class="badge-active">🟢 ACTIVO</span>
                }
              </div>
              <p class="period-dates">
                {{ period.startDate | date:'dd MMM yyyy' }} → {{ period.endDate | date:'dd MMM yyyy' }}
              </p>
            </div>
      <div class="period-actions">
               @if (!period.isActive) {
                 <button class="btn-activate" (click)="activate(period)" [disabled]="activating()">
                   @if (activating()) { <span class="spinner"></span> } Activar
                 </button>
               } @else {
                 <span class="active-tag">🟢 Actual</span>
               }
               <button class="btn-sync" (click)="sync(period)">
                 🔄 Sincronizar
               </button>
             </div>
           </div>
         } @empty {
           @if (!loading()) {
             <div class="empty-state">
               <span class="empty-icon">📅</span>
               <p>No hay cortes registrados.</p>
               <button class="btn-link" (click)="openCreateModal()">Crear el primero ✨</button>
             </div>
           }
         }
       </div>
 
       <!-- ═══ MODAL: CREAR CORTE ═══ -->
       @if (showModal()) {
         <div class="modal-overlay" (click)="closeModal()">
           <div class="modal-card" (click)="$event.stopPropagation()">
             <h3>✂️ Nuevo Corte de Venta</h3>
             <div class="form-group">
               <label>Nombre del Corte</label>
               <input type="text" [(ngModel)]="form.name" placeholder="Ej. 1ra Quincena Marzo 2026">
             </div>
             <div class="form-row">
               <div class="form-group">
                 <label>Fecha Inicio</label>
                 <input type="date" [(ngModel)]="form.startDate">
               </div>
               <div class="form-group">
                 <label>Fecha Fin</label>
                 <input type="date" [(ngModel)]="form.endDate">
               </div>
             </div>
             <div class="modal-actions">
               <button class="btn-cancel" (click)="closeModal()">Cancelar</button>
               <button class="btn-confirm" (click)="createPeriod()"
                       [disabled]="!form.name.trim() || !form.startDate || !form.endDate || saving()">
                 @if (saving()) { <span class="spinner"></span> } Guardar
               </button>
             </div>
           </div>
         </div>
       }
 
       <!-- ═══ MODAL: SINCRONIZAR (FLEXIBLE) ═══ -->
       @if (showSyncModal()) {
         <div class="modal-overlay" (click)="closeSyncModal()">
           <div class="modal-card sync-modal" (click)="$event.stopPropagation()">
             <div class="modal-header-sync">
               <h3>🔄 Sincronización Flexible</h3>
               <p>Relaciona datos que se traslapan en el tiempo.</p>
             </div>
 
             <div class="sync-section">
               <h4>📅 Fase de Inversión (Compras)</h4>
               <div class="form-row">
                 <div class="form-group">
                   <label>Inicio</label>
                   <input type="date" [(ngModel)]="syncForm.invStartDate">
                 </div>
                 <div class="form-group">
                   <label>Fin</label>
                   <input type="date" [(ngModel)]="syncForm.invEndDate">
                 </div>
               </div>
             </div>
 
             <div class="sync-section">
               <h4>🛍️ Fase de Venta (Pedidos)</h4>
               <div class="form-row">
                 <div class="form-group">
                   <label>Inicio</label>
                   <input type="date" [(ngModel)]="syncForm.orderStartDate">
                 </div>
                 <div class="form-group">
                   <label>Fin</label>
                   <input type="date" [(ngModel)]="syncForm.orderEndDate">
                 </div>
               </div>
             </div>
 
             <div class="modal-actions">
               <button class="btn-cancel" (click)="closeSyncModal()">Cancelar</button>
               <button class="btn-sync-confirm" (click)="executeSync()"
                       [disabled]="syncing()">
                 @if (syncing()) { <span class="spinner"></span> } Vincular Datos Ahora 🚀
               </button>
             </div>
           </div>
         </div>
       }
    </div>
  `,
  styles: [`
    .sp-page { max-width: 900px; }

    .page-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;
      h2 { font-family: var(--font-display); color: var(--text-dark); margin: 0; }
      .page-sub { font-family: var(--font-script); color: var(--rose-gold); margin: 0; font-size: 1.1rem; }
    }
    .btn-primary {
      padding: 0.8rem 1.5rem; background: linear-gradient(135deg, var(--pink-400), var(--pink-500));
      color: white; border: none; border-radius: 2rem; font-weight: 700; cursor: pointer;
      transition: all 0.3s var(--ease-bounce);
      &:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(255,107,157,0.4); }
    }

    .loading-state { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 3rem; color: var(--text-muted); }
    .spinner-lg { width: 32px; height: 32px; border: 3px solid var(--pink-100); border-top-color: var(--pink-400); border-radius: 50%; animation: spin 0.7s linear infinite; }

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

    .periods-list { display: flex; flex-direction: column; gap: 1rem; }

    .period-card {
      display: flex; justify-content: space-between; align-items: center;
      background: var(--bg-card); border-radius: 1.25rem; padding: 1.25rem 1.5rem;
      border: 1.5px solid var(--border-soft); box-shadow: var(--shadow-sm); transition: all 0.2s;
      &.active { border-color: #4caf50; background: linear-gradient(135deg, rgba(76,175,80,0.05), var(--bg-card)); }
      &:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
    }
    .period-head { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.3rem;
      h3 { margin: 0; font-family: var(--font-display); color: var(--text-dark); font-size: 1.05rem; }
    }
    .badge-active { background: #e8f5e9; color: #2e7d32; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 700; }
    .period-dates { margin: 0; font-size: 0.85rem; color: var(--text-muted); }

    .btn-activate {
      padding: 0.6rem 1.2rem; background: linear-gradient(135deg, #4caf50, #388e3c); color: white;
      border: none; border-radius: 1rem; font-weight: 700; font-size: 0.85rem; cursor: pointer;
      display: flex; align-items: center; gap: 0.4rem; transition: all 0.2s;
      &:disabled { opacity: 0.5; cursor: not-allowed; }
      &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(76,175,80,0.35); }
    }

    .empty-state { text-align: center; padding: 4rem 2rem;
      .empty-icon { font-size: 3rem; display: block; margin-bottom: 0.5rem; opacity: 0.4; }
      p { color: var(--text-muted); }
    }
    .btn-link { background: none; border: none; color: var(--pink-500); font-weight: 700; cursor: pointer; font-size: 1rem; &:hover { text-decoration: underline; } }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-card {
      background: var(--bg-card); width: 90%; max-width: 500px; padding: 2rem;
      border-radius: 1.5rem; box-shadow: 0 10px 40px rgba(0,0,0,0.2); animation: modalIn 0.25s ease-out;
      h3 { margin-top: 0; color: var(--pink-600); font-family: var(--font-display); }
    }
    @keyframes modalIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    .form-row { display: flex; gap: 1rem; }
    .form-group { flex: 1; margin-bottom: 1rem;
      label { display: block; font-size: 0.8rem; font-weight: 700; color: var(--pink-600); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.5px; }
      input { width: 100%; padding: 0.8rem; border: 1.5px solid rgba(255,157,191,0.2); border-radius: 0.85rem; font-family: var(--font-body); background: var(--bg-main); color: var(--text-dark); font-size: 0.95rem; box-sizing: border-box; transition: all 0.2s;
        &:focus { outline: none; border-color: var(--pink-400); box-shadow: 0 0 0 3px rgba(255,107,157,0.1); }
      }
    }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;
      button { padding: 0.7rem 1.2rem; border-radius: 0.8rem; border: none; cursor: pointer; font-weight: 700; font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem; transition: all 0.2s; }
      .btn-cancel { background: var(--bg-main); color: var(--text-medium); &:hover { background: var(--pink-50); } }
      .btn-confirm { background: linear-gradient(135deg, var(--pink-400), var(--pink-500)); color: white;
        &:disabled { opacity: 0.5; cursor: not-allowed; }
        &:hover:not(:disabled) { transform: translateY(-1px); }
      }
    }
    .btn-sync {
      padding: 0.6rem 1.2rem; background: linear-gradient(135deg, #a855f7, #9333ea); color: white;
      border: none; border-radius: 1rem; font-weight: 700; font-size: 0.85rem; cursor: pointer;
      display: flex; align-items: center; gap: 0.4rem; transition: all 0.2s;
      margin-left: 0.5rem;
      &:disabled { opacity: 0.5; cursor: not-allowed; }
      &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(147,51,234,0.35); }
    }

    .sync-modal { max-width: 550px; }
    .modal-header-sync { margin-bottom: 1.5rem; h3 { margin: 0; color: var(--pink-600); } p { margin: 0; font-size: 0.85rem; color: var(--text-muted); } }
    .sync-section { background: var(--bg-main); padding: 1rem; border-radius: 1rem; margin-bottom: 1rem; border: 1px solid var(--border-soft);
      h4 { margin: 0 0 0.75rem; font-size: 0.9rem; color: var(--rose-gold); text-transform: uppercase; letter-spacing: 1px; }
    }
    .btn-sync-confirm {
      padding: 0.8rem 1.5rem; background: linear-gradient(135deg, #9333ea, #7e22ce); color: white;
      border: none; border-radius: 1rem; font-weight: 700; cursor: pointer; transition: all 0.2s;
      &:disabled { opacity: 0.5; }
      &:hover:not(:disabled) { transform: scale(1.02); }
    }

    .spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class SalesPeriodsComponent implements OnInit {
  periods = signal<SalesPeriod[]>([]);
  loading = signal(false);
  saving = signal(false);
  activating = signal(false);
  syncing = signal(false);
  showModal = signal(false);
  showSyncModal = signal(false);
  feedbackMsg = signal('');
  feedbackIsError = signal(false);

  form = { name: '', startDate: '', endDate: '' };
  syncForm = { periodId: 0, invStartDate: '', invEndDate: '', orderStartDate: '', orderEndDate: '' };

  constructor(private api: ApiService) { }

  ngOnInit(): void {
    this.loadPeriods();
  }

  loadPeriods(): void {
    this.loading.set(true);
    this.api.getSalesPeriods().subscribe({
      next: (data) => { this.periods.set(data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.showFeedback('Error al cargar cortes 😿', true); }
    });
  }

  openCreateModal(): void {
    this.form = { name: '', startDate: '', endDate: '' };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  createPeriod(): void {
    if (!this.form.name.trim() || !this.form.startDate || !this.form.endDate) return;
    this.saving.set(true);
    this.api.createSalesPeriod(this.form).subscribe({
      next: (created) => {
        this.periods.update(list => [created, ...list]);
        this.saving.set(false);
        this.closeModal();
        this.showFeedback('Corte creado ✂️ ✅');
      },
      error: () => { this.saving.set(false); this.showFeedback('Error al crear corte 😿', true); }
    });
  }

  activate(period: SalesPeriod): void {
    if (period.isActive) return;
    this.activating.set(true);
    this.api.activateSalesPeriod(period.id).subscribe({
      next: () => {
        this.periods.update(list => list.map(p => ({ ...p, isActive: p.id === period.id })));
        this.activating.set(false);
        this.showFeedback(`✅ "${period.name}" activado como corte actual`);
      },
      error: () => { this.activating.set(false); this.showFeedback('Error al activar corte 😿', true); }
    });
  }

  sync(period: SalesPeriod): void {
    this.syncForm = {
      periodId: period.id,
      invStartDate: this.formatDateForInput(period.startDate),
      invEndDate: this.formatDateForInput(period.endDate),
      orderStartDate: this.formatDateForInput(period.startDate),
      orderEndDate: this.formatDateForInput(period.endDate)
    };
    this.showSyncModal.set(true);
  }

  closeSyncModal(): void {
    this.showSyncModal.set(false);
  }

  executeSync(): void {
    this.syncing.set(true);
    const body = {
      invStartDate: this.syncForm.invStartDate,
      invEndDate: this.syncForm.invEndDate,
      orderStartDate: this.syncForm.orderStartDate,
      orderEndDate: this.syncForm.orderEndDate
    };

    this.api.syncSalesPeriod(this.syncForm.periodId, body).subscribe({
      next: (res: any) => {
        this.syncing.set(false);
        this.closeSyncModal();
        alert(`✨ ¡Listo! Se vincularon ${res.Count || res.count || 0} registros históricos a este corte.`);
      },
      error: () => {
        this.syncing.set(false);
        alert('❌ Error al sincronizar. Revisa las fechas.');
      }
    });
  }

  private formatDateForInput(dateInput: any): string {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    return d.toISOString().split('T')[0];
  }

  private showFeedback(msg: string, isError = false): void {
    this.feedbackMsg.set(msg);
    this.feedbackIsError.set(isError);
    setTimeout(() => this.feedbackMsg.set(''), 3000);
  }
}
