(() => {
  const CMS = window.CMS;
  if (!CMS) return;

  const registerEditorComponent = (component) => {
    if (typeof CMS.registerEditorComponent !== 'function') return;
    try {
      CMS.registerEditorComponent(component);
    } catch (error) {
      console.warn('[cms-extensions] editor component skipped:', component.id, error);
    }
  };

  const h = window.h || window.React?.createElement;
  const getData = (entry, key, fallback = '') => entry?.getIn?.(['data', key]) ?? fallback;
  const normalizeList = (value) => value?.toJS?.() ?? value ?? [];
  const escapeHtml = (value) => String(value || '').replace(/[&<>"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  })[character]);

  registerEditorComponent({
    id: 'note-block',
    label: '提示块',
    fields: [
      { name: 'title', label: '标题', widget: 'string', default: '提示' },
      { name: 'body', label: '内容', widget: 'text', default: '这里写需要强调的内容。' }
    ],
    pattern: /^> \*\*(.*?)\*\*\n>\n>((?:.|\n)*)$/,
    fromBlock: (match) => ({
      title: match[1],
      body: match[2].replace(/^> ?/gm, '').trim()
    }),
    toBlock: ({ title, body }) => {
      const lines = String(body || '').split('\n').map((line) => `> ${line}`);
      return `> **${title || '提示'}**\n>\n${lines.join('\n')}`;
    },
    toPreview: ({ title, body }) => `<blockquote><p><strong>${escapeHtml(title || '提示')}</strong></p><p>${escapeHtml(body || '')}</p></blockquote>`
  });

  registerEditorComponent({
    id: 'code-block',
    label: '代码块',
    fields: [
      { name: 'language', label: '语言', widget: 'string', required: false, default: 'ts' },
      { name: 'code', label: '代码', widget: 'text', default: 'console.log("hello");' }
    ],
    pattern: /^```(\w*)\n([\s\S]*?)\n```$/,
    fromBlock: (match) => ({ language: match[1], code: match[2] }),
    toBlock: ({ language, code }) => `\`\`\`${language || ''}\n${code || ''}\n\`\`\``,
    toPreview: ({ language, code }) => `<pre><code class="language-${escapeHtml(language || '')}">${escapeHtml(code || '')}</code></pre>`
  });

  registerEditorComponent({
    id: 'video-link',
    label: '视频链接',
    fields: [
      { name: 'url', label: 'HTTPS 视频链接', widget: 'string', hint: '支持 Bilibili、YouTube、Cloudflare Stream、R2 等 HTTPS 地址，单独占一行。' },
      { name: 'caption', label: '说明', widget: 'string', required: false }
    ],
    pattern: /^\n?((?:https:\/\/)[^\s]+)\n?(?:\n_([^_]+)_)?$/,
    fromBlock: (match) => ({ url: match[1], caption: match[2] || '' }),
    toBlock: ({ url, caption }) => `${url || 'https://'}${caption ? `\n\n_${caption}_` : ''}`,
    toPreview: ({ url, caption }) => `<p><a href="${escapeHtml(url || '#')}">视频链接</a></p>${caption ? `<p><em>${escapeHtml(caption)}</em></p>` : ''}`
  });

  registerEditorComponent({
    id: 'attachment-link',
    label: '附件链接',
    fields: [
      { name: 'title', label: '附件名称', widget: 'string', default: '附件' },
      { name: 'url', label: '附件路径', widget: 'string', default: '/attachments/uploads/' }
    ],
    pattern: /^\[([^\]]+)\]\((\/attachments\/uploads\/[^)]+)\)$/,
    fromBlock: (match) => ({ title: match[1], url: match[2] }),
    toBlock: ({ title, url }) => `[${title || '附件'}](${url || '/attachments/uploads/'})`,
    toPreview: ({ title, url }) => `<p><a href="${escapeHtml(url || '#')}">${escapeHtml(title || '附件')}</a></p>`
  });

  if (typeof CMS.registerPreviewTemplate === 'function' && h) {
    try {
      CMS.registerPreviewTemplate('blog', ({ entry, widgetFor }) => {
        const title = getData(entry, 'title', '未命名文章');
        const description = getData(entry, 'description', '');
        const draft = getData(entry, 'draft', true);
        const heroImage = getData(entry, 'heroImage', '');
        const tags = normalizeList(getData(entry, 'tags', []));
        const attachments = normalizeList(getData(entry, 'attachments', []));
        const titleLength = String(title || '').length;
        const descriptionLength = String(description || '').length;

        return h('article', { className: 'cms-preview-article' },
          h('style', {}, `
            .cms-preview-article { padding: 32px; color: #18181b; font-family: Inter, system-ui, sans-serif; line-height: 1.75; }
            .cms-preview-card { border: 1px solid #e4e4e7; border-radius: 24px; padding: 20px; margin: 18px 0; background: #fff; }
            .cms-preview-title { margin: 0; font-family: Georgia, serif; font-size: 42px; line-height: 1.1; letter-spacing: -0.04em; }
            .cms-preview-description { color: #52525b; font-size: 18px; }
            .cms-preview-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
            .cms-preview-pill { border-radius: 999px; background: #eef2f7; padding: 4px 10px; color: #475569; font-size: 12px; }
            .cms-preview-warning { color: #b45309; }
            .cms-preview-ok { color: #047857; }
            .cms-preview-image { max-width: 100%; border-radius: 20px; margin-top: 18px; }
            .cms-preview-attachment { display: grid; gap: 4px; border: 1px solid #e4e4e7; border-radius: 16px; padding: 12px; margin-top: 10px; }
          `),
          h('section', { className: 'cms-preview-card' },
            h('p', { className: 'cms-preview-pill' }, draft ? '草稿状态：未发布' : '发布状态：公开'),
            h('h1', { className: 'cms-preview-title' }, title),
            h('p', { className: 'cms-preview-description' }, description || '还没有填写描述。'),
            h('div', { className: 'cms-preview-meta' }, tags.map((tag) => h('span', { className: 'cms-preview-pill', key: tag }, tag))),
            heroImage ? h('img', { className: 'cms-preview-image', src: heroImage, alt: title }) : null
          ),
          h('section', { className: 'cms-preview-card' },
            h('h2', {}, '发布前检查'),
            h('ul', {},
              h('li', { className: titleLength >= 30 && titleLength <= 60 ? 'cms-preview-ok' : 'cms-preview-warning' }, `标题长度：${titleLength} 字，建议 30-60 字。`),
              h('li', { className: descriptionLength >= 80 && descriptionLength <= 160 ? 'cms-preview-ok' : 'cms-preview-warning' }, `描述长度：${descriptionLength} 字，建议 80-160 字。`),
              h('li', { className: heroImage ? 'cms-preview-ok' : 'cms-preview-warning' }, heroImage ? '已设置头图。' : '未设置头图，将使用默认分享图。'),
              h('li', { className: draft ? 'cms-preview-warning' : 'cms-preview-ok' }, draft ? '当前仍是草稿，公开前记得关闭草稿。' : '当前会作为公开文章发布。')
            )
          ),
          attachments.length ? h('section', { className: 'cms-preview-card' },
            h('h2', {}, '附件'),
            attachments.map((attachment, index) => h('div', { className: 'cms-preview-attachment', key: index },
              h('strong', {}, attachment.title || '未命名附件'),
              h('span', {}, `${attachment.type || 'other'} · ${attachment.file || '未选择文件'}`),
              attachment.description ? h('span', {}, attachment.description) : null
            ))
          ) : null,
          h('section', { className: 'cms-preview-card' }, widgetFor('body'))
        );
      });
    } catch (error) {
      console.warn('[cms-extensions] preview template skipped:', error);
    }
  }
})();
