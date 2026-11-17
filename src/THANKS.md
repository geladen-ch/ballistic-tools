# Thanks / Danke / Merci / Grazie / Спасибо

This is where geladen.ch says thanks — to contributors, testers, bug
reporters, and everyone else who helped shape this suite.

---

**Николаю Гехту** [https://github.com/nikolaygekht](https://github.com/nikolaygekht) за то, с чего много лет назад началась эта считалка -- перевод на жабаскипт древнего опенсурсного движка от JBM. От старого движка уже давно ничего не осталось, но то, чем считалка стала за эти годы, тоже во многом произошло с участием Николая -- обмен идеями, кодом, предложениями и улучшениями продолжался, продолжается и, надеюсь, будет продолжаться.

**Дмитрию Майорову** [https://github.com/externalmemory](https://github.com/externalmemory) за ценнейшие и продуктивнейшие обсуждения всевозможных аспектов матмоделирования стрелковки, статистических и не только, ещё с тех стародавних времён, когда жыжа была жывой (и не хостилась на лубянке), вопросом, волновавшим современную молодёжь, была стрельба под углом, а Тарань была даже не в бете. Отдельный поклон за снайперские пулреквесты.

**Stéphane Eggertswyler** (LDM, [https://ldmsuisse.ch/](https://ldmsuisse.ch/)) pour ses tests approfondis, son regard critique sur les versions initiales du logiciel, et ses retours constructifs qui ont beaucoup servi à cerner les fonctionnalités manquantes et à rendre l'interface plus accessible.

**Юрию Данилову** за ценнейшие в моём случае "ты голову не морочь, пальцем покажи", сказанные в нужный момент и по делу, вследствие чего юзер-интерфейс был немало перепилен в лучшую сторону.

**Thomas** (Red Oak Arms, [https://www.redoakarms.com/balcalc/](https://www.redoakarms.com/balcalc/)) for the extremely generous permission to use the wealth of information he compiled on many thousands of different projectiles from a huge number of sources.

## Original Labrabaco (now known as Labrabaco NG)

- **entoptics** @ longrangehunting.com forums, who has contributed multiple high-quality datasets and data processing ideas, to design, test and fine-tune the algorithms. 

## Original Taran (now known as Rifle Precision Calculator tool) i18n
(fully reused in this new version)

- **Molon Labe** @ FL: Traduction du Manuel Utilisateur en français
- **Alexander Birtschenko** (abirtschenko): Übersetzung ins Deutsche
- **Pompeo Lattanzi** (britishlanguagecorner.it): traduzione italiana

---

## Bug reports, feature requests, moral support

- 6.5SH @ sh forums, for thorough testing, valuable bug reports, and meaningful feature proposals (check the release history for credits)
- JerkyFreak @ sh forums, for reticle overlay ideas and testing
- and all the SH crowd: Edsel, ForgeValley, ma smith, lash, Snuby642

---

## Sources in English

This app's ballistics calculations draw on published work by:

- **Robert L. McCoy**, *Modern Exterior Ballistics*, 2nd ed., Schiffer
  Publishing (2012) — the Modified Point-Mass (4-DOF) trajectory model
  behind spin drift's Advanced mode (Settings → Spin drift calculation).
- **Bryan Litz**, *Applied Ballistics for Long-Range Shooting*, 3rd ed., Applied Ballistics, LLC (2015) — the empirical spin-drift formula behind Simple mode.
- **Don Miller** — the twist-rate stability formula (Miller's Twist Rule)
  used throughout the app.

## Источники на русском языке

- **Дмитриевский А. А., Лысенко Л. Н.**, *Внешняя баллистика*, 4-е издание, перераб. и доп., Машиностроение (2005)
- **Коновалов А. А., Николаев Ю. В.**, *Внешняя баллистика*, ЦНИИ информации (1979)
- **Шерешевский М. С., Гонтарев А. Н., Минаев Ю. В.**, *Эффективность стрельбы из автоматического оружия*, ЦНИИ информации (1979)

## Inspiration for the Rifle Precision calculator tool

- The Ballistipedia guys (**David Bookstaber**, **Charles McMillan**, and **Daniel Wollschlaeger**): [http://ballistipedia.com/](http://ballistipedia.com/)
- **Louis Stange**'s "Group Size, AMR, CEP, and Hit Probability" Monte Carlo simulation: [https://github.com/lstange/mcgs](https://github.com/lstange/mcgs)
- All the excellent sources listed on the **Ballistipedia's prior art** page: [http://ballistipedia.com/index.php?title=Prior_Art](http://ballistipedia.com/index.php?title=Prior_Art)

---

## Third-party libraries

Thanks to the authors and contributors of the third-party libraries this
app is built on, for writing efficient, lean, and straight-to-the-point
software:

- [Gion Kunz](https://github.com/gionkunz) and contributors —
  [Chartist](https://gionkunz.github.io/chartist-js/)
- [Arjun Barrett](https://github.com/101arrowz) and contributors —
  [fflate](https://github.com/101arrowz/fflate)
- [The i18next team](https://github.com/i18next) contributors —
  [i18next](https://www.i18next.com/)
- Kevin C. Olbrich and contributors —
  [js-quantities](https://github.com/gentooboontoo/js-quantities)
- James Hall, yWorks and contributors —
  [jsPDF](https://github.com/parallax/jsPDF)
- yWorks and contributors —
  [svg2pdf.js](https://github.com/yWorks/svg2pdf.js)
- [Ron Kok](https://github.com/ronkok) and contributors —
  [Temml](https://temml.org/)

## Weather data

The optional online weather feature uses open data.

- METAR, SYNOP and US road-weather and HADS (RAWS, SNOTEL) reports: [Iowa Environmental Mesonet](https://mesonet.agron.iastate.edu/), Iowa State University. Deep thanks to daryl herzmann of Iowa State University, who runs the Iowa Environmental Mesonet and gives away decades of weather observations for free. In his words, he is the one "bus" away from the whole thing going dark, so please wish him a long, bus-free life.
- Source: [MeteoSwiss](https://opendatadocs.meteoswiss.ch/general/terms-of-use) (Swiss stations; Federal Office of Meteorology and Climatology, open data, CC BY 4.0).
- Datenquelle: [GeoSphere Austria](https://data.hub.geosphere.at/dataset/tawes-v1-10min) - https://data.hub.geosphere.at (Austrian stations; CC BY 4.0; raw 10-minute values).
- German stations: [Deutscher Wetterdienst (DWD)](https://www.dwd.de/EN/ourservices/opendata/opendata.html), licence [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), retrieved via [Bright Sky](https://brightsky.dev/) (by Jakob de Maeyer, open source, MIT licence). Values are converted to your altitude and combined with other stations. Data basis: Deutscher Wetterdienst, averaged over individual values (Datenbasis: Deutscher Wetterdienst, Einzelwerte gemittelt).
- Stations in Denmark, Greenland and the Faroe Islands: [Danish Meteorological Institute (DMI)](https://www.dmi.dk/friedata/dokumentation/terms-of-use), licence [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); raw observations, converted to your altitude and combined with other stations.
- Canadian stations: Data Source: Environment and Climate Change Canada, NAV CANADA and partner networks (provincial and other agencies, named in each station report). Contains information licenced under the [Data Server End-use Licence](https://eccc-msc.github.io/open-data/licence/readme_en/) of Environment and Climate Change Canada.
- Heights above sea level from GPS are corrected with a compact spherical-harmonic fit of the EGM2008 geoid (US National Geospatial-Intelligence Agency), whose published grid is distributed through the PROJ project.

## Fonts

The Reticle Designer's numbers are drawn from the digits of these fonts,
all under the SIL Open Font License 1.1:

- The B612 Project Authors (Airbus, Intactile Design) —
  [B612](https://github.com/polarsys/b612)
- Jeremy Tribby and the Barlow Project Authors —
  [Barlow](https://github.com/jpt/barlow)
- Delve Withrington, Red Hat and the Overpass Project Authors —
  [Overpass](https://github.com/RedHatOfficial/Overpass)

Overpass is also the typeface of the PDF documents the app generates.
