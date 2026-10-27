'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { safeStorage } = require('electron');

const PROVIDERS = ['gemini', 'openrouter'];
const COLORS = ['#FFF6E9', '#B8F2D0', '#FFC9B5', '#D5C8FF', '#BFE3FF', '#FFC6DD'];
const DEFAULT_SETTINGS = Object.freeze({
  provider: 'gemini',
  models: { gemini: '', openrouter: '' },
  systemPrompt: 'You are Nooby, a cheerful, concise desktop assistant. Be warm, helpful, and a little cheeky without overdoing it.',
  sound: { enabled: true, volume: 0.55 },
  autoCloseSeconds: 15,
  launchAtStartup: false,
  noobyColor: '#B8F2D0'
});

class StoreError extends Error {
  constructor(code, message, details = '') {
    super(message);
    this.name = 'StoreError';
    this.code = code;
    this.details = details;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new StoreError('INVALID_ARGUMENT', `${label} has an unexpected shape.`);
  }
}

function checkKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new StoreError('INVALID_ARGUMENT', `${label} contains an unsupported field.`);
    }
  }
}

function providerName(value) {
  if (!PROVIDERS.includes(value)) {
    throw new StoreError('INVALID_PROVIDER', 'Please choose Gemini or OpenRouter.');
  }
  return value;
}

function modelName(provider, value) {
  if (typeof value !== 'string' || value.length > 200) {
    throw new StoreError('INVALID_MODEL', 'That model name has an unexpected shape.');
  }
  if (!value) return '';
  const pattern = provider === 'gemini'
    ? /^(?:models\/)?[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/
    : /^[A-Za-z0-9~][A-Za-z0-9._~:/-]{0,199}$/;
  if (!pattern.test(value) || value.includes('..') || value.includes('//')) {
    throw new StoreError('INVALID_MODEL', 'That model name has an unexpected shape.');
  }
  return value.replace(/^models\//, '');
}

function cleanSettings(partial, current = DEFAULT_SETTINGS) {
  assertObject(partial, 'Settings');
  const top = ['provider', 'models', 'systemPrompt', 'sound', 'autoCloseSeconds', 'launchAtStartup', 'noobyColor'];
  checkKeys(partial, top, 'Settings');
  const next = clone(current);
  if (partial.provider !== undefined) next.provider = providerName(partial.provider);
  if (partial.systemPrompt !== undefined) {
    if (typeof partial.systemPrompt !== 'string' || partial.systemPrompt.length > 4000) {
      throw new StoreError('INVALID_SETTINGS', 'The system prompt must be 4,000 characters or fewer.');
    }
    next.systemPrompt = partial.systemPrompt;
  }
  if (partial.autoCloseSeconds !== undefined) {
    if (![10, 15, 30].includes(partial.autoCloseSeconds)) {
      throw new StoreError('INVALID_SETTINGS', 'Auto-close can be 10, 15, or 30 seconds.');
    }
    next.autoCloseSeconds = partial.autoCloseSeconds;
  }
  if (partial.launchAtStartup !== undefined) {
    if (typeof partial.launchAtStartup !== 'boolean') {
      throw new StoreError('INVALID_SETTINGS', 'Launch at startup must be on or off.');
    }
    next.launchAtStartup = partial.launchAtStartup;
  }
  if (partial.noobyColor !== undefined) {
    if (!COLORS.includes(partial.noobyColor)) {
      throw new StoreError('INVALID_SETTINGS', 'Please pick one of Nooby’s six colors.');
    }
    next.noobyColor = partial.noobyColor;
  }
  if (partial.models !== undefined) {
    assertObject(partial.models, 'Model defaults');
    checkKeys(partial.models, PROVIDERS, 'Model defaults');
    for (const provider of PROVIDERS) {
      if (partial.models[provider] !== undefined) {
        next.models[provider] = modelName(provider, partial.models[provider]);
      }
    }
  }
  if (partial.sound !== undefined) {
    assertObject(partial.sound, 'Sound settings');
    checkKeys(partial.sound, ['enabled', 'volume'], 'Sound settings');
    if (partial.sound.enabled !== undefined) {
      if (typeof partial.sound.enabled !== 'boolean') {
        throw new StoreError('INVALID_SETTINGS', 'Sound must be on or off.');
      }
      next.sound.enabled = partial.sound.enabled;
    }
    if (partial.sound.volume !== undefined) {
      if (typeof partial.sound.volume !== 'number' || !Number.isFinite(partial.sound.volume)
        || partial.sound.volume < 0 || partial.sound.volume > 1) {
        throw new StoreError('INVALID_SETTINGS', 'Volume must be between 0 and 1.');
      }
      next.sound.volume = partial.sound.volume;
    }
  }
  return next;
}

function cleanHistory(data) {
  assertObject(data, 'History');
  checkKeys(data, ['chats'], 'History');
  if (!Array.isArray(data.chats)) throw new StoreError('INVALID_HISTORY', 'History must contain a chat list.');
  const chats = data.chats.slice(0, 50).map((chat) => {
    assertObject(chat, 'Chat');
    checkKeys(chat, ['id', 'title', 'provider', 'model', 'createdAt', 'updatedAt', 'messages'], 'Chat');
    if (typeof chat.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(chat.id)) {
      throw new StoreError('INVALID_HISTORY', 'A chat has an invalid identifier.');
    }
    if (typeof chat.title !== 'string' || chat.title.length > 120
      || !Number.isFinite(chat.createdAt) || !Number.isFinite(chat.updatedAt)
      || !Array.isArray(chat.messages)) {
      throw new StoreError('INVALID_HISTORY', 'A chat has invalid metadata.');
    }
    const messages = chat.messages.slice(-100).map((message) => {
      assertObject(message, 'Message');
      checkKeys(message, ['role', 'content', 'files'], 'Message');
      if (!['user', 'assistant'].includes(message.role) || typeof message.content !== 'string'
        || message.content.length > 50000) {
        throw new StoreError('INVALID_HISTORY', 'A message has an unexpected shape.');
      }
      const clean = { role: message.role, content: message.content };
      if (message.files !== undefined) {
        if (!Array.isArray(message.files) || message.files.length > 8
          || message.files.some((name) => typeof name !== 'string' || name.length > 160)) {
          throw new StoreError('INVALID_HISTORY', 'A message has invalid file labels.');
        }
        clean.files = [...message.files];
      }
      return clean;
    });
    return {
      id: chat.id,
      title: chat.title,
      provider: providerName(chat.provider),
      model: modelName(chat.provider, chat.model),
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      messages
    };
  });
  return { chats };
}

class Store {
  constructor(userData) {
    fs.mkdirSync(userData, { recursive: true });
    this.settingsPath = path.join(userData, 'settings.json');
    this.keysPath = path.join(userData, 'keys.json');
    this.historyPath = path.join(userData, 'history.json');
    this.settings = this.read(this.settingsPath, null);
    try {
      this.settings = cleanSettings(this.settings || DEFAULT_SETTINGS);
    } catch {
      this.settings = clone(DEFAULT_SETTINGS);
    }
  }

  read(file, fallback) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return fallback;
    }
  }

  write(file, value) {
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, file);
  }

  getSettings() {
    return clone(this.settings);
  }

  setSettings(partial) {
    this.settings = cleanSettings(partial, this.settings);
    this.write(this.settingsPath, this.settings);
    return this.getSettings();
  }

  keyStatus() {
    const encrypted = this.read(this.keysPath, {}) || {};
    return {
      gemini: typeof encrypted.gemini === 'string' && encrypted.gemini.length > 0,
      openrouter: typeof encrypted.openrouter === 'string' && encrypted.openrouter.length > 0
    };
  }

  saveKey(provider, key) {
    providerName(provider);
    if (typeof key !== 'string' || key.trim().length < 8 || key.trim().length > 512 || /\s/.test(key.trim())) {
      throw new StoreError('INVALID_KEY', 'That key has an unexpected shape. Paste the complete key without spaces.');
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new StoreError('ENCRYPTION_UNAVAILABLE', 'I can’t safely save keys because Windows DPAPI encryption is unavailable. No key was saved.');
    }
    const encrypted = this.read(this.keysPath, {}) || {};
    encrypted[provider] = safeStorage.encryptString(key.trim()).toString('base64');
    this.write(this.keysPath, encrypted);
    return this.keyStatus();
  }

  removeKey(provider) {
    providerName(provider);
    const encrypted = this.read(this.keysPath, {}) || {};
    delete encrypted[provider];
    this.write(this.keysPath, encrypted);
    return this.keyStatus();
  }

  getKey(provider) {
    providerName(provider);
    const encrypted = this.read(this.keysPath, {}) || {};
    if (!encrypted[provider]) return null;
    if (!safeStorage.isEncryptionAvailable()) {
      throw new StoreError('ENCRYPTION_UNAVAILABLE', 'Windows DPAPI is unavailable, so I can’t unlock this key.');
    }
    try {
      return safeStorage.decryptString(Buffer.from(encrypted[provider], 'base64'));
    } catch {
      throw new StoreError('KEY_DECRYPT_FAILED', 'I couldn’t unlock this key. Remove it and save it again.');
    }
  }

  loadHistory() {
    try {
      return cleanHistory(this.read(this.historyPath, { chats: [] }) || { chats: [] });
    } catch {
      return { chats: [] };
    }
  }

  saveHistory(data) {
    const clean = cleanHistory(data);
    this.write(this.historyPath, clean);
    return clean;
  }
}

module.exports = { Store, StoreError, DEFAULT_SETTINGS, PROVIDERS, COLORS, providerName, modelName };
