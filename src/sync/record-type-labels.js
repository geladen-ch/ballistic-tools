// Shared recordType -> translated library-name mapping. Two independent
// Settings sections need to name "which of the four synced libraries" a
// given record belongs to — change-history-settings.js (the type of thing
// that was edited/deleted) and backup-sync-settings.js's pending-review
// dialog (which library a conflicting item belongs to, since a bare
// record name alone doesn't say whether "K31" is an arsenal rifle or a
// rifle-precision project) — so this is one map, not two kept in sync by
// hand every time a fifth library is ever added.
import { t } from '../i18n.js';

const RECORD_TYPE_LABEL_KEYS = {
  bullet: 'settings.changeHistory.recordTypeBullet',
  rifle: 'settings.changeHistory.recordTypeRifle',
  location: 'settings.changeHistory.recordTypeLocation',
  'rifle-precision-project': 'settings.changeHistory.recordTypeRifleProject'
};

export function recordTypeLabel(recordType) {
  return t(RECORD_TYPE_LABEL_KEYS[recordType] || recordType);
}
