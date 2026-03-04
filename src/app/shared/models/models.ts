// ── Auth ──
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  name: string;
  expiresAt: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

// ── Orders ──
export interface OrderSummary {
  id: number;
  clientId?: number;
  clientName: string;
  clientType?: 'Nueva' | 'Frecuente';
  clientPhone?: string;
  clientAddress?: string;
  orderType: string;
  deliveryTime?: string;
  pickupDate?: string;
  postponedAt?: string;
  postponedNote?: string;
  subtotal: number;
  shippingCost: number;
  advancePayment?: number;
  total: number;
  status: string;
  link: string;
  accessToken: string;
  expiresAt: string;
  items: OrderItem[];
  createdAt: string;
  payments?: OrderPayment[];
  amountPaid?: number;
  balanceDue?: number;
  amountDue?: number;
  tags?: string[];
  paymentMethod?: string;
  // SalesPeriod (Corte)
  salesPeriodId?: number;
  salesPeriodName?: string;
}

export interface OrderPayment {
  id: number;
  orderId: number;
  amount: number;
  method: string; // 'Efectivo' | 'Transferencia' | 'Deposito' | 'Tarjeta'
  date: string; // ISO
  registeredBy: string; // 'Admin' | 'Driver'
  notes?: string;
}

export interface OrderItem {
  id: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ExcelUploadResult {
  ordersCreated: number;
  clientsCreated: number;
  orders: OrderSummary[];
  warnings: string[];
}

export interface ManualOrderRequest {
  clientName: string;
  clientType?: 'Nueva' | 'Frecuente';
  clientPhone?: string;
  clientAddress?: string;
  orderType: string;
  deliveryTime?: string; // [NEW]
  pickupDate?: string;   // [NEW]
  items: { productName: string; quantity: number; unitPrice: number }[];
}

// ── Routes ──
export interface DeliveryRoute {
  id: number;
  name?: string;
  driverToken: string;
  driverLink: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  deliveries: RouteDelivery[];
  expenses?: DriverExpense[];
  driverLocation?: {
    latitude: number;
    longitude: number;
    lastUpdate: string;
  };
}

export interface RouteDelivery {
  id: number;        // <--- Agrega esto
  address?: string;
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
  paymentMethod?: string; // Legacy
  payments?: OrderPayment[];
  amountPaid?: number;
  balanceDue?: number;
}

// ── Client View ──
export interface ClientOrderView {
  clientId?: number; // [NEW] Needed for loyalty
  clientName: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  status: string;
  estimatedArrival?: string;
  driverLocation?: DriverLocation;
  queuePosition?: number;
  totalDeliveries?: number;
  isCurrentDelivery: boolean;
  deliveriesAhead?: number;
  clientLatitude?: number;
  clientLongitude?: number;
  createdAt: string;       // [NEW] Para calcular fecha de entrega
  clientType?: 'Nueva' | 'Frecuente';
  advancePayment?: number; // Legacy
  payments?: OrderPayment[];
  amountPaid?: number;
  balanceDue?: number;
  clientAddress?: string;
}

export interface DriverLocation {
  latitude: number;
  longitude: number;
  lastUpdate: string;
}

// ── Dashboard ──
export interface Dashboard {
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
  salesByMonth: { month: string; sales: number }[];
  clientsNueva: number;
  clientsFrecuente: number;
  ordersDelivery: number;
  ordersPickUp: number;
  activePeriod?: {
    id: number;
    name: string;
    totalSales: number;
    totalInvested: number;
    netProfit: number;
    collectedAmount?: number;
  } | null;
}

// ── Reports ──
export interface ReportData {
  totalRevenue: number;
  totalInvestment: number;
  totalExpenses: number;
  netProfit: number;
  totalOrders: number;
  pendingOrders: number;
  inRouteOrders: number;
  deliveredOrders: number;
  notDeliveredOrders: number;
  canceledOrders: number;
  deliveryOrders: number;
  pickUpOrders: number;
  avgTicket: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  ordersByDay: { date: string; count: number; amount: number }[];
  totalRoutes: number;
  completedRoutes: number;
  successRate: number;
  totalDriverExpenses: number;
  newClients: number;
  frequentClients: number;
  activeClients: number;
  topClients: { name: string; orders: number; totalSpent: number }[];
  cashOrders: number;
  cashAmount: number;
  transferOrders: number;
  transferAmount: number;
  depositOrders: number;
  depositAmount: number;
  unassignedPaymentOrders: number;
  supplierSummaries: { name: string; totalInvested: number; investmentCount: number }[];
}

// ── Glow Up (IG Story) ──
export interface GlowUpReportDto {
  monthName: string;
  totalDeliveries: number;
  topProduct: string;
  newClients: number;
}
export interface Client {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  orderCount: number;
  tag?: string;
  type?: 'Nueva' | 'Frecuente'; // [NEW]
  totalSpent?: number;
  ordersCount?: number; // Some endpoints might return this aliases
}

// ── Suppliers ──
export interface Supplier {
  id: number;
  name: string;
  contactName?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  totalInvested?: number;
}

export interface Investment {
  id: number;
  supplierId: number;
  supplierName?: string;
  amount: number;
  date: string; // ISO
  notes?: string;
  createdAt: string;
  // Multi-currency
  currency: string; // 'MXN' | 'USD'
  exchangeRate: number;
  totalInPesos?: number;
  // SalesPeriod
  salesPeriodId?: number;
  salesPeriodName?: string;
}

export interface DriverExpense {
  id: number;
  driverRouteId?: number;
  routeName?: string;
  driverName?: string;
  amount: number;
  expenseType: string; // 'Gasolina', 'Comida', 'Otros'
  date: string; // ISO
  notes?: string;
  evidenceUrl?: string; // Foto del ticket
  createdAt?: string;
}

export interface FinancialReport {
  period: string; // '2023-Q1', '2023-Q2' (Quincena)
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalInvestment: number;
  totalExpenses: number;
  netProfit: number;
  details: {
    investments: Investment[];
    incomes: OrderSummary[]; // Or a simplified version
    expenses: DriverExpense[];
  };
}
// ── Chat ──
export interface ChatMessage {
  id: number;
  routeId: number;
  sender: 'Admin' | 'Driver';
  senderName?: string;
  text: string;
  timestamp: string; // ISO
  read: boolean;
}

// ── Loyalty ──
export interface LoyaltySummary {
  clientId: number;
  clientName: string;
  currentPoints: number;
  lifetimePoints: number;
  tier: string;
  lastAccrual?: string; // ISO Date
}

export interface LoyaltyTransaction {
  id: number;
  points: number;
  reason: string;
  date: string; // ISO Date
}

export interface AdjustPointsRequest {
  clientId: number;
  points: number; // Can be negative
  reason: string;
}

// ── SalesPeriods (Cortes de Venta) ──
export interface SalesPeriod {
  id: number;
  name: string;
  startDate: string; // ISO
  endDate: string;   // ISO
  isActive: boolean;
  createdAt: string; // ISO
}

export interface PeriodInvestmentBySupplier {
  supplierName: string;
  totalInvested: number;
  investmentCount: number;
}

export interface PeriodReport {
  periodId: number;
  periodName: string;
  totalSales: number;
  totalInvestments: number;
  netProfit: number;
  investmentsBySupplier: PeriodInvestmentBySupplier[];
}


