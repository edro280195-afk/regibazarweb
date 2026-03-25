import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.isLoggedIn()) {
        const role = auth.userRole();
        const url = router.getCurrentNavigation()?.extractedUrl.toString() || window.location.pathname;

        // Security check for Driver
        if (role === 'Driver' && !url.startsWith('/admin/routes')) {
            return router.parseUrl('/admin/routes');
        }

        // Security check for Scaner
        if (role === 'Scaner' && !url.startsWith('/pos-mobile')) {
            return router.parseUrl('/pos-mobile/home');
        }

        return true;
    }

    return router.parseUrl('/login');
};
