import process from 'node:process';
import dotenv from 'dotenv';
import { Bot } from 'grammy';
import { loadContent, searchContent, splitMessage } from './src/content.js';
import {
  mainMenu,
  postMenu,
  searchResultsMenu,
  topicsMenu,
} from './src/ui.js';

// Bothost добавляет свои переменные окружения. Для этой публичной deploy-сборки
// намеренно используем значения из загруженного вместе с проектом файла .env.
dotenv.config({ override: true });

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('Критическая ошибка: BOT_TOKEN отсутствует в файле .env.');
  process.exit(1);
}

const content = loadContent();
const bot = new Bot(token);
const awaitingSearch = new Set();

const WELCOME =
  `Добро пожаловать в справочник «Бережное Врачевание» 🌿\n\n` +
  `В базе: ${content.topicCount} тем и ${content.postCount} восстановленных публикаций. ` +
  `Выберите тему или найдите нужное по словам.\n\n` +
  `Важно: материалы сохранены из архива и носят информационный характер. ` +
  `Они не заменяют диагностику и консультацию врача.`;

async function editOrReply(ctx, text, keyboard) {
  const options = {
    reply_markup: keyboard,
    link_preview_options: { is_disabled: true },
  };
  if (ctx.callbackQuery?.message?.text) {
    try {
      await ctx.editMessageText(text, options);
      return;
    } catch (error) {
      if (!String(error?.description || error?.message).includes('message is not modified')) {
        throw error;
      }
      return;
    }
  }
  await ctx.reply(text, options);
}

async function showHome(ctx) {
  awaitingSearch.delete(ctx.from.id);
  await editOrReply(ctx, WELCOME, mainMenu());
}

bot.command('start', showHome);
bot.command('menu', showHome);
bot.command('help', async (ctx) => {
  await ctx.reply(
    `Как пользоваться:\n\n` +
      `• «Темы» — алфавитный каталог;\n` +
      `• «Симптомы» — тот же каталог состояний и вопросов;\n` +
      `• «Поиск» — поиск сразу по названиям и текстам публикаций;\n` +
      `• /menu — вернуться в главное меню.\n\n` +
      `Если состояние острое или вызывает тревогу, обратитесь за медицинской помощью.`,
    { reply_markup: mainMenu() }
  );
});

bot.callbackQuery('home', async (ctx) => {
  await ctx.answerCallbackQuery();
  await showHome(ctx);
});

bot.callbackQuery('noop', (ctx) => ctx.answerCallbackQuery());

bot.callbackQuery(/^topics:(\d+)$/, async (ctx) => {
  const page = Number(ctx.match[1]);
  await ctx.answerCallbackQuery();
  await editOrReply(
    ctx,
    `Темы по алфавиту\n\nВыберите раздел. Число рядом — количество восстановленных публикаций.`,
    topicsMenu(content, page)
  );
});

bot.callbackQuery(/^topic:(\d+)$/, async (ctx) => {
  const topic = content.topics[Number(ctx.match[1])];
  if (!topic) return ctx.answerCallbackQuery({ text: 'Тема не найдена.' });
  await ctx.answerCallbackQuery();
  await showPost(ctx, topic, 0);
});

async function showPost(ctx, topic, postIndex) {
  const post = topic?.posts?.[postIndex];
  if (!post) return false;

  const mediaNote = post.hasMissingMedia
    ? '\n\n⚠️ В исходном архиве у этой публикации было медиа, но сам файл не сохранился.'
    : '';
  const position = topic.posts.length > 1
    ? `\nМатериал ${postIndex + 1} из ${topic.posts.length}`
    : '';
  const text = `${topic.title}${position}\n\n${post.text}${mediaNote}`;
  const chunks = splitMessage(text);

  if (chunks.length === 1) {
    await editOrReply(ctx, chunks[0], postMenu(topic, postIndex));
    return true;
  }

  await editOrReply(ctx, chunks[0], undefined);
  for (let index = 1; index < chunks.length; index += 1) {
    await ctx.reply(chunks[index], {
      reply_markup: index === chunks.length - 1 ? postMenu(topic, postIndex) : undefined,
      link_preview_options: { is_disabled: true },
    });
  }
  return true;
}

bot.callbackQuery(/^post:(\d+):(\d+)$/, async (ctx) => {
  const topic = content.topics[Number(ctx.match[1])];
  const postIndex = Number(ctx.match[2]);
  const post = topic?.posts?.[postIndex];
  if (!post) return ctx.answerCallbackQuery({ text: 'Публикация не найдена.' });
  await ctx.answerCallbackQuery();
  await showPost(ctx, topic, postIndex);
});

bot.callbackQuery('search', async (ctx) => {
  awaitingSearch.add(ctx.from.id);
  await ctx.answerCallbackQuery();
  await editOrReply(
    ctx,
    `Поиск по справочнику\n\nНапишите одним сообщением симптом, состояние или несколько ключевых слов. Например: «насморк ребёнок».`,
    mainMenu()
  );
});

bot.callbackQuery('consultant', async (ctx) => {
  const url = process.env.CONSULTANT_URL;
  if (!url) {
    await ctx.answerCallbackQuery({
      text: 'Контакт консультанта пока не настроен.',
      show_alert: true,
    });
    return;
  }
  await ctx.answerCallbackQuery();
  await ctx.reply(`Связаться с консультантом:\n${url}`, {
    link_preview_options: { is_disabled: true },
    reply_markup: mainMenu(),
  });
});

bot.callbackQuery('share', async (ctx) => {
  const username = (process.env.BOT_USERNAME || '').replace(/^@/, '');
  await ctx.answerCallbackQuery();
  if (!username) {
    await ctx.reply('Ссылка для приглашения появится после настройки BOT_USERNAME.', {
      reply_markup: mainMenu(),
    });
    return;
  }
  const botUrl = `https://t.me/${username}`;
  const shareUrl =
    `https://t.me/share/url?url=${encodeURIComponent(botUrl)}` +
    `&text=${encodeURIComponent('Тематический справочник «Бережное Врачевание»')}`;
  await ctx.reply(`Поделиться справочником:\n${shareUrl}`, {
    link_preview_options: { is_disabled: true },
    reply_markup: mainMenu(),
  });
});

bot.callbackQuery('help', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    `Выберите «Темы» для просмотра каталога или «Поиск», чтобы найти публикации по словам.\n\n` +
      `Команда /menu в любой момент возвращает главное меню.`,
    { reply_markup: mainMenu() }
  );
});

bot.on('message:text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  const query = ctx.message.text.trim();
  if (!awaitingSearch.has(ctx.from.id)) {
    await ctx.reply('Для поиска нажмите «🔎 Поиск» или откройте /menu.', {
      reply_markup: mainMenu(),
    });
    return;
  }

  const results = searchContent(content, query);
  if (!results.length) {
    await ctx.reply(
      `По запросу «${query.slice(0, 80)}» ничего не найдено. Попробуйте более короткую формулировку.`,
      { reply_markup: mainMenu() }
    );
    return;
  }

  const summary = results
    .map((result, index) => `${index + 1}. ${result.topicTitle}\n${result.preview}`)
    .join('\n\n');
  await ctx.reply(`Результаты поиска «${query.slice(0, 80)}»:\n\n${summary}`, {
    reply_markup: searchResultsMenu(results),
    link_preview_options: { is_disabled: true },
  });
});

bot.catch((error) => {
  console.error('Ошибка бота:', error.error?.message || error.message);
});

try {
  await bot.start({
    allowed_updates: ['message', 'callback_query'],
    onStart: ({ username }) => {
      console.log(`✓ @${username} запущен: ${content.topicCount} тем, ${content.postCount} постов`);
    },
  });
} catch (error) {
  console.error('Критическая ошибка запуска Telegram-бота:', error?.message || error);
  process.exit(1);
}
