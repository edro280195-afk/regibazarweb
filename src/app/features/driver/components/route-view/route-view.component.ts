import { Component, OnInit, OnDestroy, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { SignalRService } from '../../../../core/services/signalr.service';
import { DeliveryRoute, RouteDelivery } from '../../../../shared/models/models';
import * as L from 'leaflet';

@Component({
  selector: 'app-route-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="driver-page">
      @if (loading()) {
        <div class="loading-screen">
          <div class="spinner-lg"></div>
          <p>Cargando ruta... 🚗</p>
        </div>
      }

      @if (route(); as r) {
        <!-- Header -->
        <div class="driver-header">
          <div class="header-left">
            <h1>🚗 Ruta #{{ r.id }}</h1>
            <span class="status-pill" [attr.data-status]="r.status">
              {{ r.status === 'Pending' ? '⏳ Lista para iniciar' : r.status === 'Active' ? '💨 En ruta' : '✅ Completada' }}
            </span>
          </div>
          <div class="delivery-counter">
            {{ getDelivered(r) }}/{{ r.deliveries.length }} 💝
          </div>
        </div>

        <!-- Map -->
        <div class="map-wrap">
          <div class="map-container" #mapContainer></div>
          <button class="btn-center-me" (click)="centerOnMe()" *ngIf="gpsActive()">📍 Centrar en mí</button>
        </div>
        
        <button class="btn-google-route" (click)="openGoogleRoute(r)">
          🗺️ Ver Ruta Completa en Google Maps
        </button>

        <button class="btn-expense" (click)="openExpenseModal()">
          ⛽ Registrar Gasto (Gas/Comida)
        </button>


        <!-- Reorder Toggle -->
        @if (r.status === 'Pending') {
          <button class="btn-reorder" (click)="isReordering.set(!isReordering())" [class.active]="isReordering()">
            {{ isReordering() ? '✅ Terminar de Ordenar' : '🔃 Ordenar Ruta (Modo Móvil)' }}
          </button>
        }

        @if (isReordering()) {
          <div class="reorder-list">
             <p class="reorder-hint">Toca las flechas grandes para subir o bajar pedidos 📲</p>
             @for (d of r.deliveries; track d.id; let i = $index) {
               @if (d.status === 'Pending') {
                 <div class="reorder-item">
                    <button class="btn-move-big up" (click)="moveDelivery(i, -1, $event)" [disabled]="i === 0">⬆️</button>
                    <div class="reorder-info">
                       <span class="ord-num">#{{ d.sortOrder }}</span>
                       <span class="ord-name">{{ d.clientName }}</span>
                       <span class="ord-addr">{{ d.address }}</span>
                    </div>
                    <button class="btn-move-big down" (click)="moveDelivery(i, 1, $event)" [disabled]="i === r.deliveries.length - 1">⬇️</button>
                 </div>
               }
             }
          </div>
        } @else {
          <!-- Action buttons -->
        <!-- Action buttons -->
        @if (r.status === 'Pending') {
          <button class="btn-action start" (click)="startRoute()">
            🚀 ¡Iniciar ruta, vamos!
          </button>
        }
        @if (r.status === 'Active' && !gpsActive()) {
          <button class="btn-action gps" (click)="startGps()">
            📍 Activar mi GPS
          </button>
        }
        @if (gpsActive()) {
          <div class="gps-badge">
            <span class="gps-dot"></span> GPS activo — compartiendo ubicación ✨
          </div>
        }

        <!-- Progress bar -->
        <div class="progress-section">
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="(getDelivered(r) / r.deliveries.length) * 100"></div>
          </div>
        </div>

        <!-- Toast -->
        @if (toastMsg()) {
          <div class="toast">{{ toastMsg() }}</div>
        }

        <!-- Deliveries list -->
        <div class="deliveries">
          @for (d of r.deliveries; track d.id) {
            <div class="delivery-card" [attr.data-status]="d.status"
                 [class.expanded]="expandedId() === d.id"
                 [class.is-current]="d.status === 'InTransit'"
                 (click)="toggleExpand(d.id)">

              <!-- Current delivery badge -->
              @if (d.status === 'InTransit') {
                <div class="current-badge">🏃 EN CAMINO</div>
              }

              <div class="delivery-main">
                <span class="delivery-num" [attr.data-status]="d.status">{{ d.sortOrder }}</span>
                <div class="delivery-info">
                  <strong>{{ d.clientName }}</strong>
                  @if (d.address) { <span class="addr">📍 {{ d.address }}</span> }
                  @if (d.latitude && d.longitude) {
                     <span class="coords-info">🌐 {{ d.latitude | number:'1.5-5' }}, {{ d.longitude | number:'1.5-5' }}</span>
                  }
                  <span class="total">\${{ d.total | number:'1.2-2' }}</span>
                </div>
                
                @if (d.status === 'Pending') {
                  <div class="reorder-btns">
                    <button class="btn-move" (click)="moveDelivery($index, -1, $event)" [disabled]="$index === 0">⬆️</button>
                    <button class="btn-move" (click)="moveDelivery($index, 1, $event)" [disabled]="$index === r.deliveries.length - 1">⬇️</button>
                  </div>
                }

                <span class="delivery-emoji">
                  {{ d.status === 'Pending' ? '⏳' : d.status === 'Delivered' ? '💝' : d.status === 'InTransit' ? '🏃' : '😿' }}
                </span>
              </div>

              @if (expandedId() === d.id && (d.status === 'Pending' || d.status === 'InTransit')) {
                <div class="delivery-actions" (click)="$event.stopPropagation()">

                  <!-- Navigation button -->
                  @if (d.latitude && d.longitude) {
                    <button class="btn-navigate" (click)="navigateTo(d)">
                      🗺️ Abrir en Google Maps
                    </button>
                  }

                  <!-- Mark in transit button (only if Pending) -->
                  @if (d.status === 'Pending' && r.status === 'Active') {
                    <button class="btn-transit" (click)="markInTransit(d.id)">
                      🏃 Voy en camino a esta entrega
                    </button>
                  }

                  <!-- Photo capture -->
                  <div class="photo-section">
                    <label class="photo-btn">
                      📸 Tomar foto de evidencia
                      <input type="file" accept="image/*" capture="environment"
                             (change)="onPhotoCapture($event, d.id)" hidden>
                    </label>
                    @if (getPhotos(d.id).length > 0) {
                      <div class="photo-previews">
                        @for (photo of getPhotos(d.id); track $index) {
                          <div class="photo-thumb">
                            <img [src]="photo.preview" alt="Evidencia">
                            <button class="remove-photo" (click)="removePhoto(d.id, $index)">×</button>
                          </div>
                        }
                      </div>
                    }
                  </div>

                  <textarea [(ngModel)]="deliveryNotes[d.id]" placeholder="Notas (opcional) 📝"
                            rows="2" class="notes-input"></textarea>

                  <div class="action-btns">
                    <button class="btn-deliver" (click)="markDelivered(d.id)">
                      💝 ¡Entregado!
                    </button>
                    <button class="btn-fail" (click)="showFailModal(d.id)">
                      😿 No se pudo
                    </button>
                  </div>
                </div>
              }

              <!-- Delivered/Failed summary -->
              @if (d.status === 'Delivered') {
                <div class="done-summary">
                  ✅ Entregado {{ d.deliveredAt ? ('a las ' + formatTime(d.deliveredAt)) : '' }}
                  @if (d.notes) { <span class="done-notes">📝 {{ d.notes }}</span> }
                </div>
              }
              @if (d.status === 'NotDelivered') {
                <div class="done-summary fail">
                  ❌ {{ d.failureReason || 'No entregado' }}
                </div>
              }
            </div>
          }
        </div>
      }

        <!-- Route completed message -->
        @if (r.status === 'Completed') {
          <div class="completed-banner">
            🎉 ¡Ruta completada! Buen trabajo 💪
          </div>
        }
      }

      <!-- Fail modal -->
      @if (failModalId()) {
        <div class="modal-overlay" (click)="failModalId.set(0)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>¿Qué pasó? 😿</h3>
            <div class="fail-reasons">
              @for (reason of failReasons; track reason) {
                <button [class.selected]="selectedReason() === reason"
                        (click)="selectedReason.set(reason)">
                  {{ reason }}
                </button>
              }
            </div>
            <input type="text" [(ngModel)]="customReason" placeholder="Otro motivo..."
                   class="custom-reason">
            <button class="btn-confirm-fail" (click)="confirmFail()">
              Confirmar ❌
            </button>
          </div>
        </div>
      }

      <!-- Expense Modal -->
      @if (showExpenseModal()) {
        <div class="modal-overlay" (click)="closeExpenseModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <h3>⛽ Registrar Gasto</h3>
            
            <div class="form-group">
              <label>Tipo de Gasto</label>
              <div class="expense-types">
                <button [class.selected]="expenseForm.type === 'Gasolina'" (click)="expenseForm.type = 'Gasolina'">Gasolina ⛽</button>
                <button [class.selected]="expenseForm.type === 'Comida'" (click)="expenseForm.type = 'Comida'">Comida 🍔</button>
                <button [class.selected]="expenseForm.type === 'Otro'" (click)="expenseForm.type = 'Otro'">Otro 🔧</button>
              </div>
            </div>

            <div class="form-group">
              <label>Monto $</label>
              <input type="number" [(ngModel)]="expenseForm.amount" placeholder="Ej. 500" class="input-lg">
            </div>

            <div class="form-group">
              <label>Nota (Opcional)</label>
              <input type="text" [(ngModel)]="expenseForm.notes" placeholder="Detalles..." class="input-text">
            </div>
            
            <div class="form-group">
               <label class="photo-btn" [class.has-file]="!!expenseForm.photo">
                  {{ expenseForm.photo ? '📸 Foto lista' : '📸 Foto del ticket (Opcional)' }}
                  <input type="file" accept="image/*" capture="environment" (change)="onExpensePhoto($event)" hidden>
               </label>
            </div>

            <div class="modal-actions">
              <button class="btn-cancel" (click)="closeExpenseModal()">Cancelar</button>
              <button class="btn-confirm" (click)="submitExpense()" [disabled]="!expenseForm.amount || expenseForm.amount <= 0 || submittingExpense()">
                 {{ submittingExpense() ? 'Guardando...' : 'Registrar Gasto' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .driver-page {
      min-height: 100vh;
      background: linear-gradient(180deg, var(--bg-main) 0%, #FFE0EB 100%);
      padding: 1rem; padding-bottom: 2rem;
      max-width: 500px; margin: 0 auto;
      position: relative; z-index: 1;
    }

    .loading-screen {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      min-height: 60vh; color: var(--text-light);
    }
    .spinner-lg {
      width: 40px; height: 40px;
      border: 3px solid rgba(255,107,157,0.2); border-top-color: var(--pink-500);
      border-radius: 50%; animation: spin 0.7s linear infinite; margin-bottom: 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .driver-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1rem;
      h1 { font-family: var(--font-display); color: var(--text-dark); font-size: 1.3rem; margin: 0; }
    }
    .header-left { display: flex; flex-direction: column; gap: 0.25rem; }
    .status-pill {
      display: inline-block; padding: 0.2rem 0.65rem; border-radius: 2rem;
      font-size: 0.75rem; font-weight: 700; width: fit-content;
      &[data-status="Pending"] { background: rgba(255,200,100,0.2); color: #D97706; }
      &[data-status="Active"] { background: rgba(96,165,250,0.2); color: #2563EB; }
      &[data-status="Completed"] { background: rgba(52,211,153,0.2); color: #059669; }
    }
    .delivery-counter { font-size: 1.4rem; font-weight: 800; color: var(--pink-500); }

    /* MAP */
    .map-wrap {
      border-radius: 1rem; overflow: hidden;
      border: 2px solid var(--border-soft);
      box-shadow: var(--shadow-md); margin-bottom: 1rem;
      position: relative;
    }
    .map-container { width: 100%; height: 280px; }
    .btn-center-me {
       position: absolute; bottom: 10px; right: 10px; z-index: 500;
       background: white; border: 1px solid var(--pink-300); border-radius: 20px;
       padding: 5px 10px; font-size: 0.8rem; font-weight: 700; color: var(--pink-600);
       box-shadow: 0 2px 5px rgba(0,0,0,0.2); cursor: pointer;
    }
    .btn-google-route {
      width: 100%; padding: 0.8rem; border: none; border-radius: 1rem;
      background: white; border: 2px solid #34A853; color: #34A853;
      font-weight: 700; font-size: 0.95rem; margin-bottom: 1.5rem;
      box-shadow: 0 4px 10px rgba(52,168,83,0.15); cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      transition: all 0.2s;
      &:hover { background: #f0fdf4; transform: translateY(-2px); }
    }
    
    .btn-expense {
      width: 100%; padding: 0.8rem; border: none; border-radius: 1rem;
      background: white; border: 2px dashed #EF4444; color: #EF4444;
      font-weight: 700; font-size: 0.95rem; margin-bottom: 1.5rem;
      box-shadow: 0 4px 10px rgba(239,68,68,0.15); cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      transition: all 0.2s;
      &:hover { background: #fee2e2; transform: translateY(-2px); }
    }
    .coords-info { font-size: 0.7rem; color: #666; font-family: monospace; display: block; margin-top: 2px; }

    /* ACTION BUTTONS */
    .btn-action {
      width: 100%; padding: 0.9rem; border: none; border-radius: 1rem;
      font-size: 1rem; font-weight: 700; cursor: pointer;
      font-family: var(--font-body); margin-bottom: 1rem;
      transition: all 0.3s var(--ease-bounce);
      &.start {
        background: linear-gradient(135deg, var(--pink-400), var(--pink-500));
        color: white; box-shadow: 0 6px 20px rgba(255,107,157,0.3);
        animation: pulse-pink 2s infinite;
      }
      &.gps {
        background: linear-gradient(135deg, #60A5FA, #3B82F6);
        color: white; box-shadow: 0 6px 20px rgba(59,130,246,0.25);
      }
      &:hover { transform: translateY(-2px); }
    }
    @keyframes pulse-pink {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255,107,157,0.4); }
      50% { box-shadow: 0 0 0 12px rgba(255,107,157,0); }
    }

    .gps-badge {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.65rem 1rem; background: rgba(52,211,153,0.1);
      border: 1px solid rgba(52,211,153,0.2); border-radius: 0.75rem;
      color: #059669; font-size: 0.85rem; font-weight: 600; margin-bottom: 1rem;
    }
    .gps-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: #34D399; box-shadow: 0 0 8px #34D399;
      animation: pulse-green 1.5s infinite;
    }
    @keyframes pulse-green {
      0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.6); }
      50% { box-shadow: 0 0 0 6px rgba(52,211,153,0); }
    }

    /* PROGRESS */
    .progress-section { margin-bottom: 1rem; }
    .progress-bar { height: 8px; border-radius: 4px; background: rgba(255,107,157,0.1); overflow: hidden; }
    .progress-fill {
      height: 100%; border-radius: 4px;
      background: linear-gradient(90deg, var(--pink-300), var(--pink-500));
      transition: width 0.5s var(--ease-smooth);
    }

    /* TOAST */
    .toast {
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      background: rgba(50,50,50,0.9); color: white; padding: 10px 20px;
      border-radius: 50px; font-weight: 600; font-size: 0.88rem; z-index: 1000;
      animation: slideDown 0.3s ease;
    }
    @keyframes slideDown { from { opacity: 0; transform: translate(-50%, -100%); } to { opacity: 1; transform: translate(-50%, 0); } }

    /* DELIVERIES LIST */
    .deliveries { display: flex; flex-direction: column; gap: 0.6rem; }

    .delivery-card {
      background: rgba(255,255,255,0.85); border: 1.5px solid var(--border-soft);
      border-radius: 1rem; overflow: hidden;
      transition: all 0.25s; cursor: pointer;
      box-shadow: var(--shadow-sm); position: relative;

      &:hover { box-shadow: var(--shadow-md); }
      &.expanded { border-color: var(--pink-300); }
      &[data-status="Delivered"] { opacity: 0.55; }
      &[data-status="NotDelivered"] { opacity: 0.55; }

      /* Current delivery highlight */
      &.is-current {
        border: 2px solid #3B82F6;
        box-shadow: 0 0 0 3px rgba(59,130,246,0.15), var(--shadow-md);
        animation: glowBlue 2s infinite;
      }
    }
    @keyframes glowBlue {
      0%, 100% { box-shadow: 0 0 0 3px rgba(59,130,246,0.15), var(--shadow-md); }
      50% { box-shadow: 0 0 0 6px rgba(59,130,246,0.08), var(--shadow-md); }
    }

    .current-badge {
      background: linear-gradient(90deg, #3B82F6, #60A5FA);
      color: white; text-align: center;
      font-size: 0.72rem; font-weight: 800; letter-spacing: 1px;
      padding: 0.25rem;
    }

    .delivery-main {
      display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem;
    }
    .delivery-num {
      width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.8rem; font-weight: 800;
      background: linear-gradient(135deg, var(--pink-100), var(--pink-200)); color: var(--pink-600);
      &[data-status="Delivered"] { background: linear-gradient(135deg, #D1FAE5, #A7F3D0); color: #059669; }
      &[data-status="NotDelivered"] { background: linear-gradient(135deg, #FFE4E6, #FECDD3); color: #E11D48; }
      &[data-status="InTransit"] { background: linear-gradient(135deg, #DBEAFE, #BFDBFE); color: #2563EB; }
    }
    .delivery-info {
      flex: 1; min-width: 0;
      strong { color: var(--text-dark); display: block; font-size: 0.95rem; }
      .addr { color: var(--text-muted); font-size: 0.78rem; display: block; }
      .total { color: var(--pink-500); font-weight: 700; font-size: 0.88rem; }
    }
    .delivery-emoji { font-size: 1.3rem; }
    
    .reorder-btns { display: flex; flex-direction: column; gap: 2px; margin-right: 5px; }
    .btn-move { 
      background: rgba(255,255,255,0.5); border: 1px solid var(--border-soft); 
      border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 0.7rem; 
      line-height: 1; transition: all 0.2s;
    }
    .btn-move:hover { background: var(--pink-100); border-color: var(--pink-300); }
    .btn-move:disabled { opacity: 0.3; cursor: default; }

    .delivery-actions {
      padding: 0.85rem; padding-top: 0.5rem;
      border-top: 1px solid var(--border-soft);
      animation: fadeIn 0.3s ease;
      display: flex; flex-direction: column; gap: 0.6rem;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* NAVIGATE BUTTON */
    .btn-navigate {
      width: 100%; padding: 0.7rem;
      background: linear-gradient(135deg, #3B82F6, #2563EB);
      color: white; border: none; border-radius: 0.75rem;
      font-size: 0.9rem; font-weight: 700; cursor: pointer;
      font-family: var(--font-body);
      box-shadow: 0 4px 12px rgba(37,99,235,0.25);
      transition: all 0.2s;
      &:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(37,99,235,0.35); }
    }

    /* IN TRANSIT BUTTON */
    .btn-transit {
      width: 100%; padding: 0.65rem;
      background: rgba(59,130,246,0.08); border: 1.5px solid rgba(59,130,246,0.3);
      color: #2563EB; border-radius: 0.75rem;
      font-size: 0.88rem; font-weight: 700; cursor: pointer;
      font-family: var(--font-body);
      transition: all 0.2s;
      &:hover { background: rgba(59,130,246,0.15); }
    }

    /* PHOTOS */
    .photo-section { }
    .photo-btn {
      display: inline-block; padding: 0.5rem 1rem;
      background: rgba(255,107,157,0.06); border: 1.5px dashed var(--pink-200);
      border-radius: 0.75rem; color: var(--pink-500);
      cursor: pointer; font-size: 0.85rem; font-weight: 600;
      transition: all 0.2s;
      &:hover { background: rgba(255,107,157,0.1); border-color: var(--pink-300); }
    }
    .photo-previews { display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }
    .photo-thumb {
      position: relative; width: 64px; height: 64px; border-radius: 0.5rem; overflow: hidden;
      border: 2px solid var(--border-soft);
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .remove-photo {
      position: absolute; top: -4px; right: -4px;
      width: 20px; height: 20px; border-radius: 50%;
      background: var(--pink-500); color: white; border: none;
      cursor: pointer; font-size: 0.75rem; line-height: 1;
    }

    .notes-input {
      width: 100%; padding: 0.6rem 0.8rem;
      background: rgba(255,240,246,0.5); border: 1.5px solid var(--border-soft);
      border-radius: 0.65rem; resize: none; color: var(--text-dark);
      font-size: 0.88rem; font-family: var(--font-body);
      box-sizing: border-box;
      &:focus { outline: none; border-color: var(--pink-400); }
    }

    .action-btns { display: flex; gap: 0.5rem; }
    .btn-deliver {
      flex: 1; padding: 0.7rem;
      background: linear-gradient(135deg, #34D399, #10B981);
      color: white; border: none; border-radius: 0.75rem;
      font-weight: 700; cursor: pointer; font-family: var(--font-body);
      box-shadow: 0 4px 12px rgba(16,185,129,0.25);
      transition: all 0.2s;
      &:hover { transform: translateY(-2px); }
    }
    .btn-fail {
      flex: 1; padding: 0.7rem;
      background: rgba(255,107,157,0.08); border: 1.5px solid var(--border-pink);
      color: var(--pink-600); border-radius: 0.75rem;
      font-weight: 700; cursor: pointer; font-family: var(--font-body);
      &:hover { background: rgba(255,107,157,0.15); }
    }

    /* DONE SUMMARY */
    .done-summary {
      padding: 0.5rem 0.85rem; font-size: 0.8rem; color: #059669;
      border-top: 1px solid var(--border-soft);
      &.fail { color: #E11D48; }
      .done-notes { display: block; color: var(--text-muted); font-size: 0.75rem; margin-top: 0.15rem; }
    }

    /* COMPLETED */
    .completed-banner {
      text-align: center; padding: 1.5rem; margin-top: 1rem;
      background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.2);
      border-radius: 1rem; color: #059669; font-weight: 700; font-size: 1.1rem;
    }

    /* MODAL */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(61,31,61,0.4);
      backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; padding: 1rem;
    }
    .modal-card {
      background: white; border-radius: 1.5rem; padding: 1.5rem;
      width: 100%; max-width: 380px;
      box-shadow: 0 20px 60px rgba(255,107,157,0.2);
      h3 { font-family: var(--font-display); color: var(--text-dark); margin: 0 0 1rem; }
    }
    .fail-reasons {
      display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.75rem;
      button {
        padding: 0.6rem 1rem; background: var(--pink-50);
        border: 1.5px solid var(--border-soft); border-radius: 0.75rem;
        color: var(--text-medium); cursor: pointer; text-align: left;
        font-size: 0.88rem; font-family: var(--font-body);
        transition: all 0.2s;
        &.selected { border-color: var(--pink-400); background: rgba(255,107,157,0.08); color: var(--pink-600); }
        &:hover { border-color: var(--pink-300); }
      }
    }
    .custom-reason {
      width: 100%; padding: 0.6rem 0.8rem;
      background: var(--pink-50); border: 1.5px solid var(--border-soft);
      border-radius: 0.65rem; color: var(--text-dark); font-size: 0.88rem;
      font-family: var(--font-body); margin-bottom: 0.75rem; box-sizing: border-box;
      &:focus { outline: none; border-color: var(--pink-400); }
    }
    .btn-confirm-fail {
      width: 100%; padding: 0.75rem;
      background: linear-gradient(135deg, var(--pink-400), var(--pink-500));
      color: white; border: none; border-radius: 0.75rem;
      cursor: pointer; font-weight: 700; font-family: var(--font-body);
    }
    
    /* REORDER MODE */
    .btn-reorder {
      width: 100%; padding: 0.8rem; border: 2px dashed var(--pink-300);
      background: var(--pink-50); color: var(--pink-600);
      border-radius: 1rem; font-weight: 700; cursor: pointer;
      margin-bottom: 1rem; transition: all 0.2s;
    }
    .btn-reorder.active { background: var(--pink-500); color: white; border-style: solid; }
    
    .reorder-list { display: flex; flex-direction: column; gap: 0.8rem; margin-bottom: 2rem; }
    .reorder-hint { text-align: center; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.5rem; font-style: italic; }
    .reorder-item {
      display: flex; align-items: center; gap: 0.5rem;
      background: white; padding: 0.5rem; border-radius: 1rem;
      border: 1px solid var(--border-soft); box-shadow: var(--shadow-sm);
    }
    .reorder-info { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; }
    .ord-num { font-weight: 800; color: var(--pink-500); font-size: 1.1rem; }
    .ord-name { font-weight: 600; color: var(--text-dark); }
    .ord-addr { font-size: 0.75rem; color: #999; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
    
    .btn-move-big {
      width: 50px; height: 50px; border-radius: 12px; border: none;
      font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: transform 0.1s;
    }
    .btn-move-big:active { transform: scale(0.9); }
    .btn-move-big.up { background: #E0F2FE; color: #0284C7; }
    .btn-move-big.down { background: #F0FDF4; color: #16A34A; }
    .btn-move-big:disabled { opacity: 0.3; background: #f3f4f6; color: #9ca3af; }

    /* EXPENSE FORM */
    .expense-types { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .expense-types button {
      flex: 1; padding: 0.6rem; border: 1.5px solid var(--border-soft);
      background: var(--bg-main); border-radius: 0.75rem; font-weight: 600;
      color: var(--text-medium); cursor: pointer; font-size: 0.85rem;
      transition: all 0.2s;
    }
    .expense-types button.selected {
      background: rgba(255,107,157,0.1); border-color: var(--pink-400); color: var(--pink-600);
    }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.8rem; font-weight: 700; color: #666; margin-bottom: 0.3rem; }
    .input-lg {
      width: 100%; padding: 0.8rem; font-size: 1.2rem; font-weight: 700;
      border: 1.5px solid var(--border-soft); border-radius: 0.8rem;
      text-align: center; color: var(--text-dark); box-sizing: border-box;
    }
    .input-text {
      width: 100%; padding: 0.7rem; font-size: 0.9rem;
      border: 1.5px solid var(--border-soft); border-radius: 0.8rem; box-sizing: border-box;
    }
    .has-file { background: #d1fae5 !important; border-color: #34d399 !important; color: #065f46 !important; }
    .modal-actions { display: flex; gap: 0.8rem; margin-top: 1.5rem; }
    .btn-cancel {
      flex: 1; padding: 0.8rem; background: #f3f4f6; color: #4b5563;
      border: none; border-radius: 0.8rem; font-weight: 700; cursor: pointer;
    }
    .btn-confirm {
      flex: 2; padding: 0.8rem; background: linear-gradient(135deg, var(--pink-400), var(--pink-500));
      color: white; border: none; border-radius: 0.8rem; font-weight: 700; cursor: pointer;
      &:disabled { opacity: 0.5; }
    }
  `]
})
export class RouteViewComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer') mapEl?: ElementRef;

  route = signal<DeliveryRoute | null>(null);
  loading = signal(true);
  gpsActive = signal(false);
  expandedId = signal(0);
  failModalId = signal(0);
  selectedReason = signal('');
  toastMsg = signal('');

  // Expenses
  showExpenseModal = signal(false);
  submittingExpense = signal(false);
  expenseForm = { type: 'Gasolina', amount: null as number | null, notes: '', photo: null as File | null };

  isReordering = signal(false);
  customReason = '';
  deliveryNotes: { [key: number]: string } = {};
  photos: { [key: number]: { file: File; preview: string }[] } = {};

  failReasons = [
    'No estaba en casa 🏠',
    'Dirección incorrecta 📍',
    'No contestó el teléfono 📱',
    'Rechazó el pedido ❌',
    'Zona inaccesible 🚧'
  ];

  private token = '';
  private map?: L.Map;
  private driverMarker?: L.Marker;
  private markersLayer?: L.LayerGroup;
  private routeLine?: L.Polyline;
  private watchId?: number;
  private updateInterval?: any;
  private lastLat = 0;
  private lastLng = 0;

  constructor(
    private routeParam: ActivatedRoute,
    private api: ApiService,
    private signalr: SignalRService
  ) { }

  ngOnInit(): void {
    this.token = this.routeParam.snapshot.paramMap.get('token') || '';
    this.loadRoute();
  }

  ngOnDestroy(): void {
    if (this.watchId !== undefined) navigator.geolocation.clearWatch(this.watchId);
    if (this.updateInterval) clearInterval(this.updateInterval);
    this.signalr.disconnect();
    this.map?.remove();
  }

  private loadRoute(): void {
    this.api.getDriverRoute(this.token).subscribe({
      next: (r: DeliveryRoute) => {
        r.deliveries.sort((a: RouteDelivery, b: RouteDelivery) => a.sortOrder - b.sortOrder);
        this.route.set(r);
        this.loading.set(false);
        setTimeout(() => {
          this.initMap(r);
          this.autoExpandNext(r);
          this.resolveAddresses(r); // Try to resolve missing coords
        }, 150);
      },
      error: () => this.loading.set(false)
    });
  }

  /** Auto-expand the current InTransit delivery, or the next Pending one */
  private autoExpandNext(route: DeliveryRoute): void {
    const inTransit = route.deliveries.find(d => d.status === 'InTransit');
    if (inTransit) {
      this.expandedId.set(inTransit.id);
      return;
    }
    const nextPending = route.deliveries.find(d => d.status === 'Pending');
    if (nextPending) {
      this.expandedId.set(nextPending.id);
    }
  }

  async resolveAddresses(route: DeliveryRoute) {
    const missing = route.deliveries.filter(d => (!d.latitude || !d.longitude) && d.address && d.status === 'Pending');
    if (missing.length === 0) return;

    this.showToast('📍 Buscando direcciones en el mapa...');

    for (const d of missing) {
      try {
        const addr = d.address || '';
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
          d.latitude = parseFloat(data[0].lat);
          d.longitude = parseFloat(data[0].lon);
        }
      } catch (e) {
        console.error('Geocoding error', e);
      }
      // Delay to respect rate limits
      await new Promise(r => setTimeout(r, 1100));
    }
    this.plotRoute(route);
    this.showToast('✅ Mapa actualizado con direcciones');
  }

  // ═══ EXPENSES ═══
  openExpenseModal() {
    this.expenseForm = { type: 'Gasolina', amount: null, notes: '', photo: null };
    this.showExpenseModal.set(true);
  }

  closeExpenseModal() {
    this.showExpenseModal.set(false);
  }

  onExpensePhoto(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.expenseForm.photo = file;
    }
  }

  submitExpense() {
    if (!this.expenseForm.amount || this.expenseForm.amount <= 0) return;

    this.submittingExpense.set(true);
    const data = {
      amount: this.expenseForm.amount,
      expenseType: this.expenseForm.type,
      notes: this.expenseForm.notes,
      photo: this.expenseForm.photo
    };

    this.api.addDriverExpense(this.token, data).subscribe({
      next: () => {
        this.submittingExpense.set(false);
        this.closeExpenseModal();
        this.showToast('⛽ Gasto registrado exitosamente');
      },
      error: (err) => {
        this.submittingExpense.set(false);
        console.error(err);
        this.showToast('❌ Error al registrar gasto');
      }
    });
  }

  // ═══ MAP ═══

  private initMap(route: DeliveryRoute): void {
    if (!this.mapEl) return;

    if (this.map) {
      this.map.remove();
    }

    this.map = L.map(this.mapEl.nativeElement).setView([25.75, -100.3], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OSM'
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);
    this.plotRoute(route);

    // Try to locate user immediately to fix "always same place"
    this.map.locate({ setView: true, maxZoom: 16 });
    this.map.on('locationfound', (e) => {
      // Location found, update driver marker if not started
      if (!this.gpsActive()) {
        this.lastLat = e.latlng.lat;
        this.lastLng = e.latlng.lng;
        this.updateDriverMarker(e.latlng.lat, e.latlng.lng);
      }
    });
  }

  private plotRoute(route: DeliveryRoute): void {
    if (!this.map || !this.markersLayer) return;
    this.markersLayer.clearLayers();
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
    }

    const points: L.LatLngExpression[] = [];
    const bounds: L.LatLngExpression[] = [];

    route.deliveries.forEach(d => {
      if (!d.latitude || !d.longitude) return;
      const pos: L.LatLngExpression = [d.latitude, d.longitude];
      bounds.push(pos);

      // Only include non-completed in route line
      if (d.status !== 'Delivered' && d.status !== 'NotDelivered') {
        points.push(pos);
      }

      // Colored numbered marker
      let bgColor = '#FF9DBF'; // Pending - pink soft
      let textColor = '#fff';
      if (d.status === 'InTransit') { bgColor = '#3B82F6'; } // Blue
      else if (d.status === 'Delivered') { bgColor = '#34D399'; } // Green
      else if (d.status === 'NotDelivered') { bgColor = '#F87171'; } // Red

      const icon = L.divIcon({
        html: `<div style="
          background:${bgColor}; color:${textColor};
          width:28px; height:28px; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          font-weight:800; font-size:12px;
          border:2.5px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.2);
          ${d.status === 'InTransit' ? 'animation:pulse 1.5s infinite;' : ''}
        ">${d.sortOrder}</div>
        ${d.status === 'InTransit' ? '<style>@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0.4)}50%{box-shadow:0 0 0 8px rgba(59,130,246,0)}}</style>' : ''}`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        className: ''
      });

      const marker = L.marker(pos, { icon }).addTo(this.markersLayer!);
      marker.bindPopup(`
        <b>${d.clientName}</b><br>
        ${d.address || 'Sin dirección'}<br>
        <b>$${d.total.toFixed(2)}</b>
      `);
    });

    // Draw route polyline through pending/inTransit points
    if (points.length >= 2) {
      this.routeLine = L.polyline(points, {
        color: '#FF6B9D',
        weight: 3,
        opacity: 0.6,
        dashArray: '8, 8'
      }).addTo(this.map);
    }

    // Fit bounds
    if (bounds.length > 0) {
      this.map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50] });
    }
  }

  centerOnMe() {
    this.map?.locate({ setView: true, maxZoom: 16 });
  }

  openGoogleRoute(route: DeliveryRoute) {
    const deliveries = route.deliveries.filter(d => ((d.latitude && d.longitude) || d.address) && d.status !== 'Delivered' && d.status !== 'NotDelivered');
    if (deliveries.length === 0) return;

    // Sort by sortOrder
    deliveries.sort((a, b) => a.sortOrder - b.sortOrder);

    const dest = deliveries[deliveries.length - 1];
    const waypoints = deliveries.slice(0, deliveries.length - 1);

    const getLoc = (d: RouteDelivery) => {
      if (d.latitude && d.longitude) return `${d.latitude},${d.longitude}`;
      return encodeURIComponent(d.address || '');
    };

    let url = `https://www.google.com/maps/dir/?api=1&destination=${getLoc(dest)}&travelmode=driving`;

    if (this.lastLat && this.lastLng) {
      url += `&origin=${this.lastLat},${this.lastLng}`;
    }

    if (waypoints.length > 0) {
      const wpStr = waypoints.map(w => getLoc(w)).join('|');
      url += `&waypoints=${wpStr}`;
    }

    window.open(url, '_blank');
  }

  // ═══ ROUTE ACTIONS ═══

  startRoute(): void {
    this.api.startRoute(this.token).subscribe({
      next: () => {
        this.showToast('¡Ruta iniciada! 🚀');
        this.loadRoute();
      }
    });
  }

  startGps(): void {
    if (!navigator.geolocation) {
      this.showToast('Tu navegador no soporta GPS 😿');
      return;
    }
    this.gpsActive.set(true);
    this.gpsActive.set(true);

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.lastLat = pos.coords.latitude;
        this.lastLng = pos.coords.longitude;
        this.updateDriverMarker(this.lastLat, this.lastLng);
      },
      (err) => {
        console.error('GPS error:', err);
        this.showToast('Error de GPS, verifica permisos 📍');
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    // Send location to server every 10 seconds
    this.updateInterval = setInterval(() => {
      if (this.lastLat && this.lastLng) {
        this.api.updateLocation(this.token, this.lastLat, this.lastLng).subscribe();
      }
    }, 10000);
  }

  private updateDriverMarker(lat: number, lng: number): void {
    if (!this.map) return;
    const icon = L.divIcon({
      html: `<div style="
        background:#FF3D7F; width:16px; height:16px; border-radius:50%;
        border:3px solid white; box-shadow:0 0 12px rgba(255,61,127,0.6);
      "></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      className: ''
    });
    if (!this.driverMarker) {
      this.driverMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(this.map);
    } else {
      this.driverMarker.setLatLng([lat, lng]);
    }
  }

  // ═══ DELIVERY ACTIONS ═══

  markInTransit(deliveryId: number): void {
    this.api.markInTransit(this.token, deliveryId).subscribe({
      next: () => {
        this.showToast('¡En camino! 🏃');
        this.loadRoute();
      }
    });
  }

  navigateTo(d: RouteDelivery): void {
    if (!d.latitude || !d.longitude) return;
    // Try Google Maps first, falls back to generic geo: URI
    const url = `https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}&travelmode=driving`;
    window.open(url, '_blank');
  }

  toggleExpand(id: number): void {
    this.expandedId.set(this.expandedId() === id ? 0 : id);
  }

  moveDelivery(index: number, direction: number, event: Event): void {
    event.stopPropagation();
    const r = this.route();
    if (!r) return;

    const deliveries = [...r.deliveries];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= deliveries.length) return;

    // Swap sortOrders (to keep consistency for Google Maps which sorts by this)
    const tempOrder = deliveries[index].sortOrder;
    deliveries[index].sortOrder = deliveries[newIndex].sortOrder;
    deliveries[newIndex].sortOrder = tempOrder;

    // Swap in array
    [deliveries[index], deliveries[newIndex]] = [deliveries[newIndex], deliveries[index]];

    this.route.set({ ...r, deliveries });
  }

  onPhotoCapture(e: Event, deliveryId: number): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!this.photos[deliveryId]) this.photos[deliveryId] = [];
    const reader = new FileReader();
    reader.onload = () => {
      this.photos[deliveryId].push({ file, preview: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

  getPhotos(id: number): { file: File; preview: string }[] { return this.photos[id] || []; }
  removePhoto(id: number, idx: number): void { this.photos[id]?.splice(idx, 1); }

  markDelivered(deliveryId: number): void {
    const notes = this.deliveryNotes[deliveryId] || '';
    const photos = this.getPhotos(deliveryId).map(p => p.file);
    this.api.markDelivered(this.token, deliveryId, notes, photos).subscribe({
      next: (res: any) => {
        delete this.photos[deliveryId];
        this.showToast('¡Entrega registrada! 💝');
        this.loadRoute(); // Reload will auto-expand next
      }
    });
  }

  showFailModal(id: number): void {
    this.failModalId.set(id);
    this.selectedReason.set('');
    this.customReason = '';
  }

  confirmFail(): void {
    const id = this.failModalId();
    const reason = this.customReason || this.selectedReason();
    if (!reason) return;

    const notes = this.deliveryNotes[id] || '';
    const photos = this.getPhotos(id).map(p => p.file);

    this.api.markFailed(this.token, id, reason, notes, photos).subscribe({
      next: () => {
        delete this.photos[id];
        this.failModalId.set(0);
        this.showToast('No-entrega registrada 😿');
        this.loadRoute();
      }
    });
  }

  // ═══ HELPERS ═══

  getDelivered(r: DeliveryRoute): number {
    return r.deliveries.filter(d => d.status === 'Delivered').length;
  }

  formatTime(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  private showToast(msg: string): void {
    this.toastMsg.set(msg);
    setTimeout(() => this.toastMsg.set(''), 3000);
  }
}
