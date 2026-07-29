FROM node:20-alpine

# ВАЖНО: рабочий каталог вне /app. На Bothost каталог /app при старте контейнера
# монтируется с хоста (bind mount) и скрывает всё, что образ туда положил, —
# в том числе node_modules. Отсюда MODULE_NOT_FOUND при успешной сборке.
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

CMD ["node", "index.js"]
