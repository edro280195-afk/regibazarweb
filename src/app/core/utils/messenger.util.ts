/**
 * Utilidades para construir enlaces directos de Messenger y los mensajes
 * personalizados que se le envían a la clienta junto con el enlace del pedido.
 *
 * Messenger NO permite pre-rellenar el texto del mensaje (a diferencia de
 * WhatsApp con wa.me?text=). Por eso el flujo es: copiar el mensaje al
 * portapapeles + abrir el chat directo con m.me/{usuario}, y la clienta pega.
 */

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Rutas internas de Facebook que NO son nombres de usuario válidos para m.me */
const RESERVED_HANDLES = ['profile.php', 'people', 'pages', 'groups', 'marketplace', 'watch', 'gaming', 'events'];

/**
 * Convierte cualquier referencia de Facebook (URL de perfil, link de m.me,
 * username suelto o ID numérico) en un enlace directo al chat de Messenger.
 *
 * Ejemplos:
 *   facebook.com/maria.lopez                 → https://m.me/maria.lopez
 *   facebook.com/profile.php?id=100012345    → https://m.me/100012345
 *   facebook.com/people/Maria-Lopez/100012/  → https://m.me/100012
 *   m.me/maria.lopez                         → https://m.me/maria.lopez
 *   maria.lopez                              → https://m.me/maria.lopez
 *   100012345                                → https://m.me/100012345
 *
 * Devuelve null si no se pudo interpretar (el llamador decide el fallback).
 */
export function buildMessengerLink(input?: string | null): string | null {
    if (!input) return null;
    const raw = input.trim();
    if (!raw) return null;

    // Ya es un link de m.me
    const mme = raw.match(/(?:https?:\/\/)?(?:www\.)?m\.me\/([^/?#\s]+)/i);
    if (mme) return `https://m.me/${mme[1]}`;

    // messenger.com/t/{usuario|id}
    const messenger = raw.match(/messenger\.com\/t\/([^/?#\s]+)/i);
    if (messenger) return `https://m.me/${messenger[1]}`;

    // profile.php?id=123 → ID numérico (m.me acepta IDs)
    const idParam = raw.match(/[?&]id=(\d+)/);
    if (idParam) return `https://m.me/${idParam[1]}`;

    // /people/Nombre/123456/ → ID numérico
    const people = raw.match(/\/people\/[^/]+\/(\d+)/i);
    if (people) return `https://m.me/${people[1]}`;

    // facebook.com/usuario o fb.com/usuario
    const fb = raw.match(/(?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook|fb)\.com\/([^/?#\s]+)/i);
    if (fb && !RESERVED_HANDLES.includes(fb[1].toLowerCase())) {
        return `https://m.me/${fb[1]}`;
    }

    // Solo un ID numérico
    if (/^\d+$/.test(raw)) return `https://m.me/${raw}`;

    // Solo un username (letras, números y puntos — formato válido de FB)
    if (/^[a-zA-Z0-9.]+$/.test(raw)) return `https://m.me/${raw}`;

    return null;
}

/** Formatea una fecha ISO como "sábado 30 de mayo" (zona local, igual que la vista del cliente). */
export function formatSpanishDate(isoDate?: string | null): string | null {
    if (!isoDate) return null;
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return null;
    return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export interface OrderMessageData {
    clientName: string;
    /** Enlace público ya transformado a /pedido/ */
    publicLink: string;
    /**
     * Fecha de entrega programada (ISO). Es el DOMINGO de reparto:
     * primer domingo tras el pedido para clientas Nuevas, segundo para Frecuentes.
     */
    scheduledDeliveryDate?: string | null;
    /**
     * Vencimiento del pedido (ISO) — el sistema lo fija en el LUNES siguiente a la
     * entrega. Solo se usa como respaldo para derivar la fecha de entrega si faltara.
     */
    expiresAt?: string | null;
}

/**
 * Arma el mensaje personalizado que se le envía a la clienta por Messenger.
 *
 * Reglas de fecha del negocio:
 *  - Entrega a domicilio: el DOMINGO programado (scheduledDeliveryDate).
 *  - Fecha límite para RECOGER: el SÁBADO, un día antes del reparto del domingo.
 */
export function buildOrderMessage(data: OrderMessageData): string {
    const nombre = (data.clientName || '').trim() || 'bonita';

    // Fecha de entrega (domingo): la programada, o si falta, derivada de expiresAt - 1 día
    let entregaIso = data.scheduledDeliveryDate || null;
    if (!entregaIso && data.expiresAt) {
        const d = new Date(data.expiresAt);
        d.setDate(d.getDate() - 1);
        entregaIso = d.toISOString();
    }

    // Fecha límite para recoger (sábado) = un día antes de la entrega (domingo)
    let limiteIso: string | null = null;
    if (entregaIso) {
        const d = new Date(entregaIso);
        d.setDate(d.getDate() - 1);
        limiteIso = d.toISOString();
    }

    const fechaEntrega = formatSpanishDate(entregaIso);
    const fechaLimite = formatSpanishDate(limiteIso);

    const lineas: string[] = [
        `Hola ${nombre}, aquí te dejo tu total de compras ✅🛍️`,
        data.publicLink,
        ''
    ];

    if (fechaEntrega) lineas.push(`Fecha de entrega es el ${fechaEntrega}.`);
    if (fechaLimite) lineas.push(`Fecha límite para pasar a recoger tu pedido: ${fechaLimite}.`);

    lineas.push('');
    lineas.push('Cualquier duda quedamos al pendiente. ❤️✨');

    return lineas.join('\n');
}
