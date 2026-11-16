// =============================================================================
// 0. FEILRAPPORTER – feil hos brukerne lagres kort i Firestore (errorReports)
// =============================================================================
// Ingen reiseinnhold sendes: bare feilmeldingen, hvor i koden den skjedde, versjon, nettleser og side.
// Les dem i Firebase-konsollen → Firestore → errorReports. Bare innloggede brukere kan sende,
// maks ERROR_REPORT_MAX per sidevisning, og ingen kan lese dem fra appen.
// Ligger først fordi feil skal fanges så tidlig som mulig (db/currentUser fra del 01 brukes først når noe sendes).
const ERROR_REPORT_MAX = 5;
const errorReportSeen = new Set();
let errorReportCount = 0;

function shouldIgnoreError(message, stack) {
  const m = String(message || "");
  const s = String(stack || "");
  if (!m || m === "Script error.") return true;
  if (/ResizeObserver loop/.test(m)) return true;
  if (/(chrome|moz|safari|safari-web)-extension:/.test(s + m)) return true;
  // Nettproblemer (uten nett, tidsavbrudd) er ikke feil i appen
  if (/Failed to fetch|NetworkError|Load failed|network-request-failed|client is offline|unavailable/i.test(m)) return true;
  return false;
}

export function reportAppError(source, err, extra) {
  try {
    const message = String((err && (err.message || err.code)) || err || "").slice(0, 500);
    const stack = String((err && err.stack) || "").slice(0, 2000);
    if (shouldIgnoreError(message, stack)) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const key = source + "|" + message;
    if (errorReportSeen.has(key) || errorReportCount >= ERROR_REPORT_MAX) return;
    const uid = currentUser && currentUser.uid;
    if (!uid || !db) return;
    errorReportSeen.add(key);
    errorReportCount++;
    addDoc(collection(db, "errorReports"), {
      uid,
      at: new Date().toISOString(),
      version: String(APP_VERSION).slice(0, 40),
      source: String(source).slice(0, 40),
      message,
      stack,
      extra: String(extra || "").slice(0, 300),
      tab: String(currentTab || "").slice(0, 40),
      path: String(location.pathname).slice(0, 200),
      ua: String(navigator.userAgent || "").slice(0, 300)
    }).catch(() => {});
  } catch (e) {
    // Feilrapportering skal aldri lage nye feil (f.eks. om noe skjer før resten av appen er lastet)
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => reportAppError("vindu", e.error || e.message, e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : ""));
  window.addEventListener("unhandledrejection", (e) => reportAppError("løfte", e.reason));
}

