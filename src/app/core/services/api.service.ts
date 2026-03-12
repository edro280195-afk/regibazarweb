import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
    DashboardDto, OrderSummaryDto, PagedResult, ReportDto, ClientDto,
    RouteDto, SupplierDto, InvestmentDto, SalesPeriodDto, PeriodReportDto,
    FinancialReportDto, DriverExpenseDto, ManualOrderRequest, OrderStatsDto,
    AddPaymentRequest, CreateSupplierRequest, CreateInvestmentRequest,
    CreateSalesPeriodRequest, UpdateOrderDetailsRequest, CreateAdminExpenseRequest,
    CommonProductDto, GlowUpReportDto, OrderPaymentDto, OrderPackageDto, GeneratePackagesRequest,
    AiParsedOrder, AiInsight
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
    private readonly base = environment.apiUrl;

    constructor(private http: HttpClient) { }

    getApiUrl(): string {
        return this.base;
    }

    // ── Dashboard ──
    getDashboard(): Observable<DashboardDto> {
        return this.http.get<DashboardDto>(`${this.base}/orders/dashboard`);
    }

    // ── Orders ──
    getOrders(): Observable<OrderSummaryDto[]> {
        return this.http.get<OrderSummaryDto[]>(`${this.base}/orders`);
    }

    getOrdersPaged(page: number, size: number, status?: string, search?: string, type?: string, startDate?: string, endDate?: string, clientType?: string): Observable<PagedResult<OrderSummaryDto>> {
        let params = new HttpParams()
            .set('page', page.toString())
            .set('pageSize', size.toString());
        if (status) params = params.set('status', status);
        if (search) params = params.set('search', search);
        if (type) params = params.set('type', type);
        if (clientType) params = params.set('clientType', clientType);
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        return this.http.get<PagedResult<OrderSummaryDto>>(`${this.base}/orders/paged`, { params });
    }

    getOrderStats(): Observable<OrderStatsDto> {
        return this.http.get<OrderStatsDto>(`${this.base}/orders/stats`);
    }

    createManualOrder(order: ManualOrderRequest): Observable<OrderSummaryDto> {
        return this.http.post<OrderSummaryDto>(`${this.base}/orders/manual`, order);
    }

    parseLiveText(text: string, currentState: AiParsedOrder[]): Observable<AiParsedOrder[]> {
        return this.http.post<AiParsedOrder[]>(`${this.base}/orders/parse-live`, { text, currentState });
    }

    updateOrderDetails(id: number, data: UpdateOrderDetailsRequest): Observable<any> {
        return this.http.put(`${this.base}/orders/${id}`, data);
    }

    updateOrderStatus(id: number, data: { status?: string; orderType?: string; postponedAt?: string; postponedNote?: string }): Observable<any> {
        return this.http.patch(`${this.base}/orders/${id}/status`, data);
    }

    deleteOrder(id: number): Observable<any> {
        return this.http.delete(`${this.base}/orders/${id}`);
    }

    getPackages(orderId: number): Observable<OrderPackageDto[]> {
        return this.http.get<OrderPackageDto[]>(`${this.base}/orders/${orderId}/packages`);
    }

    generatePackages(orderId: number, data: GeneratePackagesRequest): Observable<OrderPackageDto[]> {
        return this.http.post<OrderPackageDto[]>(`${this.base}/orders/${orderId}/packages/generate`, data);
    }

    addPayment(orderId: number, payment: AddPaymentRequest): Observable<OrderPaymentDto> {
        return this.http.post<OrderPaymentDto>(`${this.base}/orders/${orderId}/payments`, payment);
    }

    deletePayment(orderId: number, paymentId: number): Observable<any> {
        return this.http.delete(`${this.base}/orders/${orderId}/payments/${paymentId}`);
    }

    addOrderItem(orderId: number, item: { productName: string; quantity: number; unitPrice: number }): Observable<any> {
        return this.http.post(`${this.base}/orders/${orderId}/items`, item);
    }

    updateOrderItem(orderId: number, itemId: number, item: { productName: string; quantity: number; unitPrice: number }): Observable<any> {
        return this.http.put(`${this.base}/orders/${orderId}/items/${itemId}`, item);
    }

    removeOrderItem(orderId: number, itemId: number): Observable<any> {
        return this.http.delete(`${this.base}/orders/${orderId}/items/${itemId}`);
    }

    uploadExcel(file: File): Observable<any> {
        const fd = new FormData();
        fd.append('file', file);
        return this.http.post(`${this.base}/orders/upload-excel`, fd);
    }

    getCommonProducts(): Observable<CommonProductDto[]> {
        return this.http.get<CommonProductDto[]>(`${this.base}/orders/common-products`);
    }

    // ── Reports ──
    getReports(start: string, end: string): Observable<ReportDto> {
        return this.http.get<ReportDto>(`${this.base}/orders/reports`, {
            params: new HttpParams().set('start', start).set('end', end)
        });
    }

    getReportInsights(report: ReportDto): Observable<AiInsight[]> {
        return this.http.post<AiInsight[]>(`${this.base}/reports/ai-insights`, report);
    }

    getGlowUp(): Observable<GlowUpReportDto> {
        return this.http.get<GlowUpReportDto>(`${this.base}/reports/glow-up-current-month`);
    }

    // ── Clients ──
    getClients(): Observable<ClientDto[]> {
        return this.http.get<ClientDto[]>(`${this.base}/clients`);
    }

    getClient(id: number): Observable<ClientDto> {
        return this.http.get<ClientDto>(`${this.base}/clients/${id}`);
    }

    updateClient(id: number, data: { name: string; phone?: string; address?: string; tag: string; type: string; deliveryInstructions?: string }): Observable<any> {
        return this.http.put(`${this.base}/clients/${id}`, data);
    }

    deleteClient(id: number): Observable<any> {
        return this.http.delete(`${this.base}/clients/${id}`);
    }

    // ── Routes ──
    getRoutes(): Observable<RouteDto[]> {
        return this.http.get<RouteDto[]>(`${this.base}/routes`);
    }

    getRoute(id: number): Observable<RouteDto> {
        return this.http.get<RouteDto>(`${this.base}/routes/${id}`);
    }

    createRoute(orderIds: number[]): Observable<RouteDto> {
        return this.http.post<RouteDto>(`${this.base}/routes`, { orderIds });
    }

    deleteRoute(id: number): Observable<any> {
        return this.http.delete(`${this.base}/routes/${id}`);
    }

    liquidateRoute(id: number): Observable<any> {
        return this.http.post(`${this.base}/routes/${id}/liquidate`, {});
    }

    // ── Suppliers ──
    getSuppliers(): Observable<SupplierDto[]> {
        return this.http.get<SupplierDto[]>(`${this.base}/suppliers`);
    }

    createSupplier(data: CreateSupplierRequest): Observable<SupplierDto> {
        return this.http.post<SupplierDto>(`${this.base}/suppliers`, data);
    }

    updateSupplier(id: number, data: CreateSupplierRequest): Observable<SupplierDto> {
        return this.http.put<SupplierDto>(`${this.base}/suppliers/${id}`, data);
    }

    deleteSupplier(id: number): Observable<any> {
        return this.http.delete(`${this.base}/suppliers/${id}`);
    }

    getInvestments(supplierId: number): Observable<InvestmentDto[]> {
        return this.http.get<InvestmentDto[]>(`${this.base}/suppliers/${supplierId}/investments`);
    }

    addInvestment(supplierId: number, data: CreateInvestmentRequest): Observable<InvestmentDto> {
        return this.http.post<InvestmentDto>(`${this.base}/suppliers/${supplierId}/investments`, data);
    }

    deleteInvestment(supplierId: number, investmentId: number): Observable<any> {
        return this.http.delete(`${this.base}/suppliers/${supplierId}/investments/${investmentId}`);
    }

    // ── Financials ──
    getFinancials(startDate: string, endDate: string): Observable<FinancialReportDto> {
        return this.http.get<FinancialReportDto>(`${this.base}/admin/financials`, {
            params: new HttpParams().set('startDate', startDate).set('endDate', endDate)
        });
    }

    getExpenses(period?: string): Observable<DriverExpenseDto[]> {
        let params = new HttpParams();
        if (period) params = params.set('period', period);
        return this.http.get<DriverExpenseDto[]>(`${this.base}/admin/expenses`, { params });
    }

    createExpense(data: CreateAdminExpenseRequest): Observable<DriverExpenseDto> {
        return this.http.post<DriverExpenseDto>(`${this.base}/admin/expenses`, data);
    }

    deleteExpense(id: number): Observable<any> {
        return this.http.delete(`${this.base}/admin/expenses/${id}`);
    }

    // ── Sales Periods ──
    getSalesPeriods(): Observable<SalesPeriodDto[]> {
        return this.http.get<SalesPeriodDto[]>(`${this.base}/salesperiods`);
    }

    createSalesPeriod(data: CreateSalesPeriodRequest): Observable<SalesPeriodDto> {
        return this.http.post<SalesPeriodDto>(`${this.base}/salesperiods`, data);
    }

    getPeriodReport(id: number): Observable<PeriodReportDto> {
        return this.http.get<PeriodReportDto>(`${this.base}/reports/period/${id}`);
    }

    // ── Loyalty ──
    getLoyaltySummary(clientId: number): Observable<any> {
        return this.http.get(`${this.base}/loyalty/${clientId}`);
    }

    getLoyaltyHistory(clientId: number): Observable<any> {
        return this.http.get(`${this.base}/loyalty/${clientId}/history`);
    }

    adjustPoints(data: { clientId: number; points: number; reason: string }): Observable<any> {
        return this.http.post(`${this.base}/loyalty/adjust`, data);
    }

    // ── Public Tracking (Client-Facing) ──
    publicGetOrder(accessToken: string): Observable<any> {
        return this.http.get(`${this.base}/pedido/${accessToken}`);
    }

    publicConfirmOrder(accessToken: string): Observable<any> {
        return this.http.post(`${this.base}/pedido/${accessToken}/confirm`, {});
    }

    publicGetChat(accessToken: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.base}/pedido/${accessToken}/chat`);
    }

    publicSendChatMessage(accessToken: string, text: string): Observable<any> {
        return this.http.post(`${this.base}/pedido/${accessToken}/chat`, { text });
    }
    
    publicUpdateInstructions(accessToken: string, instructions: string): Observable<any> {
        return this.http.patch(`${this.base}/pedido/${accessToken}/instructions`, { instructions });
    }

    // ── AI Voice Routes ──
    getAiRouteSelection(voiceCommand: string, availableOrders: OrderSummaryDto[]): Observable<{ selectedOrderIds: number[], aiConfirmationMessage: string }> {
        return this.http.post<{ selectedOrderIds: number[], aiConfirmationMessage: string }>(`${this.base}/routes/ai-select`, {
            voiceCommand,
            availableOrders
        });
    }

    // ── Driver (Repartidor) ──
    getDriverRoute(driverToken: string): Observable<any> {
        return this.http.get(`${this.base}/driver/${driverToken}`);
    }

    startRoute(driverToken: string): Observable<any> {
        return this.http.post(`${this.base}/driver/${driverToken}/start`, {});
    }

    updateLocation(driverToken: string, lat: number, lng: number): Observable<any> {
        return this.http.post(`${this.base}/driver/${driverToken}/location`, { latitude: lat, longitude: lng });
    }

    driverReorderRouteDeliveries(driverToken: string, orderedDeliveryIds: number[]): Observable<any> {
        return this.http.put(`${this.base}/driver/${driverToken}/reorder`, orderedDeliveryIds);
    }

    markInTransit(driverToken: string, deliveryId: number): Observable<any> {
        return this.http.post(`${this.base}/driver/${driverToken}/transit/${deliveryId}`, {});
    }

    markDelivered(driverToken: string, deliveryId: number, notes: string, photos: File[], payments?: { amount: number; method: string; notes?: string }[]): Observable<any> {
        const fd = new FormData();
        fd.append('notes', notes);
        photos.forEach(p => fd.append('photos', p));
        if (payments) fd.append('payments', JSON.stringify(payments));
        return this.http.post(`${this.base}/driver/${driverToken}/deliver/${deliveryId}`, fd);
    }

    markFailed(driverToken: string, deliveryId: number, reason: string, notes: string, photos: File[]): Observable<any> {
        const fd = new FormData();
        fd.append('reason', reason);
        fd.append('notes', notes);
        photos.forEach(p => fd.append('photos', p));
        return this.http.post(`${this.base}/driver/${driverToken}/fail/${deliveryId}`, fd);
    }

    // ── Driver Chat (Admin ↔ Driver) ──
    getDriverChat(driverToken: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.base}/driver/${driverToken}/chat`);
    }

    sendDriverMessage(driverToken: string, text: string): Observable<any> {
        return this.http.post<any>(`${this.base}/driver/${driverToken}/chat`, { text });
    }

    // ── Driver Chat (Driver ↔ Client) ──
    getDriverClientChat(driverToken: string, deliveryId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.base}/driver/${driverToken}/deliver/${deliveryId}/chat`);
    }

    sendDriverClientMessage(driverToken: string, deliveryId: number, text: string): Observable<any> {
        return this.http.post<any>(`${this.base}/driver/${driverToken}/deliver/${deliveryId}/chat`, { text });
    }

    // ── Driver Expenses ──
    addDriverExpense(driverToken: string, data: any): Observable<any> {
        const fd = new FormData();
        fd.append('expenseType', data.type);
        fd.append('amount', data.amount.toString());
        if (data.notes) fd.append('notes', data.notes);
        if (data.photo) fd.append('photo', data.photo);
        return this.http.post(`${this.base}/driver/${driverToken}/expenses`, fd);
    }

    // ── Route Mutation ──
    addOrderToRoute(routeId: number, orderId: number): Observable<any> {
        return this.http.post(`${this.base}/routes/${routeId}/add-order`, orderId);
    }

    removeOrderFromRoute(routeId: number, orderId: number): Observable<any> {
        return this.http.delete(`${this.base}/routes/${routeId}/remove-order/${orderId}`);
    }

    // ── Route Reorder ──
    reorderRouteDeliveries(routeId: number, deliveryIds: number[]): Observable<any> {
        return this.http.put<any>(`${this.base}/routes/${routeId}/reorder`, deliveryIds);
    }
}
