'use strict';

(() => {
  const GREETINGS = [
    'Tiny island, big ideas.', 'Bring snacks. And questions.', 'I’m all ears. Technically, all eyes.',
    'Let’s make something noodly.', 'Your pocket-sized brain buddy.', 'I woke up curious. Again.',
    'Beep boop, but make it cute.', 'What are we overthinking today?'
  ];
  const state = { expanded: false, tab: 'home', settings: null, keys: null, toastTimer: 0, autoTimer: 0, fileHover: false, chatLarge: false };
  const noobies = [];
  let effects;
  let island;
  let el = {};

  function cache() {
    const ids = [
      'expanded-view', 'tabs', 'tab-indicator', 'sound-toggle', 'sound-icon', 'settings-button',
      'open-settings-home', 'greeting', 'recent-chats', 'toast', 'toast-message', 'toast-details',
      'toast-details-text', 'toast-close', 'sr-status', 'stop-button', 'drop-zone'
    ];
    for (const id of ids) el[id] = document.getElementById(id);
  }

  function setMood(mood) {
    if (state.fileHover && mood !== 'surprised') return;
    for (const nooby of noobies) nooby.setMood(mood);
  }

  function updateIslandSize() {
    if (!state.expanded) return;
    const next = state.tab === 'chat'
      ? (state.chatLarge || window.NoobyChat.hasMessages() || window.NoobyChat.isStreaming() ? 'chat' : 'chat-empty')
      : state.tab;
    island.dataset.state = next;
    requestAnimationFrame(updateTabIndicator);
  }

  function updateTabIndicator() {
    const active = el.tabs.querySelector('.tab.active');
    if (!active || !state.expanded) return;
    el['tab-indicator'].style.width = `${active.offsetWidth}px`;
    el['tab-indicator'].style.transform = `translateX(${active.offsetLeft}px)`;
  }

  function renderRecent() {
    const fragment = document.createDocumentFragment();
    const recent = window.NoobyChat.recent();
    if (!recent.length) {
      const empty = document.createElement('span');
      empty.className = 'recent-empty';
      empty.textContent = 'No little chats yet';
      fragment.append(empty);
    }
    for (const chat of recent) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'recent-chat';
      button.dataset.chatId = chat.id;
      button.textContent = chat.title;
      button.title = `Resume ${chat.title}`;
      fragment.append(button);
    }
    el['recent-chats'].replaceChildren(fragment);
  }

  function setTab(tab, activate = true) {
    if (!['home', 'chat', 'files'].includes(tab)) return;
    state.tab = tab;
    for (const button of el.tabs.querySelectorAll('.tab')) {
      const active = button.dataset.tab === tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    }
    for (const name of ['home', 'chat', 'files']) {
      document.getElementById(`panel-${name}`).hidden = name !== tab;
    }
    if (tab === 'home') {
      el.greeting.textContent = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
      renderRecent();
    }
    window.NoobyChat.setActive(tab === 'chat' && activate);
    updateIslandSize();
    if (tab === 'chat' && state.expanded) setTimeout(() => window.NoobyChat.focusInput(), 140);
  }

  function expand() {
    if (state.expanded) return;
    state.expanded = true;
    island.classList.remove('is-collapsed');
    el['expanded-view'].setAttribute('aria-hidden', 'false');
    effects.setExpanded(true);
    effects.play('pop');
    for (const nooby of noobies) nooby.setPaused(false);
    setTab(state.tab);
    updateIslandSize();
    armAutoClose();
    refreshKeys();
    if (state.tab !== 'chat') setTimeout(() => island.focus(), 100);
  }

  function collapse() {
    if (!state.expanded) { island.dataset.state = 'collapsed'; return; }
    state.expanded = false;
    clearTimeout(state.autoTimer);
    island.classList.add('is-collapsed');
    island.dataset.state = 'collapsed';
    el['expanded-view'].setAttribute('aria-hidden', 'true');
    effects.setExpanded(false);
    for (const nooby of noobies) nooby.setPaused(true);
    window.NoobyChat.setActive(false);
    el.toast.hidden = true;
  }

  function armAutoClose() {
    clearTimeout(state.autoTimer);
    if (!state.expanded || window.NoobyChat.isStreaming() || !state.settings) return;
    state.autoTimer = setTimeout(() => {
      if (!window.NoobyChat.isStreaming()) collapse();
    }, state.settings.autoCloseSeconds * 1000);
  }

  function notify(message, details = '', type = 'error') {
    clearTimeout(state.toastTimer);
    el['toast-message'].textContent = message || 'Oops—something went sideways.';
    el.toast.className = `toast ${type === 'error' ? 'error' : type === 'success' ? 'success' : ''}`;
    el['toast-details'].hidden = !details;
    el['toast-details'].open = false;
    el['toast-details-text'].textContent = details || '';
    el.toast.hidden = false;
    el['sr-status'].textContent = message;
    state.toastTimer = setTimeout(() => { el.toast.hidden = true; }, type === 'error' ? 8500 : 5000);
  }

  function applySettings(settings) {
    if (!settings || !settings.sound || !settings.models) return;
    state.settings = settings;
    effects.configure(settings);
    el['sound-icon'].textContent = settings.sound.enabled ? '♪' : '∕♪';
    el['sound-toggle'].classList.toggle('muted', !settings.sound.enabled);
    el['sound-toggle'].title = settings.sound.enabled ? 'Sound on' : 'Sound off';
    el['sound-toggle'].setAttribute('aria-label', settings.sound.enabled ? 'Mute sounds' : 'Enable sounds');
    for (const nooby of noobies) nooby.setColor(settings.noobyColor);
    window.NoobyChat.setSettings(settings);
    armAutoClose();
  }

  async function saveSettings(partial) {
    const result = await window.nooby.settings.set(partial);
    if (result?.ok) applySettings(result.settings);
    else notify(result?.error?.message || 'I couldn’t save that setting.', result?.error?.details || '');
  }

  function updateKeys(keys) {
    if (!keys || typeof keys.gemini !== 'boolean' || typeof keys.openrouter !== 'boolean') return;
    state.keys = keys;
    for (const provider of ['gemini', 'openrouter']) {
      for (const prefix of ['home', 'collapsed']) {
        const dot = document.getElementById(`${prefix}-${provider}-dot`);
        dot.classList.toggle('saved', keys[provider]);
        dot.classList.toggle('missing', !keys[provider]);
        dot.title = `${provider === 'gemini' ? 'Gemini' : 'OpenRouter'}: ${keys[provider] ? 'key saved' : 'no key'}`;
      }
    }
    window.NoobyChat.setKeys(keys);
  }

  async function refreshKeys() {
    const previous = state.keys;
    const keys = await window.nooby.keys.status();
    updateKeys(keys);
    const added = previous && ['gemini', 'openrouter'].some((provider) => !previous[provider] && keys[provider]);
    if (added && state.expanded && state.tab === 'chat') window.NoobyChat.setActive(true);
  }

  async function openSettings() {
    collapse();
    const result = await window.nooby.openSettings();
    if (result?.ok === false) notify(result.error.message, result.error.details || '');
  }

  function bindIsland() {
    island.addEventListener('mouseenter', () => {
      window.nooby.setInteractive(true);
      if (!state.expanded) island.dataset.state = 'peek';
    });
    island.addEventListener('mouseleave', () => {
      window.nooby.setInteractive(false);
      if (!state.expanded) island.dataset.state = 'collapsed';
    });
    document.getElementById('collapsed-view').addEventListener('click', expand);
    el.tabs.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-tab]');
      if (button) { setTab(button.dataset.tab); armAutoClose(); }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.expanded) { event.preventDefault(); collapse(); }
      armAutoClose();
    });
    island.addEventListener('pointerdown', armAutoClose);
    island.addEventListener('input', armAutoClose);
    el['settings-button'].addEventListener('click', openSettings);
    el['open-settings-home'].addEventListener('click', openSettings);
    el['sound-toggle'].addEventListener('click', () => {
      if (state.settings) saveSettings({ sound: { enabled: !state.settings.sound.enabled } });
    });
    document.querySelector('.home-actions').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-provider]');
      if (button) { window.NoobyChat.switchProvider(button.dataset.provider); setTab('chat', false); }
    });
    el['recent-chats'].addEventListener('click', (event) => {
      const button = event.target.closest('button[data-chat-id]');
      if (button && window.NoobyChat.resume(button.dataset.chatId)) setTab('chat', false);
    });
    el['toast-close'].addEventListener('click', () => { el.toast.hidden = true; });
    window.nooby.onToggle((action) => {
      if (action === 'collapse') collapse();
      else if (action === 'expand') expand();
      else if (action === 'toggle') state.expanded ? collapse() : expand();
    });
    window.addEventListener('focus', refreshKeys);
  }

  async function init() {
    island = document.getElementById('island');
    cache();
    effects = window.NoobyEffects.create({
      layer: document.getElementById('effects-layer'),
      ambientLayer: document.getElementById('ambient-layer')
    });
    for (const [id, size] of [['collapsed-nooby', 27], ['home-nooby', 56], ['chat-nooby', 58]]) {
      const nooby = window.createNooby({ size, mood: 'idle' });
      document.getElementById(id).append(nooby);
      noobies.push(nooby);
    }
    window.NoobyFiles.init({
      onError: notify,
      onFileHover: (hover) => {
        state.fileHover = hover;
        setMood(hover ? 'surprised' : window.NoobyChat.isStreaming() ? 'thinking' : 'idle');
      },
      onFileDrop: () => {
        if (!state.expanded) expand();
        setTab('files', false);
        for (const nooby of noobies) nooby.nom();
        armAutoClose();
      }
    });
    window.NoobyChat.init({
      onError: notify,
      onSettings: saveSettings,
      onChatsChanged: (chats) => {
        renderRecent();
        window.nooby.history.save({ chats }).then((result) => {
          if (result?.ok === false) notify(result.error.message, result.error.details || '');
        });
      },
      onStreaming: (streaming) => {
        island.classList.toggle('is-streaming', streaming);
        updateIslandSize();
        armAutoClose();
      },
      onSize: (large) => { state.chatLarge = Boolean(large); updateIslandSize(); },
      onSound: (sound) => effects.play(sound),
      onSend: () => {
        effects.burstAt(el['stop-button']);
        for (const nooby of noobies) nooby.hop();
      },
      onMood: setMood,
      onActivity: armAutoClose
    });
    bindIsland();
    for (const nooby of noobies) nooby.setPaused(true);
    effects.setExpanded(false);
    const [settings, keys, history] = await Promise.all([
      window.nooby.settings.get(), window.nooby.keys.status(), window.nooby.history.load()
    ]);
    applySettings(settings);
    updateKeys(keys);
    window.NoobyChat.setHistory(history?.chats || []);
    renderRecent();
    window.nooby.settings.onChange(applySettings);
    island.dataset.state = 'collapsed';
  }

  init().catch(() => {
    const fallback = document.getElementById('sr-status');
    if (fallback) fallback.textContent = 'Nooby could not start. Please restart the app.';
  });
})();
