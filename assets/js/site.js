// Potion Pop's website (tools/make_site.py copies it to assets/js/site.js). Everything here
// is an enhancement: the page, its Download links and its fallback release info work without it.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- The latest release from GitHub: version, date, APK size, notes, the APK's SHA-256 ---
  const API = "https://api.github.com/repos/opiumheimer/opiumheimer.github.io/releases/latest";
  const KEY = "pp-release";

  function showRelease(r) {
    // The versioned file (PotionPop-v2.0.0.apk) when the release has one, else PotionPop.apk.
    const apks = (r.assets || []).filter((a) => /^PotionPop.*\.apk$/.test(a.name));
    const apk = apks.find((a) => a.name !== "PotionPop.apk") || apks[0];
    if (apk && apk.browser_download_url) $$("[data-apk]").forEach((e) => (e.href = apk.browser_download_url));
    if (r.tag_name) {
      $$("[data-version]").forEach((e) => (e.textContent = r.tag_name));
      $$("[data-version-num]").forEach((e) => (e.textContent = r.tag_name.replace(/^v/, "")));
    }
    if (apk) $$("[data-size]").forEach((e) => (e.textContent = Math.round(apk.size / 1e6) + " MB"));
    if (r.published_at) {
      const d = new Date(r.published_at);
      $$("[data-date]").forEach((e) => {
        e.textContent = "Released " + d.toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" });
      });
    }
    const body = (r.body || "").split("\n").map((l) => l.trim()).filter(Boolean);
    const plain = (t) => t.replace(/\*\*|__|`/g, "");
    const items = body.filter((l) => /^[-*]\s+/.test(l)).map((l) => plain(l.replace(/^[-*]\s+/, "")));
    const list = $("[data-notes]");
    if (list && items.length) {
      list.replaceChildren(...items.map((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        return li;
      }));
    }
    const lead = body.find((l) => !/^[-*#]/.test(l) && !/SHA-256/i.test(l));
    if (lead) $$("[data-lead]").forEach((e) => (e.textContent = plain(lead)));
    const sha = (r.body || "").match(/SHA-256[^:]*:\s*`?([0-9a-f]{64})/i);
    if (sha) {
      $$("[data-sha]").forEach((e) => (e.textContent = sha[1]));
      $$("[data-sha-row]").forEach((e) => (e.hidden = false));
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

  // --- Things that play once when they scroll into view ---
  const seen = (els, fn, margin = "0px 0px -12% 0px") => {
    if (!("IntersectionObserver" in window)) return els.forEach(fn);
    const io = new IntersectionObserver((list) => list.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      fn(e.target);
    }), { rootMargin: margin });
    els.forEach((el) => io.observe(el));
  };
  if (still) $$(".reveal").forEach((e) => e.classList.add("in"));
  else seen($$(".reveal"), (e) => e.classList.add("in"));

  // The boss's HP bar: three hits, the white lag catching up behind the pink (the game's bar).
  seen($$("[data-hp]"), (hp) => {
    const max = 3600;
    const hits = [600, 900, 750];
    const num = $(".hp-num", hp);
    const pop = $(".hp-hit", hp);
    let left = max;
    const set = () => {
      hp.style.setProperty("--hp", (left / max) * 100 + "%");
      num.textContent = left + "/" + max;
    };
    if (still) { left = max - hits.reduce((a, b) => a + b); return set(); }
    hits.forEach((h, i) => setTimeout(() => {
      left -= h;
      set();
      pop.textContent = "-" + h;
      pop.classList.remove("go");
      void pop.offsetWidth; // (restarts the animation)
      pop.classList.add("go");
    }, 700 + i * 1100));
  }, "0px 0px -25% 0px");

  // The streak row: the steps fill one by one up to 5 (the +2 bonus lights).
  seen($$("[data-streak]"), (row) => {
    const steps = $$("li", row);
    const count = $(".flame b", row);
    const to = 5;
    const fill = (k) => {
      steps.forEach((s, i) => s.classList.toggle("on", i < k));
      count.textContent = k;
      row.classList.toggle("lit", k > 0);
    };
    if (still) return fill(to);
    for (let k = 1; k <= to; k++) setTimeout(() => fill(k), 300 + k * 380);
  }, "0px 0px -20% 0px");

  // --- The case board's red string, pin to pin in order ---
  const board = $("[data-board]");
  if (board) {
    const svg = $(".board-string", board);
    const pins = $$("[data-pin]", board).sort((a, b) => a.dataset.pin - b.dataset.pin).map((c) => $(".pin", c));
    const draw = () => {
      const box = board.getBoundingClientRect();
      const at = pins.map((p) => {
        const r = p.getBoundingClientRect();
        return [r.left + r.width / 2 - box.left, r.top + r.height * 0.22 - box.top];
      });
      svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      svg.innerHTML = at.slice(1).map((b, i) => {
        const a = at[i];
        const sag = Math.min(46, Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.18); // (the string hangs a little)
        return `<path d="M${a[0]} ${a[1]} Q${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2 + sag} ${b[0]} ${b[1]}"/>`;
      }).join("");
    };
    draw();
    if ("ResizeObserver" in window) new ResizeObserver(draw).observe(board);
    addEventListener("load", draw);
  }

  // --- The before/after shop ---
  $$(".fixer-frame").forEach((frame) => {
    const range = $(".fixer-range", frame);
    const set = () => frame.style.setProperty("--split", range.value + "%");
    range.addEventListener("input", set);
    set();
  });

  // --- The phone dock: shown once the hero's Download button has scrolled away ---
  const dock = $("[data-dock]");
  const hero = $(".hero .cta-row");
  if (dock && hero && "IntersectionObserver" in window) {
    const near = $("#download");
    let pastHero = false;
    let atGet = false;
    const paint = () => (dock.hidden = !pastHero || atGet);
    new IntersectionObserver(([e]) => {
      pastHero = !e.isIntersecting && e.boundingClientRect.top < 0;
      paint();
    }).observe(hero);
    if (near) new IntersectionObserver(([e]) => { atGet = e.isIntersecting; paint(); }, { rootMargin: "0px 0px -30% 0px" }).observe(near);
  }

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
      track.scrollTo({ left: items[i].offsetLeft - items[0].offsetLeft, behavior: still ? "auto" : "smooth" });
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
      if (d) time.textContent = clock(video.currentTime) + " / " + clock(d); // (before the file loads: the page's own)
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
