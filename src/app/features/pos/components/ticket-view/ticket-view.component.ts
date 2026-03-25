import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PosStateService } from '../../../../core/services/pos-state.service';

@Component({
  selector: 'app-ticket-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ticket h-full flex flex-col p-8 overflow-hidden">
      <div class="ticket-header flex justify-between items-center mb-6 pb-4 border-b-2 border-dashed border-pink-100/50">
        <div>
          <h2 class="text-2xl font-black text-pink-900 tracking-tight">Detalle del Pedido</h2>
          <p class="text-xs font-bold text-pink-400 uppercase tracking-widest mt-1">Regi Bazar POS System 🎀</p>
        </div>
        @if (state.selectedOrder()) {
          <span class="badge-confirmed !py-2 !px-4 text-sm font-black shadow-sm">#{{ state.selectedOrder()?.id }}</span>
        }
      </div>

      <div class="table-container flex-1 overflow-y-auto custom-scrollbar pr-2">
        <table class="table-coquette !border-separate !border-spacing-y-2">
          <thead>
            <tr>
              <th class="!bg-transparent !border-none !text-[10px]">Producto</th>
              <th class="!bg-transparent !border-none !text-[10px] text-right">Precio</th>
              <th class="!bg-transparent !border-none !text-[10px] text-center">Cant.</th>
              <th class="!bg-transparent !border-none !text-[10px] text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            @for (item of state.selectedOrder()?.items; track item.id) {
              <tr class="group">
                <td class="!bg-white/50 group-hover:!bg-white transition-colors rounded-l-2xl">
                  <div class="font-black text-pink-900 leading-tight">{{ item.productName }}</div>
                  <div class="text-[10px] uppercase font-bold text-pink-300 mt-1">
                    {{ item.productId ? 'SKU: ' + item.productId : 'Manual' }}
                  </div>
                </td>
                <td class="!bg-white/50 group-hover:!bg-white transition-colors text-right font-bold text-pink-600">
                  {{ item.unitPrice | currency:'USD':'symbol-narrow':'1.2-2' }}
                </td>
                <td class="!bg-white/50 group-hover:!bg-white transition-colors text-center">
                  <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-pink-100 text-pink-600 font-black text-xs">
                    {{ item.quantity }}
                  </span>
                </td>
                <td class="!bg-white/50 group-hover:!bg-white transition-colors text-right rounded-r-2xl">
                  <span class="font-black text-pink-900">{{ item.lineTotal | currency:'USD':'symbol-narrow':'1.2-2' }}</span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="text-center py-20 animate-fade-in">
                  <div class="text-4xl mb-4">🛒</div>
                  <p class="text-pink-300 font-black italic">No hay artículos en este carrito</p>
                  <p class="text-[10px] uppercase font-bold text-pink-200 mt-2 tracking-widest">Escanea un producto para comenzar</p>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="ticket-footer mt-6 pt-6 border-t-2 border-dashed border-pink-100/50 space-y-3">
        <div class="flex justify-between items-center text-sm">
          <span class="font-bold text-pink-400 uppercase tracking-wider">Subtotal</span>
          <span class="font-black text-pink-900">{{ state.selectedOrder()?.subtotal | currency:'USD':'symbol-narrow':'1.2-2' }}</span>
        </div>
        <div class="flex justify-between items-center text-sm">
          <span class="font-bold text-pink-400 uppercase tracking-wider">Envío/Cargos</span>
          <span class="font-black text-pink-900">{{ state.selectedOrder()?.shippingCost | currency:'USD':'symbol-narrow':'1.2-2' }}</span>
        </div>
        @if (state.selectedOrder()?.discountAmount) {
          <div class="flex justify-between items-center text-sm bg-pink-50 p-3 rounded-2xl border border-pink-100/50 animate-pulse">
            <span class="font-black text-pink-600 uppercase tracking-wider text-xs">✨ Descuento</span>
            <span class="font-black text-pink-600">-{{ state.selectedOrder()?.discountAmount | currency:'USD':'symbol-narrow':'1.2-2' }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; width: 100%; overflow: hidden; }
  `]
})
export class TicketViewComponent {
  state = inject(PosStateService);
}
