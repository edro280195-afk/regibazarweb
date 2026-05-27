import { Component, OnInit, DestroyRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LiveCaptureService } from '../../../core/services/live-capture.service';
import { ToastService } from '../../../core/services/toast.service';
import { LiveSessionDto, LiveSessionStatus } from '../../../core/models';

const IN_PROGRESS_STATUSES: LiveSessionStatus[] = ['Queued', 'Downloading', 'Transcribing', 'Parsing', 'Scanning'];

@Component({
  selector: 'app-live-import',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="p-4 lg:p-8 min-h-[80vh]">
      <div class="max-w-3xl mx-auto">

        <!-- Header -->
        <header class="mb-6">
          <h1 class="text-3xl font-bold text-pink-900">📹 Importar Live</h1>
          <p class="text-pink-700 mt-1">
            Pega la URL de un Facebook Live para capturar los pedidos automáticamente.
          </p>
        </header>

        <!-- Import Form Card -->
        <div class="card-coquette p-6 mb-8">
          <div class="form-group mb-4">
            <label class="field-label">URL del Facebook Live</label>
            <div class="input-wrapper">
              <span class="input-icon">📋</span>
              <input
                type="url"
                class="field-input"
                placeholder="https://www.facebook.com/..."
                [(ngModel)]="facebookUrl"
                [disabled]="importing()"
              />
            </div>
          </div>

          <div class="form-group mb-5">
            <label class="field-label">Título (opcional)</label>
            <input
              type="text"
              class="field-input"
              placeholder="Ej. Live del viernes 23 mayo"
              [(ngModel)]="title"
              [disabled]="importing()"
            />
          </div>

          <button
            class="btn-coquette btn-pink w-full"
            [disabled]="importing() || !facebookUrl.trim()"
            (click)="importLive()">
            @if (importing()) {
              <span class="spinner inline-block mr-2"></span> Enviando…
            } @else {
              📹 Importar Live
            }
          </button>
        </div>

        <!-- Sessions List -->
        <section>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-bold text-pink-900">Lives anteriores</h2>
            @if (hasInProgress()) {
              <span class="refresh-badge">
                <span class="dot-pulse"></span> Actualizando…
              </span>
            }
          </div>

          @if (loadingSessions()) {
            <div class="card-coquette p-6 text-center text-pink-700">
              <span class="spinner inline-block mr-2"></span> Cargando lives…
            </div>
          }

          @if (!loadingSessions() && sessions().length === 0) {
            <div class="card-coquette p-8 text-center">
              <div class="text-5xl mb-3">📭</div>
              <p class="text-pink-700">No hay lives importados aún.</p>
            </div>
          }

          @if (!loadingSessions() && sessions().length > 0) {
            <div class="space-y-3">
              @for (session of sessions(); track session.id) {
                <div class="session-card card-coquette p-4">
                  <div class="flex items-start gap-3">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap mb-1">
                        <span class="session-title">
                          {{ session.title || 'Live sin título' }}
                        </span>
                        <span class="status-badge" [class]="statusBadgeClass(session.status)">
                          {{ statusLabel(session.status) }}
                        </span>
                      </div>
                      <div class="text-xs text-pink-600 mt-1">
                        {{ session.facebookUrl | slice:0:60 }}{{ session.facebookUrl.length > 60 ? '…' : '' }}
                      </div>
                      <div class="flex items-center gap-3 mt-2 text-xs text-pink-700">
                        <span>🗓 {{ session.importedAt | date:'dd/MM/yy HH:mm' }}</span>
                        @if (session.productCount > 0) {
                          <span>🛍 {{ session.productCount }} productos</span>
                        }
                        @if (session.pendingCount > 0) {
                          <span class="font-semibold text-amber-600">⏳ {{ session.pendingCount }} pendientes</span>
                        }
                        @if (session.status === 'Ready' && session.pendingCount === 0) {
                          <span class="text-green-600 font-semibold">✅ Revisado</span>
                        }
                      </div>
                      @if (session.statusDetail) {
                        <div class="text-xs text-pink-500 mt-1 italic">{{ session.statusDetail }}</div>
                      }
                    </div>
                    @if (session.status === 'Ready') {
                      <a [routerLink]="['/admin/live', session.id, 'review']"
                         class="btn-coquette btn-pink text-xs shrink-0">
                        Revisar →
                      </a>
                    }
                  </div>

                  @if (isInProgress(session.status)) {
                    <div class="progress-bar mt-3">
                      <div class="progress-fill" [style.width]="progressPercent(session.status) + '%'"></div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </section>
      </div>
    </div>
  `,
  styles: [`
    .card-coquette {
      background: rgba(255, 255, 255, 0.75);
      border: 1px solid rgba(255, 192, 215, 0.5);
      border-radius: 1.25rem;
      box-shadow: 0 4px 20px rgba(255, 182, 200, 0.15);
      backdrop-filter: blur(8px);
    }

    .field-label {
      display: block;
      font-size: 0.8rem;
      font-weight: 700;
      color: #9d3a72;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.4rem;
    }

    .input-wrapper {
      position: relative;
    }

    .input-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 1rem;
      pointer-events: none;
    }

    .input-wrapper .field-input {
      padding-left: 2.5rem;
    }

    .field-input {
      width: 100%;
      padding: 0.6rem 0.875rem;
      border-radius: 0.75rem;
      border: 1.5px solid rgba(255, 192, 215, 0.6);
      background: rgba(255, 255, 255, 0.8);
      color: #5a2d4f;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      box-sizing: border-box;
    }

    .field-input:focus {
      border-color: #c777b8;
      box-shadow: 0 0 0 3px rgba(199, 119, 184, 0.15);
    }

    .field-input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-coquette {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.6rem 1.25rem;
      border-radius: 999px;
      font-size: 0.875rem;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
      text-decoration: none;
    }

    .btn-pink {
      background: linear-gradient(135deg, #c777b8, #9d5990);
      color: white;
      box-shadow: 0 4px 14px rgba(199, 119, 184, 0.35);
    }

    .btn-pink:hover:not(:disabled) {
      filter: brightness(1.08);
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(199, 119, 184, 0.45);
    }

    .btn-pink:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .w-full { width: 100%; }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      display: inline-block;
      vertical-align: middle;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .session-card {
      transition: box-shadow 0.2s ease;
    }

    .session-card:hover {
      box-shadow: 0 6px 24px rgba(255, 182, 200, 0.25);
    }

    .session-title {
      font-weight: 700;
      color: #5a2d4f;
      font-size: 0.95rem;
    }

    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .badge-progress {
      background: rgba(251, 191, 36, 0.15);
      color: #92400e;
    }

    .badge-ready {
      background: rgba(52, 211, 153, 0.15);
      color: #065f46;
    }

    .badge-failed {
      background: rgba(239, 68, 68, 0.15);
      color: #991b1b;
    }

    .progress-bar {
      height: 4px;
      border-radius: 999px;
      background: rgba(255, 192, 215, 0.3);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #c777b8, #f9a8d4);
      transition: width 0.6s ease;
      animation: shimmer 1.5s ease-in-out infinite;
    }

    @keyframes shimmer {
      0% { opacity: 0.7; }
      50% { opacity: 1; }
      100% { opacity: 0.7; }
    }

    .refresh-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.72rem;
      color: #7a3d6a;
      font-weight: 600;
    }

    .dot-pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #c777b8;
      animation: pulse-dot 1.2s ease-in-out infinite;
      display: inline-block;
    }

    @keyframes pulse-dot {
      0%, 100% { transform: scale(0.8); opacity: 0.5; }
      50% { transform: scale(1.2); opacity: 1; }
    }
  `]
})
export class LiveImportComponent implements OnInit {
  private liveService = inject(LiveCaptureService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  facebookUrl = '';
  title = '';

  importing = signal(false);
  loadingSessions = signal(true);
  sessions = signal<LiveSessionDto[]>([]);

  hasInProgress = computed(() =>
    this.sessions().some(s => IN_PROGRESS_STATUSES.includes(s.status))
  );

  ngOnInit() {
    this.loadSessions();

    // Auto-refresh every 5s while any session is in-progress
    interval(5000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.hasInProgress()) {
          this.loadSessions(false);
        }
      });
  }

  loadSessions(showLoading = true) {
    if (showLoading) this.loadingSessions.set(true);
    this.liveService.getAll().subscribe({
      next: (data) => {
        this.sessions.set(data.sort((a, b) => b.id - a.id));
        this.loadingSessions.set(false);
      },
      error: () => {
        this.loadingSessions.set(false);
        if (showLoading) this.toast.error('No se pudieron cargar los lives 😿');
      }
    });
  }

  importLive() {
    const url = this.facebookUrl.trim();
    if (!url) return;

    this.importing.set(true);
    this.liveService.import({ facebookUrl: url, title: this.title.trim() || undefined }).subscribe({
      next: (session) => {
        this.importing.set(false);
        this.toast.success('Live enviado a procesar 💖');
        this.router.navigate(['/admin/live', session.id, 'review']);
      },
      error: () => {
        this.importing.set(false);
        this.toast.error('Error al importar el live 😿');
      }
    });
  }

  isInProgress(status: LiveSessionStatus): boolean {
    return IN_PROGRESS_STATUSES.includes(status);
  }

  statusLabel(status: LiveSessionStatus): string {
    switch (status) {
      case 'Queued': return 'En cola';
      case 'Downloading': return 'Descargando video';
      case 'Transcribing': return 'Transcribiendo audio';
      case 'Parsing': return 'Analizando pedidos';
      case 'Scanning': return 'Escaneando comentarios';
      case 'Ready': return 'Listo para revisar';
      case 'Failed': return 'Error';
      default: return status;
    }
  }

  statusBadgeClass(status: LiveSessionStatus): string {
    if (status === 'Ready') return 'status-badge badge-ready';
    if (status === 'Failed') return 'status-badge badge-failed';
    return 'status-badge badge-progress';
  }

  progressPercent(status: LiveSessionStatus): number {
    switch (status) {
      case 'Queued': return 10;
      case 'Downloading': return 30;
      case 'Transcribing': return 55;
      case 'Parsing': return 75;
      case 'Scanning': return 90;
      default: return 100;
    }
  }
}
