import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadContent, normalize, searchContent, splitMessage } from '../src/content.js';
import { DIRECT_NAMES, publicizeText } from '../src/publicize.js';
import { mainMenu, topicsMenu } from '../src/ui.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const contentPath = path.resolve(here, '..', 'content', 'content.json');

test('generated content has the complete recovered index', () => {
  assert.ok(fs.existsSync(contentPath), 'run npm run build:content first');
  const content = loadContent(contentPath);
  assert.equal(content.topicCount, 99);
  assert.equal(content.postCount, 170);
  assert.equal(content.topics[0].title, 'Аденоиды');
});

test('search is case-insensitive and treats ё as е', () => {
  const content = loadContent(contentPath);
  const results = searchContent(content, 'АДЕНОИДЫ ребёнок');
  assert.ok(results.length > 0);
  assert.equal(results[0].topicTitle, 'Аденоиды');
  assert.equal(normalize('Всё Ёлка'), 'все елка');
});

test('long messages are split below the Telegram limit', () => {
  const chunks = splitMessage('слово '.repeat(2000));
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 3900));
});

test('keyboards keep callback payloads within Telegram limit', () => {
  const content = loadContent(contentPath);
  const keyboards = [mainMenu(), topicsMenu(content, 0)];
  for (const keyboard of keyboards) {
    for (const row of keyboard.inline_keyboard) {
      for (const button of row) {
        if (button.callback_data) {
          assert.ok(Buffer.byteLength(button.callback_data, 'utf8') <= 64);
        }
      }
    }
  }
});

test('public text removes direct chat addressees and dead private links', () => {
  const result = publicizeText(
    'Ирин, добрый вечер!\nЕсли у вас болит ухо, посмотрите здесь https://t.me/c/1593559029/123',
    'Ухо'
  );
  assert.doesNotMatch(result, /Ирин|добрый вечер|t\.me\/c\/1593559029/iu);
  assert.match(result, /Если в такой ситуации болит ухо/iu);
});

test('all generated posts are free of known direct-name openings', () => {
  const content = loadContent(contentPath);
  const openingNames = new RegExp(`^(?:${DIRECT_NAMES.join('|')})[\\s,!]`, 'iu');
  const directReaderAddress =
    /(?<!\p{L})(?:вы|вам|вас|ваш(?:а|и|его|ему|ей)?)(?!\p{L})/giu;
  for (const topic of content.topics) {
    for (const post of topic.posts) {
      assert.doesNotMatch(post.text, openingNames);
      assert.doesNotMatch(post.text, directReaderAddress);
      assert.doesNotMatch(post.text, /https:\/\/t\.me\/c\/1593559029\//iu);
    }
  }
});
