import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    const toast = inject(ToastService);

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            if ([401, 403].includes(error.status)) {
                // Token expired or invalid
                auth.logout();
                toast.show('Sesión expirada. Por favor ingresa de nuevo. 🎀', 'error');
            }

            const errorMessage = error.error?.message || error.statusText || 'Error en el servidor';
            return throwError(() => error);
        })
    );
};
