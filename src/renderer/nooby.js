'use strict';

(() => {
  const MOODS = ['idle', 'happy', 'thinking', 'sleepy', 'surprised', 'oops', 'love'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function createNooby({ size = 84, color = '#B8F2D0', mood = 'idle', passive = false } = {}) {
    const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const safeSize = Math.max(18, Math.min(240, Number(size) || 84));
    const timers = new Set();
    let paused = false;
    let currentMood = MOODS.includes(mood) ? mood : 'idle';
    let moodBeforePet = currentMood;
    let lastActivity = 0;
    let destroyed = false;

    root.setAttribute('viewBox', '0 0 100 116');
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label', 'Nooby, a small cheerful squircle');
    root.classList.add('nooby');
    root.dataset.mood = currentMood;
    root.style.width = `${safeSize}px`;
    root.style.height = `${safeSize * 1.16}px`;
    root.style.setProperty('--nooby-color', /^#[0-9a-f]{6}$/i.test(color) ? color : '#B8F2D0');
    root.innerHTML = `
      <style>
        .nooby{display:block;overflow:visible;transform-origin:50% 80%;animation:noobyBob 3.8s ease-in-out infinite;cursor:pointer}
        .nooby *{transform-box:fill-box}.nooby .body{filter:drop-shadow(0 3px 3px rgba(0,0,0,.16));transform-origin:center}
        .nooby:hover{animation:noobyWiggle .52s cubic-bezier(.34,1.56,.64,1)}.nooby.is-paused,.nooby.is-paused *{animation-play-state:paused!important}
        .nooby .eyes,.nooby .mouth,.nooby .thought-dots,.nooby .sleep-z,.nooby .sweat,.nooby .pet-hearts{display:none}
        .nooby[data-mood=idle] .idle-eyes,.nooby[data-mood=thinking] .idle-eyes,.nooby[data-mood=idle] .idle-mouth,.nooby[data-mood=thinking] .idle-mouth{display:inline}
        .nooby[data-mood=happy] .happy-eyes,.nooby[data-mood=happy] .happy-mouth{display:inline}
        .nooby[data-mood=sleepy] .sleepy-eyes,.nooby[data-mood=sleepy] .sleepy-mouth,.nooby[data-mood=sleepy] .sleep-z{display:inline}
        .nooby[data-mood=surprised] .surprised-eyes,.nooby[data-mood=surprised] .surprised-mouth{display:inline}
        .nooby[data-mood=oops] .oops-eyes,.nooby[data-mood=oops] .oops-mouth,.nooby[data-mood=oops] .sweat{display:inline}
        .nooby[data-mood=love] .love-eyes,.nooby[data-mood=love] .happy-mouth{display:inline}
        .nooby[data-mood=thinking] .thought-dots{display:inline}.nooby[data-mood=thinking] .idle-eyes{transform:translateY(-3px)}
        .nooby .look-group{transition:transform .16s ease-out}.nooby .blinkable{transform-origin:center;transition:transform .16s cubic-bezier(.4,0,.2,1)}
        .nooby.is-blinking .blinkable{transform:scaleY(.12)}.nooby .thought-dots circle{animation:thoughtBob 1s infinite ease-in-out}
        .nooby .thought-dots circle:nth-child(2){animation-delay:.14s}.nooby .thought-dots circle:nth-child(3){animation-delay:.28s}
        .nooby .sleep-z{animation:zFloat 2.2s infinite ease-out;transform-origin:center}.nooby .sweat{animation:sweatBob 1.2s infinite ease-in-out}
        .nooby.is-petting .pet-hearts{display:inline}.nooby.is-petting .body{animation:noobySquish .55s cubic-bezier(.34,1.56,.64,1)}
        .nooby.is-petting .pet-hearts path{animation:heartUp .8s ease-out forwards}.nooby.is-petting .pet-hearts path:nth-child(2){animation-delay:.1s}
        .nooby.is-hopping{animation:noobyHop .48s cubic-bezier(.34,1.56,.64,1)}.nooby.is-nom .body{animation:noobyNom .5s ease-in-out}
        .nooby.is-nom .happy-mouth{animation:noobyNom .25s ease-in-out 2}.nooby.is-waking .sleepy-mouth{animation:noobyYawn .6s ease-in-out}
        @keyframes noobyBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
        @keyframes noobyWiggle{0%,100%{transform:rotate(0) scale(1)}25%{transform:rotate(-3deg) scale(1.07,.93)}70%{transform:rotate(3deg) scale(.96,1.05)}}
        @keyframes noobySquish{0%{transform:scale(1)}35%{transform:scale(1.1,.82)}70%{transform:scale(.94,1.08)}100%{transform:scale(1)}}
        @keyframes noobyHop{0%,100%{transform:translateY(0)}45%{transform:translateY(-10px) scale(.96,1.04)}70%{transform:translateY(1px) scale(1.06,.94)}}
        @keyframes noobyNom{0%,100%{transform:scale(1)}50%{transform:scale(1.06,.9)}}
        @keyframes noobyYawn{0%,100%{transform:scale(1)}50%{transform:scale(1.4)}}
        @keyframes thoughtBob{0%,60%,100%{transform:translateY(0);opacity:.45}30%{transform:translateY(-3px);opacity:1}}
        @keyframes zFloat{0%{transform:translate(0,3px) scale(.8);opacity:0}35%{opacity:.8}100%{transform:translate(8px,-8px) scale(1.15);opacity:0}}
        @keyframes sweatBob{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}
        @keyframes heartUp{0%{transform:translateY(5px) scale(.4);opacity:0}30%{opacity:1}100%{transform:translateY(-14px) scale(1.1);opacity:0}}
        @media(prefers-reduced-motion:reduce){.nooby,.nooby *{animation:none!important;transition:none!important}}
      </style>
      <rect class="body" x="10" y="20" width="80" height="80" rx="26" fill="var(--nooby-color)"/>
      <path d="M25 34 C34 25 56 23 69 28" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".28"/>
      <ellipse cx="27" cy="68" rx="8.5" ry="5" fill="#FFABC4" opacity=".42"/>
      <ellipse cx="73" cy="68" rx="8.5" ry="5" fill="#FFABC4" opacity=".42"/>
      <g class="look-group">
        <g class="eyes idle-eyes">
          <g class="blinkable"><ellipse cx="36" cy="53" rx="7" ry="13" fill="#111117"/><circle cx="33.5" cy="47.5" r="2.3" fill="#fff"/><circle cx="38.5" cy="56" r="1.1" fill="#fff" opacity=".9"/></g>
          <g class="blinkable"><ellipse cx="64" cy="53" rx="7" ry="13" fill="#111117"/><circle cx="61.5" cy="47.5" r="2.3" fill="#fff"/><circle cx="66.5" cy="56" r="1.1" fill="#fff" opacity=".9"/></g>
        </g>
        <g class="eyes happy-eyes" fill="none" stroke="#111117" stroke-width="5" stroke-linecap="round">
          <path d="M29 55 Q36 45 43 55"/><path d="M57 55 Q64 45 71 55"/>
        </g>
        <g class="eyes sleepy-eyes">
          <ellipse cx="36" cy="56" rx="6" ry="7" fill="#111117"/><ellipse cx="64" cy="56" rx="6" ry="7" fill="#111117"/>
          <path d="M29 51 Q36 47 43 51 M57 51 Q64 47 71 51" fill="none" stroke="var(--nooby-color)" stroke-width="8" stroke-linecap="round"/>
        </g>
        <g class="eyes surprised-eyes">
          <ellipse cx="36" cy="53" rx="8" ry="14" fill="#111117"/><ellipse cx="64" cy="53" rx="8" ry="14" fill="#111117"/>
          <circle cx="33" cy="47" r="2.5" fill="#fff"/><circle cx="61" cy="47" r="2.5" fill="#fff"/>
          <circle cx="39" cy="57" r="1.2" fill="#fff"/><circle cx="67" cy="57" r="1.2" fill="#fff"/>
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
      <g class="pet-hearts" fill="#FF8FB5"><path d="M19 28 C13 22 6 29 19 39 C32 29 25 22 19 28Z"/><path d="M79 24 C74 19 68 25 79 33 C90 25 84 19 79 24Z"/></g>
    `;

    const lookGroup = root.querySelector('.look-group');
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
      const bounds = root.getBoundingClientRect();
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
    root.addEventListener('click', pet);
    root.addEventListener('pointerenter', wake);
    if (!passive) {
      window.addEventListener('pointermove', look, { passive: true });
      window.addEventListener('keydown', activity, { passive: true });
    }
    root.setMood = setMood;
    root.setColor = (next) => { if (/^#[0-9a-f]{6}$/i.test(next)) root.style.setProperty('--nooby-color', next); };
    root.setPaused = (next) => {
      paused = Boolean(next);
      root.classList.toggle('is-paused', paused);
      if (paused) { clearTimer(blinkTimer); clearTimer(sleepTimer); }
      else { scheduleBlink(); scheduleSleep(); }
    };
    root.pet = pet;
    root.hop = hop;
    root.nom = nom;
    root.destroy = () => {
      destroyed = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      root.removeEventListener('click', pet);
      root.removeEventListener('pointerenter', wake);
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
