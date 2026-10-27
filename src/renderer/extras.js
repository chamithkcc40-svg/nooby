'use strict';

(() => {
  try {
    const island = document.getElementById('island');
    if (!island || !window.matchMedia) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const TAP_COUNT = 3;
    const TAP_WINDOW_MS = 1300;
    const VISIT_MS = 4600;
    const LINES = [
      'Knock knock, Chamith! It’s your favorite squircle — I was hoping you’d stop by.',
      'Psst, Chamith… three quick squishes unlock my whole heart. Best owner ever.',
      'Hey Chamith, tiny reminder: you’re doing great. Squircle’s honor.',
      'Chamith! If anyone asks, this little moment never happened. (It did. I loved it.)',
      'You found my secret knock, Chamith! Lucky you — unlimited Nooby hugs, redeemable anytime.'
    ];

    let allowed = true;
    let visiting = false;
    let tapTimes = [];
    let hideTimer = 0;
    let lastLine = -1;
    let activeStage = null;
    let activeMood = 'idle';
    let sfx = null;
    try {
      if (window.NoobyEffects && typeof window.NoobyEffects.create === 'function') {
        sfx = window.NoobyEffects.create({});
      }
    } catch {
      sfx = null;
    }

    const style = document.createElement('style');
    style.textContent = [
      '.nbx-note{position:fixed;z-index:9999;box-sizing:border-box;width:232px;max-width:46vw;padding:10px 14px;border-radius:16px;background:#1b1b25;color:#f4eef7;border:1px solid rgba(213,200,255,.28);box-shadow:0 10px 26px rgba(0,0,0,.42);font:700 13px/1.45 Nunito,system-ui,sans-serif;opacity:0;transform:translateY(6px) scale(.92);transition:opacity .22s ease,transform .28s cubic-bezier(.34,1.56,.64,1);pointer-events:none}',
      '.nbx-note.is-in{opacity:1;transform:translateY(0) scale(1)}',
      '.nbx-note p{margin:0}',
      '.nbx-note i{position:absolute;left:50%;width:12px;height:12px;margin-left:-6px;background:#1b1b25;border-color:rgba(213,200,255,.28)}',
      '.nbx-note.is-above i{bottom:-6px;border-style:solid;border-width:0 1px 1px 0;transform:rotate(45deg)}',
      '.nbx-note.is-below i{top:-6px;border-style:solid;border-width:1px 0 0 1px;transform:rotate(45deg)}',
      '.nbx-heart{position:fixed;z-index:9998;color:#ff8fb5;font-size:15px;line-height:1;pointer-events:none;text-shadow:0 0 6px rgba(255,143,181,.6);animation:nbxHeart 1.1s ease-out forwards}',
      '@keyframes nbxHeart{0%{transform:translate(0,4px) scale(.5);opacity:0}25%{opacity:1}100%{transform:translate(var(--hx,0),-46px) scale(1.15);opacity:0}}',
      '@media (prefers-reduced-motion: reduce){.nbx-note{transition:none}.nbx-heart{animation:none;display:none}}'
    ].join('');
    document.head.append(style);

    const bubble = document.createElement('div');
    bubble.className = 'nbx-note';
    bubble.hidden = true;
    bubble.innerHTML = '<p></p><i aria-hidden="true"></i>';
    const bubbleText = bubble.querySelector('p');
    document.body.append(bubble);

    function pickLine() {
      let index = Math.floor(Math.random() * LINES.length);
      if (LINES.length > 1) {
        while (index === lastLine) index = Math.floor(Math.random() * LINES.length);
      }
      lastLine = index;
      return LINES[index];
    }

    function positionNear(stage) {
      const rect = stage.getBoundingClientRect();
      const width = bubble.offsetWidth || 232;
      const height = bubble.offsetHeight || 60;
      const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2));
      bubble.style.left = `${Math.round(left)}px`;
      bubble.classList.remove('is-above', 'is-below');
      if (rect.top >= height + 18) {
        bubble.classList.add('is-above');
        bubble.style.top = 'auto';
        bubble.style.bottom = `${Math.round(window.innerHeight - rect.top + 10)}px`;
      } else {
        bubble.classList.add('is-below');
        bubble.style.bottom = 'auto';
        bubble.style.top = `${Math.round(rect.bottom + 10)}px`;
      }
    }

    function spawnHearts(stage) {
      if (reducedMotion.matches) return;
      const rect = stage.getBoundingClientRect();
      const baseX = rect.left + rect.width / 2;
      const baseY = rect.top + rect.height * 0.25;
      for (let index = 0; index < 4; index += 1) {
        const heart = document.createElement('span');
        heart.className = 'nbx-heart';
        heart.textContent = '♥';
        heart.style.left = `${Math.round(baseX - 24 + index * 16)}px`;
        heart.style.top = `${Math.round(baseY)}px`;
        heart.style.setProperty('--hx', `${Math.round((index - 1.5) * 9)}px`);
        document.body.append(heart);
        setTimeout(() => heart.remove(), 1200);
      }
    }

    function hide() {
      if (!visiting) return;
      visiting = false;
      clearTimeout(hideTimer);
      bubble.classList.remove('is-in');
      const finish = () => { bubble.hidden = true; };
      if (reducedMotion.matches) finish();
      else setTimeout(finish, 260);
      if (activeStage && activeStage.isConnected && activeStage.dataset.mood === 'love'
        && typeof activeStage.setMood === 'function') {
        try { activeStage.setMood(activeMood); } catch { /* noop */ }
      }
      activeStage = null;
    }

    function visit(stage) {
      visiting = true;
      activeStage = stage;
      activeMood = stage.dataset.mood || 'idle';
      bubbleText.textContent = pickLine();
      bubble.hidden = false;
      positionNear(stage);
      void bubble.offsetWidth;
      bubble.classList.add('is-in');
      spawnHearts(stage);
      if (typeof stage.setMood === 'function') {
        try { stage.setMood('love'); } catch { /* noop */ }
      }
      if (sfx) {
        try { sfx.play('chime'); } catch { /* noop */ }
      }
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, VISIT_MS);
    }

    island.addEventListener('click', (event) => {
      try {
        if (!allowed || visiting) return;
        const stage = event.target && typeof event.target.closest === 'function'
          ? event.target.closest('.nooby-stage')
          : null;
        if (!stage || !island.contains(stage)) return;
        const now = Date.now();
        tapTimes = tapTimes.filter((stamp) => now - stamp <= TAP_WINDOW_MS);
        tapTimes.push(now);
        if (tapTimes.length >= TAP_COUNT) {
          tapTimes = [];
          visit(stage);
        }
      } catch { /* noop */ }
    });

    window.addEventListener('resize', () => {
      try {
        if (visiting && activeStage) positionNear(activeStage);
      } catch { /* noop */ }
    }, { passive: true });

    function applySettings(settings) {
      if (!settings || typeof settings !== 'object') return;
      if (typeof settings.surprisesEnabled === 'boolean') {
        allowed = settings.surprisesEnabled;
        if (!allowed) hide();
      }
      if (sfx) {
        try { sfx.configure(settings); } catch { /* noop */ }
      }
    }

    const settingsApi = window.nooby && window.nooby.settings;
    if (settingsApi && typeof settingsApi.onChange === 'function') {
      try { settingsApi.onChange(applySettings); } catch { /* noop */ }
    }
    if (settingsApi && typeof settingsApi.get === 'function') {
      Promise.resolve(settingsApi.get()).then((settings) => {
        applySettings(settings && settings.sound ? settings : (settings && settings.settings) || settings);
      }).catch(() => {});
    }
  } catch { /* noop */ }
})();
