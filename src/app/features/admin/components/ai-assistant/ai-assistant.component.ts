import { Component, OnInit, signal, computed, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { OrderSummary, Client } from '../../../../shared/models/models';

interface ChatMessage {
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
        <div class="suggestions" *ngIf="messages().length < 2">
          <button (click)="sendMessage('¿Cuántos pedidos hay hoy?')">📦 Pedidos hoy</button>
          <button (click)="sendMessage('¿Quién es mi mejor clienta?')">👑 Top Clienta</button>
          <button (click)="sendMessage('Resumen de ventas')">💰 Ventas</button>
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
  messages = signal<ChatMessage[]>([
    { id: 1, text: '¡Hola! Soy tu asistente inteligente. 💅 Pregúntame sobre tus pedidos o clientes.', sender: 'ai', timestamp: new Date() }
  ]);
  userInput = '';
  isProcessing = signal(false);

  // Data Context (Simple cache)
  orders: OrderSummary[] = [];

  constructor(private api: ApiService) { }

  ngOnInit() {
    // Load context quietly
    this.api.getOrders().subscribe(data => this.orders = data);
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

    // User Msg
    this.addMessage(msgText, 'user');
    this.userInput = '';
    this.isProcessing.set(true);

    // AI Thinking Mock
    const thinkId = Date.now();
    this.messages.update(msgs => [...msgs, { id: thinkId, text: '', sender: 'ai', timestamp: new Date(), isThinking: true }]);

    // Simulate Network/Processing Delay
    setTimeout(() => {
      // Remove thinking bubble
      this.messages.update(msgs => msgs.filter(m => m.id !== thinkId));

      // Generate Response
      const response = this.generateResponse(msgText);
      this.addMessage(response, 'ai');
      this.isProcessing.set(false);
    }, 1500);
  }

  addMessage(text: string, sender: 'user' | 'ai') {
    this.messages.update(msgs => [
      ...msgs,
      { id: Date.now(), text, sender, timestamp: new Date() }
    ]);
  }

  formatMessage(text: string): string {
    // Basic markdown-like parser (bold)
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  // 🧠 MOCK AI LOGIC 🧠
  generateResponse(query: string): string {
    const q = query.toLowerCase();

    // GREETINGS
    if (q.includes('hola') || q.includes('hello') || q.includes('buenos dias')) {
      return '¡Hola bonita! 💖 ¿En qué te ayudo hoy? Puedo buscar pedidos, clientas o revisar tus ventas.';
    }

    // STATS & SALES
    if (q.includes('ventas') || q.includes('dinero') || q.includes('ganancia')) {
      const total = this.orders.reduce((sum, o) => sum + o.total, 0);
      return `💸 Tienes unas ventas totales de **$ ${total.toLocaleString()}**. ¡Nada mal para ser la reina del negocio! 👑`;
    }

    if (q.includes('pedidos') && (q.includes('hoy') || q.includes('pendiente'))) {
      const pending = this.orders.filter(o => o.status === 'Pending').length;
      const inRoute = this.orders.filter(o => o.status === 'InRoute').length;
      return `📦 Tienes **${pending} pedidos pendientes** y **${inRoute} en ruta**. ¡A darle con todo! 💪`;
    }

    // ORDER SEARCH (Simple ID or Name)
    // Matches "pedido de juan", "pedido #123", "donde esta el pedido de ana"
    const nameMatch = q.match(/pedido (?:de|para) (\w+)/);
    if (nameMatch && nameMatch[1]) {
      const name = nameMatch[1];
      const found = this.orders.find(o => o.clientName.toLowerCase().includes(name));
      if (found) {
        const status = found.status === 'Pending' ? 'pendiente' : found.status === 'InRoute' ? 'en camino' : 'entregado';
        return `El pedido de **${found.clientName}** está **${status}**. El total es de $${found.total}. ¿Quieres ver detalles? ✨`;
      } else {
        return `Mmm, no encuentro ningún pedido para "${name}". ¿Escribiste bien el nombre? 🤔`;
      }
    }

    // LOCATIONS / ROUTES
    if (q.includes('ruta') || q.includes('donde estas') || q.includes('ubicacion')) {
      // Mock retrieving active route info
      return '📍 Tienes **1 ruta activa** con el repartidor **Juan Pérez**. Ha completado 3 de 10 entregas. Puedes verlo en el mapa del *Route Manager*. 🚗';
    }

    // CLIENTS
    if (q.includes('clienta') && (q.includes('top') || q.includes('mejor'))) {
      // Mock "Best Client"
      const best = this.orders.reduce((prev, current) => (prev.total > current.total) ? prev : current, this.orders[0]); // Simple max
      return `🏆 Tu clienta estrella de hoy es **${best?.clientName}** con una compra de **$${best?.total}**. ¡Deberías enviarle un regalito! 🎁`;
    }

    // JOKES / FUN
    if (q.includes('chiste') || q.includes('broma') || q.includes('cuentame algo')) {
      return '¿Qué le dice una impresora a otra? ... ¿Esa hoja es tuya o es impresión mía? 😹 (Perdón, soy una IA, no comediante).';
    }

    // HELP / DEFAULT
    if (q.includes('ayuda') || q.includes('puedes hacer')) {
      return 'Puedo ayudarte a: \n- Consultar **ventas** 💰\n- Buscar **pedidos por nombre** 📦\n- Ver el estado de **rutas** 🚗\n- Identificar a tus **mejores clientas** 👑';
    }

    return '¡Ay! No entendí muy bien eso 😿. Intenta preguntarme por "ventas", "pedidos de..." o "rutas". Estoy aprendiendo rápido ✨.';
  }
}
