import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import {
  CreateOrderConsolidationRequest,
  OrderConsolidationDto,
  OrderSummaryDto,
  PagedResult
} from '../../../../core/models';
import { OrderConsolidationsHistoryComponent } from './order-consolidations-history.component';

type ConsolidationTab = 'create' | 'history';

interface OwnerOrderGroup {
  key: string;
  clientId: number | null;
  name: string;
  orders: OrderSummaryDto[];
  total: number;
  amountPaid: number;
  balanceDue: number;
}

@Component({
  selector: 'app-order-consolidations',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DatePipe, RouterLink, OrderConsolidationsHistoryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './order-consolidations.component.css',
  template: `
    <main class="consolidation-page">
      <header class="consolidation-header">
        <a routerLink="/admin/orders" class="back-link">← Volver a pedidos</a>
        <div class="hero-copy">
          <span class="hero-sticker" aria-hidden="true">🛍️</span>
          <div>
            <p class="eyebrow">Una bolsa, varias compras</p>
            <h1>Unir pedidos</h1>
            <p class="hero-description">Junta lo que viaja junto y conserva quién pidió cada artículo, su historial y su saldo.</p>
          </div>
        </div>
        <div class="step-track" aria-label="Pasos para crear una bolsa">
          <span [class.is-current]="activeTab() === 'create' && !reviewing()">1. Elegir pedidos</span>
          <i aria-hidden="true">♡</i>
          <span [class.is-current]="reviewing()">2. Revisar la bolsa</span>
          <i aria-hidden="true">♡</i>
          <span [class.is-current]="activeTab() === 'history'">3. Historial</span>
        </div>
      </header>

      <nav class="view-tabs" aria-label="Vistas de bolsas">
        <button type="button" [class.is-active]="activeTab() === 'create'" (click)="showCreate()">✨ Preparar bolsa</button>
        <button type="button" [class.is-active]="activeTab() === 'history'" (click)="showHistory()">📚 Historial @if (history().length) { <span>{{ history().length }}</span> }</button>
      </nav>

      @if (notice()) {
        <div class="notice success-notice" role="status">{{ notice() }}</div>
      }
      @if (errorMessage()) {
        <div class="notice error-notice" role="alert">{{ errorMessage() }}</div>
      }

      @if (activeTab() === 'create') {
        @if (!reviewing()) {
          <section class="work-card selection-view" aria-labelledby="selection-title">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Primero, ¿qué pedidos van juntos?</p>
                <h2 id="selection-title">Elige los pedidos originales</h2>
                <p>Busca por clienta, artículo o número. Puedes incluir a varias clientas y elegirlas aunque estén en páginas distintas.</p>
              </div>
              <div class="selection-counter"><strong>{{ selectedOrders().length }}</strong><span>elegidos</span></div>
            </div>

            <div class="search-row">
              <label for="consolidation-search">Buscar pedidos</label>
              <div class="search-control">
                <span aria-hidden="true">⌕</span>
                <input id="consolidation-search" type="search" [(ngModel)]="searchTerm" (keydown.enter)="searchCandidates()" placeholder="Nombre, artículo o #pedido" />
                <button type="button" class="small-button" (click)="searchCandidates()" [disabled]="loadingCandidates()">Buscar</button>
              </div>
            </div>

            @if (loadingCandidates()) {
              <div class="loading-state" role="status"><span class="loading-heart">♡</span> Buscando pedidos listos para reunirse…</div>
            } @else if (candidates().length === 0) {
              <div class="empty-state">
                <span aria-hidden="true">🌷</span>
                <h3>No hay pedidos disponibles con esta búsqueda</h3>
                <p>Se muestran pedidos a domicilio pendientes o confirmados, todavía sin ruta ni otra bolsa.</p>
              </div>
            } @else {
              <div class="candidate-list" aria-label="Pedidos disponibles">
                @for (order of candidates(); track order.id) {
                  <label class="candidate-card" [class.is-selected]="isSelected(order.id)">
                    <input type="checkbox" [checked]="isSelected(order.id)" (change)="toggleCandidate(order)" [attr.aria-label]="(isSelected(order.id) ? 'Quitar' : 'Agregar') + ' pedido de ' + order.clientName + ', número ' + order.id" />
                    <span class="custom-check" aria-hidden="true">{{ isSelected(order.id) ? '✓' : '+' }}</span>
                    <span class="candidate-main">
                      <span class="candidate-topline"><strong>{{ order.clientName }}</strong><span>Pedido #{{ order.id }}</span></span>
                      <span class="candidate-meta">{{ order.itemsCount }} artículos · {{ order.createdAt | date:'d MMM, y' }} · {{ order.status === 'Confirmed' ? 'Confirmado' : 'Pendiente' }}</span>
                      @if (order.items.length) {
                        <span class="item-preview">{{ itemPreview(order) }}</span>
                      }
                    </span>
                    <span class="candidate-money">
                      <strong>{{ order.total | currency:'MXN':'symbol-narrow':'1.2-2' }}</strong>
                      <small>Debe {{ order.balanceDue | currency:'MXN':'symbol-narrow':'1.2-2' }}</small>
                    </span>
                  </label>
                }
              </div>

              @if (pageCount() > 1) {
                <div class="pagination">
                  <button type="button" class="small-button secondary" (click)="changePage(currentPage() - 1)" [disabled]="currentPage() <= 1">← Anterior</button>
                  <span>Página {{ currentPage() }} de {{ pageCount() }} · {{ totalCount() }} pedidos</span>
                  <button type="button" class="small-button secondary" (click)="changePage(currentPage() + 1)" [disabled]="currentPage() >= pageCount()">Siguiente →</button>
                </div>
              }
            }

            @if (selectedOrders().length) {
              <div class="selection-summary">
                <div><strong>{{ selectedOrders().length }} pedidos seleccionados</strong><small>{{ selectedTotal() | currency:'MXN':'symbol-narrow':'1.2-2' }} total · {{ selectedBalance() | currency:'MXN':'symbol-narrow':'1.2-2' }} por cobrar</small></div>
                <button type="button" class="text-button" (click)="clearSelection()">Limpiar</button>
              </div>
            }

            <div class="selection-footer">
              <p>Los pagos y artículos seguirán ligados a cada pedido de origen.</p>
              <button type="button" class="primary-button" (click)="startReview()" [disabled]="selectedOrders().length < 2">
                Revisar bolsa <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        } @else {
          <section class="work-card review-view" aria-labelledby="review-title">
            <button type="button" class="back-link button-link" (click)="backToSelection()">← Cambiar selección</button>
            <div class="section-heading review-heading">
              <div>
                <p class="eyebrow">Todo sigue con su dueña</p>
                <h2 id="review-title">Revisa antes de guardar 💗</h2>
                <p>Esta bolsa tendrá un solo domicilio. Cada pedido y su cuenta se mantienen separados.</p>
              </div>
              <div class="grand-total"><small>Total de la bolsa</small><strong>{{ selectedTotal() | currency:'MXN':'symbol-narrow':'1.2-2' }}</strong><span>Debe cobrarse {{ selectedBalance() | currency:'MXN':'symbol-narrow':'1.2-2' }}</span></div>
            </div>

            <div class="review-grid">
              <section class="recipient-card" aria-labelledby="recipient-title">
                <span class="recipient-icon" aria-hidden="true">📍</span>
                <div class="recipient-content">
                  <label for="primary-order">¿A casa de quién llevamos la bolsa?</label>
                  <select id="primary-order" [ngModel]="primaryOrderId()" (ngModelChange)="setPrimaryOrder($event)">
                    @for (order of primaryOptions(); track order.id) {
                      <option [ngValue]="order.id">{{ order.clientName }} · pedido #{{ order.id }}</option>
                    }
                  </select>
                  @if (primaryAddress()) {
                    <p>{{ primaryAddress() }}</p>
                  } @else {
                    <p class="field-warning">Elige un pedido con domicilio guardado para usarlo como destino.</p>
                  }
                </div>
              </section>

              <section class="balance-card" aria-labelledby="balance-title">
                <div class="balance-heading"><span aria-hidden="true">💌</span><div><p class="eyebrow">Cuentas por separado</p><h3 id="balance-title">Total visible por clienta</h3></div></div>
                @for (owner of selectedOwners(); track owner.key) {
                  <div class="owner-balance-row">
                    <strong>{{ owner.name }}</strong>
                    <span>Total {{ owner.total | currency:'MXN':'symbol-narrow':'1.2-2' }}</span>
                    <span class="owner-paid-due">Pagado {{ owner.amountPaid | currency:'MXN':'symbol-narrow':'1.2-2' }} · Debe {{ owner.balanceDue | currency:'MXN':'symbol-narrow':'1.2-2' }}</span>
                  </div>
                }
                <div class="balance-total"><strong>Total de la bolsa</strong><strong>{{ selectedTotal() | currency:'MXN':'symbol-narrow':'1.2-2' }}</strong><span>Pagado {{ selectedPaid() | currency:'MXN':'symbol-narrow':'1.2-2' }} · Debe {{ selectedBalance() | currency:'MXN':'symbol-narrow':'1.2-2' }}</span></div>
              </section>
            </div>

            <section class="owners-section" aria-label="Artículos organizados por dueña">
              <div class="owners-heading"><div><p class="eyebrow">Dentro de la bolsa</p><h3>Artículos agrupados por dueña</h3></div><span>{{ selectedItemCount() }} artículos</span></div>
              @for (owner of selectedOwners(); track owner.key) {
                <article class="owner-card">
                  <header class="owner-card-heading">
                    <div><span class="owner-avatar">{{ owner.name.slice(0, 1).toUpperCase() }}</span><div><h4>{{ owner.name }}</h4><small>{{ owner.orders.length }} {{ owner.orders.length === 1 ? 'pedido' : 'pedidos' }} en esta bolsa</small></div></div>
                    <div class="owner-card-total"><small>Total de {{ owner.name }}</small><strong>{{ owner.total | currency:'MXN':'symbol-narrow':'1.2-2' }}</strong><span>Pagado {{ owner.amountPaid | currency:'MXN':'symbol-narrow':'1.2-2' }}</span><span>Debe {{ owner.balanceDue | currency:'MXN':'symbol-narrow':'1.2-2' }}</span></div>
                  </header>
                  @for (order of owner.orders; track order.id) {
                    <section class="source-order">
                      <div class="source-order-heading"><strong>Pedido #{{ order.id }}</strong><span>{{ order.itemsCount }} artículos</span><small>Total {{ order.total | currency:'MXN':'symbol-narrow':'1.2-2' }} · Pagado {{ order.amountPaid | currency:'MXN':'symbol-narrow':'1.2-2' }} · Debe {{ order.balanceDue | currency:'MXN':'symbol-narrow':'1.2-2' }}</small></div>
                      @if (order.items.length) {
                        <ul>
                          @for (item of order.items; track item.id) {
                            <li><span>{{ item.quantity }} × {{ item.productName }}</span><strong>{{ item.lineTotal | currency:'MXN':'symbol-narrow':'1.2-2' }}</strong></li>
                          }
                        </ul>
                      } @else {
                        <p class="muted-note">Este pedido no tiene artículos detallados.</p>
                      }
                    </section>
                  }
                </article>
              }
            </section>

            <aside class="next-step-note"><span aria-hidden="true">🚗</span><p><strong>La bolsa queda registrada para enlazarla a una ruta después.</strong><br />Por ahora, sus pedidos no se ofrecerán como entregas individuales.</p></aside>
            <div class="review-footer">
              <button type="button" class="small-button secondary" (click)="backToSelection()">Seguir editando</button>
              <button type="button" class="primary-button" (click)="saveConsolidation()" [disabled]="saving() || !primaryAddress()">
                @if (saving()) { Guardando… } @else { Guardar bolsa <span aria-hidden="true">♡</span> }
              </button>
            </div>
          </section>
        }
      } @else {
        <app-order-consolidations-history [consolidations]="history()" [loading]="loadingHistory()" (createAnother)="showCreate()" />
      }
    </main>
  `
})
export class OrderConsolidationsComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly activeTab = signal<ConsolidationTab>('create');
  readonly candidates = signal<OrderSummaryDto[]>([]);
  readonly selectedOrders = signal<OrderSummaryDto[]>([]);
  readonly currentPage = signal(1);
  readonly pageSize = 20;
  readonly totalCount = signal(0);
  readonly loadingCandidates = signal(false);
  readonly history = signal<OrderConsolidationDto[]>([]);
  readonly loadingHistory = signal(false);
  readonly historyLoaded = signal(false);
  readonly reviewing = signal(false);
  readonly saving = signal(false);
  readonly primaryOrderId = signal<number | null>(null);
  readonly notice = signal('');
  readonly errorMessage = signal('');
  searchTerm = '';

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));
  readonly selectedTotal = computed(() => this.selectedOrders().reduce((sum, order) => sum + order.total, 0));
  readonly selectedPaid = computed(() => this.selectedOrders().reduce((sum, order) => sum + order.amountPaid, 0));
  readonly selectedBalance = computed(() => this.selectedOrders().reduce((sum, order) => sum + order.balanceDue, 0));
  readonly selectedItemCount = computed(() => this.selectedOrders().reduce((sum, order) => sum + order.itemsCount, 0));
  readonly primaryOptions = computed(() => this.selectedOrders().filter(order => this.deliveryAddress(order).length > 0));
  readonly primaryAddress = computed(() => {
    const primary = this.primaryOptions().find(order => order.id === this.primaryOrderId());
    return primary ? this.deliveryAddress(primary) : '';
  });
  readonly selectedOwners = computed(() => this.groupOrdersByOwner(this.selectedOrders()));

  ngOnInit(): void {
    this.loadCandidates();
  }

  showCreate(): void {
    this.activeTab.set('create');
    this.notice.set('');
    this.errorMessage.set('');
    this.loadCandidates();
  }

  showHistory(): void {
    this.activeTab.set('history');
    this.notice.set('');
    this.errorMessage.set('');
    if (!this.historyLoaded()) this.loadHistory();
  }

  searchCandidates(): void {
    this.currentPage.set(1);
    this.loadCandidates();
  }

  changePage(page: number): void {
    if (page < 1 || page > this.pageCount()) return;
    this.currentPage.set(page);
    this.loadCandidates();
  }

  loadCandidates(): void {
    this.loadingCandidates.set(true);
    this.errorMessage.set('');
    this.api.getOrderConsolidationCandidates(this.currentPage(), this.pageSize, this.searchTerm).subscribe({
      next: (result: PagedResult<OrderSummaryDto>) => {
        this.candidates.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loadingCandidates.set(false);
      },
      error: (error: unknown) => {
        this.loadingCandidates.set(false);
        this.errorMessage.set(this.describeError(error, 'No se pudieron cargar los pedidos disponibles.'));
      }
    });
  }

  loadHistory(): void {
    this.loadingHistory.set(true);
    this.errorMessage.set('');
    this.api.getOrderConsolidations().subscribe({
      next: items => {
        this.history.set(items);
        this.historyLoaded.set(true);
        this.loadingHistory.set(false);
      },
      error: (error: unknown) => {
        this.loadingHistory.set(false);
        this.errorMessage.set(this.describeError(error, 'No se pudo cargar el historial.'));
      }
    });
  }

  isSelected(orderId: number): boolean {
    return this.selectedOrders().some(order => order.id === orderId);
  }

  toggleCandidate(order: OrderSummaryDto): void {
    this.notice.set('');
    this.errorMessage.set('');
    this.selectedOrders.update(selected => {
      if (selected.some(item => item.id === order.id)) return selected.filter(item => item.id !== order.id);
      return [...selected, order];
    });
  }

  clearSelection(): void {
    this.selectedOrders.set([]);
    this.primaryOrderId.set(null);
  }

  startReview(): void {
    if (this.selectedOrders().length < 2) return;
    const primary = this.primaryOptions()[0];
    this.primaryOrderId.set(primary?.id ?? null);
    this.reviewing.set(true);
    this.notice.set('');
    this.errorMessage.set('');
  }

  backToSelection(): void {
    this.reviewing.set(false);
  }

  setPrimaryOrder(value: number | string | null): void {
    const id = Number(value);
    this.primaryOrderId.set(Number.isFinite(id) && id > 0 ? id : null);
  }

  saveConsolidation(): void {
    const selected = this.selectedOrders();
    const primaryOrderId = this.primaryOrderId();
    if (selected.length < 2 || primaryOrderId == null || !this.primaryAddress()) return;

    const request: CreateOrderConsolidationRequest = {
      orderIds: selected.map(order => order.id),
      primaryOrderId
    };

    this.saving.set(true);
    this.notice.set('');
    this.errorMessage.set('');
    this.api.createOrderConsolidation(request).subscribe({
      next: consolidation => {
        this.saving.set(false);
        this.selectedOrders.set([]);
        this.primaryOrderId.set(null);
        this.reviewing.set(false);
        this.history.update(items => [consolidation, ...items.filter(item => item.id !== consolidation.id)]);
        this.historyLoaded.set(true);
        this.activeTab.set('history');
        this.notice.set(`¡Bolsa #${consolidation.id} guardada! Los pedidos y saldos originales siguen separados.`);
        this.loadCandidates();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(this.describeError(error, 'No se pudo guardar la bolsa. Actualiza la lista e inténtalo de nuevo.'));
      }
    });
  }

  itemPreview(order: OrderSummaryDto): string {
    const names = order.items.slice(0, 3).map(item => `${item.quantity} × ${item.productName}`);
    const remaining = order.items.length - names.length;
    return names.join(' · ') + (remaining > 0 ? ` · y ${remaining} más` : '');
  }

  private deliveryAddress(order: OrderSummaryDto): string {
    const alternativeAddress = order.alternativeAddress?.trim();
    return alternativeAddress || order.clientAddress?.trim() || '';
  }

  private groupOrdersByOwner(orders: OrderSummaryDto[]): OwnerOrderGroup[] {
    const groups = new Map<string, OwnerOrderGroup>();
    for (const order of orders) {
      const name = order.consolidationOwnerNameSnapshot || order.clientName;
      const clientId = order.consolidationOwnerClientId ?? order.clientId ?? null;
      const key = clientId == null ? name.trim().toLocaleLowerCase() : String(clientId);
      const group = groups.get(key) ?? {
        key,
        clientId,
        name,
        orders: [],
        total: 0,
        amountPaid: 0,
        balanceDue: 0
      };
      group.orders.push(order);
      group.total += order.total;
      group.amountPaid += order.amountPaid;
      group.balanceDue += order.balanceDue;
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  private describeError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (typeof error.error === 'string' && error.error.trim()) return error.error;
    if (typeof error.error?.message === 'string' && error.error.message.trim()) return error.error.message;
    return fallback;
  }
}
