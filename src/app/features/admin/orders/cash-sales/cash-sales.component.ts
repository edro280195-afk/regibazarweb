import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { TandaService } from '../../../../core/services/tanda.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  ClientDto,
  ManualOrderRequest,
  OrderSummaryDto,
  TandaProductDto
} from '../../../../core/models';
import { normalizeOptionalAddress } from '../../../../core/utils/address.util';
import { buildMessengerLink, buildOrderMessage } from '../../../../core/utils/messenger.util';

interface CashSaleItem {
  id: string;
  productId?: string;
  productName: string;
  variant?: string;
  quantity: number;
  cashPrice: number;
  basePrice?: number;
}

@Component({
  selector: 'app-cash-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, RouterLink],
  templateUrl: './cash-sales.component.html',
  styleUrl: './cash-sales.component.css'
})
export class CashSalesComponent implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);
  private tandaService = inject(TandaService);
  private toast = inject(ToastService);
  private router = inject(Router);

  // Modo: 'form' (alta) o 'list' (pedidos con fecha abierta)
  activeTab = signal<'form' | 'list'>('form');

  // Datos de catálogo
  clients = signal<ClientDto[]>([]);
  tandaProducts = signal<TandaProductDto[]>([]);
  openOrders = signal<OrderSummaryDto[]>([]);
  loadingProducts = signal(false);
  loadingOrders = signal(false);
  saving = signal(false);

  // ── FORMULARIO: CLIENTA ──
  clientSearch = signal('');
  selectedClient = signal<ClientDto | null>(null);
  showClientSuggestions = signal(false);
  clientPhone = signal('');
  clientAddress = signal('');
  clientType = signal('Nueva');

  filteredClients = computed(() => {
    const q = this.clientSearch().toLowerCase().trim();
    if (q.length < 2) return [];
    return this.clients().filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    ).slice(0, 6);
  });

  // ── FORMULARIO: ARTÍCULO ACTUAL ──
  productSearch = signal('');
  selectedProduct = signal<TandaProductDto | null>(null);
  showProductSuggestions = signal(false);
  itemVariant = signal('');
  itemQuantity = signal(1);
  itemCashPrice = signal<number>(0);
  itemBasePrice = signal<number>(0);
  updateProductDefaultPrice = signal(false);

  // Lista de items agregados a esta venta
  saleItems = signal<CashSaleItem[]>([]);

  filteredProducts = computed(() => {
    const q = this.productSearch().toLowerCase().trim();
    if (!q) return this.tandaProducts().slice(0, 8);
    return this.tandaProducts().filter(p =>
      p.name?.toLowerCase().includes(q)
    ).slice(0, 8);
  });

  // Modal para crear nuevo producto de tanda rápido
  showNewProductModal = signal(false);
  newProductName = signal('');
  newProductBasePrice = signal<number>(0);
  newProductCashPrice = signal<number>(0);
  savingNewProduct = signal(false);

  // ── FORMULARIO: ENTREGA Y FECHA ──
  deliveryType = signal<'Delivery' | 'PickUp'>('Delivery');
  shippingCost = signal<number>(60);
  isOpenDate = signal(true);
  scheduledDate = signal('');
  deliveryInstructions = signal('');

  // ── FORMULARIO: PAGO ──
  paymentMode = signal<'full' | 'delivery' | 'partial'>('full');
  paymentMethod = signal<'Efectivo' | 'Transferencia' | 'Tarjeta'>('Efectivo');
  partialAmount = signal<number>(0);

  // ── MODAL DE ÉXITO ──
  createdOrder = signal<OrderSummaryDto | null>(null);

  // ── TOTALES CALCULADOS ──
  subtotal = computed(() =>
    this.saleItems().reduce((sum, item) => sum + (item.cashPrice * item.quantity), 0)
  );

  effectiveShipping = computed(() =>
    this.deliveryType() === 'PickUp' ? 0 : this.shippingCost()
  );

  total = computed(() => this.subtotal() + this.effectiveShipping());

  amountPaid = computed(() => {
    if (this.paymentMode() === 'full') return this.total();
    if (this.paymentMode() === 'partial') return Math.min(this.partialAmount(), this.total());
    return 0;
  });

  balanceDue = computed(() => Math.max(0, this.total() - this.amountPaid()));

  ngOnInit(): void {
    this.loadClients();
    this.loadTandaProducts();
    this.loadOpenOrders();
  }

  loadClients(): void {
    this.api.getClients().subscribe({
      next: (data) => this.clients.set(data),
      error: () => this.toast.error('No se pudo cargar la lista de clientas')
    });
  }

  loadTandaProducts(): void {
    this.loadingProducts.set(true);
    this.tandaService.getTandaProducts().subscribe({
      next: (products) => {
        this.tandaProducts.set(products.filter(p => p.isActive));
        this.loadingProducts.set(false);
      },
      error: () => {
        this.loadingProducts.set(false);
        this.toast.error('No se pudieron cargar los artículos de tanda');
      }
    });
  }

  loadOpenOrders(): void {
    this.loadingOrders.set(true);
    this.api.getOrders().subscribe({
      next: (allOrders) => {
        // Filtrar pedidos que son ventas al contado con fecha abierta o pendientes de ruta
        const open = (allOrders ?? []).filter(o =>
          o.status !== 'Canceled' &&
          o.status !== 'Delivered' &&
          (o.isOpenDate || (o.tags && o.tags.includes('ContadoTanda')) || o.scheduledDeliveryDate == null)
        );
        this.openOrders.set(open);
        this.loadingOrders.set(false);
      },
      error: () => this.loadingOrders.set(false)
    });
  }

  // ── SELECCIÓN DE CLIENTA ──
  selectClient(c: ClientDto): void {
    this.selectedClient.set(c);
    this.clientSearch.set(c.name);
    this.clientPhone.set(c.phone || '');
    this.clientAddress.set(c.address || '');
    this.clientType.set(c.type || 'Nueva');
    this.showClientSuggestions.set(false);
  }

  clearSelectedClient(): void {
    this.selectedClient.set(null);
    this.clientSearch.set('');
    this.clientPhone.set('');
    this.clientAddress.set('');
    this.clientType.set('Nueva');
  }

  // ── SELECCIÓN DE ARTÍCULO ──
  selectProduct(p: TandaProductDto): void {
    this.selectedProduct.set(p);
    this.productSearch.set(p.name);
    this.itemBasePrice.set(p.basePrice || 0);
    // Prioridad al precio de contado guardado; si no existe, usar basePrice o dejar en 0
    const initialCash = p.cashPrice != null && p.cashPrice > 0 ? p.cashPrice : (p.basePrice || 0);
    this.itemCashPrice.set(initialCash);
    this.showProductSuggestions.set(false);
  }

  addItemToSale(): void {
    const name = this.productSearch().trim();
    if (!name) {
      this.toast.error('Ingresa o selecciona un artículo de tanda');
      return;
    }
    const cashPrice = Number(this.itemCashPrice());
    if (cashPrice <= 0) {
      this.toast.error('Ingresa un precio de contado válido para este artículo');
      return;
    }
    const qty = Math.max(1, Number(this.itemQuantity()) || 1);

    const product = this.selectedProduct();
    const newItem: CashSaleItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      productId: product?.id,
      productName: name,
      variant: this.itemVariant().trim() || undefined,
      quantity: qty,
      cashPrice: cashPrice,
      basePrice: this.itemBasePrice()
    };

    this.saleItems.update(items => [...items, newItem]);

    // Si la dueña marcó guardar este precio como default de contado para el artículo
    if (product && this.updateProductDefaultPrice()) {
      this.tandaService.updateProductPrice(product.id, cashPrice, product.basePrice).subscribe({
        next: () => this.toast.info(`💾 Precio de contado ($${cashPrice}) guardado para ${product.name}`),
        error: () => {}
      });
    }

    // Reset de campos de item
    this.selectedProduct.set(null);
    this.productSearch.set('');
    this.itemVariant.set('');
    this.itemQuantity.set(1);
    this.itemCashPrice.set(0);
    this.itemBasePrice.set(0);
    this.updateProductDefaultPrice.set(false);
  }

  removeItem(index: number): void {
    this.saleItems.update(items => items.filter((_, i) => i !== index));
  }

  // ── CREAR NUEVO ARTÍCULO RÁPIDO ──
  openNewProductModal(): void {
    this.newProductName.set(this.productSearch().trim());
    this.newProductBasePrice.set(0);
    this.newProductCashPrice.set(0);
    this.showNewProductModal.set(true);
  }

  saveNewProduct(): void {
    const name = this.newProductName().trim();
    if (!name) {
      this.toast.error('El nombre del artículo es obligatorio');
      return;
    }
    const cash = Number(this.newProductCashPrice()) || 0;
    const base = Number(this.newProductBasePrice()) || cash;

    this.savingNewProduct.set(true);
    this.tandaService.createProduct(name, base, cash).subscribe({
      next: (created) => {
        this.savingNewProduct.set(false);
        this.showNewProductModal.set(false);
        this.tandaProducts.update(list => [...list, created]);
        this.selectProduct(created);
        this.toast.success(`✨ Artículo "${created.name}" registrado en el catálogo`);
      },
      error: () => {
        this.savingNewProduct.set(false);
        this.toast.error('No se pudo registrar el artículo en el catálogo');
      }
    });
  }

  // ── GUARDAR LA VENTA AL CONTADO ──
  saveCashSale(): void {
    const clientName = this.clientSearch().trim();
    if (!clientName) {
      this.toast.error('Indica el nombre de la clienta');
      return;
    }

    if (this.saleItems().length === 0) {
      this.toast.error('Agrega al menos un artículo a la venta');
      return;
    }

    if (this.deliveryType() === 'Delivery' && !this.clientAddress().trim()) {
      this.toast.error('Indica la dirección para entrega a domicilio');
      return;
    }

    this.saving.set(true);

    const deliveryAddress = normalizeOptionalAddress(this.clientAddress());
    const initialPaid = this.amountPaid();

    const request: ManualOrderRequest = {
      clientName: clientName,
      clientPhone: this.clientPhone().trim() || undefined,
      clientAddress: deliveryAddress || undefined,
      clientId: this.selectedClient()?.id,
      type: this.clientType() || 'Nueva',
      orderType: this.deliveryType(),
      items: this.saleItems().map(item => ({
        productName: item.variant ? `${item.productName} (${item.variant})` : item.productName,
        quantity: item.quantity,
        unitPrice: item.cashPrice
      })),
      isOpenDate: this.isOpenDate(),
      scheduledDeliveryDate: this.isOpenDate() ? undefined : (this.scheduledDate() || undefined),
      tags: 'ContadoTanda,FechaAbierta',
      initialPaymentAmount: initialPaid > 0 ? initialPaid : undefined,
      initialPaymentMethod: initialPaid > 0 ? this.paymentMethod() : undefined,
      deliveryInstructions: this.deliveryInstructions().trim() || undefined,
      forceNew: true
    };

    this.api.createManualOrder(request).subscribe({
      next: (orderSummary) => {
        this.saving.set(false);
        this.toast.success(`✨ Venta al contado #${orderSummary.id} registrada con éxito`);
        this.createdOrder.set(orderSummary);
        this.resetForm();
        this.loadOpenOrders();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err.error?.message || 'Error al registrar la venta al contado');
      }
    });
  }

  resetForm(): void {
    this.clearSelectedClient();
    this.saleItems.set([]);
    this.selectedProduct.set(null);
    this.productSearch.set('');
    this.itemVariant.set('');
    this.itemQuantity.set(1);
    this.itemCashPrice.set(0);
    this.itemBasePrice.set(0);
    this.deliveryType.set('Delivery');
    this.isOpenDate.set(true);
    this.scheduledDate.set('');
    this.deliveryInstructions.set('');
    this.paymentMode.set('full');
    this.partialAmount.set(0);
  }

  copyTrackingLink(order: OrderSummaryDto): void {
    if (!order.link) return;
    navigator.clipboard.writeText(order.link).then(() => {
      this.toast.success('📋 Enlace de seguimiento copiado al portapapeles');
    });
  }

  sendToMessenger(order: OrderSummaryDto): void {
    const msg = buildOrderMessage({
      clientName: order.clientName,
      publicLink: order.link,
      scheduledDeliveryDate: order.scheduledDeliveryDate,
      expiresAt: order.expiresAt,
      status: order.status
    });
    navigator.clipboard.writeText(msg).then(() => {
      this.toast.info('Mensaje copiado al portapapeles');
    });
    const link = buildMessengerLink(order.clientFacebookProfileUrl);
    if (link) {
      window.open(link, '_blank');
    } else if (order.clientFacebookProfileUrl) {
      window.open(order.clientFacebookProfileUrl, '_blank');
    } else {
      this.toast.info('Mensaje copiado. Abre Messenger para pegarlo a tu clienta');
    }
  }

  goToRouteBuilder(): void {
    this.router.navigate(['/admin/routes/builder']);
  }
}
