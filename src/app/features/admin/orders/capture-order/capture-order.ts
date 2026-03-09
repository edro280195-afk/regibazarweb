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



  mode = signal<'manual' | 'live' | 'excel'>('manual');
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
  manualClientType = '';
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

  // ═════════════════ LIVE MODE ═════════════════
  livePhase = signal<'setup' | 'capturing' | 'review'>('setup');
  isListening = signal(false);
  recognition: any;
  interimTranscript = signal('');

  textInput = '';
  parsedPreview = signal<LiveCapture | null>(null);
  liveCaptures = signal<LiveCapture[]>([]);
  reviewOrders = signal<LiveOrder[]>([]);

  liveCreating = signal(false);
  liveCreateProgress = signal('');

  liveTotalAmount = computed(() => {
    return this.liveCaptures().reduce((sum, cap) => sum + cap.parsed.totalPrice, 0);
  });

  liveSelectedCount = computed(() => {
    return this.reviewOrders().filter(o => o.selected).length;
  });

  liveSelectedTotal = computed(() => {
    return this.reviewOrders()
      .filter(o => o.selected)
      .reduce((sum, o) => sum + o.totalForSort, 0);
  });

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
      this.manualClientType = (exactMatch.ordersCount && exactMatch.ordersCount >= 2) ? 'Frecuente' : 'Nueva';
    } else {
      this.autoDetected.set(false);
      this.manualClientType = ''; // Clear type if no exact match
    }
  }

  selectClient(client: ClientDto) {
    this.manualClient.set(client.name);
    this.showSuggestions.set(false);
    this.autoDetected.set(true);
    this.manualClientType = (client.ordersCount && client.ordersCount >= 2) ? 'Frecuente' : 'Nueva';

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
    if (!this.manualClientType) {
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
      clientType: this.manualClientType || 'Nueva',
      orderType: this.manualOrderType,
      items: this.manualItems.map(i => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice }))
    };

    this.api.createManualOrder(req).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.toast.success(`Pedido creado para ${this.manualClient()} 💖`);

        // Reset manual form securely
        this.manualClient.set('');
        this.manualClientType = '';
        this.autoDetected.set(false);
        this.manualItems = [];
        this.currentItem = { productName: '', quantity: 1, unitPrice: 0 };
        this.manualOrderType = 'Delivery';

        // Set single result format if needed, but not strictly required by user flow
        // The original logic just showed a toast. If we want link preview:
        this.result.set({
          ordersCreated: 1, clientsCreated: req.clientType === 'Nueva' ? 1 : 0, warnings: [],
          orders: [{ id: res.id, clientName: res.clientName, total: res.total, orderType: res.orderType, link: res.link, items: res.items.map(i => ({ id: i.id, productName: i.productName, quantity: i.quantity })) }]
        });
      },
      error: (err) => {
        this.uploading.set(false);
        this.error.set(err.error?.message || 'Hubo un error al crear el pedido manual 🥺');
      }
    });
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
      if (this.isListening() && this.livePhase() === 'capturing') {
        try {
          this.recognition.start();
        } catch (e) { /* might already be started */ }
      } else {
        this.isListening.set(false);
        this.cdr.detectChanges();
      }
    };
  }

  startLive() {
    this.livePhase.set('capturing');
  }

  toggleListening() {
    if (!this.recognition) {
      this.toast.error('Tu navegador no soporta captura de voz. Usa el teclado 🥺');
      return;
    }

    if (this.isListening()) {
      this.isListening.set(false);
      this.recognition.stop();
    } else {
      this.isListening.set(true);
      try {
        this.recognition.start();
      } catch (e) {
        // If already started
      }
    }
  }

  onTextSubmit() {
    if (!this.textInput.trim()) return;
    this.processTextChunk(this.textInput.trim());
    this.textInput = '';
  }

  private processTextChunk(text: string) {
    // Advanced parsing logic for "Ana, vestido, 200 pesos" or "2 blusas para maria, 300"
    const parsed = this.parseLiveString(text);

    // Stop listening temporarily to review if we found something highly probable
    if (parsed.clientName && parsed.totalPrice > 0) {
      if (this.isListening()) {
        // We keep listening but we set the preview
      }
    }

    this.parsedPreview.set({
      id: crypto.randomUUID(),
      rawText: text,
      parsed: parsed,
      isConfirmed: false,
      timestamp: new Date()
    });

    this.cdr.detectChanges();
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

  confirmPreview() {
    if (!this.parsedPreview()) return;

    // Auto-Correct Name capitalization fully
    let name = this.parsedPreview()!.parsed.clientName.trim();
    if (name) {
      name = name.split(' ').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ');
      this.parsedPreview()!.parsed.clientName = name;
    }

    // Add to feed
    this.liveCaptures.update(c => [this.parsedPreview()!, ...c]);
    this.toast.success(`Capturado: ${name} ✨`);
    this.parsedPreview.set(null);
    this.interimTranscript.set('');
  }

  discardCapture() {
    this.parsedPreview.set(null);
    this.interimTranscript.set('');
  }

  deleteCapture(id: string) {
    this.liveCaptures.update(c => c.filter(x => x.id !== id));
  }

  startReview() {
    // Transform captures into Review Orders (grouping by client)
    const grouped = new Map<string, LiveOrder>();

    this.liveCaptures().forEach(cap => {
      const clientKey = cap.parsed.clientName.toLowerCase().trim();
      if (!grouped.has(clientKey)) {
        grouped.set(clientKey, {
          id: crypto.randomUUID(),
          clientName: cap.parsed.clientName,
          items: [],
          orderType: 'Delivery', // Default
          selected: true,
          totalForSort: 0
        });
      }

      const order = grouped.get(clientKey)!;
      order.items.push({
        productName: cap.parsed.productDescription,
        quantity: cap.parsed.quantity,
        unitPrice: cap.parsed.unitPrice
      });
      order.totalForSort += cap.parsed.totalPrice;
    });

    this.reviewOrders.set(Array.from(grouped.values()));

    if (this.isListening()) {
      this.toggleListening(); // Stop mic
    }
    this.livePhase.set('review');
  }

  backToCapturing() {
    this.livePhase.set('capturing');
  }

  submitAllOrders() {
    const toSubmit = this.reviewOrders().filter(o => o.selected);
    if (toSubmit.length === 0) return;

    this.liveCreating.set(true);
    let successCount = 0;
    const finalResultOrders: any[] = [];

    // Sequential submission to avoid saturating API potentially
    const processOrder = (index: number) => {
      if (index >= toSubmit.length) {
        // Finished
        this.liveCreating.set(false);
        this.toast.success(`¡Misión cumplida! ${successCount} pedidos creados 💖`);

        this.result.set({
          ordersCreated: successCount,
          clientsCreated: 0, // In backend it might create clients
          warnings: [],
          orders: finalResultOrders
        });

        // Clear captures so we don't re-submit
        this.liveCaptures.set([]);
        this.livePhase.set('setup'); // Go back to start
        return;
      }

      const liveObj = toSubmit[index];
      this.liveCreateProgress.set(`Guardando ${liveObj.clientName}(${index + 1} / ${toSubmit.length})...`);

      const req: ManualOrderRequest = {
        clientName: liveObj.clientName,
        clientType: 'Nueva', // Fallback, backend can link them
        orderType: liveObj.orderType,
        items: liveObj.items
      };

      this.api.createManualOrder(req).subscribe({
        next: (res) => {
          successCount++;
          finalResultOrders.push({
            id: res.id,
            clientName: res.clientName,
            total: res.total,
            orderType: res.orderType,
            link: res.link,
            items: res.items.map(i => ({ id: i.id, productName: i.productName, quantity: i.quantity }))
          });
          processOrder(index + 1);
        },
        error: (err) => {
          console.error('Failed order', err);
          this.toast.error(`Ignorado error con ${liveObj.clientName}`);
          // Continue anyway
          processOrder(index + 1);
        }
      });
    };

    processOrder(0);
  }

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
