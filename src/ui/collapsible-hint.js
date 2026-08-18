import { el } from '../dom.js';
import { svgEl } from '../svg.js';

const LINE = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

function helpIcon(size = 13) {
  return svgEl('svg', { viewBox: '0 0 20 20', width: size, height: size, ...LINE }, [
    svgEl('circle', { cx: '10', cy: '10', r: '8' }),
    svgEl('path', { d: 'M7.6 7.8c0-1.6 1.1-2.6 2.5-2.6s2.5.9 2.5 2.2c0 1.4-1.1 1.9-1.9 2.5-.6.5-.7 1-.7 1.7' }),
    svgEl('line', { x1: '10', y1: '14.3', x2: '10', y2: '14.3', 'stroke-width': '2.2' })
  ]);
}

// A small "?" icon button that reveals a hint paragraph on click/tap —
// not a CSS :hover tooltip, so it's reachable on mobile touch the same
// way it is with a mouse. Returns the two nodes rather than a single
// wrapper so the caller can place the button next to a status chip/line
// and the hint paragraph below it, matching stability-indicator.js's own
// layout. Build once per logical instance and keep reusing the same
// button/hint nodes (re-append rather than rebuild) if the surrounding UI
// re-renders — the expand/collapse state lives in this closure, not in
// the caller, so a rebuild-from-scratch would otherwise reset it.
export function collapsibleHint({ toggleLabel, hintText }) {
  let expanded = false;
  const hint = el('p', { class: 'hint collapsible-hint-text', text: hintText });
  hint.style.display = 'none';

  function setExpanded(next) {
    expanded = next;
    hint.style.display = expanded ? '' : 'none';
    button.setAttribute('aria-expanded', String(expanded));
  }

  const button = el('button', {
    type: 'button', class: 'icon-button collapsible-hint-toggle', title: toggleLabel, 'aria-label': toggleLabel,
    'aria-expanded': 'false'
  }, [helpIcon()]);
  button.addEventListener('click', () => setExpanded(!expanded));

  // For a caller whose toggle button itself only shows conditionally
  // (trajectory-view.js's own spin-drift hint, hidden once spin drift
  // becomes computable) — collapses the hint and resets the internal
  // expanded flag together, so a later click starts from a known state
  // instead of requiring an extra click to undo a stale "expanded" the
  // caller's own display:none already hid without going through here.
  function collapse() {
    setExpanded(false);
  }

  return { button, hint, collapse };
}
