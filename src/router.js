// Hash-based routing — works from a plain static file server (or
// file://-style hosting) with no server-side rewrite rules, which matters
// for a fully client-side, offline-capable app.
const routes = new Map();
let defaultPath = '/';
let activeCleanup = null;

export function registerRoute(path, mount) {
  routes.set(path, mount);
}

export function startRouter(initialDefaultPath) {
  defaultPath = initialDefaultPath;
  window.addEventListener('hashchange', render);
  render();
}

// Re-mounts whatever view is currently showing, without changing the
// route — used when something global changes (e.g. the language) that
// every view needs to reflect immediately, not just on next navigation.
export function rerender() {
  render();
}

function currentPath() {
  return location.hash.slice(1) || defaultPath;
}

function render() {
  const path = routes.has(currentPath()) ? currentPath() : defaultPath;
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
  const mount = routes.get(path);
  const cleanup = mount();
  if (typeof cleanup === 'function') activeCleanup = cleanup;

  document.querySelectorAll('[data-route]').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === '#' + path);
  });
}
