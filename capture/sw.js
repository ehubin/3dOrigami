// Offline support. Uses the network when it can, so updates appear straight
// away, and falls back to the saved copy when offline. A file that can't be
// cached is skipped, because the app still works online without it.

const CACHE = 'capture-v1';
const FILES = [
    './', 'index.html', 'style.css', 'ui.js', 'geometry.js', 'session.js', 'preview.js',
    'detect.js', 'photo.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => Promise.allSettled(FILES.map(f => c.add(f))))
            .catch(err => console.warn('Offline copy not saved', err))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
                }
                return res;
            })
            .catch(() => caches.match(e.request, { ignoreSearch: true })),
    );
});
