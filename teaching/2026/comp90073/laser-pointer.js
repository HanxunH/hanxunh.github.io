(() => {
  if (document.querySelector(".presentation-laser-pointer")) return;
  if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href.includes("/laser-pointer.css"))) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = new URL("laser-pointer.css?v=3", document.currentScript.src).href;
    document.head.append(stylesheet);
  }
  const receiver = new URLSearchParams(window.location.search).has("receiver");
  const preview = receiver && window.frameElement?.parentElement?.id === "current-slide";
  if (receiver && !preview) return;

  const host = preview ? window.parent.opener : window;
  if (!host || host.closed) return;
  const origin = window.location.origin;
  const targetOrigin = origin === "null" ? "*" : origin;
  const channel = "presentation-laser";
  let speakerPreview = null;
  let enabled = false;
  let visible = false;
  let fromPreview = false;
  let x = .5;
  let y = .5;
  let mouseX = null;
  let mouseY = null;

  const pointer = document.createElement("div");
  pointer.className = "presentation-laser-pointer";
  pointer.setAttribute("aria-hidden", "true");
  pointer.hidden = true;
  document.body.append(pointer);

  const render = () => {
    const surface = document.fullscreenElement || document.body;
    if (pointer.parentElement !== surface) surface.append(pointer);
    const bounds = document.querySelector(".reveal .slides").getBoundingClientRect();
    const show = enabled && visible && bounds.width > 0 && bounds.height > 0;
    pointer.hidden = !show;
    document.documentElement.classList.toggle("presentation-laser-active", show);
    if (show) {
      pointer.style.transform = `translate3d(${bounds.left + x * bounds.width}px, ${bounds.top + y * bounds.height}px, 0)`;
    }
  };

  const sendState = () => {
    if (!speakerPreview) return;
    if (speakerPreview.closed || speakerPreview.parent.closed) {
      speakerPreview = null;
      return;
    }
    speakerPreview.postMessage({ channel, type: "state", enabled, visible, x, y }, targetOrigin);
  };

  const validPoint = (px, py) => Number.isFinite(px) && Number.isFinite(py) &&
    px >= 0 && px <= 1 && py >= 0 && py <= 1;

  const apply = (type, px, py, remote) => {
    if (type === "toggle") {
      enabled = !enabled;
      visible = enabled;
    } else if (type === "move") {
      if (!validPoint(px, py)) return;
      visible = enabled;
    } else if (type === "hide") {
      visible = false;
    } else {
      return;
    }
    if (type !== "hide") {
      fromPreview = remote;
      if (validPoint(px, py)) { x = px; y = py; }
    }
    render();
    sendState();
  };

  const request = (type) => {
    if (preview) host.postMessage({ channel, type, x, y }, targetOrigin);
    else apply(type, x, y, false);
  };

  const isCurrentPreview = (source) => {
    try {
      return source && source.parent.opener === window &&
        source.frameElement?.parentElement?.id === "current-slide";
    } catch {
      return false;
    }
  };

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (event.origin !== origin || !data || data.channel !== channel) return;
    if (preview) {
      if (event.source !== host || data.type !== "state" ||
          typeof data.enabled !== "boolean" || typeof data.visible !== "boolean" ||
          !validPoint(data.x, data.y)) return;
      enabled = data.enabled;
      visible = data.visible;
      x = data.x;
      y = data.y;
      render();
    } else if (isCurrentPreview(event.source)) {
      speakerPreview = event.source;
      if (data.type === "register") sendState();
      else apply(data.type, data.x, data.y, true);
    }
  });

  // Coordinates belong to the slide, not the differently sized browser windows.
  const updatePoint = () => {
    if (mouseX === null) return false;
    const bounds = document.querySelector(".reveal .slides").getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return false;
    const px = (mouseX - bounds.left) / bounds.width;
    const py = (mouseY - bounds.top) / bounds.height;
    if (!validPoint(px, py)) return false;
    x = px;
    y = py;
    return true;
  };

  document.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (enabled) request(updatePoint() ? "move" : "hide");
  }, { passive: true });

  const editing = (target) => target?.nodeType === 1 &&
    target.closest("input, textarea, select, [contenteditable]");
  const toggle = () => {
    if (editing(document.activeElement) ||
        (preview && editing(window.parent.document.activeElement))) return;
    updatePoint();
    request("toggle");
  };

  // Speaker view forwards only a key code, so retain modifiers and repeat here.
  const handleKey = (event) => {
    if (event.code !== "KeyL" && event.key.toLowerCase() !== "l") return;
    if (event.metaKey || event.ctrlKey || event.altKey || editing(event.target)) {
      if (preview && event.currentTarget !== window) event.stopImmediatePropagation();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat) toggle();
  };
  window.addEventListener("keydown", handleKey, true);
  if (preview) {
    const speakerWindow = window.parent;
    speakerWindow.addEventListener("keydown", handleKey, true);
    window.addEventListener("pagehide", () => {
      speakerWindow.removeEventListener("keydown", handleKey, true);
    }, { once: true });
  }

  const leave = () => {
    if (!preview && fromPreview) return;
    request("hide");
  };
  document.documentElement.addEventListener("pointerleave", leave);
  window.addEventListener("blur", leave);
  window.addEventListener("beforeprint", () => request("hide"));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) leave();
  });
  window.addEventListener("resize", render);
  window.addEventListener("fullscreenchange", render);
  Reveal.on("slidechanged", render);
  Reveal.on("resize", render);
  const register = () => {
    Reveal.configure({ keyboard: { ...Reveal.getConfig().keyboard, 76: toggle } });
    Reveal.addKeyBinding({ keyCode: 76, key: "L", description: "Toggle laser pointer" }, toggle);
    if (preview) host.postMessage({ channel, type: "register" }, targetOrigin);
  };
  if (Reveal.isReady()) register();
  else Reveal.on("ready", register);
  document.documentElement.dataset.laserPointerShortcut = "L";
})();
