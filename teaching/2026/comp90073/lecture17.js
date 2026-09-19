(() => {
  const slide = document.querySelector('.operations-model-slide');
  if (!slide) return;
  const pane = slide.querySelector('.implementation-scroll');
  const status = slide.querySelector('.implementation-status');
  if (!pane || !status) return;

  const focusStage = () => {
    if (Reveal.getCurrentSlide() !== slide) return;
    requestAnimationFrame(() => {
      const stages = [...pane.querySelectorAll('.implementation-stage.visible')];
      const current = stages[stages.length - 1];
      status.textContent = current
        ? `${stages.length}/5 · ${current.dataset.stageTitle}`
        : 'Next: tensor operations';
      pane.scrollTop = current ? current.offsetTop - 8 : 0;
    });
  };

  Reveal.on('ready', focusStage);
  Reveal.on('slidechanged', focusStage);
  Reveal.on('fragmentshown', focusStage);
  Reveal.on('fragmenthidden', focusStage);
  if (Reveal.isReady()) focusStage();
})();

(() => {
  const slide = document.querySelector('.gcg-coordinate-demo');
  const pane = slide?.querySelector('.attack-implementation-column pre');
  if (!slide || !pane) return;

  const focusStage = () => {
    if (Reveal.getCurrentSlide() !== slide) return;
    requestAnimationFrame(() => {
      const stages = [...pane.querySelectorAll('.gcg-code-stage.visible')];
      const current = stages[stages.length - 1];
      pane.scrollTop = current?.dataset.fragmentIndex === '0'
        ? 0
        : pane.scrollHeight;
    });
  };

  Reveal.on('ready', focusStage);
  Reveal.on('slidechanged', focusStage);
  Reveal.on('fragmentshown', focusStage);
  Reveal.on('fragmenthidden', focusStage);
  if (Reveal.isReady()) focusStage();
})();

// Local illustration only: no model requests are made.
(() => {
  const slide = document.querySelector('.bb-budget-slide');
  if (!slide) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const channels = [
    { name: 'query', path: '#budget-query-path', duration: 4000, cycles: 3, delay: 0, label: 'k' },
    { name: 'surrogate', path: '#budget-surrogate-path', duration: 2500, cycles: 3, delay: 0, label: 'k' },
    { name: 'submission', path: '#budget-transfer-path', duration: 1800, cycles: 1, delay: 7500, label: '1' },
  ].map(channel => {
    const path = slide.querySelector(channel.path);
    return {
      ...channel, path, length: path.getTotalLength(), elapsed: 0, visible: false, stopped: false,
      endTime: channel.delay + channel.duration * channel.cycles,
      stage: slide.querySelector(`[data-call-stage="${channel.name}"]`),
      dot: slide.querySelector(`[data-call-dot="${channel.name}"]`),
      counter: slide.querySelector(`[data-call-count="${channel.name}"]`),
    };
  });
  let frame = 0;
  let previousTime = 0;

  const draw = (channel, finished = false) => {
    const progress = (channel.elapsed - channel.delay) / channel.duration;
    const waiting = channel.elapsed < channel.delay;
    channel.counter.textContent = channel.label;
    channel.dot.style.visibility = finished || waiting || channel.stopped || !channel.visible ? 'hidden' : 'visible';
    if (!finished && !waiting && !channel.stopped && channel.visible) {
      const point = channel.path.getPointAtLength((progress % 1) * channel.length);
      channel.dot.setAttribute('cx', point.x);
      channel.dot.setAttribute('cy', point.y);
    }
  };

  const tick = now => {
    frame = 0;
    const delta = previousTime ? now - previousTime : 0;
    previousTime = now;
    let moving = false;
    for (const channel of channels) {
      if (!channel.visible || channel.stopped) continue;
      channel.elapsed = Math.min(channel.elapsed + delta, channel.endTime);
      const finished = channel.elapsed >= channel.endTime;
      draw(channel, finished);
      moving ||= !finished;
    }
    if (moving) frame = requestAnimationFrame(tick);
  };

  const sync = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    const active = Reveal.getCurrentSlide() === slide;
    for (const channel of channels) {
      const visible = active && channel.stage.classList.contains('visible');
      if (!visible) channel.elapsed = 0;
      channel.visible = visible;
      channel.stopped = reducedMotion.matches;
      if (visible && reducedMotion.matches) channel.elapsed = channel.endTime;
      draw(channel, visible && channel.elapsed >= channel.endTime);
    }
    if (active && !document.hidden && !reducedMotion.matches &&
        channels.some(channel => channel.visible && !channel.stopped && channel.elapsed < channel.endTime)) {
      frame = requestAnimationFrame(tick);
    }
  };
  for (const event of ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden']) Reveal.on(event, sync);
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);
  if (Reveal.isReady()) sync();
})();

// Walk a single coordinate through the illustrative image; no model calls.
(() => {
  const slide = document.querySelector('.fd-coordinate-slide');
  if (!slide) return;
  const cells = [...slide.querySelectorAll('[data-scan-cell]')].map(element => ({
    element,
    x: Number(element.getAttribute('x')),
    y: Number(element.getAttribute('y')),
  }));
  const outline = slide.querySelector('.fd-image-outline');
  const cellSize = Number(cells[0].element.getAttribute('width'));
  const columns = Number(outline.getAttribute('width')) / cellSize;
  const rows = Number(outline.getAttribute('height')) / cellSize;
  const channelNames = ['R', 'G', 'B'];
  const valuesPerChannel = columns * rows;
  const totalCoordinates = valuesPerChannel * channelNames.length;
  const demoPixelsPerChannel = Math.min(4, valuesPerChannel);
  const demoCoordinates = demoPixelsPerChannel * channelNames.length;
  const phaseDuration = 400;
  const totalDuration = demoCoordinates * 3 * phaseDuration;
  const channelLabel = slide.querySelector('[data-scan-channel-label]');
  const planes = [...slide.querySelectorAll('[data-plane-offset]')].map(element => ({
    element, offset: Number(element.dataset.planeOffset),
  }));
  const indexLabel = slide.querySelector('[data-scan-index]');
  const phaseLabel = slide.querySelector('[data-scan-phase]');
  const phaseNames = ['Query −h', 'Query +h', 'Estimate gradient'];
  const phaseKeys = ['minus', 'plus', 'gradient'];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let elapsed = 0;
  let previousTime = null;
  let frame = 0;
  let lastStep = -1;
  let lastChannel = -1;

  const render = () => {
    const finished = elapsed >= totalDuration;
    const step = Math.min(Math.floor(elapsed / phaseDuration), demoCoordinates * 3 - 1);
    if (step === lastStep && !finished) return;
    lastStep = step;
    const demoCoordinate = Math.floor(step / 3);
    const channel = Math.floor(demoCoordinate / demoPixelsPerChannel);
    const pixel = demoCoordinate % demoPixelsPerChannel;
    const coordinate = channel * valuesPerChannel + pixel;
    const phase = step % 3;
    for (const cell of cells) {
      cell.element.setAttribute('x', cell.x + (pixel % columns) * cellSize);
      cell.element.setAttribute('y', cell.y + Math.floor(pixel / columns) * cellSize);
    }
    if (channel !== lastChannel) {
      for (const plane of planes) {
        const name = channelNames[(channel + plane.offset) % channelNames.length].toLowerCase();
        plane.element.setAttribute('fill', `url(#fd-grid-${name})`);
      }
      channelLabel.textContent = `Channel ${channelNames[channel]}`;
      lastChannel = channel;
    }
    slide.dataset.scanPhase = phaseKeys[phase];
    indexLabel.textContent = `i = ${coordinate + 1} / ${totalCoordinates}`;
    phaseLabel.textContent = finished ? 'Demo complete' : phaseNames[phase];
  };

  const tick = now => {
    frame = 0;
    if (previousTime !== null) elapsed = Math.min(elapsed + now - previousTime, totalDuration);
    previousTime = now;
    render();
    if (elapsed < totalDuration) frame = requestAnimationFrame(tick);
  };

  const sync = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = null;
    const active = Reveal.getCurrentSlide() === slide;
    if (!active) {
      elapsed = 0;
      lastStep = -1;
    }
    render();
    if (active && !document.hidden && !reducedMotion.matches && elapsed < totalDuration) {
      frame = requestAnimationFrame(tick);
    }
  };
  for (const event of ['ready', 'slidechanged']) Reveal.on(event, sync);
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);
  if (Reveal.isReady()) sync();
})();

// Fixed pixel-space illustrations, not an attack or a model evaluation.
(() => {
  const images = document.querySelectorAll('.bb-direct-search-slide [data-boundary-image]');
  const scales = { original: 0, start: 1, sideways: 1, inward: 175 / 275, rejected: 90 / 275, 'diversity-step-one': .4, 'diversity-step-two': .4 };
  for (const image of images) {
    const kind = image.dataset.boundaryImage;
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 8; column++) {
        const ring = row >= 2 && row <= 5 && column >= 2 && column <= 5 &&
          (row === 2 || row === 5 || column === 2 || column === 5);
        const original = ring ? 0.25 : 0.75;
        const horizontal = row % 2 ? 1 : -1;
        const vertical = column % 2 ? 1 : -1;
        // Orthogonal stripe patterns span the two plotted pixel-space directions.
        const direction = kind === 'start' ? 0.6 * vertical + 0.8 * horizontal :
          kind === 'diversity-step-two' ? horizontal + vertical : horizontal;
        const perturbation = 0.1 * scales[kind] * direction;
        const value = original + perturbation;
        const pixel = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        pixel.setAttribute('x', column * 18);
        pixel.setAttribute('y', row * 18);
        pixel.setAttribute('width', 18);
        pixel.setAttribute('height', 18);
        pixel.setAttribute('fill', `rgb(${value * 255} ${value * 255} ${value * 255})`);
        pixel.setAttribute('stroke', '#b7c3d8');
        pixel.setAttribute('stroke-width', '0.6');
        image.append(pixel);
      }
    }
  }
})();

// Play a finite storyboard. States are authored illustrations, not model outputs.
(() => {
  const demos = [...document.querySelectorAll('.reveal .slides > section.bb-direct-search-slide')].map(slide => ({
    slide,
    count: Number(slide.dataset.sceneCount),
    duration: Number(slide.dataset.sceneDuration),
    manual: slide.dataset.sceneControl === 'manual',
    steps: [...slide.querySelectorAll('[data-scene-step]')],
    elapsed: 0,
    state: -1,
    elements: [...slide.querySelectorAll('[data-scene]')].map(element => ({
      element, states: new Set(element.dataset.scene.trim().split(/\s+/).map(Number)),
    })),
  }));
  if (!demos.length) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let active = null;
  let frame = 0;
  let previousTime = null;

  const show = (demo, state) => {
    if (demo.state === state) return;
    demo.state = state;
    demo.slide.dataset.activeScene = String(state);
    for (const item of demo.elements) {
      const visible = item.states.has(state);
      item.element.classList.toggle('is-scene-visible', visible);
      item.element.setAttribute('aria-hidden', String(!visible));
    }
  };

  const tick = now => {
    frame = 0;
    if (!active) return;
    const end = (active.count - 1) * active.duration;
    if (previousTime !== null) active.elapsed = Math.min(active.elapsed + now - previousTime, end);
    previousTime = now;
    show(active, Math.min(Math.floor(active.elapsed / active.duration), active.count - 1));
    if (active.elapsed < end) frame = requestAnimationFrame(tick);
  };

  const sync = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = null;
    const current = Reveal.getCurrentSlide();
    active = null;
    for (const demo of demos) {
      if (demo.slide === current) {
        if (demo.manual) {
          let state = 0;
          for (const step of demo.steps) {
            if (step.classList.contains('visible')) state = Number(step.dataset.sceneStep);
          }
          show(demo, state);
        } else {
          active = demo;
          show(demo, reducedMotion.matches ? demo.count - 1 : Math.floor(demo.elapsed / demo.duration));
        }
      } else {
        demo.elapsed = 0;
        show(demo, 0);
      }
    }
    if (active && !document.hidden && !reducedMotion.matches &&
        active.elapsed < (active.count - 1) * active.duration) {
      frame = requestAnimationFrame(tick);
    }
  };
  for (const event of ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden']) Reveal.on(event, sync);
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);
  if (Reveal.isReady()) sync();
})();
