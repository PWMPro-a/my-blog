import { access, readFile, readdir } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, resolve } from 'node:path';
import matter from 'gray-matter';

const rootDir = process.cwd();
const blogDir = join(rootDir, 'src', 'content', 'blog');
const topicDir = join(rootDir, 'src', 'content', 'topics');
const publicDir = join(rootDir, 'public');

const allowedImageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
const allowedAttachmentExtensions = new Set(['.doc', '.docx', '.pdf']);
const blockedUploadExtensions = new Set(['.7z', '.avi', '.bat', '.cmd', '.exe', '.flv', '.m4v', '.mkv', '.mov', '.mp4', '.msi', '.rar', '.webm', '.wmv', '.zip']);
const videoExtensions = new Set(['.avi', '.flv', '.m4v', '.mkv', '.mov', '.mp4', '.webm', '.wmv']);
const supportedVideoHostPattern = /(?:bilibili\.com|b23\.tv|youtube\.com|youtu\.be|cloudflarestream\.com|videodelivery\.net|\.r2\.dev)/i;
const markdownImagePattern = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const markdownLinkPattern = /(?<!!)\[[^\]]*\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
const placeholderPattern = /\b(?:TODO|lorem ipsum|待补充|占位|测试文章)\b/i;

const errors = [];
const warnings = [];

function toPosix(path) {
  return path.replaceAll('\\', '/');
}

function relativePath(path) {
  return toPosix(path.replace(rootDir, '')).replace(/^\//, '');
}

function addError(file, message) {
  errors.push(`${relativePath(file)}: ${message}`);
}

function addWarning(file, message) {
  warnings.push(`${relativePath(file)}: ${message}`);
}

function charLength(value) {
  return Array.from(String(value || '')).length;
}

function isExternalUrl(value) {
  return /^https?:\/\//i.test(value);
}

function isIgnoredReference(value) {
  return /^(?:#|data:|mailto:|tel:)/i.test(value);
}

function stripHashAndQuery(value) {
  return value.split('#')[0].split('?')[0];
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function publicPathToFile(path) {
  const cleaned = stripHashAndQuery(path);
  if (!cleaned.startsWith('/')) return undefined;
  return resolve(publicDir, cleaned.replace(/^\/+/, ''));
}

async function collectMarkdownFiles(dir) {
  let entries = [];

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }

  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collectMarkdownFiles(path);
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
  }));

  return files.flat();
}

async function collectUploadFiles(dir) {
  let entries = [];

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }

  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collectUploadFiles(path);
    return entry.isFile() ? [path] : [];
  }));

  return files.flat();
}

async function assertLocalPublicFile(file, sourcePath, fieldName, allowedExtensions) {
  if (!sourcePath || typeof sourcePath !== 'string') {
    addError(file, `${fieldName} 不能为空。`);
    return;
  }

  if (isIgnoredReference(sourcePath)) return;

  if (isExternalUrl(sourcePath)) {
    if (!sourcePath.startsWith('https://')) addWarning(file, `${fieldName} 使用了 http:// 外链，建议改为 HTTPS。`);
    return;
  }

  const cleaned = stripHashAndQuery(sourcePath);
  const extension = extname(cleaned).toLowerCase();

  if (allowedExtensions && !allowedExtensions.has(extension)) {
    addError(file, `${fieldName} 的文件类型不允许：${sourcePath}`);
  }

  let targetPath;
  if (cleaned.startsWith('/')) {
    targetPath = publicPathToFile(cleaned);
  } else if (isAbsolute(cleaned)) {
    targetPath = cleaned;
  } else {
    targetPath = resolve(file, '..', cleaned);
  }

  if (!targetPath || !(await exists(targetPath))) {
    addError(file, `${fieldName} 指向的本地文件不存在：${sourcePath}`);
  }
}

function parseDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function validateTags(file, tags) {
  if (!Array.isArray(tags)) {
    addError(file, 'tags 必须是数组。');
    return;
  }

  const seen = new Set();
  for (const tag of tags) {
    const normalized = String(tag || '').trim().toLowerCase();
    if (!normalized) addError(file, 'tags 不能包含空标签。');
    if (seen.has(normalized)) addError(file, `tags 包含重复标签：${tag}`);
    seen.add(normalized);
  }
}

async function validateAttachments(file, attachments) {
  if (attachments === undefined) return;
  if (!Array.isArray(attachments)) {
    addError(file, 'attachments 必须是数组。');
    return;
  }

  for (const [index, attachment] of attachments.entries()) {
    const prefix = `attachments[${index}]`;
    if (!attachment || typeof attachment !== 'object') {
      addError(file, `${prefix} 必须是对象。`);
      continue;
    }

    if (!attachment.title) addError(file, `${prefix}.title 不能为空。`);
    if (!attachment.file) {
      addError(file, `${prefix}.file 不能为空。`);
      continue;
    }

    const filePath = String(attachment.file);
    const extension = extname(stripHashAndQuery(filePath)).toLowerCase();
    if (filePath.startsWith('/images/uploads/')) addError(file, `${prefix}.file 放在了图片目录，应改到 /attachments/uploads/。`);
    if (!filePath.startsWith('/attachments/uploads/')) addError(file, `${prefix}.file 应使用 /attachments/uploads/ 下的文件。`);
    if (!allowedAttachmentExtensions.has(extension)) addError(file, `${prefix}.file 只允许 PDF、DOC、DOCX。`);
    await assertLocalPublicFile(file, filePath, `${prefix}.file`, allowedAttachmentExtensions);

    if (attachment.type && !['pdf', 'docx', 'doc', 'other'].includes(attachment.type)) {
      addError(file, `${prefix}.type 只能是 pdf、docx、doc、other。`);
    }

    if (attachment.type && attachment.type !== 'other' && extension && extension !== `.${attachment.type}`) {
      addWarning(file, `${prefix}.type 与文件扩展名不一致。`);
    }
  }
}

function validateMarkdownLinks(file, body) {
  for (const match of body.matchAll(markdownImagePattern)) {
    const imagePath = match[1];
    if (!isExternalUrl(imagePath)) continue;
    if (!imagePath.startsWith('https://')) addWarning(file, `正文图片使用了 http:// 外链：${imagePath}`);
  }

  for (const match of body.matchAll(markdownLinkPattern)) {
    const url = match[1];
    if (url.startsWith('http://')) addWarning(file, `正文链接使用了 http:// 外链：${url}`);
  }
}

async function validateMarkdownImages(file, body) {
  for (const match of body.matchAll(markdownImagePattern)) {
    const imagePath = match[1];
    if (isExternalUrl(imagePath) || isIgnoredReference(imagePath)) continue;
    await assertLocalPublicFile(file, imagePath, '正文图片', allowedImageExtensions);
  }
}

function validateVideoReferences(file, body) {
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const plainUrl = line.match(/^https?:\/\/\S+$/)?.[0];
    if (plainUrl && (supportedVideoHostPattern.test(plainUrl) || videoExtensions.has(extname(stripHashAndQuery(plainUrl)).toLowerCase()))) {
      if (!plainUrl.startsWith('https://')) addError(file, `视频链接必须使用 HTTPS：${plainUrl}`);
    }

    const localVideo = line.match(/(?:^|\s)(\/?[\w./-]+\.(?:mp4|mov|webm|mkv|avi|m4v|wmv|flv))(?:\s|$)/i)?.[1];
    if (localVideo) addError(file, `不要在正文引用本地视频文件：${localVideo}`);
  }
}

async function readMarkdownEntry(file) {
  const source = await readFile(file, 'utf8');
  const parsed = matter(source);
  return {
    file,
    slug: basename(file, '.md'),
    data: parsed.data,
    content: parsed.content
  };
}

async function collectBlogEntries(files) {
  const entries = new Map();

  for (const file of files) {
    const entry = await readMarkdownEntry(file);
    if (entries.has(entry.slug)) addError(file, `文章 slug 重复：${entry.slug}`);
    entries.set(entry.slug, entry);
  }

  return entries;
}

async function validateBlogPost(entry) {
  const { file, data, content } = entry;
  const isDraft = data.draft === true;

  for (const field of ['title', 'description', 'pubDate', 'draft']) {
    if (data[field] === undefined || data[field] === null || data[field] === '') addError(file, `缺少必填字段 ${field}。`);
  }

  if (data.draft !== undefined && typeof data.draft !== 'boolean') addError(file, 'draft 必须是 boolean。');
  validateTags(file, data.tags);

  const titleLength = charLength(data.title);
  const descriptionLength = charLength(data.description);
  if (titleLength && (titleLength < 12 || titleLength > 80)) addWarning(file, `标题长度为 ${titleLength} 字，建议保持在 12-80 字之间。`);
  if (descriptionLength && (descriptionLength < 40 || descriptionLength > 180)) addWarning(file, `描述长度为 ${descriptionLength} 字，建议保持在 40-180 字之间。`);
  if (String(data.title || '').trim() === String(data.description || '').trim()) addWarning(file, '描述不应与标题完全相同。');

  const pubDate = parseDate(data.pubDate);
  if (!pubDate) addError(file, 'pubDate 不是有效日期。');
  if (pubDate && pubDate > new Date()) addWarning(file, 'pubDate 是未来日期。');

  if (!isDraft && !data.heroImage) addWarning(file, '已发布文章没有头图，将使用默认分享图。');
  if (data.draft === true && data.featured === true) addWarning(file, '草稿文章不建议设为 featured。');
  if (placeholderPattern.test(content)) addWarning(file, '正文包含 TODO、占位词或测试内容。');

  if (data.heroImage) await assertLocalPublicFile(file, data.heroImage, 'heroImage', allowedImageExtensions);
  await validateAttachments(file, data.attachments);
  await validateMarkdownImages(file, content);
  validateMarkdownLinks(file, content);
  validateVideoReferences(file, content);
}

function validateTopicPostReferences(file, posts, blogEntries) {
  if (posts === undefined) return;
  if (!Array.isArray(posts)) {
    addError(file, 'posts 必须是数组。');
    return;
  }

  const seen = new Set();
  for (const [index, postSlug] of posts.entries()) {
    if (typeof postSlug !== 'string' || !postSlug.trim()) {
      addError(file, `posts[${index}] 必须是非空文章 slug。`);
      continue;
    }

    const normalized = postSlug.trim();
    if (seen.has(normalized)) addError(file, `posts 包含重复文章引用：${normalized}`);
    seen.add(normalized);

    const referencedPost = blogEntries.get(normalized);
    if (!referencedPost) {
      addError(file, `posts 引用了不存在的文章：${normalized}`);
      continue;
    }

    if (referencedPost.data.draft === true) addWarning(file, `posts 引用了草稿文章：${normalized}`);
  }
}

async function validateTopic(file, blogEntries) {
  const source = await readFile(file, 'utf8');
  const { data, content } = matter(source);

  for (const field of ['title', 'description', 'draft']) {
    if (data[field] === undefined || data[field] === null || data[field] === '') addError(file, `缺少必填字段 ${field}。`);
  }

  if (data.draft !== undefined && typeof data.draft !== 'boolean') addError(file, 'draft 必须是 boolean。');
  validateTopicPostReferences(file, data.posts, blogEntries);
  if (data.coverImage) await assertLocalPublicFile(file, data.coverImage, 'coverImage', allowedImageExtensions);
  await validateMarkdownImages(file, content);
  validateMarkdownLinks(file, content);
  validateVideoReferences(file, content);
}

async function validateUploadDirectory(dir, allowedExtensions, label) {
  const files = await collectUploadFiles(dir);
  for (const file of files) {
    const extension = extname(file).toLowerCase();
    if (blockedUploadExtensions.has(extension)) addError(file, `${label} 中包含不应上传到仓库的文件类型。`);
    if (!allowedExtensions.has(extension)) addError(file, `${label} 中的文件类型不符合目录用途。`);
  }
}

const blogFiles = await collectMarkdownFiles(blogDir);
const blogEntries = await collectBlogEntries(blogFiles);

for (const entry of blogEntries.values()) {
  await validateBlogPost(entry);
}

for (const file of await collectMarkdownFiles(topicDir)) {
  await validateTopic(file, blogEntries);
}

await validateUploadDirectory(join(publicDir, 'images', 'uploads'), allowedImageExtensions, '图片上传目录');
await validateUploadDirectory(join(publicDir, 'attachments', 'uploads'), allowedAttachmentExtensions, '附件上传目录');

if (warnings.length) {
  console.warn('内容检查警告：');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error('内容检查失败：');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('内容检查通过。');
