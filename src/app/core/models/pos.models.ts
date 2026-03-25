export interface Product {
  id: number;
  sku: string;
  name: string;
  price: number;
  stock: number;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId?: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

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
  PickUp = 1,
  POS_Tienda = 2
}

export interface Order {
  id: number;
  clientId: number;
  clientName?: string;
  subtotal: number;
  shippingCost: number;
  total: number;
  discountAmount: number;
  status: OrderStatus;
  orderType: OrderType;
  items: OrderItem[];
  createdAt: string;
}

export interface OrderPayment {
  id: number;
  orderId: number;
  amount: number;
  method: string;
  date: string;
  registeredBy: string;
  notes?: string;
}

export interface CashRegisterSession {
  id: number;
  userId: number;
  openingTime: string;
  closingTime?: string;
  initialCash: number;
  finalCashExpected: number;
  finalCashActual?: number;
  status: SessionStatus;
}

export enum SessionStatus {
  Open = 0,
  Closed = 1
}
