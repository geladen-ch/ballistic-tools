PDF font faces

The fonts PDF templates can use (see tools/pdf-templates/README.md for the rules and the build procedure). `faces.js` registers each face under family + weight + style; the `.ttf` files are generated from the upstream fonts below by the offline font build and are not edited by hand.

- Overpass Regular (400) and Bold (700): static instances at wght 400 and 700 of the variable font `Overpass[wght].ttf`, version 4.000, from the Google Fonts repository (github.com/google/fonts, ofl/overpass); upstream https://github.com/RedHatOfficial/Overpass. All characters kept (Latin, Cyrillic and more).

Modifications made by the build to every font: static instancing where the source is variable; removal of the OpenType layout tables (GSUB, GPOS, GDEF, kern and the like) and of DSIG; name table, OS/2 weight/selection bits and head.macStyle set to the registered family, weight and style. Optionally, restriction to chosen character sets (not applied to any font shipped so far).

License: SIL Open Font License 1.1 (see OFL-Overpass.txt in this directory). Overpass declares no Reserved Font Name, so the modified fonts keep their name. The OFL permits using, modifying and redistributing the fonts with any software (including this AGPL app) as long as the licence travels with them, and embedding them in documents; it is GPL-compatible.
