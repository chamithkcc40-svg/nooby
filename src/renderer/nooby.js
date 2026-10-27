'use strict';

(() => {
  const MOODS = ['idle', 'happy', 'thinking', 'sleepy', 'surprised', 'oops', 'love'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let noobyUid = 0;

  function createNooby({ size = 84, color = '#B8F2D0', mood = 'idle', passive = false } = {}) {
    const root = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const tilt = document.createElement('div');
    const ground = document.createElement('i');
    const uid = `nooby-${++noobyUid}`;
    const safeSize = Math.max(18, Math.min(240, Number(size) || 84));
    const timers = new Set();
    let paused = false;
    let currentMood = MOODS.includes(mood) ? mood : 'idle';
    let moodBeforePet = currentMood;
    let lastActivity = 0;
    let destroyed = false;

    svg.setAttribute('viewBox', '0 0 100 116');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Nooby, a small cheerful squircle');
    root.classList.add('nooby-stage');
    svg.classList.add('nooby');
    if (safeSize <= 32) root.classList.add('is-small', 'no-tilt');
    root.dataset.mood = currentMood;
    svg.dataset.mood = currentMood;
    root.style.width = `${safeSize}px`;
    root.style.height = `${safeSize * 1.16}px`;
    root.style.setProperty('--nooby-color', /^#[0-9a-f]{6}$/i.test(color) ? color : '#B8F2D0');
    svg.style.setProperty('--nooby-color', /^#[0-9a-f]{6}$/i.test(color) ? color : '#B8F2D0');
    svg.style.width = '100%';
    svg.style.height = '100%';
    tilt.className = 'nooby-tilt';
    ground.className = 'nooby-ground';
    ground.setAttribute('aria-hidden', 'true');
    tilt.append(svg);
    root.append(ground, tilt);
    svg.innerHTML = `
      <style>
        .nooby{display:block;overflow:visible;transform-origin:50% 80%;animation:noobyBob 3.8s ease-in-out infinite;cursor:pointer}
        .nooby *{transform-box:fill-box}.nooby .body{filter:drop-shadow(0 3px 3px rgba(0,0,0,.2));transform-origin:center}
        .nooby .body-layer{transform:translate(var(--body-x,0px),var(--body-y,0px));transition:transform .42s cubic-bezier(.22,1.32,.36,1)}
        .nooby .face-layer{transform:translate(var(--face-x,0px),var(--face-y,0px));transition:transform .36s cubic-bezier(.22,1.32,.36,1)}
        .nooby .cheeks{filter:drop-shadow(0 1px 1px rgba(63,35,57,.2))}.nooby .look-group{filter:drop-shadow(0 1.4px .7px rgba(0,0,0,.28))}
        .nooby .mouth{filter:drop-shadow(0 1px .6px rgba(0,0,0,.24))}.nooby .eye-reflection{fill:#BFE3FF;opacity:.22}
        .nooby:hover{animation:noobyWiggle .52s cubic-bezier(.34,1.56,.64,1)}.nooby-stage.is-paused .nooby,.nooby-stage.is-paused .nooby *{animation-play-state:paused!important}
        .nooby .eyes,.nooby .mouth,.nooby .thought-dots,.nooby .sleep-z,.nooby .sweat,.nooby .pet-hearts{display:none}
        .nooby[data-mood=idle] .idle-eyes,.nooby[data-mood=thinking] .idle-eyes,.nooby[data-mood=idle] .idle-mouth,.nooby[data-mood=thinking] .idle-mouth{display:inline}
        .nooby[data-mood=happy] .happy-eyes,.nooby[data-mood=happy] .happy-mouth{display:inline}
        .nooby[data-mood=sleepy] .sleepy-eyes,.nooby[data-mood=sleepy] .sleepy-mouth,.nooby[data-mood=sleepy] .sleep-z{display:inline}
        .nooby[data-mood=surprised] .surprised-eyes,.nooby[data-mood=surprised] .surprised-mouth{display:inline}
        .nooby[data-mood=oops] .oops-eyes,.nooby[data-mood=oops] .oops-mouth,.nooby[data-mood=oops] .sweat{display:inline}
        .nooby[data-mood=love] .love-eyes,.nooby[data-mood=love] .happy-mouth{display:inline}
        .nooby[data-mood=thinking] .thought-dots{display:inline}.nooby[data-mood=thinking] .idle-eyes{transform:translateY(-3px)}
        .nooby .look-group{transition:transform .16s ease-out}.nooby .blinkable{transform-origin:center;transition:transform .16s cubic-bezier(.4,0,.2,1)}
        .nooby-stage.is-blinking .blinkable{transform:scaleY(.12)}.nooby .thought-dots circle{animation:thoughtBob 1s infinite ease-in-out}
        .nooby .thought-dots circle:nth-child(2){animation-delay:.14s}.nooby .thought-dots circle:nth-child(3){animation-delay:.28s}
        .nooby .sleep-z{animation:zFloat 2.2s infinite ease-out;transform-origin:center}.nooby .sweat{animation:sweatBob 1.2s infinite ease-in-out}
        .nooby-stage.is-petting .pet-hearts{display:inline}.nooby-stage.is-petting .nooby{animation:noobySquish .55s cubic-bezier(.34,1.56,.64,1)}
        .nooby-stage.is-petting .pet-hearts path{animation:heartUp .8s ease-out forwards}.nooby-stage.is-petting .pet-hearts path:nth-child(2){animation-delay:.1s}
        .nooby-stage.is-hopping .nooby{animation:noobyHop .48s cubic-bezier(.34,1.56,.64,1)}.nooby-stage.is-nom .nooby{animation:noobyNom .5s ease-in-out}
        .nooby-stage.is-nom .happy-mouth{animation:noobyNom .25s ease-in-out 2}.nooby-stage.is-waking .sleepy-mouth{animation:noobyYawn .6s ease-in-out}
        @keyframes noobyBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
        @keyframes noobyWiggle{0%,100%{transform:rotate(0) scale(1)}25%{transform:rotate(-3deg) scale(1.07,.93)}70%{transform:rotate(3deg) scale(.96,1.05)}}
        @keyframes noobySquish{0%{transform:scale(1)}35%{transform:scale(1.1,.82)}70%{transform:scale(.94,1.08)}100%{transform:scale(1)}}
        @keyframes noobyHop{0%,100%{transform:translateY(0) scale(1)}12%{transform:translateY(1px) scale(1.08,.9)}45%{transform:translateY(-12px) scale(.94,1.07)}72%{transform:translateY(1px) scale(1.12,.88)}88%{transform:translateY(-1px) scale(.98,1.02)}}
        @keyframes noobyNom{0%,100%{transform:scale(1)}50%{transform:scale(1.06,.9)}}
        @keyframes noobyYawn{0%,100%{transform:scale(1)}50%{transform:scale(1.4)}}
        @keyframes thoughtBob{0%,60%,100%{transform:translateY(0);opacity:.45}30%{transform:translateY(-3px);opacity:1}}
        @keyframes zFloat{0%{transform:translate(0,3px) scale(.8);opacity:0}35%{opacity:.8}100%{transform:translate(8px,-8px) scale(1.15);opacity:0}}
        @keyframes sweatBob{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}
        @keyframes heartUp{0%{transform:translateY(5px) scale(.4);opacity:0}30%{opacity:1}100%{transform:translateY(-14px) scale(1.1);opacity:0}}
        @media(prefers-reduced-motion:reduce){.nooby,.nooby *{animation:none!important;transition:none!important}}
      </style>
      <defs>
        <linearGradient id="${uid}-body" gradientUnits="userSpaceOnUse" x1="18" y1="22" x2="86" y2="98">
          <stop offset="0" stop-color="var(--nooby-light)"/><stop offset=".48" stop-color="var(--nooby-color)"/><stop offset="1" stop-color="var(--nooby-deep)"/>
        </linearGradient>
        <linearGradient id="${uid}-rim" gradientUnits="userSpaceOnUse" x1="20" y1="24" x2="76" y2="96">
          <stop offset="0" stop-color="var(--nooby-shine)"/><stop offset=".55" stop-color="var(--nooby-color)"/><stop offset="1" stop-color="var(--nooby-deep)"/>
        </linearGradient>
        <radialGradient id="${uid}-gloss" cx="35%" cy="35%" r="65%">
          <stop offset="0" stop-color="var(--nooby-shine)" stop-opacity=".9"/><stop offset="1" stop-color="var(--nooby-light)" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${uid}-eyes" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#292938"/><stop offset=".55" stop-color="#090910"/><stop offset="1" stop-color="#020204"/>
        </linearGradient>
      </defs>
      <g class="body-layer">
        <rect class="body" x="10" y="20" width="80" height="80" rx="26" fill="url(#${uid}-body)"/>
        <rect class="body-rim" x="11.2" y="21.2" width="77.6" height="77.6" rx="24.8" fill="none" stroke="url(#${uid}-rim)" stroke-width="1.6" opacity=".72"/>
        <path class="body-shade" d="M18 72 C20 89 33 96 50 96 C67 96 80 89 82 72" fill="none" stroke="var(--nooby-deep)" stroke-width="5" stroke-linecap="round" opacity=".34"/>
        <ellipse class="specular" cx="34" cy="34" rx="21" ry="11" fill="url(#${uid}-gloss)" transform="rotate(-18 34 34)"/>
      </g>
      <g class="face-layer">
      <g class="cheeks"><ellipse cx="27" cy="68" rx="8.5" ry="5" fill="#FFABC4" opacity=".42"/><ellipse cx="73" cy="68" rx="8.5" ry="5" fill="#FFABC4" opacity=".42"/></g>
      <g class="look-group">
        <g class="eyes idle-eyes">
          <g class="blinkable"><ellipse cx="36" cy="53" rx="7" ry="13" fill="url(#${uid}-eyes)"/><circle cx="33.5" cy="47.5" r="2.3" fill="#fff"/><circle cx="38.5" cy="56" r="1.1" fill="#fff" opacity=".9"/><ellipse class="eye-reflection" cx="36" cy="62" rx="3.7" ry="1.3"/></g>
          <g class="blinkable"><ellipse cx="64" cy="53" rx="7" ry="13" fill="url(#${uid}-eyes)"/><circle cx="61.5" cy="47.5" r="2.3" fill="#fff"/><circle cx="66.5" cy="56" r="1.1" fill="#fff" opacity=".9"/><ellipse class="eye-reflection" cx="64" cy="62" rx="3.7" ry="1.3"/></g>
        </g>
        <g class="eyes happy-eyes" fill="none" stroke="#111117" stroke-width="5" stroke-linecap="round">
          <path d="M29 55 Q36 45 43 55"/><path d="M57 55 Q64 45 71 55"/>
        </g>
        <g class="eyes sleepy-eyes">
          <ellipse cx="36" cy="56" rx="6" ry="7" fill="url(#${uid}-eyes)"/><ellipse cx="64" cy="56" rx="6" ry="7" fill="url(#${uid}-eyes)"/>
          <circle cx="34" cy="54" r="1.5" fill="#fff"/><circle cx="62" cy="54" r="1.5" fill="#fff"/>
          <ellipse class="eye-reflection" cx="36" cy="61" rx="3" ry="1"/><ellipse class="eye-reflection" cx="64" cy="61" rx="3" ry="1"/>
          <path d="M29 51 Q36 47 43 51 M57 51 Q64 47 71 51" fill="none" stroke="var(--nooby-color)" stroke-width="8" stroke-linecap="round"/>
        </g>
        <g class="eyes surprised-eyes">
          <ellipse cx="36" cy="53" rx="8" ry="14" fill="url(#${uid}-eyes)"/><ellipse cx="64" cy="53" rx="8" ry="14" fill="url(#${uid}-eyes)"/>
          <circle cx="33" cy="47" r="2.5" fill="#fff"/><circle cx="61" cy="47" r="2.5" fill="#fff"/>
          <circle cx="39" cy="57" r="1.2" fill="#fff"/><circle cx="67" cy="57" r="1.2" fill="#fff"/>
          <ellipse class="eye-reflection" cx="36" cy="63" rx="4" ry="1.4"/><ellipse class="eye-reflection" cx="64" cy="63" rx="4" ry="1.4"/>
        </g>
        <g class="eyes oops-eyes" fill="none" stroke="#111117" stroke-width="3" stroke-linecap="round">
          <path d="M36 48 C27 44 27 61 36 61 C44 61 43 49 36 51 C31 52 34 57 37 55"/>
          <path d="M64 48 C55 44 55 61 64 61 C72 61 71 49 64 51 C59 52 62 57 65 55"/>
        </g>
        <g class="eyes love-eyes" fill="#EF6E99">
          <path d="M36 61 C32 57 25 52 27 47 C29 42 34 44 36 47 C38 44 43 42 45 47 C47 52 40 57 36 61Z"/>
          <path d="M64 61 C60 57 53 52 55 47 C57 42 62 44 64 47 C66 44 71 42 73 47 C75 52 68 57 64 61Z"/>
        </g>
      </g>
      <g class="mouth idle-mouth"><path d="M45 73 Q50 78 55 73" fill="none" stroke="#111117" stroke-width="3" stroke-linecap="round"/></g>
      <g class="mouth happy-mouth"><path d="M42 71 Q50 83 58 71 Q50 76 42 71Z" fill="#111117"/></g>
      <g class="mouth sleepy-mouth"><ellipse cx="50" cy="75" rx="3.5" ry="4.5" fill="#111117"/></g>
      <g class="mouth surprised-mouth"><ellipse cx="50" cy="74" rx="5" ry="7" fill="#111117"/><ellipse cx="48.5" cy="71.5" rx="1.3" ry="1.8" fill="#fff" opacity=".45"/></g>
      <g class="mouth oops-mouth"><path d="M43 75 Q46 71 50 75 Q54 79 58 74" fill="none" stroke="#111117" stroke-width="3" stroke-linecap="round"/></g>
      <g class="thought-dots" fill="#D5C8FF"><circle cx="40" cy="10" r="3"/><circle cx="50" cy="7" r="3.5"/><circle cx="61" cy="9" r="3"/></g>
      <g class="sleep-z" fill="#D5C8FF" font-family="Nunito,system-ui" font-weight="900"><text x="75" y="22" font-size="14">z</text><text x="84" y="10" font-size="12">z</text></g>
      <path class="sweat" d="M83 31 C88 38 88 42 83 44 C78 42 79 37 83 31Z" fill="#BFE3FF"/>
      </g>
      <g class="pet-hearts" fill="#FF8FB5"><path d="M19 28 C13 22 6 29 19 39 C32 29 25 22 19 28Z"/><path d="M79 24 C74 19 68 25 79 33 C90 25 84 19 79 24Z"/></g>
    `;

    const lookGroup = svg.querySelector('.look-group');
    let bounds = { left: 0, top: 0, width: 0, height: 0 };
    let tiltFrame = 0;
    let pointer = { x: 0, y: 0 };
    function cacheBounds() {
      if (!root.isConnected) return;
      bounds = root.getBoundingClientRect();
    }
    function resetTilt() {
      if (tiltFrame) cancelAnimationFrame(tiltFrame);
      tiltFrame = 0;
      tilt.style.transform = '';
      tilt.style.setProperty('--body-x', '0px');
      tilt.style.setProperty('--body-y', '0px');
      tilt.style.setProperty('--face-x', '0px');
      tilt.style.setProperty('--face-y', '0px');
    }
    function updateTilt() {
      tiltFrame = 0;
      if (paused || destroyed || safeSize <= 32 || reducedMotion.matches || !bounds.width) return;
      const nx = Math.max(-1, Math.min(1, (pointer.x - bounds.left - bounds.width / 2) / (bounds.width / 2)));
      const ny = Math.max(-1, Math.min(1, (pointer.y - bounds.top - bounds.height / 2) / (bounds.height / 2)));
      tilt.style.transform = `rotateX(${(-ny * 12).toFixed(2)}deg) rotateY(${(nx * 12).toFixed(2)}deg)`;
      tilt.style.setProperty('--body-x', `${(nx * 0.7).toFixed(2)}px`);
      tilt.style.setProperty('--body-y', `${(ny * 0.45).toFixed(2)}px`);
      tilt.style.setProperty('--face-x', `${(nx * 1.8).toFixed(2)}px`);
      tilt.style.setProperty('--face-y', `${(ny * 1.15).toFixed(2)}px`);
    }
    function moveTilt(event) {
      if (paused || safeSize <= 32 || reducedMotion.matches) return;
      pointer = { x: event.clientX, y: event.clientY };
      if (!tiltFrame) tiltFrame = requestAnimationFrame(updateTilt);
    }
    function later(callback, delay) {
      const timer = setTimeout(() => { timers.delete(timer); if (!destroyed) callback(); }, delay);
      timers.add(timer);
      return timer;
    }
    function clearTimer(timer) {
      if (timer) { clearTimeout(timer); timers.delete(timer); }
    }
    let blinkTimer = null;
    let sleepTimer = null;
    function scheduleBlink() {
      clearTimer(blinkTimer);
      if (paused || passive || reducedMotion.matches) return;
      blinkTimer = later(() => {
        if (currentMood === 'idle') {
          root.classList.add('is-blinking');
          later(() => root.classList.remove('is-blinking'), 220);
        }
        scheduleBlink();
      }, 2000 + Math.random() * 4000);
    }
    function scheduleSleep() {
      clearTimer(sleepTimer);
      if (paused || passive || currentMood !== 'idle') return;
      sleepTimer = later(() => setMood('sleepy'), 60000);
    }
    function setMood(next) {
      if (!MOODS.includes(next)) return;
      currentMood = next;
      root.dataset.mood = next;
      svg.dataset.mood = next;
      scheduleSleep();
    }
    function activity() {
      const now = Date.now();
      if (now - lastActivity < 1000) return;
      lastActivity = now;
      if (currentMood === 'idle') scheduleSleep();
    }
    function look(event) {
      activity();
      if (paused || reducedMotion.matches || !root.isConnected) return;
      if (!bounds.width) return;
      const x = Math.max(-3, Math.min(3, (event.clientX - bounds.left - bounds.width / 2) / 28));
      const y = Math.max(-2, Math.min(2, (event.clientY - bounds.top - bounds.height / 2) / 35));
      lookGroup.style.transform = `translate(${x}px, ${y}px)`;
    }
    function wake() {
      activity();
      if (currentMood === 'sleepy') {
        setMood('idle');
        root.classList.add('is-waking');
        later(() => root.classList.remove('is-waking'), 650);
      }
    }
    function pet() {
      if (paused) return;
      moodBeforePet = currentMood === 'sleepy' ? 'idle' : currentMood;
      setMood('happy');
      root.classList.remove('is-petting');
      void root.getBoundingClientRect();
      root.classList.add('is-petting');
      later(() => {
        root.classList.remove('is-petting');
        if (currentMood === 'happy') setMood(moodBeforePet);
      }, 850);
    }
    function hop() {
      if (paused || reducedMotion.matches) return;
      root.classList.remove('is-hopping');
      void root.getBoundingClientRect();
      root.classList.add('is-hopping');
      later(() => root.classList.remove('is-hopping'), 500);
    }
    function nom() {
      if (paused) return;
      const previous = currentMood;
      setMood('happy');
      root.classList.add('is-nom');
      later(() => { root.classList.remove('is-nom'); if (currentMood === 'happy') setMood(previous); }, 600);
    }
    function enter() { cacheBounds(); wake(); }
    root.addEventListener('click', pet);
    root.addEventListener('pointerenter', enter);
    root.addEventListener('pointermove', moveTilt, { passive: true });
    root.addEventListener('pointerleave', resetTilt);
    window.addEventListener('resize', cacheBounds, { passive: true });
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(cacheBounds) : null;
    resizeObserver?.observe(root);
    requestAnimationFrame(cacheBounds);
    if (!passive) {
      window.addEventListener('pointermove', look, { passive: true });
      window.addEventListener('keydown', activity, { passive: true });
    }
    root.setMood = setMood;
    root.setColor = (next) => {
      if (!/^#[0-9a-f]{6}$/i.test(next)) return;
      root.style.setProperty('--nooby-color', next);
      svg.style.setProperty('--nooby-color', next);
    };
    root.setPaused = (next) => {
      paused = Boolean(next);
      root.classList.toggle('is-paused', paused);
      if (paused) { clearTimer(blinkTimer); clearTimer(sleepTimer); resetTilt(); }
      else { cacheBounds(); scheduleBlink(); scheduleSleep(); }
    };
    root.pet = pet;
    root.hop = hop;
    root.nom = nom;
    root.destroy = () => {
      destroyed = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      resetTilt();
      resizeObserver?.disconnect();
      root.removeEventListener('click', pet);
      root.removeEventListener('pointerenter', enter);
      root.removeEventListener('pointermove', moveTilt);
      root.removeEventListener('pointerleave', resetTilt);
      window.removeEventListener('resize', cacheBounds);
      window.removeEventListener('pointermove', look);
      window.removeEventListener('keydown', activity);
      root.remove();
    };
    scheduleBlink();
    scheduleSleep();
    return root;
  }

  function installPolishCompanions() {
    const island = document.getElementById('island');
    const fileHost = document.getElementById('files-nooby');
    if (!island || !fileHost) return;
    const messages = document.getElementById('messages');
    const homeHost = document.getElementById('home-nooby');
    const assistants = new Map();
    const fileNooby = createNooby({ size: 56, passive: true });
    fileHost.append(fileNooby);
    let queued = false;

    function currentTint() {
      return homeHost?.querySelector('.nooby')?.style.getPropertyValue('--nooby-color') || '#B8F2D0';
    }
    function sync() {
      queued = false;
      const collapsed = island.classList.contains('is-collapsed');
      const tint = currentTint();
      const seen = new Set();
      const update = (mascot, mood) => {
        if (mascot.dataset.mood !== mood) mascot.setMood(mood);
        if (mascot.style.getPropertyValue('--nooby-color') !== tint) mascot.setColor(tint);
        if (mascot.classList.contains('is-paused') !== collapsed) mascot.setPaused(collapsed);
      };
      update(fileNooby, fileNooby.dataset.mood || 'idle');
      for (const bubble of messages?.querySelectorAll('.message.assistant') || []) {
        seen.add(bubble);
        let mascot = assistants.get(bubble);
        if (!mascot) {
          mascot = createNooby({ size: 30, passive: true });
          mascot.classList.add('message-nooby');
          mascot.setAttribute('aria-hidden', 'true');
          bubble.prepend(mascot);
          assistants.set(bubble, mascot);
        }
        update(mascot, bubble.classList.contains('streaming') ? 'thinking' : 'idle');
      }
      for (const [bubble, mascot] of assistants) {
        if (!seen.has(bubble)) { mascot.destroy(); assistants.delete(bubble); }
      }
    }
    function requestSync() {
      if (queued) return;
      queued = true;
      queueMicrotask(sync);
    }
    if (messages) {
      new MutationObserver((changes) => {
        const relevant = changes.some((change) => (change.type === 'childList' && change.target === messages)
          || (change.type === 'attributes' && change.target.classList?.contains('assistant')));
        if (relevant) requestSync();
      }).observe(messages, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    new MutationObserver(requestSync).observe(island, { attributes: true, attributeFilter: ['class'] });
    if (homeHost) {
      new MutationObserver((changes) => {
        if (changes.some((change) => change.type === 'childList' || change.target.classList?.contains('nooby'))) requestSync();
      }).observe(homeHost, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    }
    const isFileDrag = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');
    island.addEventListener('dragenter', (event) => { if (isFileDrag(event)) fileNooby.setMood('surprised'); });
    island.addEventListener('dragleave', (event) => {
      if (!event.relatedTarget || !island.contains(event.relatedTarget)) fileNooby.setMood('idle');
    });
    island.addEventListener('drop', (event) => {
      if (!isFileDrag(event)) return;
      fileNooby.setMood('idle');
      fileNooby.nom();
    });
    sync();
  }

  installPolishCompanions();
  window.createNooby = createNooby;
  window.NoobyUI = Object.freeze({ createNooby });
})();
