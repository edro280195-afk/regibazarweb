// ── Enums ──

export enum OrderStatus {
    Pending = 0,
    InRoute = 1,
    Delivered = 2,
    NotDelivered = 3,
    Canceled = 4,
    Postponed = 5,
    Confirmed = 6,
    Shipped = 7
}

export enum OrderType {
    Delivery = 0,
    PickUp = 1
}

export enum ClientTag {
    None = 0,
    RisingStar = 1,
    Vip = 2,
    Blacklist = 3
}

export enum RouteStatus {
    Pending = 0,
    Active = 1,
    Completed = 2,
    Canceled = 3
}

export enum DeliveryStatus {
    Pending = 0,
    Delivered = 1,
    NotDelivered = 2,
    InTransit = 3
}

// ── Helpers ──

export const ORDER_STATUS_LABELS: Record<number, string> = {
    0: '⏳ Pendiente',
    1: '🚗 En Camino',
    2: '✅ Entregada',
    3: '❌ No Entregada',
    4: '🚫 Cancelada',
    5: '📅 Pospuesta',
    6: '💖 Confirmada',
    7: '📦 Enviada'
};

export const ORDER_STATUS_EMOJI: Record<number, string> = {
    0: '⏳',
    1: '🚗',
    2: '✅',
    3: '❌',
    4: '🚫',
    5: '📅',
    6: '💖',
    7: '📦'
};

export const ORDER_STATUS_CSS: Record<string, string> = {
    'Pending': 'badge-pending',
    'InRoute': 'badge-inroute',
    'Delivered': 'badge-delivered',
    'NotDelivered': 'badge-notdelivered',
    'Canceled': 'badge-canceled',
    'Postponed': 'badge-postponed',
    'Confirmed': 'badge-confirmed',
    'Shipped': 'badge-shipped'
};

export const CLIENT_TAG_LABELS: Record<string, string> = {
    'None': 'Normal',
    'RisingStar': 'En Ascenso 🚀',
    'Vip': 'Consentida 👑',
    'Blacklist': 'Lista Negra 🚫'
};

export const ROUTE_STATUS_LABELS: Record<number, string> = {
    0: 'Pendiente',
    1: 'Activa',
    2: 'Completada',
    3: 'Cancelada'
};

// ── Interfaces ──

export interface OrderItemDto {
    id: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
}

export interface OrderPaymentDto {
    id: number;
    orderId: number;
    amount: number;
    method: string;
    date: string;
    registeredBy: string;
    notes?: string;
}

export interface OrderSummaryDto {
    id: number;
    clientName: string;
    status: string;
    total: number;
    link: string;
    itemsCount: number;
    orderType: string;
    createdAt: string;
    clientType: string;
    clientPhone?: string;
    clientAddress?: string;
    postponedAt?: string;
    postponedNote?: string;
    subtotal: number;
    shippingCost: number;
    accessToken: string;
    expiresAt: string;
    items: OrderItemDto[];
    payments: OrderPaymentDto[];
    amountPaid: number;
    balanceDue: number;
    advancePayment: number;
    paymentMethod?: string;
    salesPeriodId?: number;
    salesPeriodName?: string;
    clientId?: number;
    tags?: string[];
    deliveryInstructions?: string;
    discountAmount?: number;
}

export interface PagedResult<T> {
    items: T[];
    totalCount: number;
    currentPage: number;
    pageSize: number;
}

export interface ExcelUploadResultDto {
    ordersCreated: number;
    clientsCreated: number;
    warnings: string[];
    // Represents a quick summary to show the links immediately
    orders: {
        id: number;
        clientName: string;
        total: number;
        orderType: string;
        link: string;
        items: { id: number; productName: string; quantity: number }[];
    }[];
}

export interface ClientDto {
    id: number;
    name: string;
    phone?: string;
    address?: string;
    tag: string;
    ordersCount: number;
    totalSpent: number;
    type?: string;
    deliveryInstructions?: string;
}

export interface MonthlySalesDto {
    month: string;
    sales: number;
}

export interface ActivePeriodSummaryDto {
    id: number;
    name: string;
    totalSales: number;
    totalInvested: number;
    netProfit: number;
    collectedAmount: number;
}

export interface DashboardDto {
    totalClients: number;
    totalOrders: number;
    pendingOrders: number;
    deliveredOrders: number;
    notDeliveredOrders: number;
    activeRoutes: number;
    totalRevenue: number;
    revenueMonth: number;
    revenueToday: number;
    totalInvestment: number;
    totalCashOrders: number;
    totalCashAmount: number;
    totalTransferOrders: number;
    totalTransferAmount: number;
    totalDepositOrders: number;
    totalDepositAmount: number;
    salesByMonth: MonthlySalesDto[];
    clientsNueva: number;
    clientsFrecuente: number;
    ordersDelivery: number;
    ordersPickUp: number;
    activePeriod?: ActivePeriodSummaryDto;
    pendingAmount: number;
    recentOrders?: OrderSummaryDto[];
}

export interface TopProductDto {
    name: string;
    quantity: number;
    revenue: number;
}

export interface DailyCountDto {
    date: string;
    count: number;
    amount: number;
}

export interface TopClientDto {
    name: string;
    orders: number;
    totalSpent: number;
}

export interface SupplierSummaryDto {
    name: string;
    totalInvested: number;
    investmentCount: number;
}

export interface ReportDto {
    totalRevenue: number;      // Billed (Delivered total)
    totalCollected: number;    // Actually paid (OrderPayments)
    totalInvestment: number;
    totalExpenses: number;     // DriverExpenses
    netProfit: number;         // TotalRevenue - TotalInvestment - TotalExpenses
    cashBalance: number;       // TotalCollected - TotalInvestment - TotalExpenses
    totalOrders: number;
    pendingOrders: number;
    inRouteOrders: number;
    deliveredOrders: number;
    notDeliveredOrders: number;
    canceledOrders: number;
    deliveryOrders: number;
    pickUpOrders: number;
    avgTicket: number;
    topProducts: TopProductDto[];
    ordersByDay: DailyCountDto[];
    totalRoutes: number;
    completedRoutes: number;
    successRate: number;
    totalDriverExpenses: number;
    newClients: number;
    frequentClients: number;
    activeClients: number;
    topClients: TopClientDto[];
    cashOrders: number;
    cashAmount: number;
    transferOrders: number;
    transferAmount: number;
    depositOrders: number;
    depositAmount: number;
    unassignedPaymentOrders: number;
    unassignedPaymentAmount: number;
    supplierSummaries: SupplierSummaryDto[];
    avgDeliveryTimeMinutes: number;
    avgRouteTimeMinutes: number;
    // Comparativa
    prevPeriodRevenue: number;
    prevPeriodOrders: number;
}

export interface RouteDeliveryDto {
    deliveryId: number;
    orderId: number;
    sortOrder: number;
    clientName: string;
    clientAddress?: string;
    latitude?: number;
    longitude?: number;
    status: string;
    total: number;
    deliveredAt?: string;
    notes?: string;
    failureReason?: string;
    evidenceUrls: string[];
    clientPhone?: string;
    paymentMethod?: string;
    payments?: OrderPaymentDto[];
    amountPaid: number;
    balanceDue: number;
    deliveryInstructions?: string;
    items?: OrderItemDto[];
}

export interface DriverExpenseDto {
    id: number;
    driverRouteId?: number;
    driverName?: string;
    amount: number;
    expenseType: string;
    date: string;
    notes?: string;
    evidenceUrl?: string;
    createdAt: string;
}

export interface RouteDto {
    id: number;
    driverToken: string;
    driverLink: string;
    status: string;
    createdAt: string;
    startedAt?: string;
    deliveries: RouteDeliveryDto[];
    expenses?: DriverExpenseDto[];
}

export interface SupplierDto {
    id: number;
    name: string;
    contactName?: string;
    phone?: string;
    notes?: string;
    createdAt: string;
    totalInvested: number;
}

export interface InvestmentDto {
    id: number;
    supplierId: number;
    amount: number;
    date: string;
    notes?: string;
    createdAt: string;
    currency: string;
    exchangeRate: number;
    totalMXN: number;
    salesPeriodId?: number;
    salesPeriodName?: string;
}

export interface SalesPeriodDto {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
    createdAt: string;
}

export interface PeriodReportDto {
    periodId: number;
    periodName: string;
    totalSales: number;        // Billed
    totalCollected: number;    // Actually paid
    totalInvestments: number;
    totalExpenses: number;     // Driver expenses
    netProfit: number;         // Billed - Inv - Exp
    cashBalance: number;       // Collected - Inv - Exp
    investmentsBySupplier: { supplierName: string; totalInvested: number; investmentCount: number }[];
}

export interface FinancialReportDto {
    period: string;
    startDate: string;
    endDate: string;
    totalBilled: number;    // Lo facturado
    totalCollected: number; // Lo cobrado real
    totalPending: number;   // Pendiente (Billed - Collected)
    totalInvestment: number;
    totalExpenses: number;
    netProfit: number;      // Utilidad teórica (Billed - Inv - Exp)
    cashBalance: number;    // Dinero real en mano (Collected - Inv - Exp)
    details: {
        investments: { id: number; supplierName: string; amount: number; date: string; notes?: string }[];
        incomes: { id: number; clientName: string; total: number; orderType: string; createdAt: string }[];
        expenses: { id: number; driverRouteId?: number; routeName?: string; driverName?: string; amount: number; expenseType: string; date: string; notes?: string; evidenceUrl?: string }[];
    };
}

export interface OrderStatsDto {
    total: number;
    pending: number;
    pendingAmount: number;
    collectedToday: number;
}

export interface ManualOrderRequest {
    clientName: string;
    clientPhone?: string;
    clientAddress?: string;
    clientType?: string;
    orderType: string;
    items: { productName: string; quantity: number; unitPrice: number }[];
    postponedAt?: string;
    postponedNote?: string;
    status?: string;
    deliveryInstructions?: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    name: string;
    expiresAt: string;
}

export interface CommonProductDto {
    name: string;
    count: number;
    typicalPrice: number;
}

export interface AddPaymentRequest {
    amount: number;
    method: string;
    registeredBy?: string;
    notes?: string;
}

export interface CreateSupplierRequest {
    name: string;
    contactName?: string;
    phone?: string;
    notes?: string;
}

export interface CreateInvestmentRequest {
    amount: number;
    date: string;
    notes?: string;
    currency: string;
    exchangeRate?: number;
    salesPeriodId?: number;
}

export interface CreateSalesPeriodRequest {
    name: string;
    startDate: string;
    endDate: string;
}

export interface UpdateOrderDetailsRequest {
    status?: string;
    orderType?: string;
    postponedAt?: string;
    postponedNote?: string;
    clientName?: string;
    clientAddress?: string;
    clientPhone?: string;
    clientType?: string;
    tags?: string[];
    deliveryTime?: string;
    pickupDate?: string;
    shippingCost?: number;
    advancePayment?: number;
    salesPeriodId?: number;
    deliveryInstructions?: string;
}

export interface CreateAdminExpenseRequest {
    amount: number;
    expenseType: string;
    date: string;
    notes?: string;
    deliveryRouteId?: number;
}

export interface GlowUpReportDto {
    monthName: string;
    totalDeliveries: number;
    topProduct: string;
    newClients: number;
}

export interface OrderPackageDto {
    id: string; // Guid
    packageNumber: number;
    qrCodeValue: string;
    status: string;
    createdAt: string;
    loadedAt?: string;
    deliveredAt?: string;
}

export interface GeneratePackagesRequest {
    count: number;
}

export interface AiParsedOrder {
    clientName: string;
    productName: string;
    quantity: number;
    unitPrice: number;
}

export interface AiInsight {
    category: 'Finanzas' | 'Ventas' | 'Clientas' | 'Riesgo' | 'Operación';
    title: string;
    description: string;
    actionableAdvice: string;
    icon: string;
}

// ── C.A.M.I. ──
export interface CamiMessage {
    role: 'user' | 'model';
    text: string;
}

export interface CamiChatRequest {
    history: CamiMessage[];
    newMessage: string;
}

export interface CamiChatResponse {
    text: string;
    audioBase64?: string;
}

export interface AiRouteSelectionRequest {
    voiceCommand: string;
    availableOrders: OrderSummaryDto[];
}

export interface AiRouteSelectionResponse {
    selectedOrderIds: number[];
    aiConfirmationMessage: string;
    audioBase64?: string;
}

export interface CamiGreetingResponse {
    message: string;
    audioBase64?: string;
}
