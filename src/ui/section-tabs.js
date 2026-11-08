import { el } from '../dom.js';

// A tiny reusable tab-switcher: `tabs` is [{ key, labelKey }], `onSwitch`
// is called with the newly active key after the button classes and
// visibility are already updated. `initialKey` (defaults to the first
// tab) picks which tab/panel starts active — also applied to `panels`'
// initial display, so callers don't hide their non-default panels by
// hand. Own buttons and panels, no route change — the BC Tools and
// Trajectory tabs, styled as .section-tabs/.tab-btn.
export function tabSwitcher(tabs, panels, onSwitch, initialKey) {
  const activeKey = tabs.some((tabDef) => tabDef.key === initialKey) ? initialKey : tabs[0].key;
  const buttons = tabs.map((tabDef) => {
    const btn = el('button', { type: 'button', class: 'tab-btn' + (tabDef.key === activeKey ? ' active' : ''), i18n: tabDef.labelKey });
    btn.addEventListener('click', () => {
      for (const b of buttons) b.className = 'tab-btn';
      btn.className = 'tab-btn active';
      for (const key of Object.keys(panels)) panels[key].style.display = key === tabDef.key ? '' : 'none';
      if (onSwitch) onSwitch(tabDef.key);
    });
    return btn;
  });
  for (const key of Object.keys(panels)) panels[key].style.display = key === activeKey ? '' : 'none';
  return { node: el('div', { class: 'section-tabs' }, buttons) };
}
