import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

/** Rutas/endpoints que no deben disparar logout en 401 */
const PUBLIC_ROUTE_PATTERNS = [
    '/pedido/',
    '/driver/',
    '/api/clientorder/',
    '/api/driverroute/',
    '/api/push/',
];

function isPublicRoute(url: string): boolean {
    const lower = url.toLowerCase();
    return PUBLIC_ROUTE_PATTERNS.some(pattern => lower.includes(pattern));
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    const toast = inject(ToastService);
    const router = inject(Router);

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {

            switch (error.status) {
                case 0:
                    toast.error('⚠️ Sin conexión. Verifica tu internet e intenta de nuevo.');
                    break;

                case 401:
                    if (!isPublicRoute(req.url)) {
                        toast.warning('🔒 Tu sesión ha expirado. Inicia sesión de nuevo.');
                        auth.logout();
                    }
                    break;

                case 403:
                    toast.error('🚫 No tienes permisos para realizar esta acción.');
                    break;

                case 404:
                    if (req.method !== 'GET') {
                        toast.warning('🔍 El recurso solicitado no fue encontrado.');
                    }
                    break;

                case 408:
                    toast.error('⏰ Tiempo de espera agotado. Intenta de nuevo.');
                    break;

                case 409:
                    toast.warning('⚡ Conflicto: el recurso ya fue modificado por otra persona.');
                    break;

                case 422:
                    const validationMsg = error.error?.message || error.error?.title || 'Datos inválidos.';
                    toast.warning(`📝 ${validationMsg}`);
                    break;

                case 429:
                    toast.warning('🐢 Demasiadas solicitudes. Espera un momento.');
                    break;

                default:
                    if (error.status >= 500) {
                        toast.error('💥 Error en el servidor. Nuestro equipo fue notificado.');
                    }
                    break;
            }

            return throwError(() => error);
        })
    );
};