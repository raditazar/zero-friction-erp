/* Zero Friction ERP service worker: Web Push only (no offline caching). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Transaksi baru", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Transaksi baru di Kotak Masuk";
  const options = {
    body: data.body || "",
    tag: data.tag || "inbox",
    icon: "/logo_square.png",
    badge: "/logo_square.png",
    data: { url: data.url || "/inbox" },
  };

  const tasks = [self.registration.showNotification(title, options)];
  if (typeof data.pending_count === "number" && self.navigator && "setAppBadge" in self.navigator) {
    tasks.push(self.navigator.setAppBadge(data.pending_count).catch(() => undefined));
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/inbox", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              /* navigate can reject on some browsers; focus is enough */
            }
          }
          return;
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
