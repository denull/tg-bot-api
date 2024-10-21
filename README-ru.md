# tg-bot-api

[English](README.md) | **Russian**

Лаконичная библиотека для [Telegram Bot API](https://core.telegram.org/bots/api). В отличие от большинства других библиотек, эта реализация не перегружена лишними деталями и решает только одну задачу: удобное выполнение запросов к API. У библиотеки нет внешних зависимостей, она состоит из 1 файла длиной менее 100 строк и не требует обновлений при появлении новых методов.

Это **не** фреймворк. Библиотека не предлагает способов обработки входящих событий: это тривиально решается любым веб-фреймворком (например, [Express](https://expressjs.com/)). Для вызова методов вам не нужно сверяться с документацией библиотеки: вы всегда передаёте объект с теми полями, которые указаны в официальной документации самого [Telegram Bot API](https://core.telegram.org/bots/api).

## Установка

```
npm install tg-bot-api
```

## TelegramBotAPI

Библиотека экспортирует класс `TelegramBotAPI`. Для работы с API создайте его экземпляр, передав токен вашего бота:

```js
const TelegramBotAPI = require('tg-bot-api');

// Замените HERE_GOES_YOUR_TOKEN на токен, полученный от @BotFather
const bot = new TelegramBotAPI('HERE_GOES_YOUR_TOKEN');
```

Если вам нужно проксировать запросы, вы можете поменять эндпоинт, передав его в конструктор вторым параметром:
```js
const bot = new TelegramBotAPI('HERE_GOES_YOUR_TOKEN', 'https://bots.mn/bot{token}/{method}');
```

Используйте шаблоны `{token}` и `{method}` внутри URL для подстановки в него токена и имени вызываемого метода. По умолчанию используется эндпоинт `https://api.telegram.org/bot{token}/{method}`.

## Выполнение запросов к API

Для обращения к методам API просто вызывайте их на созданном экземпляре `TelegramBotAPI`. Все параметры указываются в виде полей объекта, переданного первым аргументом. Методы возвращают `Promise`, который либо резолвится содержимым поля `result` из ответа API (если вызов завершился успешно), либо выбрасывают возвращённую от API ошибку (с полями `error_code` и `description`). Список методов, их параметров и кодов ошибок смотрите в [официальной документации](https://core.telegram.org/bots/api).

```js
const TelegramBotAPI = require('tg-bot-api');
const bot = new TelegramBotAPI('HERE_GOES_YOUR_TOKEN');

(async () => {
  try {
    console.log(await bot.sendMessage({
      chat_id: 888352,
      text: 'Thanks for the library!',
    }));
  } catch (error) {
    console.error('Oh no', error);
  }
})();
```

Единственная ошибка, которая обрабатывается самой библиотекой автоматически, это флуд-контроль. Если в ответе сервера присутствует поле `retry_after`, метод не выбросит ошибку, а автоматически повторит запрос спустя указанное время. Чтобы отключить это поведение, передайте `false` вторым аргументом в вызываемый метод.

Обратите внимание: в библиотеке нет «вшитого» списка методов; вы можете попытаться вызвать в том числе несуществующие методы API (которые вероятно вернут соответствующую ошибку).

## Отправка файлов

Основной нюанс, который возникает при работе с Telegram Bot API, это особенности отправки файлов. Библиотека автоматически переключается с формата `application/json` на `multipart/form-data`, если одно из переданных полей имеет тип `Blob`, `File`, `Stream`, `Buffer`, `ArrayBuffer`, `TypedArray` или `DataView`:

```js
const fs = require('fs');
const TelegramBotAPI = require('tg-bot-api');
const bot = new TelegramBotAPI('HERE_GOES_YOUR_TOKEN');

(async () => {
  const stream = fs.createReadStream('./image1.jpg');
  const message = await bot.sendPhoto({
    chat_id: 888352,
    photo: stream,
  });

  const buffer = fs.readFileSync('./image2.jpg');
  bot.editMessageMedia({
    chat_id: 888352,
    message_id: message.message_id,
    media: {
      type: 'photo',

      // Здесь, в соответствии с документацией метода, `image` - имя поля (любое на ваше усмотрение), в котором передано тело файла
      media: 'attach://image',
    },
    // Собственно тело файла, на которое ссылается `media` - должно быть на верхнем уровне наравне с другими параметрами
    image: new File([buffer], 'AnotherImage.jpg', { type: 'image/jpeg' }), // Можно также указать просто `buffer`
  });
})();
```

Для загрузки фотографий как правило не требуется заботиться о правильном указании имени загружаемого файла и его MIME-типе. Но, например, при загрузке документов это может быть важно (имя файла будет отображаться в интерфейсе мессенджера).

Указать эти значения можно несколькими способами. Самый «каноничный» — создать экземпляр нативного класса [File](https://developer.mozilla.org/en-US/docs/Web/API/File/File), в конструкторе которого можно передать эти поля:

```js
const file = new File([buffer], 'AnotherImage.jpg', { type: 'image/jpeg' });
```

Второй способ — указать эти значения в полях `name` и `type` непосредственно на загружаемом объекте. Кроме того, если вы класс `Stream` содержит поле `path`, имя файла будет извлечено из пути к нему.

Наконец, можно определить эти значения «рядом» с загружаемым файлом следующим образом:

```js
const message = await bot.sendDocument({
  chat_id: 888352,
  document: fs.createReadStream('./README.md'),
  document$name: 'VeryImportantDocument.md',
  document$type: 'text/markdown',
});
```

Имя полей с этой мета-информацией образуются из имени поля с самим файлом путем дописывания суффиксов `$name` и `$type`.
