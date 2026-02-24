import { Component, OnInit, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { ApiService } from '../../../../../core/services/api.service';
import { WhatsAppService } from '../../../../../core/services/whatsapp.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';
import { Client, OrderSummary, LoyaltySummary, LoyaltyTransaction } from '../../../../../shared/models/models';
import { GoogleAutocompleteDirective } from '../../../../../shared/directives/google-autocomplete.directive';
import { OrderItemsManagerComponent } from '../../../../../shared/components/order-items-manager/order-items-manager.component';

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, GoogleAutocompleteDirective, OrderItemsManagerComponent],
  providers: [ConfirmationService],
  templateUrl: './client-profile.component.html',
  styleUrl: './client-profile.component.scss'
})
export class ClientProfileComponent implements OnInit {
  Math = Math;

  // States
  client = signal<Client | null>(null);
  loading = signal(true);
  toastMessage = signal('');
  toastIsError = signal(false);

  // Tabs
  activeTab = signal<'resume' | 'activeOrder' | 'history'>('resume');

  // Loyalty
  loyalty = signal<LoyaltySummary | null>(null);
  loyaltyHistory = signal<LoyaltyTransaction[]>([]);
  showPointsModal = signal(false);
  pointsMode: 'add' | 'subtract' = 'add';
  pointsForm = { amount: 0, reason: '' };

  // Orders
  orders = signal<OrderSummary[]>([]);
  selectedOrderId = signal<number | null>(null);
  savingOrder = signal(false);

  // Active Order context
  activeOrder = computed(() => {
    const all = this.orders();
    const id = this.selectedOrderId();
    if (id) return all.find(o => o.id === id) || null;
    return all.find(o => o.status === 'Pending' || o.status === 'InRoute' || o.status === 'Confirmed' || o.status === 'Shipped') || null;
  });

  orderEditDirty = signal(false);
  orderEditData = {
    status: '',
    orderType: '',
    postponedAt: '',
    postponedNote: '',
    tags: [] as string[],
    deliveryTime: '',
    pickupDate: '',
    shippingCost: 0
  };

  // Payment Modal
  showPaymentModal = signal(false);
  paymentForm = { amount: 0, method: 'Efectivo', notes: '' };

  availableTags = ['Urgente', 'VIP', 'Frágil', 'Regalo', 'Pago pendiente'];

  stats = computed(() => {
    const oList = this.orders();
    const totalSpent = oList.reduce((acc, o) => acc + o.total, 0);
    return { totalSpent, totalOrders: oList.length, avgTicket: oList.length ? totalSpent / oList.length : 0, lastOrderDate: oList.length ? oList[0].createdAt : null };
  });

  isFrecuente = computed(() => {
    const c = this.client();
    return c && (c.orderCount > 1 || c.type === 'Frecuente');
  });

  // Edit Client
  isEditing = signal(false);
  editForm = { name: '', phone: '', address: '', tag: '', type: '', latitude: 0, longitude: 0 };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private confirm: ConfirmationService,
    private whatsapp: WhatsAppService
  ) { }

  ngOnInit() {
    combineLatest([this.route.params, this.route.queryParams]).subscribe(([params, q]) => {
      const clientId = +params['id'];
      const orderId = q['orderId'] ? +q['orderId'] : null;

      if (orderId) {
        this.selectedOrderId.set(orderId);
        this.activeTab.set('activeOrder');
      }

      if (clientId > 0) {
        this.loadData(clientId, orderId);
      } else if (orderId) {
        this.loadOrphanOrder(orderId);
      } else {
        this.loading.set(false);
      }
    });
  }

  loadData(clientId: number, forceOrderId: number | null) {
    this.loading.set(true);

    // Client
    this.api.getClients().subscribe(clients => {
      const c = clients.find(x => x.id === clientId);
      this.client.set(c || null);
      if (c) {
        this.loadOrders(c.name, forceOrderId);
      } else if (forceOrderId) {
        this.loadOrphanOrder(forceOrderId);
      }
    });

    // Loyalty
    this.api.getLoyaltySummary(clientId).subscribe(res => this.loyalty.set(res));
    this.api.getLoyaltyHistory(clientId).subscribe(hist => this.loyaltyHistory.set(hist));
  }

  loadOrders(clientName: string, forceOrderId: number | null) {
    this.api.getOrders().subscribe(allOrders => {
      let clientOrders = allOrders.filter(o => o.clientName === clientName).sort((a, b) => b.id - a.id);

      if (forceOrderId && !clientOrders.some(o => o.id === forceOrderId)) {
        this.api.getOrder(forceOrderId).subscribe({
          next: (o) => {
            clientOrders.unshift(o);
            this.orders.set(clientOrders);
            this.loading.set(false);
            const act = this.activeOrder();
            if (act) this.populateOrderEdit(act);
          },
          error: () => {
            this.orders.set(clientOrders);
            this.loading.set(false);
            const act = this.activeOrder();
            if (act) this.populateOrderEdit(act);
          }
        });
      } else {
        this.orders.set(clientOrders);
        this.loading.set(false);

        const act = this.activeOrder();
        if (act) this.populateOrderEdit(act);
      }
    });
  }

  loadOrphanOrder(orderId: number) {
    this.loading.set(true);
    this.api.getOrder(orderId).subscribe({
      next: (o) => {
        this.orders.set([o]);
        this.client.set({
          id: 0,
          name: o.clientName,
          phone: o.clientPhone,
          address: o.clientAddress,
          orderCount: 1,
          type: o.clientType
        });
        this.populateOrderEdit(o);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showToast('No se encontró el pedido', true);
      }
    });
  }

  // ═══════════════ CLIENT METHODS ═══════════════

  toggleEditClient() {
    const c = this.client();
    if (!c) return;
    if (!this.isEditing()) {
      this.editForm = {
        name: c.name, phone: c.phone || '', address: c.address || '',
        tag: c.tag || 'None', type: c.type || 'Nueva',
        latitude: c.latitude || 0, longitude: c.longitude || 0
      };
    }
    this.isEditing.update(v => !v);
  }

  saveClientChanges() {
    const c = this.client();
    if (!c) return;
    this.api.updateClient(c.id, this.editForm).subscribe({
      next: (updated: any) => {
        this.client.set(updated || { ...c, ...this.editForm });
        this.isEditing.set(false);
        this.showToast('Clienta actualizada ✨');
        // If name changed, we might need to reload orders, or at least update order.clientName
      },
      error: () => this.showToast('Error al guardar', true)
    });
  }

  handleAddressChange(place: any) {
    this.editForm.address = place.address;
    this.editForm.latitude = place.lat;
    this.editForm.longitude = place.lng;
  }

  async askDeleteClient() {
    const c = this.client();
    if (!c) return;
    const confirmed = await this.confirm.confirm({
      title: '¿Eliminar clienta?', message: 'Se borrará permanentemente junto con su historial.',
      confirmText: 'Eliminar', type: 'danger', icon: '🗑️'
    });
    if (confirmed) {
      this.api.deleteClient(c.id).subscribe({
        next: () => this.router.navigate(['/admin/clients']),
        error: () => this.showToast('Error al eliminar', true)
      });
    }
  }

  cleanPhone(phone: string): string { return phone.replace(/[^0-9]/g, ''); }

  // ═══════════════ TABS & ORDER VIEW ═══════════════

  setTab(tab: 'resume' | 'activeOrder' | 'history') {
    this.activeTab.set(tab);
    if (tab === 'activeOrder') {
      const act = this.activeOrder();
      if (act) this.populateOrderEdit(act);
    }
  }

  viewOrderDetails(orderId: number) {
    this.selectedOrderId.set(orderId);
    this.setTab('activeOrder');
  }

  // ═══════════════ ORDER METHODS ═══════════════

  populateOrderEdit(o: OrderSummary) {
    this.orderEditData = {
      status: o.status, orderType: o.orderType,
      postponedAt: o.postponedAt ? new Date(o.postponedAt).toISOString().slice(0, 16) : '',
      postponedNote: o.postponedNote || '',
      tags: o.tags ? [...o.tags] : [],
      deliveryTime: o.deliveryTime || '', pickupDate: o.pickupDate || '',
      shippingCost: o.shippingCost || 0
    };
    this.orderEditDirty.set(false);
  }

  markOrderDirty() { this.orderEditDirty.set(true); }

  toggleOrderTag(tag: string) {
    const idx = this.orderEditData.tags.indexOf(tag);
    if (idx >= 0) this.orderEditData.tags.splice(idx, 1);
    else this.orderEditData.tags.push(tag);
    this.markOrderDirty();
  }

  saveOrderChanges() {
    const act = this.activeOrder();
    if (!act) return;
    this.savingOrder.set(true);

    // Need client info synced from client model
    const c = this.client();
    const payload: any = {
      status: this.orderEditData.status, orderType: this.orderEditData.orderType,
      clientName: c?.name || act.clientName, clientAddress: c?.address || act.clientAddress, clientPhone: c?.phone || act.clientPhone,
      tags: this.orderEditData.tags, deliveryTime: this.orderEditData.deliveryTime || null,
      pickupDate: this.orderEditData.pickupDate || null, shippingCost: this.orderEditData.shippingCost
    };
    if (this.orderEditData.status === 'Postponed') {
      payload.postponedAt = this.orderEditData.postponedAt || null;
      payload.postponedNote = this.orderEditData.postponedNote || null;
    }

    this.api.updateOrder(act.id, payload).subscribe({
      next: (updated) => {
        this.updateOrderLocally(updated);
        this.populateOrderEdit(updated);
        this.savingOrder.set(false);
        this.showToast('Pedido actualizado 💖');
      },
      error: () => { this.savingOrder.set(false); this.showToast('Error al actualizar pedido', true); }
    });
  }

  // ── Payment Ledger ──
  submitPayment() {
    const act = this.activeOrder();
    if (!act || !this.paymentForm.amount) return;

    this.api.addPayment(act.id, {
      amount: this.paymentForm.amount,
      method: this.paymentForm.method,
      registeredBy: 'Admin',
      notes: this.paymentForm.notes || undefined
    }).subscribe({
      next: (newPayment) => {
        this.orders.update(orders => {
          const idx = orders.findIndex(o => o.id === act.id);
          if (idx !== -1) {
            const order = { ...orders[idx] };
            order.payments = [...(order.payments || []), newPayment];
            order.amountPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
            order.balanceDue = order.total - order.amountPaid;
            orders[idx] = order;
          }
          return [...orders];
        });
        this.showPaymentModal.set(false);
        this.paymentForm = { amount: 0, method: 'Efectivo', notes: '' };
        this.showToast('Pago registrado 💳');
      },
      error: () => this.showToast('Error al registrar pago', true)
    });
  }

  deletePayment(paymentId: number) {
    const act = this.activeOrder();
    if (!act) return;
    if (!confirm('¿Eliminar este pago?')) return;

    this.api.deletePayment(act.id, paymentId).subscribe({
      next: () => {
        this.orders.update(orders => {
          const idx = orders.findIndex(o => o.id === act.id);
          if (idx !== -1) {
            const order = { ...orders[idx] };
            order.payments = (order.payments || []).filter(p => p.id !== paymentId);
            order.amountPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
            order.balanceDue = order.total - order.amountPaid;
            orders[idx] = order;
          }
          return [...orders];
        });
        this.showToast('Pago eliminado 🗑️');
      },
      error: () => this.showToast('Error al eliminar pago', true)
    });
  }

  onOrderItemsChanged(updatedOrder: OrderSummary) {
    this.updateOrderLocally(updatedOrder);
    // don't reset edit dirty state to preserve shipping/advance tweaks
  }

  updateOrderLocally(updatedOrder: OrderSummary) {
    this.orders.update(orders => {
      const idx = orders.findIndex(o => o.id === updatedOrder.id);
      if (idx !== -1) orders[idx] = updatedOrder;
      return [...orders];
    });
  }

  async askDeleteActiveOrder() {
    const act = this.activeOrder();
    if (!act) return;
    const confirmed = await this.confirm.confirm({
      title: 'Eliminar pedido', message: `¿Eliminar el pedido #${act.id}?`,
      confirmText: 'Sí, eliminar', type: 'danger', icon: '🗑️'
    });
    if (confirmed) {
      this.api.deleteOrder(act.id).subscribe({
        next: () => {
          this.orders.update(os => os.filter(o => o.id !== act.id));
          this.selectedOrderId.set(null);
          this.setTab('history');
          this.showToast('Pedido eliminado 🗑️');
        },
        error: () => this.showToast('Error al eliminar pedido', true)
      });
    }
  }

  // ═══════════════ TIMELINE ═══════════════
  timelineSteps = computed(() => {
    const o = this.activeOrder();
    if (!o) return [];
    const created = new Date(o.createdAt);
    let enRuta = new Date(created.getTime() + 24 * 60 * 60000);
    const weight = this.getStatusWeight(o.status);
    return [
      { label: 'Recibido', date: created, done: weight >= 0, active: weight === 0, icon: '📝' },
      { label: 'Confirmado', done: weight >= 1, active: weight === 1, icon: '✨' },
      { label: 'En Ruta', done: weight >= 2, active: weight === 2 || weight === 3, icon: '🚗' },
      { label: 'Entregado', done: weight >= 4, active: weight === 4, icon: '💝' }
    ];
  });
  getStatusWeight(st: string): number {
    switch (st) { case 'Pending': return 0; case 'Confirmed': case 'Shipped': return 1; case 'InRoute': return 2; case 'InTransit': return 3; case 'Delivered': return 4; default: return -1; }
  }

  // ═══════════════ WHATSAPP ═══════════════
  sendWa(type: string) {
    const o = this.activeOrder();
    if (!o) return;
    if (type === 'confirm') this.whatsapp.sendOrderConfirmation(o);
    else if (type === 'onway') this.whatsapp.sendOnTheWay(o);
    else if (type === 'client') window.open(`https://wa.me/52${this.cleanPhone(this.client()?.phone || o.clientPhone || '')}`, '_blank');
  }

  // ═══════════════ LOYALTY ═══════════════
  openPointsModal(mode: 'add' | 'subtract') {
    this.pointsMode = mode; this.pointsForm = { amount: 0, reason: '' };
    this.showPointsModal.set(true);
  }
  submitPoints() {
    const c = this.client();
    if (!c || !this.pointsForm.amount) return;
    const pts = this.pointsMode === 'add' ? this.pointsForm.amount : -this.pointsForm.amount;
    this.api.adjustLoyaltyPoints({ clientId: c.id, points: pts, reason: this.pointsForm.reason }).subscribe({
      next: () => {
        this.api.getLoyaltySummary(c.id).subscribe(l => this.loyalty.set(l));
        this.api.getLoyaltyHistory(c.id).subscribe(h => this.loyaltyHistory.set(h));
        this.showPointsModal.set(false);
        this.showToast('Puntos actualizados ✨');
      },
      error: () => this.showToast('Error al ajustar puntos', true)
    });
  }

  // ═══════════════ UTILS ═══════════════
  copyLink(link: string) { navigator.clipboard.writeText(link); this.showToast('Link copiado 📋'); }
  statusLabel(st: string): string { const m: any = { 'Pending': 'Pendiente', 'InRoute': 'En Ruta', 'Delivered': 'Entregado', 'Canceled': 'Cancelado', 'Postponed': 'Pospuesto', 'Shipped': 'Enviado' }; return m[st] || st; }
  handleNotify(ev: { msg: string, isError: boolean }) { this.showToast(ev.msg, ev.isError); }
  showToast(msg: string, isError = false) { this.toastMessage.set(msg); this.toastIsError.set(isError); setTimeout(() => this.toastMessage.set(''), 3000); }
}
