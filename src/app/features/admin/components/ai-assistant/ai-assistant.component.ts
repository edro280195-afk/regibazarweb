import { Component, OnInit, signal, computed, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { OrderSummary, Client } from '../../../../shared/models/models';

interface ChatMsg {
  id: number;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isThinking?: boolean;
}

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- FLOATING BUBBLE -->
    <div class="ai-bubble" [class.hidden]="isOpen()" (click)="toggleChat()">
      <span class="bubble-icon">✨</span>
      <span class="bubble-label">RegIA</span>
    </div>

    <!-- CHAT WINDOW -->
    <div class="ai-window" [class.open]="isOpen()">
      <div class="window-header">
        <div class="header-info">
          <span class="avatar-ai">🤖</span>
          <div>
            <h3>Gegi Assistant 🤖</h3>
            <span class="status">En línea 🟢</span>
          </div>
        </div>
        <button class="btn-close" (click)="toggleChat()">✕</button>
      </div>

      <div class="chat-body" #scrollContainer>
        @for (msg of messages(); track msg.id) {
          <div class="message" [class.user]="msg.sender === 'user'" [class.ai]="msg.sender === 'ai'">
            <div class="msg-bubble">
              @if (msg.isThinking) {
                <span class="thinking-dots">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              } @else {
                <span [innerHTML]="formatMessage(msg.text)"></span>
              }
            </div>
            <span class="msg-time">{{ msg.timestamp | date:'shortTime' }}</span>
          </div>
        }
      </div>

      <div class="chat-footer">
        <div class="suggestions">
          @for (s of dynamicSuggestions(); track s) {
            <button (click)="sendMessage(s)">{{ s }}</button>
          }
        </div>
        <div class="input-area">
          <input type="text" [(ngModel)]="userInput" (keydown.enter)="sendMessage()"
                 placeholder="Pregunta algo... ✨" [disabled]="isProcessing()">
          <button class="btn-send" (click)="sendMessage()" [disabled]="!userInput.trim() || isProcessing()">➤</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { position: fixed; bottom: 20px; right: 20px; z-index: 9000; font-family: 'Quicksand', sans-serif; }

    /* BUBBLE */
    .ai-bubble {
      width: 60px; height: 60px; background: linear-gradient(135deg, #ec4899, #db2777);
      border-radius: 50%; box-shadow: 0 5px 20px rgba(236, 72, 153, 0.4);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      border: 3px solid white;

      &:hover { transform: scale(1.1) rotate(-5deg); }
      &.hidden { transform: scale(0); opacity: 0; pointer-events: none; }
    }
    .bubble-icon { font-size: 1.8rem; }
    .bubble-label { font-size: 0.6rem; font-weight: 800; color: white; margin-top: -2px; }

    /* WINDOW */
    .ai-window {
      position: absolute; bottom: 80px; right: 0; width: 350px; height: 500px;
      background: white; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      display: flex; flex-direction: column; overflow: hidden;
      transform-origin: bottom right; transform: scale(0); opacity: 0; pointer-events: none;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      border: 1px solid rgba(236, 72, 153, 0.2);

      &.open { transform: scale(1); opacity: 1; pointer-events: auto; }
    }

    .window-header {
      background: linear-gradient(to right, #fdf2f8, white); padding: 1rem;
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid #fce7f3;
    }
    .header-info { display: flex; align-items: center; gap: 10px; }
    .avatar-ai { width: 36px; height: 36px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    h3 { margin: 0; font-size: 1rem; color: #db2777; font-weight: 800; }
    .status { font-size: 0.75rem; color: #10b981; font-weight: 600; }
    .btn-close { background: none; border: none; font-size: 1.2rem; color: #999; cursor: pointer; &:hover { color: #db2777; } }

    /* BODY */
    .chat-body { flex: 1; padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; background: #fffbff; }

    .message { display: flex; flex-direction: column; gap: 4px; max-width: 80%; }
    .message.user { align-self: flex-end; align-items: flex-end; }
    .message.ai { align-self: flex-start; align-items: flex-start; }

    .msg-bubble { padding: 10px 14px; border-radius: 16px; font-size: 0.9rem; line-height: 1.4; position: relative; }
    .user .msg-bubble { background: #db2777; color: white; border-bottom-right-radius: 4px; }
    .ai .msg-bubble { background: white; color: #444; border: 1px solid #fce7f3; border-bottom-left-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.03); }

    .msg-time { font-size: 0.65rem; color: #bbb; margin: 0 4px; }

    .thinking-dots span {
      animation: blink 1.4s infinite both;
      &:nth-child(2) { animation-delay: 0.2s; }
      &:nth-child(3) { animation-delay: 0.4s; }
    }
    @keyframes blink { 0% { opacity: 0.2; } 20% { opacity: 1; } 100% { opacity: 0.2; } }

    /* FOOTER */
    .chat-footer { padding: 10px; border-top: 1px solid #fce7f3; background: white; }

    .suggestions { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 4px; }
    .suggestions button {
      white-space: nowrap; background: #fdf2f8; border: 1px solid #fce7f3;
      padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; color: #db2777;
      cursor: pointer; transition: 0.2s; font-weight: 600;
      &:hover { background: #db2777; color: white; }
    }

    .input-area { display: flex; gap: 8px; }
    input {
      flex: 1; border: 1px solid #eee; padding: 10px 14px; border-radius: 24px;
      outline: none; transition: 0.2s; background: #fafafa;
      &:focus { border-color: #db2777; background: white; box-shadow: 0 0 0 3px rgba(219, 39, 119, 0.1); }
    }
    .btn-send {
      width: 40px; height: 40px; border-radius: 50%; border: none;
      background: #db2777; color: white; font-size: 1.1rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: 0.2s;
      &:hover:not(:disabled) { transform: scale(1.1); background: #be185d; }
      &:disabled { background: #eee; cursor: not-allowed; }
    }
  `]
})
export class AiAssistantComponent implements OnInit, AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  isOpen = signal(false);
  messages = signal<ChatMsg[]>([
    { id: 1, text: '¡Hola! Soy Gegi, tu asistente inteligente. 💅 Pregúntame sobre tus pedidos, clientas o ventas.', sender: 'ai', timestamp: new Date() }
  ]);
  userInput = '';
  isProcessing = signal(false);

  // Data Context
  orders: OrderSummary[] = [];
  clients: Client[] = [];
  dataLoaded = signal(false);

  // Dynamic suggestions based on context
  dynamicSuggestions = computed(() => {
    if (!this.dataLoaded()) {
      return ['📦 Pedidos hoy', '👑 Top Clienta', '💰 Ventas'];
    }
    const pending = this.orders.filter(o => o.status === 'Pending').length;
    const suggestions: string[] = [];
    if (pending > 0) suggestions.push(`📦 ${pending} pendientes`);
    suggestions.push('📊 Resumen del día');
    suggestions.push('👑 Mejor clienta');
    suggestions.push('🚨 Alertas');
    suggestions.push('🚗 Envíos vs Pickup');
    return suggestions.slice(0, 4);
  });

  constructor(private api: ApiService) { }

  ngOnInit() {
    // Load orders and clients for real context
    this.api.getOrders().subscribe(data => {
      this.orders = data;
      this.checkDataLoaded();
    });
    this.api.getClients().subscribe(data => {
      this.clients = data;
      this.checkDataLoaded();
    });
  }

  private checkDataLoaded() {
    if (this.orders.length >= 0 && this.clients.length >= 0) {
      this.dataLoaded.set(true);
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  toggleChat() {
    this.isOpen.update(v => !v);
  }

  scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }

  async sendMessage(text: string | null = null) {
    const msgText = text || this.userInput.trim();
    if (!msgText) return;

    this.addMessage(msgText, 'user');
    this.userInput = '';
    this.isProcessing.set(true);

    const thinkId = Date.now();
    this.messages.update(msgs => [...msgs, { id: thinkId, text: '', sender: 'ai', timestamp: new Date(), isThinking: true }]);

    setTimeout(() => {
      this.messages.update(msgs => msgs.filter(m => m.id !== thinkId));
      const response = this.generateResponse(msgText);
      this.addMessage(response, 'ai');
      this.isProcessing.set(false);
    }, 1200);
  }

  addMessage(text: string, sender: 'user' | 'ai') {
    this.messages.update(msgs => [
      ...msgs,
      { id: Date.now(), text, sender, timestamp: new Date() }
    ]);
  }

  formatMessage(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  // ═══════════════════════════════════════════
  //  🧠 GEGI AI LOGIC — Real Data 🧠
  // ═══════════════════════════════════════════
  generateResponse(query: string): string {
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // ── GREETINGS ──
    if (q.includes('hola') || q.includes('hello') || q.includes('buenos dias') || q.includes('buenas')) {
      return '¡Hola bonita! 💖 ¿En qué te ayudo hoy? Puedo buscar pedidos, analizar ventas o darte alertas. 💅';
    }

    // ── RESUMEN DEL DÍA ──
    if (q.includes('resumen') && (q.includes('dia') || q.includes('hoy'))) {
      return this.getDailySummary();
    }

    // ── VENTAS HOY / SEMANA / MES ──
    if (q.includes('ventas') || q.includes('dinero') || q.includes('ganancia') || q.includes('ingresos')) {
      return this.getSalesReport(q);
    }

    // ── PEDIDOS PENDIENTES ──
    if ((q.includes('pendiente') || q.includes('pendientes')) && !q.includes('buscar')) {
      return this.getPendingOrders();
    }

    // ── CUANTOS PEDIDOS ──
    if (q.includes('cuantos pedidos') || q.includes('total pedidos') || q.includes('conteo')) {
      return this.getOrderCounts();
    }

    // ── PEDIDOS HOY ──
    if (q.includes('pedidos') && q.includes('hoy')) {
      return this.getOrdersToday();
    }

    // ── PEDIDO DE [NOMBRE] ──
    const nameMatch = q.match(/pedido (?:de|para) (.+)/);
    if (nameMatch && nameMatch[1]) {
      return this.searchOrderByClient(nameMatch[1].trim());
    }

    // ── MEJOR CLIENTA ──
    if ((q.includes('clienta') || q.includes('cliente')) && (q.includes('top') || q.includes('mejor') || q.includes('estrella'))) {
      return this.getBestClient();
    }

    // ── ALERTAS ──
    if (q.includes('alerta') || q.includes('urgente') || q.includes('atencion')) {
      return this.getAlerts();
    }

    // ── ENVÍOS VS PICKUP ──
    if ((q.includes('envio') || q.includes('delivery')) && (q.includes('pickup') || q.includes('vs'))) {
      return this.getDeliveryVsPickup();
    }
    if (q.includes('envios vs') || q.includes('envio vs') || q.includes('delivery vs')) {
      return this.getDeliveryVsPickup();
    }

    // ── BUSCAR [TÉRMINO] ──
    const searchMatch = q.match(/buscar (.+)/);
    if (searchMatch && searchMatch[1]) {
      return this.searchAll(searchMatch[1].trim());
    }

    // ── LOCATIONS / ROUTES ──
    if (q.includes('ruta') || q.includes('ubicacion')) {
      const inRoute = this.orders.filter(o => o.status === 'InRoute').length;
      return `📍 Hay **${inRoute} pedidos en ruta** actualmente. Para ver detalles, revisa el *Route Manager* desde el menú. 🚗`;
    }

    // ── HELP ──
    if (q.includes('ayuda') || q.includes('puedes hacer') || q.includes('que sabes')) {
      return '¡Claro! Puedo ayudarte con: 💅\n' +
        '• **"resumen del día"** — Vista general del negocio\n' +
        '• **"ventas hoy/semana/mes"** — Reportes de ventas\n' +
        '• **"pedido de [nombre]"** — Buscar pedido por clienta\n' +
        '• **"mejor clienta"** — Tu clienta estrella\n' +
        '• **"pedidos pendientes"** — Los que faltan por enviar\n' +
        '• **"alertas"** — Pedidos pospuestos y urgentes\n' +
        '• **"envíos vs pickup"** — Comparativa\n' +
        '• **"buscar [término]"** — Buscar en todo';
    }

    // ── JOKES / FUN ──
    if (q.includes('chiste') || q.includes('broma') || q.includes('cuentame algo')) {
      return '¿Qué le dice una impresora a otra? ... ¿Esa hoja es tuya o es impresión mía? 😹 (Perdón, soy IA, no comediante 💅).';
    }

    // ── DEFAULT ──
    return '¡Ay! No entendí muy bien eso 😿. Intenta con "resumen del día", "ventas hoy", "pedido de [nombre]" o "alertas". ¡Estoy aprendiendo, reina! ✨';
  }

  // ═══════════════════════════════════════════
  //  Helper Methods — Real Calculations
  // ═══════════════════════════════════════════

  private getDailySummary(): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = this.orders.filter(o => new Date(o.createdAt) >= today);
    const todaySales = todayOrders.reduce((sum, o) => sum + o.total, 0);
    const pending = this.orders.filter(o => o.status === 'Pending').length;
    const delivered = this.orders.filter(o => o.status === 'Delivered').length;
    const inRoute = this.orders.filter(o => o.status === 'InRoute').length;
    const postponed = this.orders.filter(o => o.status === 'Postponed').length;

    return `📊 **Resumen del día** 💅\n` +
      `• Pedidos hoy: **${todayOrders.length}** ($${todaySales.toLocaleString()})\n` +
      `• Pendientes: **${pending}**\n` +
      `• En ruta: **${inRoute}**\n` +
      `• Entregados: **${delivered}**\n` +
      `• Pospuestos: **${postponed}**\n` +
      `• Clientas totales: **${this.clients.length}**\n` +
      `¡Vamos con todo hoy, reina! 👑`;
  }

  private getSalesReport(q: string): string {
    const now = new Date();

    if (q.includes('hoy')) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const filtered = this.orders.filter(o => new Date(o.createdAt) >= today);
      const total = filtered.reduce((sum, o) => sum + o.total, 0);
      return `💸 **Ventas de hoy**: **$${total.toLocaleString()}** (${filtered.length} pedidos). ${total > 0 ? '¡Nada mal, reina! 👑' : 'Aún no hay ventas hoy, ¡a darle! 💪'}`;
    }

    if (q.includes('semana')) {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      const filtered = this.orders.filter(o => new Date(o.createdAt) >= weekAgo);
      const total = filtered.reduce((sum, o) => sum + o.total, 0);
      return `💸 **Ventas de la semana**: **$${total.toLocaleString()}** (${filtered.length} pedidos). ¡Sigue así! ✨`;
    }

    if (q.includes('mes')) {
      const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);
      const filtered = this.orders.filter(o => new Date(o.createdAt) >= monthAgo);
      const total = filtered.reduce((sum, o) => sum + o.total, 0);
      return `💸 **Ventas del mes**: **$${total.toLocaleString()}** (${filtered.length} pedidos). ¡Eres una empresaria de verdad! 💎`;
    }

    // General total
    const total = this.orders.reduce((sum, o) => sum + o.total, 0);
    return `💸 **Ventas totales**: **$${total.toLocaleString()}** (${this.orders.length} pedidos). ¡Nada mal para ser la reina del negocio! 👑`;
  }

  private getPendingOrders(): string {
    const pending = this.orders.filter(o => o.status === 'Pending');
    const inRoute = this.orders.filter(o => o.status === 'InRoute');
    if (pending.length === 0 && inRoute.length === 0) {
      return '✅ ¡No hay pedidos pendientes ni en ruta! Todo está al corriente, reina. 💅';
    }
    let msg = `📦 **Pedidos activos:**\n`;
    msg += `• Pendientes: **${pending.length}**\n`;
    msg += `• En ruta: **${inRoute.length}**\n`;
    if (pending.length > 0) {
      const top3 = pending.slice(0, 3);
      msg += `\nÚltimos pendientes:\n`;
      top3.forEach(o => { msg += `• #${o.id} — ${o.clientName} ($${o.total})\n`; });
    }
    msg += `\n¡A darle con todo! 💪`;
    return msg;
  }

  private getOrderCounts(): string {
    const statusMap: Record<string, number> = {};
    this.orders.forEach(o => { statusMap[o.status] = (statusMap[o.status] || 0) + 1; });
    const labels: Record<string, string> = {
      'Pending': '📦 Pendientes', 'InRoute': '🚗 En Ruta', 'Delivered': '✅ Entregados',
      'NotDelivered': '❌ No Entregados', 'Canceled': '🚫 Cancelados', 'Postponed': '📅 Pospuestos'
    };
    let msg = `📊 **Conteo de pedidos** (${this.orders.length} total):\n`;
    Object.entries(statusMap).forEach(([status, count]) => {
      msg += `• ${labels[status] || status}: **${count}**\n`;
    });
    return msg + '💅';
  }

  private getOrdersToday(): string {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayOrders = this.orders.filter(o => new Date(o.createdAt) >= today);
    if (todayOrders.length === 0) {
      return '📦 No hay pedidos creados hoy aún. ¡El día apenas empieza! ✨';
    }
    const total = todayOrders.reduce((sum, o) => sum + o.total, 0);
    let msg = `📦 **${todayOrders.length} pedidos hoy** por un total de **$${total.toLocaleString()}**:\n`;
    todayOrders.slice(0, 5).forEach(o => {
      const st = o.status === 'Pending' ? '⏳' : o.status === 'Delivered' ? '✅' : '🚗';
      msg += `• ${st} #${o.id} — ${o.clientName} ($${o.total})\n`;
    });
    if (todayOrders.length > 5) msg += `... y ${todayOrders.length - 5} más`;
    return msg;
  }

  private searchOrderByClient(name: string): string {
    const found = this.orders.filter(o => o.clientName.toLowerCase().includes(name));
    if (found.length === 0) {
      // Try clients too
      const clientMatch = this.clients.find(c => c.name.toLowerCase().includes(name));
      if (clientMatch) {
        return `Encontré a la clienta **${clientMatch.name}** pero no tiene pedidos activos. 📋`;
      }
      return `Mmm, no encuentro nada para "${name}". ¿Escribiste bien el nombre? 🤔`;
    }
    if (found.length === 1) {
      const o = found[0];
      const statusLabels: Record<string, string> = {
        'Pending': 'pendiente ⏳', 'InRoute': 'en ruta 🚗', 'Delivered': 'entregado ✅',
        'NotDelivered': 'no entregado ❌', 'Canceled': 'cancelado 🚫', 'Postponed': 'pospuesto 📅'
      };
      let msg = `📦 Pedido **#${o.id}** de **${o.clientName}**:\n`;
      msg += `• Status: **${statusLabels[o.status] || o.status}**\n`;
      msg += `• Total: **$${o.total.toLocaleString()}**\n`;
      msg += `• Artículos: ${o.items.map(i => `${i.productName} (×${i.quantity})`).join(', ')}\n`;
      msg += `• Creado: ${new Date(o.createdAt).toLocaleDateString()}`;
      return msg;
    }
    let msg = `📦 Encontré **${found.length} pedidos** para "${name}":\n`;
    found.slice(0, 5).forEach(o => {
      const st = o.status === 'Pending' ? '⏳' : o.status === 'Delivered' ? '✅' : '🚗';
      msg += `• ${st} #${o.id} — $${o.total} (${o.status})\n`;
    });
    if (found.length > 5) msg += `... y ${found.length - 5} más`;
    return msg;
  }

  private getBestClient(): string {
    if (this.clients.length === 0) {
      return '👑 Aún no tengo datos de clientas. ¡Registra tus primeras ventas! ✨';
    }
    // Try using totalSpent or orderCount from Client model
    const sorted = [...this.clients].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
    const best = sorted[0];

    // Also calculate from orders
    const clientSales: Record<string, number> = {};
    this.orders.forEach(o => {
      clientSales[o.clientName] = (clientSales[o.clientName] || 0) + o.total;
    });
    const bestByOrders = Object.entries(clientSales).sort(([, a], [, b]) => b - a)[0];

    if (bestByOrders) {
      return `🏆 Tu clienta estrella es **${bestByOrders[0]}** con **$${bestByOrders[1].toLocaleString()}** en compras totales. ¡Deberías enviarle un regalito! 🎁`;
    }
    if (best) {
      return `🏆 Tu clienta con más gasto registrado es **${best.name}** ($${(best.totalSpent || 0).toLocaleString()}). 💎`;
    }
    return '👑 No tengo suficientes datos para determinar la mejor clienta. ✨';
  }

  private getAlerts(): string {
    const postponed = this.orders.filter(o => o.status === 'Postponed');
    const pending = this.orders.filter(o => o.status === 'Pending');
    const notDelivered = this.orders.filter(o => o.status === 'NotDelivered');

    if (postponed.length === 0 && notDelivered.length === 0 && pending.length < 5) {
      return '✅ ¡Todo tranquilo! No hay alertas urgentes, reina. 💅';
    }

    let msg = '🚨 **Alertas del día:**\n';
    if (postponed.length > 0) {
      msg += `\n📅 **${postponed.length} pedidos pospuestos:**\n`;
      postponed.slice(0, 3).forEach(o => {
        const note = o.postponedNote ? ` — "${o.postponedNote}"` : '';
        const date = o.postponedAt ? ` para ${new Date(o.postponedAt).toLocaleDateString()}` : '';
        msg += `• #${o.id} ${o.clientName}${date}${note}\n`;
      });
    }
    if (notDelivered.length > 0) {
      msg += `\n❌ **${notDelivered.length} no entregados** que necesitan reprogramar\n`;
    }
    if (pending.length >= 5) {
      msg += `\n⚠️ **${pending.length} pedidos pendientes** — ¡mucho en cola!\n`;
    }
    msg += '\n¡Atiende las alertas para mantener todo lindo! 💖';
    return msg;
  }

  private getDeliveryVsPickup(): string {
    const delivery = this.orders.filter(o => o.orderType === 'Delivery').length;
    const pickup = this.orders.filter(o => o.orderType === 'PickUp').length;
    const other = this.orders.length - delivery - pickup;
    const total = this.orders.length || 1;
    const delivPct = Math.round((delivery / total) * 100);
    const pickPct = Math.round((pickup / total) * 100);

    return `🚗 **Envíos vs Pickup:**\n` +
      `• 🚗 Delivery: **${delivery}** (${delivPct}%)\n` +
      `• 🏪 PickUp: **${pickup}** (${pickPct}%)\n` +
      (other > 0 ? `• Otros: **${other}**\n` : '') +
      `\n${delivery > pickup ? 'La mayoría prefiere delivery. ¡Tu servicio de envío es popular! 🎉' : 'PickUp es el favorito. ¡Genial para ahorrar en envíos! 💅'}`;
  }

  private searchAll(term: string): string {
    const matchedOrders = this.orders.filter(o =>
      o.clientName.toLowerCase().includes(term) ||
      o.id.toString().includes(term) ||
      o.items.some(i => i.productName.toLowerCase().includes(term))
    );
    const matchedClients = this.clients.filter(c =>
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term))
    );

    if (matchedOrders.length === 0 && matchedClients.length === 0) {
      return `🔍 No encontré resultados para "${term}". Intenta con otro término. 🤔`;
    }

    let msg = `🔍 **Resultados para "${term}":**\n`;
    if (matchedClients.length > 0) {
      msg += `\n👤 **Clientas (${matchedClients.length}):**\n`;
      matchedClients.slice(0, 3).forEach(c => {
        msg += `• ${c.name} — ${c.phone || 'Sin tel.'} (${c.orderCount} pedidos)\n`;
      });
    }
    if (matchedOrders.length > 0) {
      msg += `\n📦 **Pedidos (${matchedOrders.length}):**\n`;
      matchedOrders.slice(0, 3).forEach(o => {
        msg += `• #${o.id} — ${o.clientName} ($${o.total}) [${o.status}]\n`;
      });
    }
    return msg;
  }
}
