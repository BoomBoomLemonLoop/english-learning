(function () {
  "use strict";

  const cards = Array.isArray(window.VOCAB_CARDS) ? window.VOCAB_CARDS : [];
  const units = Array.isArray(window.HOME_UNITS) ? window.HOME_UNITS : [];
  const supportsSpeech = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

  const elements = {
    brandMark: document.getElementById("brand-mark"),
    headerSummary: document.getElementById("header-summary"),
    unitOverview: document.getElementById("unit-overview"),
    unitSelect: document.getElementById("unit-select"),
    unitChips: document.getElementById("unit-chips"),
    previousUnit: document.getElementById("previous-unit"),
    nextUnit: document.getElementById("next-unit"),
    startCard: document.getElementById("start-card"),
    voiceSelect: document.getElementById("voice-select"),
    intervalRange: document.getElementById("interval-range"),
    intervalValue: document.getElementById("interval-value"),
    rateRange: document.getElementById("rate-range"),
    rateValue: document.getElementById("rate-value"),
    playButton: document.getElementById("play-button"),
    playIcon: document.querySelector("#play-button .play-icon"),
    playLabel: document.querySelector("#play-button .play-label"),
    prevButton: document.getElementById("prev-button"),
    nextButton: document.getElementById("next-button"),
    randomButton: document.getElementById("random-button"),
    speakButton: document.getElementById("speak-button"),
    currentImage: document.getElementById("current-image"),
    currentNumber: document.getElementById("current-number"),
    currentSection: document.getElementById("current-section"),
    currentWord: document.getElementById("current-word"),
    currentChinese: document.getElementById("current-chinese"),
    progressCopy: document.getElementById("progress-copy"),
    progressBar: document.getElementById("study-progress-bar"),
    cardGrid: document.getElementById("card-grid"),
    filterTabs: document.getElementById("filter-tabs"),
    libraryTitle: document.getElementById("library-title"),
    libraryCount: document.getElementById("library-count"),
    footerUnit: document.getElementById("footer-unit"),
    ttsState: document.getElementById("tts-state"),
    ttsStateText: document.getElementById("tts-state-text"),
    liveStatus: document.getElementById("live-status"),
    modeInputs: Array.from(document.querySelectorAll('input[name="play-mode"]'))
  };

  const state = {
    currentUnit: units[0] ? units[0].unit : "25",
    currentIndex: 0,
    filter: "all",
    mode: "sequence",
    interval: 3,
    rate: 1,
    voiceURI: "",
    voices: [],
    playing: false,
    timer: null,
    speechToken: 0,
    announcedUnavailable: false
  };

  function unitMeta(unitId) {
    return units.find(function (unit) { return unit.unit === String(unitId); }) || null;
  }

  function cardsForUnit(unitId) {
    return cards.filter(function (card) { return card.unit === String(unitId || state.currentUnit); });
  }

  function filteredCards() {
    const unitCards = cardsForUnit();
    if (state.filter === "all") return unitCards;
    return unitCards.filter(function (card) { return card.section === state.filter; });
  }

  function currentCard() {
    const selected = cards[state.currentIndex];
    if (selected && selected.unit === state.currentUnit) return selected;
    return cardsForUnit()[0] || cards[0];
  }

  function readPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem("dailyEnglishHome25to41") || "{}");
      if (Number(saved.interval) >= 1 && Number(saved.interval) <= 12) state.interval = Number(saved.interval);
      if (Number(saved.rate) >= 0.6 && Number(saved.rate) <= 1.4) state.rate = Number(saved.rate);
      if (saved.mode === "random" || saved.mode === "sequence") state.mode = saved.mode;
      if (typeof saved.voiceURI === "string") state.voiceURI = saved.voiceURI;
      if (typeof saved.currentId === "string") {
        const savedIndex = cards.findIndex(function (card) { return card.id === saved.currentId; });
        if (savedIndex >= 0) {
          state.currentIndex = savedIndex;
          state.currentUnit = cards[savedIndex].unit;
        }
      } else if (unitMeta(saved.currentUnit)) {
        state.currentUnit = saved.currentUnit;
        const first = cardsForUnit(saved.currentUnit)[0];
        if (first) state.currentIndex = first.index;
      }
    } catch (error) {
      // Storage is optional.
    }
  }

  function savePreferences() {
    try {
      localStorage.setItem("dailyEnglishHome25to41", JSON.stringify({
        interval: state.interval,
        rate: state.rate,
        mode: state.mode,
        voiceURI: state.voiceURI,
        currentUnit: state.currentUnit,
        currentId: currentCard() ? currentCard().id : ""
      }));
    } catch (error) {
      // Ignore privacy-mode or quota errors.
    }
  }

  function cleanSpeechText(text) {
    const variants = String(text || "")
      .replace(/\s*\((?:US|UK)\)\s*/gi, " ")
      .split(/\s*\/\s*/)
      .map(function (part) { return part.replace(/\s+/g, " ").trim(); })
      .filter(Boolean);
    return variants.length ? variants.join(". ") + "." : "";
  }

  window.cleanSpeechText = cleanSpeechText;

  function announce(message) {
    elements.liveStatus.textContent = "";
    window.setTimeout(function () { elements.liveStatus.textContent = message; }, 20);
  }

  function setTtsStatus(message, unavailable) {
    elements.ttsStateText.textContent = message;
    elements.ttsState.classList.toggle("unavailable", Boolean(unavailable));
  }

  function fallbackImage(card) {
    const label = (card && card.zh) || "插图";
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440">',
      '<rect width="640" height="440" fill="#edf1ed"/>',
      '<path d="M155 235 320 100l165 135v145H155Z" fill="#f1c86f" stroke="#315f50" stroke-width="12"/>',
      '<path d="m125 245 195-160 195 160" fill="none" stroke="#d75b42" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"/>',
      '<rect x="283" y="270" width="74" height="110" rx="4" fill="#315f50"/>',
      '<rect x="192" y="257" width="58" height="58" fill="#7598a5" stroke="#fff" stroke-width="10"/>',
      '<rect x="390" y="257" width="58" height="58" fill="#7598a5" stroke="#fff" stroke-width="10"/>',
      '<text x="320" y="420" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#69736e">' + label + "</text>",
      "</svg>"
    ].join("");
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }

  function handleImageError(event, card) {
    const image = event.currentTarget;
    if (image.dataset.fallback === "true") return;
    image.dataset.fallback = "true";
    image.src = fallbackImage(card);
  }

  function renderUnitControls() {
    elements.unitSelect.innerHTML = "";
    elements.unitChips.innerHTML = "";
    units.forEach(function (unit) {
      const option = document.createElement("option");
      option.value = unit.unit;
      option.textContent = unit.unit + " · " + unit.title + " · " + unit.count + " 张";
      elements.unitSelect.appendChild(option);

      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "unit-chip";
      chip.dataset.unit = unit.unit;
      chip.textContent = unit.unit;
      chip.title = "第" + unit.unit + "单元 · " + unit.title;
      chip.setAttribute("role", "tab");
      chip.setAttribute("aria-label", chip.title);
      chip.addEventListener("click", function () { applyUnit(unit.unit); });
      elements.unitChips.appendChild(chip);
    });
    updateUnitControls();
  }

  function updateUnitControls() {
    const activeIndex = units.findIndex(function (unit) { return unit.unit === state.currentUnit; });
    elements.unitSelect.value = state.currentUnit;
    elements.previousUnit.disabled = activeIndex <= 0;
    elements.nextUnit.disabled = activeIndex < 0 || activeIndex >= units.length - 1;
    elements.unitChips.querySelectorAll(".unit-chip").forEach(function (chip) {
      const active = chip.dataset.unit === state.currentUnit;
      chip.classList.toggle("active", active);
      chip.setAttribute("aria-selected", String(active));
      if (active) chip.scrollIntoView({ inline: "center", block: "nearest" });
    });
  }

  function renderSectionFilters() {
    const meta = unitMeta(state.currentUnit);
    const unitCards = cardsForUnit();
    const sections = meta && Array.isArray(meta.sections) ? meta.sections : [];
    elements.filterTabs.innerHTML = "";
    const choices = [{ section: "all", title: "全部", count: unitCards.length }].concat(sections);
    choices.forEach(function (choice) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-button";
      button.dataset.filter = choice.section;
      button.classList.toggle("active", choice.section === state.filter);
      button.setAttribute("aria-pressed", String(choice.section === state.filter));
      button.append(document.createTextNode(choice.section === "all" ? "全部 " : choice.section + " " + choice.title + " "));
      const count = document.createElement("span");
      count.textContent = choice.count;
      button.appendChild(count);
      button.addEventListener("click", function () { applyFilter(choice.section); });
      elements.filterTabs.appendChild(button);
    });
  }

  function updateStartSelect() {
    const visible = filteredCards();
    const selected = currentCard();
    elements.startCard.innerHTML = "";
    visible.forEach(function (card) {
      const option = document.createElement("option");
      option.value = card.id;
      option.textContent = card.label + " · " + card.en + " · " + card.zh;
      option.selected = selected && card.id === selected.id;
      elements.startCard.appendChild(option);
    });
  }

  function makeCardButton(card) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vocab-card";
    button.dataset.cardId = card.id;
    button.setAttribute("aria-label", card.label + "，" + card.en + "，" + card.zh + "。点击朗读");
    button.setAttribute("aria-pressed", card.index === state.currentIndex ? "true" : "false");
    button.classList.toggle("selected", card.index === state.currentIndex);

    const imageWrap = document.createElement("span");
    imageWrap.className = "card-image";
    const image = document.createElement("img");
    image.src = card.image;
    image.alt = card.en + "（" + card.zh + "）的插图";
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", function (event) { handleImageError(event, card); });
    const badge = document.createElement("span");
    badge.className = "card-badge";
    badge.textContent = card.label;
    badge.setAttribute("aria-hidden", "true");
    const speaker = document.createElement("span");
    speaker.className = "card-speaker";
    speaker.textContent = "◖))";
    speaker.setAttribute("aria-hidden", "true");
    const copy = document.createElement("span");
    copy.className = "card-copy";
    const english = document.createElement("strong");
    english.textContent = card.en;
    const chinese = document.createElement("span");
    chinese.textContent = card.zh;
    imageWrap.append(image, badge, speaker);
    copy.append(english, chinese);
    button.append(imageWrap, copy);
    button.addEventListener("click", function () {
      selectCard(card.index, { speak: true, keepPlaying: state.playing });
    });
    return button;
  }

  function renderGrid() {
    const fragment = document.createDocumentFragment();
    filteredCards().forEach(function (card) { fragment.appendChild(makeCardButton(card)); });
    elements.cardGrid.replaceChildren(fragment);
  }

  function updateGridSelection() {
    const selected = currentCard();
    elements.cardGrid.querySelectorAll(".vocab-card").forEach(function (button) {
      const active = selected && button.dataset.cardId === selected.id;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function updateHero() {
    const card = currentCard();
    const meta = unitMeta(state.currentUnit);
    const unitCards = cardsForUnit();
    if (!card || !meta) return;
    const unitPosition = unitCards.findIndex(function (item) { return item.id === card.id; });
    const visible = filteredCards();
    elements.currentImage.dataset.fallback = "false";
    elements.currentImage.src = card.image;
    elements.currentImage.alt = card.en + "（" + card.zh + "）的插图";
    elements.currentNumber.textContent = card.label;
    elements.currentSection.textContent = "第" + card.unit + "单元 · " + card.section + " " + card.sectionTitle;
    elements.currentWord.textContent = card.en;
    elements.currentChinese.textContent = card.zh;
    elements.progressCopy.textContent = (unitPosition + 1) + " / " + unitCards.length;
    elements.progressBar.style.width = (((unitPosition + 1) / unitCards.length) * 100).toFixed(2) + "%";
    elements.libraryTitle.textContent = "第" + meta.unit + "单元 · " + meta.title;
    elements.libraryCount.textContent = state.filter === "all"
      ? "本单元 " + unitCards.length + " 张词卡"
      : "当前显示 " + visible.length + " / " + unitCards.length + " 张词卡";
    elements.unitOverview.textContent = "第" + meta.unit + "单元 · " + meta.title + " · " + unitCards.length + " 张词卡";
    elements.brandMark.textContent = meta.unit;
    elements.headerSummary.textContent = "家 · " + units.length + " 个单元 · " + cards.length + " 张词卡";
    elements.footerUnit.textContent = "家 · 第 25–41 单元 · 共 " + cards.length + " 张词卡";
    document.title = "第" + meta.unit + "单元 " + meta.title + " · 日常英语";
    if (Array.from(elements.startCard.options).some(function (option) { return option.value === card.id; })) {
      elements.startCard.value = card.id;
    }
    updateGridSelection();
    updateUnitControls();
    savePreferences();
  }

  function clearPlaybackTimer() {
    if (state.timer !== null) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
  }

  function cancelSpeech() {
    state.speechToken += 1;
    clearPlaybackTimer();
    if (supportsSpeech) window.speechSynthesis.cancel();
  }

  function selectedVoice() {
    return state.voices.find(function (voice) { return voice.voiceURI === state.voiceURI; }) || null;
  }

  function scheduleAutoAdvance(token) {
    clearPlaybackTimer();
    if (!state.playing || token !== state.speechToken) return;
    setTtsStatus("等待 " + state.interval + " 秒", false);
    state.timer = window.setTimeout(function () {
      if (!state.playing || token !== state.speechToken) return;
      advanceAuto();
    }, state.interval * 1000);
  }

  function speakCard(card, continuePlayback) {
    if (!card) return;
    cancelSpeech();
    const token = state.speechToken;
    announce("正在朗读 " + card.en + "，" + card.zh);
    if (!supportsSpeech) {
      setTtsStatus("浏览器未提供 TTS", true);
      if (!state.announcedUnavailable) {
        announce("当前浏览器不支持语音朗读，图片和文字仍可正常学习");
        state.announcedUnavailable = true;
      }
      if (continuePlayback && state.playing) scheduleAutoAdvance(token);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanSpeechText(card.en));
    const voice = selectedVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || "en-US";
    } else {
      utterance.lang = "en-US";
    }
    utterance.rate = state.rate;
    utterance.pitch = 1;
    utterance.onstart = function () {
      if (token === state.speechToken) setTtsStatus("正在朗读", false);
    };
    utterance.onend = function () {
      if (token !== state.speechToken) return;
      setTtsStatus("TTS 已就绪", false);
      if (continuePlayback && state.playing) scheduleAutoAdvance(token);
    };
    utterance.onerror = function (event) {
      if (token !== state.speechToken || event.error === "canceled" || event.error === "interrupted") return;
      setTtsStatus("朗读失败，可重试", true);
      announce("这次朗读没有成功，请点击再听一次");
      if (continuePlayback && state.playing) scheduleAutoAdvance(token);
    };
    window.speechSynthesis.speak(utterance);
  }

  function selectCard(index, options) {
    const settings = options || {};
    if (!cards[index]) return;
    if (cards[index].unit !== state.currentUnit) {
      state.currentUnit = cards[index].unit;
      state.filter = "all";
      renderSectionFilters();
      updateStartSelect();
      renderGrid();
    }
    state.currentIndex = index;
    updateHero();
    if (settings.speak) speakCard(cards[index], Boolean(settings.keepPlaying));
  }

  function adjacentCard(direction, wrap) {
    const visible = filteredCards();
    if (!visible.length) return null;
    const currentPosition = visible.findIndex(function (card) { return card.index === state.currentIndex; });
    let nextPosition = currentPosition + direction;
    if (currentPosition < 0) nextPosition = direction > 0 ? 0 : visible.length - 1;
    if (wrap) nextPosition = (nextPosition + visible.length) % visible.length;
    if (nextPosition < 0 || nextPosition >= visible.length) return null;
    return visible[nextPosition];
  }

  function randomCard() {
    const visible = filteredCards();
    if (!visible.length) return null;
    if (visible.length === 1) return visible[0];
    const candidates = visible.filter(function (card) { return card.index !== state.currentIndex; });
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function advanceAuto() {
    if (!state.playing) return;
    const next = state.mode === "random" ? randomCard() : adjacentCard(1, false);
    if (!next) {
      stopPlayback(false);
      setTtsStatus("本组已朗读完成", false);
      announce("本组词卡已经朗读完成");
      return;
    }
    selectCard(next.index, { speak: true, keepPlaying: true });
  }

  function updatePlayButton() {
    elements.playButton.setAttribute("aria-pressed", String(state.playing));
    elements.playIcon.textContent = state.playing ? "Ⅱ" : "▶";
    elements.playLabel.textContent = state.playing ? "暂停朗读" : "开始朗读";
  }

  function startPlayback() {
    if (!currentCard()) return;
    state.playing = true;
    updatePlayButton();
    speakCard(currentCard(), true);
  }

  function stopPlayback(announceStop) {
    state.playing = false;
    cancelSpeech();
    updatePlayButton();
    if (supportsSpeech) setTtsStatus("TTS 已就绪", false);
    if (announceStop !== false) announce("自动朗读已暂停");
  }

  function togglePlayback() {
    if (state.playing) stopPlayback(true);
    else startPlayback();
  }

  function moveManually(direction) {
    const target = adjacentCard(direction, true);
    if (target) selectCard(target.index, { speak: true, keepPlaying: state.playing });
  }

  function populateVoices() {
    if (!supportsSpeech) return;
    const allVoices = window.speechSynthesis.getVoices();
    const englishVoices = allVoices.filter(function (voice) { return /^en(?:-|_)/i.test(voice.lang); });
    state.voices = (englishVoices.length ? englishVoices : allVoices).sort(function (a, b) {
      if (a.localService !== b.localService) return a.localService ? -1 : 1;
      return (a.lang + a.name).localeCompare(b.lang + b.name);
    });
    const previous = state.voiceURI;
    elements.voiceSelect.innerHTML = '<option value="">系统默认英语声音</option>';
    state.voices.forEach(function (voice) {
      const option = document.createElement("option");
      option.value = voice.voiceURI;
      option.textContent = voice.name + " · " + voice.lang + (voice.localService ? " · 本机" : "");
      elements.voiceSelect.appendChild(option);
    });
    if (previous && state.voices.some(function (voice) { return voice.voiceURI === previous; })) {
      elements.voiceSelect.value = previous;
    } else {
      state.voiceURI = "";
    }
    setTtsStatus(state.voices.length ? "TTS 已就绪" : "使用系统默认声音", false);
  }

  function applyFilter(filter) {
    state.filter = filter;
    const visible = filteredCards();
    if (!visible.some(function (card) { return card.index === state.currentIndex; }) && visible[0]) {
      cancelSpeech();
      if (state.playing) state.playing = false;
      state.currentIndex = visible[0].index;
      updatePlayButton();
    }
    renderSectionFilters();
    updateStartSelect();
    renderGrid();
    updateHero();
    announce("已显示 " + visible.length + " 张词卡");
  }

  function applyUnit(unitId) {
    if (!unitMeta(unitId) || unitId === state.currentUnit) return;
    if (state.playing) stopPlayback(false);
    else cancelSpeech();
    state.currentUnit = String(unitId);
    state.filter = "all";
    const first = cardsForUnit()[0];
    if (first) state.currentIndex = first.index;
    renderSectionFilters();
    updateStartSelect();
    renderGrid();
    updateHero();
    announce("已切换到第 " + unitId + " 单元，" + unitMeta(unitId).title);
  }

  function changeUnit(direction) {
    const position = units.findIndex(function (unit) { return unit.unit === state.currentUnit; });
    const target = units[position + direction];
    if (target) applyUnit(target.unit);
  }

  function isTypingTarget(target) {
    const tag = target && target.tagName;
    return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || (target && target.isContentEditable);
  }

  function bindEvents() {
    elements.currentImage.addEventListener("error", function (event) { handleImageError(event, currentCard()); });
    elements.unitSelect.addEventListener("change", function () { applyUnit(elements.unitSelect.value); });
    elements.previousUnit.addEventListener("click", function () { changeUnit(-1); });
    elements.nextUnit.addEventListener("click", function () { changeUnit(1); });
    elements.startCard.addEventListener("change", function () {
      const card = cards.find(function (item) { return item.id === elements.startCard.value; });
      if (!card) return;
      if (state.playing) stopPlayback(false);
      selectCard(card.index, { speak: false });
      announce("起始卡片已选择为 " + card.en + "，点击开始朗读");
    });
    elements.voiceSelect.addEventListener("change", function () {
      state.voiceURI = elements.voiceSelect.value;
      savePreferences();
      speakCard(currentCard(), state.playing);
    });
    elements.intervalRange.addEventListener("input", function () {
      state.interval = Number(elements.intervalRange.value);
      elements.intervalValue.textContent = state.interval + " 秒";
      savePreferences();
    });
    elements.rateRange.addEventListener("input", function () {
      state.rate = Number(elements.rateRange.value);
      elements.rateValue.textContent = state.rate.toFixed(1) + "×";
      savePreferences();
    });
    elements.rateRange.addEventListener("change", function () {
      if (state.playing) speakCard(currentCard(), true);
    });
    elements.modeInputs.forEach(function (input) {
      input.addEventListener("change", function () {
        if (!input.checked) return;
        state.mode = input.value;
        savePreferences();
        announce(state.mode === "random" ? "已切换为随机播放" : "已切换为顺序播放");
      });
    });
    elements.playButton.addEventListener("click", togglePlayback);
    elements.prevButton.addEventListener("click", function () { moveManually(-1); });
    elements.nextButton.addEventListener("click", function () { moveManually(1); });
    elements.speakButton.addEventListener("click", function () { speakCard(currentCard(), state.playing); });
    elements.randomButton.addEventListener("click", function () {
      const target = randomCard();
      if (target) selectCard(target.index, { speak: true, keepPlaying: state.playing });
    });
    document.addEventListener("keydown", function (event) {
      if (isTypingTarget(event.target)) return;
      if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveManually(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveManually(1);
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        const target = randomCard();
        if (target) selectCard(target.index, { speak: true, keepPlaying: state.playing });
      } else if (event.key === "[") {
        event.preventDefault();
        changeUnit(-1);
      } else if (event.key === "]") {
        event.preventDefault();
        changeUnit(1);
      } else if (event.key === "Escape" && state.playing) {
        stopPlayback(true);
      }
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && state.playing) stopPlayback(false);
    });
  }

  function initialize() {
    readPreferences();
    if (!unitMeta(state.currentUnit)) state.currentUnit = units[0].unit;
    const selected = currentCard() || cardsForUnit()[0];
    if (selected) state.currentIndex = selected.index;
    elements.intervalRange.value = String(state.interval);
    elements.intervalValue.textContent = state.interval + " 秒";
    elements.rateRange.value = String(state.rate);
    elements.rateValue.textContent = state.rate.toFixed(1) + "×";
    elements.modeInputs.forEach(function (input) { input.checked = input.value === state.mode; });
    renderUnitControls();
    renderSectionFilters();
    updateStartSelect();
    bindEvents();
    renderGrid();
    updateHero();
    updatePlayButton();
    if (supportsSpeech) {
      populateVoices();
      if (typeof window.speechSynthesis.addEventListener === "function") {
        window.speechSynthesis.addEventListener("voiceschanged", populateVoices);
      } else {
        window.speechSynthesis.onvoiceschanged = populateVoices;
      }
      window.setTimeout(populateVoices, 500);
    } else {
      setTtsStatus("浏览器未提供 TTS", true);
      elements.voiceSelect.disabled = true;
    }
  }

  if (!cards.length || !units.length) {
    elements.cardGrid.textContent = "词卡数据未能加载，请刷新页面。";
    setTtsStatus("词卡数据未加载", true);
    return;
  }

  initialize();
})();
