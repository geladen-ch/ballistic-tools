# geladen.ch ballistics

*Peaceful. Precise. Armed.*

A client-side external ballistics suite. Everything — trajectory
integration, hit-probability analysis, your saved rifles and bullets —
runs in your browser. **No data is ever collected or transmitted to a
server.** It works offline once loaded, and installs as an app on desktop
and mobile (PWA).

A reasonably stable (but not necessarily the latest) "official" version is hosted at https://bc.geladen.ch

## Tools

| Tool | Status | What it does |
|---|---|---|
| Trajectory | Live | Drop, windage, velocity and time of flight vs. range, computed with a point-mass RK4 integrator |
| Cd–Mach Curve | Live | Build a bullet's own drag curve from a velocity table |
| Hit Probability | Partial | Hit probability against a target, accounting for wind, range-estimation and dispersion uncertainty |
| Range Solver | Partial | Quick single-range solve without a full table |
| BC Tools | Partial | Calculate BC from known data, convert between different models, etc. |
| Range Card | Planned | — |
| Group size from photo | Planned | Measure rifle precision using images of targets with impacts |

Plus **Guns** (your saved rifles/bullets, built-in libraries or your own),
**Settings**, and a full in-app **User Manual**.

## Running it locally

No build step, no dependencies to install — it's vanilla JS served as
static files.

```
node tools/dev-server.js
```

Then open the printed URL in a browser.

## Tests

```
node --test
```

## Languages

English, Français, Русский, Deutsch, Italiano — switchable from Settings.

## Origins

Most of the code logic is inherited from various ballistic tools I have written over the years, and hosted first on ptosis.ch, then on geladen.ch. Now it's being refactored and consolidated into one single package, with a nice GUI.

Here's my statement to the World: I **fucking hate** writing GUIs. It takes 10x more time than the actual substance, and, coming from me, it invariably looks ugly.
And here's another statement: I **fucking hate** the whole concept and paradigm of DOM/CSS, it was hate at the first sight, and to day I wish the people who invented this monstrosity had dicks grow on their foreheads.

But ~~Now I have a machine gun, hohoho~~ then came AI. Practically all of the UI code was written by AI, and the machine is pretty good at it. Otherwise, I would never have gotten around to this whole exercise. To conclude, God bless robots -- they take care of stupid shit, while humans can consecrate themselves to Knowledge and Creation.

## Third-party libraries

Vendored locally under [src/vendor/](src/vendor/) (each with its own
`LICENSE` and `NOTICE.md`), no CDN dependency at runtime:

| Library | Author | License |
|---|---|---|
| [Chartist](https://gionkunz.github.io/chartist-js/) | [Gion Kunz](https://github.com/gionkunz) | MIT / WTFPL |
| [fflate](https://github.com/101arrowz/fflate) | [Arjun Barrett](https://github.com/101arrowz) | MIT |
| [i18next](https://www.i18next.com/) | [i18next](https://github.com/i18next) | MIT |
| [js-quantities](https://github.com/gentooboontoo/js-quantities) | Kevin C. Olbrich and contributors | MIT |

## License

[AGPL-3.0-or-later](LICENSE)
