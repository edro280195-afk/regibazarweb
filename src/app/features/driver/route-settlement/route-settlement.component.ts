import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { RouteSettlementDto, calculateCashTotalMxn, calculateCashTotalUsd, calculateCashTotalInMxn } from '../../../core/models';

@Component({
    selector: 'app-route-settlement',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './route-settlement.component.html',
    styleUrl: './route-settlement.component.css'
})
export class RouteSettlementComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private api = inject(ApiService);

    loading = signal(true);
    error = signal<string | null>(null);
    settlement = signal<RouteSettlementDto | null>(null);
    copiedToast = signal(false);

    ngOnInit(): void {
        const token = this.route.snapshot.paramMap.get('token');
        if (!token) {
            this.error.set('Token de ruta no proporcionado.');
            this.loading.set(false);
            return;
        }

        this.loadSettlement(token);
    }

    loadSettlement(token: string): void {
        this.loading.set(true);
        this.error.set(null);
        this.api.getRouteSettlement(token).subscribe({
            next: (data) => {
                this.settlement.set(data);
                this.loading.set(false);
            },
            error: (err) => {
                this.error.set('No se pudo cargar el corte de ruta. Verifica que la ruta exista.');
                this.loading.set(false);
            }
        });
    }

    shareWhatsApp(): void {
        const s = this.settlement();
        if (!s || !s.whatsAppShareText) return;

        const text = encodeURIComponent(s.whatsAppShareText);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    }

    copyToClipboard(): void {
        const s = this.settlement();
        if (!s || !s.whatsAppShareText) return;

        navigator.clipboard.writeText(s.whatsAppShareText).then(() => {
            this.copiedToast.set(true);
            setTimeout(() => this.copiedToast.set(false), 2500);
        });
    }

    formatMoney(val?: number | null): string {
        if (val == null) return '$0.00';
        return `$${val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}
