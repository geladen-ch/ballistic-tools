// One row per zip entry — filename, a status/verdict badge (bare
// `status-chip status-chip-<state>` classes, the same generic pill
// convention src/ui/stability-indicator.js already uses for its own
// dynamic, non-fixed status set — see src/styles/base.css), BC/R^2 once
// resolved, and (only for entries that made it far enough to be a real
// candidate for the average) a checkbox forcing it in/out of the
// aggregate — see engine/labradar-bc.js's aggregateTracks() `overrides`.
// Clicking a row (not its checkbox) selects it for the chart — see
// track-chart.js. bc-tools-view.js owns the actual track-state array and
// calls render() again on every change; this module is a pure view.
import { el, clear } from '../../dom.js';
import { t } from '../../i18n.js';

const STATUS_LABEL_KEYS = {
  pending: 'bcToolsLabradar.statusPending',
  computing: 'bcToolsLabradar.statusComputing',
  'not-a-track': 'bcToolsLabradar.statusNotATrack',
  valid: 'bcToolsLabradar.statusValid',
  'rejected-r2': 'bcToolsLabradar.statusRejectedR2',
  'rejected-outlier': 'bcToolsLabradar.statusRejectedOutlier',
  excluded: 'bcToolsLabradar.statusExcluded',
  error: 'bcToolsLabradar.statusError'
};

// Rows whose verdict was never actually computed (not a track / not yet
// resolved / a worker error) have nothing meaningful to override.
const OVERRIDABLE_STATUSES = new Set(['valid', 'rejected-r2', 'rejected-outlier', 'excluded']);

function statusChipEl(status) {
  return el('span', { class: `status-chip status-chip-${status}`, text: t(STATUS_LABEL_KEYS[status]) });
}

export function trackListTable({ onSelect, onOverrideChange }) {
  const tbody = el('tbody');
  const node = el('table', { class: 'labradar-track-table' }, [
    el('thead', {}, [el('tr', {}, [
      el('th', { i18n: 'bcToolsLabradar.columnFile' }),
      el('th', { i18n: 'bcToolsLabradar.columnStatus' }),
      el('th', { i18n: 'bcToolsLabradar.columnBc' }),
      el('th', { i18n: 'bcToolsLabradar.columnR2' }),
      el('th', { i18n: 'bcToolsLabradar.columnInclude' })
    ])]),
    tbody
  ]);

  let selectedFilename = null;

  function render(tracks) {
    clear(tbody);
    for (const track of tracks) {
      const canOverride = OVERRIDABLE_STATUSES.has(track.status);
      const checkbox = el('input', { type: 'checkbox' });
      checkbox.disabled = !canOverride;
      checkbox.checked = track.status !== 'rejected-r2' && track.status !== 'rejected-outlier' && track.status !== 'excluded';
      checkbox.addEventListener('change', () => onOverrideChange(track.filename, checkbox.checked));

      const tr = el('tr', { class: track.filename === selectedFilename ? 'labradar-track-row selected' : 'labradar-track-row' }, [
        el('td', { text: track.filename }),
        el('td', {}, [statusChipEl(track.status)]),
        el('td', { text: track.bc !== undefined ? track.bc.toFixed(4) : '—' }),
        el('td', { text: track.r2Linear !== undefined ? track.r2Linear.toFixed(4) : '—' }),
        el('td', {}, canOverride ? [checkbox] : [])
      ]);

      if (track.keptPoints || track.status === 'error') {
        tr.classList.add('labradar-track-row-clickable');
        tr.addEventListener('click', (evt) => {
          if (evt.target === checkbox) return;
          selectedFilename = track.filename;
          onSelect(track);
          render(tracks);
        });
      }
      tbody.appendChild(tr);
    }
  }

  return { node, render };
}
