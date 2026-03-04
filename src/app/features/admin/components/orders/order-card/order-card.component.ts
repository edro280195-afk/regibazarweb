import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate, keyframes } from '@angular/animations';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { OrderSummary, OrderItem } from '../../../../../shared/models/models';

@Component({
    selector: 'app-order-card',
    standalone: true,
    imports: [CommonModule, DragDropModule],
    templateUrl: './order-card.component.html',
    styleUrl: './order-card.component.scss',
    animations: [
        trigger('expandCollapse', [
            transition(':enter', [
                style({ height: '0', opacity: 0, overflow: 'hidden' }),
                animate('300ms ease-out', style({ height: '*', opacity: 1 }))
            ]),
            transition(':leave', [
                style({ height: '*', opacity: 1, overflow: 'hidden' }),
                animate('200ms ease-in', style({ height: '0', opacity: 0 }))
            ])
        ]),
        trigger('statusPop', [
            transition('* => *', [
                animate('400ms cubic-bezier(0.175, 0.885, 0.32, 1.275)', keyframes([
                    style({ transform: 'scale(1)', offset: 0 }),
                    style({ transform: 'scale(1.05)', offset: 0.5 }),
                    style({ transform: 'scale(1)', offset: 1 })
                ]))
            ])
        ])
    ]
})
export class OrderCardComponent {
    // ── Inputs ──
    @Input({ required: true }) order!: OrderSummary;
    @Input() viewMode: 'list' | 'kanban' = 'list';
    @Input() isSelected = false;
    @Input() selectionMode = false;

    // ── Outputs ──
    @Output() edit = new EventEmitter<OrderSummary>();
    @Output() delete = new EventEmitter<OrderSummary>();
    @Output() pay = new EventEmitter<OrderSummary>();
    @Output() copyLink = new EventEmitter<string>();
    @Output() toggleSelect = new EventEmitter<OrderSummary>();
    @Output() goToDetail = new EventEmitter<number>();
    @Output() addItem = new EventEmitter<OrderSummary>();
    @Output() editItem = new EventEmitter<{ order: OrderSummary; item: OrderItem }>();
    @Output() deleteItem = new EventEmitter<{ order: OrderSummary; item: OrderItem }>();
    @Output() moveToStatus = new EventEmitter<{ order: OrderSummary; newStatus: string }>();

    showMoveMenu = false;
    itemsExpanded = false;

    /** Available statuses for the quick-move menu (excludes current) */
    get moveOptions(): { key: string; label: string }[] {
        const isArchived = ['Canceled', 'Postponed', 'NotDelivered'].includes(this.order.status);
        const all = isArchived
            ? [
                { key: 'Pending', label: '⏳ Pendiente' },
                { key: 'Confirmed', label: '✅ Confirmado' },
                { key: 'InRoute', label: '🚗 En Ruta' },
                { key: 'Delivered', label: '💝 Entregado' }
              ]
            : [
                { key: 'Pending', label: '⏳ Pendiente' },
                { key: 'Confirmed', label: '✅ Confirmado' },
                { key: 'InRoute', label: '🚗 En Ruta' },
                { key: 'Delivered', label: '💝 Entregado' },
                { key: 'Postponed', label: '📅 Posponer' },
                { key: 'Canceled', label: '❌ Cancelar' }
              ];
        return all.filter(o => o.key !== this.order.status);
    }

    statusLabel(s: string): string {
        const labels: Record<string, string> = {
            Pending: '⏳ Pendiente',
            Confirmed: '✅ Confirmado',
            InRoute: '🚗 En ruta',
            Delivered: '💝 Entregado',
            NotDelivered: '😿 Fallido',
            Canceled: '🚫 Cancelado',
            Postponed: '📅 Pospuesto'
        };
        return labels[s] || s;
    }
}
