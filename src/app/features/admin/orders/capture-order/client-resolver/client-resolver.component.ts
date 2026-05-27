import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Subject, Subscription, debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { ApiService } from '../../../../../core/services/api.service';
import { ResolveCandidateDto, ResolveClientResponse, ResolveSuggestedAction } from '../../../../../core/models';

/**
 * Resolver de identidad multi-señal de clientas.
 * Recibe nombre + opcionalmente teléfono y dirección, pregunta al backend por
 * candidatas con score, y muestra la sugerencia para que la dueña confirme con 1 tap.
 *
 * Salida `resolved`:
 *   - { clientId, action: 'use' }     → la dueña confirmó la candidata top.
 *   - { clientId, action: 'choose' }  → la dueña eligió de la lista top-N.
 *   - { clientId: null, action: 'create' } → la dueña marcó "es nueva".
 */
export interface ClientResolveResult {
    clientId: number | null;
    action: 'use' | 'choose' | 'create';
    matchedCandidate?: ResolveCandidateDto;
}

@Component({
    selector: 'app-client-resolver',
    standalone: true,
    imports: [CommonModule, CurrencyPipe],
    template: `
    <div class="resolver-shell" *ngIf="visible()">
      <div class="resolver-loading" *ngIf="loading()">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        <span class="muted">Buscando clienta…</span>
      </div>

      <ng-container *ngIf="!loading() && response()">
        <!-- "use": top candidate clarísimo -->
        <div *ngIf="response()!.suggestedAction === 'use' && top()" class="resolver-card use">
          <div class="card-row">
            <div class="avatar">{{ initials(top()!.name) }}</div>
            <div class="card-body">
              <div class="card-title">¿Es <strong>{{ top()!.name }}</strong>?</div>
              <div class="card-meta">
                <span class="badge">{{ top()!.matchedBy }}</span>
                <span class="muted">·</span>
                <span class="muted">{{ top()!.ordersCount }} pedido{{ top()!.ordersCount === 1 ? '' : 's' }}</span>
                <span class="muted" *ngIf="top()!.balanceDue > 0"> · debe {{ top()!.balanceDue | currency:'MXN':'symbol-narrow':'1.0-0' }}</span>
              </div>
              <div class="aliases" *ngIf="top()!.aliases && top()!.aliases.length">
                <span class="alias-chip" *ngFor="let a of top()!.aliases">{{ a }}</span>
              </div>
            </div>
          </div>
          <div class="card-actions">
            <button type="button" class="btn-primary" (click)="confirmTop()">Sí, es ella</button>
            <button type="button" class="btn-link" (click)="showChoose.set(true)">Otra</button>
            <button type="button" class="btn-link" (click)="markNew()">Es nueva</button>
          </div>
        </div>

        <!-- "choose" o expansión manual -->
        <div *ngIf="(response()!.suggestedAction === 'choose' || showChoose()) && candidates().length" class="resolver-card choose">
          <div class="card-title small">Posibles clientas</div>
          <ul class="candidate-list">
            <li *ngFor="let c of candidates()" class="candidate" (click)="confirmCandidate(c)">
              <div class="avatar small">{{ initials(c.name) }}</div>
              <div class="candidate-body">
                <div class="candidate-name">{{ c.name }}</div>
                <div class="candidate-meta">
                  <span class="badge tiny">{{ c.matchedBy }}</span>
                  <span class="muted">{{ percent(c.score) }}%</span>
                  <span class="muted">· {{ c.ordersCount }} ped.</span>
                </div>
              </div>
            </li>
          </ul>
          <div class="card-actions">
            <button type="button" class="btn-link" (click)="markNew()">Ninguna · es nueva</button>
          </div>
        </div>

        <!-- "create": no hay match suficiente -->
        <div *ngIf="response()!.suggestedAction === 'create'" class="resolver-card create">
          <span class="muted">Clienta nueva</span>
        </div>
      </ng-container>
    </div>
  `,
    styles: [`
    .resolver-shell { font-size: 0.875rem; }
    .resolver-card {
      border-radius: 14px;
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(255, 192, 215, 0.6);
      box-shadow: 0 6px 16px rgba(255, 182, 200, 0.15);
      backdrop-filter: blur(6px);
    }
    .resolver-card.use { border-color: rgba(199, 119, 184, 0.6); }
    .resolver-card.choose { background: rgba(255, 251, 254, 0.85); }
    .resolver-card.create { padding: 6px 12px; background: transparent; border: none; box-shadow: none; }
    .resolver-loading {
      display: flex; align-items: center; gap: 6px; padding: 8px 12px;
      font-size: 0.85rem;
    }
    .resolver-loading .dot {
      width: 6px; height: 6px; border-radius: 50%; background: #c777b8;
      animation: pulse 1.2s ease-in-out infinite;
    }
    .resolver-loading .dot:nth-child(2) { animation-delay: 0.15s; }
    .resolver-loading .dot:nth-child(3) { animation-delay: 0.3s; }
    @keyframes pulse {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1); }
    }
    .card-row { display: flex; gap: 12px; align-items: flex-start; }
    .avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, #ffb8d9, #c777b8); color: white;
      display: flex; align-items: center; justify-content: center;
      font-weight: 600; font-size: 0.95rem; flex-shrink: 0;
    }
    .avatar.small { width: 28px; height: 28px; font-size: 0.75rem; }
    .card-body { flex: 1; }
    .card-title { font-size: 1rem; color: #5a2d4f; margin-bottom: 4px; }
    .card-title.small { font-size: 0.85rem; font-weight: 600; color: #5a2d4f; margin-bottom: 8px; }
    .card-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 0.8rem; }
    .badge {
      display: inline-block;
      padding: 1px 8px;
      background: rgba(199, 119, 184, 0.15);
      color: #7a3d6a;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .badge.tiny { font-size: 0.65rem; padding: 0 6px; }
    .muted { color: #8a7080; }
    .aliases { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .alias-chip {
      background: rgba(199, 119, 184, 0.1);
      color: #5a2d4f;
      padding: 1px 8px;
      border-radius: 999px;
      font-size: 0.72rem;
    }
    .card-actions {
      display: flex; gap: 8px; margin-top: 10px; align-items: center; flex-wrap: wrap;
    }
    .btn-primary {
      background: linear-gradient(135deg, #c777b8, #9d5990);
      color: white; border: none;
      padding: 6px 14px; border-radius: 999px;
      font-size: 0.85rem; font-weight: 600;
      cursor: pointer;
    }
    .btn-primary:hover { filter: brightness(1.08); }
    .btn-link {
      background: transparent; border: none; color: #8a4f7e;
      cursor: pointer; font-size: 0.85rem;
      padding: 6px 10px; border-radius: 8px;
    }
    .btn-link:hover { background: rgba(199, 119, 184, 0.08); }
    .candidate-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
    .candidate {
      display: flex; gap: 10px; align-items: center;
      padding: 6px 8px; border-radius: 10px;
      cursor: pointer; transition: background 0.15s ease;
    }
    .candidate:hover { background: rgba(199, 119, 184, 0.08); }
    .candidate-body { flex: 1; }
    .candidate-name { color: #5a2d4f; font-weight: 500; font-size: 0.9rem; }
    .candidate-meta { display: flex; gap: 6px; align-items: center; font-size: 0.75rem; }
  `]
})
export class ClientResolverComponent implements OnInit, OnDestroy {
    @Input() set name(value: string) {
        this._name = (value ?? '').trim();
        this.input$.next();
    }
    @Input() set phone(value: string | undefined) {
        this._phone = value;
        this.input$.next();
    }
    @Input() set address(value: string | undefined) {
        this._address = value;
        this.input$.next();
    }

    @Output() resolved = new EventEmitter<ClientResolveResult>();

    private api = inject(ApiService);
    private input$ = new Subject<void>();
    private sub?: Subscription;

    private _name = '';
    private _phone: string | undefined;
    private _address: string | undefined;

    response = signal<ResolveClientResponse | null>(null);
    loading = signal(false);
    showChoose = signal(false);

    visible() {
        return this._name.length > 0 || !!this._phone || !!this._address;
    }

    candidates() {
        return this.response()?.candidates ?? [];
    }

    top() {
        return this.candidates()[0];
    }

    ngOnInit() {
        this.sub = this.input$
            .pipe(
                debounceTime(300),
                filter(() => this.visible()),
                distinctUntilChanged(() => false), // ya cambió por definición
                switchMap(() => {
                    this.loading.set(true);
                    this.showChoose.set(false);
                    return this.api.resolveClient({
                        name: this._name,
                        phone: this._phone,
                        address: this._address,
                    });
                })
            )
            .subscribe({
                next: (res) => {
                    this.loading.set(false);
                    this.response.set(res);
                },
                error: () => {
                    this.loading.set(false);
                    this.response.set({ candidates: [], suggestedAction: 'create' });
                }
            });

        // Disparar el primer lookup si ya hay inputs setteados
        if (this.visible()) this.input$.next();
    }

    ngOnDestroy() {
        this.sub?.unsubscribe();
    }

    confirmTop() {
        const c = this.top();
        if (!c) return;
        this.resolved.emit({ clientId: c.clientId, action: 'use', matchedCandidate: c });
    }

    confirmCandidate(c: ResolveCandidateDto) {
        this.resolved.emit({ clientId: c.clientId, action: 'choose', matchedCandidate: c });
    }

    markNew() {
        this.resolved.emit({ clientId: null, action: 'create' });
    }

    initials(name: string): string {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    percent(score: number): number {
        return Math.round(score * 100);
    }
}
