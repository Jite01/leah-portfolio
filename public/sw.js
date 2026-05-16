const CACHE_NAME = 'leah-push-v1';

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'The Kickoff', {
      body: data.body || 'Join the Space now',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: {
        url: data.url || '/'
      },
      requireInteraction: true,
      tag: 'kickoff-live'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url === url || new URL(client.url).pathname === '/') {
          return client.navigate(url).then((c) => c.focus());
        }
      }
      // Otherwise open new window
      return clients.openWindow(url);
    })
  );
});
