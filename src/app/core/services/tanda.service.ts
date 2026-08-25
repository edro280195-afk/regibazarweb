import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  TandaDto, CreateTandaDto, AddParticipantDto, 
  RegisterPaymentDto, TandaParticipantDto, TandaPaymentDto,
  ApiMessageDto, TandaPlaceAssignmentDto, TandaProductDto, TandaViewDto,
  UpdateTandaDto, UpdateTandaParticipantDto, UpdateTandaPaymentDto
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class TandaService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/tanda`;

  // ── Productos de Tanda ──
  // Nota: Estos se manejan por ahora como una extensión de los productos base
  // pero el backend tiene su propia tabla 'products' (mapeada a TandaProduct)
  getTandaProducts(): Observable<TandaProductDto[]> {
    return this.http.get<TandaProductDto[]>(`${this.base}/products`);
  }

  createProduct(name: string): Observable<TandaProductDto> {
    return this.http.post<TandaProductDto>(`${this.base}/products`, { name, basePrice: 0 });
  }

  // ── Tandas ──
  getTandas(): Observable<TandaDto[]> {
    return this.http.get<TandaDto[]>(this.base);
  }

  getTanda(id: string): Observable<TandaDto> {
    return this.http.get<TandaDto>(`${this.base}/${id}`);
  }

  getPublicTanda(token: string): Observable<TandaViewDto> {
    return this.http.get<TandaViewDto>(`${environment.apiUrl}/public-tanda/${token}`);
  }

  createTanda(dto: CreateTandaDto): Observable<TandaDto> {
    return this.http.post<TandaDto>(this.base, dto);
  }

  // ── Participantes ──
  addParticipant(dto: AddParticipantDto): Observable<TandaParticipantDto> {
    return this.http.post<TandaParticipantDto>(`${this.base}/participants`, dto);
  }

  updateParticipant(
    participantId: string,
    dto: UpdateTandaParticipantDto
  ): Observable<TandaParticipantDto> {
    return this.http.put<TandaParticipantDto>(`${this.base}/participants/${participantId}`, dto);
  }

  // ── Pagos ──
  registerPayment(dto: RegisterPaymentDto): Observable<TandaPaymentDto> {
    return this.http.post<TandaPaymentDto>(`${this.base}/payments`, dto);
  }

  updatePayment(paymentId: string, dto: UpdateTandaPaymentDto): Observable<TandaPaymentDto> {
    return this.http.put<TandaPaymentDto>(`${this.base}/payments/${paymentId}`, dto);
  }

  deletePayment(paymentId: string): Observable<ApiMessageDto> {
    return this.http.delete<ApiMessageDto>(`${this.base}/payments/${paymentId}`);
  }

  // ── Operaciones Especiales ──
  getSundayDelivery(tandaId: string): Observable<TandaParticipantDto> {
    return this.http.get<TandaParticipantDto>(`${this.base}/${tandaId}/sunday-delivery`);
  }

  processPenalties(tandaId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/${tandaId}/process-penalties`, {});
  }

  updateTanda(id: string, dto: UpdateTandaDto): Observable<TandaDto> {
    return this.http.put<TandaDto>(`${this.base}/${id}`, dto);
  }

  updateParticipantTurn(participantId: string, newTurn: number): Observable<ApiMessageDto> {
    return this.http.patch<ApiMessageDto>(`${this.base}/participants/${participantId}/turn`, { newTurn });
  }

  updateParticipantVariant(participantId: string, variant: string): Observable<ApiMessageDto> {
    return this.http.patch<ApiMessageDto>(`${this.base}/participants/${participantId}/variant`, { variant });
  }

  confirmParticipantDelivery(participantId: string): Observable<ApiMessageDto> {
    return this.http.patch<ApiMessageDto>(`${this.base}/participants/${participantId}/confirm-delivery`, {});
  }

  removeParticipant(participantId: string): Observable<ApiMessageDto> {
    return this.http.delete<ApiMessageDto>(`${this.base}/participants/${participantId}`);
  }

  reorderParticipants(tandaId: string, participantIds: string[]): Observable<ApiMessageDto> {
    return this.http.post<ApiMessageDto>(`${this.base}/${tandaId}/reorder`, { participantIds });
  }

  updatePlaces(tandaId: string, assignments: TandaPlaceAssignmentDto[]): Observable<ApiMessageDto> {
    return this.http.put<ApiMessageDto>(`${this.base}/${tandaId}/places`, { assignments });
  }
}
