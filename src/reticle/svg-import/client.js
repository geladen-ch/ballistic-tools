// Main-thread side of the Reticle Designer's untrusted-input parsing (an
// SVG import, or a reticle file being loaded): hands the text to a fresh
// worker and waits at most IMPORT_TIMEOUT_MS. Always resolves — never
// throws or hangs — to { ok: true, ...result } or { ok: false, code,
// detail }, so the caller only has to show the outcome.
export const IMPORT_TIMEOUT_MS = 3000;

let overrides = {};

// Tests run the parsers directly (the test DOM's Worker never answers):
// { svg: (text) => outcome, reticle: (text) => outcome }; {} restores the
// worker.
export function setImportersForTests(fns) {
  overrides = fns || {};
}

function runJob(kind, text, pick) {
  if (overrides[kind]) return Promise.resolve().then(() => overrides[kind](text));
  return new Promise((resolve) => {
    let worker;
    let settled = false;
    let timer = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { worker?.terminate(); } catch { /* already gone */ }
      resolve(result);
    };
    timer = setTimeout(() => finish({ ok: false, code: 'timeout', detail: {} }), IMPORT_TIMEOUT_MS);
    try {
      worker = new Worker(new URL('../../workers/reticle-import-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (event) => {
        const data = event.data;
        const result = data && typeof data === 'object' && data.ok === true ? pick(data) : null;
        finish(result
          ? { ok: true, ...result }
          : { ok: false, code: typeof data?.code === 'string' ? data.code : 'unexpected', detail: data?.detail || {} });
      };
      worker.onerror = () => finish({ ok: false, code: 'unexpected', detail: {} });
      worker.onmessageerror = () => finish({ ok: false, code: 'unexpected', detail: {} });
      worker.postMessage({ kind, text });
    } catch {
      finish({ ok: false, code: 'unexpected', detail: {} });
    }
  });
}

export function importSvg(text) {
  return runJob('svg', text, (data) => (data.shape ? { shape: data.shape } : null));
}

export function loadReticleFile(text) {
  return runJob('reticle', text, (data) => (data.doc ? { doc: data.doc } : null));
}
