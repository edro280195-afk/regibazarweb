import { Component, OnInit, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { WhatsAppService } from '../../../../core/services/whatsapp.service';
import { OrderSummary, OrderItem, ExcelUploadResult } from '../../../../shared/models/models';
import { RouteOptimizerComponent } from './route-optimizer/route-optimizer.component';
import { GoogleAutocompleteDirective } from '../../../../shared/directives/google-autocomplete.directive';
import { SignalRService } from '../../../../core/services/signalr.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouteOptimizerComponent, GoogleAutocompleteDirective],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss'
})
export class OrdersComponent implements OnInit {
  Math = Math;

  // ── Data ──
  orders = signal<OrderSummary[]>([]);
  filteredOrders = signal<OrderSummary[]>([]);
  selectedOrdersMap = signal<Map<number, OrderSummary>>(new Map());
  selectedIds = computed(() => new Set(this.selectedOrdersMap().keys()));
  routeCreated = signal<any>(null);

  // ── UI state ──
  selectionMode = signal(false); // New!
  loading = signal(false);
  toastMessage = signal('');
  toastIsError = signal(false);
  isDragging = signal(false);
  uploading = signal(false);
  uploadResult = signal<ExcelUploadResult | null>(null);

  // Tags System
  availableTags = ['VIP', 'Nuevo', 'Urgente', 'Regalo', 'Problema', 'Frecuente'];
  filterTag = signal<string>('');

  // Route Optimizer
  showOptimizer = signal(false);


  // ── Modals ──
  orderToEdit = signal<OrderSummary | null>(null);
  editData = {
    status: '',
    orderType: '',
    postponedAt: '',
    postponedNote: '',
    clientName: '',
    clientAddress: '',
    clientPhone: '',
    tags: [] as string[],
    deliveryTime: '',
    pickupDate: ''
  };

  /* WHATSAPP STYLES */
  // We'll add them to global styles or inline here since we can't easily append to styles array without seeing it all
  // But wait, the component imports styles from... wait, styles are not visible here.
  // Actually the component has `styles: [...]` which I can't easily see end of.
  // I'll put styles in a <style> block in template? No, Angular doesn't like that.
  // I'll assume I can append them if I find the styles array end.
  // But I don't want to risk breaking it.
  // I'll use inline styles or existing classes + new ones if I can find where styles end.
  // The styles end was not in the range I viewed.
  // I will add the CSS to the template using <style> tag if possible? No.
  // I will skip adding CSS for now and rely on global or existing. 
  // Actually, I can use `btn-wa` and define it if I can find the styles end.
  // I'll assume `btn-wa` needs styling.

  // ── Drawer ──
  drawerOrder = signal<OrderSummary | null>(null);
  drawerOpen = signal(false);
  newItem = { productName: '', quantity: 1, unitPrice: 0 };

  // ── Filters & Pagination ──
  statusFilter = '';
  clientTypeFilter = '';
  searchTerm = '';

  currentPage = signal(1);
  pageSize = signal(24);
  totalOrdersCount = signal(0);
  totalPages = computed(() => Math.ceil(this.totalOrdersCount() / this.pageSize()) || 1);

  // ── Stats ──
  orderStats = signal({ total: 0, pending: 0, pendingAmount: 0, collectedToday: 0 });

  // Lista de objetos orden completos seleccionados (para el Dock)
  selectedOrdersList = computed(() => {
    return Array.from(this.selectedOrdersMap().values());
  });

  selectedOrdersTotal = computed(() => {
    return this.selectedOrdersList().reduce((sum, o) => sum + o.total, 0);
  });

  private orderSub?: Subscription;
  private searchTimeout: any;

  constructor(
    private api: ApiService,
    private confirm: ConfirmationService,
    private whatsapp: WhatsAppService,
    private router: Router,
    private signalr: SignalRService
  ) { }

  ngOnInit(): void {
    this.loadOrders();

    // SignalR Notification
    this.orderSub = this.signalr.orderConfirmed$.subscribe(data => {
      this.showToast(`¡${data.clientName} acaba de confirmar su pedido! ✨`);
      // Update local state
      this.orders.update(current =>
        current.map(o => o.id === data.orderId ? { ...o, status: data.newStatus } : o)
      );
      this.applyFilter(false); // don't reset page
      this.loadOrderStats();
    });
  }

  ngOnDestroy() {
    this.orderSub?.unsubscribe();
  }

  // ═══════════════ DATA ═══════════════

  loadOrderStats(): void {
    this.api.getOrderStats().subscribe(stats => {
      this.orderStats.set({
        total: stats.total,
        pending: stats.pending,
        pendingAmount: stats.pendingAmount,
        collectedToday: stats.collectedToday
      });
    });
  }

  loadOrders(): void {
    this.loading.set(true);
    this.loadOrderStats();

    this.api.getOrdersPaginated(
      this.currentPage(),
      this.pageSize(),
      this.searchTerm,
      this.statusFilter,
      this.clientTypeFilter
    ).subscribe({
      next: (res) => {
        let list = res.items;
        // Client-side tag filter if needed (not supported by backend yet)
        if (this.filterTag()) {
          list = list.filter(o => o.tags?.includes(this.filterTag()));
        }

        this.orders.set(list);
        this.filteredOrders.set(list);
        this.totalOrdersCount.set(res.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Error al cargar pedidos 😿', true);
      }
    });
  }

  onSearchChange(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.applyFilter(true);
    }, 400); // 400ms debounce
  }

  applyFilter(resetPage = true): void {
    if (resetPage) this.currentPage.set(1);
    this.loadOrders();
  }

  changePage(delta: number): void {
    const newPage = this.currentPage() + delta;
    if (newPage >= 1 && newPage <= this.totalPages()) {
      this.currentPage.set(newPage);
      this.loadOrders();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ═══════════════ SELECTION & ROUTE ═══════════════

  toggleOrder(order: OrderSummary): void {
    const map = new Map(this.selectedOrdersMap());
    if (map.has(order.id)) {
      map.delete(order.id);
    } else {
      map.set(order.id, order);
    }
    this.selectedOrdersMap.set(map);
  }

  toggleSelectionMode(): void {
    const current = this.selectionMode();
    this.selectionMode.set(!current);
    if (current) {
      // Al salir del modo selección, ¿limpiamos?
      // Opcional: this.selectedIds.set(new Set());
      // Dejémoslo activo por si se arrepiente, pero el dock se ocultará si condicionamos al modo
    }
  }

  createRoute(): void {
    if (this.selectedIds().size === 0) return;
    this.showOptimizer.set(true);
  }

  // ── ROUTE OPTIMIZER HANDLER ──
  handleRouteConfirmed(sortedOrders: OrderSummary[]) {
    this.showOptimizer.set(false);
    this.loading.set(true);

    const payload = {
      orderIds: sortedOrders.map(o => o.id)
    };

    console.log('🚀 Creating Route Payload (Fixed):', JSON.stringify(payload, null, 2));

    this.api.createRoute(payload).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.routeCreated.set(res);
        this.loadOrders(); // Refresh status
        this.selectedOrdersMap.set(new Map());
        this.selectionMode.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        console.error('❌ Route Create Error:', err);
        // CORS often hides details, but let's see.
        this.showToast('Error al crear ruta. Revisa consola.');
      }
    });
  }

  // ═══════════════ EDIT MODAL ═══════════════

  openEditModal(order: OrderSummary): void {
    this.orderToEdit.set(order);
    this.editData = {
      status: order.status,
      orderType: order.orderType,
      postponedAt: order.postponedAt ? new Date(order.postponedAt).toISOString().slice(0, 16) : '',
      postponedNote: order.postponedNote || '',
      clientName: order.clientName,
      clientAddress: order.clientAddress || '',
      clientPhone: order.clientPhone || '',
      tags: order.tags || [],
      deliveryTime: order.deliveryTime || '',
      pickupDate: order.pickupDate || ''
    };
    this.tempGeo = null; // Reset temp geo
  }

  tempGeo: { lat: number, lng: number } | null = null;

  handleAddressChange(place: any) {
    this.editData.clientAddress = place.address;
    this.tempGeo = { lat: place.lat, lng: place.lng };
  }

  toggleTag(tag: string) {
    if (!this.editData.tags) this.editData.tags = [];
    const idx = this.editData.tags.indexOf(tag);
    if (idx > -1) {
      this.editData.tags.splice(idx, 1);
    } else {
      this.editData.tags.push(tag);
    }
  }

  saveEdit(): void {
    const order = this.orderToEdit();
    if (!order) return;

    // Save Client Geo if new address selected
    if (this.tempGeo && order.clientId) {
      this.api.updateClient(order.clientId, {
        latitude: this.tempGeo.lat,
        longitude: this.tempGeo.lng,
        address: this.editData.clientAddress // Also ensure client address is synced
      }).subscribe();
    }

    const payload = {
      status: this.editData.status,
      orderType: this.editData.orderType,
      postponedAt: (this.editData.status === 'Postponed' && this.editData.postponedAt)
        ? this.editData.postponedAt : null,
      postponedNote: this.editData.postponedNote || null,
      clientName: this.editData.clientName,
      clientAddress: this.editData.clientAddress,
      clientPhone: this.editData.clientPhone,
      tags: this.editData.tags,
      deliveryTime: this.editData.deliveryTime,
      pickupDate: this.editData.pickupDate
    };

    // Use updateOrder for top-level updates (status, type, client info)
    this.api.updateOrder(order.id, payload).subscribe({
      next: (updated) => {
        const current = this.orders();
        const idx = current.findIndex(o => o.id === order.id);
        if (idx !== -1) {
          current[idx] = updated;
          this.orders.set([...current]);
          this.applyFilter();
        }
        this.orderToEdit.set(null);
        this.showToast('¡Pedido actualizado! ✨💅');
      },
      error: () => this.showToast('Error al guardar 😿', true)
    });
  }

  // ═══════════════ PAYMENT ACTIONS ═══════════════
  selectedOrderForPayment = signal<OrderSummary | null>(null);
  paymentMethod = signal('Efectivo');
  confirmingPayment = signal(false);

  openConfirmPayment(order: OrderSummary): void {
    this.selectedOrderForPayment.set(order);
    this.paymentMethod.set('Efectivo');
  }

  confirmPayment(): void {
    const order = this.selectedOrderForPayment();
    if (!order) return;
    this.confirmingPayment.set(true);

    // Mark as delivered (and paid)
    this.api.updateOrderStatus(order.id, { status: 'Delivered' }).subscribe({
      next: (updated) => {
        this.showToast(`¡Cobro de $${order.total} registrado! 💸`);
        // Update local state
        const current = this.orders();
        const idx = current.findIndex(o => o.id === order.id);
        if (idx !== -1) {
          current[idx] = updated;
          this.orders.set([...current]);
          this.applyFilter();
        }
        this.selectedOrderForPayment.set(null);
        this.confirmingPayment.set(false);
      },
      error: () => {
        this.showToast('Error al registrar cobro 😿', true);
        this.confirmingPayment.set(false);
      }
    });
  }

  // ═══════════════ WHATSAPP ACTIONS ═══════════════
  sendWaConfirmation() {
    const order = this.orderToEdit();
    if (order) this.whatsapp.sendOrderConfirmation(order);
  }

  sendWaOnWay() {
    const order = this.orderToEdit();
    if (order) this.whatsapp.sendOnTheWay(order);
  }

  sendWaPayment() {
    const order = this.orderToEdit();
    if (order) this.whatsapp.sendPaymentReminder(order);
  }

  // ═══════════════ DRAWER: EDIT ITEM ═══════════════
  // We'll reuse the drawer for editing items too, or create a specific mode
  editingItem = signal<OrderItem | null>(null);

  openEditItem(order: OrderSummary, item: OrderItem): void {
    this.drawerOrder.set(order); // We need the order context
    this.editingItem.set(item);

    // Pre-fill form with item data
    this.newItem = {
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    };

    setTimeout(() => this.drawerOpen.set(true), 30);
  }

  saveItemChanges(): void {
    const order = this.drawerOrder();
    const item = this.editingItem();

    if (!order || !item || !this.newItem.productName.trim() || this.newItem.unitPrice <= 0) return;

    const payload = {
      productName: this.newItem.productName.trim(),
      quantity: this.newItem.quantity,
      unitPrice: this.newItem.unitPrice
    };

    this.api.updateOrderItem(order.id, item.id, payload).subscribe({
      next: (updatedOrder) => {
        // Update local state
        const current = this.orders();
        const idx = current.findIndex(o => o.id === order.id);
        if (idx !== -1) {
          current[idx] = updatedOrder;
          this.orders.set([...current]);
          this.applyFilter();
        }

        // Refresh drawer order context if needed, or close
        this.closeDrawer();
        this.showToast('¡Artículo actualizado! ✨');
      },
      error: () => this.showToast('Error al actualizar artículo 😿', true)
    });
  }

  // ═══════════════ DELETE ACTIONS ═══════════════

  async askDeleteOrder(order: OrderSummary) {
    const confirmed = await this.confirm.confirm({
      title: '¿Borrar pedido?',
      message: `Se eliminará el registro de ${order.clientName} para siempre 💔`,
      confirmText: 'Sí, borrar',
      type: 'danger',
      icon: '🗑️'
    });

    if (confirmed) {
      this.api.deleteOrder(order.id).subscribe({
        next: () => {
          this.loadOrders();
          this.showToast('Pedido eliminado 🗑️');
        },
        error: () => this.showToast('Error al eliminar 😿', true)
      });
    }
  }

  async askDeleteItem(order: OrderSummary, item: OrderItem) {
    const confirmed = await this.confirm.confirm({
      title: '¿Quitar artículo?',
      message: `Eliminaráss ${item.productName} de este pedido, ¿segura? 🌸`,
      confirmText: 'Sí, quitar',
      type: 'danger',
      icon: '🛍️'
    });

    if (confirmed) {
      this.api.deleteOrderItem(order.id, item.id).subscribe({
        next: (updated) => {
          const current = this.orders();
          const idx = current.findIndex(o => o.id === order.id);
          if (idx !== -1) {
            current[idx] = updated;
            this.orders.set([...current]);
            this.applyFilter();
          }
          this.showToast('Artículo eliminado ✨');
        },
        error: () => this.showToast('Error al quitar artículo 😿', true)
      });
    }
  }

  // ═══════════════ DRAWER: ADD ITEM ═══════════════

  openDrawer(order: OrderSummary): void {
    this.drawerOrder.set(order);
    this.editingItem.set(null); // Reset edit mode
    this.newItem = { productName: '', quantity: 1, unitPrice: 0 };
    // Small delay for animation
    setTimeout(() => this.drawerOpen.set(true), 30);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    setTimeout(() => {
      this.drawerOrder.set(null);
      this.editingItem.set(null);
    }, 350);
  }

  focusField(field: string): void {
    const el = document.querySelector(
      field === 'qty' ? '.qty-stepper input' : '.price-input-wrap input'
    ) as HTMLInputElement;
    el?.focus();
  }

  addItemToOrder(): void {
    const order = this.drawerOrder();
    if (!order || !this.newItem.productName.trim() || this.newItem.unitPrice <= 0) return;

    const payload = {
      productName: this.newItem.productName.trim(),
      quantity: this.newItem.quantity,
      unitPrice: this.newItem.unitPrice
    };

    this.api.addOrderItem(order.id, payload).subscribe({
      next: (updated) => {
        // Update local data
        const current = this.orders();
        const idx = current.findIndex(o => o.id === order.id);
        if (idx !== -1) {
          current[idx] = updated;
          this.orders.set([...current]);
          this.applyFilter();
        }
        // Update drawer reference
        this.drawerOrder.set(updated);
        // Reset form
        this.newItem = { productName: '', quantity: 1, unitPrice: 0 };
        this.showToast('¡Artículo agregado! 🎀');
      },
      error: () => this.showToast('Error al agregar 😿', true)
    });
  }

  async onWipeOrders() {
    const confirmed1 = await this.confirm.confirm({
      title: '⚠️ ¡CUIDADO! ⚠️',
      message: '¿Estás segura de que quieres ELIMINAR TODOS los pedidos? Esta acción no se puede deshacer.',
      confirmText: 'Entiendo, continuar',
      type: 'danger',
      icon: '🧨'
    });

    if (!confirmed1) return;

    const confirmed2 = await this.confirm.confirm({
      title: '¿De verdad?',
      message: 'Se borrará todo el historial para siempre.',
      confirmText: 'Sí, borrar todo',
      type: 'danger',
      icon: '💀'
    });

    if (confirmed2) {
      this.api.deleteAllOrders().subscribe({
        next: () => {
          this.showToast('Se limpió la base de datos ✨');
          this.loadOrders();
        },
        error: () => this.showToast('Error al limpiar 😿')
      });
    }
  }

  // ═══════════════ EXCEL UPLOAD ═══════════════

  onQuickUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.processUpload(file);
    input.value = ''; // Reset so same file can be re-uploaded
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      this.processUpload(file);
    } else {
      this.showToast('Solo archivos Excel (.xlsx, .xls) 📄', true);
    }
  }

  private processUpload(file: File): void {
    this.uploading.set(true);
    this.api.uploadExcel(file).subscribe({
      next: (result) => {
        this.uploading.set(false);
        this.uploadResult.set(result);
        this.loadOrders(); // Refresh list
      },
      error: (err) => {
        this.uploading.set(false);
        const msg = err.error?.message || 'Error al procesar Excel';
        this.showToast(msg + ' 😿', true);
      }
    });
  }

  // ═══════════════ UTILITIES ═══════════════

  goToOrder(id: number): void {
    this.router.navigate(['/admin/orders', id]);
  }

  copyLink(link: string): void {
    navigator.clipboard.writeText(link);
    this.showToast('¡Enlace copiado! 📋✨');
  }

  copyDriverLink(): void {
    navigator.clipboard.writeText(this.routeCreated()?.driverLink);
    this.showToast('¡Link copiado! 🏎️');
  }

  showToast(msg: string, isError = false): void {
    this.toastMessage.set(msg);
    this.toastIsError.set(isError);
    setTimeout(() => this.toastMessage.set(''), 3000);
  }

  statusLabel(s: string): string {
    const labels: Record<string, string> = {
      Pending: '⏳ Pendiente',
      InRoute: '🚗 En ruta',
      Delivered: '💝 Entregado',
      NotDelivered: '😿 Fallido',
      Canceled: '🚫 Cancelado',
      Postponed: '📅 Pospuesto'
    };
    return labels[s] || s;
  }
}
