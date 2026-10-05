import "./maintenance.js";
import { googlePopup, logout, auth, getProfile, createProfile, isAllowed, firstAuthState, friendlyError, nextUrl } from "./firebase.js";
import { $, initBrand, setMsg, setLoading } from "./ui.js";

initBrand();
const btn = $("#google"), msg = $("#msg"), terms = $("#terms"),
      blocked = $("#blocked"), form = $("#form");
let age = null; // "adult" | "minor"

const refresh = () => {
  blocked.hidden = age !== "minor";
  form.hidden = age !== "adult";
  btn.disabled = !(age === "adult" && terms.checked);
  setMsg(msg, "", "");
};

document.querySelectorAll('input[name="age"]').forEach((r) =>
  r.addEventListener("change", () => { age = r.value; refresh(); }));
terms.addEventListener("change", refresh);

firstAuthState().then(async (u) => {
  if (!u) return;
  try { if (isAllowed(await getProfile(u.uid))) location.replace(nextUrl(u)); } catch (_) {}
});

btn.addEventListener("click", async () => {
  // Under-18: Google sign-in never starts and nothing is saved.
  if (age !== "adult" || !terms.checked) return;
  setMsg(msg, "", "");
  setLoading(btn, true);
  try {
    const { user } = await googlePopup();
    const existing = await getProfile(user.uid);
    if (existing) {
      setMsg(msg, "info", "You already have an account. Logging you in…");
      setTimeout(() => location.replace(isAllowed(existing) ? nextUrl(user) : "login.html"), 900);
      return;
    }
    await createProfile(user);
    setMsg(msg, "success", "Account created! Now set your password…");
    setTimeout(() => location.replace("password.html"), 900);
  } catch (e) {
    try { if (auth.currentUser && !(await getProfile(auth.currentUser.uid))) await auth.currentUser.delete(); } catch (_) { try { await logout(); } catch (_) {} }
    const t = friendlyError(e);
    if (t) setMsg(msg, "error", t);
  } finally {
    setLoading(btn, false);
    btn.disabled = !(age === "adult" && terms.checked);
  }
});
refresh();
