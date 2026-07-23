import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { OrderSummaryDto, SalesPeriodDto } from '../../../../core/models';
import { buildMessengerLink, buildOrderMessage } from '../../../../core/utils/messenger.util';

@Component({
  selector: 'app-send-links',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, RouterLink],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-4 animate-slide-down">
        <div>
          <h1 class="text-2xl font-bold text-pink-900">💌 Centro de Envíos</h1>
          <p class="text-sm text-pink-400 font-medium mt-1">Manda los enlaces de todo el live, uno por uno, sin perder el hilo.</p>
        </div>
        <div class="flex gap-2">
          <a routerLink="/admin/clients/facebook-import" class="btn-coquette btn-outline-pink text-center align-middle inline-block">𝓶 Importar Facebooks</a>
          <a routerLink="/admin/orders" class="btn-coquette btn-outline-pink text-center align-middle inline-block">← Pedidos</a>
        </div>
      </div>

      <!-- Controls -->
      <div class="card-coquette p-4 animate-slide-up" style="opacity:0">
        <div class="flex flex-wrap gap-3 items-end">
          <div class="min-w-[220px]">
            <label class="label-coquette">📋 Corte de venta</label>
            <select class="input-coquette" [(ngModel)]="selectedPeriodId" (change)="loadOrders()">
              <option [ngValue]="null">Todos los cortes</option>
              @for (p of salesPeriods(); track p.id) {
                <option [ngValue]="p.id">{{ p.name }} {{ p.isActive ? '• activo' : '' }}</option>
              }
            </select>
          </div>
          <div class="flex-1 min-w-[200px]">
            <label class="label-coquette">🔍 Buscar clienta</label>
            <input class="input-coquette" placeholder="Nombre de clienta..." [(ngModel)]="search" />
          </div>
          <label class="flex items-center gap-2 cursor-pointer bg-pink-50/60 px-3 py-2.5 rounded-xl border border-pink-100 select-none">
            <input type="checkbox" [(ngModel)]="hideNotified" class="accent-pink-500 w-4 h-4" />
            <span class="text-xs font-bold text-pink-700">Ocultar ya enviados</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer bg-pink-50/60 px-3 py-2.5 rounded-xl border border-pink-100 select-none">
            <input type="checkbox" [(ngModel)]="hideClosed" class="accent-pink-500 w-4 h-4" />
            <span class="text-xs font-bold text-pink-700">Ocultar entregados/cancelados</span>
          </label>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
        <div class="card-coquette p-4 text-center">
          <p class="text-2xl font-black text-pink-900">{{ stats().total }}</p>
          <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest">En lista</p>
        </div>
        <div class="card-coquette p-4 text-center">
          <p class="text-2xl font-black text-emerald-600">{{ stats().sent }}</p>
          <p class="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Enviados</p>
        </div>
        <div class="card-coquette p-4 text-center">
          <p class="text-2xl font-black text-amber-600">{{ stats().pending }}</p>
          <p class="text-[10px] font-black text-amber-400 uppercase tracking-widest">Pendientes</p>
        </div>
        <div class="card-coquette p-4 text-center">
          <p class="text-2xl font-black text-rose-500">{{ stats().noFb }}</p>
          <p class="text-[10px] font-black text-rose-400 uppercase tracking-widest">Sin Facebook</p>
        </div>
      </div>

      <!-- Progress bar -->
      @if (stats().total > 0) {
        <div class="h-2.5 w-full bg-pink-100 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-500"
               [style.width.%]="(stats().sent / stats().total) * 100"></div>
        </div>
      }

      <!-- List -->
      @if (loading()) {
        <div class="space-y-3">
          @for (i of [1,2,3,4]; track i) {
            <div class="shimmer h-24 rounded-2xl"></div>
          }
        </div>
      } @else if (filteredOrders().length === 0) {
        <div class="card-coquette p-12 text-center animate-fade-in">
          <div class="text-5xl mb-3">🎉</div>
          <p class="text-pink-900 font-black text-lg">¡Nada pendiente por aquí!</p>
          <p class="text-pink-400 text-sm font-medium mt-1">No hay pedidos que coincidan con los filtros.</p>
        </div>
      } @else {
        <div class="space-y-3 pb-8">
          @for (o of filteredOrders(); track o.id) {
            <div class="card-coquette p-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-all"
                 [class.ring-2]="!!o.notifiedAt"
                 [class.ring-emerald-200]="!!o.notifiedAt"
                 [class.bg-emerald-50/30]="!!o.notifiedAt">

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-black text-pink-900 truncate">{{ o.clientName }}</span>
                  <span class="text-[10px] font-black px-2 py-0.5 rounded-full"
                        [class]="o.type === 'Frecuente' ? 'bg-purple-100 text-purple-600' : 'bg-pink-100 text-pink-600'">
                    {{ o.type === 'Frecuente' ? '👑 Frecuente' : '🌸 Nueva' }}
                  </span>
                  @if (o.notifiedAt) {
                    <span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ Enviado</span>
                  }
                </div>
                <div class="flex items-center gap-3 mt-1 text-xs text-pink-400 font-medium">
                  <span>Pedido #{{ o.id }}</span>
                  <span class="font-black text-pink-700">{{ o.total | currency:'MXN':'symbol-narrow' }}</span>
                  @if (o.clientFacebookProfileUrl) {
                    <span class="text-[#0099FF] font-bold">𝓶 Facebook ✓</span>
                  } @else {
                    <button class="text-rose-400 font-bold hover:text-rose-600 underline" (click)="toggleFbEditor(o.id)">+ Agregar Facebook</button>
                  }
                </div>

                <!-- Inline Facebook editor -->
                @if (editingFb() === o.id) {
                  <div class="mt-2 flex gap-2 animate-slide-down">
                    <input class="input-coquette flex-1 text-xs" placeholder="Pega el enlace del perfil de Facebook"
                           [(ngModel)]="fbDraft" (keyup.enter)="saveFacebook(o)" />
                    <button class="btn-coquette btn-pink py-1.5 px-3 text-[11px]" (click)="saveFacebook(o)">Guardar</button>
                    <button class="text-[11px] font-bold text-pink-400 px-2" (click)="editingFb.set(null)">✕</button>
                  </div>
                }
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2 shrink-0">
                <button class="w-10 h-10 rounded-xl bg-purple-50 text-purple-500 hover:bg-purple-100 hover:scale-105 active:scale-95 flex items-center justify-center transition-all border border-purple-100/50"
                        title="Solo copiar el enlace" (click)="copyLink(o)">🔗</button>

                <button class="flex items-center gap-2 px-4 h-10 rounded-xl bg-[#0099FF] text-white font-black text-sm hover:bg-[#0084e0] hover:scale-105 active:scale-95 transition-all shadow-md shadow-blue-200"
                        (click)="send(o)">
                  <svg class="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.672V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8.1l3.131 3.26 5.887-3.26-6.559 6.863z"/></svg>
                  Enviar
                </button>

                @if (o.notifiedAt) {
                  <button class="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 hover:scale-105 active:scale-95 flex items-center justify-center transition-all border border-gray-100"
                          title="Marcar como NO enviado" (click)="toggleNotified(o)">↩️</button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class SendLinksComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  orders = signal<OrderSummaryDto[]>([]);
  salesPeriods = signal<SalesPeriodDto[]>([]);
  loading = signal(true);

  selectedPeriodId: number | null = null;
  search = '';
  hideNotified = false;
  hideClosed = true;

  editingFb = signal<number | null>(null);
  fbDraft = '';

  private readonly CLOSED_STATUSES = ['Delivered', 'Canceled', 'NotDelivered'];

  filteredOrders = computed(() => {
    const term = this.search.trim().toLowerCase();
    return this.orders().filter(o => {
      if (this.hideNotified && o.notifiedAt) return false;
      if (this.hideClosed && this.CLOSED_STATUSES.includes(o.status)) return false;
      if (term && !o.clientName.toLowerCase().includes(term)) return false;
      return true;
    });
  });

  stats = computed(() => {
    const list = this.filteredOrders();
    return {
      total: list.length,
      sent: list.filter(o => !!o.notifiedAt).length,
      pending: list.filter(o => !o.notifiedAt).length,
      noFb: list.filter(o => !o.clientFacebookProfileUrl).length
    };
  });

  ngOnInit(): void {
    this.api.getSalesPeriods().subscribe({
      next: (periods) => {
        this.salesPeriods.set(periods);
        // Por defecto seleccionamos el corte activo (típicamente el live actual)
        const active = periods.find(p => p.isActive);
        this.selectedPeriodId = active ? active.id : null;
        this.loadOrders();
      },
      error: () => this.loadOrders()
    });
  }

  loadOrders(): void {
    this.loading.set(true);
    // pageSize alto: queremos todos los pedidos del corte de un jalón
    this.api.getOrdersPaged(1, 500, '', '', '', undefined, undefined, '', this.selectedPeriodId ?? undefined).subscribe({
      next: (res) => {
        this.orders.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error al cargar pedidos');
      }
    });
  }

  /** Construye el mensaje + lo copia + abre el chat directo de Messenger + marca enviado */
  send(o: OrderSummaryDto): void {
    const link = o.link.replace('/o/', '/pedido/');
    const msg = buildOrderMessage({
      clientName: o.clientName,
      publicLink: link,
      scheduledDeliveryDate: o.scheduledDeliveryDate,
      expiresAt: o.expiresAt
    });

    navigator.clipboard.writeText(msg).then(() => {
      this.toast.success(`Mensaje de ${o.clientName} copiado 💬`);
    });

    const chatUrl = buildMessengerLink(o.clientFacebookProfileUrl);
    if (chatUrl) {
      window.open(chatUrl, '_blank');
    } else {
      this.toast.info('Sin Facebook guardado: pega el mensaje manualmente y guarda su perfil 💡');
    }

    this.setNotified(o, true);
  }

  copyLink(o: OrderSummaryDto): void {
    const link = o.link.replace('/o/', '/pedido/');
    navigator.clipboard.writeText(link).then(() => this.toast.success('Enlace copiado 🔗'));
  }

  toggleNotified(o: OrderSummaryDto): void {
    this.setNotified(o, !o.notifiedAt);
  }

  /** Actualización optimista + persistencia en backend */
  private setNotified(o: OrderSummaryDto, notified: boolean): void {
    const previous = o.notifiedAt;
    this.patchLocal(o.id, { notifiedAt: notified ? new Date().toISOString() : undefined });
    this.api.markOrderNotified(o.id, notified).subscribe({
      error: () => {
        this.patchLocal(o.id, { notifiedAt: previous });
        this.toast.error('No se pudo guardar el estado de envío');
      }
    });
  }

  toggleFbEditor(orderId: number): void {
    this.fbDraft = '';
    this.editingFb.set(this.editingFb() === orderId ? null : orderId);
  }

  saveFacebook(o: OrderSummaryDto): void {
    const url = this.fbDraft.trim();
    if (!url) { this.editingFb.set(null); return; }

    // El nombre es obligatorio en el request; lo reenviamos para no borrarlo.
    this.api.updateOrderDetails(o.id, {
      clientName: o.clientName,
      clientFacebookProfileUrl: url
    }).subscribe({
      next: () => {
        this.patchLocal(o.id, { clientFacebookProfileUrl: url });
        this.editingFb.set(null);
        this.toast.success('Facebook guardado 𝓶✓ — ya puedes enviar directo');
      },
      error: () => this.toast.error('No se pudo guardar el Facebook')
    });
  }

  private patchLocal(orderId: number, patch: Partial<OrderSummaryDto>): void {
    this.orders.update(list => list.map(o => o.id === orderId ? { ...o, ...patch } : o));
  }
}
