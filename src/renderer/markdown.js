'use strict';

(() => {
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[character]);
  }

  function render(markdown) {
    const tokens = [];
    const token = (html) => {
      const index = tokens.push(html) - 1;
      return `\u0000N${index}\u0000`;
    };
    let source = escapeHtml(String(markdown ?? '')).slice(0, 100000);
    source = source.replace(/```([A-Za-z0-9_+-]{0,20})[^\S\r\n]*\r?\n([\s\S]*?)```/g, (_match, language, code) => token(
      `<div class="code-block"><div class="code-head"><span>${language || 'code'}</span><button class="code-copy" type="button">Copy</button></div><pre><code>${code.replace(/^\r?\n|\r?\n$/g, '')}</code></pre></div>`
    ));

    function inline(text) {
      let value = text.replace(/`([^`\r\n]+)`/g, (_match, code) => token(`<code>${code}</code>`));
      value = value.replace(/https:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&()*+,;=%]+/g, (matched) => {
        const url = matched.replace(/&(?:quot|#039|lt|gt);.*$/, '').replace(/[.,!?]+$/, '');
        return token(`<a href="${url}" data-external="true" rel="noopener noreferrer">${url}</a>`);
      });
      value = value.replace(/\*\*([^*\r\n]+)\*\*/g, '<strong>$1</strong>');
      value = value.replace(/__([^_\r\n]+)__/g, '<strong>$1</strong>');
      value = value.replace(/(^|[^*])\*([^*\r\n]+)\*(?!\*)/g, '$1<em>$2</em>');
      return value;
    }

    const lines = source.split(/\r?\n/);
    const output = [];
    let paragraph = [];
    const flushParagraph = () => {
      if (!paragraph.length) return;
      output.push(`<p>${inline(paragraph.join('<br>'))}</p>`);
      paragraph = [];
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^\u0000N\d+\u0000$/.test(line)) {
        flushParagraph();
        output.push(line);
        continue;
      }
      const unordered = /^\s*[-*]\s+(.+)$/.exec(line);
      const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
      if (unordered || ordered) {
        flushParagraph();
        const isOrdered = Boolean(ordered);
        const pattern = isOrdered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-*]\s+(.+)$/;
        const items = [];
        while (index < lines.length) {
          const match = pattern.exec(lines[index]);
          if (!match) break;
          items.push(`<li>${inline(match[1])}</li>`);
          index += 1;
        }
        index -= 1;
        output.push(isOrdered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
        continue;
      }
      if (!line.trim()) flushParagraph();
      else paragraph.push(line);
    }
    flushParagraph();
    return output.join('').replace(/\u0000N(\d+)\u0000/g, (_match, index) => tokens[Number(index)] || '');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.append(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
  }

  function bind(container) {
    container.addEventListener('click', (event) => {
      const copy = event.target.closest('.code-copy');
      if (copy && container.contains(copy)) {
        const code = copy.closest('.code-block')?.querySelector('pre code')?.textContent || '';
        copyText(code).then(() => {
          copy.textContent = 'Copied!';
          setTimeout(() => { if (copy.isConnected) copy.textContent = 'Copy'; }, 1200);
        });
        return;
      }
      const link = event.target.closest('a[data-external]');
      if (link && container.contains(link)) {
        event.preventDefault();
        const url = link.getAttribute('href');
        if (url?.startsWith('https://')) window.nooby.openExternal(url);
      }
    });
  }

  window.NoobyMarkdown = Object.freeze({ render, bind, escapeHtml });
})();
