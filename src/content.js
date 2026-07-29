import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// Каталог называется content, а не data: агент Bothost умеет вырезать из
// репозитория любые папки с именем data, вместе с исходниками внутри.
const defaultContentPath = path.resolve(here, '..', 'content', 'content.json');

export function normalize(value = '') {
  return value
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function loadContent(contentPath = defaultContentPath) {
  if (!fs.existsSync(contentPath)) {
    throw new Error(
      `Нет базы ${contentPath}. Сначала выполните: npm run build:content`
    );
  }
  const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  if (!Array.isArray(content.topics) || !content.topics.length) {
    throw new Error('База указателя пуста или повреждена.');
  }
  return content;
}

export function searchContent(content, query, limit = 10) {
  const normalizedQuery = normalize(query);
  const tokens = normalizedQuery.split(' ').filter((token) => token.length >= 2);
  if (!tokens.length) return [];

  const results = [];
  for (const topic of content.topics) {
    const normalizedTitle = normalize(topic.title);
    for (let postIndex = 0; postIndex < topic.posts.length; postIndex += 1) {
      const post = topic.posts[postIndex];
      const haystack = `${normalizedTitle} ${normalize(post.text)}`;
      if (!tokens.every((token) => haystack.includes(token))) continue;

      const titleHits = tokens.filter((token) => normalizedTitle.includes(token)).length;
      const exactTitle = normalizedTitle === normalizedQuery ? 10 : 0;
      results.push({
        topicId: topic.id,
        postIndex,
        topicTitle: topic.title,
        date: post.date,
        preview: post.text.replace(/\s+/g, ' ').slice(0, 110),
        score: exactTitle + titleHits * 3 + tokens.length,
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.topicTitle.localeCompare(b.topicTitle, 'ru'))
    .slice(0, limit);
}

export function splitMessage(text, maxLength = 3900) {
  if (text.length <= maxLength) return [text];
  const chunks = [];
  let rest = text;

  while (rest.length > maxLength) {
    let splitAt = rest.lastIndexOf('\n\n', maxLength);
    if (splitAt < maxLength * 0.55) splitAt = rest.lastIndexOf('\n', maxLength);
    if (splitAt < maxLength * 0.55) splitAt = rest.lastIndexOf(' ', maxLength);
    if (splitAt < 1) splitAt = maxLength;
    chunks.push(rest.slice(0, splitAt).trim());
    rest = rest.slice(splitAt).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
