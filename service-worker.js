const CACHE_VERSION = 'pdf-tools-v1';
const APP_SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './js/PdfApp.js',
  './js/modules/pdf-file.js',
  './js/modules/file-name-display.js',
  './js/modules/pdf-preview.js',
  './js/modules/pdf-operations.js',
  './js/modules/pdf-render.js',
  './js/modules/pdf-text.js',
  './js/modules/pdf-download.js',
  './js/vendor/fontkit.umd.min.js',
  './js/modules/annotation-store.js',
  './js/modules/annotation-geometry.js',
  './js/modules/annotation-fonts.js',
  './js/modules/annotation-export.js',
  './js/modules/annotation-editor.js',
  './js/modules/tool-tabs.js',
  './js/modules/output-summary.js',
  './js/modules/workspace-view.js',
  './js/modules/toast.js',
  './js/modules/live-preview.js',
  './fonts/BaiJamjuree-Regular.ttf',
  './fonts/ChakraPetch-Regular.ttf',
  './fonts/Itim-Regular.ttf',
  './fonts/Kanit-Regular.ttf',
  './fonts/Mali-Regular.ttf',
  './fonts/Mitr-Regular.ttf',
  './fonts/NotoSansThai-Regular.ttf',
  './fonts/Pridi-Regular.ttf',
  './fonts/Prompt-Regular.ttf',
  './fonts/Sarabun-Regular.ttf',
  './fonts/Sriracha-Regular.ttf',
  './fonts/Taviraj-Regular.ttf',
  './image/icon-16.png',
  './image/icon-32.png',
  './image/icon-48.png',
  './image/icon-128.png',
  './image/icon-192.png',
  './image/icon-512.png'
];

function IsSameOriginGetRequest(request) {
  const request_url = new URL(request.url);
  return (
    request.method === 'GET' && request_url.origin === self.location.origin
  );
}

async function CacheAppShell() {
  const cache = await caches.open(CACHE_VERSION);
  await cache.addAll(APP_SHELL_URLS);
}

async function ClearOldCaches() {
  const cache_names = await caches.keys();
  const delete_tasks = cache_names
    .filter(cache_name => cache_name !== CACHE_VERSION)
    .map(cache_name => caches.delete(cache_name));
  await Promise.all(delete_tasks);
}

const APP_SHELL_NAVIGATION_PATHNAMES = [
  new URL('./', self.location.href).pathname,
  new URL('./index.html', self.location.href).pathname
];

function IsAppShellNavigation(request) {
  return APP_SHELL_NAVIGATION_PATHNAMES.includes(new URL(request.url).pathname);
}

async function HandleNavigationRequest(request) {
  let network_response;
  try {
    network_response = await fetch(request.url, {
      cache: 'no-cache',
      credentials: 'same-origin',
      redirect: 'manual'
    });
  } catch (error) {
    const cached_response = await caches.match('./index.html');
    if (cached_response) {
      return cached_response;
    }
    throw error;
  }
  if (network_response.ok && IsAppShellNavigation(request)) {
    const cache = await caches.open(CACHE_VERSION);
    await cache.put('./index.html', network_response.clone());
  }
  return network_response;
}

const IMMUTABLE_ASSET_PATH_SEGMENTS = ['/fonts/', '/image/', '/js/vendor/'];

function IsImmutableAssetRequest(request) {
  const request_pathname = new URL(request.url).pathname;
  return IMMUTABLE_ASSET_PATH_SEGMENTS.some(path_segment =>
    request_pathname.includes(path_segment)
  );
}

async function HandleImmutableAssetRequest(request) {
  const cached_response = await caches.match(request);
  if (cached_response) {
    return cached_response;
  }
  const network_response = await fetch(request);
  if (network_response.ok) {
    const cache = await caches.open(CACHE_VERSION);
    cache.put(request, network_response.clone());
  }

  return network_response;
}

async function HandleCodeRequest(request) {
  let network_response;
  try {
    network_response = await fetch(request, { cache: 'no-cache' });
  } catch (error) {
    const cached_response = await caches.match(request);
    if (cached_response) {
      return cached_response;
    }
    throw error;
  }
  if (network_response.ok) {
    const cache = await caches.open(CACHE_VERSION);
    await cache.put(request, network_response.clone());
  }
  return network_response;
}

self.addEventListener('install', event => {
  event.waitUntil(CacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(ClearOldCaches().then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (!IsSameOriginGetRequest(event.request)) {
    return;
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(HandleNavigationRequest(event.request));
    return;
  }
  event.respondWith(
    IsImmutableAssetRequest(event.request)
      ? HandleImmutableAssetRequest(event.request)
      : HandleCodeRequest(event.request)
  );
});
