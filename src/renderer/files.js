'use strict';

(() => {
  const IMAGE_TYPES = new Map([
    ['png', 'image/png'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'],
    ['webp', 'image/webp'], ['gif', 'image/gif']
  ]);
  const TEXT_EXTENSIONS = new Set([
    'txt', 'text', 'log', 'md', 'markdown', 'json', 'csv', 'py', 'js', 'jsx', 'ts', 'tsx',
    'kt', 'kts', 'java', 'html', 'htm', 'css', 'xml', 'yml', 'yaml', 'toml', 'ini', 'rs',
    'go', 'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'rb', 'php', 'swift', 'sh', 'bat', 'sql', 'svg'
  ]);
  const attachments = [];
  let callbacks = {};
  let input;
  let dropZone;

  function notify(message, details = '', type = 'error') {
    callbacks.onError?.(message, details, type);
  }

  function extension(name) {
    return name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  }

  function uniqueId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function render() {
    for (const id of ['composer-attachments', 'files-chips']) {
      const container = document.getElementById(id);
      const fragment = document.createDocumentFragment();
      for (const file of attachments) {
        const chip = document.createElement('span');
        chip.className = 'attachment-chip';
        chip.title = `${file.name}${file.truncated ? ' (trimmed to 100k characters)' : ''}`;
        const icon = document.createElement('b');
        icon.textContent = file.type === 'image' ? '▧' : file.type === 'pdf' ? '▤' : '≡';
        const name = document.createElement('span');
        name.textContent = `${file.truncated ? '✂ ' : ''}${file.name}`;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.dataset.fileId = file.id;
        remove.setAttribute('aria-label', `Remove ${file.name}`);
        remove.textContent = '×';
        chip.append(icon, name, remove);
        fragment.append(chip);
      }
      container.replaceChildren(fragment);
    }
    callbacks.onChange?.(attachments.slice());
  }

  function remove(id) {
    const index = attachments.findIndex((file) => file.id === id);
    if (index >= 0) {
      attachments.splice(index, 1);
      render();
    }
  }

  function clear() {
    attachments.splice(0, attachments.length);
    render();
  }

  function readBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('read'));
      reader.readAsDataURL(file);
    });
  }

  async function convert(file) {
    const name = file.name || 'pasted-file';
    const ext = extension(name);
    if (IMAGE_TYPES.has(ext)) {
      if (!file.size || file.size > 10 * 1024 * 1024) throw new Error(`${name} is empty or over the 10 MB image limit.`);
      return { id: uniqueId(), name, type: 'image', mimeType: IMAGE_TYPES.get(ext), data: await readBase64(file), size: file.size };
    }
    if (ext === 'pdf') {
      if (!file.size || file.size > 20 * 1024 * 1024) throw new Error(`${name} is empty or over the 20 MB PDF limit.`);
      return { id: uniqueId(), name, type: 'pdf', mimeType: 'application/pdf', data: await readBase64(file), size: file.size };
    }
    if (TEXT_EXTENSIONS.has(ext)) {
      const text = await file.slice(0, 400000).text();
      return {
        id: uniqueId(), name: name || 'pasted.txt', type: 'text', text: text.slice(0, 100000),
        truncated: text.length > 100000 || file.size > 400000, size: file.size
      };
    }
    throw new Error(`I can’t nibble “${name}” yet. Try PDF, PNG/JPG/WebP/GIF, or a text-based doc.`);
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    for (const file of files) {
      if (attachments.length >= 8) {
        notify('Eight snacks is my limit—remove one before adding another.');
        break;
      }
      try {
        const converted = await convert(file);
        const binaryTotal = attachments.filter((item) => item.type !== 'text').reduce((sum, item) => sum + item.size, 0);
        if (converted.type !== 'text' && binaryTotal + converted.size > 30 * 1024 * 1024) {
          throw new Error('That bundle is over 30 MB. Send a smaller group of files.');
        }
        attachments.push(converted);
        render();
        if (converted.truncated) notify(`${converted.name} was trimmed to 100k characters.`, '', 'info');
      } catch (error) {
        notify(error.message || 'I couldn’t read that file. Could you try another?');
      }
    }
  }

  function hasFiles(event) {
    return Array.from(event.dataTransfer?.types || []).includes('Files');
  }

  function init(options = {}) {
    callbacks = options;
    input = document.getElementById('file-input');
    dropZone = document.getElementById('drop-zone');
    const island = document.getElementById('island');
    dropZone.addEventListener('click', () => input.click());
    dropZone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
    });
    document.getElementById('browse-button').addEventListener('click', (event) => {
      event.stopPropagation();
      input.click();
    });
    input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
    for (const id of ['composer-attachments', 'files-chips']) {
      document.getElementById(id).addEventListener('click', (event) => {
        const button = event.target.closest('button[data-file-id]');
        if (button) { event.stopPropagation(); remove(button.dataset.fileId); }
      });
    }
    island.addEventListener('dragenter', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dropZone.classList.add('dragging');
      callbacks.onFileHover?.(true);
    });
    island.addEventListener('dragover', (event) => {
      if (hasFiles(event)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }
    });
    island.addEventListener('dragleave', (event) => {
      if (event.relatedTarget && island.contains(event.relatedTarget)) return;
      dropZone.classList.remove('dragging');
      callbacks.onFileHover?.(false);
    });
    island.addEventListener('drop', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dropZone.classList.remove('dragging');
      callbacks.onFileHover?.(false);
      callbacks.onFileDrop?.();
      addFiles(event.dataTransfer.files);
    });
    document.addEventListener('paste', (event) => {
      if (event.clipboardData?.files?.length) {
        event.preventDefault();
        addFiles(event.clipboardData.files);
        callbacks.onFileDrop?.();
        return;
      }
      if (document.activeElement !== dropZone) return;
      const text = event.clipboardData?.getData('text/plain') || '';
      if (text.trim()) {
        event.preventDefault();
        addFiles([new File([text], 'pasted.txt', { type: 'text/plain' })]);
      }
    });
    render();
  }

  window.NoobyFiles = Object.freeze({
    init,
    addFiles,
    clear,
    get: () => attachments.slice(),
    hasImages: () => attachments.some((file) => file.type === 'image')
  });
})();
