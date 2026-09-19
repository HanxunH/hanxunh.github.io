(async () => {
  const laserScript = new URL("laser-pointer.js?v=3", document.currentScript.src).href;
  if (!document.querySelector(".presentation-laser-pointer")) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = laserScript;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Unable to load the presentation laser pointer."));
      document.head.append(script);
    });
  }
  const config = window.PRESENTATION_CONFIG || {};

  // Synchronize explicitly marked slide controls from the speaker's current preview.
  (() => {
    const receiver = new URLSearchParams(location.search).has("receiver");
    const preview = receiver && window.frameElement?.parentElement?.id === "current-slide";
    if (receiver && !preview) return;
    if (document.documentElement.dataset.presentationInteractionSync === "1") return;
    const host = preview ? window.parent.opener : window;
    if (!host || host.closed) return;
    const origin = location.origin;
    const targetOrigin = origin === "null" ? "*" : origin;
    const channel = "presentation-interaction";
    const controls = new Map();
    for (const kind of ["scroll", "input", "click"]) {
      for (const element of document.querySelectorAll(`[data-sync-${kind}]`)) {
        controls.set(element.getAttribute(`data-sync-${kind}`), { element, kind });
      }
    }
    if (!controls.size) return;
    const active = element => element.closest(".slides > section") === Reveal.getCurrentSlide();
    const state = (id, control) => {
      const { element, kind } = control;
      if (kind === "scroll") {
        return {
          id, kind,
          x: element.scrollLeft / Math.max(1, element.scrollWidth - element.clientWidth),
          y: element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight)
        };
      }
      if (kind === "input") return { id, kind, value: Number(element.value) };
      return { id, kind };
    };
    const fraction = value => Number.isFinite(value) && value >= 0 && value <= 1;
    const apply = data => {
      const control = data && controls.get(data.id);
      if (!control || control.kind !== data.kind || !active(control.element)) return;
      const { element, kind } = control;
      if (kind === "scroll") {
        if (!fraction(data.x) || !fraction(data.y)) return;
        const left = data.x * Math.max(0, element.scrollWidth - element.clientWidth);
        const top = data.y * Math.max(0, element.scrollHeight - element.clientHeight);
        if (Math.abs(element.scrollLeft - left) > 1) element.scrollLeft = left;
        if (Math.abs(element.scrollTop - top) > 1) element.scrollTop = top;
      } else if (kind === "input" && element.matches('input[type="range"]')) {
        if (!Number.isFinite(data.value) || data.value < Number(element.min) ||
            data.value > Number(element.max)) return;
        element.value = String(data.value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (kind === "click" && element.matches('button[type="button"]')) {
        if (element.getAttribute("aria-pressed") !== "true") element.click();
      }
    };
    const isCurrentPreview = source => {
      try {
        return source && source.parent.opener === window &&
          source.frameElement?.parentElement?.id === "current-slide";
      } catch {
        return false;
      }
    };
    window.addEventListener("message", event => {
      const data = event.data;
      if (event.origin !== origin || !data || data.channel !== channel) return;
      if (preview) {
        if (event.source !== host || data.type !== "snapshot" || !Array.isArray(data.items)) return;
        data.items.forEach(apply);
      } else if (isCurrentPreview(event.source)) {
        if (data.type === "update") apply(data.item);
        else if (data.type === "register") {
          const items = [];
          for (const [id, control] of controls) {
            if (!active(control.element)) continue;
            if (control.kind === "click" && control.element.getAttribute("aria-pressed") !== "true") continue;
            items.push(state(id, control));
          }
          event.source.postMessage({ channel, type: "snapshot", items }, targetOrigin);
        }
      }
    });
    document.documentElement.dataset.presentationInteractionSync = "1";
    if (!preview) return;
    const pending = new Map();
    let frame = null;
    const queue = (id, control) => {
      if (!active(control.element)) return;
      pending.set(id, control);
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        for (const [key, item] of pending) {
          if (active(item.element)) {
            host.postMessage({ channel, type: "update", item: state(key, item) }, targetOrigin);
          }
        }
        pending.clear();
      });
    };
    for (const [id, control] of controls) {
      control.element.addEventListener(control.kind, event => {
        if (event.isTrusted) queue(id, control);
      }, { passive: true });
    }
    const register = () => requestAnimationFrame(() => {
      host.postMessage({ channel, type: "register" }, targetOrigin);
    });
    Reveal.on("ready", register);
    Reveal.on("slidechanged", register);
    if (Reveal.isReady()) register();
  })();

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  };

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() !== "f" || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleFullscreen();
  }, true);

  document.addEventListener("fullscreenchange", () => {
    if (typeof Reveal.layout === "function") Reveal.layout();
  });

  document.documentElement.dataset.fullscreenShortcut = "F";

  (() => {
    const links = [...document.querySelectorAll('link[rel="stylesheet"][data-slide-style]')];
    if (!links.length) return;
    let applying = false;
    let generation = 0;
    const activeTheme = () => links.find(link => link.media !== "not all")?.dataset.slideStyle;
    const apply = () => {
      if (applying) return;
      const slide = typeof Reveal.getCurrentSlide === "function" ? Reveal.getCurrentSlide() : null;
      const theme = slide?.closest("[data-slide-style]")?.dataset.slideStyle || activeTheme();
      if (!theme) return;
      let changed = false;
      let enabled = null;
      for (const link of links) {
        const media = link.dataset.slideStyle === theme ? "all" : "not all";
        if (media === "all") enabled = link;
        if (link.media === media) continue;
        link.media = media;
        changed = true;
      }
      if (!changed || !enabled || typeof Reveal.layout !== "function") return;
      const token = ++generation;
      const layout = () => {
        if (token !== generation || applying) return;
        applying = true;
        Reveal.layout();
        applying = false;
      };
      let loaded = false;
      try { loaded = Boolean(enabled.sheet); } catch { loaded = false; }
      if (loaded) requestAnimationFrame(layout);
      else enabled.addEventListener("load", layout, { once: true });
    };
    Reveal.on("ready", apply);
    Reveal.on("slidechanged", apply);
    if (Reveal.isReady()) apply();
  })();

  document.querySelectorAll(".reveal .slides > section").forEach((slide) => {
    if (slide.classList.contains("no-brand") || slide.querySelector(".uom-brand")) return;

    const brand = document.createElement("a");
    brand.className = "uom-brand";
    brand.href = "https://www.unimelb.edu.au";
    brand.target = "_blank";
    brand.rel = "noopener noreferrer";
    brand.setAttribute("aria-label", "The University of Melbourne homepage");

    const logo = document.createElement("img");
    logo.src = config.logoPath || "uom-logo.svg";
    logo.alt = "";
    brand.append(logo);
    slide.append(brand);
  });

  Reveal.initialize({
    width: 1600,
    height: 900,
    margin: 0,
    minScale: 0.2,
    maxScale: 1.8,
    hash: true,
    history: true,
    controls: false,
    controlsTutorial: false,
    progress: true,
    slideNumber: "c/t",
    center: false,
    transition: "fade",
    transitionSpeed: "fast",
    backgroundTransition: "fade",
    autoAnimateDuration: 0.55,
    pdfSeparateFragments: false,
    pdfPageHeightOffset: 0,
    totalTime: config.totalTime || 50 * 60,
    plugins: []
  });

  Reveal.on("ready", () => {
    document.documentElement.dataset.presentationReady = "true";
  });
})();
