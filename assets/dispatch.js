/* RailSync – hendelser fra HTML uten inline JavaScript.
 *
 * I stedet for onclick="…" bruker HTML-en data-onclick="…" (og data-onsubmit, data-onchange, data-oninput).
 * Denne filen leser teksten og kaller funksjonen – uten eval, så siden kan ha en streng
 * Content-Security-Policy (script-src uten 'unsafe-inline' og 'unsafe-eval').
 *
 * Tillatt i attributtene: ett eller flere funksjonskall skilt med «;», der hvert argument er
 *   'tekst' | "tekst" (JSON) | tall | true | false | null | event | this | this.value | this.checked
 * Funksjonene må ligge på window (appen legger dem der i src/app/21-vindu-og-oppstart.js).
 *
 * Filen lastes tidlig og synkront (før app.js): skjemaer stoppes fra å sendes på vanlig måte
 * mens appen laster, så f.eks. brukernavn og passord aldri havner i adresselinjen.
 */
(function () {
  "use strict";

  // Aldri logget inn på denne enheten: vis innloggingssiden med en gang i stedet for å vente på Firebase.
  try { if (!localStorage.getItem("railsync_account_uid")) document.body.dataset.auth = "out"; } catch (e) {}

  // Designretning: ?design=nordlys|plakat|sommer i adressen (huskes), ?design=standard for dagens design
  try {
    var DESIGNS = ["nordlys", "plakat", "sommer"];
    var wanted = new URLSearchParams(location.search).get("design");
    if (wanted) {
      if (DESIGNS.indexOf(wanted) !== -1) localStorage.setItem("railsync_design", wanted);
      else localStorage.removeItem("railsync_design");
    }
    var design = localStorage.getItem("railsync_design");
    if (design && DESIGNS.indexOf(design) !== -1) document.documentElement.dataset.design = design;
  } catch (e) {}

  var cache = Object.create(null);

  // Del opp «a(1); b('x;y')» i kall, og hvert kall i navn og argumenter
  function parse(src) {
    if (cache[src]) return cache[src];
    var calls = [];
    var i = 0;
    var n = src.length;
    function skipWs() { while (i < n && /\s/.test(src[i])) i++; }
    function fail(msg) { throw new Error("Ugyldig hendelse «" + src + "»: " + msg); }
    function readString(q) {
      var start = i;
      i++;
      while (i < n && src[i] !== q) { if (src[i] === "\\") i++; i++; }
      if (i >= n) fail("mangler avsluttende " + q);
      i++;
      var raw = src.slice(start, i);
      return q === '"' ? JSON.parse(raw) : raw.slice(1, -1);
    }
    function readArg() {
      skipWs();
      var c = src[i];
      if (c === '"' || c === "'") return { v: readString(c) };
      var m = /^(-?\d+(?:\.\d+)?|true|false|null|event|this\.value|this\.checked|this)\b/.exec(src.slice(i));
      if (!m) fail("ukjent argument ved «" + src.slice(i, i + 20) + "»");
      i += m[0].length;
      var t = m[0];
      if (t === "true") return { v: true };
      if (t === "false") return { v: false };
      if (t === "null") return { v: null };
      if (t === "event" || t === "this" || t === "this.value" || t === "this.checked") return { ref: t };
      return { v: Number(t) };
    }
    while (true) {
      skipWs();
      if (i >= n) break;
      var m = /^(?:window\.)?([A-Za-z_$][\w$]*)\s*\(/.exec(src.slice(i));
      if (!m) fail("forventet funksjonskall");
      i += m[0].length;
      var args = [];
      skipWs();
      if (src[i] !== ")") {
        while (true) {
          args.push(readArg());
          skipWs();
          if (src[i] === ",") { i++; continue; }
          if (src[i] === ")") break;
          fail("forventet , eller )");
        }
      }
      i++;
      calls.push({ name: m[1], args: args });
      skipWs();
      if (src[i] === ";") i++;
    }
    cache[src] = calls;
    return calls;
  }

  function run(el, src, event) {
    var calls;
    try { calls = parse(src); } catch (err) { console.error(err.message); return; }
    for (var k = 0; k < calls.length; k++) {
      var call = calls[k];
      var fn = window[call.name];
      if (typeof fn !== "function") {
        console.warn("RailSync: funksjonen " + call.name + " finnes ikke (ennå)");
        return false;
      }
      var args = call.args.map(function (a) {
        if (!a.ref) return a.v;
        if (a.ref === "event") return event;
        if (a.ref === "this") return el;
        if (a.ref === "this.value") return el.value;
        return el.checked;
      });
      fn.apply(el, args);
    }
    return true;
  }

  // Som inline-hendelser: kjør fra elementet som ble trykket og oppover, til stopPropagation()
  function dispatch(type, event) {
    var attr = "data-on" + type;
    var el = event.target instanceof Element ? event.target : event.target && event.target.parentElement;
    while (el && el !== document) {
      if (el.hasAttribute && el.hasAttribute(attr)) {
        if (type === "submit") event.preventDefault();
        var ok = run(el, el.getAttribute(attr), event);
        if (type === "submit" && ok === false && el.id === "form-auth") {
          var e = document.getElementById("auth-error");
          if (e) { e.textContent = "Siden laster fortsatt. Prøv igjen om et øyeblikk."; e.classList.remove("hidden"); }
        }
        if (event.cancelBubble) {
          // Inline-hendelser stoppet med stopPropagation() nådde aldri appens egne lyttere på document
          // (f.eks. «lukk menyer ved klikk utenfor»). Denne lytteren registreres først (før app.js),
          // så stopImmediatePropagation() gir samme oppførsel.
          event.stopImmediatePropagation();
          break;
        }
      }
      el = el.parentElement;
    }
  }

  ["click", "submit", "change", "input"].forEach(function (type) {
    document.addEventListener(type, function (event) { dispatch(type, event); });
  });

  // Små hjelpere som før lå som inline-kode i HTML-en
  window.reloadPage = function () { location.reload(); };
  window.selectText = function (el) { if (el && el.select) el.select(); };
})();
