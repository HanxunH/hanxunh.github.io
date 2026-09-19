(() => {
  const demoSlides = [...document.querySelectorAll('.demo-slide')];

  const syncDemoStep = (slide) => {
    const visible = [...slide.querySelectorAll('.demo-trigger.visible')]
      .map((item) => Number(item.dataset.fragmentIndex))
      .filter(Number.isFinite);
    const step = visible.length ? Math.max(...visible) + 1 : 0;
    slide.dataset.demoStep = String(step);
  };

  const syncAllDemos = () => demoSlides.forEach(syncDemoStep);

  const initNormDemo = () => {
    const slide = document.querySelector('.norm-demo-slide');
    if (!slide) return;

    const buttons = [...slide.querySelectorAll('[data-norm-choice]')];
    const strength = slide.querySelector('#norm-strength');
    const output = slide.querySelector('output[for="norm-strength"]');
    const imageFigure = slide.querySelector('.norm-image-figure');
    const canvas = slide.querySelector('.norm-perturbed-canvas');
    const noiseStatus = slide.querySelector('[data-noise-status]');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const textureCanvas = document.createElement('canvas');
    const textureContext = textureCanvas.getContext('2d', { willReadFrequently: true });
    const size = canvas.width;
    textureCanvas.width = size;
    textureCanvas.height = size;

    const loadImage = (src) => {
      const image = new Image();
      image.src = src;
      return image.decode().then(() => image);
    };

    let sourceImage;
    const textures = {};

    const drawCover = (target, image) => {
      const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
      const sourceWidth = size / scale;
      const sourceHeight = size / scale;
      const sourceX = (image.naturalWidth - sourceWidth) / 2;
      const sourceY = (image.naturalHeight - sourceHeight) * 0.48;
      target.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, size, size);
    };

    const update = () => {
      const norm = slide.dataset.norm || 'l2';
      const strengthLevel = Number(strength.value);
      const scaledStrength = strengthLevel / 255;
      const visibility = strengthLevel <= 8 ? 'subtle' : strengthLevel <= 32 ? 'mid' : 'strong';

      buttons.forEach((button) => {
        const active = button.dataset.normChoice === norm;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      output.value = norm === 'linf' ? `${strengthLevel}/255` : `${Math.round(scaledStrength * 100)}%`;
      output.textContent = output.value;
      imageFigure.dataset.visibility = visibility;

      if (!sourceImage || !textures[norm]) return;

      context.clearRect(0, 0, size, size);
      drawCover(context, sourceImage);
      const base = context.getImageData(0, 0, size, size);
      const perturbed = new ImageData(new Uint8ClampedArray(base.data), size, size);

      textureContext.clearRect(0, 0, size, size);
      textureContext.imageSmoothingEnabled = false;
      textureContext.drawImage(textures[norm], 0, 0, size, size);
      const texture = textureContext.getImageData(0, 0, size, size).data;
      const representativeAmplitude = scaledStrength * 255;
      let maxPixelChange = 0;
      let changedComponents = 0;

      for (let index = 0; index < perturbed.data.length; index += 4) {
        for (let channel = 0; channel < 3; channel += 1) {
          const offset = index + channel;
          const centeredNoise = (texture[offset] - 127.5) / 127.5;
          let change;
          if (norm === 'l1') change = Math.abs(centeredNoise) > 0.8 ? Math.sign(centeredNoise) * representativeAmplitude : 0;
          else if (norm === 'l2') change = centeredNoise * representativeAmplitude;
          else change = Math.sign(centeredNoise) * strengthLevel;

          const original = base.data[offset];
          const updated = Math.max(0, Math.min(255, original + change));
          const appliedChange = Math.abs(updated - original);
          perturbed.data[offset] = updated;
          maxPixelChange = Math.max(maxPixelChange, appliedChange);
          if (appliedChange >= 0.5) changedComponents += 1;
        }
      }

      context.putImageData(perturbed, 0, 0);
      canvas.dataset.maxPixelChange = maxPixelChange.toFixed(2);
      canvas.dataset.changedFraction = (changedComponents / (size * size * 3)).toFixed(4);
      noiseStatus.textContent = visibility === 'subtle'
        ? 'Noise is hard to see'
        : visibility === 'mid'
          ? norm === 'l1' ? 'Sparse changes are becoming visible' : 'Distributed noise is becoming visible'
          : norm === 'l1' ? 'Sparse pixel changes are visible' : norm === 'l2' ? 'Distributed noise is clearly visible' : 'Bounded per-pixel noise is clearly visible';
    };

    buttons.forEach((button) => button.addEventListener('click', () => {
      slide.dataset.norm = button.dataset.normChoice;
      update();
    }));
    strength.addEventListener('input', update);
    [strength, ...buttons].forEach((control) => {
      control.addEventListener('keydown', (event) => event.stopPropagation());
      control.addEventListener('keyup', (event) => event.stopPropagation());
    });

    Promise.all([
      loadImage('cat-norm-demo.jpg'),
      loadImage('noise-l1.png'),
      loadImage('noise-l2.png'),
      loadImage('noise-linf.png')
    ]).then(([source, l1, l2, linf]) => {
      sourceImage = source;
      textures.l1 = l1;
      textures.l2 = l2;
      textures.linf = linf;
      update();
    });
    update();
  };

  const drawVectorFields = () => {
    const specs = [
      { selector: '.gradient-field', mode: 'gradient', marker: 'raw-vector-arrow' },
      { selector: '.sign-field', mode: 'sign', marker: 'sign-vector-arrow' },
      { selector: '.normalized-field', mode: 'normalized', marker: 'normalized-vector-arrow' }
    ];
    const ns = 'http://www.w3.org/2000/svg';

    specs.forEach(({ selector, mode, marker }) => {
      const group = document.querySelector(selector);
      if (!group || group.childElementCount) return;

      for (let gy = 55; gy <= 245; gy += 48) {
        for (let gx = 55; gx <= 305; gx += 50) {
          const dx = gx - 180;
          const dy = gy - 150;
          const norm = Math.hypot(dx, dy) || 1;
          let ux = dx / norm;
          let uy = dy / norm;
          let length = 40;
          if (mode === 'gradient') length = Math.min(62, 6 + norm * 0.34);
          if (mode === 'sign') {
            ux = Math.sign(dx) / Math.SQRT2;
            uy = Math.sign(dy) / Math.SQRT2;
          }
          const line = document.createElementNS(ns, 'line');
          line.setAttribute('class', 'vector-arrow');
          line.setAttribute('x1', String(gx - ux * length * 0.25));
          line.setAttribute('y1', String(gy - uy * length * 0.25));
          line.setAttribute('x2', String(gx + ux * length * 0.75));
          line.setAttribute('y2', String(gy + uy * length * 0.75));
          line.setAttribute('marker-end', `url(#${marker})`);
          group.append(line);
        }
      }
    });
  };

  drawVectorFields();
  initNormDemo();
  syncAllDemos();

  if (typeof Reveal !== 'undefined') {
    const initialize = () => {
      syncAllDemos();
      document.documentElement.dataset.lecture16InteractionsReady = 'true';
    };

    if (typeof Reveal.isReady === 'function' && Reveal.isReady()) initialize();
    else Reveal.on('ready', initialize);

    Reveal.on('slidechanged', ({ currentSlide }) => {
      if (currentSlide?.classList.contains('demo-slide')) syncDemoStep(currentSlide);
    });
    Reveal.on('fragmentshown', ({ fragment, fragments = [] }) => {
      const items = [fragment, ...fragments];
      const slide = items.find((item) => item?.closest?.('.demo-slide'))?.closest('.demo-slide');
      if (slide) syncDemoStep(slide);
    });
    Reveal.on('fragmenthidden', ({ fragment, fragments = [] }) => {
      const items = [fragment, ...fragments];
      const slide = items.find((item) => item?.closest?.('.demo-slide'))?.closest('.demo-slide');
      if (slide) syncDemoStep(slide);
    });
  }
})();
