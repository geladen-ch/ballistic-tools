// A small, unobtrusive icon-only button that opens the Locations manager
// — same quiet `.icon-button` treatment as download-button.js/
// copy-button.js (the Truing Session's entry gate uses it). A map pin,
// reading as "place/location" rather than anything settings-like.
import { el } from '../../dom.js';
import { locationIcon } from '../nav-icons.js';

export function locationPickerButton({ label, onClick }) {
  const button = el('button', { type: 'button', class: 'icon-button', title: label, 'aria-label': label }, [locationIcon(16)]);
  button.addEventListener('click', onClick);
  return button;
}
