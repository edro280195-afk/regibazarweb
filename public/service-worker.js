// Service worker for Regi Bazar PWA ✨

self.addEventListener('install', (event) => {
    console.log('SW Installed ✨');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('SW Activated ✨');
});

// Basic fetch handler required for PWA installability
self.addEventListener('fetch', (event) => {
    // We can implement caching strategies here later
    // For now, it just passes through ensuring the 'offline' requirement is technically met
    event.respondWith(fetch(event.request).catch(() => {
        return new Response('Red no disponible. Regi Bazar funciona mejor con conexión! ✨🎀');
    }));
});

self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/pwa-icon.png',
            badge: '/favicon.ico',
            data: {
                url: data.url || '/'
            }
        };
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
