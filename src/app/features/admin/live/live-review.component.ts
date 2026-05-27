import {
  Component,
  OnInit,
  DestroyRef,
  inject,
  signal,
  computed,
  HostListener
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LiveCaptureService } from '../../../core/services/live-capture.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  LiveReviewDto,
  LiveSessionDto,
  LiveProductDto,
  LiveCandidateDto,
  LiveSessionStatus,
  ConfirmCandidateRequest
} from '../../../core/models';

const IN_PROGRESS_STATUSES: LiveSessionStatus[] = ['Queued', 'Downloading', 'Transcribing', 'Parsing', 'Scanning'];

@Component({
  selector: 'app-live-review',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, RouterLink],
  template: `
    <div class="review-shell">

      <!-- ── LOADING / NOT READY ── -->
      @if (loadingReview()) {
        <div class="loading-screen">
          <span class="spinner-lg"></span>
          <p class="mt-4 text-pink-700 font-semibold">Cargando revisión…</p>
        </div>
      }

      <!-- ── SESSION NOT READY YET ── -->
      @if (!loadingReview() && session() && !isReady()) {
        <div class="not-ready-screen">
          <div class="card-coquette p-8 text-center max-w-md mx-auto mt-12">
            <div class="text-5xl mb-4">⏳</div>
            <h2 class="text-xl font-bold text-pink-900 mb-2">Procesando Live…</h2>
            <p class="text-pink-700 mb-4">{{ statusLabel(session()!.status) }}</p>
            <div class="progress-bar mb-4">
              <div class="progress-fill" [style.width]="progressPercent(session()!.status) + '%'"></div>
            </div>
            @if (session()!.statusDetail) {
              <p class="text-xs text-pink-500 italic">{{ session()!.statusDetail }}</p>
            }
            <p class="text-xs text-pink-500 mt-3">Actualizando automáticamente…</p>
          </div>
        </div>
      }

      <!-- ── ERROR ── -->
      @if (!loadingReview() && session()?.status === 'Failed') {
        <div class="p-8 text-center">
          <div class="card-coquette p-8 max-w-md mx-auto mt-12 text-center">
            <div class="text-5xl mb-4">❌</div>
            <h2 class="text-xl font-bold text-pink-900 mb-2">Error al procesar</h2>
            <p class="text-pink-700 mb-1">{{ session()!.statusDetail || 'El procesamiento del live falló.' }}</p>
            <a routerLink="/admin/live" class="btn-coquette btn-pink mt-4 inline-flex">← Volver</a>
          </div>
        </div>
      }

      <!-- ── MAIN REVIEW UI ── -->
      @if (!loadingReview() && reviewData() && isReady()) {
        <div class="review-layout">

          <!-- Header -->
          <div class="review-header">
            <div class="header-left">
              <a routerLink="/admin/live" class="back-link">← Lives</a>
              <h1 class="header-title">
                📹 {{ session()!.title || ('Live del ' + (session()!.importedAt | date:'dd/MM/yy')) }}
              </h1>
            </div>
            <div class="header-stats">
              <div class="stat-chip stat-confirmed">
                <span class="stat-num">{{ confirmedCount() }}</span>
                <span class="stat-label">confirmados</span>
              </div>
              <div class="stat-chip stat-pending">
                <span class="stat-num">{{ pendingCount() }}</span>
                <span class="stat-label">pendientes</span>
              </div>
              <div class="stat-chip stat-total">
                <span class="stat-num">{{ totalCount() }}</span>
                <span class="stat-label">total</span>
              </div>
            </div>
          </div>

          <!-- Body: sidebar + content -->
          <div class="review-body">

            <!-- ── LEFT SIDEBAR: Products ── -->
            <aside class="products-sidebar">
              <div class="sidebar-label">Productos</div>

              @for (product of products(); track product.id; let i = $index) {
                <button
                  class="product-item"
                  [class.product-selected]="selectedProductIndex() === i"
                  (click)="selectProduct(i)">
                  <div class="product-keyword">{{ product.keyword }}</div>
                  @if (product.description) {
                    <div class="product-desc">{{ product.description }}</div>
                  }
                  <div class="product-meta">
                    <span class="product-price">{{ product.price | currency:'MXN':'symbol-narrow':'1.0-0' }}</span>
                    @if (pendingForProduct(product.id) > 0) {
                      <span class="pending-pill">{{ pendingForProduct(product.id) }} pendientes</span>
                    }
                  </div>
                </button>
              }

              <!-- Unmatched section -->
              @if (unmatchedCandidates().length > 0) {
                <button
                  class="product-item unmatched-item"
                  [class.product-selected]="selectedProductIndex() === products().length"
                  (click)="selectUnmatched()">
                  <div class="product-keyword">Sin producto</div>
                  <div class="pending-pill">{{ unmatchedCandidates().length }}</div>
                </button>
              }
            </aside>

            <!-- ── RIGHT AREA: Candidates ── -->
            <main class="candidates-area">
              @if (currentCandidates().length === 0) {
                <div class="empty-candidates">
                  <div class="text-4xl mb-3">✨</div>
                  <p class="text-pink-700">No hay candidatos para este producto.</p>
                </div>
              }

              <div class="candidates-list">
                @for (candidate of currentCandidates(); track candidate.id; let i = $index) {
                  <div
                    class="candidate-row"
                    [class.candidate-confirmed]="candidate.status === 'Confirmed'"
                    [class.candidate-ignored]="candidate.status === 'Ignored'"
                    [class.candidate-focused]="focusedCandidateIndex() === i && candidate.status === 'Pending'">

                    <div class="candidate-main">
                      <!-- Source badge -->
                      <span class="source-badge source-{{ candidate.source.toLowerCase() }}">
                        {{ sourceLabel(candidate.source) }}
                      </span>

                      <!-- Name info -->
                      <div class="candidate-names">
                        @if (candidate.clientNameSpoken) {
                          <div class="spoken-name">{{ candidate.clientNameSpoken }}</div>
                        }
                        @if (candidate.commentDisplayName && candidate.commentDisplayName !== candidate.clientNameSpoken) {
                          <div class="comment-name">💬 {{ candidate.commentDisplayName }}</div>
                        }
                      </div>

                      <!-- Resolved client chip -->
                      @if (candidate.resolvedClientName && candidate.status === 'Pending') {
                        <div class="resolved-chip">
                          ✅ {{ candidate.resolvedClientName }}
                        </div>
                      }

                      <!-- Alias proposal -->
                      @if (candidate.proposedAliasPairJson && candidate.status === 'Pending') {
                        <label class="alias-label">
                          <input
                            type="checkbox"
                            class="alias-checkbox"
                            [checked]="getAliasChecked(candidate.id)"
                            (change)="toggleAlias(candidate.id, $event)">
                          🔗 Proponer alias: {{ formatAlias(candidate.proposedAliasPairJson) }}
                        </label>
                      }

                      <!-- Inline name input (when no resolved client) -->
                      @if (!candidate.resolvedClientId && candidate.status === 'Pending') {
                        <div class="name-input-row">
                          <input
                            type="text"
                            class="inline-input"
                            placeholder="Nombre de la clienta"
                            [value]="getManualName(candidate.id)"
                            (input)="setManualName(candidate.id, $event)"
                          />
                        </div>
                      }
                    </div>

                    <!-- Status overlay for done candidates -->
                    @if (candidate.status === 'Confirmed') {
                      <div class="done-overlay confirmed-overlay">
                        <span class="done-icon">✅</span>
                        <span class="done-label">{{ candidate.resolvedClientName || 'Confirmado' }}</span>
                      </div>
                    }

                    @if (candidate.status === 'Ignored') {
                      <div class="done-overlay ignored-overlay">
                        <span class="done-icon">⏭</span>
                        <span class="done-label">Ignorado</span>
                      </div>
                    }

                    <!-- Action buttons -->
                    @if (candidate.status === 'Pending') {
                      <div class="action-btns">
                        <button
                          class="btn-confirm"
                          [disabled]="busyCandidate() === candidate.id"
                          (click)="confirmCandidate(candidate)">
                          @if (busyCandidate() === candidate.id) {
                            <span class="spinner-sm"></span>
                          } @else {
                            ✅ Confirmar
                          }
                        </button>
                        <button
                          class="btn-ignore"
                          [disabled]="busyCandidate() === candidate.id"
                          (click)="ignoreCandidate(candidate)">
                          ⏭ Ignorar
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>
            </main>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .review-shell {
      min-height: 100vh;
    }

    /* Loading */
    .loading-screen, .not-ready-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
    }

    .spinner-lg {
      width: 48px; height: 48px;
      border: 4px solid rgba(255, 192, 215, 0.3);
      border-top-color: #c777b8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }

    .spinner-sm {
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      display: inline-block;
      vertical-align: middle;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .card-coquette {
      background: rgba(255, 255, 255, 0.75);
      border: 1px solid rgba(255, 192, 215, 0.5);
      border-radius: 1.25rem;
      box-shadow: 0 4px 20px rgba(255, 182, 200, 0.15);
      backdrop-filter: blur(8px);
    }

    .progress-bar {
      height: 6px;
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

    @keyframes shimmer { 0% { opacity: 0.7; } 50% { opacity: 1; } 100% { opacity: 0.7; } }

    /* ── REVIEW LAYOUT ── */
    .review-layout {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .review-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.5rem;
      background: rgba(255, 255, 255, 0.6);
      border-bottom: 1px solid rgba(255, 192, 215, 0.4);
      flex-wrap: wrap;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .back-link {
      color: #c777b8;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(199, 119, 184, 0.3);
      transition: all 0.2s ease;
    }

    .back-link:hover {
      background: rgba(199, 119, 184, 0.08);
    }

    .header-title {
      font-size: 1.2rem;
      font-weight: 800;
      color: #5a2d4f;
    }

    .header-stats {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .stat-chip {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4px 14px;
      border-radius: 12px;
      font-size: 0.7rem;
      min-width: 60px;
    }

    .stat-num {
      font-size: 1.2rem;
      font-weight: 900;
      line-height: 1.2;
    }

    .stat-label {
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 0.6rem;
    }

    .stat-confirmed { background: rgba(52, 211, 153, 0.12); color: #065f46; }
    .stat-pending { background: rgba(251, 191, 36, 0.12); color: #92400e; }
    .stat-total { background: rgba(199, 119, 184, 0.12); color: #5a2d4f; }

    /* ── BODY ── */
    .review-body {
      display: flex;
      flex: 1;
      min-height: 0;
      height: calc(100vh - 130px);
    }

    /* ── SIDEBAR ── */
    .products-sidebar {
      width: 240px;
      min-width: 200px;
      border-right: 1px solid rgba(255, 192, 215, 0.4);
      overflow-y: auto;
      padding: 0.75rem 0.5rem;
      background: rgba(255, 245, 247, 0.5);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .products-sidebar::-webkit-scrollbar { width: 3px; }
    .products-sidebar::-webkit-scrollbar-thumb {
      background: rgba(199, 119, 184, 0.2);
      border-radius: 10px;
    }

    .sidebar-label {
      font-size: 0.65rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #9d3a72;
      padding: 0 8px;
      margin-bottom: 4px;
    }

    .product-item {
      text-align: left;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid transparent;
      background: transparent;
      cursor: pointer;
      transition: all 0.18s ease;
      width: 100%;
      font-family: inherit;
    }

    .product-item:hover {
      background: rgba(199, 119, 184, 0.08);
      border-color: rgba(199, 119, 184, 0.15);
    }

    .product-selected {
      background: linear-gradient(135deg, rgba(199, 119, 184, 0.18), rgba(248, 176, 214, 0.12)) !important;
      border-color: rgba(199, 119, 184, 0.4) !important;
      box-shadow: 0 2px 10px rgba(199, 119, 184, 0.12);
    }

    .product-keyword {
      font-weight: 700;
      color: #5a2d4f;
      font-size: 0.9rem;
    }

    .product-desc {
      font-size: 0.75rem;
      color: #8a7080;
      margin-top: 2px;
    }

    .product-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      flex-wrap: wrap;
    }

    .product-price {
      font-size: 0.8rem;
      font-weight: 700;
      color: #c777b8;
    }

    .pending-pill {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 1px 8px;
      border-radius: 999px;
      background: rgba(251, 191, 36, 0.2);
      color: #92400e;
    }

    .unmatched-item .product-keyword {
      color: #8a7080;
    }

    /* ── CANDIDATES AREA ── */
    .candidates-area {
      flex: 1;
      overflow-y: auto;
      padding: 1rem 1.5rem;
    }

    .candidates-area::-webkit-scrollbar { width: 4px; }
    .candidates-area::-webkit-scrollbar-thumb {
      background: rgba(199, 119, 184, 0.2);
      border-radius: 10px;
    }

    .empty-candidates {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      text-align: center;
    }

    .candidates-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .candidate-row {
      position: relative;
      background: rgba(255, 255, 255, 0.7);
      border: 1.5px solid rgba(255, 192, 215, 0.4);
      border-radius: 14px;
      padding: 14px 16px;
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      justify-content: space-between;
      transition: all 0.18s ease;
      box-shadow: 0 2px 8px rgba(255, 182, 200, 0.08);
    }

    .candidate-row:hover {
      box-shadow: 0 4px 16px rgba(255, 182, 200, 0.2);
    }

    .candidate-focused {
      border-color: #c777b8 !important;
      box-shadow: 0 0 0 3px rgba(199, 119, 184, 0.2) !important;
    }

    .candidate-confirmed {
      opacity: 0.55;
      background: rgba(220, 252, 231, 0.4) !important;
      border-color: rgba(52, 211, 153, 0.3) !important;
    }

    .candidate-ignored {
      opacity: 0.4;
      background: rgba(243, 244, 246, 0.6) !important;
      border-color: rgba(209, 213, 219, 0.5) !important;
    }

    .candidate-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .source-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      width: fit-content;
    }

    .source-spoken { background: rgba(199, 119, 184, 0.15); color: #7a3d6a; }
    .source-comment { background: rgba(99, 179, 237, 0.15); color: #1a5276; }
    .source-spokenandcomment { background: rgba(52, 211, 153, 0.15); color: #065f46; }

    .candidate-names {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .spoken-name {
      font-size: 1rem;
      font-weight: 700;
      color: #5a2d4f;
    }

    .comment-name {
      font-size: 0.8rem;
      color: #8a7080;
    }

    .resolved-chip {
      display: inline-block;
      padding: 3px 12px;
      background: rgba(52, 211, 153, 0.15);
      border: 1px solid rgba(52, 211, 153, 0.3);
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 600;
      color: #065f46;
      width: fit-content;
    }

    .alias-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      color: #7a3d6a;
      cursor: pointer;
    }

    .alias-checkbox {
      accent-color: #c777b8;
      cursor: pointer;
    }

    .name-input-row {
      margin-top: 2px;
    }

    .inline-input {
      padding: 5px 10px;
      border-radius: 8px;
      border: 1.5px solid rgba(255, 192, 215, 0.5);
      background: rgba(255, 255, 255, 0.8);
      font-size: 0.85rem;
      color: #5a2d4f;
      outline: none;
      width: 100%;
      max-width: 260px;
      box-sizing: border-box;
      transition: border-color 0.2s ease;
    }

    .inline-input:focus {
      border-color: #c777b8;
      box-shadow: 0 0 0 2px rgba(199, 119, 184, 0.15);
    }

    .done-overlay {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .confirmed-overlay { color: #065f46; }
    .ignored-overlay { color: #6b7280; }

    .done-icon { font-size: 1rem; }

    .action-btns {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex-shrink: 0;
    }

    .btn-confirm, .btn-ignore {
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.18s ease;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .btn-confirm {
      background: linear-gradient(135deg, #c777b8, #9d5990);
      color: white;
      box-shadow: 0 2px 8px rgba(199, 119, 184, 0.3);
    }

    .btn-confirm:hover:not(:disabled) {
      filter: brightness(1.08);
      transform: translateY(-1px);
    }

    .btn-confirm:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-ignore {
      background: rgba(243, 244, 246, 0.8);
      color: #6b7280;
      border: 1px solid rgba(209, 213, 219, 0.6);
    }

    .btn-ignore:hover:not(:disabled) {
      background: rgba(229, 231, 235, 0.9);
    }

    .btn-ignore:disabled {
      opacity: 0.5;
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

    .btn-pink:hover {
      filter: brightness(1.08);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .review-body {
        flex-direction: column;
        height: auto;
      }

      .products-sidebar {
        width: 100%;
        min-width: unset;
        border-right: none;
        border-bottom: 1px solid rgba(255, 192, 215, 0.4);
        flex-direction: row;
        overflow-x: auto;
        padding: 0.5rem;
      }

      .product-item {
        min-width: 120px;
        flex-shrink: 0;
      }
    }
  `]
})
export class LiveReviewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private liveService = inject(LiveCaptureService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  // ── State signals ──
  loadingReview = signal(true);
  reviewData = signal<LiveReviewDto | null>(null);
  session = signal<LiveSessionDto | null>(null);

  selectedProductIndex = signal(0);
  focusedCandidateIndex = signal(0);
  busyCandidate = signal<number | null>(null);

  // Track per-candidate overrides
  private aliasChecked = new Map<number, boolean>();
  private manualNames = new Map<number, string>();

  // ── Computed ──
  products = computed<LiveProductDto[]>(() => this.reviewData()?.products ?? []);

  unmatchedCandidates = computed<LiveCandidateDto[]>(() => {
    const d = this.reviewData();
    if (!d) return [];
    return (d.unmatchedCandidates ?? []).map(c => this.localCandidate(c.id) ?? c);
  });

  currentCandidates = computed<LiveCandidateDto[]>(() => {
    const d = this.reviewData();
    if (!d) return [];
    const prods = this.products();
    const idx = this.selectedProductIndex();

    if (idx === prods.length) {
      // Unmatched section
      return this.unmatchedCandidates();
    }

    const prod = prods[idx];
    if (!prod) return [];
    const raw = d.candidatesByProduct[prod.id.toString()] ?? [];
    return raw.map(c => this.localCandidate(c.id) ?? c);
  });

  confirmedCount = computed(() => {
    const d = this.reviewData();
    if (!d) return 0;
    let count = 0;
    for (const list of Object.values(d.candidatesByProduct)) {
      for (const c of list) {
        const local = this.localCandidate(c.id);
        if ((local ?? c).status === 'Confirmed') count++;
      }
    }
    for (const c of (d.unmatchedCandidates ?? [])) {
      const local = this.localCandidate(c.id);
      if ((local ?? c).status === 'Confirmed') count++;
    }
    return count;
  });

  pendingCount = computed(() => {
    const d = this.reviewData();
    if (!d) return 0;
    let count = 0;
    for (const list of Object.values(d.candidatesByProduct)) {
      for (const c of list) {
        const local = this.localCandidate(c.id);
        if ((local ?? c).status === 'Pending') count++;
      }
    }
    for (const c of (d.unmatchedCandidates ?? [])) {
      const local = this.localCandidate(c.id);
      if ((local ?? c).status === 'Pending') count++;
    }
    return count;
  });

  totalCount = computed(() => {
    const d = this.reviewData();
    if (!d) return 0;
    let count = 0;
    for (const list of Object.values(d.candidatesByProduct)) count += list.length;
    count += (d.unmatchedCandidates ?? []).length;
    return count;
  });

  isReady = computed(() => this.session()?.status === 'Ready');

  // Local overrides for optimistic updates
  private localOverrides = new Map<number, LiveCandidateDto>();

  private localCandidate(id: number): LiveCandidateDto | undefined {
    return this.localOverrides.get(id);
  }

  // ── Lifecycle ──
  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.router.navigate(['/admin/live']);
      return;
    }

    this.loadReview(id);

    // Poll session status if not ready
    interval(3000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const s = this.session();
        if (s && IN_PROGRESS_STATUSES.includes(s.status)) {
          this.liveService.getById(id).subscribe({
            next: (updated) => {
              this.session.set(updated);
              if (updated.status === 'Ready' && !this.reviewData()) {
                this.loadReview(id);
              }
            },
            error: () => {}
          });
        }
      });
  }

  private loadReview(id: number) {
    this.loadingReview.set(true);
    this.liveService.getReview(id).subscribe({
      next: (data) => {
        this.reviewData.set(data);
        this.session.set(data.session);
        this.loadingReview.set(false);
        // Initialize alias checkboxes
        for (const list of Object.values(data.candidatesByProduct)) {
          for (const c of list) {
            if (c.proposedAliasPairJson != null) {
              this.aliasChecked.set(c.id, true);
            }
          }
        }
        for (const c of (data.unmatchedCandidates ?? [])) {
          if (c.proposedAliasPairJson != null) {
            this.aliasChecked.set(c.id, true);
          }
        }
      },
      error: () => {
        // Maybe session not ready yet — try fetching just the session
        const routeId = Number(this.route.snapshot.paramMap.get('id'));
        this.liveService.getById(routeId).subscribe({
          next: (s) => { this.session.set(s); this.loadingReview.set(false); },
          error: () => { this.loadingReview.set(false); }
        });
      }
    });
  }

  // ── Actions ──
  selectProduct(index: number) {
    this.selectedProductIndex.set(index);
    this.focusedCandidateIndex.set(0);
  }

  selectUnmatched() {
    this.selectedProductIndex.set(this.products().length);
    this.focusedCandidateIndex.set(0);
  }

  pendingForProduct(productId: number): number {
    const d = this.reviewData();
    if (!d) return 0;
    const list = d.candidatesByProduct[productId.toString()] ?? [];
    return list.filter(c => (this.localCandidate(c.id) ?? c).status === 'Pending').length;
  }

  confirmCandidate(candidate: LiveCandidateDto) {
    const req: ConfirmCandidateRequest = {};

    if (candidate.resolvedClientId) {
      req.clientId = candidate.resolvedClientId;
    } else {
      const name = this.manualNames.get(candidate.id)?.trim();
      if (!name) {
        this.toast.error('Ingresa el nombre de la clienta para confirmar');
        return;
      }
      req.clientName = name;
    }

    const aliasJson = candidate.proposedAliasPairJson;
    if (aliasJson != null) {
      req.acceptAlias = this.aliasChecked.get(candidate.id) ?? true;
    }

    this.busyCandidate.set(candidate.id);
    this.liveService.confirm(candidate.id, req).subscribe({
      next: () => {
        this.busyCandidate.set(null);
        // Optimistic update
        const updated: LiveCandidateDto = {
          ...candidate,
          status: 'Confirmed',
          resolvedClientName: req.clientName ?? candidate.resolvedClientName
        };
        this.localOverrides.set(candidate.id, updated);
        // Force re-computation by updating session signal
        this.session.update(s => s ? { ...s } : s);
        this.toast.success('Confirmado 💖');
      },
      error: () => {
        this.busyCandidate.set(null);
        this.toast.error('Error al confirmar 😿');
      }
    });
  }

  ignoreCandidate(candidate: LiveCandidateDto) {
    this.busyCandidate.set(candidate.id);
    this.liveService.ignore(candidate.id).subscribe({
      next: () => {
        this.busyCandidate.set(null);
        const updated: LiveCandidateDto = { ...candidate, status: 'Ignored' };
        this.localOverrides.set(candidate.id, updated);
        this.session.update(s => s ? { ...s } : s);
      },
      error: () => {
        this.busyCandidate.set(null);
        this.toast.error('Error al ignorar 😿');
      }
    });
  }

  // ── Alias / Manual name helpers ──
  getAliasChecked(candidateId: number): boolean {
    return this.aliasChecked.get(candidateId) ?? true;
  }

  toggleAlias(candidateId: number, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.aliasChecked.set(candidateId, checked);
  }

  getManualName(candidateId: number): string {
    return this.manualNames.get(candidateId) ?? '';
  }

  setManualName(candidateId: number, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.manualNames.set(candidateId, value);
  }

  formatAlias(json: string): string {
    try {
      const obj = JSON.parse(json);
      if (obj.spoken && obj.comment) return `${obj.spoken} ↔ ${obj.comment}`;
      if (obj.name1 && obj.name2) return `${obj.name1} ↔ ${obj.name2}`;
      return JSON.stringify(obj);
    } catch {
      return json;
    }
  }

  // ── Status helpers ──
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

  sourceLabel(source: string): string {
    switch (source) {
      case 'Spoken': return '🎤 Hablado';
      case 'Comment': return '💬 Comentario';
      case 'SpokenAndComment': return '🎤💬 Ambos';
      default: return source;
    }
  }

  // ── Keyboard navigation ──
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    if (isInput) return;

    const candidates = this.currentCandidates().filter(c => c.status === 'Pending');
    const totalProducts = this.products().length + (this.unmatchedCandidates().length > 0 ? 1 : 0);

    switch (event.key) {
      case 'ArrowDown':
      case 'j':
        event.preventDefault();
        if (candidates.length > 0) {
          this.focusedCandidateIndex.update(i => Math.min(i + 1, candidates.length - 1));
        }
        break;

      case 'ArrowUp':
      case 'k':
        event.preventDefault();
        if (candidates.length > 0) {
          this.focusedCandidateIndex.update(i => Math.max(i - 1, 0));
        }
        break;

      case 'Enter': {
        event.preventDefault();
        const focused = candidates[this.focusedCandidateIndex()];
        if (focused) this.confirmCandidate(focused);
        break;
      }

      case 'Escape':
      case 'x': {
        event.preventDefault();
        const focused = candidates[this.focusedCandidateIndex()];
        if (focused) this.ignoreCandidate(focused);
        break;
      }

      case 'ArrowLeft':
        event.preventDefault();
        this.selectedProductIndex.update(i => Math.max(i - 1, 0));
        this.focusedCandidateIndex.set(0);
        break;

      case 'ArrowRight':
        event.preventDefault();
        this.selectedProductIndex.update(i => Math.min(i + 1, totalProducts - 1));
        this.focusedCandidateIndex.set(0);
        break;
    }
  }
}
