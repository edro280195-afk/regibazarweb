import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ClientDto, ClientMergeAuditDto, DuplicateSuggestionDto } from '../../../../core/models';

interface PairWithDetails {
    suggestion: DuplicateSuggestionDto;
    left?: ClientDto;
    right?: ClientDto;
}

@Component({
    selector: 'app-clients-duplicates',
    standalone: true,
    imports: [CommonModule, DatePipe],
    template: `
    <div class="p-4 lg:p-8 min-h-[80vh]">
      <div class="max-w-5xl mx-auto">
        <header class="mb-6">
          <h1 class="text-3xl font-bold text-pink-900">🪞 Clientas duplicadas</h1>
          <p class="text-pink-700 mt-1">
            Pares de clientas que probablemente son la misma persona. Revísalos y fusiónalos
            para que sus pedidos, puntos y alias queden bajo un solo perfil.
          </p>
        </header>

        @if (loading()) {
        <div class="card-coquette p-6 text-center text-pink-700">
          <span class="spinner inline-block mr-2"></span> Buscando posibles duplicadas…
        </div>
        }

        @if (!loading() && suggestions().length === 0) {
        <div class="card-coquette p-8 text-center">
          <div class="text-6xl mb-3">✨</div>
          <h3 class="text-xl font-bold text-pink-900">¡Todo limpio!</h3>
          <p class="text-pink-700 mt-2">No detectamos clientas duplicadas. Buen trabajo.</p>
        </div>
        }

        @if (!loading() && suggestions().length > 0) {
        <div class="space-y-4 mb-8">
          @for (pair of pairsWithDetails(); track pair.suggestion.leftClientId + '-' + pair.suggestion.rightClientId) {
          <div class="card-coquette p-4">
            <div class="flex items-center gap-2 mb-3">
              <span class="badge"
                [class.badge-phone]="pair.suggestion.reason === 'same-phone'"
                [class.badge-name]="pair.suggestion.reason === 'similar-name'">
                {{ reasonLabel(pair.suggestion.reason) }}
              </span>
              <span class="text-xs text-pink-600">confianza {{ percent(pair.suggestion.confidence) }}%</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
              <!-- Left -->
              <div class="border border-pink-200 rounded-xl p-3 bg-pink-50/40">
                <div class="font-bold text-pink-900">{{ pair.left?.name ?? pair.suggestion.leftName }}</div>
                <div class="text-xs text-pink-700 mt-1">
                  {{ pair.suggestion.leftOrdersCount }} ped.
                  @if (pair.left?.phone) { · 📞 {{ pair.left?.phone }} }
                </div>
                @if (pair.left?.address) {
                <div class="text-xs text-pink-600 mt-1 truncate">📍 {{ pair.left?.address }}</div>
                }
                <button class="mt-2 text-xs text-pink-500 hover:underline" (click)="goToClient(pair.suggestion.leftClientId)">
                  Ver perfil →
                </button>
              </div>

              <div class="text-center text-pink-400 text-2xl">↔</div>

              <!-- Right -->
              <div class="border border-pink-200 rounded-xl p-3 bg-pink-50/40">
                <div class="font-bold text-pink-900">{{ pair.right?.name ?? pair.suggestion.rightName }}</div>
                <div class="text-xs text-pink-700 mt-1">
                  {{ pair.suggestion.rightOrdersCount }} ped.
                  @if (pair.right?.phone) { · 📞 {{ pair.right?.phone }} }
                </div>
                @if (pair.right?.address) {
                <div class="text-xs text-pink-600 mt-1 truncate">📍 {{ pair.right?.address }}</div>
                }
                <button class="mt-2 text-xs text-pink-500 hover:underline" (click)="goToClient(pair.suggestion.rightClientId)">
                  Ver perfil →
                </button>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap gap-2 items-center justify-end">
              <span class="text-xs text-pink-700 mr-auto">¿Fusionar a cuál?</span>
              <button class="btn-coquette btn-light text-sm"
                [disabled]="merging() === pair.suggestion.leftClientId + '-' + pair.suggestion.rightClientId"
                (click)="merge(pair.suggestion.rightClientId, pair.suggestion.leftClientId, pair.right?.name ?? pair.suggestion.rightName, pair.left?.name ?? pair.suggestion.leftName)">
                Quedarme con <strong class="ml-1">{{ pair.left?.name ?? pair.suggestion.leftName }}</strong>
              </button>
              <button class="btn-coquette btn-pink text-sm"
                [disabled]="merging() === pair.suggestion.leftClientId + '-' + pair.suggestion.rightClientId"
                (click)="merge(pair.suggestion.leftClientId, pair.suggestion.rightClientId, pair.left?.name ?? pair.suggestion.leftName, pair.right?.name ?? pair.suggestion.rightName)">
                Quedarme con <strong class="ml-1">{{ pair.right?.name ?? pair.suggestion.rightName }}</strong>
              </button>
            </div>
          </div>
          }
        </div>
        }

        <!-- Historial de fusiones (colapsado por defecto) -->
        <div class="card-coquette p-4 mt-6">
          <button type="button"
            class="w-full flex items-center justify-between text-left"
            (click)="toggleAudits()">
            <div>
              <h2 class="text-lg font-bold text-pink-900">📜 Historial de fusiones</h2>
              <p class="text-xs text-pink-600 mt-0.5">
                Fusiones automáticas y manuales recientes.
              </p>
            </div>
            <span class="text-pink-500 text-2xl select-none">
              {{ auditsExpanded() ? '−' : '+' }}
            </span>
          </button>

          @if (auditsExpanded()) {
          <div class="mt-4">
            @if (auditsLoading()) {
            <div class="text-center text-pink-700 text-sm py-4">
              <span class="spinner inline-block mr-2"></span> Cargando historial…
            </div>
            } @else if (audits().length === 0) {
            <div class="text-center text-pink-600 text-sm py-4">
              Sin fusiones registradas todavía.
            </div>
            } @else {
            <ul class="divide-y divide-pink-100">
              @for (a of audits(); track a.id) {
              <li class="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div class="text-xs text-pink-600 sm:w-32 shrink-0">
                  {{ a.mergedAt | date:'short' }}
                </div>
                <div class="shrink-0">
                  @if (a.mode === 'Auto') {
                  <span class="audit-badge audit-badge-auto">✨ Auto</span>
                  } @else {
                  <span class="audit-badge audit-badge-manual">✋ Manual</span>
                  }
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm text-pink-900 truncate">
                    <strong>{{ a.sourceName }}</strong>
                    <span class="mx-1 text-pink-400">→</span>
                    <strong>{{ a.targetName }}</strong>
                  </div>
                  @if (a.reason) {
                  <div class="text-xs text-pink-500 mt-0.5 truncate">{{ a.reason }}</div>
                  }
                </div>
                <div class="text-xs text-pink-700 shrink-0 sm:text-right">
                  {{ a.ordersMoved }} pedidos, {{ a.aliasesMoved }} alias movidos
                </div>
              </li>
              }
            </ul>
            }
          </div>
          }
        </div>
      </div>
    </div>
  `,
    styles: [`
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .badge-phone { background: rgba(255, 182, 200, 0.25); color: #9d3a72; }
    .badge-name { background: rgba(199, 119, 184, 0.18); color: #7a3d6a; }
    .audit-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .audit-badge-auto { background: rgba(199, 119, 184, 0.22); color: #7a3d6a; }
    .audit-badge-manual { background: rgba(255, 218, 230, 0.6); color: #9d3a72; }
    .spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(255, 182, 200, 0.4);
      border-top-color: #c777b8;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class ClientsDuplicatesComponent implements OnInit {
    private api = inject(ApiService);
    private toast = inject(ToastService);
    private router = inject(Router);

    loading = signal(true);
    suggestions = signal<DuplicateSuggestionDto[]>([]);
    clients = signal<ClientDto[]>([]);
    merging = signal<string | null>(null);

    // Historial de fusiones (colapsable, se carga la primera vez que se expande)
    auditsExpanded = signal(false);
    auditsLoaded = signal(false);
    auditsLoading = signal(false);
    audits = signal<ClientMergeAuditDto[]>([]);

    pairsWithDetails = computed<PairWithDetails[]>(() => {
        const byId = new Map(this.clients().map(c => [c.id, c]));
        return this.suggestions().map(s => ({
            suggestion: s,
            left: byId.get(s.leftClientId),
            right: byId.get(s.rightClientId),
        }));
    });

    ngOnInit() {
        this.load();
    }

    load() {
        this.loading.set(true);
        Promise.all([
            this.api.getDuplicateSuggestions(100).toPromise(),
            this.api.getClients().toPromise(),
        ]).then(([suggestions, clients]) => {
            this.suggestions.set(suggestions ?? []);
            this.clients.set(clients ?? []);
            this.loading.set(false);
        }).catch(() => {
            this.loading.set(false);
            this.toast.error('No se pudieron cargar las sugerencias 😿');
        });
    }

    merge(targetId: number, sourceId: number, targetName: string, sourceName: string) {
        const pairKey = `${Math.min(targetId, sourceId)}-${Math.max(targetId, sourceId)}`;
        if (!confirm(`Fusionar "${sourceName}" dentro de "${targetName}". Los pedidos, puntos y alias se moverán al perfil de "${targetName}". ¿Confirmas?`)) {
            return;
        }
        this.merging.set(pairKey);
        this.api.mergeClients({ sourceId, targetId }).subscribe({
            next: () => {
                this.merging.set(null);
                this.toast.success(`Fusionada en ${targetName} 💖`);
                this.load();
                // Si el historial ya estaba abierto, refrescamos para reflejar la nueva fusión.
                if (this.auditsExpanded()) {
                    this.loadAudits();
                } else {
                    // En cualquier caso marcamos como no cargado para que al abrir muestre lo nuevo.
                    this.auditsLoaded.set(false);
                }
            },
            error: () => {
                this.merging.set(null);
                this.toast.error('Error al fusionar 😿');
            }
        });
    }

    toggleAudits() {
        const next = !this.auditsExpanded();
        this.auditsExpanded.set(next);
        if (next && !this.auditsLoaded()) {
            this.loadAudits();
        }
    }

    loadAudits() {
        this.auditsLoading.set(true);
        this.api.getClientMergeAudits(50).subscribe({
            next: (rows) => {
                this.audits.set(rows ?? []);
                this.auditsLoaded.set(true);
                this.auditsLoading.set(false);
            },
            error: () => {
                this.auditsLoading.set(false);
                this.toast.error('No se pudo cargar el historial de fusiones 😿');
            }
        });
    }

    goToClient(id: number) {
        this.router.navigate(['/admin/clients', id]);
    }

    reasonLabel(reason: string): string {
        switch (reason) {
            case 'same-phone': return '📞 Mismo teléfono';
            case 'similar-name': return '🔤 Nombre parecido';
            case 'similar-address': return '📍 Dirección parecida';
            default: return reason;
        }
    }

    percent(value: number): number {
        return Math.round(value * 100);
    }
}
