// 도토리 서비스 워커 — 웹 푸시 수신/표시
// public/ 폴더는 expo export 시 dist/로 그대로 복사됨

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* 무시 */ }

  const title = data.title || '🌰 도토리';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // 이미 열린 창이 있으면 포커스, 없으면 새로 열기
      for (const win of wins) {
        if ('focus' in win) return win.focus();
      }
      return clients.openWindow(url);
    })
  );
});
