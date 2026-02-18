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
  clientName: string;
  clientType?: 'Nueva' | 'Frecuente'; // 'Nueva' | 'Frecuente'
  clientPhone?: string;
  clientAddress?: string;
  orderType: string;      // 'Delivery' | 'PickUp'
  deliveryTime?: string;  // [NEW] Hora de entrega estipulada (HH:mm)
  pickupDate?: string;    // [NEW] Fecha específica para PickUp
  postponedAt?: string;   // Fecha ISO
  postponedNote?: string; // Motivo
  subtotal: number;
  shippingCost: number;
  total: number;
  status: string; // 'Pending', 'InRoute', 'Delivered', 'NotDelivered', 'Canceled', 'Postponed'
  clientLink: string;
  accessToken: string;
  expiresAt: string;
  items: OrderItem[];
  createdAt: string; // ISO Date

  // Payments
  paymentStatus?: 'Unpaid' | 'Partial' | 'Paid';
  payments?: Payment[];
  amountPaid?: number;
  amountDue?: number;

  // Tags
  tags?: string[];
}

export interface Payment {
  id: number;
  orderId: number;
  amount: number;
  method: 'Efectivo' | 'Transferencia' | 'OXXO' | 'Tarjeta';
  reference?: string;
  date: string; // ISO
  notes?: string;
  createdAt: string;
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
  driverToken: string;
  driverLink: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  deliveries: RouteDelivery[];
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
  clientType?: 'Nueva' | 'Frecuente';     // [NEW] 'Nueva' | 'Frecuente'
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
}

// ── Client entity ──
export interface Client {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  orderCount: number;
  tag?: string;
  clientType?: 'Nueva' | 'Frecuente'; // [NEW]
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
}

export interface Investment {
  id: number;
  supplierId: number;
  amount: number;
  date: string; // ISO
  notes?: string;
  createdAt: string;
  // Multi-currency
  currency: string; // 'MXN' | 'USD'
  exchangeRate: number;
  totalInPesos?: number; // Calculated for UI
}

export interface DriverExpense {
  id: number;
  driverId: number;
  driverName?: string;
  amount: number;
  expenseType: string; // 'Gasolina', 'Comida', 'Otros'
  date: string; // ISO
  notes?: string;
  evidenceUrl?: string; // Foto del ticket
  createdAt: string;
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

// ── Loyalty (RegiPuntos) ──
export interface LoyaltyAccount {
  clientId: number;
  currentPoints: number;
  tier: 'Pink' | 'Gold' | 'Diamond'; // Niveles Coquette
  lifetimePoints: number;
  lastAccrual: string;
}

export interface PointTransaction {
  id: number;
  clientId: number;
  orderId?: number;
  amount: number; // Positivo (ganancia) o negativo (uso)
  reason: string;
  date: string;
}
