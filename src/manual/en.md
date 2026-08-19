# geladen.ch ballistics — User Manual

*Peaceful. Precise. Armed.*

geladen.ch ballistics is a client-side external ballistics suite. Everything —
trajectory integration, hit-probability analysis, your saved rifles and
bullets — runs in your browser. **No data is ever collected or transmitted to
a server.** It works offline once loaded, and installs as an app on desktop
and mobile (PWA).

This manual covers the fully functional tools — **Trajectory**, **Guns**,
**Cd–Mach Curve**, and **Settings** — plus **Hit Probability**, **Range
Solver**, and **BC Tools**, all usable for their current scenarios but
still under active development. Everything else on Home is listed at the
end, under **Planned / work in progress**.

---

## Installing the app

### Android (Chrome)

Chrome can install this app so it behaves like any other app on your phone —
its own icon on the home screen, its own window with no browser bar around
it, and it keeps working offline.

- Open the app in Chrome.
- Tap the **⋮** menu (top right) and choose **Install app** (older versions
   of Chrome call this **Add to Home screen**).
- Confirm. An icon appears on your home screen or in your app drawer, just
   like any other installed app.

**A separate icon for Range Solver.** Since Range Solver lives inside this
same app, you can give it its own icon that jumps straight past the Home
page:

- In Chrome, open the app and go into **Range Solver**.
- Open the **⋮** menu again — while Range Solver is open — and choose
   **Add to Home screen**.
- When Chrome asks for a name, give it something like "Range Solver" so
   the two icons are easy to tell apart.

Tapping this second icon opens the app directly into Range Solver, skipping
Home — handy if that's the only tool you reach for in the field. Both icons
currently show the same picture; only the names differ.

### iPhone / iPad (Safari)

This has to be done in **Safari** — other browsers on iPhone (including
Chrome) aren't allowed to install apps to the home screen.

- Open the app in Safari.
- Tap the **Share** button (the square with an arrow pointing up, in the
   bottom toolbar — on iPad it's at the top).
- Scroll down the sheet that appears and tap **Add to Home Screen**.
- Confirm the name (or change it) and tap **Add**, top right.

An icon appears on your home screen, and opens in its own window without
Safari's address bar — same as the Android version.

**A separate icon for Range Solver** works the same way: open **Range
Solver** inside the app first, then repeat **Share → Add to Home Screen**
while that page is open, and give it a distinguishing name like "Range
Solver". As on Android, both icons currently show the same picture; only
the names differ.

## Trajectory

Computes a full drop/windage/velocity/time-of-flight table and chart for the
active rifle, cartridge, and bullet (set on **Guns**, below), using a
point-mass RK4 integrator.

**Inputs** start with the active rifle and load, shown as a short summary
with a **Change** button back to Guns, plus an Atmosphere section, and a
couple of settings specific to this table and chart:

- **Max range** / **Range step** — how far, and in what increments, the
  table is computed.
- **Line-of-sight angle** — incline/decline of the shot, in degrees, positive
  uphill. Leave at 0 for a flat shot.

**The table** shows one row per distance step, with toggleable columns
(drop, windage, elevation/windage corrections in clicks/mrad/MOA, velocity,
time of flight, Mach, energy). Elevation correction is signed for how you'd
actually dial a scope: a bullet that's dropped below the line of sight shows
as a *positive* number of clicks to dial **up**.

You can **download the table as a CSV file**, or **copy it to the clipboard**
as CSV — both use exactly the columns currently toggled on, and the field/
decimal separator you've set in Settings → CSV export (so it opens correctly
in whatever spreadsheet locale you use).

**The chart** plots any one column against range, with its own independent
zoom/pan (drag the two range sliders under it — 50 m minimum window). It can
be **downloaded as an SVG** file (the small icon above the chart), which
carries no dependency on this app to view or edit later.

## Hit Probability

Estimates the probability of hitting a target for a chosen firing scenario,
combining your rifle and load with your own shooting precision and the
uncertainty in range, temperature, pressure, and wind estimation. **Still
under active development** — more scenarios and targets are planned; treat
results as indicative, not a certified prediction.

**Rifle & Bullet** shows the same summary as Trajectory — the active
configuration set on **Guns**; use **Change** to pick or edit it.

**Uncertainty** sets the size of every error source:

- **Own errors** — muzzle velocity consistency (SD), and either detailed
  bench-rifle precision + shooter skill + shooting position, or a single
  simplified combined-precision figure (a group size and its convention:
  ES-5, ES-10, R50, or R99).
- **Condition errors** — distance, temperature, pressure, and wind
  estimation error; if **Moving target** is checked, also the target's
  lateral speed and your error in estimating it.

**Simulation** sets range, the target, atmosphere (temperature, pressure,
altitude, humidity), an optional battle zero (rifle dialed for a different
range than the target), and an aiming-point offset.

**Scenarios:**

- **Single shot** — one shot; every own-error and condition-error source
  applies directly.
- **Spotter-corrected shot** — a sighting shot is fired and its impact is
  called by a spotter, canceling the systematic offset in expectation; the
  corrected shot's residual error is its own dispersion plus the imprecision
  of the spotter's correction. Condition errors don't reappear in the
  corrected shot, since the spotter's call already accounts for their effect
  on the sighting shot.

**Targets** — a 40 × 60 cm plate (single hit/miss zone) and the ISSF 300m
target (ten scoring rings). More targets are planned.

**Results** show total hit probability, per-zone probability, score as a
percentage of maximum, a table of each error source's horizontal/vertical/
total contribution, and an illustration of the target with a sample
dispersion cloud, mean point of impact, and 95% ellipse — downloadable as
SVG.

## Range Solver

A quick single-range solve: dial numbers for one shot, right now, big enough
to read at arm's length or in direct sunlight — not a table, not an
analysis. Its whole design goal is to show nothing you don't need at the
moment of dialing: no header, no chrome beyond a small nav, no numbers
you're not about to use.

Opening it replaces the app's normal navigation with its own — **Target**,
**Wind**, **Atmosphere**, **Guns** (jumps to Custom/Arsenal; Done brings you
back here), and **Exit solver** (always returns to Home). On a phone or
tablet that supports it, the screen is kept from sleeping while Range Solver
is open, so it won't dim mid-string.

- **Target** — range and line-of-sight angle. Deliberately just these two
  fields for now; a fuller target/location mode is planned to replace this
  tab without touching Wind or Atmosphere.
- **Wind** — speed (large +/− stepper) and direction (the same dial used
  elsewhere, enlarged here).
- **Atmosphere** — temperature, pressure, altitude, humidity, and presets —
  the same inputs as Trajectory's, minus wind, which has its own tab here.

**Output** recomputes live as you change any input — no Calculate button.
Elevation and windage show as whole clicks (using the active rifle's own
click settings from Guns), each with a leading direction indicator: up/down
for elevation, left/right for windage. Choose between an arrow glyph or a
**+ / −** sign (Settings → **Range Solver output indicators**) — **+**
always means dial up or dial right. A small footer line adds time of flight,
residual velocity, and residual energy. If an input is mid-edit (e.g.
momentarily empty), the readout shows a plain **—** instead of a stray
result.

Uses the same active rifle, cartridge, and bullet as Trajectory and Hit
Probability (set on **Guns**) and the same zero — no separate battle-zero
override here.

## Guns

The rifle, cartridge, and bullet used by every tool that needs one —
currently **Trajectory** and **Hit Probability**. Wherever a tool needs this
configuration, it shows a short summary (name, source, muzzle velocity) with
a **Change** button that jumps here; whatever you pick or edit applies
everywhere and **persists across restarts**.

**Change** routes you to whichever of the two tabs below matches the active
rifle's source — **Arsenal** if it's one of your own saved rifles, **Custom**
otherwise. On mobile, opening Guns swaps the bottom bar to **Custom** /
**Arsenal** / **Done**; on desktop, the side rail swaps the same way.
**Done** returns you to whichever tool sent you here.

### Custom

Pick a built-in rifle, one of your own Arsenal rifles, or enter a rifle and
bullet entirely by hand — all three options live in the same form. A few
fields are worth calling out:

- **Zero range** — the range at which the rifle is sighted in. The engine
  solves for the launch angle that puts the bullet on the line of sight at
  this distance; you don't set the angle yourself.
- **Muzzle velocity vs. temperature** — optionally model how a cartridge's
  muzzle velocity shifts with powder temperature, instead of using one fixed
  value.
- **Bullet drag** — either a ballistic coefficient (BC) with a standard drag
  model (G1, G7, and others — see **Settings**), or, for library bullets
  that have one, a directly measured Cd-Mach table (more accurate, no BC
  involved).

**Add rifle to arsenal** / **Add bullet to arsenal**, next to the rifle and
bullet fields, save the current entry into your own Arsenal library (below)
for reuse.

### Arsenal

Your own library of rifles and bullets, stored only on this device
(browser local storage) — nothing here ever leaves your browser.

**Built-in libraries.** The app ships with a built-in library of common
rifles and bullets, shown alongside anything you add yourself (your own
entries are marked with a leading `*`). If you don't want the built-in
entries cluttering your pickers — e.g. you only ever use your own hand-loaded
data — **turn them off individually in Settings → General** ("Show built-in
rifles library" / "Show built-in bullets library"). Your own saved entries
are unaffected either way.

**Adding and managing entries.** Add a bullet either from scratch (name,
caliber, mass, BC/drag model or a pasted Cd-Mach table) or by copying a
built-in one and adjusting it. Add a rifle with its own sight height, zero
range, and scope click settings, then attach one or more cartridges to it
(each with its own bullet and muzzle velocity). "Set active" on a rifle makes
it the active configuration used everywhere, and returns you to whichever
tool you opened Guns from.

Caliber and manufacturer filters narrow long lists. A bullet or rifle you've
edited but not yet exported shows an "Unsaved" badge.

**Saving and loading your library.** Since nothing is on a server, your
library is only as safe as your browser's local storage. **Save to file**
(per rifle/bullet, or "Save library…" for a multi-select export) writes a
JSON file you can back up or move to another device; **Load library…**
imports one back, with a per-item choice of how to resolve name conflicts
(overwrite, overwrite only if newer, or keep both).

**Comparison.** Mark up to two of your own saved rifle+cartridge
configurations "for comparison" (from each rifle's own row). Once two are
marked, a Comparison section appears with a shared chart plotting both
configurations' trajectories against the same column and range window —
useful for judging two loads, or two rifles, against each other directly.
Like the Trajectory chart, it has its own zoom/pan and can be **downloaded
as an SVG**.

## BC Tools

Calculate a ballistic coefficient from known data, or convert a BC between
different models — grouped under one tool with **BC Calculation**, **BC
Conversion**, and **BC Labradar** tabs. **BC Calculation** and **BC
Labradar** are fully usable today; **BC Conversion** is **still planned**.

**BC Calculation** backs out a ballistic coefficient from a near
velocity/range and either a far velocity or a measured time of flight
between the two ranges, plus a drag model (G1/G7) and atmosphere. Switch
between **Velocity** and **Time of flight** input mode depending on what
you measured (e.g. two chronograph readings, versus a single time-of-flight
reading over a known distance) — everything else (near velocity, both
ranges, drag model, atmosphere) stays the same either way. Useful when
you've measured actual velocity loss, or actual time of flight, over a
known distance and want the BC that explains it, rather than trusting a
published number.

**BC Labradar** fits a BC per shot from a Labradar chronograph export — a
**.zip** of track files the device writes to its SD card, one per shot,
recording velocity roughly every millisecond during flight. Choose a drag
model and atmosphere (no presets here — enter your own station
pressure/temperature/humidity directly), then pick the zip; each track is
parsed, cleaned of noisy/erroneous points, and fit for a BC automatically.
Files in the zip that aren't real tracks (the device's own report or
project files, or unrelated stray files) are ignored. Two adjustable
filters weed out unreliable tracks before they're averaged together: a
**signal quality threshold** (how well a track's cleaned points fit a
straight line) and an **outlier rejection** (how far a track's own BC sits
from the others') — useful for excluding a track picked up from a nearby
shooting lane, or one the radar simply had a bad read on. Click a track's
row to see its own velocity-vs-time chart, with kept and discarded points
shown separately, and untick a track's checkbox to manually exclude it (or
re-tick one the automatic filters rejected) from the averaged result.

## Cd–Mach Curve

Backs out a bullet's own drag curve (Cd vs. Mach) from a measured distance/
velocity table — e.g. Doppler radar or multi-chronograph readings — solving
for the drag coefficient segment by segment, instead of assuming a standard
G1/G7 shape. Works best with a sparse table (chronograph readings every
~100 m or so); dense tables (10–20 m steps) work too, but each row's own
rounding error then has more influence on that one segment's result.

**Distance / velocity table** — paste one distance/velocity pair per line
(tab, space, or semicolon separated; decimal point or comma both work), at
least 3 rows. **Table units** lets you say whether the pasted numbers are
**Modern (m, m/s)** or **Archaic (yd, fps)** — independent of your own unit
preference, since the source data's units don't have to match what you
prefer to see elsewhere in the app.

Below the table: the same mass and caliber fields Arsenal uses, and an
independent **Atmosphere** section (defaults to standard sea level) — the
solver needs both to fly a synthetic trajectory over each segment and work
out what Cd would reproduce the measured velocity drop.

**Compute** produces two tables:

- **Interpolated** — the recovered curve read back at a fixed, dense set of
  reference Mach numbers; this is the one to use downstream (e.g. saving to
  Arsenal).
- **Calculated (raw per-segment)** — the underlying per-segment values
  before interpolation, hidden by default (**Show per-segment (calculated)
  table**).

Either table can be **downloaded as CSV** or **copied to the clipboard**
(Settings → CSV export's field/decimal separator applies here too). A
segment the solver couldn't use — velocity didn't decrease, distance didn't
increase, or the solve didn't converge — is skipped and listed, without
affecting the rest of the table.

**The chart** plots the Calculated points and the Interpolated line,
alongside G1 and G7 reference curves scaled to match your bullet's own
curve at Mach 2.0 — a quick visual read on how standard, or not, this
bullet's drag shape is. Downloadable as SVG, same as Trajectory's chart.

**Save to Arsenal** sends you to Guns → Arsenal's Add bullet form with mass,
caliber, and the Cd-Mach table pre-filled — choose **Calculated (raw
per-segment)** or **Interpolated (smoothed)** as the source next to the
button. Enabled only once a result exists.

## Settings

- **Language** — English, Français, Русский, Deutsch, Italiano.
- **Units** — one preferred unit per measurement kind (velocity, distance,
  small lengths, altitude, temperature, pressure, angular dispersion, energy),
  mixed metric/imperial freely; applies everywhere that measurement appears.
- **Built-in libraries** — show/hide the built-in rifle and bullet libraries
  (see **Guns** above).
- **Ballistic models** — show/hide individual standard drag models (G1, G7,
  ...) from every drag-model picker in the app, to declutter it down to the
  ones you actually use. A model you hide stays available wherever it's
  already selected (a manually entered bullet, a library bullet's own
  model) — hiding it only affects future choices, never an existing one.
  At least one model must always stay visible.
- **Theme** — pick from three illustrated thumbnails, applied everywhere
  immediately: **Dark color** (the default), **High contrast light** (a
  white background with black text, for maximum visibility in direct
  sunlight), and **High contrast dark** (a black background with maximum-
  contrast text and colors, for when you need the screen brightness turned
  up to see it outdoors and want to save battery while doing it).
- **Range Solver output indicators** — whether Range Solver's elevation/
  windage readout shows a direction arrow or a **+ / −** sign (see
  **Range Solver** above).
- **CSV export** — the field separator (comma/semicolon/tab) and decimal
  separator (dot/comma) used by Trajectory's CSV download and clipboard copy.
  Pick whichever pair your spreadsheet software expects.

---

## Planned / work in progress

Listed on Home but not usable yet:

- **Rifle precision calculator** — measure rifle precision using images of
  targets with impacts.

Check back as they land.
