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

export enum RaffleStatus {
    Draft = 'Draft',
    Active = 'Active',
    Completed = 'Completed',
    Cancelled = 'Cancelled'
}

export enum RaffleAnimationType {
    Roulette = 'roulette',
    Slot = 'slot',
    Confetti = 'confetti'
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
    type: string;
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
    alternativeAddress?: string;
    deliveryRouteId?: number;
    scheduledDeliveryDate?: string;
    clientFacebookProfileUrl?: string;
    notifiedAt?: string;
    clientPoints?: number;
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
    latitude?: number | null;
    longitude?: number | null;
    aliases?: string[];
}

// ── Resolver multi-señal de clientas ──

export interface ResolveClientRequest {
    name: string;
    phone?: string;
    address?: string;
}

export interface ResolveCandidateDto {
    clientId: number;
    name: string;
    phone?: string;
    address?: string;
    tag: string;
    type: string;
    ordersCount: number;
    totalSpent: number;
    aliases: string[];
    balanceDue: number;
    score: number;
    matchedBy: 'alias' | 'phone' | 'name-fuzzy' | 'alias-fuzzy' | 'address-fuzzy' | string;
}

export type ResolveSuggestedAction = 'use' | 'choose' | 'create';

export interface ResolveClientResponse {
    candidates: ResolveCandidateDto[];
    suggestedAction: ResolveSuggestedAction;
}

// ── Importación masiva de Facebook de clientas ──

export interface FacebookImportRow {
    name: string;
    facebookUrl: string;
}

export type FacebookImportStatus = 'matched' | 'review' | 'notfound';

export interface FacebookImportPreviewItem {
    rowIndex: number;
    inputName: string;
    inputUrl: string;
    urlValid: boolean;
    status: FacebookImportStatus;
    suggestedClientId?: number;
    topScore: number;
    topAlreadyHasFacebook: boolean;
    duplicateUrlInBatch: boolean;
    candidates: ResolveCandidateDto[];
}

export interface FacebookImportPreviewResponse {
    items: FacebookImportPreviewItem[];
}

export interface FacebookImportApplyRow {
    clientId: number;
    facebookUrl: string;
}

export interface FacebookImportApplyResponse {
    applied: number;
    skipped: number;
    errors: string[];
}

// ── RegiPuntos (canje) ──

export type LoyaltyRewardType = 'FixedDiscount' | 'FreeShipping' | 'Gift';

export interface LoyaltyRewardDto {
    id: number;
    name: string;
    description?: string;
    pointsCost: number;
    type: LoyaltyRewardType | string;
    value: number;
    icon?: string;
}

export type ClientAliasSource =
    | 'Unknown'
    | 'ManualConfirm'
    | 'Merge'
    | 'Import'
    | 'LiveOcr'
    | 'LiveAudio';

export interface ClientAliasDto {
    id: number;
    alias: string;
    source: ClientAliasSource | string;
    timesSeen: number;
    createdAt: string;
}

export interface AddAliasRequest {
    alias: string;
    source?: ClientAliasSource;
}

export interface MergeClientsRequest {
    sourceId: number;
    targetId: number;
}

export interface DuplicateSuggestionDto {
    leftClientId: number;
    leftName: string;
    leftOrdersCount: number;
    rightClientId: number;
    rightName: string;
    rightOrdersCount: number;
    reason: 'same-phone' | 'similar-name' | 'similar-address' | string;
    confidence: number;
}

export interface ClientMergeAuditDto {
    id: number;
    sourceClientId: number;
    sourceName: string;
    targetClientId: number;
    targetName: string;
    mode: 'Manual' | 'Auto';
    reason?: string;
    confidence: number;
    ordersMoved: number;
    aliasesMoved: number;
    mergedAt: string;
}

// Captura asistida por video de lives
export type LiveSessionStatus =
    | 'Queued'
    | 'Downloading'
    | 'Transcribing'
    | 'Parsing'
    | 'Scanning'
    | 'Combining'
    | 'Ready'
    | 'Failed';

export type LiveCandidateStatus = 'Pending' | 'Confirmed' | 'Ignored';
export type LiveCandidateSource = 'Spoken' | 'CommentOnly' | 'SpokenAndComment';

export interface ImportLiveRequest {
    facebookUrl: string;
    title?: string;
}

export interface LiveSessionDto {
    id: number;
    facebookUrl: string;
    title?: string | null;
    status: LiveSessionStatus | string;
    statusDetail?: string | null;
    importedAt: string;
    processedAt?: string | null;
    durationSeconds?: number | null;
    productCount: number;
    candidateCount: number;
    pendingCount: number;
    transcript?: string | null;
}

export interface LiveProductDto {
    id: number;
    keyword: string;
    description?: string | null;
    price: number;
    announcedAtSeconds?: number | null;
    candidateCount: number;
}

export interface LiveCandidateDto {
    id: number;
    keyword: string;
    liveProductId?: number | null;
    clientNameSpoken?: string | null;
    commentDisplayName?: string | null;
    resolvedClientId?: number | null;
    resolvedClientName?: string | null;
    proposedAliasPairJson?: string | null;
    source: LiveCandidateSource | string;
    status: LiveCandidateStatus | string;
    spokenAtSeconds?: number | null;
}

export interface ConfirmLiveCandidateRequest {
    clientId?: number | null;
    clientName?: string | null;
    productOverride?: string;
    priceOverride?: number;
    acceptAlias?: boolean;
}

export interface LiveReviewDto {
    session: LiveSessionDto;
    products: LiveProductDto[];
    candidatesByProduct: Record<number, LiveCandidateDto[]>;
    unmatchedCandidates: LiveCandidateDto[];
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
    avgDoorTimeMinutes: number;
    // Comparativa
    prevPeriodRevenue: number;
    prevPeriodOrders: number;
}

export interface RouteDeliveryDto {
    deliveryId: number;
    orderId?: number;
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
    arrivedAt?: string;
    alternativeAddress?: string;
    clientTag?: string;
    clientType?: string;
    // ── Tanda ──
    kind?: 'Order' | 'Tanda';
    tandaParticipantId?: string;
    tandaId?: string;
    tandaName?: string;
    tandaProductName?: string;
    tandaWeek?: number;
    tandaTotalWeeks?: number;
    tandaVariant?: string;
}

export interface AvailableTandaDto {
    tandaParticipantId: string;
    tandaId: string;
    tandaName: string;
    tandaProductName?: string;
    week: number;
    totalWeeks: number;
    variant?: string;
    clientId: number;
    clientName: string;
    clientAddress?: string;
    clientPhone?: string;
    clientLatitude?: number;
    clientLongitude?: number;
    deliveryInstructions?: string;
}

export interface SkippedStopDto {
    kind: 'Order' | 'Tanda';
    id: string;
    name: string;
    reason: string;
}

export interface CreateRouteResponse {
    route: RouteDto;
    skipped: SkippedStopDto[];
}

export interface PreviewStopDto {
    kind: 'Order' | 'Tanda';
    orderId?: number;
    tandaParticipantId?: string;
    sortOrder: number;
    clientName: string;
    clientAddress?: string;
    latitude?: number;
    longitude?: number;
    total: number;
    hasCoords: boolean;
    tandaName?: string;
    tandaWeek?: number;
}

export interface PreviewRouteResponse {
    stops: PreviewStopDto[];
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    optimizerSource: string;
    skipped: SkippedStopDto[];
    stopsWithoutCoords: number;
    polylineEncoded?: string;
    depotLatitude?: number;
    depotLongitude?: number;
}

export interface RecomposeRouteRequest {
    orderIds: number[];
    tandaParticipantIds?: string[];
}

export interface RecomposeRouteResponse {
    route: RouteDto;
    skipped: SkippedStopDto[];
}

export interface BulkGeocodeResultDto {
    clientId: number;
    success: boolean;
    latitude?: number;
    longitude?: number;
    formattedAddress?: string;
    error?: string;
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
    type?: string;
    orderType: string;
    items: { productName: string; quantity: number; unitPrice: number }[];
    postponedAt?: string;
    postponedNote?: string;
    status?: string;
    deliveryInstructions?: string;
    alternativeAddress?: string;
    scheduledDeliveryDate?: string;
    /** ID de clienta ya resuelto vía el resolver multi-señal. Si viene, el backend
     *  salta el lookup por nombre y usa este ID, agregando el clientName tecleado
     *  como alias automáticamente si difiere del nombre canónico. */
    clientId?: number;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    name: string;
    role: string;
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
    /** Fecha real del pago (ISO string). Si no se manda, la API usa la fecha actual. */
    paymentDate?: string;
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
    type?: string;
    tags?: string[];
    deliveryTime?: string;
    pickupDate?: string;
    shippingCost?: number;
    advancePayment?: number;
    salesPeriodId?: number;
    deliveryInstructions?: string;
    alternativeAddress?: string;
    scheduledDeliveryDate?: string;
    clientFacebookProfileUrl?: string;
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
    returnedAt?: string;
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

export interface CamiProactiveSuggestionDto {
    kind: string;
    icon: string;
    title: string;
    detail: string;
    actionLabel: string;
    actionRoute: string;
    priority: number;
}

// ── Tandas ──
export interface TandaProductDto {
    id: string;
    name: string;
    description?: string;
    basePrice: number;
    isActive: boolean;
    createdAt: string;
}

export interface TandaDto {
    id: string;
    productId: string;
    name: string;
    totalWeeks: number;
    weeklyAmount: number;
    penaltyAmount: number;
    startDate: string;
    status: string; // Draft, Active, Completed, Cancelled
    createdAt: string;
    accessToken?: string;
    product?: TandaProductDto;
    participants?: TandaParticipantDto[];
}

export interface TandaParticipantDto {
    id: string;
    tandaId: string;
    customerId: string;
    customerName?: string;
    assignedTurn: number;
    isDelivered: boolean;
    deliveryDate?: string;
    status: string; // Active, Delinquent, Completed
    variant?: string;
    payments?: TandaPaymentDto[];
}

export interface TandaPaymentDto {
    id: string;
    participantId: string;
    weekNumber: number;
    amountPaid: number;
    penaltyPaid: number;
    paymentDate: string;
    isVerified: boolean;
    notes?: string;
}

export interface TandaViewDto {
    id: string;
    name: string;
    productName: string;
    totalWeeks: number;
    weeklyAmount: number;
    startDate: string;
    currentWeek: number;
    participants: TandaParticipantViewDto[];
}

export interface TandaParticipantViewDto {
    name: string;
    assignedTurn: number;
    hasPaidCurrentWeek: boolean;
    paidWeeks: number[];
    isWinnerThisWeek: boolean;
    isDelivered: boolean;
    variant?: string;
}

export interface CreateTandaDto {
    productId: string;
    name: string;
    totalWeeks: number;
    weeklyAmount: number;
    penaltyAmount: number;
    startDate: string;
}

export interface AddParticipantDto {
    tandaId: string;
    customerId: string;
    assignedTurn: number;
    variant?: string;
}

export interface RegisterPaymentDto {
    participantId: string;
    weekNumber: number;
    amountPaid: number;
    penaltyPaid?: number;
    notes?: string;
}

// ── Raffle Models ──

export interface CreateRaffleDto {
    name: string;
    description?: string;
    imageUrl?: string;
    socialShareImageUrl?: string;
    animationType: string;
    prizeType?: string;
    prizeDetails?: string;
    eligibilityRule?: string;
    clientSegmentFilter?: string;
    vipOnly?: boolean;
    blacklistExcluded?: boolean;
    preselectedWinnerIds?: string;
    minOrderTotal?: number;
    maxEntriesPerClient?: number;
    dateRangeStart?: string;
    dateRangeEnd?: string;
    requiredPurchases: number;
    newClientsOnly: boolean;
    frequentClientsOnly: boolean;
    useWeightedRandom?: boolean;
    weightedRandomCriteria?: string;
    winnerCount?: number;
    raffleDate: string;
}

export interface UpdateRaffleDto {
    name?: string;
    description?: string;
    imageUrl?: string;
    socialShareImageUrl?: string;
    animationType?: string;
    prizeType?: string;
    prizeDetails?: string;
    eligibilityRule?: string;
    clientSegmentFilter?: string;
    vipOnly?: boolean;
    blacklistExcluded?: boolean;
    preselectedWinnerIds?: string;
    minOrderTotal?: number;
    maxEntriesPerClient?: number;
    dateRangeStart?: string;
    dateRangeEnd?: string;
    requiredPurchases?: number;
    newClientsOnly?: boolean;
    frequentClientsOnly?: boolean;
    useWeightedRandom?: boolean;
    weightedRandomCriteria?: string;
    winnerCount?: number;
    raffleDate?: string;
    status?: string;
}

export interface RaffleDto {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    socialShareImageUrl?: string;
    animationType: string;
    prizeType?: string;
    prizeDetails?: string;
    eligibilityRule?: string;
    clientSegmentFilter?: string;
    vipOnly?: boolean;
    blacklistExcluded?: boolean;
    preselectedWinnerIds?: string;
    minOrderTotal?: number;
    maxEntriesPerClient?: number;
    dateRangeStart?: string;
    dateRangeEnd?: string;
    requiredPurchases: number;
    newClientsOnly: boolean;
    frequentClientsOnly: boolean;
    useWeightedRandom?: boolean;
    weightedRandomCriteria?: string;
    winnerCount: number;
    raffleDate: string;
    status: string;
    shuffleTandaTurns?: boolean;
    tandaId?: string;
    winnerId?: number;
    winner?: ClientDto;
    announcedAt?: string;
    createdAt: string;
    updatedAt: string;
    participantCount: number;
    entryCount: number;
}

export interface RaffleDetailDto extends RaffleDto {
    participants: RaffleParticipantDto[];
    entries: RaffleEntryDto[];
    draws: RaffleDrawDto[];
}

export interface RaffleParticipantDto {
    id: string;
    raffleId: string;
    clientId: number;
    client: ClientDto;
    qualificationDate: string;
    qualifyingOrders: number;
    isWinner: boolean;
    notified: boolean;
    notifiedAt?: string;
}

export interface RaffleEntryDto {
    id: string;
    raffleId: string;
    clientId: number;
    client: ClientDto;
    orderId: number;
    order: OrderSummaryDto;
    enteredAt: string;
}

export interface RaffleDrawDto {
    id: string;
    raffleId: string;
    drawDate: string;
    winnerId: number;
    winner: ClientDto;
    selectionMethod: string;
    notes?: string;
}

export interface SelectWinnerDto {
    selectionMethod: string;
    manualWinnerClientId?: number;
    notes?: string;
    count?: number;
}

export interface RaffleEvaluationResultDto {
    raffleId: string;
    totalQualified: number;
    qualifiedParticipants: RaffleParticipantDto[];
    newEntries: RaffleEntryDto[];
}

export interface RaffleSummaryDto {
    id: string;
    name: string;
    imageUrl?: string;
    raffleDate: string;
    status: string;
    animationType: string;
    participantCount: number;
    winnerCount: number;
    winnerId?: number;
    winnerName?: string;
    winnerNames?: string[];
    announcedAt?: string;
}

export interface TandaTurnAssignmentDto {
    clientId: number;
    clientName: string;
    previousTurn: number;
    newTurn: number;
}

export interface TandaShuffleResultDto {
    raffleId: string;
    tandaId: string;
    tandaName: string;
    participantsShuffled: number;
    turnAssignments: TandaTurnAssignmentDto[];
    shuffleDate: string;
}

