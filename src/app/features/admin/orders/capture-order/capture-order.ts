import { Component, inject, signal, computed, OnInit, ElementRef, ViewChild, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ClientDto, ManualOrderRequest, OrderType, ExcelUploadResultDto, OrderSummaryDto, PagedResult, ORDER_STATUS_CSS, CommonProductDto } from '../../../../core/models';

interface LiveCapture {
  id: string; // UUID
  rawText: string;
  parsed: {
    clientName: string;
    productDescription: string;
    quantity: number;
    totalPrice: number;
    unitPrice: number;
    confidence?: 'high' | 'medium' | 'low';
  };
  isConfirmed: boolean;
  timestamp: Date;
}

interface LiveOrder {
  id: string;
  clientName: string;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
  }[];
  orderType: string;
  selected: boolean;
  totalForSort: number;
}

interface TurboQueueItem {
  id: string;
  clientName: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  isExistingClient: boolean;
}

const NUMBER_WORDS: Record<string, number> = {
  'un': 1, 'una': 1, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
  'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10, 'once': 11, 'doce': 12,
  'quince': 15, 'veinte': 20, 'treinta': 30, 'cuarenta': 40, 'cincuenta': 50,
  'cien': 100, 'doscientos': 200, 'quinientos': 500, 'mil': 1000
};

function normalizeForMatch(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/(as|es|os|a|o|s)$/, '');
}

@Component({
  selector: 'app-capture-order',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  templateUrl: './capture-order.html',
  styleUrl: './capture-order.css'
})
export class CaptureOrderComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);



  mode = signal<'manual' | 'traditional' | 'live' | 'excel'>('manual');
  uploading = signal(false);

  // ═════════════════ SHARING RESULTS ═════════════════
  result = signal<ExcelUploadResultDto | null>(null);
  error = signal<string>('');

  // ═════════════════ EXCEL MODE ═════════════════
  dragging = signal(false);
  selectedFile = signal<File | null>(null);
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // ═════════════════ MANUAL MODE ═════════════════
  manualOrderType = 'Delivery';
  manualClient = signal('');
  manualAlternativeAddress = signal('');
  manualType = '';
  manualItems: { id: string; productName: string; quantity: number; unitPrice: number }[] = [];
  currentItem = { productName: '', quantity: 1, unitPrice: 0 };

  clients = signal<ClientDto[]>([]);
  showSuggestions = signal(false);
  autoDetected = signal(false);

  filteredClients = computed(() => {
    const s = this.manualClient().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!s) return [];
    return this.clients().filter(c => {
      const clientName = c.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
      return clientName.includes(s);
    }).slice(0, 8);
  });

  @ViewChild('manualQtyInput') manualQtyInput!: ElementRef<HTMLInputElement>;
  @ViewChild('manualPriceInput') manualPriceInput!: ElementRef<HTMLInputElement>;

  // ═════════════════ TURBO MODE ═════════════════
  turboInput = signal('');
  turboOrderType = 'Delivery';
  showTurboSuggestions = signal(false);
  pinnedProduct = signal<{ name: string; price: number } | null>(null);
  showPinForm = signal(false);
  pinProductName = '';
  pinProductPrice = 0;
  turboQueue = signal<TurboQueueItem[]>([]);
  lastAdded = signal<TurboQueueItem | null>(null);
  turboProgress = signal('');
  selectedSuggestionIdx = signal(-1);

  turboSearchTerm = computed(() => {
    const input = this.turboInput().trim();
    if (!input) return '';
    if (this.pinnedProduct()) {
      return input.split(/\s+/)[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } else {
      return input.split(',')[0].trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
  });

  turboFilteredClients = computed(() => {
    const s = this.turboSearchTerm();
    if (!s || s.length < 1) return [];
    return this.clients().filter(c => {
      const cn = c.name?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
      return cn.includes(s);
    }).slice(0, 6);
  });

  turboTotal = computed(() => this.turboQueue().reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0));

  turboGroupedQueue = computed(() => {
    const grouped = new Map<string, { clientName: string; items: TurboQueueItem[]; total: number }>();
    // Iterate in reverse so newest items appear first in each group
    const queue = [...this.turboQueue()];
    for (const item of queue) {
      const key = item.clientName.toLowerCase().trim();
      if (!grouped.has(key)) {
        grouped.set(key, { clientName: item.clientName, items: [], total: 0 });
      }
      const g = grouped.get(key)!;
      g.items.push(item);
      g.total += item.unitPrice * item.quantity;
    }
    return Array.from(grouped.values());
  });

  turboClientCount = computed(() => this.turboGroupedQueue().length);

  // ═════════════════ AI LIVE MODE ═════════════════
  isListening = signal(false);
  recognition: any;
  interimTranscript = signal('');
  liveTranscript = signal('');
  isAnalyzing = signal(false);

  // Inline AI results (staggered display)
  aiResults = signal<{ id: string; clientName: string; productName: string; quantity: number; unitPrice: number; visible: boolean }[]>([]);
  aiTotal = computed(() => this.aiResults().reduce((s, r) => s + r.unitPrice * r.quantity, 0));
  aiVisibleCount = computed(() => this.aiResults().filter(r => r.visible).length);
  aiSubmitting = signal(false);
  aiProgress = signal('');

  textInput = '';

  // ═════════════════ INIT & DESTROY ═════════════════
  ngOnInit() {
    this.api.getClients().subscribe({
      next: (data) => this.clients.set(data),
      error: () => console.log('Error silenciado cargando clientas base')
    });
    this.initSpeechRecognition();
  }

  ngOnDestroy() {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  // ═════════════════ EXCEL METHODS ═════════════════
  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    if (event.dataTransfer?.files?.length) {
      this.selectedFile.set(event.dataTransfer.files[0]);
      this.result.set(null);
      this.error.set('');
    }
  }

  onFileSelect(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.selectedFile.set(file);
      this.result.set(null);
      this.error.set('');
    }
  }

  uploadExcel() {
    if (!this.selectedFile()) {
      this.toast.warning('Por favor selecciona un archivo Excel');
      return;
    }
    this.uploading.set(true);
    this.error.set('');
    this.result.set(null);

    this.api.uploadExcel(this.selectedFile()!).subscribe({
      next: (res) => {
        this.result.set(res);
        this.uploading.set(false);
        this.selectedFile.set(null);
        if (this.fileInput?.nativeElement) this.fileInput.nativeElement.value = '';
        this.toast.success(`¡Listo! ${res.ordersCreated} pedidos mágicamente creados ✨`);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error desconocido al subir Excel 😿');
        this.uploading.set(false);
      }
    });
  }

  // ═════════════════ MANUAL METHODS ═════════════════
  onSearchClient() {
    this.showSuggestions.set(true);
    // If the input exactly matches a client (case insensitive & ignoring accents), auto-select it
    const searchVal = this.manualClient().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const exactMatch = this.clients().find(c => {
      const clientName = c.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
      return clientName === searchVal;
    });
    if (exactMatch) {
      this.autoDetected.set(true);
      this.manualType = (exactMatch.ordersCount && exactMatch.ordersCount >= 1) ? 'Frecuente' : 'Nueva';
    } else {
      this.autoDetected.set(false);
      this.manualType = ''; // Clear type if no exact match
    }
  }

  selectClient(client: ClientDto) {
    this.manualClient.set(client.name);
    this.showSuggestions.set(false);
    this.autoDetected.set(true);
    this.manualType = (client.ordersCount && client.ordersCount >= 1) ? 'Frecuente' : 'Nueva';

    // Auto-focus next field
    setTimeout(() => {
      const productInput = document.querySelector('input[placeholder="Ej. Tapete rosa"]') as HTMLInputElement;
      if (productInput) productInput.focus();
    }, 50);
  }

  hideSuggestionsWithDelay() {
    setTimeout(() => this.showSuggestions.set(false), 200);
  }

  addCurrentItem() {
    if (!this.currentItem.productName.trim() || this.currentItem.unitPrice <= 0 || this.currentItem.quantity <= 0) {
      this.toast.warning('Llena todos los datos del artículo (cantidad y precio > 0) 🌸');
      return;
    }

    this.manualItems.push({ id: crypto.randomUUID(), ...this.currentItem });
    this.currentItem = { productName: '', quantity: 1, unitPrice: 0 };

    // Focus back on product name for the next item easily
    setTimeout(() => {
      const productInput = document.querySelector('input[placeholder="Ej. Tapete rosa"]') as HTMLInputElement;
      if (productInput) productInput.focus();
    }, 50);
  }

  removeItem(id: string) {
    this.manualItems = this.manualItems.filter(item => item.id !== id);
  }

  focusManualField(field: 'qty' | 'price' | 'add') {
    if (field === 'qty') this.manualQtyInput?.nativeElement.focus();
    else if (field === 'price') this.manualPriceInput?.nativeElement.focus();
    else if (field === 'add') this.addCurrentItem();
  }

  getManualTotal(): number {
    return this.manualItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }

  createManual() {
    if (!this.manualClient().trim()) {
      this.toast.warning('¿A quién le vendemos? Falta la clienta 💁‍♀️');
      return;
    }
    if (!this.manualType) {
      this.toast.warning('¿Es nueva o frecuente? Selecciona su tipo 🎀');
      return;
    }
    if (this.manualItems.length === 0) {
      this.toast.warning('¡No hay artículos en el carrito! 🛒');
      return;
    }

    this.uploading.set(true);
    this.error.set('');

    const req: ManualOrderRequest = {
      clientName: this.manualClient().trim(),
      alternativeAddress: this.manualAlternativeAddress().trim(),
      type: this.manualType || 'Nueva',
      orderType: this.manualOrderType,
      items: this.manualItems.map(i => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice }))
    };

    this.api.createManualOrder(req).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.toast.success(`Pedido creado para ${this.manualClient()} 💖`);

        // Reset manual form securely
        this.manualClient.set('');
        this.manualAlternativeAddress.set('');
        this.manualType = '';
        this.autoDetected.set(false);
        this.manualItems = [];
        this.currentItem = { productName: '', quantity: 1, unitPrice: 0 };
        this.manualOrderType = 'Delivery';

        // Set single result format if needed, but not strictly required by user flow
        // The original logic just showed a toast. If we want link preview:
        this.result.set({
          ordersCreated: 1, clientsCreated: req.type === 'Nueva' ? 1 : 0, warnings: [],
          orders: [{ id: res.id, clientName: res.clientName, total: res.total, orderType: res.orderType, link: res.link, items: res.items.map(i => ({ id: i.id, productName: i.productName, quantity: i.quantity })) }]
        });
      },
      error: (err) => {
        this.uploading.set(false);
        this.error.set(err.error?.message || 'Hubo un error al crear el pedido manual 🥺');
      }
    });
  }

  // ═════════════════ TURBO METHODS ═════════════════
  setPin() {
    if (!this.pinProductName.trim() || this.pinProductPrice <= 0) return;
    this.pinnedProduct.set({ name: this.pinProductName.trim(), price: this.pinProductPrice });
    this.showPinForm.set(false);
    this.pinProductName = '';
    this.pinProductPrice = 0;
    setTimeout(() => (document.querySelector('.turbo-input') as HTMLInputElement)?.focus(), 50);
  }

  clearPin() { this.pinnedProduct.set(null); }

  onTurboType() {
    this.showTurboSuggestions.set(true);
    this.lastAdded.set(null);
    this.selectedSuggestionIdx.set(-1);
  }

  onTurboKeydown(event: KeyboardEvent) {
    const suggestions = this.turboFilteredClients();
    const hasSuggestions = this.showTurboSuggestions() && suggestions.length > 0;

    // Ctrl+Enter = submit queue
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      this.submitTurboQueue();
      return;
    }

    // Escape = clear input or close suggestions
    if (event.key === 'Escape') {
      event.preventDefault();
      if (hasSuggestions) {
        this.showTurboSuggestions.set(false);
        this.selectedSuggestionIdx.set(-1);
      } else {
        this.turboInput.set('');
      }
      return;
    }

    // Arrow navigation in suggestions
    if (event.key === 'ArrowDown' && hasSuggestions) {
      event.preventDefault();
      this.selectedSuggestionIdx.update(i => (i + 1) % suggestions.length);
      return;
    }
    if (event.key === 'ArrowUp' && hasSuggestions) {
      event.preventDefault();
      this.selectedSuggestionIdx.update(i => i <= 0 ? suggestions.length - 1 : i - 1);
      return;
    }

    // Enter = select suggestion OR parse input
    if (event.key === 'Enter') {
      event.preventDefault();
      const idx = this.selectedSuggestionIdx();
      if (hasSuggestions && idx >= 0 && idx < suggestions.length) {
        this.selectTurboClient(suggestions[idx]);
        this.selectedSuggestionIdx.set(-1);
      } else {
        this.onTurboEnter();
      }
      return;
    }
  }

  hideTurboSuggestionsDelay() {
    setTimeout(() => { this.showTurboSuggestions.set(false); this.selectedSuggestionIdx.set(-1); }, 200);
  }

  selectTurboClient(client: ClientDto) {
    const pin = this.pinnedProduct();
    if (pin) {
      // Fill client name into input so user can type variant, then Enter to add
      this.turboInput.set(client.name + ', ');
      this.showTurboSuggestions.set(false);
    } else {
      const input = this.turboInput().trim();
      const commaIdx = input.indexOf(',');
      this.turboInput.set(commaIdx > -1 ? client.name + input.substring(commaIdx) : client.name + ', ');
      this.showTurboSuggestions.set(false);
    }
    setTimeout(() => (document.querySelector('.turbo-input') as HTMLInputElement)?.focus(), 50);
  }

  onTurboEnter() {
    const input = this.turboInput().trim();
    if (!input) return;
    const pin = this.pinnedProduct();

    if (pin) {
      let clientName: string;
      let variant = '';
      let isExisting = false;

      const commaIdx = input.indexOf(',');
      if (commaIdx > -1) {
        // Formato: Client Name, Variant
        clientName = this.capitalizeWords(input.substring(0, commaIdx).trim());
        variant = input.substring(commaIdx + 1).trim();
        const matched = this.findBestClientMatch(clientName);
        if (matched) {
          clientName = matched.name;
          isExisting = true;
        }
      } else {
        // No comma: take whole input as client name
        clientName = this.capitalizeWords(input);
        const matched = this.findBestClientMatch(clientName, true); // Strict match
        if (matched) {
          clientName = matched.name;
          isExisting = true;
        } else {
          isExisting = false;
        }
        variant = '';
      }

      const productName = variant ? `${pin.name} ${variant}` : pin.name;
      this.addItemToQueue(clientName, productName, 1, pin.price, isExisting);
    } else {
      const parsed = this.parseTurboFreeText(input);
      if (!parsed) { this.toast.warning('Formato: Nombre, Artículo, Precio 💡'); return; }
      const matched = this.findBestClientMatch(parsed.clientName);
      this.addItemToQueue(matched ? matched.name : parsed.clientName, parsed.productName, parsed.quantity, parsed.unitPrice, !!matched);
    }

    this.turboInput.set('');
    this.showTurboSuggestions.set(false);
    setTimeout(() => (document.querySelector('.turbo-input') as HTMLInputElement)?.focus(), 50);
  }

  private findBestClientMatch(input: string, exactOnly = false): ClientDto | null {
    const n = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const sorted = [...this.clients()].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
    for (const c of sorted) {
      const cn = c.name?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
      if (exactOnly) {
        if (n === cn) return c;
      } else {
        if (n.startsWith(cn + ' ') || n === cn) return c;
      }
    }
    return null;
  }

  private parseTurboFreeText(text: string): { clientName: string; productName: string; quantity: number; unitPrice: number } | null {
    const chunks = text.split(',').map(s => s.trim()).filter(Boolean);
    if (chunks.length >= 2) {
      let clientName = chunks[0];
      let price = 0;
      let quantity = 1;
      for (let i = chunks.length - 1; i >= 1; i--) {
        const nums = chunks[i].replace(/pesos?/gi, '').trim().match(/\d+(\.\d+)?/g);
        if (nums) {
          price = parseFloat(nums[nums.length - 1]);
          if (price > 0) {
            const qtyMatch = chunks[i].match(/^(\d+)\s+/);
            if (qtyMatch && parseInt(qtyMatch[1]) <= 20) quantity = parseInt(qtyMatch[1]);
            chunks.splice(i, 1);
            break;
          }
        }
      }
      const productName = chunks.slice(1).join(' ') || 'Artículo';
      clientName = this.capitalizeWords(clientName);
      if (price <= 0) return null;
      return { clientName, productName, quantity, unitPrice: price / quantity };
    }
    // Fallback: space-separated
    const words = text.split(/\s+/);
    let price = 0; let priceIdx = -1;
    for (let i = words.length - 1; i >= 0; i--) {
      const clean = words[i].replace(/pesos?/gi, '').trim();
      if (!isNaN(Number(clean)) && Number(clean) > 0) { price = Number(clean); priceIdx = i; break; }
    }
    if (price <= 0 || priceIdx < 1) return null;
    return { clientName: this.capitalizeWords(words[0]), productName: words.slice(1, priceIdx).join(' ') || 'Artículo', quantity: 1, unitPrice: price };
  }

  private capitalizeWords(t: string): string {
    return t.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  private addItemToQueue(clientName: string, productName: string, quantity: number, unitPrice: number, isExisting: boolean) {
    const item: TurboQueueItem = { id: crypto.randomUUID(), clientName, productName, quantity, unitPrice, isExistingClient: isExisting };
    this.turboQueue.update(q => [item, ...q]);
    this.lastAdded.set(item);
    this.toast.success(`${clientName} → ${productName} ✨`);
    setTimeout(() => { if (this.lastAdded()?.id === item.id) this.lastAdded.set(null); }, 3000);
  }

  removeFromQueue(id: string) {
    this.turboQueue.update(q => q.filter(i => i.id !== id));
  }

  updateQueueItem(id: string, updates: Partial<TurboQueueItem>) {
    this.turboQueue.update(q => q.map(i => {
      if (i.id === id) {
        const updated = { ...i, ...updates };
        // If client name changed, re-check if it's an existing client
        if (updates.clientName) {
          const matched = this.findBestClientMatch(updates.clientName);
          updated.isExistingClient = !!matched;
          if (matched) updated.clientName = matched.name;
        }
        return updated;
      }
      return i;
    }));
  }

  updateGroupClientName(oldName: string, newName: string) {
    if (!newName.trim() || oldName === newName) return;
    const capitalized = this.capitalizeWords(newName);
    const matched = this.findBestClientMatch(capitalized);
    const finalName = matched ? matched.name : capitalized;
    
    this.turboQueue.update(q => q.map(i => 
      i.clientName.toLowerCase().trim() === oldName.toLowerCase().trim() 
        ? { ...i, clientName: finalName, isExistingClient: !!matched } 
        : i
    ));
  }

  submitTurboQueue() {
    const queue = this.turboQueue();
    if (queue.length === 0) return;

    const grouped = new Map<string, TurboQueueItem[]>();
    queue.forEach(item => {
      const key = item.clientName.toLowerCase().trim();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    });

    const orders = Array.from(grouped.entries()).map(([_, items]) => ({
      clientName: items[0].clientName,
      items: items.map(i => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice }))
    }));

    this.uploading.set(true);
    let successCount = 0;
    const finalResults: any[] = [];

    const process = (idx: number) => {
      if (idx >= orders.length) {
        this.uploading.set(false);
        this.turboProgress.set('');
        this.toast.success(`¡${successCount} pedidos creados! 💖`);
        this.result.set({ ordersCreated: successCount, clientsCreated: 0, warnings: [], orders: finalResults });
        this.turboQueue.set([]);
        this.lastAdded.set(null);
        return;
      }
      const o = orders[idx];
      this.turboProgress.set(`${o.clientName} (${idx + 1}/${orders.length})...`);
      
      // Determine client type dynamically instead of hardcoding 'Nueva'
      const matched = this.findBestClientMatch(o.clientName);
      const determinedType = (matched && matched.ordersCount && matched.ordersCount >= 1) ? 'Frecuente' : 'Nueva';

      const req: ManualOrderRequest = { 
        clientName: o.clientName, 
        type: determinedType, 
        orderType: this.turboOrderType, 
        items: o.items 
      };
      this.api.createManualOrder(req).subscribe({
        next: (res) => {
          successCount++;
          finalResults.push({ id: res.id, clientName: res.clientName, total: res.total, orderType: res.orderType, link: res.link, items: res.items.map(i => ({ id: i.id, productName: i.productName, quantity: i.quantity })) });
          process(idx + 1);
        },
        error: () => { this.toast.error(`Error con ${o.clientName} 😿`); process(idx + 1); }
      });
    };
    process(0);
  }

  // ═════════════════ LIVE MODE METHODS ═════════════════
  private initSpeechRecognition() {
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'es-MX'; // Mexican Spanish best for "pesos", specific names

    this.recognition.onstart = () => {
      this.isListening.set(true);
      this.cdr.detectChanges();
    };

    this.recognition.onresult = (event: any) => {
      let interim = '';
      let finalStr = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalStr += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      this.interimTranscript.set(interim);

      if (finalStr.trim()) {
        this.processTextChunk(finalStr.trim());
      }
      this.cdr.detectChanges();
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        this.isListening.set(false);
        this.toast.error('Gegi no tiene permiso para el micrófono 😭');
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if we think we should still be listening
      if (this.isListening()) {
        try {
          this.recognition.start();
        } catch (e) { /* might already be started */ }
      } else {
        this.isListening.set(false);
        this.cdr.detectChanges();
      }
    };
  }

  startListening() {
    if (!this.recognition) {
      this.toast.error('Tu navegador no soporta captura de voz. Usa el teclado 🥺');
      return;
    }
    
    // Prevent default context menu on long press
    document.oncontextmenu = () => false;

    if (!this.isListening()) {
      this.isListening.set(true);
      try {
        this.recognition.start();
      } catch (e) { }
    }
  }

  stopListeningAndAnalyze() {
    document.oncontextmenu = null; // restore context menu
    
    if (this.isListening()) {
      this.isListening.set(false);
      this.recognition.stop();
      
      // If we have some transcript accumulated, auto analyze
      setTimeout(() => {
         if (this.liveTranscript().trim() && !this.isAnalyzing()) {
           this.analyzeWithAI();
         }
      }, 500); // Give the speech recognizer a split second to finish the last phrase
    }
  }

  onTextSubmit() {
    if (!this.textInput.trim()) return;
    this.processTextChunk(this.textInput.trim());
    this.textInput = '';
  }

  private processTextChunk(text: string) {
    // Append to accumulated transcript for AI analysis
    const current = this.liveTranscript().trim();
    this.liveTranscript.set(current ? current + '. ' + text : text);
    this.cdr.detectChanges();
  }

  analyzeWithAI() {
    const text = this.liveTranscript().trim();
    if (!text) {
      this.toast.warning('Escribe o dicta algo primero 🎤');
      return;
    }

    if (this.isListening()) {
      this.isListening.set(false);
      this.recognition.stop();
    }

    this.isAnalyzing.set(true);

    // Get current state to pass to API
    const currentState = this.aiResults().map(r => ({
      clientName: r.clientName,
      productName: r.productName,
      quantity: r.quantity,
      unitPrice: r.unitPrice
    }));

    this.api.parseLiveText(text, currentState).subscribe({
      next: (orders) => {
        this.isAnalyzing.set(false);
        if (orders.length === 0) {
          if (currentState.length > 0) {
             this.toast.info('Carrito vaciado 🗑️');
             this.aiResults.set([]);
          } else {
             this.toast.warning('No se detectaron pedidos. Intenta con más detalle 💬');
          }
          this.liveTranscript.set('');
          return;
        }

        const currentResults = this.aiResults();

        // Map to editable results
        const results = orders.map(o => {
          const matched = this.findBestClientMatch(o.clientName);
          const finalClientName = matched ? matched.name : this.capitalizeWords(o.clientName);

          // Find if this item existed in the previous state to prevent re-animating
          const existing = currentResults.find(r => 
            r.clientName.toLowerCase() === finalClientName.toLowerCase() && 
            r.productName.toLowerCase() === o.productName.toLowerCase()
          );

          return {
            id: existing ? existing.id : crypto.randomUUID(),
            clientName: finalClientName,
            productName: o.productName,
            quantity: o.quantity,
            unitPrice: o.unitPrice,
            visible: existing ? true : false
          };
        });

        this.aiResults.set(results);

        // Staggered reveal ONLY for new hidden items
        const newItems = results.filter(r => !r.visible);
        newItems.forEach((item, idx) => {
          setTimeout(() => {
            this.aiResults.update(arr => arr.map(r => r.id === item.id ? { ...r, visible: true } : r));
            this.cdr.detectChanges();
          }, 200 * (idx + 1));
        });

        if (newItems.length > 0) {
           this.toast.success(`✨ ${newItems.length} pedidos nuevos agregados`);
        } else {
           this.toast.success(`✨ Carrito actualizado con éxito`);
        }
        this.liveTranscript.set('');
      },
      error: (err) => {
        console.error('AI parse error', err);
        this.isAnalyzing.set(false);
        this.toast.error('Error al analizar con IA 😿');
      }
    });
  }

  removeAiResult(id: string) {
    this.aiResults.update(arr => arr.filter(r => r.id !== id));
  }

  submitAiResults() {
    const results = this.aiResults().filter(r => r.visible);
    if (results.length === 0) return;

    // Group by client name
    const grouped = new Map<string, typeof results>();
    results.forEach(r => {
      const key = r.clientName.toLowerCase().trim();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    });

    this.aiSubmitting.set(true);
    const entries = Array.from(grouped.entries());
    let doneCount = 0;

    const process = (idx: number) => {
      if (idx >= entries.length) {
        this.aiSubmitting.set(false);
        this.aiResults.set([]);
        this.toast.success(`💖 ${doneCount} pedidos creados`);
        return;
      }

      const [, items] = entries[idx];
      const clientName = items[0].clientName;
      this.aiProgress.set(`Creando ${clientName} (${idx + 1}/${entries.length})...`);

      // Determine client type dynamically
      const matched = this.findBestClientMatch(clientName);
      const determinedType = (matched && matched.ordersCount && matched.ordersCount >= 1) ? 'Frecuente' : 'Nueva';

      this.api.createManualOrder({
        clientName,
        type: determinedType,
        orderType: 'Delivery',
        items: items.map(i => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice }))
      }).subscribe({
        next: () => { doneCount++; process(idx + 1); },
        error: () => { this.toast.error(`Error con ${clientName} 😿`); process(idx + 1); }
      });
    };
    process(0);
  }

  private parseLiveString(text: string) {
    // 1. Clean up common noise
    let clean = text.toLowerCase()
      .replace(/pesos/g, '')
      .replace(/cuesta/g, '')
      .replace(/vale/g, '')
      .replace(/por favor/g, '')
      .replace(/para /g, ','); // "algo para fulana" -> "algo, fulana"

    // Remove punctuation except commas
    clean = clean.replace(/[.!?]/g, '');

    const chunks = clean.split(',').map(s => s.trim()).filter(Boolean);

    let clientName = '';
    let productDescription = 'Articulo Live';
    let quantity = 1;
    let totalPrice = 0;

    // A common structure is: [Name] [Product] [Price]  (separated by commas or 'y' or spaces)
    // If we have commas, try to assign by type
    if (chunks.length >= 2) {
      // Find price (chunk with numbers)
      for (let i = chunks.length - 1; i >= 0; i--) {
        const numbers = chunks[i].match(/\d+/g);
        if (numbers && numbers.length > 0) {
          const possiblePrice = parseInt(numbers[numbers.length - 1], 10);
          if (possiblePrice > 10) { // Assume > 10 is price
            totalPrice = possiblePrice;

            // Look for quantity
            const otherNumbers = chunks[i].match(/\b[1-9]\b/);
            if (otherNumbers && parseInt(otherNumbers[0], 10) < 10) {
              quantity = parseInt(otherNumbers[0], 10);
            }

            chunks.splice(i, 1); // remove from chunks
            break;
          }
        }
      }

      // Remaining: probably name and product
      if (chunks.length > 0) clientName = chunks[0];
      if (chunks.length > 1) productDescription = chunks[1];

    } else {
      // Space-based heuristic
      const words = clean.split(' ');
      // Numbers for price
      for (const w of words) {
        if (!isNaN(Number(w)) && Number(w) > 10) {
          totalPrice = Number(w);
          break; // first large number is price
        }
      }

      // Numbers/Words for qty
      const wordsWithoutPriceStr = clean.replace(totalPrice.toString(), '').trim().split(' ');
      for (const w of words) { // Changed from wordsWithoutPriceStr to words to re-evaluate all words
        if (!isNaN(Number(w)) && Number(w) > 0 && Number(w) <= 10) {
          quantity = Number(w);
          break;
        }
        if (NUMBER_WORDS[w]) {
          quantity = NUMBER_WORDS[w];
          break;
        }
      }

      // Name usually first word
      const nameMatch = clean.match(/^[a-z]+/i);
      if (nameMatch) clientName = nameMatch[0];

      // Rest is product
      productDescription = clean
        .replace(clientName.toLowerCase(), '')
        .replace(totalPrice.toString(), '')
        .replace(quantity.toString(), '')
        .trim();

      if (productDescription.length < 2) productDescription = 'Articulo Live';
    }

    // Capitalize Name
    clientName = clientName.charAt(0).toUpperCase() + clientName.slice(1);

    return {
      clientName: clientName.trim(),
      productDescription: productDescription.trim() || 'Articulo',
      quantity: quantity,
      totalPrice: totalPrice,
      unitPrice: totalPrice / quantity
    };
  }

  // (Legacy manual capture functions removed)

  // ═════════════════ RESULTS METHODS ═════════════════
  copyAllLinks() {
    if (!this.result()) return;
    const text = this.result()!.orders.map((o: any) => `¡Hola bonita! Aquí está el ticket de tu pedido (total: $${o.total.toFixed(2)}): \n${o.link}`).join('\n\n');
    navigator.clipboard.writeText(text);
    this.toast.success('¡Todos los enlaces copiados! 📋');
  }

  copyLink(input: HTMLInputElement) {
    input.select();
    document.execCommand('copy');
    this.toast.success('Enlace copiado al portapapeles ✨');
  }
}
