import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  TandaDto, CreateTandaDto, AddParticipantDto, 
  RegisterPaymentDto, TandaParticipantDto, TandaPaymentDto,
  TandaProductDto
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

  getPublicTanda(token: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/public-tanda/${token}`);
  }

  createTanda(dto: CreateTandaDto): Observable<TandaDto> {
    return this.http.post<TandaDto>(this.base, dto);
  }

  // ── Participantes ──
  addParticipant(dto: AddParticipantDto): Observable<TandaParticipantDto> {
    return this.http.post<TandaParticipantDto>(`${this.base}/participants`, dto);
  }

  // ── Pagos ──
  registerPayment(dto: RegisterPaymentDto): Observable<TandaPaymentDto> {
    return this.http.post<TandaPaymentDto>(`${this.base}/payments`, dto);
  }

  // ── Operaciones Especiales ──
  getSundayDelivery(tandaId: string): Observable<TandaParticipantDto> {
    return this.http.get<TandaParticipantDto>(`${this.base}/${tandaId}/sunday-delivery`);
  }

  processPenalties(tandaId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/${tandaId}/process-penalties`, {});
  }

  updateTanda(id: string, dto: any): Observable<TandaDto> {
    return this.http.put<TandaDto>(`${this.base}/${id}`, dto);
  }

  updateParticipantTurn(participantId: string, newTurn: number): Observable<any> {
    return this.http.patch(`${this.base}/participants/${participantId}/turn`, { newTurn });
  }

  updateParticipantVariant(participantId: string, variant: string): Observable<any> {
    return this.http.patch(`${this.base}/participants/${participantId}/variant`, { variant });
  }

  shuffleParticipants(tandaId: string): Observable<any> {
    return this.http.post(`${this.base}/${tandaId}/shuffle`, {});
  }

  removeParticipant(participantId: string): Observable<any> {
    return this.http.delete(`${this.base}/participants/${participantId}`);
  }
}
