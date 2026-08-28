# geladen.ch ballistics — User Manual

*Peaceful. Precise. Armed.*

geladen.ch ballistics is a client-side external ballistics suite. Everything —
trajectory integration, hit-probability analysis, your saved rifles and
bullets — runs in your browser. **No data is ever collected or transmitted to
a server.** It works offline once loaded, and installs as an app on desktop
and mobile (PWA).

This software is provided with no guarantee of fitness for any particular
purpose, or whatever — blah blah blah. I tried my best to make it useful
(kept myself busy over a rainy weekend), and I believe it's reasonably
accurate, but if you find some creative way to misuse a ballistic
calculator into hurting yourself, that's on you — who am I to get in the
way of natural selection?

This manual covers the fully functional tools — **Trajectory**, **Range
Solver**, **Guns**, **Cd–Mach Curve**, **BC Tools**, **Rifle Precision
Calculator**, and **Settings** — plus **Hit Probability**, usable for its
current scenarios but still under active development.

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

Bullets don't fly in straight lines, no matter how much you'd like them to.
Trajectory tracks the whole flight — drop, wind drift, velocity, time of
flight — for your rifle and load (set on **Guns**, below), at every distance
you care about.

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

- **Target** — range and line-of-sight angle, entered by hand, or picked
  from a saved location's target list — see **Locations & Targets** below.
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
residual velocity, and residual energy. A summary conditions bar above the
readout shows range, wind, and atmosphere at a glance, so you always know
what a given elevation/windage was dialed for. If an input is mid-edit (e.g.
momentarily empty), the readout shows a plain **—** instead of a stray
result.

Uses the same active rifle, cartridge, and bullet as Trajectory and Hit
Probability (set on **Guns**) and the same zero — no separate battle-zero
override here.

### Locations & Targets

Optional: save a shooting location's targets once — their range and
line-of-sight angle, and, if you attach a photo taken from the shooting
position, where each one is on it — then pick them straight from the Target
tab on later visits instead of dialing range and angle by hand every time.
Wind and atmosphere are never part of a saved target, only range, angle,
and (with a photo) position.

The Target tab's own **Locations & Targets** row shows the active location's
name (nothing, if you're not using one), a dropdown of its targets, and up
to three icons:

- A photo-frame icon, **Pick target from photo** (only shown once the
  active location has a photo attached) — opens that photo full-screen; tap
  any already-placed target's pin to select it immediately, or a chip
  (stacked top-left) for one that hasn't been placed on the photo yet.
  Nothing changes until you tap one.
- A sync icon, **Update this target with the current range/angle** —
  appears once the range/angle currently dialed no longer matches the
  selected target's own saved values (e.g. you nudged range by hand after
  picking it). Updates the saved target to match what's currently dialed.
- **Manage locations** — opens the Locations & Targets library itself
  (below). **Done** there returns you to this tab.

Picking a target (dropdown, photo, or chip) copies its range and angle into
the Target tab as a one-time, free edit, not a live link — you can still
nudge the dialed numbers afterward without touching the saved target (that's
what the sync icon above is for, if you want to keep it in sync).

**Managing locations.** The library screen splits your locations into
**Current location** (whichever one is active, or **No location — single
target, manual entry** if none is) and **Known locations** (everything
else). Tapping a Known location activates it — moves it to Current and
scrolls there — without leaving this screen. Only the current location shows
**Edit** and its target list; every location, current or known, shows
**Backup to file** and **Delete**. **Backup library to file…** / **Load
backup from file…**, at the top, back up or restore the whole library at
once, the same way Arsenal does for rifles and bullets.

A location has a name, an optional altitude (if set, activating the
location fills in the Atmosphere tab with the standard atmosphere at that
altitude and 50% humidity — but only if you haven't already changed
atmosphere values yourself this session), and an optional photo. Its
targets each have a name (optional — defaults to "Target 1", "Target 2",
etc.), notes, range, and line-of-sight angle.

**Placing a target on the photo.** Once a location has a photo, each of its
targets gets a **Place it** button (in its row, and inside its own edit
form) that opens the photo full-screen for that one target: tap or drag to
position its pin, drag empty space to pan, pinch (or the nav bar's own
**Zoom in** / **Zoom out** buttons) to zoom. Every other already-placed
target on the same photo shows as a small dot labeled with its name, range,
and angle, so you can place the new one relative to them. **Clear pin**
removes the placement; **Done** saves it and returns to the library. A
target not yet placed on the photo (on a location that has one) shows a
**Not placed** badge in its row as a reminder.

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

**Built-in libraries.** The app ships with a built-in rifle library and
three built-in bullet libraries — **Geladen's own**, **Lapua Cd**
(radar-measured Cd-Mach curves as published by the vendor), and **Hornady
Reverse Radar** (curves reverse-engineered from Hornady's own 4DOF
calculator output) — shown alongside anything you add yourself (your own
entries are marked with a leading `*`). Each one can be **turned off
individually in Settings** if you don't want it cluttering your pickers;
your own saved entries are unaffected either way.

**Adding and managing entries.** Add a bullet either from scratch (name,
caliber, mass, BC/drag model or a pasted Cd-Mach table) or by copying a
built-in one and adjusting it. Add a rifle with its own sight height, zero
range, and scope click settings, then attach one or more cartridges to it
(each with its own bullet and muzzle velocity). Click a rifle to make it the
"Active rifle" shown at the top, with its own cartridges and an Edit button;
picking one of those cartridges there is what Done applies as the active
configuration used everywhere, once you leave Guns. The manufacturer field
autocompletes from every enabled library plus your own Arsenal.

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
Conversion**, **Multiple BC**, and **BC Labradar** tabs, all fully usable
today.

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

**BC Conversion** converts a ballistic coefficient from one standard drag
model to another at a single reference velocity — enter the source model
and BC, a velocity representative of the range band you care about, and the
destination model; the result updates automatically as any of them
changes, no button to press. The conversion is exact at that one velocity
and drifts the further your bullet's actual velocity strays from it, since
different drag models have differently-shaped curves across the speed
range. Both model pickers always list every standard model, regardless of
which ones Settings shows or hides elsewhere.

**Multiple BC** turns 2–5 manufacturer-published BC values, each valid over
its own speed band, into a bullet-specific Cd-Mach curve — drag the segment
borders directly on the chart, or type them into the table below it. Enter
mass and caliber (both affect the resulting curve, and the optimal BC
values below it, directly — get them right), pick a drag model and speed
unit, and the curve/results table update live as you go. The result can be
saved straight to Arsenal, downloaded/copied as CSV, or read as a single
"optimal compromise" BC per model over the bullet's own supersonic range.

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

**Remember:** garbage in = garbage out. Atmosphere is *very* important. If
you don't know humidity, put 50%. A Kestrel is good enough (although I
wish its thermometer were more precise). "Data pulled through the
Internet from some 'nearest meteo station'" is not good enough. Make
*very* sure you are using absolute pressure (a.k.a. station pressure), and
not some altitude-adjusted one (Kestrel misleadingly uses the term
"barometric pressure" to designate pressure adjusted to mean sea level —
this is *not* the one we want). Typically, if you are measuring 1000+ hPa
at an altitude of 500 m or above (29.5 inHg and 1500 ft for our
metric-impaired friends), it probably means either you are reading the
wrong pressure value (adjusted instead of absolute/station), or perhaps
the End of the World is even closer than expected.

**Remember #2:** Labradar has a setting called "proj. offset"; this
defines the expected distance from the muzzle to the side of the radar.
Respect it (within -5 cm) — this is important! The offset refers to the
distance from the barrel, *not* the distance from the muzzle; keep it in
mind if your muzzle is not level with the radar, but slightly in front
of, or behind, it.

**Remember #3:** one shot = one shit. You need at least 20 (for decent
factory ammo) to even out the errors. Crappy surplus bullets need more
shots (count on at least 30), while with high-quality projectiles 10
shots may be enough. Generally, more is better.

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

## Rifle Precision Calculator

Measures real rifle precision from photos of paper targets — no laser
rangefinder or fancy gear, just a phone photo of a ruler and your bullet
holes. Organizes work as **Projects** (one rifle/load/distance combination)
→ **Targets** (one photo each) → **Groups** (a point of aim and the shots
fired at it) — and pools every usable group across every usable target in a
project into one combined precision report.

**Projects.** A project has a name, the distance to target, and the
caliber — every target and group inside it is assumed shot at that same
distance with that same caliber. **Save to file** / **Save library…** /
**Load library…**, at the top and per-project, back up or restore projects
the same way Arsenal does for rifles and bullets — nothing here ever leaves
your browser.

**Adding a target.** Choose a photo of the target sheet (rotate if needed,
then confirm), which opens straight into marking:

- **Calibrate the scale** — tap two points a known distance apart (a ruler
  laid on the target, or any feature of known length), then type that
  real-world length. **Done calibrating** moves on; **Recalibrate** revisits
  it later without losing the existing points.
- **Point of aim** — tap where this group was aimed at.
- **Mark impacts** — tap each bullet hole; keep tapping to add more. Every
  placed point (calibration, point of aim, impacts) can be dragged to nudge
  it afterward. **Delete an impact** switches to a mode where tapping a
  shot's own number removes it.
- A target sheet can hold several **groups** (e.g. more than one 5-shot
  group printed on the same sheet) — switch between them or start a new one
  from the group selector. Each group's own line shows its shot count and
  **ES** (extreme spread — the distance between its two farthest-apart
  impacts).
- **Save group overview image** downloads a PNG of the currently-active
  group as marked, cropped to whatever you have zoomed/panned to.

A target needs calibration, a point of aim, and at least one impact to be
usable; one missing any of those shows a badge and a hint spelling out
exactly what's left.

**The report** ("View report", once at least one target is usable) pools
every shot from every usable group and target — each shot measured relative
to its own group's point of aim, so groups aimed at different spots on the
sheet still combine correctly — into one set of statistics:

- A **results display units** selector (your own configured unit, mrad, or
  MOA) governs every value in the legend and Numbers table below.
- **Aggregate results** — the pooled scatterplot — and its **Legend** sit
  side by side. Only the impacts themselves, the point of aim, and the
  average point of impact are always drawn; everything else is optional.
- The **Numbers** table lists every statistic (confidence interval, average
  point of impact, standard deviation, R50/R95/R99 — the radius containing
  50/95/99% of impacts — R95's own confidence interval, and ES5x/ES10x, the
  average expected 5- and 10-shot group size) with a **Show on image**
  checkbox per row that adds it to the diagram, legend, and exported image
  alike.
- **Image options** — grid overlay (mrad or MOA spacing), impacts drawn to
  true bore scale, a 1-MOA reference circle, a hit-probability circle driven
  by a slider, a scale bar, and **Save legend with results image** (on by
  default) for the SVG export below.
- The **Confidence-o-meter** rates how much a group this size can actually
  be trusted — few shots and a wide confidence interval land you well below
  the "bullshit threshold"; enough shots and it climbs toward "Awesome."
  It's baked into the SVG export too, replacing the plain confidence-
  interval text.
- **Export CSV** downloads every pooled shot's raw coordinates; the small
  icon next to Aggregate results **exports the diagram as SVG** — with the
  legend and confidence gauge included if that checkbox is on.

Every one of these settings — display units, which numbers show on the
image, grid, image options, slider position — is remembered and restored
the next time you open this report, even after restarting the app.

## Settings

- **Language** — English, Français, Русский, Deutsch, Italiano.
- **Units** — one preferred unit per measurement kind (velocity, wind speed,
  distance, small lengths, altitude, temperature, pressure, angular
  dispersion, energy), mixed metric/imperial freely; applies everywhere
  that measurement appears.
- **Built-in libraries** — show/hide the built-in rifle library and each of
  the three built-in bullet libraries individually (see **Guns** above).
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
- **Spin drift calculation** — how (or whether) horizontal drift caused
  by the bullet's own gyroscopic spin is factored into windage, in
  Trajectory, Range Solver, and Arsenal:
  - **Off** (the default) — windage reflects wind only.
  - **Simple (Litz)** — Bryan Litz's well-established empirical formula.
  - **Advanced (McCoy 4-DOF)** — a full 4-degree-of-freedom physics
    model, built from the bullet's own mass, caliber, length, and twist
    rate.

  Either method falls back automatically (Advanced → Simple → Off) when
  the active bullet is missing the data it needs. **Account for spin
  drift when zeroing**, shown once a method is chosen, shifts the
  rifle's own horizontal aim so its zero already absorbs the drift by
  the zero range — the same thing dialing a scope's windage turret would
  do for you at the range.
- **CSV export** — the field separator (comma/semicolon/tab) and decimal
  separator (dot/comma) used by Trajectory's CSV download and clipboard copy.
  Pick whichever pair your spreadsheet software expects.
