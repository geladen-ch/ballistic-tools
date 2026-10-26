Reticle Designer digit outlines

`digit-glyphs.js` holds the digits 0–9 of five fonts as SVG path outlines,
for the Reticle Designer's number element:

- B612 Regular (v1.008) — https://github.com/polarsys/b612
- Barlow Light and Regular (v1.408) — https://github.com/jpt/barlow
- Overpass Light and Regular (v4.000, instances of the variable font at
  weights 300 and 400) — https://github.com/RedHatOfficial/Overpass

All three families are licensed under the SIL Open Font License 1.1 (see
LICENSE-B612.txt, LICENSE-Barlow.txt and LICENSE-Overpass.txt in this
directory); none declares a Reserved Font Name. The OFL permits using and
redistributing the fonts, modified or not, with any software (including
this AGPL app) as long as the licence travels with them; it is
GPL-compatible.

How it was made: the font files were taken from the Google Fonts
repository (github.com/google/fonts, ofl/b612, ofl/barlow, ofl/overpass)
and the digits exported once with fontTools — scaled so the figure height
(the top of the 7) is 1, baseline at 0, y flipped to point down, path data
rounded to 3 decimals. No font file and no font parser is shipped or
loaded at runtime; the table is the only thing the app reads. To add or
change a font, re-run the same export over the new font files and replace
the table (the font picker lists every entry automatically).
