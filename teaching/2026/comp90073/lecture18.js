// Lecture 17's manual storyboard pattern: Next changes authored state, not model output.
(() => {
  const parseStates = value => new Set(value.trim().split(/\s+/).map(Number));
  const demos = [...document.querySelectorAll('.reveal .slides > section.l18-slide[data-scene-count]')].map(slide => ({
    slide,
    count: Number(slide.dataset.sceneCount),
    steps: [...slide.querySelectorAll('[data-scene-step]')],
    state: -1,
    elements: [...slide.querySelectorAll('[data-scene], [data-focus], [data-dim]')].map(element => ({
      element,
      visible: element.hasAttribute('data-scene') ? parseStates(element.dataset.scene) : null,
      focus: element.hasAttribute('data-focus') ? parseStates(element.dataset.focus) : null,
      dim: element.hasAttribute('data-dim') ? parseStates(element.dataset.dim) : null,
    })),
  }));
  const show = (demo, state) => {
    if (demo.state === state) return;
    demo.state = state;
    demo.slide.dataset.activeScene = String(state);
    for (const item of demo.elements) {
      if (item.visible) {
        const visible = item.visible.has(state);
        item.element.classList.toggle('is-scene-visible', visible);
        item.element.setAttribute('aria-hidden', String(!visible));
        item.element.inert = !visible;
      }
      if (item.focus) item.element.classList.toggle('is-focused', item.focus.has(state));
      if (item.dim) item.element.classList.toggle('is-dimmed', item.dim.has(state));
    }
  };
  const sync = () => {
    const current = Reveal.getCurrentSlide();
    for (const demo of demos) {
      let state = 0;
      if (demo.slide === current) {
        for (const step of demo.steps) {
          if (step.classList.contains('visible')) state = Math.max(state, Number(step.dataset.sceneStep));
        }
      }
      show(demo, Math.min(state, demo.count - 1));
    }
  };
  for (const event of ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden']) Reveal.on(event, sync);
  if (Reveal.isReady()) sync();
})();
