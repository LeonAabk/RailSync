// =============================================================================
// AUTHENTICATION UTILITIES & HANDLERS
// =============================================================================
let authStateResolved = false;
let authMode = "login";

function safeLocalGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function safeLocalSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}

// Fjerner alt RailSync har lagret i nettleseren (brukes ved utlogging og kontobytte)
function clearLocalAppData() {
  try {
    Object.keys(localStorage).filter(k => k.toLowerCase().startsWith("railsync")).forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

function setAuthState(state) {
  document.body.dataset.auth = state;
}

function showAuthScreen() {
  setAuthState("out");
  const notice = document.getElementById("auth-notice");
  let pending = null;
  try { pending = sessionStorage.getItem("railsync_pending_join"); } catch (e) {}
  if (notice) {
    if (pending) {
      notice.textContent = "Logg inn for å åpne reisen som er delt med deg. Den åpnes automatisk etterpå.";
      notice.classList.remove("hidden");
    } else {
      notice.classList.add("hidden");
    }
  }
  if (window.lucide) lucide.createIcons();
}

// Vis innloggingssiden hvis innloggingen ikke er avklart etter noen sekunder (f.eks. uten nett)
setTimeout(() => {
  if (!authStateResolved && (document.body.dataset.auth === "pending" || document.body.dataset.auth === "out")) {
    showAuthScreen();
    if (!auth) showAuthError("Innlogging er ikke tilgjengelig akkurat nå. Prøv å laste siden på nytt.");
  }
}, 8000);

function showAuthError(message) {
  const el = document.getElementById("auth-error");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function setAuthMode(mode) {
  authMode = mode === "signup" ? "signup" : "login";
  const isSignup = authMode === "signup";
  const checkbox = document.getElementById("auth-is-new-user");
  if (checkbox) checkbox.checked = isSignup;

  const loginTab = document.getElementById("auth-mode-login");
  const signupTab = document.getElementById("auth-mode-signup");
  const activeCls = "py-2 rounded-md font-semibold bg-white text-slate-900 shadow-sm transition";
  const idleCls = "py-2 rounded-md font-medium text-slate-600 hover:text-slate-900 transition";
  if (loginTab) { loginTab.className = isSignup ? idleCls : activeCls; loginTab.setAttribute("aria-selected", String(!isSignup)); }
  if (signupTab) { signupTab.className = isSignup ? activeCls : idleCls; signupTab.setAttribute("aria-selected", String(isSignup)); }

  const title = document.getElementById("auth-title");
  const subtitle = document.getElementById("auth-subtitle");
  const submit = document.getElementById("btn-auth-submit");
  const pw = document.getElementById("auth-password");
  const hint = document.getElementById("auth-password-hint");
  if (title) title.textContent = isSignup ? "Opprett konto" : "Logg inn";
  if (subtitle) subtitle.textContent = isSignup
    ? "Lag en gratis konto for å planlegge og dele reiser."
    : "Velkommen tilbake. Logg inn for å se reisene dine.";
  if (submit) submit.textContent = isSignup ? "Opprett konto" : "Logg inn";
  if (pw) pw.setAttribute("autocomplete", isSignup ? "new-password" : "current-password");
  if (hint) hint.classList.toggle("hidden", !isSignup);
  showAuthError("");
}

export function togglePasswordVisibility() {
  const pw = document.getElementById("auth-password");
  const btn = document.getElementById("btn-toggle-password");
  if (!pw) return;
  const show = pw.type === "password";
  pw.type = show ? "text" : "password";
  if (btn) btn.textContent = show ? "Skjul" : "Vis";
}

export function toggleAccountMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById("account-menu");
  const pill = document.getElementById("user-profile-pill");
  if (!menu) return;
  const open = menu.classList.contains("hidden");
  menu.classList.toggle("hidden", !open);
  if (pill) pill.setAttribute("aria-expanded", String(open));
}

export function closeAccountMenu() {
  const menu = document.getElementById("account-menu");
  const pill = document.getElementById("user-profile-pill");
  if (menu) menu.classList.add("hidden");
  if (pill) pill.setAttribute("aria-expanded", "false");
}

document.addEventListener("click", (e) => {
  const container = document.getElementById("auth-header-container");
  if (container && !container.contains(e.target)) closeAccountMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAccountMenu();
});

function describeLogin(user) {
  if (!user) return { id: "–", method: "–" };
  const providers = (user.providerData || []).map(p => p.providerId);
  const email = user.email || "";
  if (email.endsWith("@railsync.user")) {
    return { id: "@" + email.split("@")[0], method: "Brukernavn og passord" };
  }
  return { id: email || user.displayName || "–", method: providers.includes("google.com") ? "Google" : "E-post og passord" };
}

export function updateAuthUI(user) {
  const activeName = userProfile.displayName || (user && (user.displayName || (user.email ? user.email.split("@")[0] : ""))) || "Min profil";
  const handle = userProfile.username || "";
  const bgColor = safeColor(userProfile.avatarColor, "#0b8176");
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  setText("user-display-name", activeName);
  setText("sidebar-user-label", activeName);
  setText("sidebar-user-sublabel", handle);
  setText("account-menu-name", activeName);
  setText("account-menu-handle", handle);

  ["header-user-avatar", "sidebar-user-avatar"].forEach(id => {
    paintAvatar(document.getElementById(id), { displayName: activeName, avatarColor: bgColor, photo: userProfile.photo });
  });

  const login = describeLogin(user);
  setText("account-login-id", login.id);
  setText("account-login-method", login.method);
}

export function openAuthModal() {
  if (currentUser) return;
  showAuthScreen();
  const input = document.getElementById("auth-username");
  if (input) setTimeout(() => input.focus(), 50);
}

export async function handleGoogleSignIn() {
  showAuthError("");
  if (!auth) {
    showAuthError("Innlogging er ikke tilgjengelig akkurat nå. Prøv å laste siden på nytt.");
    return;
  }
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err && (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request")) return;
    console.error("Google-innlogging feilet:", err);
    showAuthError(err && err.code === "auth/popup-blocked"
      ? "Nettleseren blokkerte innloggingsvinduet. Tillat popup-vinduer for denne siden og prøv igjen."
      : "Kunne ikke logge inn med Google. Prøv igjen.");
  }
}

export async function handleUsernameAuth(e) {
  if (e && e.preventDefault) e.preventDefault();
  showAuthError("");
  if (!auth) {
    showAuthError("Innlogging er ikke tilgjengelig akkurat nå. Prøv å laste siden på nytt.");
    return;
  }

  const usernameInput = document.getElementById("auth-username");
  const passwordInput = document.getElementById("auth-password");
  const rawInput = (usernameInput && usernameInput.value || "").trim().replace(/^@/, "");
  const password = (passwordInput && passwordInput.value) || "";
  const checkbox = document.getElementById("auth-is-new-user");
  const isNewUser = checkbox ? checkbox.checked : authMode === "signup";

  if (!rawInput) {
    showAuthError("Skriv inn brukernavnet ditt.");
    if (usernameInput) usernameInput.focus();
    return;
  }
  if (/@(gmail|googlemail)\./i.test(rawInput)) {
    showAuthError("Har du en Google-konto, bruker du «Fortsett med Google» i stedet.");
    return;
  }
  if (password.length < 6) {
    showAuthError("Passordet må ha minst 6 tegn.");
    if (passwordInput) passwordInput.focus();
    return;
  }

  let authEmail = rawInput;
  let username;
  if (!rawInput.includes("@")) {
    const cleanUsername = rawInput.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (cleanUsername.length < 3) {
      showAuthError("Brukernavnet må ha minst 3 tegn (bokstaver, tall, punktum, bindestrek eller understrek).");
      return;
    }
    authEmail = `${cleanUsername}@railsync.user`;
    username = cleanUsername;
  } else {
    username = rawInput.split("@")[0];
  }

  const btn = document.getElementById("btn-auth-submit");
  if (btn) {
    btn.disabled = true;
    btn.textContent = isNewUser ? "Oppretter konto …" : "Logger inn …";
  }

  try {
    if (isNewUser && !rawInput.includes("@") && db) {
      try {
        const taken = await getDoc(doc(db, "usernames", normalizeHandle(username)));
        if (taken.exists()) {
          showAuthError(`Brukernavnet «${username}» er allerede tatt. Velg et annet, eller logg inn.`);
          return;
        }
      } catch (e) { /* sjekkes igjen etter innlogging */ }
    }
    if (isNewUser) {
      const res = await createUserWithEmailAndPassword(auth, authEmail, password);
      try {
        await updateProfile(res.user, { displayName: username });
      } catch (profErr) {
        console.warn("Kunne ikke sette visningsnavn:", profErr);
      }
    } else {
      await signInWithEmailAndPassword(auth, authEmail, password);
    }
    const form = document.getElementById("form-auth");
    if (form) form.reset();
    setAuthMode("login");
  } catch (err) {
    console.error("Innlogging feilet:", err);
    const code = err && err.code;
    let msg = "Noe gikk galt. Prøv igjen.";
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-login-credentials") {
      msg = "Feil brukernavn eller passord.";
    } else if (code === "auth/email-already-in-use") {
      msg = `Brukernavnet «${username}» er allerede tatt. Velg et annet, eller logg inn.`;
    } else if (code === "auth/weak-password") {
      msg = "Passordet må ha minst 6 tegn.";
    } else if (code === "auth/too-many-requests") {
      msg = "For mange forsøk. Vent litt og prøv igjen.";
    } else if (code === "auth/network-request-failed") {
      msg = "Ingen nettforbindelse. Sjekk tilkoblingen og prøv igjen.";
    }
    showAuthError(msg);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = authMode === "signup" ? "Opprett konto" : "Logg inn";
    }
  }
}

export const handleEmailAuth = handleUsernameAuth;

export async function handleLogout() {
  isLoggingOut = true;
  try {
    stopCloudListeners();
    syncStatusState = "";
    if (activeTripUnsubscribe) {
      activeTripUnsubscribe();
      activeTripUnsubscribe = null;
    }
    if (auth) await signOut(auth);
  } catch (err) {
    console.error("Utlogging feilet:", err);
  }
  // Fjern reiser, profil og budsjetter fra nettleseren – de ligger på kontoen
  clearLocalAppData();
  try {
    Object.keys(sessionStorage).filter(k => k.toLowerCase().startsWith("railsync")).forEach(k => sessionStorage.removeItem(k));
  } catch (e) {}
  location.replace(location.pathname);
}

