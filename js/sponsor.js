// Sponsor banner carousel (home screen redesign, 2026-10-05).
// Data comes from Admin (Firestore `banners`). This file only draws it and has no Firebase code.
//
// Behaviour:
//  - 1 banner: shown as is (no sliding, one dot).  2+ banners: auto-slide, ALWAYS forward: 1 > 2 > 3 > 4 > 1 > 2 ...
//  - Forward-only loop is done with one clone slide at each end ([last][1..n][first]). After the slide onto the clone ends,
//    the track jumps (without animation) to the real slide, so the player never sees a rewind (4 > 3 > 2 > 1 never happens).
//  - Player can swipe/drag (left = next, right = previous) or tap a dot. Auto-slide pauses while touching, hovering, tab hidden,
//    keyboard focus inside, or when the carousel is off screen.
//  - Image problems: skeleton until the first image is ready, broken image -> neat fallback tile (link still works).

const SLIDE_MS = 600;       // slide animation (must match --sp-ms in style.css)
const AUTO_MS = 5000;       // time each banner stays
const DRAG_MIN = 40;        // px of swipe needed to change slide

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/**
 * rows: [{ imageUrl, linkUrl?, title? }] already filtered (https image) and ordered.
 * ui:   { box, view, track, dots }  existing elements from home.html.
 * safeUrl: https-only URL cleaner from home.js.
 * Returns { destroy } so a second call (e.g. refresh) never leaves timers behind.
 */
export function mountSponsor(ui, rows, safeUrl) {
  const { box, view, track, dots } = ui;
  const n = rows.length;
  track.replaceChildren(); dots.replaceChildren();
  if (!n) { box.hidden = true; return { destroy() {} }; }

  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const loops = n > 1;
  let pos = loops ? 1 : 0;           // index inside the track (clones included)
  let busy = false, drag = null, hover = false, focus = false, seen = true, dead = false;
  let timer = 0, settleTimer = 0;

  /* ---- slides ---- */
  function slide(b, i, clone) {
    const link = safeUrl(b.linkUrl);
    const s = el(link ? "a" : "div", "sp-slide");
    if (link) { s.href = link; s.target = "_blank"; s.rel = "noopener noreferrer sponsored"; s.draggable = false; }
    const name = String(b.title || "").trim().slice(0, 60);
    s.setAttribute("role", "group"); s.setAttribute("aria-label", clone ? "" : "Banner " + (i + 1) + " of " + n);
    if (clone) { s.setAttribute("aria-hidden", "true"); s.tabIndex = -1; }
    const img = el("img"); img.alt = clone ? "" : (name || "Sponsor banner"); img.draggable = false; img.decoding = "async";
    img.referrerPolicy = "no-referrer"; if (!(i === 0 && !clone)) img.loading = "lazy";
    img.addEventListener("load", () => { img.classList.add("ok"); firstReady(); });
    img.addEventListener("error", () => { // broken link: tidy tile instead of a broken-image icon
      img.remove(); s.classList.add("broken");
      const fb = el("span", "sp-fb"); fb.append(el("b", "", name || "Sponsored"), el("small", "", link ? "Tap to open" : "Image unavailable")); s.append(fb);
      firstReady();
    });
    img.src = safeUrl(b.imageUrl);
    s.append(img, el("span", "sp-tag", "Sponsored"));
    return s;
  }
  const real = rows.map((b, i) => slide(b, i, false));
  if (loops) track.append(slide(rows[n - 1], n - 1, true), ...real, slide(rows[0], 0, true));
  else track.append(...real);

  /* ---- loading skeleton: removed when the first banner image is ready (or after 8 s) ---- */
  let ready = false;
  function firstReady() { if (ready) return; ready = true; view.classList.remove("is-loading"); }
  view.classList.add("is-loading"); setTimeout(firstReady, 8000);

  /* ---- dots ---- */
  const dotEls = rows.map((_, i) => {
    const d = el("button", "sp-dot"); d.type = "button"; d.setAttribute("aria-label", "Show banner " + (i + 1) + " of " + n);
    if (loops) d.addEventListener("click", () => { go(i + 1, true); restart(); }); else { d.tabIndex = -1; d.disabled = true; }
    return d;
  });
  dots.append(...dotEls);
  const realIndex = () => (loops ? ((pos - 1) % n + n) % n : 0);
  function paintDots() { const r = realIndex(); dotEls.forEach((d, i) => { const on = i === r; d.classList.toggle("on", on); on ? d.setAttribute("aria-current", "true") : d.removeAttribute("aria-current"); }); }

  /* ---- movement ---- */
  const put = (x) => { track.style.transform = "translate3d(" + x + ",0,0)"; };
  const still = (on) => { track.style.transition = on ? "none" : ""; };
  function go(p, animate) {
    if (busy && animate) return;
    pos = p; paintDots();
    if (!animate || reduce) { still(true); put(-pos * 100 + "%"); void track.offsetWidth; still(false); settle(); return; }
    busy = true; still(false); put(-pos * 100 + "%");
    clearTimeout(settleTimer); settleTimer = setTimeout(settle, SLIDE_MS + 120); // safety net when transitionend never fires
  }
  /** After sliding onto a clone, jump to the matching real slide with no animation (invisible: same picture). */
  function settle() {
    clearTimeout(settleTimer); busy = false;
    if (!loops) return;
    if (pos === n + 1) pos = 1; else if (pos === 0) pos = n; else return;
    still(true); put(-pos * 100 + "%"); void track.offsetWidth; still(false); paintDots();
  }
  track.addEventListener("transitionend", (e) => { if (e.target === track && e.propertyName === "transform") settle(); });
  const next = () => go(pos + 1, true);
  const prev = () => go(pos - 1, true);

  /* ---- auto-slide (always forward) ---- */
  function playing() { return loops && !dead && !hover && !focus && !drag && seen && !document.hidden; }
  function schedule() { clearTimeout(timer); if (!playing()) return; timer = setTimeout(() => { if (playing()) next(); schedule(); }, AUTO_MS); }
  function restart() { schedule(); }
  const onVis = () => schedule();
  document.addEventListener("visibilitychange", onVis);
  const mq = window.matchMedia && window.matchMedia("(hover:hover)");
  if (mq && mq.matches) { view.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { hover = true; schedule(); } }); view.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { hover = false; schedule(); } }); }
  view.addEventListener("focusin", () => { focus = true; schedule(); });
  view.addEventListener("focusout", () => { focus = false; schedule(); });
  let io = null;
  if ("IntersectionObserver" in window) { io = new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting; schedule(); }, { threshold: 0.25 }); io.observe(view); }

  /* ---- swipe / drag ---- */
  let swallow = false;   // a drag must not count as a tap on the sponsor link
  if (loops) {
    view.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (busy) { settle(); }
      drag = { id: e.pointerId, x: e.clientX, dx: 0, on: false, w: view.clientWidth || 1 }; swallow = false; schedule();
    });
    view.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dx = e.clientX - drag.x;
      if (!drag.on && Math.abs(drag.dx) > 6) { drag.on = true; swallow = true; still(true); try { view.setPointerCapture(e.pointerId); } catch (_) {} } // capture only after a real drag so plain taps still reach the link
      if (drag.on) put("calc(" + (-pos * 100) + "% + " + drag.dx + "px)");
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (!d.on) { schedule(); return; }
      try { view.releasePointerCapture(e.pointerId); } catch (_) {}
      still(false);
      if (Math.abs(d.dx) > Math.max(DRAG_MIN, d.w * 0.12)) { d.dx < 0 ? next() : prev(); } else { go(pos, true); }
      schedule();
    };
    view.addEventListener("pointerup", end); view.addEventListener("pointercancel", end);
    view.addEventListener("click", (e) => { if (swallow) { e.preventDefault(); e.stopPropagation(); swallow = false; } }, true);
    view.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") { next(); restart(); } else if (e.key === "ArrowLeft") { prev(); restart(); } });
  }

  /* ---- start ---- */
  box.hidden = false; still(true); put(-pos * 100 + "%"); void track.offsetWidth; still(false); paintDots(); schedule();

  return {
    destroy() { dead = true; clearTimeout(timer); clearTimeout(settleTimer); document.removeEventListener("visibilitychange", onVis); if (io) io.disconnect(); },
  };
}
