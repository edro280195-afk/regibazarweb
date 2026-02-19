import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  LoginRequest, LoginResponse, RegisterRequest,
  OrderSummary, ExcelUploadResult, ManualOrderRequest,
  DeliveryRoute, ClientOrderView, Dashboard, Client
} from '../../shared/models/models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // ═══════════════════════════════════════════
  //  AUTH
  // ═══════════════════════════════════════════
  login(req: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.url}/auth/login`, req);
  }

  register(req: RegisterRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.url}/auth/register`, req);
  }

  // ═══════════════════════════════════════════
  //  ORDERS (ADMIN)
  // ═══════════════════════════════════════════
  getOrders(): Observable<OrderSummary[]> {
    return this.http.get<OrderSummary[]>(`${this.url}/orders`);
  }

  uploadExcel(file: File): Observable<ExcelUploadResult> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ExcelUploadResult>(`${this.url}/orders/upload`, fd);
  }

  createManualOrder(req: ManualOrderRequest): Observable<OrderSummary> {
    return this.http.post<OrderSummary>(`${this.url}/orders/manual`, req);
  }

  deleteOrder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/orders/${id}`);
  }

  deleteAllOrders() {
    return this.http.delete(`${this.url}/orders/wipe`);
  }

  getDashboard(): Observable<Dashboard> {
    return this.http.get<Dashboard>(`${this.url}/orders/dashboard`);
  }

  // Métodos de edición de órdenes
  updateOrderStatus(id: number, data: any): Observable<OrderSummary> {
    return this.http.patch<OrderSummary>(`${this.url}/orders/${id}/status`, data);
  }

  updateOrder(id: number, data: any): Observable<OrderSummary> {
    return this.http.put<OrderSummary>(`${this.url}/orders/${id}`, data);
  }

  addOrderItem(orderId: number, item: { productName: string; quantity: number; unitPrice: number }): Observable<OrderSummary> {
    return this.http.post<OrderSummary>(`${this.url}/orders/${orderId}/items`, item);
  }

  updateOrderItem(orderId: number, itemId: number, data: any): Observable<OrderSummary> {
    return this.http.put<OrderSummary>(`${this.url}/orders/${orderId}/items/${itemId}`, data);
  }

  deleteOrderItem(orderId: number, itemId: number): Observable<OrderSummary> {
    return this.http.delete<OrderSummary>(`${this.url}/orders/${orderId}/items/${itemId}`);
  }

  // ═══════════════════════════════════════════
  //  CLIENTS
  // ═══════════════════════════════════════════
  getClients(): Observable<Client[]> {
    return this.http.get<Client[]>(`${this.url}/clients`);
  }

  // Mantenemos este método aunque sea redundante porque tu código lo usa
  getClientsWithStats(): Observable<any[]> {
    return this.http.get<any[]>(`${this.url}/clients`);
  }

  updateClient(id: number, data: any): Observable<void> {
    return this.http.put<void>(`${this.url}/clients/${id}`, data);
  }

  deleteClient(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/clients/${id}`);
  }

  deleteAllClients() {
    return this.http.delete(`${this.url}/clients/wipe`);
  }

  // ═══════════════════════════════════════════
  //  ROUTES (ADMIN)
  // ═══════════════════════════════════════════
  createRoute(orderIds: number[]): Observable<DeliveryRoute> {
    return this.http.post<DeliveryRoute>(`${this.url}/routes`, { orderIds });
  }

  getRoutes(): Observable<DeliveryRoute[]> {
    return this.http.get<DeliveryRoute[]>(`${this.url}/routes`);
  }

  getRoute(id: number): Observable<DeliveryRoute> {
    return this.http.get<DeliveryRoute>(`${this.url}/routes/${id}`);
  }

  deleteRoute(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/routes/${id}`);
  }

  // --- CHAT ADMIN (NUEVO) ---
  getRouteChat(routeId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.url}/routes/${routeId}/chat`);
  }

  sendAdminMessage(routeId: number, text: string): Observable<any> {
    return this.http.post<any>(`${this.url}/routes/${routeId}/chat`, { text });
  }

  // ═══════════════════════════════════════════
  //  DRIVER (REPARTIDOR)
  // ═══════════════════════════════════════════
  getDriverRoute(driverToken: string): Observable<any> {
    return this.http.get(`${this.url}/driver/${driverToken}`);
  }

  startRoute(driverToken: string): Observable<any> {
    return this.http.post(`${this.url}/driver/${driverToken}/start`, {});
  }

  updateLocation(driverToken: string, lat: number, lng: number): Observable<any> {
    return this.http.post(`${this.url}/driver/${driverToken}/location`, {
      latitude: lat, longitude: lng
    });
  }

  markDelivered(driverToken: string, deliveryId: number, notes: string, photos: File[]): Observable<any> {
    const fd = new FormData();
    fd.append('notes', notes || '');
    photos.forEach(p => fd.append('photos', p));
    return this.http.post(`${this.url}/driver/${driverToken}/deliver/${deliveryId}`, fd);
  }

  markFailed(driverToken: string, deliveryId: number, reason: string, notes: string, photos: File[]): Observable<any> {
    const fd = new FormData();
    fd.append('reason', reason);
    fd.append('notes', notes || '');
    photos.forEach(p => fd.append('photos', p));
    return this.http.post(`${this.url}/driver/${driverToken}/fail/${deliveryId}`, fd);
  }

  markInTransit(driverToken: string, deliveryId: number): Observable<any> {
    return this.http.post(`${this.url}/driver/${driverToken}/transit/${deliveryId}`, {});
  }

  // --- CHAT DRIVER (NUEVO) ---
  getDriverChat(driverToken: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.url}/driver/${driverToken}/chat`);
  }

  sendDriverMessage(driverToken: string, text: string): Observable<any> {
    return this.http.post<any>(`${this.url}/driver/${driverToken}/chat`, { text });
  }

  // ═══════════════════════════════════════════
  //  DRIVER EXPENSES
  // ═══════════════════════════════════════════
  addDriverExpense(driverToken: string, data: any): Observable<any> {
    const fd = new FormData();
    fd.append('amount', data.amount);
    fd.append('expenseType', data.expenseType);
    fd.append('notes', data.notes || '');
    if (data.photo) {
      fd.append('photo', data.photo);
    }
    return this.http.post(`${this.url}/driver/${driverToken}/expenses`, fd);
  }

  getDriverExpenses(period?: string): Observable<import('../../shared/models/models').DriverExpense[]> {
    let params = '';
    if (period) params = `?period=${period}`;
    return this.http.get<import('../../shared/models/models').DriverExpense[]>(`${this.url}/admin/expenses${params}`);
  }

  // ═══════════════════════════════════════════
  //  PUBLIC CLIENT VIEW
  // ═══════════════════════════════════════════
  getClientOrder(accessToken: string): Observable<ClientOrderView> {
    return this.http.get<ClientOrderView>(`${this.url}/pedido/${accessToken}`);
  }

  // ═══════════════════════════════════════════
  //  SUPPLIERS & INVESTMENTS
  // ═══════════════════════════════════════════
  getSuppliers(): Observable<import('../../shared/models/models').Supplier[]> {
    return this.http.get<import('../../shared/models/models').Supplier[]>(`${this.url}/suppliers`);
  }

  addSupplier(data: any): Observable<import('../../shared/models/models').Supplier> {
    return this.http.post<import('../../shared/models/models').Supplier>(`${this.url}/suppliers`, data);
  }

  updateSupplier(id: number, data: any): Observable<import('../../shared/models/models').Supplier> {
    return this.http.put<import('../../shared/models/models').Supplier>(`${this.url}/suppliers/${id}`, data);
  }

  deleteSupplier(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/suppliers/${id}`);
  }

  getInvestments(supplierId: number): Observable<import('../../shared/models/models').Investment[]> {
    return this.http.get<import('../../shared/models/models').Investment[]>(`${this.url}/suppliers/${supplierId}/investments`);
  }

  addInvestment(supplierId: number, data: any): Observable<import('../../shared/models/models').Investment> {
    return this.http.post<import('../../shared/models/models').Investment>(`${this.url}/suppliers/${supplierId}/investments`, data);
  }

  deleteInvestment(supplierId: number, investmentId: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/suppliers/${supplierId}/investments/${investmentId}`);
  }

  // ═══════════════════════════════════════════
  //  FINANCIALS
  // ═══════════════════════════════════════════
  getFinancialReport(startDate: string, endDate: string): Observable<import('../../shared/models/models').FinancialReport> {
    return this.http.get<import('../../shared/models/models').FinancialReport>(
      `${this.url}/admin/financials?startDate=${startDate}&endDate=${endDate}`
    );
  }



  // ═══════════════════════════════════════════
  //  LOYALTY (REGIPUNTOS)
  // ═══════════════════════════════════════════
  getLoyaltySummary(clientId: number): Observable<import('../../shared/models/models').LoyaltySummary> {
    return this.http.get<import('../../shared/models/models').LoyaltySummary>(`${this.url}/loyalty/${clientId}`);
  }

  getLoyaltyHistory(clientId: number): Observable<import('../../shared/models/models').LoyaltyTransaction[]> {
    return this.http.get<import('../../shared/models/models').LoyaltyTransaction[]>(`${this.url}/loyalty/${clientId}/history`);
  }

  adjustLoyaltyPoints(req: import('../../shared/models/models').AdjustPointsRequest): Observable<any> {
    return this.http.post<any>(`${this.url}/loyalty/adjust`, req);
  }
}