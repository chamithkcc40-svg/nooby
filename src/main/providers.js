'use strict';

const { modelName, providerName } = require('./store');
const GEMINI_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const OPENROUTER_ROOT = 'https://openrouter.ai/api/v1';
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
class ProviderError extends Error {
  constructor(code, message, details = '', status = 0) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}
function redact(value, key = '') {
  let text = String(value || '').slice(0, 1200);
  if (key) text = text.split(key).join('[hidden]');
  return text
    .replace(/AIza[A-Za-z0-9_-]{12,}/g, '[hidden]')
    .replace(/sk-or-[A-Za-z0-9_-]{8,}/g, '[hidden]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [hidden]');
}
function publicError(error) {
  if (error instanceof ProviderError || error?.name === 'StoreError') {
    return {
      code: error.code || 'PROVIDER_ERROR',
      message: error.message,
      details: redact(error.details || ''),
      status: error.status || 0
    };
  }
  if (error?.name === 'AbortError') {
    return { code: 'ABORTED', message: 'Okay, I stopped.', details: '', status: 0 };
  }
  return {
    code: 'UNKNOWN',
    message: 'Oops—my thinking cap slipped. Please try again.',
    details: redact(error?.code || error?.name || 'Unknown error'),
    status: 0
  };
}
function responseError(status, details) {
  if (status === 401 || status === 403) {
    return new ProviderError('BAD_KEY', 'My key looks wrong. Could you check it in Settings?', details, status);
  }
  if (status === 429) {
    return new ProviderError('RATE_LIMIT', 'Too many pokes at once, back in 3 seconds.', details, status);
  }
  if (status === 404) {
    return new ProviderError('MODEL_GONE', 'That model wandered off. Refresh the live list and pick another.', details, status);
  }
  if (status === 413) {
    return new ProviderError('TOO_LARGE', 'That snack is too big for this model. Try a smaller file.', details, status);
  }
  if (status >= 500) {
    return new ProviderError('SERVER_ERROR', 'The model tripped over a cable. I’ll try again.', details, status);
  }
  return new ProviderError('BAD_REQUEST', 'That request didn’t sit right. Try another model or remove an attachment.', details, status);
}
function offlineError(error) {
  return new ProviderError(
    'OFFLINE',
    'I can’t reach the internet. I’ll wait and try again.',
    redact(error?.cause?.code || error?.code || 'Network unavailable')
  );
}
async function responseDetails(response, key) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text);
    return redact(parsed.error?.message || parsed.message || text, key);
  } catch {
    return redact(text || `HTTP ${response.status}`, key);
  }
}
async function requestJson(url, options, key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw responseError(response.status, await responseDetails(response, key));
    try { return await response.json(); }
    catch { throw new ProviderError('BAD_RESPONSE', 'The provider sent a scrambled response. Please try again.'); }
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw offlineError(error);
  } finally {
    clearTimeout(timer);
  }
}
function headers(provider, key, json = false) {
  const result = provider === 'gemini'
    ? { 'x-goog-api-key': key }
    : { Authorization: `Bearer ${key}`, 'X-OpenRouter-Title': 'Nooby App' };
  if (json) result['Content-Type'] = 'application/json';
  return result;
}
function needKey(provider, key) {
  providerName(provider);
  if (!key) {
    throw new ProviderError('NO_KEY', `I need a ${provider === 'gemini' ? 'Gemini' : 'OpenRouter'} key first. Add it in Settings.`);
  }
}
async function listModels(provider, key) {
  needKey(provider, key);
  if (provider === 'gemini') {
    const models = [];
    let token = '';
    for (let page = 0; page < 10; page += 1) {
      const query = new URLSearchParams({ pageSize: '1000' });
      if (token) query.set('pageToken', token);
      const data = await requestJson(`${GEMINI_ROOT}/models?${query}`, { headers: headers(provider, key) }, key);
      for (const model of data.models || []) {
        if (!(model.supportedGenerationMethods || []).includes('generateContent')) continue;
        const id = String(model.name || '').replace(/^models\//, '');
        if (!id) continue;
        models.push({
          id,
          name: model.displayName || id,
          free: false,
          supportsImage: null,
          supportsPdf: true
        });
      }
      token = data.nextPageToken || '';
      if (!token) break;
    }
    return models.sort((a, b) => a.name.localeCompare(b.name));
  }
  const models = [];
  const seen = new Set();
  for (let page = 0; page < 10; page += 1) {
    const data = await requestJson(
      `${OPENROUTER_ROOT}/models?limit=500&offset=${page * 500}`,
      { headers: headers(provider, key) },
      key
    );
    const batch = Array.isArray(data.data) ? data.data : [];
    let added = 0;
    for (const model of batch) {
      if (!model.id || seen.has(model.id)) continue;
      seen.add(model.id);
      added += 1;
      const inputs = model.architecture?.input_modalities || [];
      const pricing = model.pricing || {};
      const free = Boolean(model.pricing) && ['prompt', 'completion', 'request', 'image']
        .every((name) => Number(pricing[name] || 0) === 0);
      models.push({
        id: model.id,
        name: model.name || model.id,
        free,
        supportsImage: inputs.includes('image'),
        supportsPdf: true,
        contextLength: Number(model.context_length || 0)
      });
    }
    if (batch.length < 500 || added === 0) break;
  }
  return models.sort((a, b) => a.name.localeCompare(b.name));
}
async function testKey(provider, key) {
  needKey(provider, key);
  const root = provider === 'gemini' ? GEMINI_ROOT : OPENROUTER_ROOT;
  const suffix = provider === 'gemini' ? '/models?pageSize=1' : '/key';
  await requestJson(`${root}${suffix}`, { headers: headers(provider, key) }, key);
  return true;
}
function validateChat(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new ProviderError('INVALID_CHAT', 'That chat has an unexpected shape.');
  const allowed = ['provider', 'model', 'system', 'messages', 'attachments'];
  if (Object.keys(payload).some((key) => !allowed.includes(key))) throw new ProviderError('INVALID_CHAT', 'That chat contains an unsupported field.');
  const provider = providerName(payload.provider);
  const model = modelName(provider, payload.model);
  if (!model) throw new ProviderError('NO_MODEL', 'Pick a model from the live list first.');
  if (typeof payload.system !== 'string' || payload.system.length > 4000
    || !Array.isArray(payload.messages) || payload.messages.length < 1 || payload.messages.length > 80) {
    throw new ProviderError('INVALID_CHAT', 'That chat has an unexpected shape.');
  }
  const messages = payload.messages.map((message) => {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string'
      || message.content.length > 50000) throw new ProviderError('INVALID_CHAT', 'A message has an unexpected shape.');
    return { role: message.role, content: message.content };
  });
  if (messages[messages.length - 1].role !== 'user') throw new ProviderError('INVALID_CHAT', 'The last message must be yours.');
  if (!Array.isArray(payload.attachments) || payload.attachments.length > 8) {
    throw new ProviderError('INVALID_FILES', 'You can attach up to eight files at once.');
  }
  let totalBytes = 0;
  const attachments = payload.attachments.map((file) => {
    if (!file || typeof file.name !== 'string' || file.name.length > 160 || !['image', 'pdf', 'text'].includes(file.type)) {
      throw new ProviderError('INVALID_FILES', 'One of those files has an unexpected shape.');
    }
    const clean = { name: file.name, type: file.type };
    if (file.type === 'text') {
      if (typeof file.text !== 'string' || file.text.length > 100000) throw new ProviderError('INVALID_FILES', `${file.name} is over the 100k character limit.`);
      clean.text = file.text;
      return clean;
    }
    if (typeof file.mimeType !== 'string' || typeof file.data !== 'string'
      || file.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) {
      throw new ProviderError('INVALID_FILES', `${file.name} has invalid file data.`);
    }
    const bytes = Math.floor(file.data.length * 3 / 4);
    const limit = file.type === 'image' ? 10 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.type === 'image' && !IMAGE_TYPES.includes(file.mimeType)) throw new ProviderError('INVALID_FILES', `${file.name} is not a supported image.`);
    if (file.type === 'pdf' && file.mimeType !== 'application/pdf') throw new ProviderError('INVALID_FILES', `${file.name} is not a PDF.`);
    if (!bytes || bytes > limit) throw new ProviderError('INVALID_FILES', `${file.name} is empty or too large.`);
    totalBytes += bytes;
    clean.mimeType = file.mimeType;
    clean.data = file.data;
    return clean;
  });
  if (totalBytes > 30 * 1024 * 1024) throw new ProviderError('INVALID_FILES', 'Those files total over 30 MB. Send a smaller bundle.');
  return { provider, model, system: payload.system, messages, attachments };
}
function fencedAttachment(file) {
  const language = (file.name.split('.').pop() || 'txt').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20);
  const fence = file.text.includes('```') ? '````' : '```';
  return `\n\n[Attached file: ${file.name}]\n${fence}${language}\n${file.text}\n${fence}`;
}
function promptWithText(message, attachments) {
  return message.content + attachments.filter((file) => file.type === 'text').map(fencedAttachment).join('');
}
function geminiBody(payload) {
  const last = payload.messages.length - 1;
  const contents = payload.messages.map((message, index) => {
    const parts = [{ text: index === last ? promptWithText(message, payload.attachments) : message.content }];
    if (index === last) {
      for (const file of payload.attachments) {
        if (file.type !== 'text') parts.push({ inline_data: { mime_type: file.mimeType, data: file.data } });
      }
    }
    return { role: message.role === 'assistant' ? 'model' : 'user', parts };
  });
  const body = { contents };
  if (payload.system) body.systemInstruction = { parts: [{ text: payload.system }] };
  return body;
}
function openRouterBody(payload) {
  const messages = payload.system ? [{ role: 'system', content: payload.system }] : [];
  const last = payload.messages.length - 1;
  for (const [index, message] of payload.messages.entries()) {
    if (index !== last || payload.attachments.length === 0) {
      messages.push({ role: message.role, content: message.content });
      continue;
    }
    const content = [{ type: 'text', text: promptWithText(message, payload.attachments) }];
    for (const file of payload.attachments) {
      if (file.type === 'image') content.push({ type: 'image_url', image_url: { url: `data:${file.mimeType};base64,${file.data}` } });
      if (file.type === 'pdf') content.push({ type: 'file', file: { filename: file.name, file_data: `data:application/pdf;base64,${file.data}` } });
    }
    messages.push({ role: 'user', content });
  }
  return { model: payload.model, messages, stream: true };
}
async function consumeSSE(response, onData) {
  if (!response.body) throw new ProviderError('BAD_STREAM', 'The model sent an empty stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines = [];
  const flush = () => {
    if (!dataLines.length) return;
    const data = dataLines.join('\n');
    dataLines = [];
    onData(data);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const clean = line.endsWith('\r') ? line.slice(0, -1) : line;
        if (!clean) flush();
        else if (clean.startsWith('data:')) dataLines.push(clean.slice(5).trimStart());
      }
    }
    buffer += decoder.decode();
    if (buffer.startsWith('data:')) dataLines.push(buffer.slice(5).trimStart());
    flush();
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
function abortError() {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}
async function streamOnce(payload, key, signal, onChunk) {
  if (signal.aborted) throw abortError();
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), 30000);
  let response;
  try {
    const gemini = payload.provider === 'gemini';
    const url = gemini
      ? `${GEMINI_ROOT}/models/${encodeURIComponent(payload.model)}:streamGenerateContent?alt=sse`
      : `${OPENROUTER_ROOT}/chat/completions`;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: headers(payload.provider, key, true),
        body: JSON.stringify(gemini ? geminiBody(payload) : openRouterBody(payload)),
        signal: controller.signal
      });
    } catch (error) {
      if (signal.aborted) throw abortError();
      throw offlineError(error);
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw responseError(response.status, await responseDetails(response, key));
    let text = '';
    await consumeSSE(response, (data) => {
      if (data === '[DONE]') return;
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        return;
      }
      if (event.error) throw new ProviderError('STREAM_ERROR', 'The stream hiccuped. Please try again.', redact(event.error.message, key), Number(event.error.code || 0));
      if (gemini) {
        if (event.promptFeedback?.blockReason || (event.candidates || []).some((candidate) => ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST'].includes(candidate.finishReason))) {
          throw new ProviderError('SAFETY', 'I’d rather keep this chat safe and cozy. Try rephrasing that part?', redact(event.promptFeedback?.blockReason || 'Safety filter'));
        }
        const chunk = (event.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('');
        if (chunk) { text += chunk; onChunk(chunk); }
      } else {
        const content = event.choices?.[0]?.delta?.content;
        const chunk = typeof content === 'string' ? content : Array.isArray(content)
          ? content.filter((part) => part.type === 'text').map((part) => part.text || '').join('') : '';
        if (chunk) { text += chunk; onChunk(chunk); }
      }
    });
    return text;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}
function sleep(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, milliseconds);
    const onAbort = () => { clearTimeout(timer); reject(abortError()); };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
async function streamChat(payload, key, signal, emit) {
  needKey(payload.provider, key);
  let rateRetried = false;
  let networkRetries = 0;
  while (true) {
    let emitted = false;
    try {
      return await streamOnce(payload, key, signal, (text) => {
        emitted = true;
        emit({ type: 'chunk', text });
      });
    } catch (error) {
      if (signal.aborted || error?.name === 'AbortError') throw abortError();
      const normalized = error instanceof ProviderError ? error : offlineError(error);
      const rate = normalized.status === 429;
      const network = normalized.code === 'OFFLINE' || normalized.status >= 500;
      const canRetry = !emitted && ((rate && !rateRetried) || (network && networkRetries < 2));
      if (!canRetry) {
        if (rate && rateRetried) throw new ProviderError('RATE_LIMIT', 'Still too many pokes. Let’s take a longer breather before trying again.', normalized.details, 429);
        throw normalized;
      }
      if (rate) rateRetried = true;
      else networkRetries += 1;
      const seconds = rate ? 3 : 2 ** networkRetries;
      const info = publicError(normalized);
      for (let left = seconds; left > 0; left -= 1) {
        emit({ type: 'retry', retryIn: left, error: info });
        await sleep(1000, signal);
      }
    }
  }
}
module.exports = { listModels, testKey, validateChat, streamChat, publicError, ProviderError };
