import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { Printer } from '@capgo/capacitor-printer';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { OrderItemDto, OrderSummaryDto, ORDER_STATUS_CSS, SalesPeriodDto, ORDER_STATUS_LABELS, OrderPackageDto, OrderStatus, LoyaltyRewardDto } from '../../../core/models';
import { gsap } from 'gsap';
import * as QRCode from 'qrcode';
import { BirthdayCouponComponent } from '../../../shared/components/birthday-coupon/birthday-coupon.component';
import { CouponService } from '../../../core/services/coupon.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { GoogleAutocompleteDirective } from '../../../shared/directives/google-autocomplete.directive';
import { buildMessengerLink, buildOrderMessage } from '../../../core/utils/messenger.util';

type OrderDrawerTab = 'summary' | 'items' | 'delivery' | 'payment';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DatePipe, RouterLink, BirthdayCouponComponent, GoogleAutocompleteDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-4 animate-slide-down">
        <h1 class="text-2xl font-bold text-pink-900">📦 Pedidos</h1>
        <div class="flex gap-2">
          <label class="btn-coquette btn-outline-pink cursor-pointer">
            📤 Excel
            <input type="file" accept=".xlsx,.xls" class="hidden" (change)="uploadExcel($event)" />
          </label>
          <a routerLink="/admin/send-links" class="btn-coquette btn-outline-pink text-center align-middle inline-block">💌 Enviar Enlaces</a>
          <a routerLink="/admin/capture" class="btn-coquette btn-pink text-center align-middle inline-block">✨ Nuevo Pedido</a>
        </div>
      </div>

      <!-- Filters -->
      <div class="card-coquette p-4 animate-slide-up delay-100" style="opacity:0">
        <div class="flex flex-wrap gap-3 items-end">
          <div class="flex-1 min-w-[200px]">
            <label class="label-coquette">🔍 Buscar</label>
            <input class="input-coquette" placeholder="Clienta, artículo o #123..." [(ngModel)]="search" (input)="loadOrders()" />
          </div>
          <div>
            <label class="label-coquette">📋 Estado</label>
            <select class="input-coquette" [(ngModel)]="statusFilter" (change)="loadOrders()">
              <option value="">Todos</option>
              <option value="Pending">⏳ Pendiente</option>
              <option value="Confirmed">💖 Confirmado</option>
              <option value="InRoute">🚗 En Ruta</option>
              <option value="Delivered">✅ Entregado</option>
              <option value="NotDelivered">❌ No Entregado</option>
              <option value="Canceled">🚫 Cancelado</option>
              <option value="Postponed">📅 Pospuesto</option>
            </select>
          </div>
          <div>
            <label class="label-coquette">🚗 Tipo</label>
            <select class="input-coquette" [(ngModel)]="orderTypeFilter" (change)="loadOrders()">
              <option value="">Todos</option>
              <option value="Delivery">Domicilio</option>
              <option value="PickUp">Recoger</option>
            </select>
          </div>
          <div>
            <label class="label-coquette">🎀 Clienta</label>
            <select class="input-coquette" [(ngModel)]="typeFilter" (change)="loadOrders()">
              <option value="">Todas</option>
              <option value="Nueva">Nueva</option>
              <option value="Frecuente">Frecuente</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Order Stats Bar -->
      @if (totalCount() > 0) {
        <div class="text-sm text-pink-400 font-medium animate-fade-in">
          Mostrando {{ orders().length }} de {{ totalCount() }} pedidos 💕
        </div>
      }

      <!-- Orders List -->
      @if (loading()) {
        <div class="space-y-3">
          @for (i of [1,2,3]; track i) {
            <div class="shimmer h-24 rounded-2xl"></div>
          }
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7 pb-8">
          @for (order of orders(); track order.id; let i = $index) {
            <div class="order-card-anim group relative rounded-[1.75rem] p-[1px] bg-gradient-to-br from-pink-200/60 via-white to-rose-200/60 hover:from-pink-300/80 hover:to-rose-300/80 transition-all duration-500 opacity-0 translate-y-8">
              <div class="relative bg-white/90 backdrop-blur-xl rounded-[1.7rem] p-6 flex flex-col h-full shadow-[0_8px_32px_rgba(244,114,182,0.08),0_2px_8px_rgba(0,0,0,0.04)] group-hover:shadow-[0_20px_50px_rgba(244,114,182,0.18),0_8px_20px_rgba(0,0,0,0.06)] transition-shadow duration-500">
              
                <!-- Card Header -->
                <div class="flex justify-between items-start mb-4">
                  <div class="flex flex-col gap-1.5">
                    <span class="text-[10px] font-black text-pink-400 tracking-[0.2em] uppercase">Pedido #{{ order.id }}</span>
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-gradient-to-r from-pink-50 to-rose-50 text-pink-600 border border-pink-100/60 shadow-sm">
                      {{ order.orderType === 'Delivery' ? '🚗 Domicilio' : '🏪 Recoger' }}
                    </span>
                  </div>
                  <span class="badge shadow-sm status-badge" [class]="getStatusClass(order.status)" [attr.data-id]="order.id">
                    {{ getStatusLabel(order.status) }}
                  </span>
                </div>

                <!-- Main Info -->
                <div class="flex-1 mb-5">
                  <p class="text-lg font-black text-pink-900 leading-tight">
                    {{ order.clientName }}
                    <span class="ml-2 px-2.5 py-0.5 text-[9px] rounded-full font-black uppercase tracking-wider shadow-sm border"
                          [class]="order.type === 'Frecuente' ? 'bg-gradient-to-r from-purple-50 to-violet-50 text-purple-600 border-purple-200' : 'bg-gradient-to-r from-sky-50 to-blue-50 text-blue-600 border-blue-200'">
                      {{ order.type === 'Frecuente' ? 'Frecuente' : 'Nueva' }}
                    </span>
                  </p>
                  @if (order.clientAddress) {
                    <p class="text-xs text-pink-500/60 mt-1.5 flex items-start gap-1">
                      <span class="text-pink-400 shrink-0">📍</span>
                      <span class="line-clamp-2" title="{{ order.clientAddress }}">{{ order.clientAddress }}</span>
                    </p>
                  }
                  <p class="text-[10px] text-pink-300 mt-2.5 flex items-center gap-1 font-medium">
                    📅 {{ order.createdAt | date:'dd MMM yyyy, HH:mm' }}
                  </p>
                  @if (order.scheduledDeliveryDate) {
                    <p class="text-[10px] text-pink-600 mt-1 flex items-center gap-1 font-black">
                      🚚 Entrega: {{ order.scheduledDeliveryDate | date:'dd MMM yyyy' }}
                    </p>
                  }

                  <!-- 🛍️ Bolsas: badge + quick-set inline -->
                  <div class="mt-2.5">
                    @if (bagsEditFor() === order.id) {
                      <div class="bg-pink-50/70 rounded-xl p-2 border border-pink-200 flex flex-wrap gap-1.5 items-center animate-[fadeIn_.15s_ease]">
                        <span class="text-[9px] font-black text-pink-500 uppercase w-full mb-0.5">🛍️ ¿Cuántas bolsas?</span>
                        @for (n of [1,2,3,4,5]; track n) {
                          <button class="w-7 h-7 rounded-lg font-black text-xs bg-white text-pink-500 border border-pink-100 hover:bg-pink-500 hover:text-white transition-all active:scale-90 disabled:opacity-50"
                                  [disabled]="savingQuickBags()" (click)="saveQuickBags(order, n)">{{ n }}</button>
                        }
                        <button class="w-7 h-7 rounded-lg font-black text-sm bg-white text-pink-500 border border-pink-100 hover:bg-pink-500 hover:text-white transition-all active:scale-90 disabled:opacity-50"
                                [disabled]="savingQuickBags()" (click)="saveQuickBags(order, 6)">＋</button>
                        <button class="px-2 h-7 rounded-lg font-bold text-[10px] bg-white text-purple-500 border border-purple-100 hover:bg-purple-500 hover:text-white transition-all active:scale-90 disabled:opacity-50"
                                [disabled]="savingQuickBags()" (click)="saveQuickBags(order, 0)">Sin bolsas</button>
                        <button class="px-2 h-7 rounded-lg font-bold text-[10px] text-pink-300 hover:text-pink-500 transition-all ml-auto"
                                [disabled]="savingQuickBags()" (click)="bagsEditFor.set(null)">✕</button>
                      </div>
                    } @else if (order.packagesConfirmed) {
                      <button class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200/60 hover:bg-emerald-100 transition-all"
                              (click)="bagsEditFor.set(order.id)" title="Editar bolsas">
                        🛍️ {{ (order.totalPackages ?? 0) === 0 ? 'Sin bolsas' : order.totalPackages + ' bolsa' + (order.totalPackages === 1 ? '' : 's') }}
                      </button>
                    } @else {
                      <button class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-500 border border-rose-200 hover:bg-rose-100 transition-all animate-pulse-pink"
                              (click)="bagsEditFor.set(order.id)" title="Agregar bolsas">
                        🛍️ ¿Cuántas bolsas?
                      </button>
                    }
                  </div>
                </div>

                <!-- Financials & Progress -->
                <div class="bg-gradient-to-br from-pink-50/70 via-rose-50/40 to-purple-50/30 rounded-2xl p-4 mb-5 border border-pink-100/40 group-hover:border-pink-200/60 transition-colors shadow-inner shadow-pink-100/20">
                  <div class="flex justify-between items-end mb-2.5">
                    <div>
                      <p class="text-[10px] text-pink-400 font-bold mb-1 uppercase tracking-wider">Total <span class="text-pink-300">({{ order.itemsCount }} arts)</span></p>
                      <p class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600">
                        {{ order.total | currency:'MXN':'symbol-narrow':'1.0-0' }}
                      </p>
                    </div>
                    <div class="text-right">
                      @if (order.balanceDue > 0) {
                        <p class="text-[10px] font-black text-rose-500 bg-rose-50/80 border border-rose-200/60 px-2.5 py-1 rounded-xl inline-block shadow-sm">
                          Resta: {{ order.balanceDue | currency:'MXN':'symbol-narrow':'1.0-0' }}
                        </p>
                      } @else if (order.amountPaid > 0) {
                        <p class="text-[10px] font-black text-emerald-600 bg-emerald-50/80 border border-emerald-200/60 px-2.5 py-1 rounded-xl inline-block shadow-sm">
                          ✅ Pagado
                        </p>
                      }
                    </div>
                  </div>

                  @if (order.total > 0) {
                    <div class="w-full h-2 bg-pink-100/40 rounded-full overflow-hidden mt-1 shadow-inner">
                      <div class="h-full rounded-full transition-all duration-700 ease-out"
                           [style.width]="getPaymentPercent(order) + '%'"
                           [class]="getPaymentPercent(order) >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-300 shadow-sm shadow-emerald-200' : 'bg-gradient-to-r from-pink-400 via-rose-400 to-pink-500 shadow-sm shadow-pink-200'"></div>
                    </div>
                  }

                  @if (search && getMatchingItems(order).length > 0) {
                    <div class="mt-3 pt-2 border-t border-pink-100/40">
                      <p class="text-[9px] font-black text-pink-400 uppercase tracking-wider mb-1.5">🎯 Artículos encontrados</p>
                      <div class="flex flex-wrap gap-1">
                        @for (item of getMatchingItems(order).slice(0, 3); track item.id) {
                          <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gradient-to-r from-amber-50 to-orange-50 text-orange-700 border border-orange-200/60 shadow-sm">
                            🛍️ {{ item.productName }}
                          </span>
                        }
                        @if (getMatchingItems(order).length > 3) {
                          <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-pink-50 text-pink-500 border border-pink-200/60">
                            +{{ getMatchingItems(order).length - 3 }} más
                          </span>
                        }
                      </div>
                    </div>
                  }
                </div>

                <!-- Actions (Bottom) -->
                <div class="flex flex-col gap-2.5 mt-auto">
                  <button class="btn-coquette btn-pink w-full py-3 shadow-md shadow-pink-200/30 hover:shadow-lg hover:shadow-pink-300/40 transition-all flex justify-center items-center gap-2 group/btn text-sm" (click)="selectOrder(order)">
                    <span class="group-hover/btn:scale-125 group-hover/btn:rotate-12 transition-transform duration-300">✨</span> <span class="font-black">Administrar</span>
                  </button>
                  <div class="grid grid-cols-2 gap-2">
                    @if (order.status === 'Pending') {
                      <button class="btn-coquette btn-outline-pink w-full py-2.5 text-xs font-black bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all" (click)="updateStatus(order.id, 'Confirmed')">💖 Confirmar</button>
                    }
                    @if (order.status === 'Pending' || order.status === 'Confirmed') {
                      <button class="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200/60 text-rose-400 hover:text-rose-600 hover:from-rose-100 hover:to-pink-100 hover:border-rose-300 rounded-2xl font-black w-full py-2.5 text-xs transition-all shadow-sm hover:shadow-md active:scale-95" (click)="updateStatus(order.id, 'Canceled')">🚫 Cancelar</button>
                    }
                  </div>
                </div>
              </div>
              
              <!-- Floating Delete Icon -->
              <button class="absolute -top-2.5 -right-2.5 w-8 h-8 bg-white text-pink-300 hover:text-rose-500 hover:bg-rose-50 rounded-full shadow-lg shadow-pink-200/20 border border-pink-100/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 scale-75 hover:scale-110 active:scale-90" 
                      title="Eliminar pedido" (click)="deleteOrder(order.id)">
                🗑️
              </button>
            </div>
          }
        </div>

        @if (orders().length === 0) {
          <div class="card-coquette p-12 text-center animate-bounce-in">
            <p class="text-4xl mb-3">🎀</p>
            <p class="text-pink-400 font-medium">No se encontraron pedidos</p>
            <p class="text-pink-300 text-sm mt-1">¡Crea uno nuevo o ajusta los filtros!</p>
          </div>
        }

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <div class="flex items-center justify-center gap-2 mt-6">
            <button class="btn-coquette btn-ghost text-sm" [disabled]="currentPage() <= 1" (click)="goToPage(currentPage() - 1)">← Anterior</button>
            <span class="text-sm text-pink-400 font-medium px-3">{{ currentPage() }} / {{ totalPages() }}</span>
            <button class="btn-coquette btn-ghost text-sm" [disabled]="currentPage() >= totalPages()" (click)="goToPage(currentPage() + 1)">Siguiente →</button>
          </div>
        }
      }

      <!-- Smart Order Drawer -->
      @if (selectedOrder() && drawerOpen()) {
        <div class="fixed inset-0 z-[90] bg-gradient-to-r from-pink-900/10 to-pink-800/20 backdrop-blur-[6px] transition-opacity" (click)="closeDrawer()"></div>
        
        <aside role="dialog" aria-modal="true" aria-label="Detalle del pedido" class="fixed inset-y-0 right-0 z-[100] w-full md:w-[560px] lg:w-[680px] bg-gradient-to-b from-white via-pink-50/20 to-rose-50/30 backdrop-blur-2xl shadow-[-20px_0_60px_-10px_rgba(236,72,153,0.15)] transform transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex flex-col rounded-l-[2rem] overflow-hidden border-l border-pink-100/30"
             [class.translate-x-0]="drawerOpen()" [class.translate-x-full]="!drawerOpen()">
             
          <!-- Header -->
          <div class="px-6 py-5 border-b border-pink-100/50 flex items-center justify-between bg-gradient-to-r from-pink-100/60 via-rose-50/40 to-purple-50/30">
            <div class="flex-1">
              <h2 class="text-xl font-black text-pink-900 flex items-center gap-2">
                <span class="text-2xl">📦</span> Pedido #{{ selectedOrder()!.id }}
              </h2>
              <div class="mt-2 flex flex-col gap-1">
                <div class="flex items-center gap-2 group cursor-pointer bg-white/60 backdrop-blur-sm rounded-xl px-3 py-2 border border-pink-100/50 shadow-sm hover:shadow-md hover:border-pink-200 transition-all" (click)="toggleClientEdit()" title="Click para editar datos de clienta">
                  <div class="w-8 h-8 rounded-full bg-gradient-to-br from-pink-200 to-rose-300 flex items-center justify-center text-sm shadow-sm">👤</div>
                  <p class="text-sm text-pink-800 font-bold truncate flex-1">{{ selectedOrder()!.clientName }}</p>
                  <span class="text-[10px] text-pink-300 opacity-0 group-hover:opacity-100 transition-opacity">✏️ editar</span>
                </div>
                
                @if (showClientEdit()) {
                  <div class="mt-2 space-y-2 bg-white/70 backdrop-blur-sm p-4 rounded-2xl border border-pink-100 shadow-sm animate-slide-down">
                    <input class="input-coquette" [(ngModel)]="editClientData.name" placeholder="Nombre completo" />
                    <input class="input-coquette" [(ngModel)]="editClientData.phone" placeholder="Teléfono" />
                    <textarea class="input-coquette" [(ngModel)]="editClientData.address" placeholder="Dirección" rows="2"
                              appGoogleAutocomplete (placeChanged)="onAddressSelected($event)"></textarea>
                    <textarea class="input-coquette" [(ngModel)]="editClientData.alternativeAddress" placeholder="Dirección Alternativa" rows="2"
                              appGoogleAutocomplete (placeChanged)="onAltAddressSelected($event)"></textarea>
                    <textarea class="input-coquette" [(ngModel)]="editClientData.deliveryInstructions" placeholder="Instrucciones de entrega (Clienta)" rows="2"></textarea>
                    <div class="relative">
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[#0099FF] text-sm">𝓶</span>
                      <input class="input-coquette pl-8" [(ngModel)]="editClientData.facebookProfileUrl" placeholder="URL del perfil de Facebook (para Messenger)" />
                    </div>
                    <select class="input-coquette" [(ngModel)]="editClientData.type">
                      <option value="Nueva">Nueva</option>
                      <option value="Frecuente">Frecuente</option>
                    </select>
                    <div class="flex justify-end gap-2">
                      <button class="text-[10px] font-bold text-pink-400 hover:text-pink-600" (click)="toggleClientEdit()">Cancelar</button>
                      <button class="btn-coquette btn-pink py-1.5 px-4 text-[10px] shadow-sm" (click)="saveQuickClientEdit()">Guardar 💖</button>
                    </div>
                  </div>
                }
              </div>
            </div>
            <button class="w-9 h-9 flex shrink-0 items-center justify-center rounded-full bg-white/80 text-pink-400 hover:bg-pink-100 hover:text-pink-600 transition-all shadow-sm border border-pink-100/50 ml-4" (click)="closeDrawer()">✕</button>
          </div>

          <nav class="px-4 sm:px-6 py-3 bg-white/70 border-b border-pink-100/60 grid grid-cols-4 gap-1.5" aria-label="Secciones del pedido">
            <button type="button" class="rounded-xl px-2 py-2 text-[11px] font-black transition-all"
                    [class]="drawerTab() === 'summary' ? 'bg-pink-500 text-white shadow-sm' : 'text-pink-400 hover:bg-pink-50'"
                    [attr.aria-pressed]="drawerTab() === 'summary'" (click)="setDrawerTab('summary')">Resumen</button>
            <button type="button" class="rounded-xl px-2 py-2 text-[11px] font-black transition-all"
                    [class]="drawerTab() === 'items' ? 'bg-pink-500 text-white shadow-sm' : 'text-pink-400 hover:bg-pink-50'"
                    [attr.aria-pressed]="drawerTab() === 'items'" (click)="setDrawerTab('items')">Artículos <span class="opacity-80">{{ selectedOrder()!.itemsCount }}</span></button>
            <button type="button" class="rounded-xl px-2 py-2 text-[11px] font-black transition-all"
                    [class]="drawerTab() === 'delivery' ? 'bg-pink-500 text-white shadow-sm' : 'text-pink-400 hover:bg-pink-50'"
                    [attr.aria-pressed]="drawerTab() === 'delivery'" (click)="setDrawerTab('delivery')">Entrega</button>
            <button type="button" class="rounded-xl px-2 py-2 text-[11px] font-black transition-all"
                    [class]="drawerTab() === 'payment' ? 'bg-pink-500 text-white shadow-sm' : 'text-pink-400 hover:bg-pink-50'"
                    [attr.aria-pressed]="drawerTab() === 'payment'" (click)="setDrawerTab('payment')">Cobro</button>
          </nav>

          <!-- Scrollable Body -->
          <div class="flex-1 overflow-y-auto w-full px-4 sm:px-6 py-4 sm:py-5 space-y-4 scrollbar-hide">
            
            <!-- Resumen -->
            @if (drawerTab() === 'summary') {
            <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-pink-100/50 shadow-sm">
              <div class="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h4 class="text-xs font-black text-pink-600 uppercase tracking-widest">🎀 Estatus del pedido</h4>
                  <p class="text-[10px] text-pink-400 mt-1">Selecciona el estado actual; se guarda al instante.</p>
                </div>
                <span class="px-2.5 py-1 rounded-full bg-pink-50 text-pink-600 text-[10px] font-black border border-pink-100">{{ getStatusLabel(selectedOrder()!.status) }}</span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button type="button" class="px-3 py-2.5 rounded-xl text-xs font-bold transition-all border"
                        [class]="selectedOrder()!.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white/60 text-pink-400 border-pink-100 hover:bg-amber-50'"
                        (click)="updateStatus(selectedOrder()!.id, 'Pending')">{{ getStatusLabel('Pending') }}</button>
                <button type="button" class="px-3 py-2.5 rounded-xl text-xs font-bold transition-all border"
                        [class]="selectedOrder()!.status === 'Confirmed' ? 'bg-pink-100 text-pink-700 border-pink-200' : 'bg-white/60 text-pink-400 border-pink-100 hover:bg-pink-50'"
                        (click)="updateStatus(selectedOrder()!.id, 'Confirmed')">{{ getStatusLabel('Confirmed') }}</button>
                <button type="button" class="px-3 py-2.5 rounded-xl text-xs font-bold transition-all border"
                        [class]="selectedOrder()!.status === 'Shipped' ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-white/60 text-pink-400 border-pink-100 hover:bg-violet-50'"
                        (click)="updateStatus(selectedOrder()!.id, 'Shipped')">{{ getStatusLabel('Shipped') }}</button>
                <button type="button" class="px-3 py-2.5 rounded-xl text-xs font-bold transition-all border"
                        [class]="selectedOrder()!.status === 'InRoute' ? 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' : 'bg-white/60 text-pink-400 border-pink-100 hover:bg-fuchsia-50'"
                        (click)="updateStatus(selectedOrder()!.id, 'InRoute')">{{ getStatusLabel('InRoute') }}</button>
                <button type="button" class="px-3 py-2.5 rounded-xl text-xs font-bold transition-all border"
                        [class]="selectedOrder()!.status === 'Delivered' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-white/60 text-pink-400 border-pink-100 hover:bg-purple-50'"
                        (click)="updateStatus(selectedOrder()!.id, 'Delivered')">{{ getStatusLabel('Delivered') }}</button>
                <button type="button" class="px-3 py-2.5 rounded-xl text-xs font-bold transition-all border"
                        [class]="selectedOrder()!.status === 'NotDelivered' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-white/60 text-pink-400 border-pink-100 hover:bg-rose-50'"
                        (click)="updateStatus(selectedOrder()!.id, 'NotDelivered')">{{ getStatusLabel('NotDelivered') }}</button>
              </div>
            </div>

            @if (selectedOrder()!.status === 'NotDelivered') {
              <div class="rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div class="flex-1">
                  <p class="text-sm font-black text-rose-700">Esta entrega no se completó</p>
                  <p class="text-[11px] text-rose-500 mt-0.5">Libérala para que vuelva a aparecer al crear una nueva ruta.</p>
                </div>
                <button type="button" class="btn-coquette btn-pink py-2 px-4 text-xs shrink-0" (click)="releaseOrderForRoute()">Preparar reintento</button>
              </div>
            }
            }

            <!-- Delivery & Period Toggles -->
            @if (drawerTab() === 'delivery') {
            <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-pink-100/50 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-pink-900 mb-2 uppercase">Tipo de Entrega</label>
                <div class="flex bg-pink-50/50 p-1 rounded-xl border border-pink-100 shadow-inner">
                  <button class="flex-1 py-1.5 text-sm font-medium rounded-lg transition-all hover:scale-[1.02] active:scale-95"
                          [class]="selectedOrder()!.orderType === 'Delivery' ? 'bg-white text-pink-700 shadow-sm ring-1 ring-pink-200' : 'text-pink-400 hover:text-pink-600 focus:bg-pink-100/50'"
                          (click)="changeOrderType('Delivery')">🛵 A Domicilio</button>
                  <button class="flex-1 py-1.5 text-sm font-medium rounded-lg transition-all hover:scale-[1.02] active:scale-95"
                          [class]="selectedOrder()!.orderType === 'PickUp' ? 'bg-white text-purple-700 shadow-sm ring-1 ring-purple-200' : 'text-pink-400 hover:text-purple-600 focus:bg-pink-100/50'"
                          (click)="changeOrderType('PickUp')">🛍️ Pick Up</button>
                </div>
              </div>
              
              <div>
                <label class="block text-xs font-bold text-pink-900 mb-2 uppercase">Corte de Venta</label>
                <select class="input-coquette h-[42px] py-1 shadow-sm border-pink-100" [ngModel]="selectedOrder()!.salesPeriodId || 'null'" (change)="changeSalesPeriod($event)">
                  <option value="null">— Sin asignar —</option>
                  @for (p of salesPeriods(); track p.id) {
                    <option [value]="p.id">{{ p.isActive ? '🟢 ' : '' }}{{ p.name }}</option>
                  }
                </select>
              </div>
            </div>

            <!-- Scheduled Delivery Date -->
            <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-pink-100/50 shadow-sm">
                <h4 class="text-xs font-black text-pink-600 mb-2 uppercase tracking-widest flex items-center gap-2">📅 Fecha de Entrega Programada</h4>
                <div class="flex items-center gap-2">
                    <input type="date" class="input-coquette text-xs py-2 grow" 
                           [ngModel]="selectedOrder()!.scheduledDeliveryDate?.substring(0, 10)" 
                           (change)="updateScheduledDate($event)">
                    @if (selectedOrder()!.scheduledDeliveryDate) {
                        <button class="text-pink-300 hover:text-rose-500 p-1" (click)="clearScheduledDate()" title="Quitar fecha programada">✕</button>
                    }
                </div>
                <p class="text-[9px] text-pink-400 mt-1">Si se asigna, el enlace vencerá 2 días después de esta fecha.</p>
            </div>

            <!-- Delivery Instructions & Alternative Address -->
            <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-pink-100/50 shadow-sm space-y-4">
                <div>
                  <h4 class="text-xs font-black text-pink-600 mb-2 uppercase tracking-widest flex items-center gap-2">📍 Instrucciones de Entrega (Este Pedido)</h4>
                  <textarea class="input-coquette text-xs py-2 w-full" 
                            [(ngModel)]="selectedOrder()!.deliveryInstructions" 
                            placeholder="Instrucciones específicas para este pedido..."
                            rows="2"
                            (change)="updateOrderInstructions()"></textarea>
                </div>

                <div>
                  <h4 class="text-xs font-black text-pink-600 mb-2 uppercase tracking-widest flex items-center gap-2">🏠 Dirección Alternativa</h4>
                  <input class="input-coquette text-xs py-2 w-full" 
                            [(ngModel)]="selectedOrder()!.alternativeAddress" 
                            placeholder="Ej. Casa de su mamá / Oficina..."
                            (change)="updateOrderInstructions()">
                </div>
            </div>

            <!-- Shipping Cost Editor -->
            <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-pink-100/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p class="text-[10px] font-black text-pink-500 uppercase tracking-widest flex items-center gap-1">🚚 Costo de Envío</p>
                <p class="text-sm font-bold text-pink-900 mt-1">Actual: {{ selectedOrder()!.shippingCost | currency:'MXN':'symbol-narrow' }}</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-pink-400 font-bold">$</span>
                <input type="number" class="input-coquette py-1.5 px-2 text-sm w-24 text-center" 
                       [ngModel]="selectedOrder()!.shippingCost" 
                       #shippingCostInput>
                <button class="btn-coquette btn-pink px-3 py-1.5 text-xs shadow-md hover:shadow-lg transition-all"
                        (click)="updateShippingCost(shippingCostInput.value)">
                  Aplicar
                </button>
              </div>
            </div>

            }

            <!-- Artículos -->
            @if (drawerTab() === 'items') {
              <section class="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-pink-100/50 shadow-sm" aria-label="Artículos del pedido">
                <div class="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h4 class="text-xs font-black text-pink-600 uppercase tracking-widest flex items-center gap-2">🛍️ Artículos ({{ selectedOrder()!.itemsCount }})</h4>
                    <p class="text-[10px] text-pink-400 mt-1">Todo el pedido en una lista corta y fácil de editar.</p>
                  </div>
                  <button type="button" class="text-xs font-black text-pink-600 hover:text-pink-800 px-2 py-1 rounded-lg hover:bg-pink-50" (click)="toggleNewItemForm()">
                    {{ showNewItemForm() ? 'Cancelar' : '+ Agregar' }}
                  </button>
                </div>

                @if (showNewItemForm()) {
                  <div class="mb-3 p-3 rounded-xl bg-pink-50/70 border border-pink-100 grid grid-cols-1 sm:grid-cols-[1fr_96px_72px_58px] gap-2 items-center">
                    <input type="text" class="input-coquette py-2 text-sm" placeholder="Nombre del artículo" [(ngModel)]="newItemName">
                    <input type="number" class="input-coquette py-2 px-2 text-sm" placeholder="Precio" [(ngModel)]="newItemPrice" min="0">
                    <input type="number" class="input-coquette py-2 px-2 text-sm text-center" placeholder="Cant." [(ngModel)]="newItemQty" min="1">
                    <button class="btn-coquette btn-pink py-2 px-2 text-xs" [disabled]="!newItemName || newItemPrice <= 0 || newItemQty < 1" (click)="addNewItem()">Agregar</button>
                  </div>
                }

                <div class="divide-y divide-pink-100/80" [class.opacity-50]="isProcessingItem()" [class.pointer-events-none]="isProcessingItem()">
                  @for (item of visibleOrderItems(); track item.id) {
                    <div class="py-3 first:pt-1">
                      <div class="flex items-center gap-2">
                        <input type="text" [(ngModel)]="item.productName"
                               (change)="updateItemQty(item.id, item.quantity, item.productName, item.unitPrice)"
                               class="min-w-0 flex-1 bg-transparent border-b border-transparent hover:border-pink-200 focus:border-pink-400 focus:bg-pink-50/60 transition-all font-bold text-pink-900 text-sm outline-none px-1 py-1"
                               placeholder="Nombre del artículo">
                        <button type="button" class="w-8 h-8 rounded-full text-pink-300 hover:text-rose-500 hover:bg-rose-50 transition-all shrink-0" (click)="removeItem(item.id)" [attr.aria-label]="'Eliminar ' + item.productName">🗑️</button>
                      </div>
                      <div class="mt-2 flex items-center justify-between gap-3">
                        <div class="inline-flex items-center rounded-xl border border-pink-100 bg-white overflow-hidden">
                          <button type="button" class="w-8 h-8 text-pink-500 hover:bg-pink-50 font-black" (click)="updateItemQty(item.id, item.quantity - 1, item.productName, item.unitPrice)" [attr.aria-label]="'Reducir ' + item.productName">−</button>
                          <span class="w-8 text-center text-sm font-black text-pink-900 border-x border-pink-100">{{ item.quantity }}</span>
                          <button type="button" class="w-8 h-8 text-pink-500 hover:bg-pink-50 font-black" (click)="updateItemQty(item.id, item.quantity + 1, item.productName, item.unitPrice)" [attr.aria-label]="'Aumentar ' + item.productName">+</button>
                        </div>
                        <div class="flex items-center gap-2">
                          <label class="text-[10px] text-pink-400">$ <input type="number" [(ngModel)]="item.unitPrice" step="0.5" (change)="updateItemQty(item.id, item.quantity, item.productName, item.unitPrice)" class="w-16 bg-transparent border-b border-pink-100 focus:border-pink-400 text-right text-xs font-bold text-pink-600 outline-none"> c/u</label>
                          <span class="min-w-16 text-right font-black text-pink-700 text-sm">{{ item.lineTotal | currency:'MXN':'symbol-narrow' }}</span>
                        </div>
                      </div>
                    </div>
                  }
                </div>

                @if (hasHiddenOrderItems()) {
                  <button type="button" class="mt-3 w-full py-2 rounded-xl text-xs font-black text-pink-500 hover:bg-pink-50 transition-colors" (click)="showRemainingOrderItems()">Ver {{ hiddenOrderItemsCount() }} artículo(s) más</button>
                }
              </section>
            }

            <!-- Logística (Bolsas Anti-Pérdidas) -->
            @if (drawerTab() === 'delivery') {
            <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-pink-100/50 shadow-sm mb-5">
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-xs font-black text-pink-600 uppercase tracking-widest flex items-center gap-2">🏷️ Logística y Etiquetas</h4>
                @if (packages().length > 1) {
                  <button class="bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 hover:from-purple-200 hover:to-indigo-200 border border-purple-200 px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1 shadow-sm transition-all animate-pulse-pink" (click)="printAllLabels()">
                    Imprimir Todas ({{ packages().length }}) 🖨️✨
                  </button>
                }
              </div>
              
              @if (isLoadingPackages()) {
                <div class="shimmer h-12 rounded-xl w-full"></div>
              } @else {
                <div class="space-y-2 mb-4">
                  @for (pkg of packages(); track pkg.id) {
                    <div class="flex items-center justify-between p-2.5 bg-white/80 rounded-xl border border-pink-100 shadow-sm transition-all hover:shadow-md hover:border-pink-200">
                      <div class="flex gap-2 items-center">
                        <span class="text-xl">🛍️</span>
                        <div>
                          <p class="text-xs font-bold text-pink-900">Bolsa {{ pkg.packageNumber }}</p>
                          <p class="text-[9px] text-pink-400 font-medium font-mono truncate w-24">{{ pkg.qrCodeValue }}...</p>
                        </div>
                      </div>
                      <button class="bg-gradient-to-r from-pink-100 to-rose-100 text-pink-600 hover:from-pink-200 hover:to-rose-200 border border-pink-200 px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 shadow-sm transition-all" (click)="printLabel(pkg, selectedOrder()!)">
                        🖨️ Imprimir
                      </button>
                    </div>
                  }
                </div>

                <div class="flex items-center gap-2 bg-pink-50/50 p-3 rounded-xl border border-pink-100">
                  <div class="flex flex-col grow">
                    <p class="text-[9px] font-black text-pink-400 uppercase mb-1">Deseas agregar más?</p>
                    <div class="flex gap-2">
                       <input type="number" class="input-coquette py-1.5 px-3 w-20 text-sm text-center" [(ngModel)]="packagesToGenerate" min="1" />
                       <button class="btn-coquette btn-pink text-[10px] shadow-sm grow py-2 font-black" (click)="generatePackages(packagesToGenerate)">
                         {{ packages().length > 0 ? '+ Agregar Bolsas' : 'Generar Bolsas' }}
                       </button>
                    </div>
                  </div>
                </div>
              }
            </div>
            }

            <!-- Quick Payments -->
            @if (drawerTab() === 'payment') {
            <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-pink-100/50 shadow-sm">
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-xs font-black text-pink-600 uppercase tracking-widest flex items-center gap-2">💰 Cobros Express</h4>
                <div class="text-right bg-rose-50/80 px-3 py-1.5 rounded-xl border border-rose-100/50">
                  <p class="text-[9px] text-rose-400 font-bold uppercase tracking-wider">Restante</p>
                  <p class="text-base font-black text-rose-600">{{ selectedOrder()!.balanceDue | currency:'MXN':'symbol-narrow' }}</p>
                </div>
              </div>
              
              <div class="flex gap-2">
                <div class="relative flex-1">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400 font-bold text-lg">$</span>
                  <input type="number" class="input-coquette w-full py-2.5 pl-11 pr-3 font-bold text-pink-800 bg-white/80 border-pink-200/50 focus:border-pink-400 focus:ring-pink-100" 
                         [(ngModel)]="paymentAmount" placeholder="Ej. 150" min="1" step="0.5">
                </div>
                <div class="relative">
                  <input type="date" class="input-coquette py-2.5 px-3 text-sm text-pink-800 bg-white/80 border-pink-200/50 focus:border-pink-400" 
                         [(ngModel)]="paymentDate" title="Fecha real del pago">
                </div>
              </div>
              <p class="text-[9px] text-pink-400 mt-1">📅 Cambia la fecha si el pago fue en otro día</p>
              
              <div class="grid grid-cols-3 gap-2 mt-3">
                <button class="py-2.5 rounded-2xl border font-bold text-sm flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95"
                        [class]="paymentMethod === 'Efectivo' ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-md shadow-rose-100' : 'bg-white/60 border-pink-100/50 text-pink-400 hover:bg-rose-50 hover:text-rose-600'"
                        (click)="paymentMethod = 'Efectivo'; addPayment()">
                  <span class="text-xl">💵</span> <span class="text-[10px]">Efectivo</span>
                </button>
                <button class="py-2.5 rounded-2xl border font-bold text-sm flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95"
                        [class]="paymentMethod === 'Transferencia' ? 'bg-violet-50 border-violet-200 text-violet-700 shadow-md shadow-violet-100' : 'bg-white/60 border-pink-100/50 text-pink-400 hover:bg-violet-50 hover:text-violet-600'"
                        (click)="paymentMethod = 'Transferencia'; addPayment()">
                  <span class="text-xl">🏦</span> <span class="text-[10px]">Transf.</span>
                </button>
                <button class="py-2.5 rounded-2xl border font-bold text-sm flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95"
                        [class]="paymentMethod === 'Tarjeta' ? 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700 shadow-md shadow-fuchsia-100' : 'bg-white/60 border-pink-100/50 text-pink-400 hover:bg-fuchsia-50 hover:text-fuchsia-600'"
                        (click)="paymentMethod = 'Tarjeta'; addPayment()">
                  <span class="text-xl">💳</span> <span class="text-[10px]">Tarjeta</span>
                </button>
              </div>

              <!-- Payment History Inline -->
              @if (selectedOrder()!.payments.length) {
                <div class="mt-4 pt-3 border-t border-pink-100/50 space-y-2">
                  <p class="text-[9px] font-black text-pink-400 uppercase tracking-widest">💕 Historial de Pagos</p>
                  @for (p of selectedOrder()!.payments; track p.id) {
                    <div class="flex justify-between items-center text-sm bg-white/50 rounded-xl px-3 py-1.5">
                      <div class="flex flex-col">
                        <span class="text-pink-700 font-medium">{{ p.method }}</span>
                        <span class="text-pink-400 text-[10px]">📅 {{ p.date | date:'dd MMM yyyy' }}</span>
                      </div>
                      <span class="font-black text-pink-800">{{ p.amount | currency:'MXN':'symbol-narrow' }}</span>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Canje de RegiPuntos -->
            <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-violet-100/60 shadow-sm">
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-xs font-black text-violet-600 uppercase tracking-widest flex items-center gap-2">💎 Canjear RegiPuntos</h4>
                <div class="text-right bg-violet-50/80 px-3 py-1.5 rounded-xl border border-violet-100/50">
                  <p class="text-[9px] text-violet-400 font-bold uppercase tracking-wider">Saldo clienta</p>
                  <p class="text-base font-black text-violet-600">{{ selectedOrder()!.clientPoints ?? 0 }} pts</p>
                </div>
              </div>

              @if (rewards().length === 0) {
                <p class="text-[11px] text-pink-400 font-medium">Cargando premios…</p>
              } @else {
                <div class="space-y-2">
                  @for (r of rewards(); track r.id) {
                    @if (canAfford(r)) {
                      <button class="w-full flex items-center gap-3 p-3 rounded-2xl border border-violet-100/60 bg-white/70 hover:bg-violet-50 hover:border-violet-200 active:scale-[0.98] transition-all text-left disabled:opacity-50"
                              [disabled]="redeeming()"
                              (click)="redeemReward(r)">
                        <span class="text-2xl shrink-0">{{ r.icon || '🎁' }}</span>
                        <div class="flex-1 min-w-0">
                          <p class="font-black text-violet-900 text-sm leading-tight">{{ r.name }}</p>
                          <p class="text-[10px] text-violet-400 font-medium truncate">{{ r.description }}</p>
                        </div>
                        <span class="shrink-0 text-[11px] font-black text-white bg-gradient-to-r from-violet-500 to-pink-500 px-2.5 py-1 rounded-full">{{ r.pointsCost }} pts</span>
                      </button>
                    }
                  }
                  @if (!hasAnyAffordable()) {
                    <p class="text-[11px] text-pink-400 font-medium text-center py-2">Aún no alcanza para ningún premio. ¡Sigue sumando puntos! ✨</p>
                  }
                </div>
                <p class="text-[9px] text-violet-400/80 mt-2 text-center italic">El canje aplica un descuento al pedido y descuenta los puntos. Queda registrado en su historial.</p>
              }
            </div>
            }

            <div class="h-16"></div>
          </div>

          <!-- Quick WhatsApp Toolbar -->
          <div class="bg-white/90 backdrop-blur-xl border-t border-pink-100/50 p-4 shrink-0 flex items-center justify-between gap-2 shadow-[0_-4px_20px_rgba(236,72,153,0.08)]">
            <div class="flex flex-col">
              <span class="text-[9px] text-pink-400 font-black uppercase tracking-widest">Total</span>
              <span class="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-700 to-rose-600">{{ selectedOrder()!.total | currency:'MXN':'symbol-narrow' }}</span>
            </div>
            
            <div class="flex gap-1.5">
              <button class="w-10 h-10 rounded-2xl bg-purple-50 text-purple-500 hover:bg-purple-100 hover:text-purple-700 hover:scale-110 active:scale-95 flex items-center justify-center transition-all shadow-sm border border-purple-100/50" title="Copiar Enlace Público" (click)="copyLink()">🔗</button>
              <button class="w-10 h-10 rounded-2xl bg-[#e8f4ff] hover:bg-[#cce4ff] hover:scale-110 active:scale-95 flex items-center justify-center transition-all shadow-sm border border-[#b3d5f5]/50" title="Enviar por Messenger" (click)="sendMessenger()">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="#0099FF"><path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.672V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8.1l3.131 3.26 5.887-3.26-6.559 6.863z"/></svg>
              </button>
              <button class="w-10 h-10 rounded-2xl bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-700 hover:scale-110 active:scale-95 flex items-center justify-center transition-all shadow-sm border border-blue-100/50" title="En Camino" (click)="sendWaOnRoute()">🚗</button>
              <button class="w-10 h-10 rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-700 hover:scale-110 active:scale-95 flex items-center justify-center transition-all shadow-sm border border-rose-100/50" title="Cobrar" (click)="sendWaPaymentRequest()">💸</button>
              <button class="w-10 h-10 rounded-2xl bg-amber-50 text-amber-500 hover:bg-amber-100 hover:text-amber-700 hover:scale-110 active:scale-95 flex items-center justify-center transition-all shadow-sm border border-amber-100/50" title="Regalo Cumpleaños 🎂" (click)="applyBirthdayGift()">🎁</button>
            </div>
          </div>
        </aside>
      }

      <!-- Hidden Coupon for Capture -->
      <div style="position: fixed; left: -9999px; top: 0; z-index: -1;">
        @if (selectedOrder()) {
          <app-birthday-coupon #birthdayCoupon [clientName]="selectedOrder()!.clientName"></app-birthday-coupon>
        }
      </div>

      <!-- Print Preview Modal -->
      @if (showPrintPreview() && printHtml()) {
        <div class="fixed inset-0 z-[150] bg-pink-900/60 flex items-center justify-center p-2 md:p-4 animate-fade-in">
          <div class="bg-white rounded-[2rem] md:rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-[0_32px_64px_-12px_rgba(244,114,182,0.3)] border border-pink-100/50 flex flex-col animate-scale-up" style="max-height: 95vh; contain: content;">
            <!-- Modal Header -->
            <div class="px-8 py-6 bg-gradient-to-r from-pink-100/40 to-rose-50/40 border-b border-pink-100/40 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-pink-100">🖨️</div>
                <div>
                  <h3 class="text-xl font-black text-pink-900">Vista Previa</h3>
                  <p class="text-[10px] text-pink-400 font-bold uppercase tracking-wider">Confirma la etiqueta antes de imprimir</p>
                </div>
              </div>
              <button class="w-10 h-10 rounded-full bg-white text-pink-300 hover:text-pink-600 hover:bg-pink-50 transition-all shadow-sm flex items-center justify-center border border-pink-100" (click)="closePrintPreview()">✕</button>
            </div>

            <!-- Preview Body -->
            <div class="flex-1 overflow-auto p-4 md:p-12 bg-pink-50/30 flex justify-center items-start">
              <div class="bg-white shadow-2xl border-2 border-dashed border-pink-200 p-1 scale-75 md:scale-90 origin-top rounded-sm" 
                   [innerHTML]="safePrintHtml()" 
                   style="width: 100mm; min-height: 148mm; background: white;">
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="p-8 bg-white border-t border-pink-100/40 flex gap-4">
              <button class="flex-1 btn-coquette btn-outline-pink py-4 font-black text-sm" (click)="closePrintPreview()">Regresar ✨</button>
              <button class="flex-1 btn-coquette btn-pink py-4 font-black text-sm shadow-xl shadow-pink-200/50 flex items-center justify-center gap-2 group" (click)="executePrint()">
                <span class="text-xl group-hover:animate-bounce">🖨️</span> Imprimir Etiqueta
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class OrdersComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  private couponService = inject(CouponService);
  private signalr = inject(SignalRService);

  orders = signal<OrderSummaryDto[]>([]);
  loading = signal(true);
  totalCount = signal(0);
  currentPage = signal(1);
  pageSize = 20;

  search = '';
  statusFilter = '';
  orderTypeFilter = '';
  typeFilter = '';
  selectedOrder = signal<OrderSummaryDto | null>(null);

  // 🛍️ Quick-set de bolsas desde la tarjeta del Kanban (id del pedido en edición inline)
  bagsEditFor = signal<number | null>(null);
  savingQuickBags = signal(false);

  paymentAmount = 0;
  paymentMethod = 'Efectivo';
  paymentDate = '';  // Fecha real del pago (YYYY-MM-DD)

  /** Retorna la fecha de hoy como string YYYY-MM-DD en hora local */
  private getTodayLocal(): string {
    const now = new Date();
    return now.getFullYear() + '-'
      + String(now.getMonth() + 1).padStart(2, '0') + '-'
      + String(now.getDate()).padStart(2, '0');
  }

  // Drawer State
  drawerOpen = signal(false);
  drawerTab = signal<OrderDrawerTab>('items');
  showNewItemForm = signal(false);
  showAllOrderItems = signal(false);
  newItemName = '';
  newItemQty = 1;
  newItemPrice = 0;
  isProcessingItem = signal(false);
  salesPeriods = signal<SalesPeriodDto[]>([]);
  totalPages = signal(1);

  // Quick Client Edit
  showClientEdit = signal(false);
  editClientData = { name: '', phone: '', address: '', alternativeAddress: '', type: 'Nueva', deliveryInstructions: '', facebookProfileUrl: '' };

  // RegiPuntos (canje)
  rewards = signal<LoyaltyRewardDto[]>([]);
  redeeming = signal(false);

  // Logistics
  packages = signal<OrderPackageDto[]>([]);
  isLoadingPackages = signal(false);
  packagesToGenerate = 1;

  // Printing
  showPrintPreview = signal(false);
  printHtml = signal('');
  safePrintHtml = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.printHtml()));
  private printIframe?: HTMLIFrameElement;

  ngOnInit(): void {
    this.loadOrders();
    this.initSignalR();
    this.api.getSalesPeriods().subscribe({
      next: (periods) => this.salesPeriods.set(periods)
    });
    this.api.getLoyaltyRewards().subscribe({
      next: (r) => this.rewards.set(r),
      error: () => { /* el catálogo es opcional; no bloquea el panel */ }
    });
  }

  /** ¿La clienta del pedido tiene puntos suficientes para este premio? */
  canAfford(reward: LoyaltyRewardDto): boolean {
    const points = this.selectedOrder()?.clientPoints ?? 0;
    return points >= reward.pointsCost;
  }

  hasAnyAffordable(): boolean {
    return this.rewards().some(r => this.canAfford(r));
  }

  redeemReward(reward: LoyaltyRewardDto): void {
    const o = this.selectedOrder();
    if (!o || o.clientId == null || this.redeeming()) return;
    if (!confirm(`¿Canjear "${reward.name}" por ${reward.pointsCost} puntos? Se aplicará como descuento al pedido.`)) return;

    this.redeeming.set(true);
    this.api.redeemLoyaltyReward(o.clientId, o.id, reward.id).subscribe({
      next: () => {
        this.redeeming.set(false);
        this.toast.success(`Canjeado: ${reward.name} 💎✨`);
        this.reloadSelectedOrder();
        this.loadOrders();
      },
      error: (err) => {
        this.redeeming.set(false);
        this.toast.error(err?.error ?? 'No se pudo canjear');
      }
    });
  }

  initSignalR(): void {
    this.signalr.joinAdminGroup();
    this.signalr.deliveryUpdate$.subscribe({
      next: (data) => {
        // ✨ Sincronización Magistral recibida
        this.loadOrders();
        if (this.selectedOrder()?.id === data.orderId) {
          this.reloadSelectedOrder();
          this.loadPackages(data.orderId);
        }
      }
    });
  }

  loadOrders(): void {
    this.loading.set(true);
    this.api.getOrdersPaged(this.currentPage(), this.pageSize, this.statusFilter, this.search, this.orderTypeFilter, undefined, undefined, this.typeFilter).subscribe({
      next: (res) => {
        this.orders.set(res.items);
        this.totalCount.set(res.totalCount);
        this.totalPages.set(Math.ceil(res.totalCount / this.pageSize));
        this.loading.set(false);
        setTimeout(() => this.animateList(), 50);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error al cargar pedidos');
      }
    });
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadOrders();
  }

  getStatusClass(status: string): string {
    return 'badge ' + (ORDER_STATUS_CSS[status] || 'badge-pending');
  }

  getStatusLabel(status: string): string {
    const statusEnum = OrderStatus[status as keyof typeof OrderStatus] ?? -1;
    return ORDER_STATUS_LABELS[statusEnum] || status;
  }

  getPaymentPercent(order: OrderSummaryDto): number {
    if (order.total <= 0) return 100;
    return Math.min(100, (order.amountPaid / order.total) * 100);
  }

  /** Devuelve los artículos del pedido que coinciden con el término de búsqueda actual */
  getMatchingItems(order: OrderSummaryDto): typeof order.items {
    if (!this.search || !order.items?.length) return [];
    const term = this.search.toLowerCase().trim();
    return order.items.filter(i => i.productName.toLowerCase().includes(term));
  }

  updateStatus(id: number, status: string): void {
    if (this.selectedOrder()?.id === id
      && this.selectedOrder()?.status === 'NotDelivered'
      && status === 'Pending') {
      this.releaseOrderForRoute();
      return;
    }

    // Status Morph Animation Start
    const badge = document.querySelector(`.status-badge[data-id="${id}"]`);
    if (badge) {
      gsap.to(badge, {
        scale: 1.4,
        opacity: 0.5,
        duration: 0.3,
        ease: 'back.in(1.7)'
      });
    }

    this.api.updateOrderStatus(id, { status }).subscribe({
      next: (updatedOrder) => {
        if (this.selectedOrder()?.id === id) {
          this.selectedOrder.set(updatedOrder);
        }
        this.loadOrders();
        this.toast.success(`Estado actualizado a ${this.getStatusLabel(status)} ✨`);
      },
      error: () => this.toast.error('Error al actualizar estado')
    });
  }

  deleteOrder(id: number): void {
    if (!confirm('¿Estás segura de eliminar este pedido?')) return;
    this.api.deleteOrder(id).subscribe({
      next: () => { this.toast.success('Pedido eliminado 🗑️'); this.loadOrders(); },
      error: (err) => this.toast.error(err.error?.message || 'Error al eliminar')
    });
  }

  selectOrder(order: OrderSummaryDto): void {
    this.selectedOrder.set(order);
    this.reloadSelectedOrder();
    this.loadPackages(order.id);
    this.paymentAmount = 0;
    this.paymentDate = this.getTodayLocal(); // Pre-llenar con hoy
    this.drawerTab.set('items');
    this.showNewItemForm.set(false);
    this.showAllOrderItems.set(false);
    this.drawerOpen.set(true);
    this.resetNewItemForm();
    // Lock body scroll for mobile
    document.body.style.overflow = 'hidden';
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.showClientEdit.set(false);
    // Unlock body scroll
    document.body.style.overflow = '';
    setTimeout(() => this.selectedOrder.set(null), 500);
  }

  setDrawerTab(tab: OrderDrawerTab): void {
    this.drawerTab.set(tab);
  }

  toggleNewItemForm(): void {
    this.showNewItemForm.update(value => !value);
  }

  visibleOrderItems(): OrderItemDto[] {
    const items = this.selectedOrder()?.items ?? [];
    return this.showAllOrderItems() ? items : items.slice(0, 6);
  }

  hasHiddenOrderItems(): boolean {
    const items = this.selectedOrder()?.items ?? [];
    return !this.showAllOrderItems() && items.length > 6;
  }

  hiddenOrderItemsCount(): number {
    const items = this.selectedOrder()?.items ?? [];
    return Math.max(0, items.length - 6);
  }

  showRemainingOrderItems(): void {
    this.showAllOrderItems.set(true);
  }

  releaseOrderForRoute(): void {
    const order = this.selectedOrder();
    if (!order || order.status !== 'NotDelivered') return;
    if (!confirm(`¿Preparar el pedido #${order.id} para volverlo a agregar a una ruta?`)) return;

    this.api.releaseOrderForRoute(order.id).subscribe({
      next: (updatedOrder) => {
        this.selectedOrder.set(updatedOrder);
        this.orders.update(list => list.map(item => item.id === updatedOrder.id ? updatedOrder : item));
        this.drawerTab.set('summary');
        this.toast.success('Pedido liberado y listo para una nueva ruta ✨');
        this.loadOrders();
      },
      error: (error: { error?: string }) => {
        this.toast.error(error.error ?? 'No se pudo preparar el pedido para reintento');
      }
    });
  }

  resetNewItemForm(): void {
    this.newItemName = '';
    this.newItemQty = 1;
    this.newItemPrice = 0;
  }

  changeOrderType(type: string): void {
    const order = this.selectedOrder();
    if (!order || order.orderType === type) return;

    const newShippingCost = type === 'PickUp' ? 0 : 60;
    const newTotal = order.subtotal + newShippingCost;
    const updatedOrder = { ...order, orderType: type, shippingCost: newShippingCost, total: newTotal };

    this.selectedOrder.set(updatedOrder);
    this.orders.update(list => list.map(o => o.id === order.id ? updatedOrder : o));

    this.api.updateOrderStatus(order.id, { orderType: type }).subscribe({
      next: () => {
        this.toast.success('Tipo de entrega actualizado 🚚');
        this.reloadSelectedOrder();
      },
      error: () => {
        this.toast.error('Error al actualizar entrega');
        this.reloadSelectedOrder();
        this.loadOrders();
      }
    });
  }

  changeSalesPeriod(event: any): void {
    const order = this.selectedOrder();
    const periodId = event.target.value;
    if (!order) return;

    this.api.updateOrderDetails(order.id, {
      salesPeriodId: periodId === 'null' ? undefined : Number(periodId)
    }).subscribe({
      next: () => {
        this.toast.success('Corte de venta asignado 📊');
        this.loadOrders();
      },
      error: () => this.toast.error('Error al asignar corte')
    });
  }

  updateShippingCost(value: string): void {
    const order = this.selectedOrder();
    const newCost = Number(value);

    if (order && !isNaN(newCost) && newCost >= 0) {
      const newTotal = order.subtotal + newCost;
      const updatedOrder = { ...order, shippingCost: newCost, total: newTotal };
      this.selectedOrder.set(updatedOrder);
      this.orders.update(list => list.map(o => o.id === order.id ? updatedOrder : o));

      this.api.updateOrderDetails(order.id, {
        shippingCost: newCost,
        clientName: order.clientName
      }).subscribe({
        next: () => {
          this.toast.success('Costo de envío actualizado 🚚');
          this.reloadSelectedOrder();
          this.loadOrders();
        },
        error: () => {
          this.toast.error('Error al actualizar envío');
          this.reloadSelectedOrder();
          this.loadOrders();
        }
      });
    }
  }

  toggleClientEdit() {
    if (!this.showClientEdit()) {
      const ord = this.selectedOrder();
      if (ord) {
        this.editClientData = {
          name: ord.clientName || '',
          phone: ord.clientPhone || '',
          address: ord.clientAddress || '',
          alternativeAddress: ord.alternativeAddress || '',
          deliveryInstructions: ord.deliveryInstructions || '',
          type: ord.type || 'Nueva',
          facebookProfileUrl: ord.clientFacebookProfileUrl || ''
        };
      }
    }
    this.showClientEdit.update(v => !v);
  }

  onAddressSelected(address: string) {
    this.editClientData.address = address;
  }

  onAltAddressSelected(address: string) {
    this.editClientData.alternativeAddress = address;
  }

  saveQuickClientEdit(): void {
    const order = this.selectedOrder();
    if (!order) return;

    const trimmedAddress = (this.editClientData.address || '').trim();
    this.api.updateOrderDetails(order.id, {
      clientName: this.editClientData.name,
      clientPhone: this.editClientData.phone,
      // Si el campo viene vacío, no lo mandamos: evita borrar la dirección capturada
      // previamente cuando el formulario se usa solo para editar otros campos.
      ...(trimmedAddress ? { clientAddress: trimmedAddress } : {}),
      alternativeAddress: this.editClientData.alternativeAddress,
      type: this.editClientData.type,
      deliveryInstructions: this.editClientData.deliveryInstructions,
      clientFacebookProfileUrl: this.editClientData.facebookProfileUrl
    }).subscribe({
      next: () => {
        this.toast.success('Datos de clienta actualizados 👤💖');
        this.showClientEdit.set(false);
        this.reloadSelectedOrder();
        this.loadOrders();
      },
      error: () => this.toast.error('Error al actualizar datos')
    });
  }

  addNewItem(): void {
    const order = this.selectedOrder();
    if (!order || !this.newItemName.trim() || this.newItemPrice <= 0 || this.newItemQty < 1) return;

    this.isProcessingItem.set(true);
    this.api.addOrderItem(order.id, {
      productName: this.newItemName.trim(),
      quantity: this.newItemQty,
      unitPrice: this.newItemPrice
    }).subscribe({
      next: () => {
        this.toast.success('Producto agregado 🛍️');
        this.resetNewItemForm();
        this.showNewItemForm.set(false);
        this.reloadSelectedOrder();
        this.loadOrders();
        this.isProcessingItem.set(false);
      },
      error: () => {
        this.toast.error('Error al agregar producto');
        this.isProcessingItem.set(false);
      }
    });
  }

  updateItemQty(itemId: number, newQty: number, name: string, price: number): void {
    const order = this.selectedOrder();
    if (!order || newQty < 1) return;

    this.isProcessingItem.set(true);
    this.api.updateOrderItem(order.id, itemId, { productName: name, quantity: newQty, unitPrice: price }).subscribe({
      next: () => {
        this.reloadSelectedOrder();
        this.loadOrders();
        this.isProcessingItem.set(false);
      },
      error: () => {
        this.toast.error('Error al actualizar cantidad');
        this.isProcessingItem.set(false);
      }
    });
  }

  removeItem(itemId: number): void {
    const order = this.selectedOrder();
    if (!order) return;

    this.isProcessingItem.set(true);
    this.api.removeOrderItem(order.id, itemId).subscribe({
      next: () => {
        this.toast.success('Producto eliminado 🗑️');
        this.reloadSelectedOrder();
        this.loadOrders();
        this.isProcessingItem.set(false);
      },
      error: () => {
        this.toast.error('Error al eliminar producto');
    this.isProcessingItem.set(false);
      }
    });
  }

  applyBirthdayGift(): void {
    const order = this.selectedOrder();
    if (!order) return;

    if (!confirm(`¿Aplicar descuento de $200 por cumpleaños a ${order.clientName} y generar cupón?`)) return;

    this.api.applyBirthdayDiscount(order.id).subscribe({
      next: (updatedOrder) => {
        this.selectedOrder.set(updatedOrder);
        this.orders.update(list => list.map(o => o.id === updatedOrder.id ? updatedOrder : o));
        this.toast.success('¡Descuento de Cumpleaños aplicado! 🎂💖');
        
        // Dar un pequeño delay para que el componente se renderice si no estaba
        setTimeout(() => {
          this.couponService.downloadCoupon('cupon-cumple', order.clientName);
        }, 300);
      },
      error: () => this.toast.error('Error al aplicar el descuento')
    });
  }

  reloadSelectedOrder(): void {
    const order = this.selectedOrder();
    if (!order) return;

    this.api.getOrdersPaged(1, 10, '', order.id.toString(), '').subscribe({
      next: (res) => {
        const refreshed = res.items.find(o => o.id === order.id);
        if (refreshed) {
          this.selectedOrder.set(refreshed);
        }
      }
    });
  }

  addPayment(): void {
    const order = this.selectedOrder();
    if (!order || !this.paymentAmount) return;

    // Convertir la fecha local YYYY-MM-DD a ISO UTC para la API.
    // Si está vacía usamos undefined y la API aplica DateTime.UtcNow.
    let paymentDateIso: string | undefined;
    if (this.paymentDate) {
      // Al parsear 'YYYY-MM-DD' JS lo trata como UTC; sumamos el offset local
      // para que la fecha sea la del día seleccionado en México.
      const [y, m, d] = this.paymentDate.split('-').map(Number);
      const local = new Date(y, m - 1, d, 12, 0, 0); // mediodía local
      paymentDateIso = local.toISOString();
    }

    this.api.addPayment(order.id, {
      amount: this.paymentAmount,
      method: this.paymentMethod,
      registeredBy: 'Admin',
      paymentDate: paymentDateIso
    }).subscribe({
      next: () => {
        this.toast.success('Pago registrado 💰');
        this.paymentAmount = 0;
        this.paymentDate = this.getTodayLocal(); // Resetear a hoy
        this.reloadSelectedOrder();
        this.loadOrders();
      },
      error: () => this.toast.error('Error al registrar pago')
    });
  }

  copyLink(): void {
    const o = this.selectedOrder();
    if (!o || !o.link) return;
    const link = o.link.replace('/o/', '/pedido/');
    navigator.clipboard.writeText(link).then(() => this.toast.success('Enlace copiado 🔗'));
  }

  sendMessenger(): void {
    const o = this.selectedOrder();
    if (!o) return;
    const link = o.link.replace('/o/', '/pedido/');
    const msg = buildOrderMessage({
      clientName: o.clientName,
      publicLink: link,
      scheduledDeliveryDate: o.scheduledDeliveryDate,
      expiresAt: o.expiresAt
    });

    navigator.clipboard.writeText(msg).then(() => {
      this.toast.success('Mensaje copiado 💬 — abre Messenger y pégalo');
    });

    const chatUrl = buildMessengerLink(o.clientFacebookProfileUrl);
    if (chatUrl) {
      window.open(chatUrl, '_blank');
    } else {
      this.toast.info('Pega el mensaje en Messenger. Tip: guarda el Facebook de la clienta para abrir su chat directo 💡');
    }

    // Marcar como notificada (no bloqueante)
    if (!o.notifiedAt) {
      this.api.markOrderNotified(o.id, true).subscribe({
        next: () => this.reloadSelectedOrder(),
        error: () => { /* silencioso: el envío ya ocurrió */ }
      });
    }
  }

  sendWaTicket(): void {
    const o = this.selectedOrder();
    if (!o || !o.clientPhone) return this.toast.error('Sin teléfono');
    const link = o.link.replace('/o/', '/pedido/');
    const msg = encodeURIComponent(`Hola hermosa! 🎀 Aquí tienes tu nota: ${link}`);
    window.open(`https://wa.me/52${o.clientPhone.replace(/\D/g, '')}?text=${msg}`, '_blank');
  }

  sendWaOnRoute(): void {
    const o = this.selectedOrder();
    if (!o || !o.clientPhone) return this.toast.error('Sin teléfono');
    const msg = encodeURIComponent(`¡Hola! 🚗 Tu pedido ya va en camino hacia tu domicilio. 💖`);
    window.open(`https://wa.me/52${o.clientPhone.replace(/\D/g, '')}?text=${msg}`, '_blank');
  }

  sendWaPaymentRequest(): void {
    const o = this.selectedOrder();
    if (!o || !o.clientPhone) return this.toast.error('Sin teléfono');
    const msg = encodeURIComponent(`¡Hola linda! ✨ Tienes un saldo pendiente de $${o.balanceDue.toFixed(2)}. 💳💖`);
    window.open(`https://wa.me/52${o.clientPhone.replace(/\D/g, '')}?text=${msg}`, '_blank');
  }

  uploadExcel(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.uploadExcel(file).subscribe({
      next: (res) => {
        this.toast.success(`Excel procesado: ${res.ordersCreated} pedidos creados 📊`);
        this.loadOrders();
      },
      error: () => this.toast.error('Error al procesar Excel')
    });
  }

  loadPackages(orderId: number) {
    this.isLoadingPackages.set(true);
    this.api.getPackages(orderId).subscribe({
      next: (pkgs) => {
        this.packages.set(pkgs);
        this.isLoadingPackages.set(false);
      },
      error: () => {
        this.toast.error('Error al cargar bolsas');
        this.isLoadingPackages.set(false);
      }
    });
  }

  generatePackages(count: number) {
    const order = this.selectedOrder();
    if (!order || count < 1) return;
    this.isLoadingPackages.set(true);
    this.api.generatePackages(order.id, { count }).subscribe({
      next: () => {
        // Essential: reload the full list of packages for the order
        // to ensure we have ALL packages and correct total counts.
        this.loadPackages(order.id);
        this.toast.success('Bolsas agregadas 🏷️');
        this.packagesToGenerate = 1; // Reset to default
      },
      error: () => {
        this.toast.error('Error al generar bolsas');
        this.isLoadingPackages.set(false);
      }
    });
  }

  /** 🛍️ Quick-set de bolsas desde la tarjeta del Kanban. count = 0 => "va sin bolsas". */
  saveQuickBags(order: OrderSummaryDto, count: number) {
    if (this.savingQuickBags()) return;
    this.savingQuickBags.set(true);
    this.api.setPackages(order.id, count, true).subscribe({
      next: (updated) => {
        this.orders.update(list => list.map(o => o.id === updated.id ? updated : o));
        this.savingQuickBags.set(false);
        this.bagsEditFor.set(null);
        this.toast.success(count === 0 ? 'Marcado sin bolsas 🛍️' : `${count} bolsa${count === 1 ? '' : 's'} guardada${count === 1 ? '' : 's'} 🛍️`);
      },
      error: () => {
        this.savingQuickBags.set(false);
        this.toast.error('No se pudieron guardar las bolsas 🥺');
      }
    });
  }

  async printLabel(pkg: OrderPackageDto, orderData: OrderSummaryDto) {
    const html = await this.generateLabelHtml(pkg, orderData, this.packages().length);
    this.openPrintWindow(html, `Etiqueta Bolsa ${pkg.packageNumber}`);
  }

  async printAllLabels() {
    const order = this.selectedOrder();
    if (!order || !this.packages().length) return;

    try {
      let combinedHtml = '';
      const total = this.packages().length;

      for (const pkg of this.packages()) {
        const labelHtml = await this.generateLabelHtml(pkg, order, total, true);
        combinedHtml += labelHtml;
      }

      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              @page { margin: 0; size: 100mm 150mm; }
              body { margin: 0; padding: 0; }
              .page-break { page-break-after: always; }
              .label-wrapper { 
                margin: 0; padding: 4mm; box-sizing: border-box; 
                width: 100mm; height: 148mm; overflow: hidden;
                font-family: Arial, sans-serif; display: flex; 
                flex-direction: column; justify-content: space-between; align-items: center;
              }
              .header { text-align: center; width: 100%; }
              .header h2 { margin: 2px 0; font-size: 16px; font-weight: bold; }
              .header h3 { margin: 2px 0; font-size: 14px; font-weight: normal; }
              .info { 
                text-align: left; width: 100%; font-size: 16px; font-weight: bold; 
                border-top: 2px dashed #000; border-bottom: 2px dashed #000; 
                padding: 5px 0; margin: 5px 0;
              }
              .info p { margin: 2px 0; }
              .qr-container { 
                display: flex; justify-content: center; align-items: center; 
                flex-grow: 1; width: 100%; overflow: hidden;
              }
              .qr-container img { max-width: 75mm; max-height: 75mm; width: auto; height: auto; }
              .footer { text-align: center; width: 100%; }
              .footer h1 { margin: 0; font-size: 28px; font-weight: bold; text-transform: uppercase;}
              .footer p { margin: 2px 0; font-size: 12px; }
            </style>
          </head>
          <body>
            ${combinedHtml}
          </body>
        </html>
      `;

      this.openPrintWindow(fullHtml, `Etiquetas Pedido ${order.id}`);
    } catch (e) {
      console.error(e);
      this.toast.error('Error al generar etiquetas masivas 🖨️');
    }
  }

  private async generateLabelHtml(pkg: OrderPackageDto, orderData: OrderSummaryDto, totalPackages: number, isBulk = false): Promise<string> {
    // 1. QR Limpio y rápido. Bajamos la corrección de error a 'M' porque ya no hay logo que lo tape
    const finalQrUrl = await QRCode.toDataURL(pkg.qrCodeValue, {
      errorCorrectionLevel: 'M',
      width: 400,
      margin: 1
    });

    // 2. Opcional: Si quieres poner el logo hasta arriba en lugar de texto
    const logoUrl = window.location.origin + '/assets/logo-termico.png';

    const content = `
      <div class="label-wrapper ${isBulk ? 'page-break' : ''}">
        
        <div class="header">
          <h2>REGI BAZAR</h2>
          <h3>Lo mejor para tu hogar</h3>
        </div>

        <div class="info-box">
          <p class="label-text">ENTREGAR A:</p>
          <p class="client-name">${orderData.clientName}</p>
        </div>

        <div class="qr-container">
          <img src="${finalQrUrl}" alt="QR Pedido" />
        </div>

        <div class="logistics">
          <h1>BOLSA ${pkg.packageNumber} DE ${totalPackages}</h1>
        </div>

        <div class="footer">
          <p class="gracias">¡Gracias por tu compra! 🌸</p>
          <p class="social">👍 Síguenos en nuestra página de Facebook:</p>
          <p class="social-bold">Regi Bazar</p>
        </div>

      </div>
    `;

    if (isBulk) return content;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { margin: 0; size: 100mm 150mm; }
            body { 
              margin: 0; 
              padding: 0; 
              background-color: white; 
              color: black;
            }
            .label-wrapper { 
              margin: 0; 
              padding: 6mm 4mm; 
              box-sizing: border-box; 
              width: 100mm; 
              height: 148mm; 
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
              display: flex; 
              flex-direction: column; 
              justify-content: space-between; 
              align-items: center;
              text-align: center;
            }
            
            /* Header */
            .header { width: 100%; margin-bottom: 5px; }
            .top-logo { max-width: 60mm; height: auto; margin-bottom: 5px; }
            .header h2 { margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
            .header h3 { margin: 2px 0 0 0; font-size: 16px; font-weight: normal; font-style: italic; }
            
            /* Info Box */
            .info-box { 
              width: 90%; 
              border-top: 2px dashed #000; 
              border-bottom: 2px dashed #000; 
              padding: 10px 0; 
              margin: 10px 0; 
            }
            .label-text { margin: 0; font-size: 12px; font-weight: bold; color: #333; }
            .client-name { margin: 5px 0 0 0; font-size: 22px; font-weight: 900; line-height: 1.1; }
            
            /* QR */
            .qr-container { 
              flex-grow: 1; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              width: 100%; 
            }
            .qr-container img { width: 65mm; height: 65mm; object-fit: contain; }
            
            /* Logistics */
            .logistics { 
              width: 100%; 
              background-color: #000; 
              color: #fff; /* Inversión de color para que resalte en térmico */
              padding: 8px 0; 
              margin: 5px 0;
              border-radius: 4px; /* Las impresoras térmicas modernas imprimen bordes curvos sin problema */
            }
            .logistics h1 { margin: 0; font-size: 26px; font-weight: 900; letter-spacing: 2px; }
            
            /* Footer */
            .footer { width: 100%; margin-top: 5px; }
            .gracias { margin: 0 0 5px 0; font-size: 18px; font-weight: bold; }
            .social { margin: 0; font-size: 13px; }
            .social-bold { margin: 2px 0 0 0; font-size: 16px; font-weight: 900; }
          </style>
        </head>
        <body>
          ${content}
          <script>
            window.onload = function() { 
              setTimeout(() => { 
                window.print(); 
                window.close(); 
              }, 300); 
            }
          </script>
        </body>
      </html>
    `;
  }

  private fillRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  private openPrintWindow(html: string, title: string) {
    this.printHtml.set(html);
    this.showPrintPreview.set(true);
    // Lock body scroll
    document.body.style.overflow = 'hidden';
  }

  closePrintPreview() {
    this.showPrintPreview.set(false);
    this.printHtml.set('');
    if (!this.drawerOpen()) {
      document.body.style.overflow = '';
    }
  }

  executePrint() {
    const html = this.printHtml();
    if (!html) return;

    if (Capacitor.isNativePlatform()) {
      Printer.printHtml({ html }).then(() => {
        this.toast.success('Impresión enviada 🖨️');
      }).catch((err: any) => {
        console.error('Error al imprimir nativamente:', err);
        this.toast.error('Error al conectar con la impresora');
      });
      return;
    }

    // Use a hidden iframe to print on Web
    if (this.printIframe) {
      document.body.removeChild(this.printIframe);
    }

    this.printIframe = document.createElement('iframe');
    this.printIframe.id = 'print-iframe';
    this.printIframe.style.position = 'fixed';
    this.printIframe.style.right = '0';
    this.printIframe.style.bottom = '0';
    this.printIframe.style.width = '1px';
    this.printIframe.style.height = '1px';
    this.printIframe.style.opacity = '0.01';
    this.printIframe.style.border = '0';
    document.body.appendChild(this.printIframe);

    const doc = this.printIframe.contentWindow?.document;
    if (doc) {
      doc.open();
      const cleanHtml = html.replace(/<script>[\s\S]*?<\/script>/g, '');
      doc.write(cleanHtml);
      doc.close();

      setTimeout(() => {
        if (this.printIframe?.contentWindow) {
          this.printIframe.contentWindow.focus();
          this.printIframe.contentWindow.print();
        }
      }, 800);
    }
  }

  private animateList(): void {
    gsap.to('.order-card-anim', {
      opacity: 1,
      y: 0,
      duration: 0.6,
      stagger: 0.05,
      ease: 'power2.out',
      overwrite: true
    });
  }

  updateOrderInstructions(): void {
    const order = this.selectedOrder();
    if (!order) return;
    this.api.updateOrderDetails(order.id, {
      deliveryInstructions: order.deliveryInstructions,
      alternativeAddress: order.alternativeAddress,
      clientName: order.clientName
    }).subscribe({
      next: () => this.toast.success('Cambios guardados ✨'),
      error: () => this.toast.error('Error al guardar cambios')
    });
  }

  updateScheduledDate(event: any): void {
    const order = this.selectedOrder();
    const date = event.target.value;
    if (!order) return;

    this.api.updateOrderDetails(order.id, {
      scheduledDeliveryDate: date || undefined,
      clientName: order.clientName
    }).subscribe({
      next: () => {
        this.toast.success('Fecha de entrega actualizada 📅');
        this.reloadSelectedOrder();
        this.loadOrders();
      },
      error: () => this.toast.error('Error al actualizar fecha')
    });
  }

  clearScheduledDate(): void {
    const order = this.selectedOrder();
    if (!order) return;

    this.api.updateOrderDetails(order.id, {
      scheduledDeliveryDate: undefined,
      clientName: order.clientName
    }).subscribe({
      next: () => {
        this.toast.success('Fecha programada eliminada 🗑️');
        this.reloadSelectedOrder();
        this.loadOrders();
      },
      error: () => this.toast.error('Error al eliminar fecha')
    });
  }
}
