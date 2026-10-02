import "./maintenance.js";
import { ensureSession, googlePopup, logout, auth, getProfile, isAllowed, firstAuthState, friendlyError } from "./firebase.js";
import { $, initBrand, setMsg, setLoading } from "./ui.js";
import { useServer } from "./api.js";

initBrand();
const btn = $("#google"), msg = $("#msg");

// Already signed in with a valid profile: go straight to home.
firstAuthState().then(async (u) => {
  if (!u) return;
  try { if (isAllowed(await getProfile(u.uid))) location.replace("home.html"); } catch (_) {}
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
      setMsg(msg, "error", "This account isn't registered yet. Please sign up before logging in.");
      $("#signup-hint").classList.add("attn");
      return;
    }
    if (!isAllowed(profile)) {
      await logout();
      setMsg(msg, "error", "Only players aged 18 and over can log in.");
      return;
    }
    if (useServer()) await ensureSession(); // server par account (pehli baar login par ban jata hai)
    location.replace("home.html");
  } catch (e) {
    try { if (auth.currentUser) await logout(); } catch (_) {}
    const t = friendlyError(e);
    if (t) setMsg(msg, "error", t);
  } finally {
    setLoading(btn, false);
  }
});
