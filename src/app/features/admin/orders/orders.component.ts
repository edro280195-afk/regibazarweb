import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { OrderSummaryDto, ORDER_STATUS_CSS, SalesPeriodDto, ORDER_STATUS_LABELS, OrderPackageDto } from '../../../core/models';
import { gsap } from 'gsap';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DatePipe, RouterLink],
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
          <a routerLink="/admin/capture" class="btn-coquette btn-pink text-center align-middle inline-block">✨ Nuevo Pedido</a>
        </div>
      </div>

      <!-- Filters -->
      <div class="card-coquette p-4 animate-slide-up delay-100" style="opacity:0">
        <div class="flex flex-wrap gap-3 items-end">
          <div class="flex-1 min-w-[200px]">
            <label class="label-coquette">🔍 Buscar</label>
            <input class="input-coquette" placeholder="Nombre de clienta..." [(ngModel)]="search" (input)="loadOrders()" />
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
            <select class="input-coquette" [(ngModel)]="typeFilter" (change)="loadOrders()">
              <option value="">Todos</option>
              <option value="Delivery">Domicilio</option>
              <option value="PickUp">Recoger</option>
            </select>
          </div>
          <div>
            <label class="label-coquette">🎀 Clienta</label>
            <select class="input-coquette" [(ngModel)]="clientTypeFilter" (change)="loadOrders()">
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
                          [class]="order.clientType === 'Frecuente' ? 'bg-gradient-to-r from-purple-50 to-violet-50 text-purple-600 border-purple-200' : 'bg-gradient-to-r from-sky-50 to-blue-50 text-blue-600 border-blue-200'">
                      {{ order.clientType === 'Frecuente' ? 'Frecuente' : 'Nueva' }}
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
        
        <div class="fixed inset-y-0 right-0 z-[100] w-full md:w-[520px] lg:w-[620px] bg-gradient-to-b from-white via-pink-50/20 to-rose-50/30 backdrop-blur-2xl shadow-[-20px_0_60px_-10px_rgba(236,72,153,0.15)] transform transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex flex-col rounded-l-[2rem] overflow-hidden border-l border-pink-100/30"
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
                    <input class="input-coquette text-xs py-1.5" [(ngModel)]="editClientData.name" placeholder="Nombre completo" />
                    <input class="input-coquette text-xs py-1.5" [(ngModel)]="editClientData.phone" placeholder="Teléfono" />
                    <input class="input-coquette text-xs py-1.5" [(ngModel)]="editClientData.address" placeholder="Dirección" />
                    <select class="input-coquette text-xs py-1.5" [(ngModel)]="editClientData.type">
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

          <!-- Scrollable Body -->
          <div class="flex-1 overflow-y-auto w-full px-6 py-5 space-y-5 scrollbar-hide">
            
            <!-- Visual Pipeline (Status) -->
            <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-pink-100/50 shadow-sm">
              <h4 class="text-xs font-black text-pink-600 mb-3 uppercase tracking-widest flex items-center gap-2">🎀 Estatus del Pedido</h4>
              <div class="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide py-1">
                <button class="px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap hover:scale-105 active:scale-95 border"
                        [class]="selectedOrder()!.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-md shadow-amber-100' : 'bg-white/60 text-pink-300 border-pink-100/50 hover:bg-amber-50 hover:text-amber-600'"
                        (click)="updateStatus(selectedOrder()!.id, 'Pending')">⏳ Pendiente</button>
                <div class="w-3 h-px bg-gradient-to-r from-pink-200 to-pink-100 shrink-0"></div>
                
                <button class="px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap hover:scale-105 active:scale-95 border"
                        [class]="selectedOrder()!.status === 'Confirmed' ? 'bg-pink-50 text-pink-700 border-pink-200 shadow-md shadow-pink-100' : 'bg-white/60 text-pink-300 border-pink-100/50 hover:bg-pink-50 hover:text-pink-600'"
                        (click)="updateStatus(selectedOrder()!.id, 'Confirmed')">💖 Confirmada</button>
                <div class="w-3 h-px bg-gradient-to-r from-pink-200 to-pink-100 shrink-0"></div>
                
                <button class="px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap hover:scale-105 active:scale-95 border"
                        [class]="selectedOrder()!.status === 'Shipped' ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-md shadow-blue-100' : 'bg-white/60 text-pink-300 border-pink-100/50 hover:bg-blue-50 hover:text-blue-600'"
                        (click)="updateStatus(selectedOrder()!.id, 'Shipped')">📦 Enviado</button>
                <div class="w-3 h-px bg-gradient-to-r from-pink-200 to-pink-100 shrink-0"></div>
                
                <button class="px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap hover:scale-105 active:scale-95 border"
                        [class]="selectedOrder()!.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-md shadow-emerald-100' : 'bg-white/60 text-pink-300 border-pink-100/50 hover:bg-emerald-50 hover:text-emerald-600'"
                        (click)="updateStatus(selectedOrder()!.id, 'Delivered')">✅ Entregado</button>
              </div>
            </div>

            <!-- Delivery & Period Toggles -->
            <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-pink-100/50 shadow-sm grid grid-cols-2 gap-5">
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

            <!-- Shipping Cost Editor -->
            <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-pink-100/50 shadow-sm flex items-center justify-between">
              <div>
                <p class="text-[10px] font-black text-pink-500 uppercase tracking-widest flex items-center gap-1">🚚 Costo de Envío</p>
                <p class="text-sm font-bold text-pink-900 mt-1">Actual: {{ selectedOrder()!.shippingCost | currency:'MXN':'symbol-narrow' }}</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-pink-400 font-bold">$</span>
                <input type="number" class="input-coquette py-1.5 px-2 text-sm w-20 text-center" 
                       [ngModel]="selectedOrder()!.shippingCost" 
                       #shippingCostInput>
                <button class="btn-coquette btn-pink px-3 py-1.5 text-xs shadow-md hover:shadow-lg transition-all"
                        (click)="updateShippingCost(shippingCostInput.value)">
                  Aplicar
                </button>
              </div>
            </div>

            <!-- Order Items -->
            <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-pink-100/50 shadow-sm">
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-xs font-black text-pink-600 uppercase tracking-widest flex items-center gap-2">🛍️ Productos ({{ selectedOrder()!.itemsCount }})</h4>
              </div>
              
              <div class="space-y-3" [class.opacity-50]="isProcessingItem()" [class.pointer-events-none]="isProcessingItem()">
                @for (item of selectedOrder()!.items; track item.id) {
                  <div class="group/item bg-white/80 rounded-2xl p-4 border border-pink-100/30 shadow-[0_2px_10px_-4px_rgba(244,114,182,0.1)] hover:shadow-[0_8px_25px_-5px_rgba(244,114,182,0.2)] hover:border-pink-200/60 transition-all duration-300 flex flex-col gap-3 relative overflow-hidden focus-within:ring-2 focus-within:ring-pink-300 focus-within:border-pink-400">
                    <div class="absolute inset-0 bg-gradient-to-r from-pink-50/0 via-white/50 to-pink-50/0 opacity-0 group-hover/item:opacity-100 transition-opacity pointer-events-none"></div>
                    
                    <div class="flex justify-between items-start relative z-10">
                      <div class="flex-1 mr-4">
                        <input type="text" [(ngModel)]="item.productName" 
                               (change)="updateItemQty(item.id, item.quantity, item.productName, item.unitPrice)"
                               class="w-full bg-transparent border-b border-transparent hover:border-pink-200 focus:border-pink-400 focus:bg-pink-50/60 transition-all font-black text-pink-900 text-sm appearance-none outline-none ring-0 placeholder-pink-300 px-1 py-0.5 rounded-t-sm" 
                               placeholder="Nombre del producto...">
                        <span class="text-[9px] text-pink-400 ml-1 opacity-0 group-focus-within/item:opacity-100 transition-opacity">✏️ Enter para guardar</span>
                      </div>
                      <button class="text-pink-200 hover:text-rose-500 hover:bg-rose-50 w-8 h-8 rounded-full flex items-center justify-center hover:scale-110 active:scale-90 transition-all shrink-0" (click)="removeItem(item.id)" title="Eliminar producto">🗑️</button>
                    </div>
                    
                    <div class="flex items-center justify-between relative z-10 bg-pink-50/30 p-2 rounded-xl">
                      <div class="flex items-center bg-white rounded-xl border border-pink-100/50 shadow-sm hover:shadow-md transition-shadow">
                        <button class="w-8 h-8 text-pink-500 hover:bg-pink-100 rounded-l-xl font-black transition-colors flex justify-center items-center active:bg-pink-200" (click)="updateItemQty(item.id, item.quantity - 1, item.productName, item.unitPrice)">−</button>
                        <span class="w-8 h-full font-black text-pink-900 flex justify-center items-center text-sm border-x border-pink-50 bg-pink-50/30">{{ item.quantity }}</span>
                        <button class="w-8 h-8 text-pink-500 hover:bg-pink-100 rounded-r-xl font-black transition-colors flex justify-center items-center active:bg-pink-200" (click)="updateItemQty(item.id, item.quantity + 1, item.productName, item.unitPrice)">+</button>
                      </div>
                      
                      <div class="text-right">
                        <div class="flex items-center justify-end gap-1 mb-0.5">
                          <input type="number" [(ngModel)]="item.unitPrice" step="0.5"
                                 (change)="updateItemQty(item.id, item.quantity, item.productName, item.unitPrice)"
                                 class="w-16 bg-transparent border-b border-transparent hover:border-pink-200 focus:border-pink-400 focus:bg-white transition-all text-[10px] text-pink-500 font-bold text-right outline-none ring-0 p-0 m-0">
                          <span class="text-[10px] text-pink-400 font-medium">c/u</span>
                        </div>
                        <p class="font-black text-pink-700 text-base leading-none">{{ item.lineTotal | currency:'MXN':'symbol-narrow' }}</p>
                      </div>
                    </div>
                  </div>
                }

                <!-- Add New Item Row -->
                <div class="bg-gradient-to-tr from-pink-50/40 to-rose-50/30 rounded-2xl p-4 border-2 border-dashed border-pink-200/50 mt-4 hover:border-pink-300/50 transition-colors">
                  <p class="text-xs font-black text-pink-500 mb-3 flex items-center gap-1">✨ Agregar artículo</p>
                  <div class="flex flex-col gap-2">
                    <input type="text" class="input-coquette py-2 text-sm" placeholder="Nombre completo del producto" [(ngModel)]="newItemName">
                    <div class="flex gap-2">
                      <div class="flex-1 relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400 font-bold">$</span>
                        <input type="number" class="input-coquette py-2 pl-7 pr-2 text-sm w-full" placeholder="Precio" [(ngModel)]="newItemPrice" min="0">
                      </div>
                      <input type="number" class="input-coquette py-2 px-3 text-sm w-20 text-center" placeholder="Cant." [(ngModel)]="newItemQty" min="1">
                      <button class="btn-coquette btn-pink px-4 shadow-md hover:shadow-lg transition-all" [disabled]="!newItemName || newItemPrice <= 0 || newItemQty < 1" (click)="addNewItem()">OK</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Logística (Bolsas Anti-Pérdidas) -->
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

            <!-- Quick Payments -->
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
                  <input type="number" class="input-coquette w-full py-2.5 pl-8 pr-3 font-bold text-pink-800 bg-white/80 border-pink-200/50 focus:border-pink-400 focus:ring-pink-100" 
                         [(ngModel)]="paymentAmount" placeholder="Ej. 150" min="1" step="0.5">
                </div>
              </div>
              
              <div class="grid grid-cols-3 gap-2 mt-3">
                <button class="py-2.5 rounded-2xl border font-bold text-sm flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95"
                        [class]="paymentMethod === 'Efectivo' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-md shadow-emerald-100' : 'bg-white/60 border-pink-100/50 text-pink-400 hover:bg-emerald-50 hover:text-emerald-600'"
                        (click)="paymentMethod = 'Efectivo'; addPayment()">
                  <span class="text-xl">💵</span> <span class="text-[10px]">Efectivo</span>
                </button>
                <button class="py-2.5 rounded-2xl border font-bold text-sm flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95"
                        [class]="paymentMethod === 'Transferencia' ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-md shadow-blue-100' : 'bg-white/60 border-pink-100/50 text-pink-400 hover:bg-blue-50 hover:text-blue-600'"
                        (click)="paymentMethod = 'Transferencia'; addPayment()">
                  <span class="text-xl">🏦</span> <span class="text-[10px]">Transf.</span>
                </button>
                <button class="py-2.5 rounded-2xl border font-bold text-sm flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95"
                        [class]="paymentMethod === 'Tarjeta' ? 'bg-purple-50 border-purple-200 text-purple-700 shadow-md shadow-purple-100' : 'bg-white/60 border-pink-100/50 text-pink-400 hover:bg-purple-50 hover:text-purple-600'"
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
                      <span class="text-pink-700 font-medium">{{ p.method }} <span class="text-pink-400 text-xs">({{ p.date | date:'shortDate' }})</span></span>
                      <span class="font-black text-pink-800">{{ p.amount | currency:'MXN':'symbol-narrow' }}</span>
                    </div>
                  }
                </div>
              }
            </div>
            
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
              <button class="w-10 h-10 rounded-2xl bg-green-50 text-green-500 hover:bg-green-100 hover:text-green-700 hover:scale-110 active:scale-95 flex items-center justify-center transition-all shadow-sm border border-green-100/50" title="Ticket WhatsApp" (click)="sendWaTicket()">
                <svg viewBox="0 0 24 24" class="w-5 h-5 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.76.45 3.4 1.25 4.84L2 22l5.3-1.15A9.95 9.95 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm4.5 13.5c-.24.68-1.25 1.3-1.8 1.38-.45.06-.98.15-2.82-.6-2.22-.92-3.66-3.17-3.77-3.32-.1-.15-.9-1.2-.9-2.28s.56-1.63.76-1.83c.2-.2.43-.25.58-.25s.3-.02.45-.02c.16-.02.38-.05.6.48.23.55.76 1.83.83 1.95.06.13.1.28.02.48-.08.2-.12.33-.25.48-.12.15-.26.33-.37.45-.13.13-.27.28-.12.53.15.25.66 1.08 1.42 1.75.98.88 1.8 1.15 2.05 1.28.25.13.4.1.55-.07.15-.17.65-.75.83-1.02.17-.26.35-.22.58-.13.22.1 1.42.67 1.67.8.25.13.42.18.47.28.06.1.06.6-.18 1.28z"/></svg>
              </button>
              <button class="w-10 h-10 rounded-2xl bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-700 hover:scale-110 active:scale-95 flex items-center justify-center transition-all shadow-sm border border-blue-100/50" title="En Camino" (click)="sendWaOnRoute()">🚗</button>
              <button class="w-10 h-10 rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-700 hover:scale-110 active:scale-95 flex items-center justify-center transition-all shadow-sm border border-rose-100/50" title="Cobrar" (click)="sendWaPaymentRequest()">💸</button>
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

  orders = signal<OrderSummaryDto[]>([]);
  loading = signal(true);
  totalCount = signal(0);
  currentPage = signal(1);
  pageSize = 20;

  search = '';
  statusFilter = '';
  typeFilter = '';
  clientTypeFilter = '';
  selectedOrder = signal<OrderSummaryDto | null>(null);

  paymentAmount = 0;
  paymentMethod = 'Efectivo';

  // Drawer State
  drawerOpen = signal(false);
  newItemName = '';
  newItemQty = 1;
  newItemPrice = 0;
  isProcessingItem = signal(false);
  salesPeriods = signal<SalesPeriodDto[]>([]);
  totalPages = signal(1);

  // Quick Client Edit
  showClientEdit = signal(false);
  editClientData = { name: '', phone: '', address: '', type: 'Nueva' };

  // Logistics
  packages = signal<OrderPackageDto[]>([]);
  isLoadingPackages = signal(false);
  packagesToGenerate = 1;

  ngOnInit(): void {
    this.loadOrders();
    this.api.getSalesPeriods().subscribe({
      next: (periods) => this.salesPeriods.set(periods)
    });
  }

  loadOrders(): void {
    this.loading.set(true);
    this.api.getOrdersPaged(this.currentPage(), this.pageSize, this.statusFilter, this.search, this.typeFilter, undefined, undefined, this.clientTypeFilter).subscribe({
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
    const labels: Record<string, string> = {
      'Pending': '⏳ Pendiente', 'InRoute': '🚗 En Ruta', 'Delivered': '✅ Entregado',
      'NotDelivered': '❌ No Entregado', 'Canceled': '🚫 Cancelado', 'Postponed': '📅 Pospuesto',
      'Confirmed': '💖 Confirmado', 'Shipped': '📦 Enviado'
    };
    return labels[status] || status;
  }

  getPaymentPercent(order: OrderSummaryDto): number {
    if (order.total <= 0) return 100;
    return Math.min(100, (order.amountPaid / order.total) * 100);
  }

  updateStatus(id: number, status: string): void {
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
      next: () => {
        this.loadOrders();
        // Assuming ORDER_STATUS_LABELS is defined elsewhere or getStatusLabel can be used
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

  toggleClientEdit(): void {
    if (!this.showClientEdit()) {
      const o = this.selectedOrder()!;
      this.editClientData = {
        name: o.clientName,
        phone: o.clientPhone || '',
        address: o.clientAddress || '',
        type: o.clientType || 'Nueva'
      };
    }
    this.showClientEdit.update(v => !v);
  }

  saveQuickClientEdit(): void {
    const order = this.selectedOrder();
    if (!order) return;

    this.api.updateOrderDetails(order.id, {
      clientName: this.editClientData.name,
      clientPhone: this.editClientData.phone,
      clientAddress: this.editClientData.address,
      clientType: this.editClientData.type
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
    this.api.addPayment(order.id, {
      amount: this.paymentAmount,
      method: this.paymentMethod,
      registeredBy: 'Admin'
    }).subscribe({
      next: () => {
        this.toast.success('Pago registrado 💰');
        this.paymentAmount = 0;
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
              /* Strict styles from the user template */
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
            <script>
              window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 500); }
            </script>
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
    // Generate QR with High error correction (H) so the logo doesn't break it
    const qrDataUrl = await QRCode.toDataURL(pkg.qrCodeValue, {
      errorCorrectionLevel: 'H',
      width: 400,
      margin: 1
    });

    let finalQrUrl = qrDataUrl;

    try {
      // Create canvas to merge QR + Logo
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d')!;

      // Load QR Image
      const qrImg = new Image();
      qrImg.src = qrDataUrl;
      await new Promise((resolve, reject) => {
        qrImg.onload = resolve;
        qrImg.onerror = reject;
      });
      ctx.drawImage(qrImg, 0, 0);

      // Load Logo Image
      const logoUrl = window.location.origin + '/assets/logo-termico.png';
      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous"; // Important if served from different origin
      logoImg.src = logoUrl;

      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve; // Continue even if logo fails
      });

      if (logoImg.complete && logoImg.naturalWidth > 0) {
        // Draw white background for the logo center
        const logoSize = 100;
        const center = (400 - logoSize) / 2;
        ctx.fillStyle = 'white';
        // Rounded corner effect for the logo pocket
        this.fillRoundedRect(ctx, center - 2, center - 2, logoSize + 4, logoSize + 4, 10);
        ctx.drawImage(logoImg, center, center, logoSize, logoSize);
        finalQrUrl = canvas.toDataURL('image/png');
      }
    } catch (e) {
      console.warn('Could not add logo to QR, falling back to basic QR', e);
    }

    const content = `
      <div class="label-wrapper ${isBulk ? 'page-break' : ''}">
        <div class="header">
          <h2>REGI BAZAR</h2>
          <h3>Todo para tu hogar</h3>
          <h3>¡Gracias por tu compra! 🌸</h3>
        </div>
        <div class="info">
          <p>Para: ${orderData.clientName}</p>
          <p>Pedido: #${orderData.id}</p>
        </div>
        <div class="qr-container">
          <img src="${finalQrUrl}" alt="QR" />
        </div>
        <div class="footer">
          <h1>Bolsa ${pkg.packageNumber} de ${totalPackages}</h1>
          <hr style="border: 1px solid black; margin: 5px 0;" />
          <p>FB: Regi Bazar</p>
        </div>
      </div>
    `;

    if (isBulk) return content;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @page { margin: 0; size: 100mm 150mm; }
            body { margin: 0; padding: 0; }
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
          ${content}
          <script>
            window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 300); }
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
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.toast.error('Bloqueador de ventanas activo 🚫');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.title = title;
    printWindow.document.close();
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
}
