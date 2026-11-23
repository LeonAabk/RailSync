# RailSync – appens kode

Koden til `app.js` ligger her, delt i deler etter hva de gjør. **Rediger disse filene, ikke `app.js`.**
`app.js` lages av `scripts/build-app.cjs`, som limer delene sammen i navnerekkefølge
(GitHub Actions gjør det ved hver publisering; kjør `node scripts/build-app.cjs` lokalt).

Delene deler samme skop, som da alt lå i én fil: funksjoner kan brukes på tvers av filene,
men variabler (`let`/`const`) må være definert i en del som kommer *før* der de brukes når siden lastes.

| Fil | Innhold |
| --- | --- |
| 01-firebase-profil-og-venner.js | Firebase-oppsett, profil i skyen, brukernavn, venner og lyttere |
| 02-innlogging.js | Innlogging, registrering, Google, utlogging |
| 03-tilstand-og-eksempelreiser.js | Appens tilstand, gamle eksempelreiser (til opprydding) |
| 04-budsjettlager-og-synkhjelpere.js | Eget budsjett per reise, lagringsstatus, offline, ny versjon, samtidig redigering, Firestore-trygge data |
| 05-lagring-og-skysynk.js | Lasting og lagring lokalt og i Firestore |
| 06-kart.js | Leaflet-kartet |
| 07-navigasjon-og-ny-reise.js | Faner, velkomst og ny reise |
| 08-visning-oversikt-og-tog.js | Oversikt, stoppliste og togliste |
| 09-pass.js | Interrail-pass: typer, beregning og visning |
| 10-budsjett.js | Budsjett i reisefølget og felles utgifter |
| 11-reiser-og-dialoger.js | Egen dialog, Reiser-siden, deling og medlemmer |
| 12-profilvindu.js | Profilvindu og forsidebilde |
| 13-sosialt.js | Profilsiden, venner og finn reisende |
| 14-stopp-og-pass-vindu.js | Stopp (legg til/endre/flytt) og «Mitt pass»-vinduet |
| 15-mobil-og-handlinger.js | «⋯»-menyer, stopp/kart-valg, reisekort, innstillinger, tog, budsjett og pakkeliste |
| 16-vinduer-og-bilder.js | Åpne/lukke vinduer, varsler, profil- og forsidebilder |
| 17-togsok-og-spor.js | Togsøk (Transitous) og ekte jernbanespor på kartet |
| 18-dagsplan.js | Dagsplan: tog, overnatting og aktiviteter for hver dag, «I dag»-kortet på oversikten |
| 19-land-og-valuta.js | Landinfo, valutakurser, utgifter i andre valutaer, valutakalkulator, lenker for setereservasjon |
| 20-reisen-i-tall.js | «Reisen i tall»: statistikk på oversikten og delbart bilde |
| 21-vindu-og-oppstart.js | Funksjoner for HTML (`window.…`) og oppstart |

## Sjekker og tester

Kjør `npm ci` én gang først. GitHub Actions kjører alt dette før hver publisering, og stopper hvis noe feiler.

| Kommando | Hva den gjør |
| --- | --- |
| `npm run lint` | ESLint på hele appen (delene limes sammen, feil vises med riktig fil og linje her i `src/app/`) |
| `npm test` | Enhetstester i `tests/unit/` for rene beregninger: oppgjør av felles utgifter, Interrail-pass, sammenslåing ved samtidig redigering, escaping og valuta |
| `npm run test:rules` | Tester sikkerhetsreglene (`firestore.rules`) mot Firestore-emulatoren. Krever Java 21 |

Enhetstestene henter funksjonene rett fra disse filene med `tests/unit/load-app.mjs`, så koden trenger ikke endres for å kunne testes.
Bare funksjoner og konstanter på øverste nivå lastes; DOM-kode og oppstart kjøres ikke.
