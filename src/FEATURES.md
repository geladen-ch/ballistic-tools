# geladen.ch ballistics — features as of 2026-09-14 11:14 CEST
(updated from time to time, check the [release history](#/release-history) for the very latests and greatest)

geladen.ch ballistics is a client-side external ballistics suite — trajectory integration, hit-probability analysis, BC and drag-curve tools, a field range solver, and a photo-based rifle precision calculator, plus your saved rifles, bullets, and locations, all running entirely in the browser with nothing ever sent to a server. Below is a quick bullet-point inventory of what each tool does. Items marked **★** are things you don't typically get in commodity ballistic solvers.

## Whole-app traits

- ★ Free as in freedom (AGPL-3.0, open source) — and free as in beer: no subscription, no account/registration, no paywalled "premium" tier. Every feature above is just... in the app. There is no upsell to a "deluxe pro elite" edition; this is that edition
- ★ 100% client-side — no server, no telemetry, no data collection ever
- Works fully offline once loaded; installable as a PWA on desktop and mobile
- All personal data (rifles, bullets, locations, precision projects) lives only in local browser storage, with explicit JSON backup/restore for every library, plus an optional device-to-device Backup & Sync (see below)
- Mixed metric/imperial units, per measurement kind
- Language: English, Français, Русский, Deutsch, Italiano
- Show/hide individual built-in libraries and drag models
- Three themes, including two high-contrast modes for outdoor use

## Ballistic Engine

Shared numerical core behind Trajectory, Range Solver, Guns' comparison chart, and Hit Probability — not tied to any one tool.

- RK4 numerical integration for trajectory computation, not a coarser Euler/Heun-style stepper
- ★ Optional 4DOF Modified Point Mass stepper alongside the standard 3DOF point-mass model
- ★ Spin drift, three ways (picked in Settings): **Off**; **Simple** — Litz's well-established empirical formula; or **Advanced** — McCoy's own gyroscopic-lift equations run through the 4DOF stepper, physically derived rather than curve-fit, with a length-to-caliber transverse-MOI fit calibrated against Lapua 6DOF data (replacing McCoy's book's one-size-fits-all .308"/168gr SMK constant). Falls back automatically (Advanced → Simple → Off) when a bullet lacks the data a mode needs, with an optional zero-compensation so a rifle's zero already absorbs the drift
- ★ Live gyroscopic stability (Sg) via Miller's Twist Rule, re-derived in the engine's own SI units, with an altitude/density correction Miller's original formula doesn't have — Sg reflects the atmosphere you're actually shooting in, not just a factory-spec number
- ★ Muzzle velocity vs. powder temperature modeling, instead of one fixed MV
- ★ Directly measured Cd-Mach drag tables as a drop-in alternative to BC + a standard drag model, per bullet
- ★ Inclined shots get proper atmosphere along the whole flight, not just a tilted line of sight — pressure, temperature, air density and speed of sound are recomputed at every integration step from the bullet's own current altitude (muzzle altitude plus how far up or down it's actually flown), not held fixed at the muzzle's reading

## Trajectory

- Full drop/windage/velocity/time-of-flight table
- Toggleable columns, signed elevation clicks matching how you'd actually dial a scope
- Incline/decline (line-of-sight angle) shot support
- CSV export/clipboard copy with configurable field/decimal separator
- ★ Chart isn't fixed to drop — plot any one of drop, windage, elevation/windage correction (clicks, mrad, or MOA), velocity, time of flight, Mach, or energy against range, independently zoomable/pannable, SVG export
- ★ Trajectory info panel: zero angle, plus the apex of the arc (peak height and the distance it occurs at)
- ★ Max point blank range — given a target height and where you aim on it (center or bottom edge), solves the farthest zero distance that keeps the whole trajectory inside the target, with the elevation (clicks and absolute) that zero requires
- ★ Danger zone columns and chart — for any zero distance, how far before and after it the trajectory stays within the target, plotted as a band across a range of zero distances rather than a single number
- Optional zero-range override scoped to this tool's own calculations only — never touches the zero range configured in Guns, and respects a cartridge zeroed off another cartridge's ballistics

## Hit Probability

- ★ Closed-form analytical solve (error-function integration over target zones), not Monte Carlo sampling — exact and instant rather than a simulated approximation
- ★ Full uncertainty budget: muzzle velocity SD, bench precision, shooter skill, shooting position, range/temperature/pressure/wind estimation error, all decomposed per-source in the results
- ★ Spotter-corrected shot scenario — models a called sighting shot canceling systematic offset, distinct residual error from a cold single shot
- Moving-target support (lateral speed + estimation error)
- Battle-zero (rifle zeroed for a different range than the target)
- ★ 20 built-in target types to solve against, not just a generic hit/miss zone — ISSF 300m, CH 300m B4/B10, CH field targets E/F/G/H/K, CH NTTC score, USSR №4/№5/№8, IPSC Target/Popper (plus mini variants), Killer Tubby, circle gong, rectangle plate, 2×2m square — each with its own scoring zones, so results include a real score, not just a hit probability
- Per-zone probability, score %, dispersion cloud + 95% ellipse illustration, SVG export

## Range Solver

- Single-range field tool: elevation/windage/TOF/velocity/energy, live recompute, no Calculate button
- Distraction-free UI built for arm's-length/sunlight reading, keeps the screen awake while open
- ★ Saved shooting locations with a range card (every target at a location, solved at once)
- ★ Targets picked visually off a photo taken from the firing point — tap a pin on the photo instead of dialing range/angle by hand
- Installable as its own home-screen icon, separate from the main app

## Guns (rifle/bullet/cartridge library)

- One active configuration shared across Trajectory, Hit Probability, Range Solver
- Built-in libraries: Geladen's own; Lapua Cd (radar-measured); Hornady Reverse, Berger Reverse, Sierra Reverse, and Lapua Reverse (all reverse-engineered from Hornady's own 4DOF calculator output); Berger Published BC (weight, diameter, OAL, and G7 — or G1 where Berger publishes no G7 — as published on Berger's own site); Swiss P (reverse-engineered from published tables)
- Bullet pickers (custom entry and Arsenal alike) sorted by real caliber, then library, then manufacturer + name, with your own bullets listed ahead of the built-in libraries
- ★ Side-by-side trajectory comparison of two saved rifle+load configs on one chart — same full column choice as Trajectory's own chart, not just drop
- Local-only storage (nothing ever leaves the browser), JSON backup/restore with per-item conflict resolution
- ★ Zero with one cartridge (practice ammo, say), stay correct with all the others sharing the rifle — each recipient cartridge borrows its elevation solve from a designated donor's ballistics instead of assuming it was zeroed on its own

## Backup & Sync

- ★ Replicate your Arsenal, Locations, and Rifle Precision libraries between your own devices — no account, and no cloud service of ours: it just reads and writes a small backup file in a folder your existing cloud provider (iCloud Drive, OneDrive, Google Drive, Dropbox, etc.) already keeps in sync
- Chromium: connects to that folder directly, syncing manually on demand or automatically every few minutes and whenever you return to the tab; Firefox/Safari/iOS: a manual file-picker/share-sheet round trip stands in for the same merge, since those browsers can't keep a folder connected
- ★ Revision-based merge resolves what it safely can on its own; genuine conflicts land in a pending-review queue that names the library and device each side came from, so you pick "keep mine" or "take theirs" per item instead of guessing from a bare record name
- ★ Local Change History — every recent edit or deletion across those three libraries, whether made on this device or merged in from another, can be reviewed and reverted independently of sync
- Per-device naming, last-synced status per peer device, and clock-skew warnings when a peer's timestamps look wrong enough to make automatic resolution unsafe
- Still experimental — the feature says so up front, and nudges you to export your existing libraries before turning it on

## BC Tools

- **BC Calculation** — back out a BC from measured velocity loss or time of flight over a known distance, instead of trusting a published number
- **BC Conversion** — convert a BC between standard drag models at a chosen reference velocity
- ★ **Multiple BC** — turn 2–5 manufacturer-published BC values (each valid over its own speed band) into a bullet-specific Cd-Mach curve, with draggable segment borders on the chart, plus the "optimal compromise" single BC per model
- ★ **BC Labradar** — parses raw Labradar chronograph track exports (.zip of per-shot millisecond-resolution velocity data), auto-fits a BC per shot, with signal-quality and outlier-rejection filters and per-track manual include/exclude; the averaged BC ships with its own 95% confidence interval (± N%, via a small-sample Student-t multiplier), so you can see how much the surviving tracks actually agree

## Cd–Mach Curve

- ★ Builds a bullet's own Cd-vs-Mach drag curve from a pasted distance/velocity table (Doppler or multi-chronograph data), solved segment by segment — not assumed to follow a standard G1/G7 shape
- Handles sparse or dense tables; flags segments the solver couldn't use
- Interpolated + raw per-segment result tables, CSV export
- Chart overlays scaled G1/G7 reference curves for a visual sanity check
- One-click save straight into Arsenal as a bullet's drag data

## Rifle Precision Calculator

- ★ Measures real rifle precision from phone photos of paper targets — no chronograph or rangefinder needed, just a photo and a known-length reference for scale calibration
- Projects → Targets → Groups data model; ★ pools every usable group across every usable target in a project into one combined statistical report (correctly re-centered per group's own point of aim)
- ★ Full precision statistics: confidence interval on σ, R50/R95/R99 radii (with confidence interval on R95), expected 5- and 10-shot group size (ES5x/ES10x), not just a raw extreme-spread number
- ★ "Confidence-o-meter" — rates how trustworthy a given sample size's result actually is, baked into the exported image
- Configurable diagram: grid overlay, true-bore-scale impacts, 1-MOA reference circle, hit-probability circle
- PNG group-overview export, CSV raw-shot export, SVG report export
- Feeds precision data directly into Hit Probability

## Unit Conversion (helper tool)

A secondary, no-frills utility, not one of the main ballistics tools above.

- Seven live-linked converter groups — angle, range, length, speed, mass, temperature, pressure — modern and archaic units side by side, type into any field and every other unit in the group updates at once
