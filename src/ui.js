import { InlineKeyboard } from 'grammy';

export const TOPICS_PER_PAGE = 8;

export function mainMenu() {
  return new InlineKeyboard()
    .text('📚 Темы', 'topics:0')
    .text('🩺 Симптомы', 'topics:0')
    .row()
    .text('🔎 Поиск', 'search')
    .text('👩‍⚕️ Консультант', 'consultant')
    .row()
    .text('↗️ Поделиться', 'share')
    .text('ℹ️ Помощь', 'help');
}

export function topicsMenu(content, page = 0) {
  const maxPage = Math.max(0, Math.ceil(content.topics.length / TOPICS_PER_PAGE) - 1);
  const safePage = Math.min(Math.max(0, page), maxPage);
  const start = safePage * TOPICS_PER_PAGE;
  const keyboard = new InlineKeyboard();

  for (const topic of content.topics.slice(start, start + TOPICS_PER_PAGE)) {
    keyboard.text(`${topic.title} · ${topic.posts.length}`, `topic:${topic.id}`).row();
  }

  if (safePage > 0) keyboard.text('←', `topics:${safePage - 1}`);
  keyboard.text(`${safePage + 1}/${maxPage + 1}`, 'noop');
  if (safePage < maxPage) keyboard.text('→', `topics:${safePage + 1}`);
  return keyboard.row().text('⌂ Главное меню', 'home');
}

export function postMenu(topic, postIndex) {
  const keyboard = new InlineKeyboard();
  if (postIndex > 0) {
    keyboard.text('← Предыдущий материал', `post:${topic.id}:${postIndex - 1}`);
  }
  if (postIndex < topic.posts.length - 1) {
    keyboard.text('Следующий материал →', `post:${topic.id}:${postIndex + 1}`);
  }
  return keyboard
    .row()
    .text('← Все темы', `topics:${Math.floor(topic.id / TOPICS_PER_PAGE)}`)
    .text('⌂ Меню', 'home');
}

export function searchResultsMenu(results) {
  const keyboard = new InlineKeyboard();
  for (const result of results) {
    keyboard
      .text(result.topicTitle, `post:${result.topicId}:${result.postIndex}`)
      .row();
  }
  return keyboard.text('🔎 Новый поиск', 'search').text('⌂ Меню', 'home');
}
