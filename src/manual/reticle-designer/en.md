# geladen.ch ballistics User Manual — Reticle Designer

*Part of the* [geladen.ch ballistics suite](https://bc.geladen.ch)*. Under Utilities. Draws the reticles built into your scopes in the Arsenal, and that Range Solver's scope view shows.*

---

## 1. What this tool is for

Range Solver can show you your hold on the reticle you actually look through, but only if it knows that reticle: where every hash, dot, bar and number sits. The Reticle Designer is where you tell it. You draw the reticle once, from the manufacturer's data sheet, save it to the Arsenal, list it on the scope it comes in, and put that scope on a rifle. From then on Range Solver's scope view draws your hold on that reticle, labels its BDC marks with the ranges they hold for today, with your cartridge, and puts the wind holds where your eye will look for them.

The app comes with a set of built-in reticles. If yours is among them, you may need this tool only to make a variant of it.

### What it is not

It is not a drawing program. Every element is a reticle feature with a position and dimensions in angle, typed or dragged, and every position is measured from the reticle centre. There is no freehand drawing, no colour and no text other than digits. A drawing you already have can come in as an SVG shape (§12), but it is then one element you place and scale as a whole.

It does not know how your particular scope behaves. A reticle is drawn for a *reference scope* — only its type and magnification (§5). The real scope it ends up in, defined in the Arsenal, brings its own field of view, zoom range and, for a second focal plane scope, the magnification its subtensions are true at.

---

## 2. Where your work lives

**A reticle is kept by saving it to the Arsenal.** Until then it lives in the app's memory only: it survives switching to another tool and back, with its undo history, but not a reload, closing the app or a restart. The file bar says *"Not saved to the Arsenal"* while there is anything unsaved, and the browser asks before you reload or close the page with unsaved changes.

Saved reticles sit in the Arsenal's **Scopes** tab, under **Your Reticles**, stored on this device only, and are backed up and synced with the rest of the Arsenal (see the [Arsenal manual](#/manual/arsenal), §5.9 and §8). A reticle with an imported SVG drawing can be large — megabytes — and that size goes into every backup file and every sync; the Scopes tab shows how much space each reticle takes.

Nothing you draw ever leaves your device, apart from the files you save and the sync folder you set up yourself.

---

## 3. Quick start

1. Open the Arsenal's **Scopes** tab and press **+ Add Reticle**, or open **Reticle Designer** from Utilities.
2. Under **Scope**, set the scope type and magnification the reticle is made for, as the data sheet gives them.
3. In **Options**, pick **mrad** or **MOA** — the unit the data sheet uses.
4. Pick **Vertical line** in the elements palette and drag from the centre to the bottom of the field; do the same with **Horizontal line** to one side and tick **Mirror horizontally** in its settings.
5. Add a short vertical line for one hash mark below the centre, tick **Repeat**, and set the direction, number and step.
6. Type the manufacturer and model in the file bar and press **Save to arsenal**.
7. In the Arsenal, list the reticle on its scope (**Edit** the scope, tick the reticle), and choose that scope for your rifle.

---

## 4. The screen

From top to bottom:

- **The file bar** — the reticle's **Manufacturer** and **Model** (both needed to save; the manufacturer suggests scope and reticle makers the app knows), an optional **Source / notes** field for where the subtensions came from, and the buttons **New reticle**, **Save to arsenal**, **Discard changes** and **Insert whole reticle…** (§14, §15).
- **Scope** — the reference scope the reticle is drawn for, and its illumination (§5).
- **The workspace**, in five panes: **Options** (§6), **Elements** — the palette and the Group, Ungroup, Duplicate and Delete buttons (§8, §10), the **Reticle view** (§7), **Settings** of whatever is selected, and **Elements in the reticle**, the list of everything drawn.

Every change to the reticle — an element placed, moved or edited, the scope, the illumination, the manufacturer, model and notes — is a step you can undo. A whole drag, a run of typing in one field, or one press of an arrow key is one step. The last 1000 steps are kept.

---

## 5. The reference scope

The **Scope** section sets what the reticle is drawn for:

- **Scope type** — **Fixed magnification**, **Variable, first focal plane** (FFP) or **Variable, second focal plane** (SFP).
- **Magnification** — one figure for a fixed scope; **Zoom from** and **to** for a variable one.
- **Subtensions true at** — SFP only: the magnification at which the reticle's marks are worth what the data sheet says. It must lie within the zoom range.

**The field of view is not entered.** It is assumed from the magnification — 12 m at 100 m at 3×, narrowing in proportion as the magnification rises — only so the view can draw the field the reticle sits in. It does not need to match the real scope; the real figures come from the scope in the Arsenal.

If the reticle is to be used in first focal plane scopes of different magnifications, set the reference scope's lowest magnification to the lowest real one: that way "endless" elements running out to the edge, such as the side posts, really do reach the edge at the widest field of view.

An SFP reticle is drawn at its calibration zoom, so the view shows the field at that magnification.

**Illumination.** Tick **Reticle is illuminated** and pick **Red**, **Amber** or **Green** for a lit reticle; each element then says whether it is lit (§8). Range Solver uses this to keep its own overlay readable: on a reticle lit red or amber, it draws in blue.

---

## 6. Options

The **Options** pane changes how you work, not the reticle; none of these is an undo step.

- **mrad / MOA** — the unit every angle is shown and typed in. It is the tool's own, independent of the units you prefer elsewhere in the app, because a reticle is specified in the unit of its subtensions whatever you dial with. Switching it changes nothing in the reticle: every position and dimension is held as an angle, and only its display changes.
- **Grid (1 mrad)** / **Grid (1 MOA)** — a guide grid, every fifth line stronger. Zoomed out far, it thins itself to every fifth line, then every 25th, and so on.
- **Snap to 0.1 mrad** / **Snap to 0.25 MOA** — places and moves land on multiples of that step, counted from the centre. The arrow keys move by the same step (§16).
- **Show zero** — the red cross in a circle marking the reticle centre. It is not part of the reticle.
- **Show BDC marks** — the blue markers for BDC marks (§13). Placing a mark shows them again.
- **Show illumination** and **Dim the field** — on an illuminated reticle only: draw the lit elements in their colour, and darken the field as in low light.

---

## 7. The reticle view

The view shows the reticle as you would see it: black on a light field, inside a circle for the field of view, everything outside it dark. x is positive to the right and y positive *down*, both measured from the centre, so a hash 2 mrad below the centre has y = 2.

**Placing.** Pick an element in the palette — it stays highlighted until you place one — then click in the view to place it there, or drag the icon straight into the view. Lines and thinning bars are drawn by press and drag, from one end to the other. A plain click gives a line 1 mrad (4 MOA) long, pointing away from the centre, and a thinning bar running out to the edge of the field. After placing, the tool returns to the selection arrow, and the new element is selected.

**Selecting.** With the arrow, click an element to select it; click a mirrored or repeated copy and you select the element it belongs to. Shift-, Ctrl- or Cmd-click adds an element to the selection or takes it out. Shift-, Ctrl- or Cmd-drag on empty field draws a rectangle that adds every element whose own shape lies wholly inside it (its copies don't count; a group only when all of it is inside). Clicking an element of a group selects the group. The list pane selects too, and selecting a member's row there selects that member alone.

**Moving.** Drag a selected element, group or selection to move it. A single selected line or thinning bar shows a handle at each end, to drag one end at a time. While you drag, the coordinates show next to the pointer — at normal zoom a snap step is smaller than a pixel, so this readout is where you see snapping work.

**Zooming and panning.** The mouse wheel, a pinch, or the **+** and **−** buttons zoom; drag on empty field (or drag with the middle button) to pan. **Reset view** goes back to the whole field, centred, at the lowest magnification.

**Magnification.** For a variable scope, the **Magnification** slider above the view previews the zoom ring. On an FFP scope the field narrows as you zoom in, and the reticle grows with the picture, as it does in the scope. On an SFP scope the picture doesn't change; a note shows what the subtensions are worth at that magnification, e.g. *"Subtensions here: ×0.5 of nominal"*. The **Undo** and **Redo** icons sit left of it.

---

## 8. Elements

| Element | Placed by | Settings | A new one (mrad / MOA) |
|---|---|---|---|
| Horizontal line, vertical line | Its start, and its end along the line | Width | 0.05 / 0.15 wide |
| Dot | Its centre | Diameter | 0.05 / 0.15 |
| Horizontal and vertical thinning bar | Its start (the thin end), and its end | Nominal width, end width, thinning length | 0.5 / 1.5 wide, 0.25 / 0.75 at the end, thinning over 2 / 7 |
| Circle | Its centre | Outer diameter, inner diameter | 2 / 6 outside, 1.8 / 5.4 inside |
| Horseshoe | Its centre | Outer and inner diameter, bottom cutout angle | as the circle, 60° cut out |
| Chevron | Its apex | Line width, overall width, height | 0.5 / 1.5 lines in a 1 / 3.5 square |
| Number | Its anchor | Digits, digit height, anchor, font | 0.5 / 1.5 high |
| SVG shape | The drawing's own origin | Scale, width, height, reflect | 5 / 15 on its longer side |
| BDC mark | Its height on the vertical axis | — | — |

Every element's position and dimensions are set in its **Settings**; a value that would make it impossible (an inner diameter larger than the outer, say) is refused with a note and not applied. A new line or dot takes the width or diameter you last typed for either, a new number the font, height and anchor you last chose, and a new element the lit setting you last gave one.

- **Lines** are plain segments of constant width; either end can go anywhere.
- **Thinning bars** are the heavy posts at the edge of many reticles: thin where they start, widening over the thinning length to their nominal width, then running at that width to their end. The thin end always faces the centre. The end can never be closer to the centre than the start, and a bar moved along its own axis stops when its start reaches the centre. A thinning bar doesn't have to thin: with its end width equal to its nominal width, or a thinning length of 0, it is a plain bar of constant width. Use one for any heavy bar in a reticle, not only the tapered posts.
- **A circle** is a ring between its two diameters; an inner diameter of 0 gives a filled disc.
- **A horseshoe** is a ring with a gap at the bottom, the cutout angle wide.
- **A chevron** points up, its apex at its position; its two arms run to the bottom corners of its overall width and height.
- **Numbers** and **SVG shapes** have their own sections (§11, §12).
- **BDC marks** are not drawn at all (§13).

**Lit elements.** On an illuminated reticle each visible element has an **Illuminated** box: lit ones are drawn in the illumination colour while **Show illumination** is on. The list marks them *illuminated*.

---

## 9. Mirror and repeat

Most reticles are symmetrical and regular, so you draw a feature once and let the tool copy it.

**Mirror horizontally** adds a copy reflected about the vertical axis: a hash at x = 2 gets its twin at x = −2. A number's digits are not reflected (they still read the right way), but its anchor is, so a number ending at x = 2 starts at x = −2.

**Repeat** adds copies in a row: a **Direction** (up, down, left or right), a **Number** of copies (besides the element itself, up to 500) and a **Step** between them. Ten hashes down the vertical stadia, one every 1 mrad, are one short line with Repeat set to *down, 9, 1 mrad*.

The two combine: repeats are made first, then every one of them is mirrored. Copies are not elements of their own — they follow the element, and clicking one selects it. The list marks an element *mirrored* or *repeated ×n*. Switching Repeat on gives the direction, number and step you last entered.

---

## 10. Groups, several at once, duplicate, delete

**Several elements at once.** With more than one element selected, the Settings pane shows the position of the whole selection (the average of their positions) and every setting they all have: a width when they are all lines, Mirror and Repeat unless a BDC mark is among them, and so on. Changing one changes it on all of them, as one undo step; a field where they differ reads *mixed* until you set it.

**Group** ties the selected elements (two or more) into one group, which then selects, moves and edits as one. Groups don't nest: grouping elements of an existing group with others makes one new group of them all. **Ungroup** dissolves the selected group. A group left with one element is dissolved by itself.

**Duplicate** copies the selection 1 mrad (or 1 MOA) right and down, and selects the copy; a whole group's copy is a group of its own. **Delete** (or the Delete or Backspace key) removes it.

---

## 11. Numbers

A number is a row of digits, 0–9 only, up to 12 of them — reticles label their hashes with nothing else. Its **Digit height** is the height of a digit; its **Anchor** is the point its position refers to: its **Left end**, **Centre** or **Right end**, at the middle of the digits' height. A label to the right of a hash is easiest anchored by its left end, so it keeps its distance whatever its number of digits.

Five fonts are offered: **B612** Regular (the default, designed for cockpit displays), **Barlow** Light and Regular, and **Overpass** Light and Regular. All are under the SIL Open Font License; the digits are built into the app as outlines, so no font is loaded.

---

## 12. SVG shapes

For anything the elements can't draw — a manufacturer's logo-shaped aiming mark, an odd ring, a ranging scale — import an SVG drawing. Press **SVG shape** in the palette, then choose a file or paste the code and press **Read pasted code**. A preview shows what will go in; **Insert into the reticle** adds it.

Only the shapes are kept. Every visible fill and stroke becomes reticle ink, whatever its colour, with the stroke widths of the file. Clipping and masks are ignored (the shapes are drawn whole), dashed strokes are drawn solid, and line markers and embedded images are left out; the preview says so when that happens. Text must be converted to paths first (in Inkscape: Path → Object to Path).

The drawing goes in with the SVG's own origin at the reticle centre, scaled so its longer side is 5 mrad (15 MOA). Set its real size in its settings, three ways that all edit the same scale: **1 SVG unit =** an angle, or the drawing's **Width** or **Height**. **Reflect the shape when mirrored** decides whether a mirrored copy is a reflection or the same drawing moved across.

While loading, the file is checked for overcomplicated or malicious content, and refused if it is over 2 MB, has more than 5000 elements, is nested more than 32 levels deep, has more than 100,000 path segments or 1000 reused copies, uses lengths in units other than plain user units or px, contains a DOCTYPE, or takes too long to read. A large drawing makes a large reticle (§2): simplify it in the drawing program before importing it if you can.

---

## 13. BDC marks

A BDC (Bullet Drop Compensation) mark is an aim point for a distance other than the zero: the hash, dot or chevron below the centre you are meant to aim with at 300, 400, 500 m. In the Designer, the feature you see is drawn with the elements above; the BDC mark is a separate, invisible point that gives the angle of that hold. It sits on the vertical axis — only its height is set — and is never mirrored, repeated or lit. The view shows it as a blue marker, hidden with **Show BDC marks**.

Range Solver's scope view works out, for the current conditions, which range each BDC mark holds for, and labels it (see **Scope view** in the [main manual](#/manual)). Put one mark on every level the reticle means to be held on, at the height the data sheet gives it.

---

## 14. Inserting a whole reticle

**Insert whole reticle…** in the file bar copies another reticle — one of yours or a built-in one — into the one you are editing: every element, where it is in the original, with its groups and lit flags. Nothing is converted: every subtension goes in as it was drawn, even if the original was drawn for another type of scope or calibration zoom (the panel says so). If your reticle isn't illuminated and the original is, it takes the original's illumination; if yours has no manufacturer or model yet, it takes the original's.

The inserted elements arrive selected, as one undo step, so you can move them together or delete them again at once. Inserting into an empty reticle is the quick way to start a variant: open a new reticle, insert the one it differs from, change what differs, and save it under its own model name.

---

## 15. Saving, discarding, starting over

- **Save to arsenal** stores the reticle in the Arsenal and keeps you in the Designer, with a short *"Saved to the Arsenal."* A reticle opened from the Arsenal is saved over itself; a new one becomes a new Arsenal reticle. Manufacturer and model together are its name: if another of your reticles already has that name, you are asked whether to replace it. While nothing is unsaved, the button reads **Return to arsenal** and takes you to the Scopes tab.
- **Discard changes** goes back to the reticle as last saved (or to an empty one if it never was), after asking, and its undo history goes with it. A reticle opened from the Arsenal then returns you there. The button is off while there is nothing to discard.
- **New reticle** starts an empty one, after asking if the current one has unsaved changes. Your options, and the defaults remembered for new elements, stay as they are.

A reticle can be saved to a file from the Arsenal, alone or with everything else (see the [Arsenal manual](#/manual/arsenal), §8).

---

## 16. Keyboard

| Key | Does |
|---|---|
| Ctrl+Z / Cmd+Z | Undo |
| Ctrl+Shift+Z, Ctrl+Y / Cmd+Shift+Z | Redo |
| Arrow keys | Move the selection by one snap step (0.1 mrad or 0.25 MOA) |
| Shift + arrow keys | Move it by ten steps |
| Delete, Backspace | Delete the selection |
| Escape | Put down the element picked in the palette; if none, clear the selection |
| Enter, Space (in the list) | Select the focused row |

None of these act while you are typing in a field.

---

## 17. Putting it to work

### 17.1 Drawing from a data sheet

Vendor data sheets usually give a drawing and a table of dimensions. Where the two disagree, trust the table: the drawing is an illustration, the table is the specification. Read every dimension in the unit of the sheet, set the Designer to that unit, and type the values rather than dragging them into place. Fill **Source / notes** with the sheet's name and date, so you know later where the numbers came from.

### 17.2 A typical hash-mark reticle

1. A **Vertical line** from the top of the field to the bottom and a **Horizontal line** from side to side, at the stadia width.
2. A short **Horizontal line** for the first hash below the centre, at 1 mrad; tick **Repeat**, direction *down*, the number of hashes less one, step 1 mrad.
3. A shorter one for the half-mrad hash at 0.5 mrad, repeated the same way.
4. The same for the horizontal stadia, using a short **Vertical line**, **Repeat** to the right, and **Mirror horizontally** for the left side.
5. **Numbers** beside every second or fifth hash, anchored by their left end, mirrored where the sheet numbers both sides.
6. **Horizontal** and **vertical thinning bars** out to the edge of the field, starting where the sheet says the posts start; mirror the horizontal one.

### 17.3 A BDC reticle

Draw the visible features first — hashes, dots or chevrons, with their numbers if any. Then place one **BDC mark** on each compensation level the sheet gives, typing its height in **Mark y**. Save, list it on its scope in the Arsenal, put the scope on your rifle, and look at it in Range Solver's scope view with the BDC range labels on: each mark shows the range matching the drop of your particular bullet, in your particular cartridge, in today's particular air.

---

## 18. Limits

- At most 500 repeated copies per element, and at most 12 digits per number.
- No position or dimension beyond half a turn.
- SVG shapes: the limits in §12.
- The undo history keeps the last 1000 steps, and starts over on a new reticle, on opening another one, on Discard changes, and on a reload.
- The field of view drawn is an assumption (§5), not your scope's.
