import { readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const uploadDir = join(process.cwd(), 'public', 'images', 'uploads');
const blockedExtensions = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v', '.wmv', '.flv']);

async function collectBlockedFiles(dir) {
  let entries = [];

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }

  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collectBlockedFiles(path);
    if (entry.isFile() && blockedExtensions.has(extname(entry.name).toLowerCase())) return [path];
    return [];
  }));

  return files.flat();
}

const blockedFiles = await collectBlockedFiles(uploadDir);

if (blockedFiles.length) {
  console.error('Video files should not be uploaded to public/images/uploads. Host videos externally and paste the link in content instead.');
  for (const file of blockedFiles) {
    console.error(`- ${relative(process.cwd(), file).replaceAll('\\\\', '/')}`);
  }
  process.exit(1);
}
