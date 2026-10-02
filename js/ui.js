import { BRAND, ADS } from "./config.js";

export const $ = (s, r = document) => r.querySelector(s);

export function initBrand() {
  document.querySelectorAll("[data-brand]").forEach((el) => {
    el.textContent = BRAND[el.dataset.brand] || "";
  });
  if (location.protocol === "file:") {
    const b = document.createElement("div");
    b.className = "banner";
    b.textContent = "This page can't run from file://. Open it through a local server (localhost) or a hosting service.";
    document.body.prepend(b);
  }
}

export function setMsg(el, type, text) {
  el.className = "msg" + (text ? " show " + type : "");
  el.textContent = text || "";
}

export function setLoading(btn, on) {
  btn.disabled = on;
  btn.classList.toggle("loading", on);
}

let adsLoaded = false;
/** Fills an ad slot with an AdSense unit. Does nothing until ADS.client/slot are set in config.js. */
export function mountAd(box) {
  if (!ADS.client || !ADS.slot || location.hostname === "localhost") return;
  if (!adsLoaded) {
    const sc = document.createElement("script");
    sc.async = true; sc.crossOrigin = "anonymous";
    sc.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(ADS.client);
    document.head.append(sc); adsLoaded = true;
  }
  const ins = document.createElement("ins");
  ins.className = "adsbygoogle"; ins.style.display = "block";
  ins.dataset.adClient = ADS.client; ins.dataset.adSlot = ADS.slot;
  ins.dataset.adFormat = "auto"; ins.dataset.fullWidthResponsive = "true";
  box.replaceChildren(ins); box.hidden = false;
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (_) {}
}
