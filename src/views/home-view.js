import { el, clear } from '../dom.js';
import { GROUPS, PINNED, toolsInGroup } from '../nav-tools.js';
import { toolCard } from './category-view.js';
import { gunsIcon, settingsIcon, manualIcon } from '../ui/nav-icons.js';
import { t } from '../i18n.js';
import { CACHE_VERSION, RELEASE_ID, CODENAME_SHORT, CODENAME_LONG } from '../version.js';
import { resolveGunsDestination, goToGuns } from '../guns-nav.js';

// Guns isn't looked up here — see gunsPinnedLink() below, which routes it
// the same source-aware way as the rail/tab bar's own Guns entry (and
// guns-summary.js's "Change" button) instead of the fixed path every
// other pinned entry uses.
const PINNED_ICON = { settings: settingsIcon, manual: manualIcon };

function groupSection(group) {
  return el('div', { class: 'home-group' }, [
    el('h2', { i18n: group.nameKey }),
    el('div', { class: 'category-grid' }, toolsInGroup(group.id).map(toolCard))
  ]);
}

function pinnedLink(entry) {
  return el('a', { href: '#' + entry.path, class: 'home-pinned-link' }, [
    PINNED_ICON[entry.icon](16),
    el('span', { i18n: entry.nameKey })
  ]);
}

function gunsPinnedLink() {
  const link = el('a', { href: '#' + resolveGunsDestination(), class: 'home-pinned-link' }, [
    gunsIcon(16),
    el('span', { i18n: 'nav.guns' })
  ]);
  link.addEventListener('click', (e) => {
    e.preventDefault();
    goToGuns();
  });
  return link;
}

// Splits "plain *emphasized* plain" into alternating text/<em> children for
// el() — used for the privacy policy text below, where which words are
// emphasized is part of the actual policy wording (not decoration), so
// each locale's own translated string carries its own *word* markers
// rather than this code assuming a fixed sentence structure that
// wouldn't survive translation into a language with different word order.
function withEmphasis(text) {
  return text.split(/\*(.+?)\*/g)
    .map((part, i) => (i % 2 === 1 ? el('em', { text: part }) : part))
    .filter((part) => part !== '');
}

function versionCard() {
  return el('div', { class: 'card' }, [
    el('h3', { i18n: 'home.versionHeading' }),
    el('div', { class: 'version-number', text: CACHE_VERSION }),
    el('div', { class: 'version-line', text: `${t('home.versionRelease')} ${RELEASE_ID}` }),
    el('div', { class: 'version-codename' }, [
      el('b', { text: `${t('home.versionCodename')} ${CODENAME_SHORT}` }),
      ` — ${CODENAME_LONG}`
    ]),
    el('p', {}, [
      el('a', { href: '#/release-history', i18n: 'home.releaseHistoryLink' })
    ])
  ]);
}

function privacyCard() {
  return el('div', { class: 'card' }, [
    el('h3', { i18n: 'home.privacyHeading' }),
    el('p', {}, withEmphasis(t('home.privacyPolicy')))
  ]);
}

// The AGPLv3's own "how to apply" boilerplate (see LICENSE) asks an
// interactive program to make this — a copyright notice, the no-warranty
// statement, and how to view the license — conveniently reachable; the
// LICENSE file itself is the verbatim license text and isn't the place
// for that (it says as much: "changing it is not allowed").
function licenseCard() {
  return el('div', { class: 'card' }, [
    el('h3', { i18n: 'home.licenseHeading' }),
    el('p', { text: t('home.copyrightNotice', { app: t('app.title'), year: '2018 - present', name: 'Alexandre Trofimov' }) }),
    el('p', { class: 'hint', i18n: 'home.licenseNoWarranty' }),
    el('p', {}, [
      el('a', { href: './LICENSE', target: '_blank', rel: 'noopener', i18n: 'home.viewLicenseLink' })
    ])
  ]);
}

function contactCard() {
  return el('div', { class: 'card' }, [
    el('h3', { i18n: 'home.contactHeading' }),
    el('p', { i18n: 'home.contactText' }),
    el('p', {}, [
      el('a', { href: 'https://geladen.ch', target: '_blank', rel: 'noopener', i18n: 'home.contactLink' })
    ])
  ]);
}

// THANKS.md is one file shared by every locale (it's multi-lingual on its
// own), so unlike the other About cards this link never varies with the
// current language — see thanks-view.js.
function officialThanksCard() {
  return el('div', { class: 'card' }, [
    el('h3', { i18n: 'home.thanksHeading' }),
    el('p', { i18n: 'home.thanksText' }),
    el('p', {}, [
      el('a', { href: '#/thanks', i18n: 'home.thanksLink' })
    ])
  ]);
}

export function mount(container) {
  clear(container);
  container.appendChild(
    el('div', {}, [
      el('h1', { i18n: 'app.title' }),
      el('p', { i18n: 'home.intro' }),
      groupSection(GROUPS.analysis),
      groupSection(GROUPS.measurement),
      // Shooting has exactly one tool (Range Solver) but still renders as
      // a full group section here, same as Analysis/Measurement — see
      // GROUPS.shooting's own comment in nav-tools.js for why the rail/
      // tab bar treat it differently (a direct link, not an accordion).
      groupSection(GROUPS.shooting),
      el('div', { class: 'home-pinned-row' }, PINNED.map((p) => (p.id === 'guns' ? gunsPinnedLink() : pinnedLink(p)))),
      el('h2', { class: 'home-about-heading', i18n: 'home.aboutHeading' }),
      el('div', { class: 'category-grid' }, [versionCard(), privacyCard(), licenseCard(), contactCard(), officialThanksCard()])
    ])
  );
}
