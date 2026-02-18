import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { OrderSummary } from '../../../../shared/models/models';

@Component({
    selector: 'app-delivery-calendar',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="calendar-page fade-in">
      
      <!-- HEADER & CONTROLS -->
      <div class="page-header">
        <div>
          <h2>Calendario de Entregas 📅</h2>
          <p class="page-sub">Organiza tus envíos y evita el caos ✨</p>
        </div>
        
        <div class="month-controls">
          <button class="btn-nav" (click)="changeMonth(-1)">←</button>
          <span class="current-month">{{ currentMonthName() }} {{ currentYear() }}</span>
          <button class="btn-nav" (click)="changeMonth(1)">→</button>
        </div>

        <div class="view-toggles">
          <button class="btn-toggle active">Mes</button>
        </div>
      </div>

      <!-- CALENDAR GRID -->
      <div class="calendar-grid">
        <!-- Weekdays Header -->
        @for (day of weekDays; track day) {
          <div class="weekday-header">{{ day }}</div>
        }

        <!-- Empty cells for start of month -->
        @for (empty of emptyStartDays(); track $index) {
          <div class="day-cell empty"></div>
        }

        <!-- Days -->
        @for (date of daysInMonth(); track date) {
          <div class="day-cell" [class.today]="isToday(date)" [class.selected]="isSelected(date)" (click)="selectDate(date)">
            <div class="day-number">{{ date.getDate() }}</div>
            
            <!-- Order Dots -->
            <div class="order-dots">
              @for (order of getOrdersForDate(date); track order.id) {
                <div class="dot" 
                     [attr.data-status]="order.status"
                     [title]="order.clientName + ' (' + order.status + ')'">
                </div>
              }
            </div>
            
            <!-- Summary Pills (if space allows or hover) -->
            @if (getOrdersForDate(date).length > 0) {
              <div class="day-summary">
                <span class="count">{{ getOrdersForDate(date).length }} pedidos</span>
              </div>
            }
          </div>
        }
      </div>

       <!-- SELECTED DAY DETAILS MODAL -->
       @if (selectedDate()) {
        <div class="day-details-overlay" (click)="selectedDate.set(null)">
          <div class="day-details-panel" (click)="$event.stopPropagation()">
             <div class="panel-header">
               <h3>Pedidos para el {{ selectedDate() | date:'fullDate' }} 🌸</h3>
               <button class="btn-close" (click)="selectedDate.set(null)">✕</button>
             </div>
             
             <div class="orders-list">
               @for (order of selectedOrders(); track order.id) {
                 <div class="order-item" (click)="goToOrder(order.id); $event.stopPropagation()">
                   <div class="time-col">
                     @if (order.deliveryTime) {
                       <span class="time">{{ order.deliveryTime }}</span>
                     } @else {
                       <span class="time">{{ order.createdAt | date:'shortTime' }}</span>
                     }
                   </div>
                   <div class="info-col">
                     <h4>{{ order.clientName }}</h4>
                     <span class="address">{{ order.clientAddress || 'Sin dirección' }}</span>
                     <div class="tags">
                       <span class="status-pill" [attr.data-status]="order.status">{{ statusLabel(order.status) }}</span>
                       <span class="type-pill" [class.pickup]="order.orderType === 'PickUp'">
                         {{ order.orderType === 'PickUp' ? '🛍️ Recoge' : '🛵 Envío' }}
                       </span>
                     </div>
                   </div>
                   <div class="items-col">
                     <span>{{ order.items.length }} items</span>
                     <span class="total">$ {{ order.total | number:'1.0-0' }}</span>
                   </div>
                 </div>
               } @empty {
                 <div class="empty-day">
                   <p>No hay entregas programadas para este día 💤</p>
                   <p class="sub">¡Aprovecha para descansar!</p>
                 </div>
               }
             </div>
          </div>
        </div>
       }

    </div>
  `,
    styles: [`
    :host { display: block; padding: 2rem; max-width: 1400px; margin: 0 auto; }
    .fade-in { animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .page-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;
    }
    h2 { font-family: var(--font-display); font-size: 2.2rem; color: var(--pink-600); margin: 0; }
    .page-sub { color: #888; margin: 5px 0 0; font-weight: 600; }

    .month-controls {
      display: flex; align-items: center; gap: 1.5rem; background: white;
      padding: 0.5rem 1rem; border-radius: 20px; box-shadow: var(--shadow-sm);
    }
    .current-month { font-size: 1.2rem; font-weight: 800; color: var(--text-dark); text-transform: capitalize; min-width: 150px; text-align: center; }
    .btn-nav {
      background: var(--pink-50); border: none; color: var(--pink-600); width: 36px; height: 36px;
      border-radius: 50%; font-weight: 800; cursor: pointer; transition: 0.2s;
      &:hover { background: var(--pink-100); transform: scale(1.1); }
    }

    .view-toggles { display: flex; gap: 5px; background: #f0f0f0; padding: 4px; border-radius: 12px; }
    .btn-toggle {
      border: none; background: transparent; padding: 6px 12px; border-radius: 8px;
      font-weight: 700; color: #666; cursor: pointer; font-size: 0.9rem;
      &.active { background: white; color: var(--pink-600); box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
    }

    /* CALENDAR GRID */
    .calendar-grid {
      display: grid; grid-template-columns: repeat(7, 1fr);
      background: white; border-radius: 24px; overflow: hidden;
      box-shadow: var(--shadow-sm); border: 1px solid var(--border-soft);
    }
    
    .weekday-header {
      padding: 1rem; text-align: center; font-weight: 800; color: #999;
      background: #fafafa; border-bottom: 1px solid #eee; text-transform: uppercase; font-size: 0.8rem;
    }

    .day-cell {
      min-height: 120px; border-right: 1px solid #f0f0f0; border-bottom: 1px solid #f0f0f0;
      padding: 10px; position: relative; cursor: pointer; transition: 0.2s;
      display: flex; flex-direction: column; gap: 5px;
      &:hover { background: #fdf4ff; }
      &.empty { background: #fafafa; pointer-events: none; }
      &.today { background: #fffbe6; .day-number { background: var(--pink-500); color: white; } }
      &.selected { background: var(--pink-50); box-shadow: inset 0 0 0 2px var(--pink-300); }
    }
    .day-cell:nth-child(7n) { border-right: none; }

    .day-number {
      width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.9rem; color: var(--text-dark);
    }

    .order-dots { display: flex; flex-wrap: wrap; gap: 4px; padding-left: 5px; }
    .dot {
      width: 8px; height: 8px; border-radius: 50%; background: #ccc;
      &[data-status="Pending"] { background: #fbbf24; }
      &[data-status="InRoute"] { background: #60a5fa; }
      &[data-status="Delivered"] { background: #4ade80; }
      &[data-status="Postponed"] { background: #c084fc; }
      &[data-status="Canceled"] { background: #f87171; }
    }

    .day-summary {
      font-size: 0.75rem; color: var(--pink-600); font-weight: 700;
      background: rgba(255,255,255,0.5); padding: 2px 6px; border-radius: 4px; align-self: flex-start;
      margin-top: auto;
    }

    /* DETAILS PANEL - MODAL STYLE */
    .day-details-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000;
        display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);
        animation: fadeIn 0.2s ease-out;
    }
    
    .day-details-panel {
      background: white; border-radius: 20px; padding: 1.5rem;
      width: 95%; max-width: 500px; max-height: 80vh; overflow-y: auto;
      box-shadow: 0 20px 50px rgba(0,0,0,0.3); border: none;
      animation: slideUp 0.3s ease-out;
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

    .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; position: sticky; top: 0; background: white; z-index: 10; padding-bottom: 10px; border-bottom: 1px solid #f0f0f0; }
    .panel-header h3 { margin: 0; font-family: var(--font-display); color: var(--text-dark); font-size: 1.5rem; }
    .btn-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #ccc; &:hover { color: var(--pink-500); } }

    .orders-list { display: flex; flex-direction: column; gap: 1rem; }
    .order-item {
      display: flex; align-items: center; gap: 1rem; padding: 1rem;
      border: 1px solid var(--border-soft); border-radius: 16px;
      transition: all 0.2s; cursor: pointer;
      &:hover { transform: translateX(5px); border-color: var(--pink-200); background: #fffbff; }
    }
    
    .time-col { font-weight: 700; color: #999; font-size: 0.9rem; min-width: 60px; }
    .info-col { flex: 1; }
    .info-col h4 { margin: 0 0 5px; color: var(--text-dark); }
    .address { display: block; font-size: 0.85rem; color: #666; margin-bottom: 8px; }
    .tags { display: flex; gap: 8px; }
    
    .status-pill { font-size: 0.7rem; padding: 4px 10px; border-radius: 10px; background: #eee; font-weight: 700; }
    .status-pill[data-status="Pending"] { background: #fffbeb; color: #d97706; }
    .status-pill[data-status="InRoute"] { background: #eff6ff; color: #2563eb; }
    .status-pill[data-status="Delivered"] { background: #f0fdf4; color: #16a34a; }
    .status-pill[data-status="Postponed"] { background: #faf5ff; color: #9333ea; }

    .type-pill { font-size: 0.7rem; padding: 4px 10px; border-radius: 10px; background: #e0f2fe; color: #0284c7; font-weight: 700; }
    .type-pill.pickup { background: #f3e8ff; color: #9333ea; }

    .items-col { text-align: right; display: flex; flex-direction: column; font-size: 0.9rem; font-weight: 600; color: #666; }
    .items-col .total { color: var(--pink-600); font-weight: 800; font-size: 1.1rem; }

    .empty-day { text-align: center; padding: 2rem; color: #ccc; }
    .empty-day p { margin: 5px 0; font-size: 1.1rem; }
    .empty-day .sub { font-size: 0.9rem; color: #ddd; }
  `]
})
export class DeliveryCalendarComponent implements OnInit {
    orders = signal<OrderSummary[]>([]);
    currentDate = signal(new Date());
    selectedDate = signal<Date | null>(null);

    weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    // Computeds for Calendar Logic
    currentYear = computed(() => this.currentDate().getFullYear());
    currentMonthName = computed(() => {
        return this.currentDate().toLocaleString('es-MX', { month: 'long' });
    });

    daysInMonth = computed(() => {
        const year = this.currentDate().getFullYear();
        const month = this.currentDate().getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
    });

    emptyStartDays = computed(() => {
        const year = this.currentDate().getFullYear();
        const month = this.currentDate().getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        return Array(firstDay).fill(0);
    });

    selectedOrders = computed(() => {
        const date = this.selectedDate();
        if (!date) return [];
        return this.getOrdersForDate(date);
    });

    constructor(private api: ApiService, private router: Router) { }

    ngOnInit() {
        this.loadOrders();
    }

    loadOrders() {
        this.api.getOrders().subscribe(data => {
            this.orders.set(data);
        });
    }

    changeMonth(delta: number) {
        const current = this.currentDate();
        this.currentDate.set(new Date(current.getFullYear(), current.getMonth() + delta, 1));
        this.selectedDate.set(null);
    }

    selectDate(date: Date) {
        this.selectedDate.set(date);
    }

    isToday(date: Date): boolean {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    }

    isSelected(date: Date): boolean {
        const sel = this.selectedDate();
        return !!sel && sel.getTime() === date.getTime();
    }

    getOrdersForDate(date: Date): OrderSummary[] {
        const orders = this.orders();

        return orders.filter(o => {
            let targetDate: Date;

            if (o.status === 'Postponed' && o.postponedAt) {
                targetDate = new Date(o.postponedAt);
            }
            else if (o.orderType === 'PickUp') {
                targetDate = new Date(o.createdAt);
            }
            else {
                const created = o.createdAt;
                const cType = (o.clientType || 'Nueva');
                targetDate = this.calculateDeliveryDate(created, cType);
            }

            return targetDate.getDate() === date.getDate() &&
                targetDate.getMonth() === date.getMonth() &&
                targetDate.getFullYear() === date.getFullYear();
        });
    }

    private calculateDeliveryDate(createdStr: string, clientType: string): Date {
        const created = new Date(createdStr);
        const delivery = new Date(created);

        const dayOfWeek = created.getDay();

        let daysUntilNextSunday = (7 - dayOfWeek);
        if (dayOfWeek === 0) daysUntilNextSunday = 7;

        let totalDaysToAdd = daysUntilNextSunday;

        if (clientType && clientType.trim() === 'Frecuente') {
            totalDaysToAdd += 7;
        }

        delivery.setDate(created.getDate() + totalDaysToAdd);
        return delivery;
    }

    goToOrder(id: number): void {
        this.router.navigate(['/admin/orders', id]);
    }

    statusLabel(s: string): string {
        const map: Record<string, string> = {
            'Pending': 'Pendiente', 'InRoute': 'En Ruta', 'Delivered': 'Entregado', 'Canceled': 'Cancelado', 'Postponed': 'Pospuesto'
        };
        return map[s] || s;
    }
}
