// The font faces PDF templates can use, and their font files. The list is
// generated with the fonts (src/vendor/pdf-fonts/faces.js); a face is
// addressed by family + weight + style exactly as templates name it.
import { PDF_FONT_FACES } from '../vendor/pdf-fonts/faces.js';
import { styleKey } from './font-style.js';

const FONT_DIR = new URL('../vendor/pdf-fonts/', import.meta.url);

export function allFaces() {
  return PDF_FONT_FACES;
}

export function findFace(family, weight, style) {
  return PDF_FONT_FACES.find((f) => f.family === family && f.weight === weight && f.style === style) || null;
}

export function describeFace(family, weight, style) {
  return `${family ?? '(no font-family)'} ${weight} ${style} (lookup key "${styleKey(weight, style)}")`;
}

// Font file contents, fetched once per session (the service worker serves
// them offline).
const files = new Map();

function loadFaceBytes(face) {
  let p = files.get(face.file);
  if (!p) {
    p = fetch(new URL(face.file, FONT_DIR)).then(async (res) => {
      if (!res.ok) throw new Error(`font ${face.file}: HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    });
    p.catch(() => files.delete(face.file));
    files.set(face.file, p);
  }
  return p;
}

// The face as the binary string jsPDF's virtual file system takes.
export async function loadFaceBinary(face) {
  return toBinaryString(await loadFaceBytes(face));
}

// svg2pdf.js positions text (text-anchor middle/end, a <tspan> following
// other text) by measuring it with the *browser's* fonts, looked up by the
// CSS family name. Unless the browser has the very same face, it measures a
// fallback font and misplaces the text. So every face used in a PDF is also
// registered with the document, once per session, from the same file.
// (The shipped fonts carry no kerning or ligature tables, so the browser's
// measurement matches jsPDF, which draws glyph by glyph.)
const documentFaces = new Map();

export function ensureDocumentFace(face) {
  let p = documentFaces.get(face.file);
  if (!p) {
    p = loadFaceBytes(face).then(async (bytes) => {
      const ff = new FontFace(face.family, bytes, { weight: String(face.weight), style: face.style });
      await ff.load();
      document.fonts.add(ff);
    });
    p.catch(() => documentFaces.delete(face.file));
    documentFaces.set(face.file, p);
  }
  return p;
}

function toBinaryString(bytes) {
  const CHUNK = 0x8000; // keeps String.fromCharCode's argument list well under engine limits
  let s = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return s;
}
