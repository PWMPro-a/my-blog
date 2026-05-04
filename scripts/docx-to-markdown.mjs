import { access, readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import mammoth from 'mammoth';

const input = process.argv[2];

if (!input) {
  console.error('用法：npm run docx:markdown -- <file.docx>');
  process.exit(1);
}

const filePath = resolve(process.cwd(), input);

try {
  await access(filePath);
} catch {
  console.error(`文件不存在：${filePath}`);
  process.exit(1);
}

if (extname(filePath).toLowerCase() !== '.docx') {
  console.error('只支持 .docx 文件；PDF 建议作为附件上传，不做自动正文解析。');
  process.exit(1);
}

const buffer = await readFile(filePath);
const result = await mammoth.convertToMarkdown({ buffer });
const markdown = result.value.trim();

if (result.messages.length) {
  console.error('转换提示：');
  for (const message of result.messages) console.error(`- ${message.message}`);
  console.error('');
}

process.stdout.write(markdown ? `${markdown}\n` : '');
