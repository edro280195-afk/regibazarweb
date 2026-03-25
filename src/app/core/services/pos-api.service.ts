import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CashRegisterSession, Order, OrderPayment } from '../models/pos.models';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PosApiService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/pos`;

  // Session
  openSession(userId: number, initialCash: number): Observable<CashRegisterSession> {
    return this.http.post<CashRegisterSession>(`${this.apiUrl}/session/open`, { userId, initialCash });
  }

  closeSession(sessionId: number, actualCash: number): Observable<CashRegisterSession> {
    return this.http.post<CashRegisterSession>(`${this.apiUrl}/session/close`, { sessionId, actualCash });
  }

  getActiveSession(): Observable<CashRegisterSession> {
    return this.http.get<CashRegisterSession>(`${this.apiUrl}/session/active`);
  }

  // Orders
  getPendingOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/orders/pending`);
  }

  // Payment
  processPayment(orderId: number, sessionId: number, amount: number, method: string): Observable<OrderPayment> {
    return this.http.post<OrderPayment>(`${this.apiUrl}/payment`, { orderId, sessionId, amount, method });
  }

  // Scanning
  scanItem(orderId: number, sku: string): Observable<Order> {
    return this.http.post<Order>(`${this.apiUrl}/scan`, { orderId, sku });
  }

  // Initialize POS Order
  createPosOrder(clientName: string): Observable<Order> {
    return this.http.post<Order>(`${this.apiUrl}/session/order`, { clientName });
  }

  // Voice Interaction
  voiceCommand(text: string, orderId?: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/voice-command`, { text, orderId });
  }
}
