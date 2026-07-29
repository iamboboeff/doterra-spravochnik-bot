import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { publicizeText } from '../src/publicize.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const sourcePath = path.resolve(
  process.argv[2] ||
  process.env.SOURCE_INDEX ||
  '/Users/iboboeff/Downloads/Указатель_для_Telegram.txt'
);
const outputPath = path.resolve(
  process.argv[3] ||
  path.join(projectRoot, 'data', 'content.json')
);

function parseIndex(source) {
  const topics = [];
  const themePattern = /^={20,}\nТЕМА: (.+?)\n={20,}\n([\s\S]*?)(?=^={20,}\nТЕМА: |(?![\s\S]))/gm;
  let themeMatch;

  while ((themeMatch = themePattern.exec(source)) !== null) {
    const title = themeMatch[1].trim();
    const section = themeMatch[2].trim();
    const posts = [];
    const postPattern = /^--- пост (\d+) \((.+?)\) ---\n([\s\S]*?)(?=^--- пост \d+ \(|(?![\s\S]))/gm;
    let postMatch;

    while ((postMatch = postPattern.exec(section)) !== null) {
      const rawText = postMatch[3].trim();
      const mediaMarker = '[⚠️ было изображение/файл — прикрепите свой вариант при перепосте]';
      posts.push({
        number: Number(postMatch[1]),
        date: postMatch[2].trim(),
        text: publicizeText(rawText.replace(mediaMarker, '').trim(), title),
        hasMissingMedia: rawText.includes(mediaMarker),
      });
    }

    if (posts.length) {
      topics.push({
        id: topics.length,
        title,
        posts,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: path.basename(sourcePath),
    topicCount: topics.length,
    postCount: topics.reduce((sum, topic) => sum + topic.posts.length, 0),
    topics,
  };
}

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Файл указателя не найден: ${sourcePath}`);
}

const content = parseIndex(fs.readFileSync(sourcePath, 'utf8'));
if (!content.topicCount || !content.postCount) {
  throw new Error('Не удалось распознать темы и посты в указателе.');
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(content, null, 2)}\n`);
console.log(`Готово: ${content.topicCount} тем, ${content.postCount} постов → ${outputPath}`);

export { parseIndex };
