# geladen.ch ballistics User Manual — Printable Range Card

*Part of the* [geladen.ch ballistics suite](https://bc.geladen.ch)*.*

---

## 1. What this tool is for

A range card is a sheet of paper you keep with the rifle: what to dial at each distance, how much wind moves the bullet, and what changes when it is colder or warmer or when you shoot up or down a slope. Paper needs no battery and no signal, and you can read it at a glance in the middle of a string.

The **Printable card** tab of Trajectory makes such a card as a PDF, ready to print. It uses the rifle, cartridge and atmosphere you set up on the **Data** tab and the units you chose in Settings, so the card reads the same way as the rest of the app.

A card covers one rifle with one load, in one set of conditions. It cannot replace the solver in all situations: when the air, the distance or the wind differ a lot from what the card was made for, its numbers are only a starting point. Section 7 explains how far you can trust them.

---

## 2. Quick start

1. Open **Trajectory**. On the **Data** tab, pick the rifle and load and enter the atmosphere you expect where you will shoot.
2. Switch to the **Printable card** tab. The **On the card** box at the top shows the rifle, the cartridge and the reference conditions as the card will print them. If anything there is wrong, fix it on the Data tab or in Guns.
3. Under **Card settings**, choose the paper, the farthest distance and the distance step.
4. Click **Download PDF** and print the file at actual size.

Everything you set on this tab is remembered, also after a restart. The settings are the same for every rifle: they are not saved per rifle.

---

## 3. What the card is solved for

- **Rifle, cartridge and bullet** — the ones selected on the Data tab, from Guns.
- **Zero** — the rifle's own zero range from Guns. The **zero range override** of the Data tab does not apply to the card. If the cartridge was zeroed in other air (a zero atmosphere in Guns), the zero stays in that air.
- **Reference conditions** — the Data tab's atmosphere: altitude, pressure, temperature and humidity. The card prints them on the line above the table.
- **Shot** — level. Slope is handled by its own columns (section 5.6), not by the Data tab's line-of-sight angle.
- **Wind** — the card's own reference crosswind (section 4.4). The Data tab's wind is not used.
- **Corrections** — in the unit Range Solver uses: clicks, mrad or MOA (Settings → **Range solver output**), with the same direction indicators, arrows or **+ / −** (Settings → **Range Solver output indicators**). Clicks use the rifle's click values from Guns.

---

## 4. Card settings

### 4.1 Card

- **Paper** — **A4** or **Letter** print the whole card on one page. **A5** and **Half-letter** split it over two landscape pages: the table on the first, the reticle and the location photo on the second. Print those two on the two sides of one sheet. The paper also sets how many rows the table can hold (section 5.1).
- **Title** — up to 44 characters, printed at the top of the card. Left empty, the card is titled "rifle · cartridge".
- **Date** — printed in the footer and used in the file name. It is today's date until you choose another one.

### 4.2 Distances

- **Max distance** — where the table ends. Choose **Distance** and enter it (1000 m or 1000 yd by default), or **Mach 1.1** or **Mach 1.0** to end the table where the bullet slows down to that speed. Accuracy suffers as a bullet approaches the speed of sound, so this keeps the card inside the range where its numbers hold. In a Mach mode, a note under the field says at which distance the bullet reaches that speed. The card ends at the last row before it.
- **Distance step** — 200, 100, 50 or 25, in your distance unit. The first row is one step out from the muzzle.
- **Refine steps above** — refines the table where the trajectory gets steep. When the elevation to the next distance would change by more than this amount, the step drops to the next finer one (200 → 100 → 50 → 25). Once it is finer, it does not get coarser again. The value is in the correction unit (clicks, mrad or MOA). 0 turns refining off.

A typical setting: step 100 m, refine above about 16 clicks (anything from 10 to 20 works). The near part of the table stays short, and the far part, where a small range error costs the most, gets rows every 50 or 25 m.

### 4.3 Status line

Under the settings, a line counts the rows: "24 of 37 rows". If the distances and the targets need more rows than the paper holds, a warning gives the farthest distance that still fits and how many rows are left out. Use a coarser step, a higher refining threshold, a shorter max distance or larger paper to bring them back.

### 4.4 Wind

**Crosswind** is the wind the **Wind** column is solved for: its full value, blowing from the right. The card prints the windage without its direction: hold or dial into the wind.

Choose a wind that is easy to scale in your head. Section 6.3 shows how.

### 4.5 Temperature

**Temperature corrections** (on by default) adds five columns. Each one gives the change in elevation from the reference conditions when the air **and the powder** are at that temperature.

- The muzzle velocity changes with the cartridge's velocity change per degree from Guns. Without one, only the air changes.
- The zero stays where it was set. The column shows how far the impact moves when the day is colder or warmer than the card's reference. It does not assume that you zeroed again on that day.
- By default the columns are centred on the reference temperature, 5 °C (10 °F) apart. The middle column is the reference temperature itself and is all zeros. Change the **first temperature** or the **step** to choose another scale. A line under the fields lists the columns. **Use defaults** returns to the centred scale.

### 4.6 Include

- **Spin drift column** — the drift caused by the bullet's spin at each distance, in still air, with its direction. It is offered only when spin drift is switched on in Settings and the app knows enough to compute it: the rifle's twist and the bullet's length and diameter. The Wind column never includes spin drift.
- **Slope corrections (10° to 30°)** — five columns, for shooting at 10, 15, 20, 25 and 30° up or down. See section 5.6.

**Location.** The card can use the active location of Range Solver (see Locations & Targets in the main manual). The name of the location is shown here. If there is no active location, **Open Locations** takes you there.

- **Target rows** — one row in the table for each of the location's targets, solved at its own distance and line-of-sight angle (section 5.5).
- **Location photo with targets** — the location's photo, with each target marked on it. If the location has no photo, a note says so and the card leaves it out.

**Reticle.** If the rifle has a scope with a reticle in the Arsenal, **Reticle and BDC** prints that reticle on the card, with its BDC (Bullet Drop Compensation) marks if it has any. A scope view appears under the checkbox. It works like the one in Range Solver, and what it shows is what the card prints:

- The **zoom ring** sets the magnification, and **zoom to reticle** enlarges a fixed scope's view.
- **BDC range labels** label each BDC mark with the range it holds for, under the card's reference conditions, in still air and on the level.
- **Wind holds** mark a hold for every quarter of the card's crosswind, up to one and a half times it, from either side. The full crosswind is the larger mark.

There is no aiming mark on the card. The zoom and the two overlay buttons are the card's own: changing them here does not change Range Solver's scope view, and the other way round. The reticle prints in black, the overlays in grey.

The reticle on paper is a picture of the reticle, not a scale drawing. Do not measure a hold on it with a ruler.

---

## 5. Reading the card

### 5.1 Layout

- **Header** — the app's name and the card's title.
- **Rifle** — the rifle's name, zero range, sight height, and the scope's click value, vertical · horizontal.
- **Cartridge** — the load's name, the bullet with its mass, the muzzle velocity with its change per degree, and the ballistic coefficient with its drag model (or "custom Cd curve").
- **Corrections** — the heading names the correction unit. The reference conditions are on the same line, on the right: altitude, pressure, temperature, humidity.
- **The table** — sections 5.2 to 5.6.
- **Reticle** and **Targets** — the reticle and the location photo. When you leave one of them out, the card puts a ruled **Notes** box in its place.
- **Footer** — the app's address, the app version and the card's date. If two cards disagree, these tell you which is newer and which version of the app made it.

A4 and Letter hold up to 37 rows, A5 and Half-letter up to 26. With few rows, each row is tall: the distance above, the elevation below, in large print. With many rows they print on one line each. If a value is too wide for its column, the whole table's text gets a little smaller, so the columns stay lined up.

### 5.2 Distance and elevation

The bold **Distance** column lists the reference distances, from one step out to the max distance. Under each distance, or beside it on a dense card, is the elevation to dial from the zero, with its direction.

### 5.3 Shorter and longer

Two columns on each side of the reference distance give the elevation for nearby distances. These are for a target that lies between two rows. How far out they are depends on the step in effect for that row:

| Step | Shorter | Longer |
| --- | --- | --- |
| 200 | −100, −50 | +50, +100 |
| 100 | −50, −25 | +25, +50 |
| 50 | −20, −10 | +10, +20 |
| 25 | −10, −5 | +5, +10 |

A neighbour at or before the muzzle is left blank. Each cell shows its distance in small grey figures and the elevation below or beside it.

Example, at a 100 m step: the target is at 640 m. Find the 600 m row and read the **+50** cell, which is 650 m. That is closer than 600 m or 700 m, and closer than adding up two rows by eye.

### 5.4 Wind and spin drift

**Wind** is the windage for the card's crosswind (printed in the column heading), as a size without direction: correct into the wind. **Spin** is the spin drift in still air, with its direction. It does not depend on the wind, so add it on top.

### 5.5 Target rows

Each target of the active location is a grey row, sorted in with the reference distances by distance. A black badge gives its label (T1, T2 … from the nearest), and its line-of-sight angle is printed next to it, + uphill. The elevation already includes that angle: dial it as it is and do not add a slope correction. Wind and spin drift are as for the other rows. A target row has no shorter and longer cells. A target beyond the max distance is left out. The location photo, if you included it, shows where each label is.

### 5.6 Slope corrections

For a shot up or down a slope, the bullet drops less across the line of sight than on the level, and the shot needs less elevation. Each slope column gives the change to add to the level elevation at that distance, for that angle. The value is the same, within a hair, whether you shoot up or down, so one column covers both: the card prints the mean of the two.

Example: 500 m, 20° down. Take the elevation in the 500 m row and add the value in the **20** column (usually a small correction down).

Use the column nearest to the angle you measured, or the target row if the target is in the location.

### 5.7 Temperature corrections

Each column is headed with its temperature. Add the value in the column nearest the day's temperature to the elevation of the row. The column at the card's reference temperature is all zeros. Colder air and colder powder mean a slower, more strongly braked bullet, so the corrections on the cold side go up and those on the warm side go down.

---

## 6. Using the card on the range

### 6.1 Before you print

- Enter the atmosphere you expect at the place and season where you will shoot. A card made for 400 m altitude is noticeably wrong at 1800 m. If you shoot in very different places, print a card for each.
- Check the **On the card** box: name, zero, sight height, click value, muzzle velocity and BC. The card is no better than these.
- Use the muzzle velocity you have measured, with its temperature, and the velocity change per degree, if you know it. The temperature columns depend on it.

### 6.2 Printing

Print at actual size, not "fit to page". Use paper that survives the field, or put the card in a sleeve or laminate it. For A5 and Half-letter, print the two pages on the two sides of one sheet: the table on one side, the reticle and the photo on the other.

### 6.3 Scaling the wind

Windage grows nearly in proportion to the crosswind. If the card is made for 4 m/s and the wind is 2 m/s, take half the value. At 6 m/s, take one and a half times it. For a wind that is not straight across, use only its crosswind part: half the speed at 30° off the line of fire, about 0.7 of it at 45°, and about 0.9 at 60°. A round reference crosswind makes this arithmetic easy. With **Wind holds** on, the reticle on the card shows the same quarters of the crosswind as holds.

### 6.4 Putting it together

For one shot: the elevation in the row (or a shorter/longer cell), plus the temperature correction, plus the slope correction if the target is above or below you. Then the windage, scaled to the wind, plus the spin drift.

---

## 7. How far to trust the card

- **Pressure and altitude** — the temperature columns change only the temperature. If the pressure on the day differs a lot from the card's reference, the elevations far out are off. Use a solver, or print a card for those conditions.
- **Corrections add up only approximately** — each column is computed on its own, relative to the reference conditions. Adding a slope and a temperature correction is a very good approximation at normal distances and angles, but not exact.
- **Near the speed of sound** — the card's numbers get less certain as the bullet slows down towards Mach 1. Ending the table at **Mach 1.1** keeps it on the safe side.
- **The inputs** — the card repeats your setup. A wrong muzzle velocity, BC, sight height or click value gives a neat card with wrong numbers. Check the card on the range at a few distances before you rely on it, and print a new one after a change of load, zero or scope.

---

## 8. File and privacy

The PDF is made in your browser and saved to your device. Nothing is uploaded. The file is named after the card and its date, for example "Range card - Tikka T3x - 6.5 Creedmoor 140 ELD-M - 2026-11-09.pdf".
