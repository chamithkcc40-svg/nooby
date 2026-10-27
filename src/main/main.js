/*
 * NOOBY IPC CONTRACT — window.nooby (all channels are namespace:method)
 * setInteractive(bool)       send    island:interactive
 * onToggle(cb)               receive island:toggle        action: toggle|expand|collapse
 * openSettings()             invoke  settings:open
 * openExternal(url)          invoke  shell:openExternal   HTTPS only
 * keys.status()              invoke  keys:status          -> {gemini:bool,openrouter:bool}
 * keys.save(provider,key)    invoke  keys:save            -> {ok,status}|{ok:false,error}
 * keys.remove(provider)      invoke  keys:remove          -> {ok,status}|{ok:false,error}
 * keys.test(provider)        invoke  keys:test            -> {ok:true}|{ok:false,error}
 * models.list(provider)      invoke  models:list          -> {ok,models}|{ok:false,error}
 * chat.send(payload)         invoke  chat:send            -> {id}; payload is validated
 * chat.abort(id)             invoke  chat:abort
 * chat.onEvent(cb)           receive chat:event           {id,type:chunk|done|error|retry,text?,error?,retryIn?}
 * settings.get()             invoke  settings:get
 * settings.set(partial)      invoke  settings:set         -> {ok,settings}|{ok:false,error}
 * settings.onChange(cb)      receive settings:change
 * history.load()             invoke  history:load         -> {chats}
 * history.save(data)         invoke  history:save
 * Keys and raw provider HTTP responses stay in main; only sanitized events enter renderers.
 */
'use strict';

const path = require('node:path');
const { randomUUID } = require('node:crypto');
const {
  app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut,
  nativeImage, screen, shell
} = require('electron');
const { Store, StoreError } = require('./store');
const Providers = require('./providers');

let island = null;
let settingsWindow = null;
let tray = null;
let store = null;
let quitting = false;
const activeChats = new Map();
const gotLock = app.requestSingleInstanceLock();

function publicError(error) {
  return Providers.publicError(error);
}

function authorize(event, area) {
  const fromIsland = island && !island.isDestroyed() && event.sender.id === island.webContents.id;
  const fromSettings = settingsWindow && !settingsWindow.isDestroyed() && event.sender.id === settingsWindow.webContents.id;
  if ((area === 'island' && !fromIsland) || (area === 'settings' && !fromSettings)
    || (area === 'both' && !fromIsland && !fromSettings)) {
    throw new StoreError('UNTRUSTED_SENDER', 'That request came from an unknown window.');
  }
}

function handle(channel, area, callback) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      authorize(event, area);
      return await callback(...args);
    } catch (error) {
      return { ok: false, error: publicError(error) };
    }
  });
}

function sendToggle(action) {
  if (island && !island.isDestroyed()) island.webContents.send('island:toggle', action);
}

function positionIsland() {
  if (!island || island.isDestroyed()) return;
  const area = screen.getPrimaryDisplay().workArea;
  island.setBounds({ x: Math.round(area.x + (area.width - 760) / 2), y: area.y, width: 760, height: 560 });
}

function hardenWindow(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url).catch(() => {});
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event) => event.preventDefault());
}

function createIsland() {
  island = new BrowserWindow({
    width: 760,
    height: 560,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    roundedCorners: false,
    show: false,
    title: 'Nooby App',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  island.setAlwaysOnTop(true, 'screen-saver');
  island.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  island.setIgnoreMouseEvents(true, { forward: true });
  positionIsland();
  hardenWindow(island);
  island.once('ready-to-show', () => {
    island.show();
    island.setIgnoreMouseEvents(true, { forward: true });
  });
  island.on('blur', () => { if (!quitting) sendToggle('collapse'); });
  island.on('closed', () => { island = null; });
  island.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  sendToggle('collapse');
  settingsWindow = new BrowserWindow({
    width: 520,
    height: 640,
    resizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#0B0B10',
    title: 'Settings - Nooby',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  hardenWindow(settingsWindow);
  settingsWindow.once('ready-to-show', () => settingsWindow.show());
  settingsWindow.on('closed', () => { settingsWindow = null; });
  settingsWindow.loadFile(path.join(__dirname, '..', 'settings', 'settings.html'));
}

function trayImage() {
  const size = 16;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const corner = (x < 2 || x > 13) && (y < 2 || y > 13);
      const offset = (y * size + x) * 4;
      const eye = y >= 5 && y <= 9 && ((x >= 4 && x <= 5) || (x >= 10 && x <= 11));
      pixels[offset] = eye ? 16 : 208;
      pixels[offset + 1] = eye ? 16 : 242;
      pixels[offset + 2] = eye ? 24 : 184;
      pixels[offset + 3] = corner ? 0 : 255;
    }
  }
  return nativeImage.createFromBitmap(pixels, { width: size, height: size });
}

function showIsland() {
  if (!island) return;
  island.show();
  island.focus();
  sendToggle('expand');
}

function createTray() {
  tray = new Tray(trayImage());
  tray.setToolTip('Nooby App');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show / Hide', click: () => { if (island?.isVisible()) island.hide(); else showIsland(); } },
    { label: 'Settings', click: createSettingsWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]));
  tray.on('click', () => { if (island?.isVisible()) island.hide(); else showIsland(); });
}

async function openExternal(url) {
  if (typeof url !== 'string' || url.length > 2048) throw new StoreError('INVALID_URL', 'That link has an unexpected shape.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new StoreError('INVALID_URL', 'I only open safe HTTPS links.');
  await shell.openExternal(parsed.toString());
  return { ok: true };
}

function sendChatEvent(id, event) {
  if (island && !island.isDestroyed()) island.webContents.send('chat:event', { id, ...event });
}

async function runChat(id, payload, controller) {
  let partial = '';
  const emit = (event) => {
    if (event.type === 'chunk') partial += event.text;
    sendChatEvent(id, event);
  };
  try {
    const key = store.getKey(payload.provider);
    const text = await Providers.streamChat(payload, key, controller.signal, emit);
    sendChatEvent(id, { type: 'done', text });
  } catch (error) {
    if (controller.signal.aborted || error?.name === 'AbortError') {
      sendChatEvent(id, { type: 'done', text: partial });
    } else {
      sendChatEvent(id, { type: 'error', error: publicError(error), text: partial });
    }
  } finally {
    activeChats.delete(id);
  }
}

function registerIpc() {
  ipcMain.on('island:interactive', (event, interactive) => {
    if (!island || event.sender.id !== island.webContents.id || typeof interactive !== 'boolean') return;
    island.setIgnoreMouseEvents(!interactive, { forward: true });
  });
  handle('settings:open', 'both', () => { createSettingsWindow(); return { ok: true }; });
  handle('shell:openExternal', 'both', openExternal);
  handle('keys:status', 'both', () => store.keyStatus());
  handle('keys:save', 'both', async (provider, key) => ({ ok: true, status: store.saveKey(provider, key) }));
  handle('keys:remove', 'both', async (provider) => ({ ok: true, status: store.removeKey(provider) }));
  handle('keys:test', 'both', async (provider) => ({ ok: await Providers.testKey(provider, store.getKey(provider)) }));
  handle('models:list', 'both', async (provider) => ({ ok: true, models: await Providers.listModels(provider, store.getKey(provider)) }));
  handle('settings:get', 'both', () => store.getSettings());
  handle('settings:set', 'both', (partial) => {
    const settings = store.setSettings(partial);
    if (process.platform === 'win32') app.setLoginItemSettings({ openAtLogin: settings.launchAtStartup });
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('settings:change', settings);
    return { ok: true, settings };
  });
  handle('history:load', 'island', () => store.loadHistory());
  handle('history:save', 'island', (data) => { store.saveHistory(data); return { ok: true }; });
  handle('chat:send', 'island', (input) => {
    const payload = Providers.validateChat(input);
    const id = randomUUID();
    const controller = new AbortController();
    activeChats.set(id, controller);
    runChat(id, payload, controller).catch(() => {});
    return { id };
  });
  handle('chat:abort', 'island', (id) => {
    if (typeof id !== 'string' || !/^[A-Fa-f0-9-]{36}$/.test(id)) throw new StoreError('INVALID_ID', 'That chat identifier has an unexpected shape.');
    activeChats.get(id)?.abort();
    return { ok: true };
  });
}

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showIsland());
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => {
    quitting = true;
    for (const controller of activeChats.values()) controller.abort();
    globalShortcut.unregisterAll();
  });
  app.whenReady().then(() => {
    store = new Store(app.getPath('userData'));
    registerIpc();
    createIsland();
    createTray();
    globalShortcut.register('Control+Alt+N', () => {
      if (!island) return;
      island.show();
      island.focus();
      sendToggle('toggle');
    });
    if (process.platform === 'win32') {
      app.setLoginItemSettings({ openAtLogin: store.getSettings().launchAtStartup });
    }
    screen.on('display-metrics-changed', positionIsland);
  }).catch(() => app.quit());
}
