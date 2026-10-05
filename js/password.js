import "./maintenance.js";
import { firstAuthState, getProfile, isAllowed, gateFor, setNewPassword, confirmPassword, resetPasswordMail, logout, friendlyError } from "./firebase.js";
import { $, initBrand, setMsg, setLoading } from "./ui.js";

/* Password step. mode "setup": choose a password (new sign-up or older account). mode "confirm": type the password again after Google login.
 * The password is linked to the Google account in Firebase Auth (needs the Email/Password provider enabled in the Firebase Console). */
initBrand();
const msg = $("#msg"), f = $("#f");
let user = null, mode = "";

const eyes = document.querySelectorAll(".eye");
eyes.forEach((b) => b.addEventListener("click", () => {
  const i = document.getElementById(b.dataset.for), show = i.type === "password";
  i.type = show ? "text" : "password";
  b.classList.toggle("on", show);
  b.setAttribute("aria-pressed", String(show));
  b.setAttribute("aria-label", show ? "Hide password" : "Show password");
  i.focus({ preventScroll: true });
}));

/* ---------- setup: strength, rules, match ---------- */
const p1 = $("#p1"), p2 = $("#p2"), save = $("#save");
const rule = (pw) => ({ len: pw.length >= 8, let: /[A-Za-z]/.test(pw), num: /\d/.test(pw) });
const LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"];
function refresh() {
  const pw = p1.value, r = rule(pw);
  document.querySelectorAll("#rules li").forEach((li) => li.classList.toggle("ok", r[li.dataset.r]));
  let n = 0;
  if (r.len) n++;
  if (r.len && r.let && r.num) n++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) n++;
  if (pw.length >= 12) n++;
  if (!r.len || !r.let || !r.num) n = Math.min(n, 1);
  $("#meter").dataset.s = pw ? String(Math.max(n, 1)) : "0";
  $("#mtxt").textContent = pw ? (r.len && r.let && r.num ? LABELS[Math.max(n, 1)] : "Add the missing parts below") : "\u00a0";
  const m = $("#mtch");
  if (!p2.value) { m.textContent = "\u00a0"; m.className = "mtch"; }
  else if (p2.value === pw) { m.textContent = "\u2713 Passwords match"; m.className = "mtch ok"; }
  else { m.textContent = "Passwords don't match yet"; m.className = "mtch bad"; }
  save.disabled = !(r.len && r.let && r.num && p2.value === pw);
}
p1.addEventListener("input", refresh);
p2.addEventListener("input", refresh);

/* ---------- submit ---------- */
f.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!user) return;
  setMsg(msg, "", "");
  const btn = mode === "setup" ? save : $("#go");
  if (mode === "setup") {
    const r = rule(p1.value);
    if (!(r.len && r.let && r.num) || p1.value !== p2.value) return;
  } else if (!$("#p0").value) { setMsg(msg, "error", "Please enter your password."); return; }
  setLoading(btn, true);
  try {
    if (mode === "setup") await setNewPassword(user, p1.value);
    else await confirmPassword(user, $("#p0").value);
    setMsg(msg, "success", mode === "setup" ? "Password saved! Taking you in…" : "Welcome back! Taking you in…");
    setTimeout(() => location.replace("home.html"), 700);
  } catch (err) {
    setLoading(btn, false);
    if (mode === "setup") btn.disabled = false;
    const c = err && err.code;
    if (c === "auth/provider-already-linked") { location.replace("password.html"); return; } // already has one: now asks to confirm
    if (c === "auth/operation-not-allowed") setMsg(msg, "error", "Password sign-in is not enabled yet. Owner: Firebase Console > Authentication > Sign-in method > enable Email/Password.");
    else { const t = friendlyError(err); if (t) setMsg(msg, "error", t); }
    if (mode === "confirm") { $("#p0").select(); }
  }
});

$("#forgot").addEventListener("click", async () => {
  if (!user || !user.email) return;
  setMsg(msg, "", "");
  try {
    await resetPasswordMail(user.email);
    setMsg(msg, "success", "Reset link sent to " + user.email + ". Check your inbox (and spam), set a new password, then come back and log in.");
  } catch (err) { const t = friendlyError(err); if (t) setMsg(msg, "error", t); }
});

$("#switch").addEventListener("click", async () => { await logout(); location.replace("login.html"); });

/* ---------- start ---------- */
(async () => {
  user = await firstAuthState();
  if (!user) return location.replace("login.html");
  let profile = null;
  try { profile = await getProfile(user.uid); } catch (_) {}
  if (!isAllowed(profile)) { await logout(); return location.replace("login.html"); }
  mode = gateFor(user);
  if (mode === "ok") return location.replace("home.html");

  $("#wn").textContent = user.displayName || "Player";
  $("#we").textContent = user.email || "";
  $("#un").value = user.email || "";
  if (user.photoURL) $("#av").src = user.photoURL; else $("#av").hidden = true;
  $("#who").hidden = false;
  if (mode === "setup") {
    $("#t1").textContent = "Set your"; $("#t2").textContent = "password";
    $("#sub").textContent = "Create a password for your account. You'll enter it every time you log in.";
    $("#setup").hidden = false; p1.focus({ preventScroll: true }); refresh();
  } else {
    $("#t1").textContent = "Enter your"; $("#t2").textContent = "password";
    $("#sub").textContent = "Confirm it's you to finish logging in.";
    $("#confirm").hidden = false; $("#p0").focus({ preventScroll: true });
  }
})();
