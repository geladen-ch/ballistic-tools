// The one error type the SVG importer throws. `code` names the reason
// (reticleDesigner.svg.errors.<code>), `detail` is an optional figure for
// the message (a count, a limit).
export class ImportError extends Error {
  constructor(code, detail = {}) {
    super(code);
    this.name = 'ImportError';
    this.code = code;
    this.detail = detail;
  }
}
