(() => {

  const cotSlide = document.querySelector(".cot-theft-slide");
  const cotStream = cotSlide?.querySelector("[data-cot-stream]");
  const cotChoice = cotSlide?.querySelector("[data-cot-choice]");
  const cotPrimaryLogit = cotSlide?.querySelector("[data-cot-logit-primary]");
  const cotAltLogit1 = cotSlide?.querySelector("[data-cot-logit-alt-1]");
  const cotAltLogit2 = cotSlide?.querySelector("[data-cot-logit-alt-2]");
  const cotCounter = cotSlide?.querySelector("[data-cot-counter]");
  const cotJsonResult = cotSlide?.querySelector("[data-cot-json-result]");
  const cotEncryptionArrow = cotSlide?.querySelector("[data-cot-encryption-arrow]");
  const cotGenerationTrigger = cotSlide?.querySelector(".cot-generation-trigger");
  const cotEncryptionTrigger = cotSlide?.querySelector(".cot-encryption-trigger");

  if (
    cotSlide
    && cotStream
    && cotChoice
    && cotPrimaryLogit
    && cotAltLogit1
    && cotAltLogit2
    && cotCounter
    && cotJsonResult
    && cotEncryptionArrow
    && cotGenerationTrigger
    && cotEncryptionTrigger
  ) {
    const cotLines = [
      { kind: "tag", tokens: ["<thinking>"] },
      { kind: "reasoning", tokens: ["Expand", "the", "left", "side:", "3x", "−", "12", "+", "2", "=", "2x", "+", "9."] },
      { kind: "reasoning", tokens: ["Combine", "constants:", "3x", "−", "10", "=", "2x", "+", "9."] },
      { kind: "reasoning", tokens: ["Subtract", "2x:", "x", "−", "10", "=", "9."] },
      { kind: "reasoning", tokens: ["Add", "10:", "x", "=", "19."] },
      { kind: "reasoning", tokens: ["Check:", "3", "(", "19", "−", "4", ")", "+", "2", "=", "47", ";", "2", "(", "19", ")", "+", "9", "=", "47."] },
      { kind: "tag", tokens: ["</thinking>"] },
      { kind: "answer", tokens: ["x", "=", "19."] }
    ];

    const cotAlternatives = {
      "<thinking>": ["Answer", "We"],
      "</thinking>": ["Therefore", "Answer"],
      "=": ["≈", "is"],
      "+": ["−", "×"],
      "−": ["+", "×"],
      "Expand": ["Solve", "Simplify"],
      "Combine": ["Expand", "Collect"],
      "Subtract": ["Add", "Divide"],
      "Add": ["Subtract", "Divide"],
      "Check:": ["Therefore", "Verify:"],
      "left": ["right", "both"],
      "side:": ["equation:", "terms:"],
      "constants:": ["terms:", "coefficients:"],
      "3x": ["2x", "x"],
      "2x": ["3x", "x"],
      "x": ["2x", "3x"],
      "12": ["10", "9"],
      "10": ["12", "9"],
      "9.": ["10.", "19."],
      "19": ["9", "20"],
      "19.": ["9.", "20."],
      "47": ["46", "48"],
      "47.": ["46.", "48."],
      "(": ["[", "{"],
      ")": ["]", "}"]
    };

    const cotTokenEntries = [];
    cotLines.forEach(({ kind, tokens }) => {
      const line = document.createElement("span");
      line.className = `cot-stream-line cot-stream-${kind}`;
      if (kind === "reasoning") line.classList.add("cot-stream-indent");

      tokens.forEach((token) => {
        const tokenElement = document.createElement("span");
        tokenElement.className = "cot-stream-token";
        tokenElement.textContent = `${token} `;
        line.append(tokenElement);
        cotTokenEntries.push({ token, element: tokenElement });
      });

      cotStream.append(line);
    });

    const fitLogit = (token) => token.length > 13 ? `${token.slice(0, 12)}…` : token;
    const fitChoice = (token) => token.length > 9 ? `${token.slice(0, 8)}…` : token;
    const genericAlternatives = (token) => {
      if (/^\d/.test(token)) return ["0", "1"];
      if (/^[A-Z]/.test(token)) return ["The", "We"];
      return ["therefore", "value"];
    };

    let cotRevealedCount = 0;
    let cotArrivalTimer;
    let cotGapTimer;
    let cotEncryptionQueued = false;

    const clearCotTimers = () => {
      window.clearTimeout(cotArrivalTimer);
      window.clearTimeout(cotGapTimer);
      cotArrivalTimer = undefined;
      cotGapTimer = undefined;
    };

    const setCotCandidate = (index) => {
      const token = cotTokenEntries[index].token;
      const [alternative1, alternative2] = cotAlternatives[token] ?? genericAlternatives(token);
      cotPrimaryLogit.textContent = fitLogit(token);
      cotAltLogit1.textContent = fitLogit(alternative1);
      cotAltLogit2.textContent = fitLogit(alternative2);
      cotChoice.textContent = fitChoice(token);
      cotCounter.textContent = `TOKEN ${index + 1}`;
      cotSlide.dataset.cotTokenIndex = String(index);
      cotSlide.dataset.cotToken = token;
    };

    const renderCotTokens = () => {
      cotTokenEntries.forEach(({ element }, index) => {
        element.classList.toggle("is-visible", index < cotRevealedCount);
        element.classList.toggle("is-current", index === cotRevealedCount - 1);
      });
      cotStream.querySelectorAll(".cot-stream-answer").forEach((line) => {
        line.classList.toggle("is-visible", Boolean(line.querySelector(".cot-stream-token.is-visible")));
      });
    };

    const setCotDecorativePlayback = (play) => {
      cotSlide.querySelectorAll(".cot-prefill-stage .transformer-architecture > rect, .cot-prefill-stage .qkv-matrix, .cot-prefill-stage .network-backbone, .cot-prefill-stage .matrix-arrow, .cot-prefill-stage .matrix-grid")
        .forEach((element) => {
          element.getAnimations().forEach((animation) => {
            if (play) {
              animation.play();
            } else {
              animation.pause();
              animation.currentTime = 0;
            }
          });
        });
    };

    const hideCotEncryption = () => {
      cotJsonResult.classList.remove("is-visible");
      cotEncryptionArrow.classList.remove("is-visible");
    };

    const showCotEncryption = () => {
      if (cotSlide.dataset.cotPlayback !== "complete") {
        cotEncryptionQueued = true;
        return;
      }
      cotJsonResult.classList.add("is-visible");
      cotEncryptionArrow.classList.add("is-visible");
    };

    const completeCotGeneration = () => {
      clearCotTimers();
      cotSlide.classList.remove("cot-generating");
      cotSlide.classList.add("cot-generation-complete");
      cotSlide.dataset.cotPlayback = "complete";
      cotCounter.textContent = `COMPLETE · ${cotTokenEntries.length} TOKENS`;
      setCotDecorativePlayback(false);
      if (cotEncryptionQueued || cotEncryptionTrigger.classList.contains("visible")) showCotEncryption();
    };

    const playNextCotToken = () => {
      if (cotRevealedCount >= cotTokenEntries.length) {
        completeCotGeneration();
        return;
      }

      setCotCandidate(cotRevealedCount);
      cotArrivalTimer = window.setTimeout(() => {
        cotRevealedCount += 1;
        renderCotTokens();
        if (cotRevealedCount >= cotTokenEntries.length) {
          completeCotGeneration();
        } else {
          cotGapTimer = window.setTimeout(playNextCotToken, 60);
        }
      }, 275);
    };

    const resetCotDemo = () => {
      clearCotTimers();
      cotRevealedCount = 0;
      cotEncryptionQueued = false;
      cotSlide.classList.remove("cot-generating", "cot-generation-complete");
      cotSlide.dataset.cotPlayback = "ready";
      cotPrimaryLogit.textContent = "";
      cotAltLogit1.textContent = "";
      cotAltLogit2.textContent = "";
      cotChoice.textContent = "";
      cotCounter.textContent = "READY";
      delete cotSlide.dataset.cotTokenIndex;
      delete cotSlide.dataset.cotToken;
      renderCotTokens();
      setCotDecorativePlayback(false);
      hideCotEncryption();
    };

    const startCotGeneration = () => {
      if (cotSlide.dataset.cotPlayback === "decoding") return;
      resetCotDemo();
      cotSlide.classList.add("cot-generating");
      cotSlide.dataset.cotPlayback = "decoding";
      setCotDecorativePlayback(true);
      playNextCotToken();
    };

    const cotEventFragments = (fragment, fragments) => [...new Set([fragment, ...fragments])];
    const initializeCotDemo = () => {
      resetCotDemo();

      Reveal.on("slidechanged", ({ previousSlide, currentSlide }) => {
        if (previousSlide === cotSlide) resetCotDemo();
        if (currentSlide !== cotSlide) return;
        resetCotDemo();
        if (cotGenerationTrigger.classList.contains("visible")) startCotGeneration();
        if (cotEncryptionTrigger.classList.contains("visible")) showCotEncryption();
      });

      Reveal.on("fragmentshown", ({ fragment, fragments = [] }) => {
        cotEventFragments(fragment, fragments).forEach((item) => {
          if (item === cotGenerationTrigger) startCotGeneration();
          if (item === cotEncryptionTrigger) showCotEncryption();
        });
      });

      Reveal.on("fragmenthidden", ({ fragment, fragments = [] }) => {
        const hidden = cotEventFragments(fragment, fragments);
        if (hidden.includes(cotGenerationTrigger)) resetCotDemo();
        if (hidden.includes(cotEncryptionTrigger)) hideCotEncryption();
      });

      document.documentElement.dataset.cotTokenDemoReady = "true";
    };

    if (typeof Reveal !== "undefined") {
      if (typeof Reveal.isReady === "function" && Reveal.isReady()) {
        initializeCotDemo();
      } else {
        Reveal.on("ready", initializeCotDemo);
      }
    }
  }
  const fitArchitectureDecodeTokenBoxes = () => {
    document.querySelectorAll(
      ".untargeted-slide.present .generated-sequence .sentence-token, "
      + ".targeted-slide.present .generated-sequence .sentence-token"
    ).forEach((token) => {
      const rect = token.querySelector("rect");
      const text = token.querySelector("text");
      if (!rect || !text || typeof text.getBBox !== "function") return;

      const bounds = text.getBBox();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      rect.setAttribute("x", String(bounds.x - 2.5));
      rect.setAttribute("y", String(bounds.y - 2));
      rect.setAttribute("width", String(bounds.width + 5));
      rect.setAttribute("height", String(bounds.height + 4));
    });
  };

  fitArchitectureDecodeTokenBoxes();
  document.fonts?.ready.then(fitArchitectureDecodeTokenBoxes);
  Reveal.on("ready", fitArchitectureDecodeTokenBoxes);
  Reveal.on("slidechanged", fitArchitectureDecodeTokenBoxes);


  const stagedAnimationTimers = new WeakMap();

  const stagedAnimationGroups = (slide) =>
    slide ? [...slide.querySelectorAll("[data-staged-animation]")] : [];

  const stagedAnimationGroup = (slide, id) =>
    stagedAnimationGroups(slide).find((group) => group.dataset.stagedAnimation === id);

  const clearStagedAnimationTimer = (group) => {
    const timer = stagedAnimationTimers.get(group);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      stagedAnimationTimers.delete(group);
    }
  };

  const seekStagedAnimation = (group, time, play) => {
    clearStagedAnimationTimer(group);

    group.getAnimations({ subtree: true }).forEach((animation) => {
      const duration = Number(animation.effect?.getTiming()?.duration);
      const isTimeline = Number.isFinite(duration) && duration >= 2000;
      if (!isTimeline) {
        if (play) animation.play();
        else animation.pause();
        return;
      }
      animation.pause();
      animation.currentTime = time;
      if (play) animation.play();
    });

    group.querySelectorAll("svg").forEach((svg) => {
      if (typeof svg.pauseAnimations !== "function" || typeof svg.setCurrentTime !== "function") return;
      svg.pauseAnimations();
      svg.setCurrentTime(time / 1000);
      if (play && typeof svg.unpauseAnimations === "function") svg.unpauseAnimations();
    });
  };
  const setStagedAnimationExplanation = (slide, target, visible) => {
    slide.querySelectorAll(`[data-animation-explanation-for="${target}"]`).forEach((explanation) => {
      explanation.classList.toggle("is-visible", visible);
    });
  };


  const playStagedAnimation = (trigger) => {
    const slide = trigger.closest("section");
    const group = stagedAnimationGroup(slide, trigger.dataset.animationTarget);
    if (!group) return;


    const start = Number(trigger.dataset.animationStart);
    const end = Number(trigger.dataset.animationEnd);
    setStagedAnimationExplanation(slide, trigger.dataset.animationTarget, false);
    seekStagedAnimation(group, start, true);
    stagedAnimationTimers.set(group, window.setTimeout(() => {
      seekStagedAnimation(group, end, false);
      if (trigger.dataset.animationRevealExplanation === "true") {
        setStagedAnimationExplanation(slide, trigger.dataset.animationTarget, true);
      }
    }, end - start));
  };

  const restoreStagedAnimationSlide = (slide) => {
    if (!slide) return;

    slide.querySelectorAll(".staged-animation-explanation").forEach((explanation) => {
      explanation.classList.remove("is-visible");
    });

    stagedAnimationGroups(slide).forEach((group) => seekStagedAnimation(group, 0, false));

    const latestSegmentByTarget = new Map();
    [...slide.querySelectorAll(".staged-animation-trigger.visible")].forEach((trigger) => {
      latestSegmentByTarget.set(trigger.dataset.animationTarget, trigger);
    });

    latestSegmentByTarget.forEach((trigger) => {
      const group = stagedAnimationGroup(slide, trigger.dataset.animationTarget);
      seekStagedAnimation(group, Number(trigger.dataset.animationEnd), false);
      if (trigger.dataset.animationRevealExplanation === "true") {
        setStagedAnimationExplanation(slide, trigger.dataset.animationTarget, true);
      }
    });
  };

  const initializeStagedAnimations = () => {
    document.querySelectorAll("[data-staged-animation]").forEach((group) => {
      seekStagedAnimation(group, 0, false);
    });
    restoreStagedAnimationSlide(Reveal.getCurrentSlide());

    Reveal.on("slidechanged", ({ previousSlide, currentSlide }) => {
      stagedAnimationGroups(previousSlide).forEach((group) => clearStagedAnimationTimer(group));
      restoreStagedAnimationSlide(currentSlide);
    });

    Reveal.on("fragmentshown", ({ fragment, fragments = [] }) => {
      [...new Set([fragment, ...fragments])]
        .filter((item) => item?.classList.contains("staged-animation-trigger"))
        .forEach(playStagedAnimation);
    });

    Reveal.on("fragmenthidden", ({ fragment, fragments = [] }) => {
      const trigger = [...new Set([fragment, ...fragments])]
        .find((item) => item?.classList.contains("staged-animation-trigger"));
      if (trigger) restoreStagedAnimationSlide(trigger.closest("section"));
    });

    document.documentElement.dataset.stagedAnimationsReady = "true";
  };

  if (typeof Reveal !== "undefined") {
    if (typeof Reveal.isReady === "function" && Reveal.isReady()) {
      initializeStagedAnimations();
    } else {
      Reveal.on("ready", initializeStagedAnimations);
    }
  }

  const initializeCompatAttackFlow = () => {
    const slide = document.querySelector(".compat-attack-slide");
    if (!slide) return;

    const stageMs = {
      0: 800, 1: 1000, 2: 0, 3: 900, 4: 800,
      5: 800, 6: 900, 7: 900, 8: 0, 9: 900, 10: 800,
      11: 800, 12: 900, 13: 1200, 14: 0, 15: 900, 16: 800
    };

    const rightFor = (stage, phase) => {
      if (stage < 0) return "idle";
      const play = phase === "play" || phase === "reset";
      const rows = [
        [play ? "idle" : "s1-req"],
        ["s1-decode"],
        ["s1-build"],
        [play ? "s1-encrypt" : "s1-res"],
        ["s1-res"],
        [play ? "idle" : "s2-req"],
        [play ? "s2-decrypt" : "s2-decrypted"],
        ["s2-decode"],
        ["s2-build"],
        [play ? "s2-encrypt" : "s2-res"],
        ["s2-res"],
        [play ? "idle" : "s3-req"],
        [play ? "s3-decrypt" : "s3-decrypted"],
        ["s3-decode"],
        ["s3-build"],
        [play ? "s3-encrypt" : "s3-res"],
        ["s3-res"]
      ];
      const row = rows[stage];
      return row[0];
    };

    const iconFor = (stage, phase) => {
      if (phase !== "play") return "none";
      if (stage === 0) return "req-blue";
      if (stage === 4) return "res-blue";
      if (stage === 5 || stage === 11) return "req-red";
      if (stage === 10 || stage === 16) return "res-red";
      return "none";
    };

    const capFor = (stage, phase) => {
      if (stage < 0) return "idle";
      if (phase === "play" && (stage === 0 || stage === 5 || stage === 11)) return stage === 0 ? "idle" : (stage === 5 ? "s1r" : "s2r");
      if (phase === "play" && (stage === 4 || stage === 10 || stage === 16)) {
        return stage === 4 ? "s1e" : (stage === 10 ? "s2e" : "s3e");
      }
      const doneCaps = ["s1", "s1d", "s1b", "s1e", "s1r", "s2", "s2d", "s2k", "s2b", "s2e", "s2r", "s3req", "s3d", "s3k", "s3b", "s3e", "s3"];
      return doneCaps[stage] || "idle";
    };

    let timer;
    const clearTimer = () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };

    const highestStage = () => {
      let max = -1;
      slide.querySelectorAll(".compat-step-trigger.visible").forEach((trigger) => {
        const index = Number(trigger.dataset.fragmentIndex);
        if (Number.isFinite(index) && index > max) max = index;
      });
      return max;
    };

    const applyState = (stage, phase) => {
      const live = phase === "play" || phase === "reset";
      const s1 = (stage > 4 || (stage === 4 && !live)) ? "answer" : "wait";
      const s2 = (stage < 5 || stage >= 11) ? "off" : ((stage === 10 && !live) ? "answer" : "wait");
      const s3 = stage < 11 ? "off" : ((stage === 16 && !live) ? "answer" : "wait");
      slide.dataset.compatStage = String(stage);
      slide.dataset.compatPhase = phase;
      slide.dataset.compatRight = rightFor(stage, phase);
      slide.dataset.compatIcon = iconFor(stage, phase);
      slide.dataset.compatS1 = s1;
      slide.dataset.compatS2 = s2;
      slide.dataset.compatS3 = s3;
      slide.dataset.compatModel = stage >= 11 ? "haiku" : "opus";
      slide.dataset.compatCap = capFor(stage, phase);
    };

    const freezeStage = (stage) => {
      clearTimer();
      applyState(stage, "done");
    };

    const playStage = (stage) => {
      clearTimer();
      const duration = stageMs[stage] ?? 0;
      if (duration <= 0) {
        freezeStage(stage);
        return;
      }
      applyState(stage, "reset");
      void slide.offsetWidth;
      applyState(stage, "play");
      timer = window.setTimeout(() => freezeStage(stage), duration);
    };

    const restoreFrozen = () => freezeStage(highestStage());

    const isCompatTrigger = (item) => item?.classList?.contains("compat-step-trigger");

    restoreFrozen();

    Reveal.on("slidechanged", ({ previousSlide, currentSlide }) => {
      if (previousSlide === slide) clearTimer();
      if (currentSlide === slide) restoreFrozen();
    });

    Reveal.on("fragmentshown", ({ fragment, fragments = [] }) => {
      const items = [...new Set([fragment, ...fragments])].filter(isCompatTrigger);
      if (!items.length || Reveal.getCurrentSlide() !== slide) return;
      playStage(highestStage());
    });

    Reveal.on("fragmenthidden", ({ fragment, fragments = [] }) => {
      const items = [...new Set([fragment, ...fragments])].filter(isCompatTrigger);
      if (!items.length || Reveal.getCurrentSlide() !== slide) return;
      restoreFrozen();
    });

    document.documentElement.dataset.compatAttackFlowReady = "true";
  };

  if (typeof Reveal !== "undefined") {
    if (typeof Reveal.isReady === "function" && Reveal.isReady()) {
      initializeCompatAttackFlow();
    } else {
      Reveal.on("ready", initializeCompatAttackFlow);
    }
  }




  renderBoundary();
  renderDeepFool();
  document.documentElement.dataset.lectureInteractionsReady = "true";
})();
