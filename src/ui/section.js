import { el } from '../dom.js';

// Visual/structural wrapper shared by every input section (Rifle,
// Cartridge, Bullet, Atmosphere, ...) so they all look and behave the
// same wherever they're reused. `nested: true` is for a section that
// lives inside another one (Bullet inside Cartridge) — smaller heading,
// tighter spacing, a raised background instead of a border so it reads
// as "part of the parent" rather than a sibling card.
export function sectionGroup(titleKey, children, { nested = false } = {}) {
  return el('div', { class: nested ? 'input-section nested' : 'input-section' }, [
    el(nested ? 'h4' : 'h3', { i18n: titleKey }),
    ...children
  ]);
}
