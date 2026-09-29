// Potion Pop's website (tools/make_site.py copies it to assets/js/site.js). Everything here
// is an enhancement: the page, its Download links and its fallback release info work without it.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // --- The latest release from GitHub: version, date, APK size, notes ---
  const API = "https://api.github.com/repos/opiumheimer/opiumheimer.github.io/releases/latest";
  const KEY = "pp-release";

  function showRelease(r) {
    // The versioned file (PotionPop-v1.0.4.apk) when the release has one, else PotionPop.apk.
    const apks = (r.assets || []).filter((a) => /^PotionPop.*\.apk$/.test(a.name));
    const apk = apks.find((a) => a.name !== "PotionPop.apk") || apks[0];
    if (apk && apk.browser_download_url) $$("[data-apk]").forEach((e) => (e.href = apk.browser_download_url));
    if (r.tag_name) $$("[data-version]").forEach((e) => (e.textContent = r.tag_name));
    if (apk) $$("[data-size]").forEach((e) => (e.textContent = Math.round(apk.size / 1e6) + " MB"));
    if (r.published_at) {
      const d = new Date(r.published_at);
      $$("[data-date]").forEach((e) => {
        e.textContent = "Released " + d.toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" });
      });
    }
    const items = (r.body || "").split("\n").filter((l) => /^\s*[-*]\s+/.test(l)).map((l) => l.replace(/^\s*[-*]\s+/, ""));
    const list = $("[data-notes]");
    if (list && items.length) {
      list.replaceChildren(...items.map((t) => {
        const li = document.createElement("li");
        li.textContent = t.replace(/\*\*|__|`/g, "");
        return li;
      }));
    }
  }

  try {
    const cached = sessionStorage.getItem(KEY);
    if (cached) showRelease(JSON.parse(cached));
  } catch (e) { /* private mode: fetch below */ }
  fetch(API, { headers: { Accept: "application/vnd.github+json" } })
    .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
    .then((r) => {
      showRelease(r);
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ tag_name: r.tag_name, published_at: r.published_at, body: r.body,
          assets: (r.assets || []).map((a) => ({ name: a.name, size: a.size, browser_download_url: a.browser_download_url })) }));
      } catch (e) { /* storage full or blocked */ }
    })
    .catch(() => { /* offline or rate-limited: the built-in info stays */ });

  // --- The before/after shop ---
  $$(".fixer-frame").forEach((frame) => {
    const range = $(".fixer-range", frame);
    const set = () => frame.style.setProperty("--split", range.value + "%");
    range.addEventListener("input", set);
    set();
  });

  // --- The screenshot gallery: counter, progress, buttons, keys, lightbox ---
  const track = $(".track");
  if (track) {
    const items = $$("li", track);
    const at = $("[data-at]");
    const bar = $(".progress span");
    const n = items.length;
    let current = 0;
    bar.style.setProperty("--p", 100 / n + "%");

    const stride = () => (n > 1 ? items[1].offsetLeft - items[0].offsetLeft : 1);
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      current = max <= 1 ? 0 : Math.min(n - 1, Math.round(track.scrollLeft / stride()));
      if (track.scrollLeft >= max - 2) current = n - 1;
      at.textContent = current + 1;
      bar.style.setProperty("--o", current * 100 + "%"); // (translateX: % of the bar's own width)
    };
    const go = (i) => {
      i = Math.max(0, Math.min(n - 1, i));
      track.scrollTo({ left: items[i].offsetLeft - items[0].offsetLeft, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    };
    let raf = 0;
    track.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive: true });
    track.addEventListener("scrollend", update);
    $$("[data-go]").forEach((b) => b.addEventListener("click", () => go(current + Number(b.dataset.go))));
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        go(current + (e.key === "ArrowRight" ? 1 : -1));
      }
    });
    update();

    const box = $(".lightbox");
    if (box && typeof box.showModal === "function") {
      const img = $("img", box);
      const cap = $(".lightbox-cap", box);
      const shots = $$(".shot", track);
      let open = 0;
      const show = (i) => {
        open = (i + n) % n;
        const src = $("img", shots[open]);
        img.src = src.currentSrc || src.src;
        img.alt = src.alt;
        cap.textContent = $("p", items[open]).textContent;
      };
      shots.forEach((s, i) => s.addEventListener("click", () => { show(i); box.showModal(); }));
      $(".lb-close", box).addEventListener("click", () => box.close());
      $(".lb-prev", box).addEventListener("click", () => show(open - 1));
      $(".lb-next", box).addEventListener("click", () => show(open + 1));
      box.addEventListener("click", (e) => { if (e.target === box) box.close(); });
      box.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") show(open + 1);
        if (e.key === "ArrowLeft") show(open - 1);
      });
      box.addEventListener("close", () => { go(open); shots[open].focus(); });
    } else {
      $$(".shot", track).forEach((s) => (s.style.cursor = "default"));
    }
  }

  // --- The trailer: Potion Pop's own player (without JS the native controls stay) ---
  const player = $("[data-player]");
  if (player) {
    const video = $("video", player);
    const big = $(".big-play", player);
    const bar = $(".bar", player);
    const seek = $(".seek", player);
    const time = $(".time", player);
    const btn = (a) => $(`[data-act="${a}"]`, player);
    const clock = (t) => (t = Math.max(0, Math.floor(t || 0)), Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"));
    video.controls = false;
    big.hidden = bar.hidden = false;

    const toggle = () => (video.paused || video.ended ? video.play().catch(() => {}) : video.pause());
    const paint = () => {
      const on = !video.paused && !video.ended;
      player.classList.toggle("playing", on);
      player.classList.toggle("muted", video.muted);
      btn("play").setAttribute("aria-label", on ? "Pause" : "Play");
      btn("mute").setAttribute("aria-label", video.muted ? "Unmute" : "Mute");
      if (!on) wake();
    };
    const tick = () => {
      const d = video.duration || 0;
      const v = d ? (video.currentTime / d) * 100 : 0;
      if (!seeking) seek.value = Math.round(v * 10);
      seek.style.setProperty("--v", v + "%");
      seek.setAttribute("aria-valuetext", clock(video.currentTime) + " of " + clock(d));
      if (d) time.textContent = clock(video.currentTime) + " / " + clock(d); // (before the file loads: the page's 0:31)
    };

    // The bar hides 2.5 s after the last touch or mouse move while playing.
    let idle = 0;
    function wake() {
      player.classList.remove("idle");
      clearTimeout(idle);
      if (!video.paused) idle = setTimeout(() => player.classList.add("idle"), 2500);
    }

    let seeking = false;
    seek.addEventListener("input", () => {
      seeking = true;
      if (video.duration) video.currentTime = (seek.value / 1000) * video.duration;
      tick();
    });
    seek.addEventListener("change", () => (seeking = false));

    big.addEventListener("click", toggle);
    btn("play").addEventListener("click", toggle);
    btn("mute").addEventListener("click", () => { video.muted = !video.muted; });
    // A tap on the picture: when the bar is hidden it only brings it back (phones), else play/pause.
    video.addEventListener("click", () => (player.classList.contains("idle") ? wake() : toggle()));

    const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
    btn("full").addEventListener("click", () => {
      if (fsEl()) return (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      const go = player.requestFullscreen || player.webkitRequestFullscreen;
      if (go) go.call(player);
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); // iPhone: the system player
    });

    player.addEventListener("keydown", (e) => {
      if (e.target === seek && e.key.startsWith("Arrow")) return; // the range's own keys
      const k = e.key.toLowerCase();
      if (k === " " || k === "k") { if (e.target.tagName === "BUTTON" && k === " ") return; toggle(); }
      else if (k === "m") video.muted = !video.muted;
      else if (k === "f") btn("full").click();
      else if (k === "arrowright" || k === "arrowleft") video.currentTime += k === "arrowright" ? 5 : -5;
      else return;
      e.preventDefault();
      wake();
    });
    ["pointermove", "pointerdown", "focusin"].forEach((ev) => player.addEventListener(ev, wake));

    ["play", "pause", "ended", "volumechange"].forEach((ev) => video.addEventListener(ev, paint));
    ["timeupdate", "durationchange", "seeked"].forEach((ev) => video.addEventListener(ev, tick));
    video.addEventListener("waiting", () => player.classList.add("loading"));
    ["playing", "canplay", "pause", "error"].forEach((ev) => video.addEventListener(ev, () => player.classList.remove("loading")));
    video.addEventListener("ended", () => { video.currentTime = 0; });
    paint();
    tick();
  }
})();
