import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.isLoggedIn()) {
        const role = auth.userRole();
        const url = state.url;

        // Security check for Driver
        if (role === 'Driver' && !url.startsWith('/admin/routes')) {
            return router.parseUrl('/admin/routes');
        }

        // Security check for Scaner
        if (role === 'Scaner' && !url.startsWith('/pos-mobile')) {
            return router.parseUrl('/pos-mobile/home');
        }

        // Bodega sólo puede abrir el módulo de cajas e inventario.
        if (role === 'Bodega' && !url.startsWith('/admin/inventory')) {
            return router.parseUrl('/admin/inventory');
        }

        return true;
    }

    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
