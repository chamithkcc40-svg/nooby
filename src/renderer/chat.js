'use strict';

(() => {
  const state = {
    settings: null, keys: { gemini: false, openrouter: false }, chats: [], chatId: null, messages: [],
    provider: 'gemini', model: '', models: { gemini: [], openrouter: [] }, loading: null,
    streamId: null, streaming: false, streamText: '', streamElement: null,
    pendingEvents: [], stopRequested: false, active: false
  };
  let callbacks = {};
  let el = {};
  let chatEmpty;
  let renderFrame = 0;
  function notify(message, details = '', type = 'error') { callbacks.onError?.(message, details, type); }
  function cacheElements() {
    const ids = [
      'provider-switch', 'new-chat', 'model-dropdown', 'model-select-button', 'model-select-label',
      'model-menu', 'model-search', 'free-toggle-wrap', 'free-only', 'model-options', 'messages',
      'retry-banner', 'retry-text', 'chat-form', 'chat-input', 'send-button', 'stop-button'
    ];
    for (const id of ids) el[id] = document.getElementById(id);
    chatEmpty = document.getElementById('chat-empty');
  }
  function scrollToBottom() { el.messages.scrollTop = el.messages.scrollHeight; }
  function messageNode(message) {
    const bubble = document.createElement('article');
    bubble.className = `message ${message.role}${message.streaming ? ' streaming' : ''}`;
    if (message.files?.length) {
      const files = document.createElement('div');
      files.className = 'message-files';
      files.textContent = `▤ ${message.files.join(' · ')}`;
      bubble.append(files);
    }
    const content = document.createElement('div');
    content.className = 'message-content';
    if (message.role === 'assistant') content.innerHTML = window.NoobyMarkdown.render(message.content);
    else { content.textContent = message.content; content.style.whiteSpace = 'pre-wrap'; }
    bubble.append(content);
    if (message.streaming) state.streamElement = content;
    return bubble;
  }
  function renderMessages() {
    state.streamElement = null;
    if (!state.messages.length) {
      el.messages.replaceChildren(chatEmpty);
      callbacks.onSize?.(false);
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const message of state.messages) fragment.append(messageNode(message));
    el.messages.replaceChildren(fragment);
    callbacks.onSize?.(true);
    scrollToBottom();
  }
  function scheduleStreamRender() {
    if (renderFrame) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0;
      if (state.streamElement) state.streamElement.innerHTML = window.NoobyMarkdown.render(state.streamText);
      scrollToBottom();
    });
  }
  function selectedModel() { return state.models[state.provider].find((model) => model.id === state.model); }
  function updateModelLabel() {
    const model = selectedModel();
    el['model-select-label'].textContent = state.loading === state.provider
      ? 'Fetching live models…'
      : model ? model.name : state.keys[state.provider] ? state.model || 'Choose a live model' : 'Add a key in Settings';
    el['model-select-button'].title = model?.id || '';
  }
  function updateProvider() {
    for (const button of el['provider-switch'].querySelectorAll('button[data-provider]')) {
      button.classList.toggle('active', button.dataset.provider === state.provider);
    }
    el['free-toggle-wrap'].hidden = state.provider !== 'openrouter';
    updateModelLabel();
  }
  function renderModelOptions() {
    const query = el['model-search'].value.trim().toLowerCase();
    const freeOnly = state.provider === 'openrouter' && el['free-only'].checked;
    const models = state.models[state.provider].filter((model) => {
      return (!query || `${model.name} ${model.id}`.toLowerCase().includes(query)) && (!freeOnly || model.free);
    });
    const fragment = document.createDocumentFragment();
    if (state.loading === state.provider && !models.length) {
      const note = document.createElement('div'); note.className = 'menu-note'; note.textContent = 'Fetching the live list…'; fragment.append(note);
    } else if (!models.length) {
      const note = document.createElement('div');
      note.className = 'menu-note';
      note.textContent = state.keys[state.provider] ? 'No matching models. Try another search.' : 'Save a key in Settings first.';
      fragment.append(note);
    }
    for (const model of models.slice(0, 150)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `model-option${model.id === state.model ? ' selected' : ''}`;
      button.dataset.modelId = model.id;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(model.id === state.model));
      button.title = model.id;
      const name = document.createElement('span'); name.className = 'model-name'; name.textContent = model.name;
      const badge = document.createElement('small'); badge.textContent = model.free ? 'free' : model.supportsImage ? 'vision' : '';
      button.append(name, badge);
      fragment.append(button);
    }
    if (models.length > 150) {
      const note = document.createElement('div'); note.className = 'menu-note'; note.textContent = `${models.length - 150} more—type to narrow the list.`; fragment.append(note);
    }
    el['model-options'].replaceChildren(fragment);
  }
  function closeModelMenu() {
    const wasOpen = !el['model-menu'].hidden;
    el['model-menu'].hidden = true;
    el['model-select-button'].setAttribute('aria-expanded', 'false');
    if (wasOpen) callbacks.onSize?.(state.messages.length > 0);
  }
  async function loadModels(provider = state.provider) {
    if (!state.keys[provider]) {
      state.models[provider] = [];
      updateModelLabel();
      renderModelOptions();
      return;
    }
    const ticket = Symbol(provider);
    state.loading = provider;
    state.loadTicket = ticket;
    updateModelLabel();
    renderModelOptions();
    try {
      const result = await window.nooby.models.list(provider);
      if (state.loadTicket !== ticket) return;
      if (!result.ok) { const error = new Error(result.error.message); error.public = result.error; throw error; }
      state.models[provider] = result.models;
      if (provider === state.provider) {
        if (!result.models.some((model) => model.id === state.model)) {
          state.model = result.models[0]?.id || '';
          if (state.model) callbacks.onSettings?.({ models: { [provider]: state.model } });
        }
      }
    } catch (error) {
      if (state.loadTicket === ticket) {
        state.models[provider] = [];
        if (provider === state.provider) state.model = '';
        const info = error.public || { message: 'I couldn’t fetch the live models. Check your connection and try again.', details: '' };
        notify(info.message, info.details || '');
      }
    } finally {
      if (state.loadTicket === ticket) {
        state.loading = null;
        updateModelLabel();
        renderModelOptions();
      }
    }
  }
  function setStreaming(streaming) {
    state.streaming = streaming;
    el['send-button'].hidden = streaming;
    el['stop-button'].hidden = !streaming;
    el['stop-button'].disabled = false;
    el['retry-banner'].hidden = true;
    callbacks.onStreaming?.(streaming);
    if (!streaming) {
      state.streamId = null;
      state.pendingEvents = [];
      state.streamElement = null;
    }
  }
  function saveCurrent() {
    const useful = state.messages.filter((message) => message.content || message.role === 'user');
    if (!useful.length) return;
    const now = Date.now();
    const first = useful.find((message) => message.role === 'user');
    const title = (first?.content.trim() || first?.files?.[0] || 'New chat').replace(/\s+/g, ' ').slice(0, 52);
    const existing = state.chats.find((chat) => chat.id === state.chatId);
    if (existing) {
      Object.assign(existing, { title, provider: state.provider, model: state.model, updatedAt: now, messages: useful.map((message) => ({ ...message })) });
    } else {
      state.chatId = globalThis.crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      state.chats.unshift({ id: state.chatId, title, provider: state.provider, model: state.model, createdAt: now, updatedAt: now, messages: useful.map((message) => ({ ...message })) });
    }
    state.chats.sort((a, b) => b.updatedAt - a.updatedAt);
    state.chats = state.chats.slice(0, 50);
    callbacks.onChatsChanged?.(state.chats.slice());
  }
  function finishAssistant(text, stopped = false) {
    if (renderFrame) { cancelAnimationFrame(renderFrame); renderFrame = 0; }
    const last = state.messages[state.messages.length - 1];
    const content = typeof text === 'string' ? text : state.streamText;
    if (last?.role === 'assistant' && last.streaming) {
      last.content = content;
      last.streaming = false;
      if (!content) state.messages.pop();
    }
    setStreaming(false);
    renderMessages();
    saveCurrent();
    if (!stopped && content) callbacks.onSound?.('chime');
    callbacks.onMood?.(content ? 'happy' : 'idle');
  }
  function processEvent(event) {
    if (event.type === 'chunk' && typeof event.text === 'string') {
      state.streamText += event.text;
      const last = state.messages[state.messages.length - 1];
      if (last?.streaming) last.content = state.streamText;
      el['retry-banner'].hidden = true;
      scheduleStreamRender();
      return;
    }
    if (event.type === 'retry') {
      el['retry-banner'].hidden = false;
      el['retry-text'].textContent = `${event.error?.message || 'One little pause…'} Retrying in ${event.retryIn}s…`;
      return;
    }
    if (event.type === 'done') {
      finishAssistant(event.text, state.stopRequested);
      state.stopRequested = false;
      return;
    }
    if (event.type === 'error') {
      const info = event.error || { message: 'Oops—my thinking cap slipped. Please try again.', details: '' };
      finishAssistant(event.text || state.streamText, true);
      callbacks.onMood?.('oops');
      callbacks.onSound?.('boop');
      notify(info.message, info.details || '');
    }
  }
  function onEvent(event) {
    if (!event || typeof event.id !== 'string') return;
    if (state.streamId === 'pending') { state.pendingEvents.push(event); return; }
    if (event.id !== state.streamId) return;
    processEvent(event);
  }
  async function send() {
    if (state.streaming) return;
    const content = el['chat-input'].value.trim();
    const attachments = window.NoobyFiles.get();
    if (!content && !attachments.length) { notify('Give me a question or a little file snack first.', '', 'info'); return; }
    if (!state.keys[state.provider]) { notify(`I need a ${state.provider === 'gemini' ? 'Gemini' : 'OpenRouter'} key first. Add it in Settings.`); return; }
    if (!state.model) { notify('Pick a model from the live list first.'); await loadModels(); return; }
    if (attachments.some((file) => file.type === 'image') && selectedModel()?.supportsImage === false) {
      notify('This model prefers words and can’t see images. Pick a vision model or remove the image.'); return;
    }
    if (attachments.some((file) => file.type === 'pdf') && selectedModel()?.supportsPdf === false) {
      notify('This model can’t nibble PDFs. Pick a file-friendly model or remove the PDF.'); return;
    }
    const payload = {
      provider: state.provider,
      model: state.model,
      system: state.settings?.systemPrompt || '',
      messages: [...state.messages.filter((message) => !message.streaming).slice(-79).map((message) => ({ role: message.role, content: message.content })), { role: 'user', content }],
      attachments
    };
    const rewindTo = state.messages.length;
    state.messages.push({ role: 'user', content, files: attachments.map((file) => file.name) });
    state.messages.push({ role: 'assistant', content: '', streaming: true });
    state.streamText = '';
    state.stopRequested = false;
    state.streamId = 'pending';
    state.pendingEvents = [];
    setStreaming(true);
    el['chat-input'].value = '';
    el['chat-input'].style.height = '25px';
    renderMessages();
    callbacks.onActivity?.();
    callbacks.onSound?.('tick');
    callbacks.onSend?.();
    callbacks.onMood?.('thinking');
    try {
      const result = await window.nooby.chat.send(payload);
      if (!result?.id) {
        const error = new Error(result?.error?.message || 'I couldn’t start that chat.');
        error.public = result?.error;
        throw error;
      }
      state.streamId = result.id;
      window.NoobyFiles.clear();
      saveCurrent();
      const pending = state.pendingEvents.filter((event) => event.id === result.id);
      state.pendingEvents = [];
      for (const event of pending) processEvent(event);
      if (state.stopRequested && state.streamId) await window.nooby.chat.abort(result.id);
    } catch (error) {
      state.messages.splice(rewindTo);
      if (!el['chat-input'].value) el['chat-input'].value = content;
      setStreaming(false);
      renderMessages();
      callbacks.onMood?.('oops');
      callbacks.onSound?.('boop');
      notify(error.public?.message || error.message, error.public?.details || '');
    }
  }
  function stop() {
    if (!state.streaming) return;
    state.stopRequested = true;
    el['stop-button'].disabled = true;
    if (state.streamId && state.streamId !== 'pending') window.nooby.chat.abort(state.streamId);
  }
  function newChat() {
    if (state.streaming) { notify('Stop this thought before starting a new one.', '', 'info'); return; }
    state.chatId = null;
    state.messages = [];
    state.provider = state.settings?.provider || state.provider;
    state.model = state.settings?.models?.[state.provider] || '';
    window.NoobyFiles.clear();
    updateProvider();
    renderMessages();
    loadModels();
    focusInput();
  }
  function resume(id) {
    if (state.streaming) { notify('Stop this thought before hopping chats.', '', 'info'); return false; }
    const chat = state.chats.find((item) => item.id === id);
    if (!chat) return false;
    state.chatId = chat.id;
    state.messages = chat.messages.map((message) => ({ ...message }));
    state.provider = chat.provider;
    state.model = chat.model;
    updateProvider();
    renderMessages();
    loadModels(chat.provider);
    return true;
  }
  function switchProvider(provider) {
    if (!['gemini', 'openrouter'].includes(provider) || provider === state.provider) return;
    if (state.streaming) { notify('Let this thought finish before switching providers.', '', 'info'); return; }
    state.provider = provider;
    state.model = state.settings?.models?.[provider] || '';
    closeModelMenu();
    updateProvider();
    callbacks.onSettings?.({ provider });
    loadModels(provider);
  }
  function setSettings(settings) {
    state.settings = settings;
    if (!state.chatId && !state.streaming) {
      state.provider = settings.provider;
      state.model = settings.models?.[settings.provider] || '';
    }
    updateProvider();
  }
  function setKeys(keys) { state.keys = keys; updateModelLabel(); }
  function setActive(active) {
    state.active = active;
    if (active) loadModels();
    else closeModelMenu();
  }
  function focusInput() { el['chat-input'].focus(); }
  function init(options = {}) {
    callbacks = options;
    cacheElements();
    window.NoobyMarkdown.bind(el.messages);
    window.nooby.chat.onEvent(onEvent);
    el['chat-form'].addEventListener('submit', (event) => { event.preventDefault(); send(); });
    el['stop-button'].addEventListener('click', stop);
    el['new-chat'].addEventListener('click', newChat);
    el['provider-switch'].addEventListener('click', (event) => {
      const button = event.target.closest('button[data-provider]');
      if (button) switchProvider(button.dataset.provider);
    });
    el['model-select-button'].addEventListener('click', () => {
      if (el['model-menu'].hidden) {
        el['model-menu'].hidden = false;
        el['model-select-button'].setAttribute('aria-expanded', 'true');
        el['model-search'].focus();
        callbacks.onSize?.(true);
        renderModelOptions();
        loadModels();
      } else closeModelMenu();
    });
    el['model-search'].addEventListener('input', renderModelOptions);
    el['free-only'].addEventListener('change', renderModelOptions);
    el['model-options'].addEventListener('click', (event) => {
      const button = event.target.closest('button[data-model-id]');
      if (!button) return;
      state.model = button.dataset.modelId;
      callbacks.onSettings?.({ models: { [state.provider]: state.model } });
      updateModelLabel();
      renderModelOptions();
      closeModelMenu();
      focusInput();
    });
    document.addEventListener('click', (event) => { if (!el['model-dropdown'].contains(event.target)) closeModelMenu(); });
    el['chat-input'].addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); el['chat-form'].requestSubmit(); }
    });
    el['chat-input'].addEventListener('input', () => {
      el['chat-input'].style.height = '25px';
      el['chat-input'].style.height = `${Math.min(72, el['chat-input'].scrollHeight)}px`;
      callbacks.onActivity?.();
    });
  }
  window.NoobyChat = Object.freeze({
    init, setSettings, setKeys, setActive, send, stop, newChat, resume, switchProvider, focusInput,
    setHistory: (chats) => { state.chats = Array.isArray(chats) ? chats : []; },
    isStreaming: () => state.streaming,
    hasMessages: () => state.messages.length > 0,
    recent: () => state.chats.slice(0, 3)
  });
})();
