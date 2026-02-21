import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    const toast = inject(ToastService);
    const router = inject(Router);

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            // Don't auto-logout on public routes (client order view, driver view)
            const isPublicRoute = req.url.includes('/pedido/') || req.url.includes('/driver/');

            switch (error.status) {
                case 0:
                    // Network error or CORS issue
                    toast.error('⚠️ Sin conexión. Verifica tu internet e intenta de nuevo.');
                    break;

                case 401:
                    if (!isPublicRoute) {
                        toast.warning('🔒 Tu sesión ha expirado. Inicia sesión de nuevo.');
                        auth.logout();
                    }
                    break;

                case 403:
                    toast.error('🚫 No tienes permisos para realizar esta acción.');
                    break;

                case 404:
                    // Only show toast for non-GET requests (GET 404s are often expected)
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
                    // Validation error — show server message if available
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

            // Always re-throw so component-level handlers can still react
            return throwError(() => error);
        })
    );
};
