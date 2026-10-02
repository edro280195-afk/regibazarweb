import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TandaService } from '../../../core/services/tanda.service';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  CamiChatResponse,
  ClientDto,
  TandaDto,
  TandaParticipantDto,
  TandaParticipantStatus,
  TandaPaymentDto,
  TandaPaymentProofAdminDto,
  TandaProductDto,
  TandaStatus,
  CreateTandaParticipantItemDto,
  UpdateTandaParticipantDto,
  UpdateTandaPaymentDto
} from '../../../core/models';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { RaffleAnimationComponent } from '../raffles/raffle-animation/raffle-animation.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  buildPlaceAssignments,
  buildTandaSlots,
  getVerifiedWeekPaidAmount
} from './tanda-admin.util';

interface PaymentForm {
  amountPaid: number;
  penaltyPaid: number;
  paymentDate: string;
  isVerified: boolean;
  notes: string;
}

interface ParticipantForm {
  customerId: number;
  assignedTurn: number;
  variant: string;
  weeklyAmount?: number;
  currency?: string;
  itemCost?: number;
  exchangeRate?: number;
  status: TandaParticipantStatus;
  isDelivered: boolean;
  deliveryDate: string;
}

interface TandaEditForm {
  productId: string;
  name: string;
  totalWeeks: number;
  weeklyAmount: number;
  penaltyAmount: number;
  startDate: string;
  currency?: string;
  itemCost?: number;
  exchangeRate?: number;
  status: TandaStatus;
}

@Component({
  selector: 'app-tanda-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, FormsModule, DragDropModule, RaffleAnimationComponent],
  templateUrl: './tanda-detail.component.html',
  styleUrl: './tanda-detail.component.css'
})
export class TandaDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private tandaService = inject(TandaService);
  private apiService = inject(ApiService);
  private toastService = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  tanda = signal<TandaDto | null>(null);
  participants = signal<TandaParticipantDto[]>([]);
  paymentProofs = signal<TandaPaymentProofAdminDto[]>([]);
  reviewingProofId = signal<string | null>(null);
  weeksArray = signal<number[]>([]);
  sundayParticipant = signal<TandaParticipantDto | null>(null);
  loading = signal(true);
  viewMode = signal<'table' | 'visual'>('table');
  selectedWeekMobile = signal<number>(1);

  mobileWeekStats = computed(() => {
    const w = this.selectedWeekMobile();
    const parts = this.participants();
    let collected = 0;
    let paidCount = 0;
    for (const p of parts) {
      const paid = this.getWeekPaidAmount(p, w);
      collected += paid;
      if (paid >= this.getParticipantWeeklyAmount(p)) {
        paidCount++;
      }
    }
    return { collected, paidCount };
  });

  currentWeek = computed(() => {
    const t = this.tanda();
    if (!t || !t.startDate) return 0;

    // Parseamos la fecha ignorando zona horaria para consistencia con el backend
    const datePart = t.startDate.split('T')[0];
    const parts = datePart.split('-');
    const startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 0;
    // Lógica espejo del backend: El domingo es el cierre (día 7), el lunes cambia (día 8)
    return Math.floor((diffDays === 0 ? 0 : diffDays - 1) / 7) + 1;
  });

  getDeliveryDate(startDate: string, turn: number): Date {
    if (!startDate) return new Date();
    const datePart = startDate.split('T')[0];
    const parts = datePart.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    // Obtenemos la fecha base (inicio de la tanda)
    let date = new Date(year, month, day, 12, 0, 0);
    
    // Encontramos el domingo de esa misma semana (el primer domingo on or after startDate)
    // getDay(): 0=Sun, 1=Mon, ..., 6=Sat
    const daysToSunday = (7 - date.getDay()) % 7;
    date.setDate(date.getDate() + daysToSunday);
    
    // Ahora sumamos las semanas según el turno
    date.setDate(date.getDate() + (turn - 1) * 7);
    return date;
  }

  // Inscripción
  allClients = signal<ClientDto[]>([]);
  tandaProducts = signal<TandaProductDto[]>([]);
  clientSearch = signal('');
  showOnlyFrequent = signal(true);
  confirmingDelivery = signal<TandaParticipantDto | null>(null);
  addingToRoute = signal(false);
  showSuggestions = signal(false);
  selectedSuggestionIdx = signal(-1);
  selectedClient = signal<ClientDto | null>(null);
  enrollTurn = 1;
  enrollVariant = '';
  enrollWeeklyAmount?: number;
  enrollCurrency = 'MXN';
  enrollItemCost?: number;
  enrollExchangeRate?: number;
  isEnrolling = signal(false);

  // Reordenamiento y Sorteo
  showReorderModal = signal(false);
  reorderSlots = signal<Array<TandaParticipantDto | null>>([]);
  isSavingReorder = signal(false);

  showRoulette = signal(false);
  rouletteParticipants = signal<{ id: string, name: string }[]>([]);
  rouletteWinnerNames = signal<string[]>([]);
  rouletteTurnNumbers = signal<number[]>([]);

  @ViewChild(RaffleAnimationComponent) raffleComponent?: RaffleAnimationComponent;

  // Pago
  showPaymentModal = signal(false);
  isSavingPay = signal(false);
  activePayment = signal<{ participant: TandaParticipantDto, week: number } | null>(null);
  editingPaymentId = signal<string | null>(null);
  pendingDeletePaymentId = signal<string | null>(null);
  paymentForm = signal<PaymentForm>(this.createEmptyPaymentForm());

  paymentsForActiveWeek = computed(() => {
    const active = this.activePayment();
    if (!active) return [];
    return (active.participant.payments ?? [])
      .filter(payment => payment.weekNumber === active.week)
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  });

  // Edición
  showEditModal = signal(false);
  isUpdatingTanda = signal(false);
  editForm = signal<TandaEditForm>({
    productId: '',
    name: '',
    totalWeeks: 10,
    weeklyAmount: 0,
    penaltyAmount: 0,
    startDate: '',
    status: 'Active'
  });

  // Reordenamiento y Eliminación
  editingTurnId = signal<string | null>(null);
  editingVariantId = signal<string | null>(null);
  editVariantValue = '';
  isUpdatingVariant = signal(false);
  selectedParticipantActions = signal<TandaParticipantDto | null>(null);
  showRemoveConfirm = signal<TandaParticipantDto | null>(null);
  editingParticipant = signal<TandaParticipantDto | null>(null);
  editingItemsParticipant = signal<TandaParticipantDto | null>(null);
  itemDrafts: CreateTandaParticipantItemDto[] = [];
  isSavingItems = signal(false);
  isUpdatingParticipant = signal(false);
  editParticipantClientSearch = signal('');
  showEditParticipantSuggestions = signal(false);
  participantForm = signal<ParticipantForm>({
    customerId: 0,
    assignedTurn: 1,
    variant: '',
    weeklyAmount: undefined,
    status: 'Active',
    isDelivered: false,
    deliveryDate: ''
  });

  filteredEditParticipantClients = computed(() => {
    const s = this.editParticipantClientSearch().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const clients = this.allClients();
    if (!s) return clients.slice(0, 10);
    return clients.filter(cl => {
      const name = (cl.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const phone = cl.phone || '';
      return name.includes(s) || phone.includes(s);
    }).slice(0, 12);
  });

  filteredClientsSearch = computed(() => {
    const s = this.clientSearch().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const frequentOnly = this.showOnlyFrequent();
    const clients = this.allClients();

    return clients.filter(c => {
      const clientName = c.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
      const matchesSearch = !s || clientName.includes(s);
      const isFrequent = (c.ordersCount && c.ordersCount >= 1) || c.type === 'Frecuente';

      return matchesSearch && (!frequentOnly || isFrequent);
    }).slice(0, 10);
  });

  ngOnInit() {
    this.route.params
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => this.loadTanda(params['id']));
    this.loadAllClients();
    this.loadTandaProducts();
  }

  loadAllClients() {
    this.apiService.getClients().subscribe({
      next: (data) => this.allClients.set(data),
      error: () => console.error('Error loading clients for search')
    });
  }

  loadTanda(id: string) {
    this.loading.set(true);
    this.tandaService.getTanda(id).subscribe({
      next: (data) => {
        this.tanda.set(data);
        if (data.participants) {
          this.participants.set([...data.participants].sort((a, b) => a.assignedTurn - b.assignedTurn));
        }
        this.weeksArray.set(Array.from({ length: data.totalWeeks }, (_, i) => i + 1));
        const cw = this.currentWeek();
        if (cw > 0 && cw <= data.totalWeeks) {
          this.selectedWeekMobile.set(cw);
        }
        this.loading.set(false);
        this.loadPaymentProofs(id);

        this.tandaService.getSundayDelivery(id).subscribe({
          next: (p) => this.sundayParticipant.set(p),
          error: () => this.sundayParticipant.set(null)
        });
      },
      error: () => {
        this.loading.set(false);
        this.toastService.error('Tanda no encontrada o error de servidor 😿');
      }
    });
  }

  loadPaymentProofs(tandaId: string) {
    this.tandaService.getPaymentProofs(tandaId).subscribe({
      next: proofs => this.paymentProofs.set(proofs),
      error: () => this.paymentProofs.set([])
    });
  }

  reviewPaymentProof(proof: TandaPaymentProofAdminDto, approve: boolean, rejectionReason?: string) {
    if (this.reviewingProofId()) return;
    this.reviewingProofId.set(proof.id);
    this.tandaService.reviewPaymentProof(proof.id, approve, rejectionReason).subscribe({
      next: () => {
        this.reviewingProofId.set(null);
        this.toastService.success(approve ? 'Comprobante aprobado y pago registrado ✨' : 'Comprobante rechazado');
        this.loadPaymentProofs(proof.tandaId);
        this.loadTanda(proof.tandaId);
      },
      error: error => {
        this.reviewingProofId.set(null);
        this.toastService.error(error.error?.message || 'No se pudo revisar el comprobante');
      }
    });
  }

  rejectPaymentProof(proof: TandaPaymentProofAdminDto) {
    const reason = window.prompt('Indica brevemente por qué se rechaza el comprobante:')?.trim();
    if (reason) this.reviewPaymentProof(proof, false, reason);
  }

  prevSelectedWeek() {
    this.selectedWeekMobile.update(w => Math.max(1, w - 1));
  }

  nextSelectedWeek() {
    const total = this.tanda()?.totalWeeks ?? 52;
    this.selectedWeekMobile.update(w => Math.min(total, w + 1));
  }

  hasPaid(participant: TandaParticipantDto, week: number): boolean {
    return this.getWeekPaidAmount(participant, week) >= this.getParticipantWeeklyAmount(participant);
  }

  getWeekPaidAmount(participant: TandaParticipantDto, week: number): number {
    return getVerifiedWeekPaidAmount(participant.payments, week);
  }

  getParticipantWeeklyAmount(p: TandaParticipantDto): number {
    if (p.weeklyAmount != null) return p.weeklyAmount;
    const itemAmount = (p.items ?? []).reduce((sum, item) => sum + (item.weeklyAmount ?? 0) * Math.max(1, item.quantity), 0);
    return itemAmount > 0 ? itemAmount : this.tanda()?.weeklyAmount ?? 0;
  }

  onClientSearch(term: string) {
    this.clientSearch.set(term);
    this.showSuggestions.set(true);
  }

  hideSuggestionsWithDelay() {
    setTimeout(() => this.showSuggestions.set(false), 200);
  }

  onClientKeydown(event: KeyboardEvent) {
    const list = this.filteredClientsSearch();
    if (!this.showSuggestions() || list.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedSuggestionIdx.update(i => (i + 1) % list.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedSuggestionIdx.update(i => (i <= 0 ? list.length - 1 : i - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const idx = this.selectedSuggestionIdx();
      if (idx >= 0) {
        this.selectClientToEnroll(list[idx]);
      }
    } else if (event.key === 'Escape') {
      this.showSuggestions.set(false);
    }
  }

  onShuffle() {
    const participants = [...this.participants()]
      .sort((a, b) => a.assignedTurn - b.assignedTurn);

    if (participants.length === 0) {
      this.toastService.error('La tanda no tiene lugares asignados');
      return;
    }

    this.rouletteParticipants.set(participants.map(p => ({ id: p.id, name: p.customerName || 'Participante' })));
    this.rouletteWinnerNames.set(participants.map(p => p.customerName || 'Participante'));
    this.rouletteTurnNumbers.set(participants.map(p => p.assignedTurn));
    this.showRoulette.set(true);
  }

  loadTandaProducts() {
    this.tandaService.getTandaProducts().subscribe({
      next: products => this.tandaProducts.set(products),
      error: () => this.toastService.error('No se pudo cargar el catálogo de productos')
    });
  }

  handleRouletteStart() {
    const winnerNames = this.rouletteWinnerNames();
    if (winnerNames.length > 0) {
      this.raffleComponent?.setWinnerAndStart(winnerNames);
    }
  }

  openReorderModal() {
    this.reorderSlots.set(buildTandaSlots(
      this.participants(),
      this.tanda()?.totalWeeks ?? 0
    ));
    this.showReorderModal.set(true);
  }

  drop(event: CdkDragDrop<Array<TandaParticipantDto | null>>) {
    const list = [...this.reorderSlots()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.reorderSlots.set(list);
  }

  onSaveReorder() {
    const t = this.tanda();
    if (t && !this.isSavingReorder()) {
      this.isSavingReorder.set(true);
      const assignments = buildPlaceAssignments(this.reorderSlots());
      this.tandaService.updatePlaces(t.id, assignments).subscribe({
        next: () => {
          this.toastService.success('Orden actualizado con éxito ✨');
          this.showReorderModal.set(false);
          this.loadTanda(t.id);
          this.isSavingReorder.set(false);
        },
        error: (err) => {
          this.isSavingReorder.set(false);
          this.toastService.error(err.error?.message || 'Error al reordenar');
        }
      });
    }
  }

  selectClientToEnroll(client: ClientDto) {
    this.selectedClient.set(client);
    this.clientSearch.set('');
    this.showSuggestions.set(false);
    this.selectedSuggestionIdx.set(-1);
    this.enrollTurn = this.findFirstAvailableTurn();
    this.enrollVariant = '';
    this.enrollWeeklyAmount = undefined;
  }

  onAddParticipant() {
    const t = this.tanda();
    const sc = this.selectedClient();
    if (t && sc && !this.isEnrolling()) {
      this.isEnrolling.set(true);
      this.tandaService.addParticipant({
        tandaId: t.id,
        customerId: sc.id,
        assignedTurn: this.enrollTurn,
        variant: this.enrollVariant,
        weeklyAmount: this.enrollWeeklyAmount || undefined,
        currency: this.enrollCurrency || undefined,
        itemCost: this.enrollItemCost || undefined,
        exchangeRate: this.enrollExchangeRate || undefined
      }).subscribe({
        next: () => {
          this.toastService.success(`${sc.name} inscrita con éxito ✨`);
          this.loadTanda(t.id);
          this.selectedClient.set(null);
          this.enrollVariant = '';
          this.enrollWeeklyAmount = undefined;
          this.enrollItemCost = undefined;
          this.enrollExchangeRate = undefined;
          this.isEnrolling.set(false);
        },
        error: (err) => {
          this.isEnrolling.set(false);
          this.toastService.error(err.error?.message || 'Error al inscribir clienta');
        }
      });
    }
  }

  onProcessPenalties() {
    const t = this.tanda();
    if (t) {
      this.tandaService.processPenalties(t.id).subscribe({
        next: (res) => {
          this.toastService.info(res.message);
          this.loadTanda(t.id);
        },
        error: (err) => this.toastService.error(err.error?.message || 'Error al procesar penalizaciones')
      });
    }
  }

  onCopyLink(token: string | undefined) {
    if (!token) return;
    const url = `${window.location.origin}/tanda-view/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      this.toastService.success('¡Enlace copiado al portapapeles! 🎀');
    });
  }

  copyParticipantMessage(participant: TandaParticipantDto) {
    const tanda = this.tanda();
    if (!tanda || !participant.publicAccessToken) {
      this.toastService.error('Esta participante aún no tiene enlace personal');
      return;
    }
    const link = `${window.location.origin}/tanda-view/${participant.publicAccessToken}`;
    const weekly = this.getParticipantWeeklyAmount(participant).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    const message = `Hola ${participant.customerName || 'hermosa'} 💕\n\nTu abono semanal de la tanda es de ${weekly}. Cuando realices tu transferencia, entra a tu enlace personal para consultar tu avance y subir la foto del comprobante:\n\n${link}\n\nToca “Enviar comprobante” y nosotros revisaremos tu pago. ✨`;
    navigator.clipboard.writeText(message).then(() => {
      this.selectedParticipantActions.set(null);
      this.toastService.success('Instrucciones copiadas para enviar por Messenger 💌');
    });
  }

  itemSummary(participant: TandaParticipantDto): string {
    return (participant.items ?? [])
      .map(item => `${item.quantity}× ${item.productName}${item.variant ? ` (${item.variant})` : ''}`)
      .join(' · ');
  }

  openItemsModal(participant: TandaParticipantDto) {
    const tanda = this.tanda();
    const existingItems = participant.items ?? [];
    this.itemDrafts = existingItems.length > 0
      ? existingItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          weeklyAmount: item.weeklyAmount,
          variant: item.variant
        }))
      : [{
          productId: tanda?.productId,
          productName: tanda?.product?.name || 'Artículo de tanda',
          quantity: 1,
          unitPrice: participant.itemCost ?? tanda?.itemCost ?? 0,
          weeklyAmount: this.getParticipantWeeklyAmount(participant),
          variant: participant.variant
        }];
    this.editingItemsParticipant.set(participant);
    this.selectedParticipantActions.set(null);
  }

  addItemDraft() {
    this.itemDrafts = [...this.itemDrafts, { productName: '', quantity: 1, unitPrice: 0, weeklyAmount: 0 }];
  }

  removeItemDraft(index: number) {
    if (this.itemDrafts.length > 1) this.itemDrafts = this.itemDrafts.filter((_, itemIndex) => itemIndex !== index);
  }

  saveParticipantItems() {
    const participant = this.editingItemsParticipant();
    const tanda = this.tanda();
    if (!participant || !tanda || this.isSavingItems()) return;
    if (this.itemDrafts.some(item => !item.productName.trim() || item.quantity < 1 || item.unitPrice < 0 || (item.weeklyAmount ?? 0) < 0)) {
      this.toastService.error('Completa correctamente los artículos y cobros.');
      return;
    }

    this.isSavingItems.set(true);
    this.tandaService.replaceParticipantItems(participant.id, { items: this.itemDrafts }).subscribe({
      next: () => {
        this.isSavingItems.set(false);
        this.editingItemsParticipant.set(null);
        this.toastService.success('Artículos y cobro actualizados ✨');
        this.loadTanda(tanda.id);
      },
      error: error => {
        this.isSavingItems.set(false);
        this.toastService.error(error.error?.message || 'No se pudieron actualizar los artículos.');
      }
    });
  }

  openPaymentModal(participant: TandaParticipantDto, week: number) {
    this.activePayment.set({ participant, week });
    const remaining = Math.max(
      0,
      this.getParticipantWeeklyAmount(participant) - this.getWeekPaidAmount(participant, week)
    );
    this.paymentForm.set({
      ...this.createEmptyPaymentForm(),
      amountPaid: remaining || this.getParticipantWeeklyAmount(participant)
    });
    this.editingPaymentId.set(null);
    this.pendingDeletePaymentId.set(null);
    this.showPaymentModal.set(true);
    this.isSavingPay.set(false);
  }

  editPayment(payment: TandaPaymentDto) {
    this.editingPaymentId.set(payment.id);
    this.pendingDeletePaymentId.set(null);
    this.paymentForm.set({
      amountPaid: payment.amountPaid,
      penaltyPaid: payment.penaltyPaid,
      paymentDate: this.toDateTimeLocal(payment.paymentDate),
      isVerified: payment.isVerified,
      notes: payment.notes ?? ''
    });
  }

  cancelPaymentEdit() {
    const active = this.activePayment();
    this.editingPaymentId.set(null);
    this.pendingDeletePaymentId.set(null);
    this.paymentForm.set({
      ...this.createEmptyPaymentForm(),
      amountPaid: active ? this.getParticipantWeeklyAmount(active.participant) : 0
    });
  }

  confirmPayment() {
    const pay = this.activePayment();
    const t = this.tanda();
    if (pay && t && !this.isSavingPay()) {
      const form = this.paymentForm();
      if (form.amountPaid <= 0) {
        this.toastService.error('Captura un monto mayor a cero');
        return;
      }

      this.isSavingPay.set(true);
      const editingId = this.editingPaymentId();
      const request = editingId
        ? this.tandaService.updatePayment(editingId, {
            weekNumber: pay.week,
            amountPaid: form.amountPaid,
            penaltyPaid: form.penaltyPaid,
            paymentDate: new Date(form.paymentDate).toISOString(),
            isVerified: form.isVerified,
            notes: form.notes.trim() || undefined
          })
        : this.tandaService.registerPayment({
        participantId: pay.participant.id,
        weekNumber: pay.week,
            amountPaid: form.amountPaid,
            penaltyPaid: form.penaltyPaid,
            paymentDate: new Date(form.paymentDate).toISOString(),
            isVerified: form.isVerified,
            notes: form.notes.trim() || undefined
          });

      request.subscribe({
        next: () => {
          this.toastService.success(editingId ? 'Abono actualizado' : 'Abono registrado correctamente');
          this.showPaymentModal.set(false);
          this.loadTanda(t.id);
          this.isSavingPay.set(false);
        },
        error: (err) => {
          this.isSavingPay.set(false);
          this.toastService.error(err.error?.message || 'Error de pago. Solo Viernes/Sábado.');
        }
      });
    }
  }

  setEditCurrency(curr: string) {
    this.editForm.update(f => {
      const exchangeRate = curr === 'USD' && !f.exchangeRate ? 19.50 : f.exchangeRate;
      return { ...f, currency: curr, exchangeRate };
    });
    this.onEditItemCostOrRateChange();
  }

  onEditItemCostOrRateChange() {
    const f = this.editForm();
    if (f.itemCost && f.itemCost > 0 && f.totalWeeks > 0) {
      let totalMxn = f.itemCost;
      if (f.currency === 'USD' && f.exchangeRate) {
        totalMxn = f.itemCost * f.exchangeRate;
      }
      this.editForm.update(form => ({
        ...form,
        weeklyAmount: Math.ceil(totalMxn / form.totalWeeks)
      }));
    }
  }

  openEditModal() {
    const t = this.tanda();
    if (t) {
      this.editForm.set({
        productId: t.productId,
        name: t.name,
        totalWeeks: t.totalWeeks,
        weeklyAmount: t.weeklyAmount,
        penaltyAmount: t.penaltyAmount || 0,
        startDate: t.startDate.split('T')[0],
        currency: t.currency || 'MXN',
        itemCost: t.itemCost,
        exchangeRate: t.exchangeRate,
        status: t.status
      });
      this.showEditModal.set(true);
    }
  }

  onUpdateTanda() {
    const t = this.tanda();
    if (t && !this.isUpdatingTanda()) {
      this.isUpdatingTanda.set(true);
      this.tandaService.updateTanda(t.id, this.editForm()).subscribe({
        next: () => {
          this.toastService.success('Tanda actualizada con éxito ✨');
          this.showEditModal.set(false);
          this.loadTanda(t.id);
          this.isUpdatingTanda.set(false);
        },
        error: (err) => {
          this.isUpdatingTanda.set(false);
          this.toastService.error(err.error?.message || 'Error al actualizar la tanda');
        }
      });
    }
  }

  onUpdateTurn(p: TandaParticipantDto, event: Event) {
    const input = event.target as HTMLInputElement;
    const newTurn = Number.parseInt(input.value, 10);
    if (isNaN(newTurn) || newTurn === p.assignedTurn) {
      this.editingTurnId.set(null);
      return;
    }

    this.tandaService.updateParticipantTurn(p.id, newTurn).subscribe({
      next: () => {
        this.toastService.success('Turno actualizado ✨');
        this.editingTurnId.set(null);
        this.loadTanda(p.tandaId);
      },
      error: (err) => {
        this.editingTurnId.set(null);
        this.toastService.error(err.error?.message || 'Error al cambiar turno');
      }
    });
  }

  onUpdateVariant(participantId: string) {
    if (!this.editVariantValue.trim()) {
      this.editingVariantId.set(null);
      return;
    }

    this.isUpdatingVariant.set(true);
    this.tandaService.updateParticipantVariant(participantId, this.editVariantValue).subscribe({
      next: () => {
        this.toastService.success('Variante actualizada ✨');
        this.editingVariantId.set(null);
        this.editVariantValue = '';
        this.isUpdatingVariant.set(false);
        const t = this.tanda();
        if (t) this.loadTanda(t.id);
      },
      error: (err) => {
        this.isUpdatingVariant.set(false);
        this.toastService.error(err.error?.message || 'Error al actualizar variante');
      }
    });
  }

  onConfirmSundayDelivery(p: TandaParticipantDto) {
    this.confirmingDelivery.set(p);
  }

  addToSundayRoute(p: TandaParticipantDto) {
    if (this.addingToRoute()) return;
    this.addingToRoute.set(true);

    // Busca una ruta Pending existente. Si hay, agregamos ahí.
    // Si no hay, creamos una ruta nueva con solo esta tanda.
    this.apiService.getRoutes().subscribe({
      next: (routes) => {
        const pendingRoute = routes.find(r => r.status === 'Pending');
        if (pendingRoute) {
          this.apiService.addTandaToRoute(pendingRoute.id, p.id).subscribe({
            next: () => {
              this.addingToRoute.set(false);
              this.toastService.success(`✨ ${p.customerName} agregada a la ruta del domingo`);
            },
            error: (err) => {
              this.addingToRoute.set(false);
              this.toastService.error(err.error?.message || 'No se pudo agregar a la ruta');
            }
          });
        } else {
          this.apiService.createRoute([], false, [p.id]).subscribe({
            next: (res) => {
              this.addingToRoute.set(false);
              if (res.skipped && res.skipped.length > 0) {
                this.toastService.error(res.skipped[0].reason);
              } else {
                this.toastService.success(`✨ Ruta del domingo creada con ${p.customerName}`);
              }
            },
            error: (err) => {
              this.addingToRoute.set(false);
              this.toastService.error(err.error?.message || 'No se pudo crear la ruta');
            }
          });
        }
      },
      error: () => {
        this.addingToRoute.set(false);
        this.toastService.error('No se pudieron cargar las rutas');
      }
    });
  }

  confirmDelivery(p: TandaParticipantDto) {
    this.confirmingDelivery.set(null);
    this.tandaService.confirmParticipantDelivery(p.id).subscribe({
      next: () => {
        this.toastService.success('¡Entrega confirmada con éxito! ✨');
        this.loadTanda(p.tandaId);

        // FEATURE: CAMI Audio Announcement
        this.apiService.getAICamiMessage(`Anuncia con mucha alegría que la clienta ${p.customerName} ha recibido su producto de la tanda hoy.`).subscribe((res: CamiChatResponse) => {
          if (res.audioBase64) {
            const audio = new Audio('data:audio/mp3;base64,' + res.audioBase64);
            audio.play();
          }
        });
      },
      error: (err) => this.toastService.error(err.error?.message || 'Error al confirmar entrega')
    });
  }

  onRemoveParticipant(p: TandaParticipantDto) {
    this.showRemoveConfirm.set(p);
  }

  confirmRemoveParticipant(p: TandaParticipantDto) {
    this.tandaService.removeParticipant(p.id).subscribe({
      next: () => {
        this.toastService.success('Participante retirada con éxito ✨');
        this.showRemoveConfirm.set(null);
        this.loadTanda(p.tandaId);
      },
      error: (err) => {
        const errorMsg = err.error?.message || err.message || 'Error desconocido al eliminar';
        this.toastService.error(`No se pudo eliminar: ${errorMsg} 😿`);
      }
    });
  }

  onRemovePayment(participant: TandaParticipantDto, week: number) {
    this.openPaymentModal(participant, week);
  }

  requestDeletePayment(paymentId: string) {
    if (this.pendingDeletePaymentId() !== paymentId) {
      this.pendingDeletePaymentId.set(paymentId);
      return;
    }

    this.tandaService.deletePayment(paymentId).subscribe({
      next: () => {
        this.toastService.success('Pago eliminado');
        this.showPaymentModal.set(false);
        const tanda = this.tanda();
        if (tanda) this.loadTanda(tanda.id);
      },
      error: err => this.toastService.error(err.error?.message || 'Error al eliminar pago')
    });
  }

  onEditParticipantSearch(term: string) {
    this.editParticipantClientSearch.set(term);
    this.showEditParticipantSuggestions.set(true);
  }

  selectClientForEditParticipant(client: ClientDto) {
    this.participantForm.update(form => ({ ...form, customerId: client.id }));
    this.editParticipantClientSearch.set(client.name);
    this.showEditParticipantSuggestions.set(false);
  }

  hideEditParticipantSuggestionsWithDelay() {
    setTimeout(() => this.showEditParticipantSuggestions.set(false), 250);
  }

  openParticipantEditor(participant: TandaParticipantDto) {
    this.editingParticipant.set(participant);
    this.editParticipantClientSearch.set(participant.customerName || '');
    this.showEditParticipantSuggestions.set(false);
    this.participantForm.set({
      customerId: participant.customerId,
      assignedTurn: participant.assignedTurn,
      variant: participant.variant ?? '',
      weeklyAmount: participant.weeklyAmount,
      currency: participant.currency ?? '',
      itemCost: participant.itemCost,
      exchangeRate: participant.exchangeRate,
      status: participant.status,
      isDelivered: participant.isDelivered,
      deliveryDate: participant.deliveryDate?.split('T')[0] ?? ''
    });
    this.selectedParticipantActions.set(null);
  }

  saveParticipant() {
    const participant = this.editingParticipant();
    const tanda = this.tanda();
    if (!participant || !tanda || this.isUpdatingParticipant()) return;

    const form = this.participantForm();
    const dto: UpdateTandaParticipantDto = {
      customerId: form.customerId,
      assignedTurn: form.assignedTurn,
      variant: form.variant.trim() || undefined,
      weeklyAmount: form.weeklyAmount || undefined,
      currency: form.currency?.trim() || undefined,
      itemCost: form.itemCost || undefined,
      exchangeRate: form.exchangeRate || undefined,
      status: form.status,
      isDelivered: form.isDelivered,
      deliveryDate: form.isDelivered && form.deliveryDate
        ? new Date(`${form.deliveryDate}T12:00:00`).toISOString()
        : undefined
    };

    this.isUpdatingParticipant.set(true);
    this.tandaService.updateParticipant(participant.id, dto).subscribe({
      next: () => {
        this.toastService.success('Participante actualizada');
        this.editingParticipant.set(null);
        this.isUpdatingParticipant.set(false);
        this.loadTanda(tanda.id);
      },
      error: err => {
        this.isUpdatingParticipant.set(false);
        this.toastService.error(err.error?.message || 'No se pudo actualizar la participante');
      }
    });
  }

  setTandaStatus(status: TandaStatus) {
    const tanda = this.tanda();
    if (!tanda || this.isUpdatingTanda()) return;
    this.isUpdatingTanda.set(true);
    this.tandaService.updateTanda(tanda.id, {
      productId: tanda.productId,
      name: tanda.name,
      totalWeeks: tanda.totalWeeks,
      weeklyAmount: tanda.weeklyAmount,
      penaltyAmount: tanda.penaltyAmount,
      startDate: tanda.startDate,
      currency: tanda.currency,
      itemCost: tanda.itemCost,
      exchangeRate: tanda.exchangeRate,
      status
    }).subscribe({
      next: () => {
        this.isUpdatingTanda.set(false);
        this.toastService.success('Estado de la tanda actualizado');
        this.loadTanda(tanda.id);
      },
      error: err => {
        this.isUpdatingTanda.set(false);
        this.toastService.error(err.error?.message || 'No se pudo cambiar el estado');
      }
    });
  }

  private findFirstAvailableTurn(): number {
    const occupied = new Set(this.participants().map(participant => participant.assignedTurn));
    const totalWeeks = this.tanda()?.totalWeeks ?? 1;
    return Array.from({ length: totalWeeks }, (_, index) => index + 1)
      .find(turn => !occupied.has(turn)) ?? totalWeeks;
  }

  private createEmptyPaymentForm(): PaymentForm {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return {
      amountPaid: 0,
      penaltyPaid: 0,
      paymentDate: now.toISOString().slice(0, 16),
      isVerified: true,
      notes: ''
    };
  }

  private toDateTimeLocal(value: string): string {
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  statusLabel(status: TandaStatus): string {
    const labels: Record<TandaStatus, string> = {
      Draft: 'Borrador',
      Active: 'Activa',
      Completed: 'Completada',
      Cancelled: 'Cancelada'
    };
    return labels[status];
  }
}
