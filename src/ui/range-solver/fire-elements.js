// Which of the Fire! pane's optional elements actually show, and why one
// that is switched on has no effect. Pure: the pane (range-solver-view.js)
// and the Layout dialog's preview (fire-config-dialog.js) both read it, so
// the two can never disagree.
//
// `reason` is set whenever the element's switch has no effect right now
// (or, for the readout, while it is off: a hint, never a block).
import { degToRad } from '../../quantity.js';

// Ignoring line-of-sight angles is blocked while any target at the active
// location is at least this steep, either way.
export const LOS_IGNORE_LIMIT_RAD = degToRad(5);

export function resolveFireElements({ config, location, hasOptic }) {
  const usableLocation = !!location && Array.isArray(location.targets) && location.targets.length > 0;
  const hasPhoto = usableLocation && !!location.photo;
  const scope = { enabled: !!config.scope, effective: !!config.scope && !!hasOptic, reason: hasOptic ? null : 'noOptic' };
  const readout = { enabled: !!config.readout, effective: !!config.readout, reason: config.readout ? null : 'readoutOff' };
  const list = { enabled: !!config.list, effective: !!config.list && usableLocation, reason: usableLocation ? null : 'noLocation' };
  const picker = {
    enabled: !!config.picker,
    effective: !!config.picker && hasPhoto,
    reason: !usableLocation ? 'noLocation' : (hasPhoto ? null : 'noPhoto')
  };
  const blocked = usableLocation && location.targets.some((t) => Number.isFinite(t.losAngleRad) && Math.abs(t.losAngleRad) >= LOS_IGNORE_LIMIT_RAD);
  const ignoreLos = { enabled: !!config.ignoreLos, blocked, effective: !!config.ignoreLos && !blocked };
  return {
    usableLocation,
    showLocationName: usableLocation,
    scope, readout, list, picker,
    pictureIcon: !list.effective && !picker.effective && hasPhoto,
    ignoreLos
  };
}

// The ids of the elements the pane shows for a resolution, in no order.
export function effectiveElementIds(resolved) {
  const ids = ['gun', 'context', 'flight', 'manual', 'wind'];
  for (const id of ['scope', 'readout', 'list', 'picker']) if (resolved[id].effective) ids.push(id);
  return ids;
}
