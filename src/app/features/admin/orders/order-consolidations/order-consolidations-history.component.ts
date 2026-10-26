import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { OrderConsolidationDto, OrderSummaryDto } from '../../../../core/models';

interface HistoryOwnerGroup {
  key: string;
  name: string;
  orders: OrderSummaryDto[];
  total: number;
  amountPaid: number;
  balanceDue: number;
}

@Component({
  selector: 'app-order-consolidations-history',
  standalone: true,
  imports: [CurrencyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './order-consolidations-history.component.css',
  template: `
    <section class="history-panel" aria-labelledby="history-title">
      <div class="history-heading">
        <div>
          <p class="eyebrow">Nada se pierde</p>
          <h2 id="history-title">Bolsas consolidadas</h2>
          <p>Consulta qué pedidos se reunieron, quién es la clienta principal y cuánto conserva cada cuenta.</p>
        </div>
        <button type="button" class="small-button" (click)="createAnother.emit()">＋ Preparar otra</button>
      </div>

      @if (loading) {
        <div class="loading-state" role="status"><span class="loading-heart">♡</span> Cargando historial…</div>
      } @else if (!consolidations.length) {
        <div class="empty-state"><span aria-hidden="true">📚</span><h3>Aún no hay bolsas guardadas</h3><p>Cuando reúnas pedidos, aquí verás el historial completo de cada bolsa.</p><button type="button" class="primary-button" (click)="createAnother.emit()">Preparar primera bolsa</button></div>
      } @else {
        <div class="history-list">
          @for (consolidation of consolidations; track consolidation.id) {
            <article class="history-card">
              <button type="button" class="history-card-toggle" (click)="toggleHistory(consolidation.id)" [attr.aria-expanded]="expandedId === consolidation.id">
                <span class="history-bag" aria-hidden="true">🛍️</span>
                <span class="history-main"><strong>Bolsa #{{ consolidation.id }}</strong><small>{{ consolidation.createdAtUtc | date:'d MMM y, h:mm a' }} · {{ consolidation.orders.length }} pedidos</small><span>Entrega a <b>{{ consolidation.primaryClientName }}</b> · {{ consolidation.primaryAddress }}</span></span>
                <span class="history-total"><strong>{{ consolidation.total | currency:'MXN':'symbol-narrow':'1.2-2' }}</strong><small>Debe {{ consolidation.balanceDue | currency:'MXN':'symbol-narrow':'1.2-2' }}</small></span>
                <span class="history-chevron" aria-hidden="true">{{ expandedId === consolidation.id ? '⌃' : '⌄' }}</span>
              </button>
              @if (expandedId === consolidation.id) {
                <div class="history-detail">
                  <div class="history-totals"><span>Total <strong>{{ consolidation.total | currency:'MXN':'symbol-narrow':'1.2-2' }}</strong></span><span>Pagado <strong>{{ consolidation.amountPaid | currency:'MXN':'symbol-narrow':'1.2-2' }}</strong></span><span>Por cobrar <strong>{{ consolidation.balanceDue | currency:'MXN':'symbol-narrow':'1.2-2' }}</strong></span></div>
                  @for (owner of ownersFor(consolidation); track owner.key) {
                    <section class="history-owner">
                      <header><strong>{{ owner.name }}</strong><span>Total {{ owner.total | currency:'MXN':'symbol-narrow':'1.2-2' }}</span><span>Pagado {{ owner.amountPaid | currency:'MXN':'symbol-narrow':'1.2-2' }}</span><span>Debe {{ owner.balanceDue | currency:'MXN':'symbol-narrow':'1.2-2' }}</span></header>
                      @for (order of owner.orders; track order.id) {
                        <div class="history-source-order"><strong>Pedido #{{ order.id }}</strong><span>{{ order.itemsCount }} artículos</span><span>{{ order.total | currency:'MXN':'symbol-narrow':'1.2-2' }}</span><ul>@for (item of order.items; track item.id) { <li>{{ item.quantity }} × {{ item.productName }}</li> }</ul></div>
                      }
                    </section>
                  }
                  <div class="history-route-note">📍 Destino elegido: {{ consolidation.primaryAddress }} <span>· La asignación a ruta será el siguiente paso.</span></div>
                </div>
              }
            </article>
          }
        </div>
      }
    </section>
  `
})
export class OrderConsolidationsHistoryComponent {
  @Input() consolidations: OrderConsolidationDto[] = [];
  @Input() loading = false;
  @Output() readonly createAnother = new EventEmitter<void>();

  expandedId: number | null = null;

  toggleHistory(id: number): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  ownersFor(consolidation: OrderConsolidationDto): HistoryOwnerGroup[] {
    const groups = new Map<string, HistoryOwnerGroup>();
    for (const member of consolidation.orders) {
      const key = String(member.ownerClientId);
      const group = groups.get(key) ?? {
        key,
        name: member.ownerNameSnapshot,
        orders: [],
        total: 0,
        amountPaid: 0,
        balanceDue: 0
      };
      group.orders.push(member.order);
      group.total += member.order.total;
      group.amountPaid += member.order.amountPaid;
      group.balanceDue += member.order.balanceDue;
      groups.set(key, group);
    }
    return [...groups.values()];
  }
}
