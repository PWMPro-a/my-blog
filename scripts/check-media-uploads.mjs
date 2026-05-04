import { readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const roots = [
  {
    dir: join(process.cwd(), 'public', 'images', 'uploads'),
    label: 'public/images/uploads',
    allowed: new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']),
    message: '图片上传目录只允许常见图片文件；视频请放到外部平台，附件请放到 public/attachments/uploads。'
  },
  {
    dir: join(process.cwd(), 'public', 'attachments', 'uploads'),
    label: 'public/attachments/uploads',
    allowed: new Set(['.doc', '.docx', '.pdf']),
    message: '附件上传目录只允许 PDF、DOC、DOCX；图片请放到 public/images/uploads，视频和压缩包不要上传到仓库。'
  }
];

async function collectInvalidFiles(root, dir = root.dir) {
  let entries = [];

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }

  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collectInvalidFiles(root, path);
    if (!entry.isFile()) return [];

    const extension = extname(entry.name).toLowerCase();
    return root.allowed.has(extension) ? [] : [path];
  }));

  return files.flat();
}

let hasErrors = false;

for (const root of roots) {
  const invalidFiles = await collectInvalidFiles(root);
  if (!invalidFiles.length) continue;

  hasErrors = true;
  console.error(root.message);
  for (const file of invalidFiles) {
    console.error(`- ${relative(process.cwd(), file).replaceAll('\\', '/')}`);
  }
}

if (hasErrors) process.exit(1);
