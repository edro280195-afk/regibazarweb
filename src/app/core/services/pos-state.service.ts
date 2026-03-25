import { Injectable, signal, computed } from '@angular/core';
import { CashRegisterSession, Order, OrderItem } from '../models/pos.models';

@Injectable({
  providedIn: 'root'
})
export class PosStateService {
  // Signals for Reactive State
  currentSession = signal<CashRegisterSession | null>(null);
  activeOrders = signal<Order[]>([]);
  selectedOrderId = signal<number | null>(null);

  // Computed signals
  selectedOrder = computed(() => {
    const id = this.selectedOrderId();
    return this.activeOrders().find(o => o.id === id) || null;
  });

  totalDue = computed(() => this.selectedOrder()?.total || 0);

  constructor() {}

  // State Mutators
  setSession(session: CashRegisterSession | null) {
    this.currentSession.set(session);
  }

  updateActiveOrders(orders: Order[]) {
    this.activeOrders.set(orders);
    
    // Auto-select first order if none selected
    if (!this.selectedOrderId() && orders.length > 0) {
      this.selectedOrderId.set(orders[0].id);
    }
  }

  updateOrder(updatedOrder: Order) {
    this.activeOrders.update(orders => {
      const index = orders.findIndex(o => o.id === updatedOrder.id);
      if (index !== -1) {
        const newOrders = [...orders];
        newOrders[index] = updatedOrder;
        return newOrders;
      }
      return [...orders, updatedOrder];
    });
  }

  removeOrder(orderId: number) {
    this.activeOrders.update(orders => orders.filter(o => o.id !== orderId));
    if (this.selectedOrderId() === orderId) {
      const remaining = this.activeOrders();
      this.selectedOrderId.set(remaining.length > 0 ? remaining[0].id : null);
    }
  }
}
