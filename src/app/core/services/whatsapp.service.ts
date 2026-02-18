import { Injectable } from '@angular/core';
import { OrderSummary, DeliveryRoute } from '../../shared/models/models';

@Injectable({
    providedIn: 'root'
})
export class WhatsAppService {

    private baseUrl = 'https://wa.me/';

    constructor() { }

    /**
     * Generates a link to send a message to a client
     */
    sendOrderMessage(phone: string | undefined, message: string) {
        if (!phone) {
            console.warn('No phone number provided for WhatsApp');
            return;
        }
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const url = `${this.baseUrl}+52${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    }

    /**
     * Templates
     */

    sendOrderConfirmation(order: OrderSummary) {
        const msg = `¡Hola ${order.clientName}! 🌸\n\nTu pedido #${order.id} ha sido confirmado y está en proceso. 🛍️\n\nTotal: $${order.total}\n\nPuedes ver el estado de tu pedido aquí:\n${order.trackingUrl}\n\n¡Gracias por tu compra! ✨`;
        this.sendOrderMessage(order.clientPhone, msg);
    }

    sendOnTheWay(order: OrderSummary) {
        const msg = `¡Buenas noticias, ${order.clientName}! 🚗\n\nTu pedido va en camino. Nuestro repartidor llegará pronto.\n\nSigue tu entrega aquí:\n${order.trackingUrl}\n\n¡Nos vemos! 👋`;
        this.sendOrderMessage(order.clientPhone, msg);
    }

    sendPaymentReminder(order: OrderSummary) {
        const msg = `Hola ${order.clientName} 💕\n\nRecordatorio amable de tu pago pendiente para el pedido #${order.id}.\nTotal a pagar: $${order.amountDue || order.total}\n\nPor favor envía tu comprobante por este medio. ¡Gracias! 🙏`;
        this.sendOrderMessage(order.clientPhone, msg);
    }

    shareRouteWithDriver(driverPhone: string, route: DeliveryRoute) {
        const msg = `🚚 *Nueva Ruta Asignada*\n\nHola, tienes una nueva ruta con ${route.deliveries.length} entregas.\n\nAccede a tu ruta aquí:\n${route.driverLink}\n\n¡Con cuidado! 🛣️`;
        this.sendOrderMessage(driverPhone, msg);
    }
}
