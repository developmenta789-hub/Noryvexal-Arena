// Maintenance switch, controlled by the owner in the Admin app ("App control" -> app "arena").
// Reads ONE public document, appConfig/arena. If `maintenance` is true a full-screen notice covers the page.
// Any error (offline, rules not published yet, no document) = the site works normally (fail open).
import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

(async () => {
  try {
    const snap = await getDoc(doc(db, "appConfig", "arena"));
    if (!snap.exists() || snap.data().maintenance !== true) return;
    const msg = String(snap.data().maintenanceMessage || "").slice(0, 200) ||
      "We are improving the arena right now. Please check again in a little while.";
    const box = document.createElement("div");
    box.setAttribute("role", "alert");
    box.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;" +
      "background:radial-gradient(circle at 50% 30%,#12204a 0%,#070B16 70%);color:#EEF2FF;text-align:center;font-family:var(--font,system-ui,sans-serif)";
    const card = document.createElement("div");
    card.style.cssText = "max-width:380px;width:100%";
    const ico = document.createElement("div");
    ico.textContent = "\u{1F6E0}\uFE0F";
    ico.style.cssText = "font-size:56px;width:112px;height:112px;line-height:112px;margin:0 auto 22px;border-radius:50%;" +
      "background:rgba(47,128,255,.12);border:1.5px solid rgba(47,128,255,.4)";
    const h = document.createElement("h1");
    h.textContent = "Under maintenance";
    h.style.cssText = "font-size:26px;margin-bottom:10px";
    const p = document.createElement("p");
    p.textContent = msg;              // textContent: the message can never inject HTML
    p.style.cssText = "color:#9AA8C7;line-height:1.6;margin-bottom:24px";
    const b = document.createElement("button");
    b.textContent = "Check again";
    b.style.cssText = "width:100%;height:52px;border:0;border-radius:16px;font:600 16px var(--font,system-ui);color:#fff;" +
      "background:linear-gradient(90deg,#2F80FF,#22D3EE);cursor:pointer";
    b.onclick = () => location.reload();
    card.append(ico, h, p, b);
    box.append(card);
    document.body.append(box);
    document.body.style.overflow = "hidden";
  } catch (e) { /* fail open */ }
})();
