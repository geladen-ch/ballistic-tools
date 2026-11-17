// Source registry. Add national adapters here; the pipeline needs no changes. Order matters only for display.
// Activation per point is decided by activation.js (coverage outline, learned extent, mode Auto/Off, circuit breaker).
import { iem } from './iem.js';
import { iemSynop } from './iem-synop.js';
import { iemUs } from './iem-us.js';
import { meteoswiss } from './meteoswiss.js';
import { geosphere } from './geosphere.js';
import { brightsky } from './brightsky.js';
import { dmi } from './dmi.js';
import { eccc } from './eccc.js';

/** @type {import('./types.js').SourceAdapter[]} */
export const sources = [iem, iemSynop, iemUs, meteoswiss, geosphere, brightsky, dmi, eccc];
