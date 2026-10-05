import "./maintenance.js";
import { ensureSession, googlePopup, logout, auth, getProfile, isAllowed, firstAuthState, friendlyError, nextUrl } from "./firebase.js";
import { $, initBrand, setMsg, setLoading } from "./ui.js";
import { useServer } from "./api.js";

initBrand();
const btn = $("#google"), msg = $("#msg");

// Already signed in with a valid profile: go straight to home.
firstAuthState().then(async (u) => {
  if (!u) return;
  try { if (isAllowed(await getProfile(u.uid))) location.replace(nextUrl(u)); } catch (_) {}
});

btn.addEventListener("click", async () => {
  setMsg(msg, "", "");
  setLoading(btn, true);
  try {
    const { user } = await googlePopup();
    const profile = await getProfile(user.uid);

    if (!profile) {
      // Never signed up: login is not allowed. Remove the unused auth account.
      try { await user.delete(); } catch (_) { await logout(); }
      // Google account not in Firebase yet: send the player to sign up (age check + Google + password).
      setMsg(msg, "info", "No Noryvexal account found for this Google account. Taking you to sign up…");
      $("#signup-hint").classList.add("attn");
      setTimeout(() => location.replace("signup.html"), 1800);
      return;
    }
    if (!isAllowed(profile)) {
      await logout();
      setMsg(msg, "error", "Only players aged 18 and over can log in.");
      return;
    }
    if (useServer()) await ensureSession(); // server par account (pehli baar login par ban jata hai)
    location.replace(nextUrl(user)); // password.html (set / confirm password) or home.html
  } catch (e) {
    try { if (auth.currentUser) await logout(); } catch (_) {}
    const t = friendlyError(e);
    if (t) setMsg(msg, "error", t);
  } finally {
    setLoading(btn, false);
  }
});
