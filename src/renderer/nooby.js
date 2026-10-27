'use strict';

(() => {
  // Landscape width-to-height ratio for Nooby's body and component box.
  const NOOBY_ASPECT = 1.35;
  // Squircle corner radius as a fraction of body height.
  const NOOBY_RADIUS = 0.36;
  const MOODS = ['idle', 'happy', 'thinking', 'sleepy', 'surprised', 'oops', 'love'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let noobyUid = 0;

  function squirclePath(x, y, width, height) {
    const radius = Math.min(width / 2, height * NOOBY_RADIUS);
    const c = radius * 0.2;
    const n = (value) => Number(value.toFixed(2));
    // Paired cubics meet with matching tangent and curvature at every join.
    function corner(baseX, baseY, quarter) {
      const point = (u, v) => {
        const offsets = [[u, v], [-v, u], [-u, -v], [v, -u]][quarter];
        return `${n(baseX + offsets[0])} ${n(baseY + offsets[1])}`;
      };
      return `C ${point(c, 0)} ${point(radius - 2 * c, 0)} ${point(radius - c, c)} C ${point(radius, 2 * c)} ${point(radius, 4 * c)} ${point(radius, radius)}`;
    }
    return [
      `M ${n(x + radius)} ${n(y)}`, `H ${n(x + width - radius)}`, corner(x + width - radius, y, 0),
      `V ${n(y + height - radius)}`, corner(x + width, y + height - radius, 1),
      `H ${n(x + radius)}`, corner(x + radius, y + height, 2),
      `V ${n(y + radius)}`, corner(x, y + radius, 3), 'Z'
    ].join(' ');
  }

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
    const viewHeight = 100;
    const viewWidth = viewHeight * NOOBY_ASPECT;
    const bodyHeight = 76;
    const bodyWidth = bodyHeight * NOOBY_ASPECT;
    const bodyX = (viewWidth - bodyWidth) / 2;
    const bodyY = 16;
    const eyeRX = bodyWidth * 0.052;
    const eyeRY = bodyHeight * 0.15;
    const eyeY = bodyY + bodyHeight * 0.43;
    const mouthY = bodyY + bodyHeight * 0.7;
    const n = (value) => Number(value.toFixed(2));
    const X = (fraction) => n(bodyX + bodyWidth * fraction);
    const Y = (fraction) => n(bodyY + bodyHeight * fraction);
    const bodyPath = squirclePath(bodyX, bodyY, bodyWidth, bodyHeight);
    const rimPath = squirclePath(bodyX + 1.2, bodyY + 1.2, bodyWidth - 2.4, bodyHeight - 2.4);
    const localPoint = (cx, cy, scale) => (x, y) => `${n(cx + x * scale)} ${n(cy + y * scale)}`;
    function glassEye(cx, cy, rx = eyeRX, ry = eyeRY) {
      return `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#${uid}-eyes)"/><circle cx="${n(cx - rx * 0.38)}" cy="${n(cy - ry * 0.42)}" r="${n(rx * 0.36)}" fill="#fff"/><circle cx="${n(cx + rx * 0.4)}" cy="${n(cy + ry * 0.22)}" r="${n(rx * 0.16)}" fill="#fff" opacity=".9"/><ellipse class="eye-reflection" cx="${n(cx)}" cy="${n(cy + ry * 0.72)}" rx="${n(rx * 0.52)}" ry="${n(ry * 0.1)}"/>`;
    }
    function happyEye(cx) {
      return `M ${n(cx - eyeRX)} ${n(eyeY + eyeRY * 0.15)} Q ${n(cx)} ${n(eyeY - eyeRY * 0.75)} ${n(cx + eyeRX)} ${n(eyeY + eyeRY * 0.15)}`;
    }
    function spiralEye(cx) {
      const p = localPoint(cx, eyeY, eyeRX / 7);
      return `M ${p(0, -5)} C ${p(-9, -9)} ${p(-9, 8)} ${p(0, 8)} C ${p(8, 8)} ${p(7, -4)} ${p(0, -2)} C ${p(-5, -1)} ${p(-2, 4)} ${p(1, 2)}`;
    }
    function heart(cx, cy, scale = eyeRX / 7) {
      const p = localPoint(cx, cy, scale);
      return `M ${p(0, 8)} C ${p(-4, 4)} ${p(-11, -1)} ${p(-9, -6)} C ${p(-7, -11)} ${p(-2, -9)} ${p(0, -6)} C ${p(2, -9)} ${p(7, -11)} ${p(9, -6)} C ${p(11, -1)} ${p(4, 4)} ${p(0, 8)} Z`;
    }
    const sweatPoint = localPoint(X(0.88), Y(0.22), bodyHeight / 76);

    svg.setAttribute('viewBox', `0 0 ${n(viewWidth)} ${viewHeight}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Nooby, a small cheerful squircle');
    root.classList.add('nooby-stage');
    svg.classList.add('nooby');
    if (safeSize <= 32) root.classList.add('is-small', 'no-tilt');
    root.dataset.mood = currentMood;
    svg.dataset.mood = currentMood;
    root.style.width = `${n(safeSize * NOOBY_ASPECT)}px`;
    root.style.height = `${safeSize}px`;
    root.style.setProperty('--nooby-color', /^#[0-9a-f]{6}$/i.test(color) ? color : '#B8F2D0');
    svg.style.setProperty('--nooby-color', /^#[0-9a-f]{6}$/i.test(color) ? color : '#B8F2D0');
    svg.style.setProperty('--nooby-pivot', `${n((bodyY + bodyHeight) / viewHeight * 100)}%`);
    svg.style.width = '100%';
    svg.style.height = '100%';
    tilt.className = 'nooby-tilt';
    ground.className = 'nooby-ground';
    ground.setAttribute('aria-hidden', 'true');
    tilt.append(svg);
    root.append(ground, tilt);
    svg.innerHTML = `
      <style>
        .nooby{display:block;overflow:visible;transform-origin:50% var(--nooby-pivot,92%);animation:noobyBob 3.8s ease-in-out infinite;cursor:pointer}
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
        <linearGradient id="${uid}-body" gradientUnits="userSpaceOnUse" x1="${X(0.08)}" y1="${Y(0.06)}" x2="${X(0.92)}" y2="${Y(0.94)}">
          <stop offset="0" stop-color="var(--nooby-light)"/><stop offset=".48" stop-color="var(--nooby-color)"/><stop offset="1" stop-color="var(--nooby-deep)"/>
        </linearGradient>
        <linearGradient id="${uid}-rim" gradientUnits="userSpaceOnUse" x1="${X(0.15)}" y1="${Y(0.08)}" x2="${X(0.78)}" y2="${Y(0.93)}">
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
        <path class="body" d="${bodyPath}" fill="url(#${uid}-body)"/>
        <path class="body-rim" d="${rimPath}" fill="none" stroke="url(#${uid}-rim)" stroke-width="1.6" opacity=".72"/>
        <path class="body-shade" d="M ${X(0.12)} ${Y(0.72)} C ${X(0.15)} ${Y(0.91)} ${X(0.32)} ${Y(0.96)} ${X(0.5)} ${Y(0.96)} C ${X(0.68)} ${Y(0.96)} ${X(0.85)} ${Y(0.91)} ${X(0.88)} ${Y(0.72)}" fill="none" stroke="var(--nooby-deep)" stroke-width="${n(bodyHeight * 0.055)}" stroke-linecap="round" opacity=".34"/>
        <ellipse class="specular" cx="${X(0.23)}" cy="${Y(0.22)}" rx="${n(bodyWidth * 0.17)}" ry="${n(bodyHeight * 0.11)}" fill="url(#${uid}-gloss)" transform="rotate(-18 ${X(0.23)} ${Y(0.22)})"/>
      </g>
      <g class="face-layer">
        <g class="cheeks"><ellipse cx="${X(0.18)}" cy="${Y(0.64)}" rx="${n(bodyWidth * 0.07)}" ry="${n(bodyHeight * 0.06)}" fill="#FFABC4" opacity=".42"/><ellipse cx="${X(0.82)}" cy="${Y(0.64)}" rx="${n(bodyWidth * 0.07)}" ry="${n(bodyHeight * 0.06)}" fill="#FFABC4" opacity=".42"/></g>
        <g class="look-group">
          <g class="eyes idle-eyes">
            <g class="blinkable">${glassEye(X(0.36), eyeY)}</g>
            <g class="blinkable">${glassEye(X(0.64), eyeY)}</g>
          </g>
          <g class="eyes happy-eyes" fill="none" stroke="#111117" stroke-width="${n(eyeRX * 0.82)}" stroke-linecap="round">
            <path d="${happyEye(X(0.36))}"/><path d="${happyEye(X(0.64))}"/>
          </g>
          <g class="eyes sleepy-eyes">
            ${glassEye(X(0.36), n(eyeY + eyeRY * 0.18), n(eyeRX * 0.9), n(eyeRY * 0.58))}
            ${glassEye(X(0.64), n(eyeY + eyeRY * 0.18), n(eyeRX * 0.9), n(eyeRY * 0.58))}
            <path d="M ${n(X(0.36) - eyeRX)} ${n(eyeY)} Q ${X(0.36)} ${n(eyeY - eyeRY * 0.35)} ${n(X(0.36) + eyeRX)} ${n(eyeY)} M ${n(X(0.64) - eyeRX)} ${n(eyeY)} Q ${X(0.64)} ${n(eyeY - eyeRY * 0.35)} ${n(X(0.64) + eyeRX)} ${n(eyeY)}" fill="none" stroke="var(--nooby-color)" stroke-width="${n(eyeRY * 0.62)}" stroke-linecap="round"/>
          </g>
          <g class="eyes surprised-eyes">
            ${glassEye(X(0.36), eyeY, n(eyeRX * 1.12), n(eyeRY * 1.1))}
            ${glassEye(X(0.64), eyeY, n(eyeRX * 1.12), n(eyeRY * 1.1))}
          </g>
          <g class="eyes oops-eyes" fill="none" stroke="#111117" stroke-width="${n(eyeRX * 0.52)}" stroke-linecap="round">
            <path d="${spiralEye(X(0.36))}"/><path d="${spiralEye(X(0.64))}"/>
          </g>
          <g class="eyes love-eyes" fill="#EF6E99">
            <path d="${heart(X(0.36), eyeY)}"/><path d="${heart(X(0.64), eyeY)}"/>
          </g>
        </g>
        <g class="mouth idle-mouth"><path d="M ${n(X(0.5) - 5)} ${mouthY} Q ${X(0.5)} ${n(mouthY + 5)} ${n(X(0.5) + 5)} ${mouthY}" fill="none" stroke="#111117" stroke-width="3" stroke-linecap="round"/></g>
        <g class="mouth happy-mouth"><path d="M ${n(X(0.5) - 7)} ${n(mouthY - 2)} Q ${X(0.5)} ${n(mouthY + 9)} ${n(X(0.5) + 7)} ${n(mouthY - 2)} Q ${X(0.5)} ${n(mouthY + 3)} ${n(X(0.5) - 7)} ${n(mouthY - 2)} Z" fill="#111117"/></g>
        <g class="mouth sleepy-mouth"><ellipse cx="${X(0.5)}" cy="${n(mouthY + 2)}" rx="3.2" ry="4.2" fill="#111117"/></g>
        <g class="mouth surprised-mouth"><ellipse cx="${X(0.5)}" cy="${n(mouthY + 1)}" rx="4.5" ry="6" fill="#111117"/><ellipse cx="${n(X(0.5) - 1.3)}" cy="${n(mouthY - 1.5)}" rx="1.2" ry="1.6" fill="#fff" opacity=".45"/></g>
        <g class="mouth oops-mouth"><path d="M ${n(X(0.5) - 7)} ${mouthY} Q ${n(X(0.5) - 3)} ${n(mouthY - 4)} ${X(0.5)} ${mouthY} Q ${n(X(0.5) + 4)} ${n(mouthY + 4)} ${n(X(0.5) + 8)} ${n(mouthY - 1)}" fill="none" stroke="#111117" stroke-width="3" stroke-linecap="round"/></g>
        <g class="thought-dots" fill="#D5C8FF"><circle cx="${X(0.4)}" cy="${n(bodyY - 7)}" r="${n(bodyHeight * 0.04)}"/><circle cx="${X(0.5)}" cy="${n(bodyY - 10)}" r="${n(bodyHeight * 0.046)}"/><circle cx="${X(0.6)}" cy="${n(bodyY - 8)}" r="${n(bodyHeight * 0.04)}"/></g>
        <g class="sleep-z" fill="#D5C8FF" font-family="Nunito,system-ui" font-weight="900"><text x="${X(0.78)}" y="${n(bodyY + 5)}" font-size="${n(bodyHeight * 0.18)}">z</text><text x="${X(0.86)}" y="${n(bodyY - 5)}" font-size="${n(bodyHeight * 0.16)}">z</text></g>
        <path class="sweat" d="M ${sweatPoint(0, 0)} C ${sweatPoint(5, 7)} ${sweatPoint(5, 11)} ${sweatPoint(0, 13)} C ${sweatPoint(-5, 11)} ${sweatPoint(-4, 6)} ${sweatPoint(0, 0)} Z" fill="#BFE3FF"/>
      </g>
      <g class="pet-hearts" fill="#FF8FB5"><path d="${heart(X(0.15), Y(0.18), eyeRX / 7 * 0.85)}"/><path d="${heart(X(0.85), Y(0.14), eyeRX / 7 * 0.85)}"/></g>
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
