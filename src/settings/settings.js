'use strict';

(() => {
  const state = {
    settings: null,
    keys: { gemini: false, openrouter: false },
    models: { gemini: [], openrouter: [] },
    loading: { gemini: false, openrouter: false },
    tickets: {},
    busy: { gemini: false, openrouter: false }
  };
  let el = {};
  let nooby;
  let effects;
  let toastTimer = 0;
  let surpriseInput = null;

  function cache() {
    const ids = [
      'settings-toast', 'settings-toast-message', 'settings-toast-details', 'settings-toast-details-text',
      'settings-toast-close', 'default-provider', 'system-prompt', 'save-defaults', 'sound-enabled',
      'sound-volume', 'volume-value', 'auto-close', 'launch-startup', 'color-swatches'
    ];
    for (const provider of ['gemini', 'openrouter']) {
      ids.push(`${provider}-key`, `${provider}-status`, `${provider}-save`, `${provider}-remove`,
        `${provider}-test`, `${provider}-models-refresh`, `${provider}-model`);
    }
    for (const id of ids) el[id] = document.getElementById(id);
  }

  function notify(message, details = '', type = 'success') {
    clearTimeout(toastTimer);
    el['settings-toast-message'].textContent = message;
    el['settings-toast'].className = `settings-toast${type === 'error' ? ' error' : ''}`;
    el['settings-toast-details'].hidden = !details;
    el['settings-toast-details'].open = false;
    el['settings-toast-details-text'].textContent = details || '';
    el['settings-toast'].hidden = false;
    toastTimer = setTimeout(() => { el['settings-toast'].hidden = true; }, type === 'error' ? 9000 : 4500);
  }

  function label(provider) {
    return provider === 'gemini' ? 'Gemini' : 'OpenRouter';
  }

  function mountPreference() {
    const anchor = document.getElementById('launch-startup');
    const host = anchor ? anchor.closest('div') : null;
    if (!host) return;
    surpriseInput = document.createElement('input');
    surpriseInput.type = 'checkbox';
    surpriseInput.checked = true;
    surpriseInput.addEventListener('change', () => patch({ surprisesEnabled: surpriseInput.checked }));
    const row = document.createElement('label');
    row.className = 'check-row';
    row.append(surpriseInput, document.createTextNode(' Allow surprises'));
    host.append(row);
  }

  function syncModels(provider) {
    const select = el[`${provider}-model`];
    const models = state.models[provider];
    const fragment = document.createDocumentFragment();
    if (state.loading[provider]) {
      const option = document.createElement('option'); option.value = ''; option.textContent = 'Fetching live models…'; fragment.append(option);
    } else if (!models.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = state.keys[provider] ? 'Refresh to fetch live models' : 'Save a key to fetch models';
      fragment.append(option);
    }
    for (const model of models) {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = `${model.name}${model.free ? ' · free' : ''}`;
      fragment.append(option);
    }
    select.replaceChildren(fragment);
    const preferred = state.settings?.models?.[provider];
    if (models.some((model) => model.id === preferred)) select.value = preferred;
    else if (models.length && !state.loading[provider]) select.value = models[0].id;
    select.disabled = state.loading[provider] || !models.length || state.busy[provider];
  }

  function applySettings(settings) {
    if (!settings?.sound || !settings?.models) return;
    state.settings = settings;
    el['default-provider'].value = settings.provider;
    if (document.activeElement !== el['system-prompt']) el['system-prompt'].value = settings.systemPrompt;
    el['sound-enabled'].checked = settings.sound.enabled;
    el['sound-volume'].value = String(settings.sound.volume);
    el['volume-value'].textContent = `${Math.round(settings.sound.volume * 100)}%`;
    el['auto-close'].value = String(settings.autoCloseSeconds);
    el['launch-startup'].checked = settings.launchAtStartup;
    if (surpriseInput) surpriseInput.checked = settings.surprisesEnabled !== false;
    nooby.setColor(settings.noobyColor);
    effects.configure(settings);
    for (const button of el['color-swatches'].querySelectorAll('button[data-color]')) {
      button.classList.toggle('active', button.dataset.color === settings.noobyColor);
    }
    for (const provider of ['gemini', 'openrouter']) syncModels(provider);
  }

  function updateKeys(keys) {
    if (!keys || typeof keys.gemini !== 'boolean' || typeof keys.openrouter !== 'boolean') return;
    state.keys = keys;
    for (const provider of ['gemini', 'openrouter']) {
      const saved = keys[provider];
      const status = el[`${provider}-status`];
      status.textContent = saved ? 'Stored ••••••••' : 'No key saved';
      status.classList.toggle('stored', saved);
      el[`${provider}-key`].placeholder = saved ? 'Stored — paste to replace' : `Paste a ${label(provider)} key`;
      el[`${provider}-save`].disabled = state.busy[provider];
      el[`${provider}-test`].disabled = !saved || state.busy[provider];
      el[`${provider}-remove`].disabled = !saved || state.busy[provider];
      el[`${provider}-models-refresh`].disabled = !saved || state.busy[provider];
      if (!saved) state.models[provider] = [];
      syncModels(provider);
    }
  }

  async function patch(partial) {
    const result = await window.nooby.settings.set(partial);
    if (result?.ok) {
      applySettings(result.settings);
      return true;
    }
    notify(result?.error?.message || 'I couldn’t save that setting.', result?.error?.details || '', 'error');
    if (state.settings) applySettings(state.settings);
    return false;
  }

  async function loadModels(provider) {
    if (!state.keys[provider]) { syncModels(provider); return; }
    const ticket = Symbol(provider);
    state.tickets[provider] = ticket;
    state.loading[provider] = true;
    syncModels(provider);
    try {
      const result = await window.nooby.models.list(provider);
      if (state.tickets[provider] !== ticket) return;
      if (!result.ok) {
        notify(result.error.message, result.error.details || '', 'error');
        state.models[provider] = [];
      } else state.models[provider] = result.models;
    } catch {
      state.models[provider] = [];
      notify('I couldn’t fetch the live models. Check your connection and try again.', '', 'error');
    } finally {
      if (state.tickets[provider] === ticket) {
        state.loading[provider] = false;
        syncModels(provider);
      }
    }
  }

  function setBusy(provider, busy) {
    state.busy[provider] = busy;
    for (const suffix of ['save', 'test', 'remove', 'models-refresh']) el[`${provider}-${suffix}`].disabled = busy;
    if (!busy) updateKeys(state.keys);
  }

  async function saveKey(provider) {
    const input = el[`${provider}-key`];
    const key = input.value.trim();
    if (!key) { notify(`Paste a ${label(provider)} key first.`, '', 'error'); return; }
    input.value = '';
    setBusy(provider, true);
    const result = await window.nooby.keys.save(provider, key);
    if (result.ok) {
      updateKeys(result.status);
      effects.confetti();
      effects.play('chime');
      notify(`${label(provider)} key tucked away safely.`);
      await loadModels(provider);
    } else {
      effects.play('boop');
      notify(result.error.message, result.error.details || '', 'error');
    }
    setBusy(provider, false);
  }

  async function removeKey(provider) {
    setBusy(provider, true);
    el[`${provider}-key`].value = '';
    const result = await window.nooby.keys.remove(provider);
    if (result.ok) {
      updateKeys(result.status);
      notify(`${label(provider)} key removed.`);
    } else notify(result.error.message, result.error.details || '', 'error');
    setBusy(provider, false);
  }

  async function testKey(provider) {
    if (!state.keys[provider]) { notify(`Save a ${label(provider)} key first.`, '', 'error'); return; }
    setBusy(provider, true);
    const result = await window.nooby.keys.test(provider);
    if (result.ok) {
      effects.confetti();
      effects.play('chime');
      notify(`${label(provider)} key works—tiny happy dance!`);
    } else {
      effects.play('boop');
      notify(result.error.message, result.error.details || '', 'error');
    }
    setBusy(provider, false);
  }

  function bind() {
    for (const provider of ['gemini', 'openrouter']) {
      el[`${provider}-save`].addEventListener('click', () => saveKey(provider));
      el[`${provider}-remove`].addEventListener('click', () => removeKey(provider));
      el[`${provider}-test`].addEventListener('click', () => testKey(provider));
      el[`${provider}-models-refresh`].addEventListener('click', () => loadModels(provider));
    }
    el['save-defaults'].addEventListener('click', async () => {
      const saved = await patch({
        provider: el['default-provider'].value,
        models: { gemini: el['gemini-model'].value, openrouter: el['openrouter-model'].value },
        systemPrompt: el['system-prompt'].value
      });
      if (saved) { effects.play('tick'); notify('Defaults tucked in.'); }
    });
    el['sound-enabled'].addEventListener('change', () => patch({ sound: { enabled: el['sound-enabled'].checked } }));
    el['sound-volume'].addEventListener('input', () => { el['volume-value'].textContent = `${Math.round(Number(el['sound-volume'].value) * 100)}%`; });
    el['sound-volume'].addEventListener('change', () => patch({ sound: { volume: Number(el['sound-volume'].value) } }));
    el['auto-close'].addEventListener('change', () => patch({ autoCloseSeconds: Number(el['auto-close'].value) }));
    el['launch-startup'].addEventListener('change', () => patch({ launchAtStartup: el['launch-startup'].checked }));
    el['color-swatches'].addEventListener('click', (event) => {
      const button = event.target.closest('button[data-color]');
      if (!button) return;
      nooby.setColor(button.dataset.color);
      for (const swatch of el['color-swatches'].querySelectorAll('button')) swatch.classList.toggle('active', swatch === button);
      patch({ noobyColor: button.dataset.color });
    });
    el['settings-toast-close'].addEventListener('click', () => { el['settings-toast'].hidden = true; });
  }

  async function init() {
    cache();
    mountPreference();
    nooby = window.createNooby({ size: 62, mood: 'happy' });
    document.getElementById('settings-nooby').append(nooby);
    effects = window.NoobyEffects.create({ layer: document.getElementById('settings-effects') });
    bind();
    const [settings, keys] = await Promise.all([window.nooby.settings.get(), window.nooby.keys.status()]);
    applySettings(settings);
    updateKeys(keys);
    window.nooby.settings.onChange(applySettings);
    await Promise.all(['gemini', 'openrouter'].filter((provider) => state.keys[provider]).map(loadModels));
  }

  init().catch(() => notify('I couldn’t load Settings. Please close this window and try again.', '', 'error'));
})();
