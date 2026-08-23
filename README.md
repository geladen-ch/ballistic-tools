# geladen.ch ballistics

*Peaceful. Precise. Armed.*

A client-side external ballistics suite. Everything — trajectory
integration, hit-probability analysis, your saved rifles and bullets —
runs in your browser. **No data is ever collected or transmitted to a
server.** It works offline once loaded, and installs as an app on desktop
and mobile (PWA).

A reasonably stable (but not necessarily the latest) "official" version is hosted at https://bc.geladen.ch

## Genesis

In the beginning, there was "Modern Exterior Ballistics" by Robert L. McCoy (light shines from him). Depite the archaic units (all kinds of pound-feet per square farenheit), McCoy's book has the immense value of putting together all the key physical and mathematical principles that describe the flight of projectiles in this universe (rather than hunting for bits and pieces of them in dozens of different textbooks). McCoy's book also contains a skeleton of a 3DOF trajectory calculator program, which, I believe, can be considered as the great-grandfather of most of today's ballistic solvers.

Then came the JBM ballistics Web site. which remained for a very long time a reference for small arms external ballistics -- a wealth of information, and a bunch of publicly-accessible Web-based ballistic calculators, which set a standard for such software accuracy (if not for usability -- Web 1.0 UI defaulting to archaic units). Among other things, JBM made available on his site the code of an old version of his ballistic engine, under GPL license (newer and better versions became closed source). This old code of JBM's was... quite imperfect, using Heun over distance integration, sketchy 3-segment polynomial interpolations instead of Cd-Mach curves, bug-ridden atmosphere calculations, etc., but it had the unmistakable *l'avantage d'exister*.

Then came Nikolay Geht (https://github.com/nikolaygekht), the magnificent, who took JBM's legacy code, cleaned it up, and translated it from old-school hardcore K+R C into C# and (to my personal enjoyment) Javascript. That was the beginning ~~of a beautiful friendhip~~ of fully functional and user-friendly (as opposed to proof-of-concept or research) open-source 3DOF engine for small arms ballistics. Nikolay went the native application way (if you need an native ballistic calculator for Windows, Mac, or Linux, look no further than here: https://github.com/nikolaygekht/ballistic.calculator.app.avalonia, and check out his ballistics engine library as well), while I went js-webwards. Over time, what has started as legacy JBM code with crotches and duct tape was gradually fixed and rewritten -- atmosphere, drag modeling, integration, everything. Now I can state with reasonable confidence that in today's code there is nothing left of the original JBM's; the new eingine is fast, neat, precise, and proven by a decade of field testing.

Then JBM decided to remove almost all the contents of his Web site from public access. I will not judge Mr. James B. Millard's motivations here, but personally I was pissed off big time. All the many tools I've been using frequently suddenly disappeared. Somebody had to step in. This project is my attempt to fill the void.

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
