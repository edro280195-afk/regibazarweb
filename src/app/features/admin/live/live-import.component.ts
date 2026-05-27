import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription, timer, switchMap } from 'rxjs';
import { LiveCaptureService } from '../../../core/services/live-capture.service';
import { ToastService } from '../../../core/services/toast.service';
import { LiveSessionDto } from '../../../core/models';

type StepId = 'Queued' | 'Downloading' | 'Transcribing' | 'Parsing' | 'Ready';

@Component({
    selector: 'app-live-import',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    template: `
    <section class="live-import-page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Captura por video</p>
          <h1>Importar live de Facebook</h1>
        </div>
        <a routerLink="/admin/capture" class="secondary-link">Captura manual</a>
      </header>

      <div class="import-grid">
        <form class="import-panel" (ngSubmit)="importLive()">
          <label for="facebookUrl">URL del video publicado</label>
          <div class="url-row">
            <input
              id="facebookUrl"
              name="facebookUrl"
              type="url"
              [(ngModel)]="facebookUrl"
              placeholder="https://www.facebook.com/..."
              [disabled]="importing() || polling()"
              autocomplete="off">
            <button type="submit" [disabled]="!canImport()">
              @if (importing()) { Importando... } @else { Importar }
            </button>
          </div>
          <input
            name="title"
            class="title-input"
            [(ngModel)]="title"
            placeholder="Titulo interno opcional">

          @if (session()) {
            <div class="session-strip">
              <span>Live #{{ session()!.id }}</span>
              <strong>{{ statusLabel(session()!.status) }}</strong>
              @if (session()!.durationSeconds) {
                <span>{{ durationLabel(session()!.durationSeconds!) }}</span>
              }
            </div>
          }
        </form>

        <aside class="status-panel">
          <div class="status-header">
            <span>Proceso</span>
            @if (session()) {
              <strong>{{ progressPercent() }}%</strong>
            }
          </div>

          <div class="progress-track">
            <div class="progress-fill" [style.width.%]="progressPercent()"></div>
          </div>

          <ol class="step-list">
            @for (step of steps; track step.id) {
              <li [class.done]="stepIndex(step.id) < activeStepIndex()" [class.active]="stepIndex(step.id) === activeStepIndex()">
                <span class="step-dot"></span>
                <div>
                  <strong>{{ step.label }}</strong>
                  <small>{{ step.help }}</small>
                </div>
              </li>
            }
          </ol>

          @if (session()?.status === 'Failed') {
            <p class="error-box">{{ session()?.statusDetail || 'No se pudo procesar el live.' }}</p>
          } @else if (session()?.statusDetail) {
            <p class="detail-box">{{ session()?.statusDetail }}</p>
          }

          @if (session()?.status === 'Ready') {
            <div class="result-grid">
              <span><strong>{{ session()?.productCount || 0 }}</strong> productos</span>
              <span><strong>{{ session()?.candidateCount || 0 }}</strong> candidatos</span>
              <span><strong>{{ session()?.pendingCount || 0 }}</strong> pendientes</span>
            </div>
            <button type="button" class="review-button" (click)="goReview()">Revisar pedidos</button>
          }
        </aside>
      </div>
    </section>
  `,
    styles: [`
    :host { display: block; }
    .live-import-page {
      max-width: 1180px;
      margin: 0 auto;
      padding-bottom: 32px;
    }
    .page-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 22px;
    }
    .eyebrow {
      margin: 0 0 4px;
      color: #be185d;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      font-size: .72rem;
    }
    h1 {
      margin: 0;
      color: #831843;
      font-size: 2.2rem;
      line-height: 1.05;
      letter-spacing: 0;
    }
    .secondary-link {
      color: #9d174d;
      background: rgba(255,255,255,.7);
      border: 1px solid rgba(249,168,212,.45);
      text-decoration: none;
      padding: 10px 14px;
      border-radius: 12px;
      font-weight: 800;
      white-space: nowrap;
    }
    .import-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.25fr) minmax(340px, .75fr);
      gap: 18px;
      align-items: start;
    }
    .import-panel,
    .status-panel {
      background: rgba(255,255,255,.78);
      border: 1px solid rgba(249,168,212,.35);
      border-radius: 18px;
      box-shadow: 0 18px 40px rgba(190,24,93,.08);
    }
    .import-panel {
      padding: 22px;
      min-height: 260px;
    }
    label {
      display: block;
      color: #831843;
      font-weight: 900;
      margin-bottom: 10px;
    }
    .url-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
    }
    input {
      width: 100%;
      border: 2px solid #fce7f3;
      background: #fffbfd;
      color: #4a2040;
      border-radius: 14px;
      padding: 13px 14px;
      font: inherit;
      outline: none;
    }
    input:focus {
      border-color: #f9a8d4;
      box-shadow: 0 0 0 4px rgba(249,168,212,.16);
    }
    button {
      border: 0;
      border-radius: 14px;
      padding: 0 18px;
      font: inherit;
      font-weight: 900;
      color: #fffafd;
      background: linear-gradient(135deg, #ec4899, #be185d);
      box-shadow: 0 12px 24px rgba(190,24,93,.22);
      min-height: 50px;
    }
    button:disabled {
      opacity: .55;
      cursor: not-allowed !important;
      box-shadow: none;
    }
    .title-input { margin-top: 12px; }
    .session-strip {
      margin-top: 18px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      color: #7a3d6a;
    }
    .session-strip span,
    .session-strip strong {
      background: #fdf2f8;
      border: 1px solid #fbcfe8;
      border-radius: 999px;
      padding: 5px 10px;
      font-size: .82rem;
    }
    .status-panel { padding: 18px; }
    .status-header {
      display: flex;
      justify-content: space-between;
      color: #831843;
      font-weight: 900;
      margin-bottom: 10px;
    }
    .progress-track {
      height: 10px;
      background: #fce7f3;
      border-radius: 999px;
      overflow: hidden;
      margin-bottom: 18px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #f9a8d4, #be185d);
      border-radius: inherit;
      transition: width .25s ease;
    }
    .step-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 12px;
    }
    .step-list li {
      display: grid;
      grid-template-columns: 18px 1fr;
      gap: 10px;
      color: #9a7187;
    }
    .step-dot {
      width: 12px;
      height: 12px;
      margin-top: 5px;
      border-radius: 50%;
      border: 2px solid #f9a8d4;
      background: #fffafd;
    }
    .step-list li.done .step-dot,
    .step-list li.active .step-dot {
      background: #be185d;
      border-color: #be185d;
    }
    .step-list li.active strong,
    .step-list li.done strong {
      color: #831843;
    }
    .step-list strong,
    .step-list small {
      display: block;
    }
    .step-list small {
      font-size: .78rem;
      line-height: 1.3;
    }
    .error-box {
      margin: 16px 0 0;
      color: #991b1b;
      background: #fee2e2;
      border: 1px solid #fecaca;
      padding: 10px 12px;
      border-radius: 12px;
    }
    .detail-box {
      margin: 16px 0 0;
      color: #7a3d6a;
      background: #fffbfd;
      border: 1px solid #fbcfe8;
      padding: 10px 12px;
      border-radius: 12px;
      line-height: 1.35;
    }
    .result-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 16px;
    }
    .result-grid span {
      background: #fdf2f8;
      border: 1px solid #fbcfe8;
      border-radius: 12px;
      padding: 9px;
      color: #7a3d6a;
      text-align: center;
      font-size: .78rem;
      font-weight: 800;
    }
    .result-grid strong {
      display: block;
      color: #831843;
      font-size: 1.15rem;
    }
    .review-button {
      width: 100%;
      margin-top: 16px;
    }
    @media (max-width: 900px) {
      .page-header { align-items: flex-start; flex-direction: column; }
      .import-grid { grid-template-columns: 1fr; }
      .url-row { grid-template-columns: 1fr; }
      button { min-height: 48px; }
    }
  `]
})
export class LiveImportComponent implements OnDestroy {
    private liveCapture = inject(LiveCaptureService);
    private toast = inject(ToastService);
    private router = inject(Router);
    private pollSub?: Subscription;

    facebookUrl = '';
    title = '';
    importing = signal(false);
    polling = signal(false);
    session = signal<LiveSessionDto | null>(null);

    readonly steps: { id: StepId; label: string; help: string }[] = [
        { id: 'Queued', label: 'En cola', help: 'El servidor preparo el trabajo.' },
        { id: 'Downloading', label: 'Descargando video', help: 'Se guarda el MP4 en R2.' },
        { id: 'Transcribing', label: 'Transcribiendo audio', help: 'Whisper genera segmentos con tiempo.' },
        { id: 'Parsing', label: 'Detectando productos', help: 'Gemini identifica keywords y pedidos leidos.' },
        { id: 'Ready', label: 'Listo para revisar', help: 'Ya puedes confirmar pedidos.' },
    ];

    canImport = computed(() => {
        return this.facebookUrl.trim().length > 12 && !this.importing() && !this.polling();
    });

    progressPercent = computed(() => {
        if (!this.session()) return 0;
        return Math.round((this.activeStepIndex() / (this.steps.length - 1)) * 100);
    });

    ngOnDestroy(): void {
        this.pollSub?.unsubscribe();
    }

    importLive(): void {
        const url = this.facebookUrl.trim();
        if (!url) return;

        this.importing.set(true);
        this.liveCapture.importLive({ facebookUrl: url, title: this.title.trim() || undefined }).subscribe({
            next: session => {
                this.importing.set(false);
                this.session.set(session);
                this.toast.success(`Live #${session.id} importado`);
                this.startPolling(session.id);
            },
            error: err => {
                this.importing.set(false);
                this.toast.error(err?.error || 'No se pudo importar el live');
            }
        });
    }

    startPolling(id: number): void {
        this.pollSub?.unsubscribe();
        this.polling.set(true);
        this.pollSub = timer(0, 5000).pipe(
            switchMap(() => this.liveCapture.getSession(id))
        ).subscribe({
            next: session => {
                this.session.set(session);
                if (session.status === 'Ready') {
                    this.polling.set(false);
                    this.pollSub?.unsubscribe();
                }
                if (session.status === 'Failed') {
                    this.polling.set(false);
                    this.pollSub?.unsubscribe();
                }
            },
            error: () => {
                this.polling.set(false);
                this.pollSub?.unsubscribe();
                this.toast.error('No se pudo consultar el estado del live');
            }
        });
    }

    goReview(): void {
        const id = this.session()?.id;
        if (id) this.router.navigate(['/admin/live', id, 'review']);
    }

    activeStepIndex(): number {
        const status = this.session()?.status as StepId | 'Failed' | undefined;
        if (!status) return 0;
        if (status === 'Failed') return 0;
        return Math.max(0, this.steps.findIndex(step => step.id === status));
    }

    stepIndex(id: StepId): number {
        return this.steps.findIndex(step => step.id === id);
    }

    statusLabel(status: string): string {
        const labels: Record<string, string> = {
            Queued: 'En cola',
            Downloading: 'Descargando',
            Transcribing: 'Transcribiendo',
            Parsing: 'Analizando productos',
            Ready: 'Listo',
            Failed: 'Error'
        };
        return labels[status] ?? status;
    }

    durationLabel(seconds: number): string {
        const minutes = Math.round(seconds / 60);
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        return `${hours} h ${rest} min`;
    }
}
