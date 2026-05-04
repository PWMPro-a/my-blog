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
            .cms-preview-article {
              min-height: 100vh;
              padding: 42px;
              color: #18181b;
              font-family: Inter, system-ui, sans-serif;
              line-height: 1.75;
              background:
                radial-gradient(circle at 12% 0%, rgba(127, 159, 187, 0.22), transparent 28%),
                linear-gradient(180deg, #f8fafc, #eef2f7);
            }
            .cms-preview-frame {
              max-width: 880px;
              margin: 0 auto;
            }
            .cms-preview-card {
              border: 1px solid rgba(148, 163, 184, 0.26);
              border-radius: 28px;
              padding: 26px;
              margin: 18px 0;
              background: rgba(255, 255, 255, 0.82);
              box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
              backdrop-filter: blur(18px);
            }
            .cms-preview-title {
              margin: 18px 0 0;
              font-family: Georgia, serif;
              font-size: clamp(34px, 7vw, 58px);
              line-height: 1.02;
              letter-spacing: -0.055em;
              color: #09090b;
            }
            .cms-preview-description {
              max-width: 680px;
              color: #475569;
              font-size: 18px;
              line-height: 1.85;
            }
            .cms-preview-meta {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              margin-top: 20px;
            }
            .cms-preview-pill {
              display: inline-flex;
              width: fit-content;
              align-items: center;
              border: 1px solid rgba(148, 163, 184, 0.28);
              border-radius: 999px;
              background: #eef2f7;
              padding: 5px 11px;
              color: #475569;
              font: 600 12px/1.2 ui-monospace, SFMono-Regular, monospace;
              letter-spacing: 0.04em;
            }
            .cms-preview-checklist {
              display: grid;
              gap: 10px;
              padding: 0;
              list-style: none;
            }
            .cms-preview-checklist li {
              border-radius: 16px;
              padding: 11px 13px;
              background: rgba(248, 250, 252, 0.82);
            }
            .cms-preview-warning { color: #b45309; }
            .cms-preview-ok { color: #047857; }
            .cms-preview-image {
              width: 100%;
              max-height: 360px;
              object-fit: cover;
              border-radius: 24px;
              margin-top: 22px;
              border: 1px solid rgba(148, 163, 184, 0.22);
            }
            .cms-preview-attachment {
              display: grid;
              gap: 5px;
              border: 1px solid rgba(148, 163, 184, 0.24);
              border-radius: 18px;
              padding: 14px;
              margin-top: 10px;
              background: rgba(248, 250, 252, 0.78);
            }
            .cms-preview-body :where(p, li) { color: #3f3f46; }
            .cms-preview-body :where(pre, code) {
              border-radius: 16px;
              background: #0f172a;
              color: #e2e8f0;
            }
          `),
          h('div', { className: 'cms-preview-frame' },
            h('section', { className: 'cms-preview-card' },
              h('p', { className: 'cms-preview-pill' }, draft ? '草稿状态：未发布' : '发布状态：公开'),
              h('h1', { className: 'cms-preview-title' }, title),
              h('p', { className: 'cms-preview-description' }, description || '还没有填写描述。'),
              h('div', { className: 'cms-preview-meta' }, tags.map((tag) => h('span', { className: 'cms-preview-pill', key: tag }, tag))),
              heroImage ? h('img', { className: 'cms-preview-image', src: heroImage, alt: title }) : null
            ),
            h('section', { className: 'cms-preview-card' },
              h('h2', {}, '发布前检查'),
              h('ul', { className: 'cms-preview-checklist' },
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
            h('section', { className: 'cms-preview-card cms-preview-body' }, widgetFor('body'))
          )
        );
      });
    } catch (error) {
      console.warn('[cms-extensions] preview template skipped:', error);
    }
  }
})();
