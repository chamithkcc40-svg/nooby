'use strict';

(() => {
  const COLORS = ['#FFF6E9', '#B8F2D0', '#FFC9B5', '#D5C8FF', '#BFE3FF', '#FFC6DD'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function create({ layer = null, ambientLayer = null } = {}) {
    let enabled = true;
    let volume = 0.55;
    let expanded = true;
    let audio = null;
    let destroyed = false;

    function configure(settings) {
      const sound = settings?.sound || settings || {};
      if (typeof sound.enabled === 'boolean') enabled = sound.enabled;
      if (typeof sound.volume === 'number') volume = Math.max(0, Math.min(1, sound.volume));
    }

    function getAudio() {
      if (!audio) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return null;
        audio = new AudioContext();
      }
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      return audio;
    }

    function tone(context, frequency, start, duration, type = 'sine', endFrequency = frequency, gainScale = 1) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.16 * gainScale), start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    }

    function play(name) {
      if (!enabled || volume <= 0 || destroyed) return;
      const context = getAudio();
      if (!context) return;
      const now = context.currentTime + 0.01;
      if (name === 'pop') tone(context, 260, now, 0.13, 'sine', 520);
      if (name === 'tick') tone(context, 540, now, 0.07, 'triangle', 720, 0.65);
      if (name === 'chime') {
        tone(context, 620, now, 0.18, 'sine', 700, 0.75);
        tone(context, 880, now + 0.1, 0.25, 'sine', 1040, 0.7);
      }
      if (name === 'boop') tone(context, 210, now, 0.22, 'triangle', 105, 0.8);
    }

    function clearAmbient() {
      if (ambientLayer) ambientLayer.replaceChildren();
    }

    function makeAmbient() {
      clearAmbient();
      if (!ambientLayer || !expanded || reducedMotion.matches || destroyed) return;
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < 9; index += 1) {
        const sparkle = document.createElement('i');
        sparkle.className = 'floating-sparkle';
        sparkle.style.left = `${5 + Math.random() * 90}%`;
        sparkle.style.top = `${25 + Math.random() * 65}%`;
        sparkle.style.setProperty('--delay', `${-Math.random() * 5}s`);
        sparkle.style.setProperty('--duration', `${4 + Math.random() * 4}s`);
        sparkle.style.setProperty('--sparkle-color', COLORS[index % COLORS.length]);
        fragment.append(sparkle);
      }
      ambientLayer.append(fragment);
    }

    function setExpanded(value) {
      expanded = Boolean(value);
      if (expanded) makeAmbient();
      else clearAmbient();
    }

    function particle(x, y, confetti) {
      if (!layer) return;
      const element = document.createElement('i');
      element.className = `effect-particle${confetti ? ' confetti' : ''}`;
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      const angle = Math.random() * Math.PI * 2;
      const distance = confetti ? 45 + Math.random() * 125 : 20 + Math.random() * 42;
      element.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
      element.style.setProperty('--dy', `${confetti ? 60 + Math.random() * 100 : Math.sin(angle) * distance}px`);
      element.style.setProperty('--particle-color', COLORS[Math.floor(Math.random() * COLORS.length)]);
      layer.append(element);
      setTimeout(() => element.remove(), confetti ? 950 : 700);
    }

    function burst(x, y) {
      if (!layer || reducedMotion.matches || destroyed) return;
      for (let index = 0; index < 10; index += 1) particle(x, y, false);
    }

    function burstAt(element) {
      if (!layer || !element) return;
      const outer = layer.getBoundingClientRect();
      const inner = element.getBoundingClientRect();
      burst(inner.left - outer.left + inner.width / 2, inner.top - outer.top + inner.height / 2);
    }

    function confetti() {
      if (!layer || reducedMotion.matches || destroyed) return;
      const bounds = layer.getBoundingClientRect();
      for (let index = 0; index < 18; index += 1) particle(bounds.width / 2, Math.min(45, bounds.height / 3), true);
    }

    reducedMotion.addEventListener('change', makeAmbient);
    return Object.freeze({
      configure,
      play,
      setExpanded,
      burst,
      burstAt,
      confetti,
      destroy: () => {
        destroyed = true;
        clearAmbient();
        reducedMotion.removeEventListener('change', makeAmbient);
        if (audio) audio.close().catch(() => {});
      }
    });
  }

  window.NoobyEffects = Object.freeze({ create });
})();
