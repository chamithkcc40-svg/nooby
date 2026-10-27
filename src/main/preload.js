'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  if (typeof callback !== 'function') throw new TypeError('A callback is required.');
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('nooby', Object.freeze({
  setInteractive: (interactive) => {
    if (typeof interactive !== 'boolean') throw new TypeError('interactive must be a boolean.');
    ipcRenderer.send('island:interactive', interactive);
  },
  onToggle: (callback) => subscribe('island:toggle', callback),
  openSettings: () => ipcRenderer.invoke('settings:open'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  keys: Object.freeze({
    status: () => ipcRenderer.invoke('keys:status'),
    save: (provider, key) => ipcRenderer.invoke('keys:save', provider, key),
    remove: (provider) => ipcRenderer.invoke('keys:remove', provider),
    test: (provider) => ipcRenderer.invoke('keys:test', provider)
  }),
  models: Object.freeze({
    list: (provider) => ipcRenderer.invoke('models:list', provider)
  }),
  chat: Object.freeze({
    send: (payload) => ipcRenderer.invoke('chat:send', payload),
    abort: (id) => ipcRenderer.invoke('chat:abort', id),
    onEvent: (callback) => subscribe('chat:event', callback)
  }),
  settings: Object.freeze({
    get: () => ipcRenderer.invoke('settings:get'),
    set: (partial) => ipcRenderer.invoke('settings:set', partial),
    onChange: (callback) => subscribe('settings:change', callback)
  }),
  history: Object.freeze({
    load: () => ipcRenderer.invoke('history:load'),
    save: (data) => ipcRenderer.invoke('history:save', data)
  })
}));
