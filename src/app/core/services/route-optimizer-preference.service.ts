import { Injectable, PLATFORM_ID, afterNextRender, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class RouteOptimizerPreferenceService {
    private readonly platformId = inject(PLATFORM_ID);
    private readonly storageKey = 'regibazar.routeOptimizer.useRoadNetwork';
    readonly useRoadOptimizer = signal(true);

    constructor() {
        // Se restaura después del primer render para mantener la hidratación SSR estable.
        afterNextRender(() => {
            if (!isPlatformBrowser(this.platformId)) return;

            try {
                const storedPreference = window.localStorage.getItem(this.storageKey);
                if (storedPreference === 'true') this.useRoadOptimizer.set(true);
                if (storedPreference === 'false') this.useRoadOptimizer.set(false);
            } catch {
                // El selector sigue funcionando durante la sesión si el navegador bloquea el almacenamiento.
            }
        });
    }

    setUseRoadOptimizer(enabled: boolean): void {
        this.useRoadOptimizer.set(enabled);

        if (!isPlatformBrowser(this.platformId)) return;

        try {
            window.localStorage.setItem(this.storageKey, String(enabled));
        } catch {
            // No se bloquea el cambio del selector si el navegador bloquea el almacenamiento.
        }
    }
}
