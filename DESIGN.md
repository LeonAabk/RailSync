# RailSync – design

Brukeren velger utseende under **Konto og profil → Utseende**. Det finnes fire design:

| Design | `data-design` | Kjennetegn |
| --- | --- | --- |
| **Standard** | *(ingen)* | Dagens app: fjordgrønt, Plus Jakarta Sans, myke kort. Ren Tailwind. |
| **Alpin** | `alpin` | Sveitsiske jernbaneplakater: signalrødt, svart og hvitt, fjellsilhuett i toppseksjonen. |
| **Retro 70** | `retro` | 1970-tallets Interrail: brunt, brent oransje, sennep og oliven, stripebånd langs toppen, runde knapper. |
| **Nattog** | `nattog` | Art deco-nattog: midnatt og gull, stjernehimmel med månesigd, doble gullrammer. |

## Slik henger det sammen

- **Standard er grunnlaget.** All markering i `index.html` og `src/app/` er skrevet for Standard med Tailwind-klasser.
  De andre designene er et stillag oppå, i `assets/designs.css`, aktivert med `<html data-design="…">`.
  Uten attributtet gjelder ingenting i filen (bortsett fra stilen til selve designvelgeren).
- **Alle valgfrie design er i plakatfamilien.** Felles regler står under `html[data-design]`: kondensert
  overskrift (Big Shoulders Display), billettkort med tykk kant og hard skygge, stripete sporbånd, stoppnumre.
  Hver variant setter fargevariabler og legger til sin egen vri:

  | Variabel | Brukes til |
  | --- | --- |
  | `--ink` | mørk hovedfarge: sidemeny, kanter, overskrifter |
  | `--pri` / `--on-pri` | handling: knapper, stoppnumre, kartnåler / tekst på dem |
  | `--hi` / `--on-hi` | fremheving: aktiv fane, overlinjer / tekst på dem |
  | `--ter` | tredje farge i sporbåndet |
  | `--paper` | sidebakgrunn |
  | `--hero`, `--hero-shadow`, `--on-hero-muted` | toppseksjonen på oversikten |
  | `--shadow` | farge på de harde skyggene |
  | `--c-overview` … `--c-trips` | hver del av appen sin farge (`r g b`), brukes via `--sec` |

- **Valget lagres to steder:** på den private profilen (`users/{uid}.design`, kun eieren kan lese den) så det
  følger kontoen, og i `localStorage` (`railsync_design`) så `assets/dispatch.js` kan sette det *før* siden tegnes
  (ingen blink). Ved innlogging vinner profilens valg; har profilen ikke noe valg, tas enhetens valg med opp.
  Koden ligger nederst i `src/app/12-profilvindu.js`.
- **Forhåndsvisning:** `?design=alpin|retro|nattog|standard` i adressen. Det regnes som et valg og lagres.

## Regler for endringer

1. **Lag alt for Standard først**, med vanlige Tailwind-klasser. Sjekk deretter de tre andre designene.
2. **Bruk de vanlige klassene for knapper**: hovedknapper er `bg-fjord-800` eller `bg-brand-600` på `button`/`a`.
   Da får de riktig stil i alle design automatisk. Kort er `rounded-2xl border` / `rounded-xl border`.
3. **Ikke hardkod farger i designene utenom variablene**, unntatt pynt (striper, stjerner, fjell).
   Ny farge som trengs i alle varianter → ny variabel i felles-blokken, med verdi i hver variant.
4. **Kontrast (WCAG AA) gjelder i alle fire design:** minst 4.5:1 for vanlig tekst, 3:1 for stor tekst og ikoner.
   - Hvit tekst på `--pri` må ha minst 4.5:1. Retro bruker derfor `#b8461d`, ikke den lyse `#d9572b` (bare i striper).
   - Grå hjelpetekst (`text-slate-500`) gjøres mørkere i designene (`#556274`), fordi papirbakgrunnene er farget.
5. **Nytt design?** Legg til en blokk `html[data-design="navn"] { … }` i `designs.css`, og navnet i
   `DESIGNS` i både `assets/dispatch.js` og `src/app/12-profilvindu.js` (med navn og `theme-color`),
   og et kort med forhåndsvisning (`.design-swatch[data-swatch="navn"]`) i designvelgeren i `index.html`.
6. **Test før publisering**: axe-core (WCAG 2.1 AA) på alle faner, på PC og mobil, i alle fire design.
