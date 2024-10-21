# tg-bot-api

**English** | [Russian](README-ru.md)

This is a concise library for [Telegram Bot API](https://core.telegram.org/bots/api). Unlike most other libraries, this implementation is not overloaded with unnecessary details and solves only one problem: convenient execution of requests to the API. The library has no external dependencies, it consists of 1 file less than 100 lines long and does not require updates when new methods appear.

This is **not** a framework. The library does not offer ways to handle incoming events: this can be trivially solved by any web framework (for example, [Express](https://expressjs.com/)). To call methods, you do not need to consult the library documentation: you always pass an object with the fields that are specified in the official documentation of the [Telegram Bot API](https://core.telegram.org/bots/api).

## Installation

```
npm install @denull/tg-bot-api
```

## TelegramBotAPI

The library exports the `TelegramBotAPI` class. To work with the API, create an instance of it by passing your bot's token:

```js
const TelegramBotAPI = require('tg-bot-api');

// Replace HERE_GOES_YOUR_TOKEN with the token received from @BotFather
const bot = new TelegramBotAPI('HERE_GOES_YOUR_TOKEN');
```

If you need to proxy requests, you can change the endpoint by passing it to the constructor as the second parameter:
```js
const bot = new TelegramBotAPI('HERE_GOES_YOUR_TOKEN', 'https://bots.mn/bot{token}/{method}');
```

Use the `{token}` and `{method}` templates inside a URL to substitute the token and name of the method being called. The default endpoint is `https://api.telegram.org/bot{token}/{method}`.

## Making API requests

To call API methods, simply call them on the created `TelegramBotAPI` instance. All parameters are specified as fields of the object passed as the first argument. The methods return a `Promise`, which is either resolved by the contents of the `result` field from the API response (if the call was successful), or throws the error returned from the API (with the `error_code` and `description` fields). For a list of methods, their parameters and error codes, see the [official documentation](https://core.telegram.org/bots/api).

```js
const TelegramBotAPI = require('tg-bot-api');
const bot = new TelegramBotAPI('HERE_GOES_YOUR_TOKEN');

(async() => {
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

The only error that is handled automatically by the library itself is flood control. If the server response contains the `retry_after` field, the method will not throw an error, but will automatically repeat the request after the specified time. By default, 10 retries are made to complete the request. To change this limit, pass it as the second argument to the called method. To disable this behavior, pass `0` or `false`. To retry an unlimited number of times, pass `Infinity` or `true`.

Please note: the library does not have a built-in list of methods; you can try to call non-existent API methods (which will probably return an error).

## Sending files

The main nuance that arises when working with the Telegram Bot API is the features of sending files. The library automatically switches from `application/json` format to `multipart/form-data` if one of the fields passed is of type `Blob`, `File`, `Stream`, `Buffer`, `ArrayBuffer`, `TypedArray` or `DataView`:

```js
const fs = require('fs');
const TelegramBotAPI = require('tg-bot-api');
const bot = new TelegramBotAPI('HERE_GOES_YOUR_TOKEN');

(async() => {
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

      // Here, in accordance with the method documentation, `image` is the name of the field (any at your discretion) in which the file body is passed
      media: 'attach://image',
    },
    // The actual body of the file referred to by `media` should be at the top level along with other parameters
    image: new File([buffer], 'AnotherImage.jpg', { type: 'image/jpeg' }), // You can also just specify `buffer`
  });
})();
```

To upload photos, as a rule, you do not need to worry about correctly specifying the name of the uploaded file and its MIME type. But, for example, when uploading documents, this may be important (the file name will be displayed in the messenger interface).

There are several ways to specify these values. The most “canonical” way is to create an instance of the native class [File](https://developer.mozilla.org/en-US/docs/Web/API/File/File), in whose constructor you can pass these fields:

```js
const file = new File([buffer], 'AnotherImage.jpg', { type: 'image/jpeg' });
```

The second way is to specify these values ​​in the `name` and `type` fields directly on the loaded object. Additionally, if your `Stream` class contains a `path` field, the filename will be extracted from its path.

Finally, you can define these values ​​"next to" the downloaded file like this:

```js
const message = await bot.sendDocument({
  chat_id: 888352,
  document: fs.createReadStream('./README.md'),
  document$name: 'VeryImportantDocument.md',
  document$type: 'text/markdown',
});
```

The names of the fields with this meta information are formed from the name of the field with the file itself by adding the suffixes `$name` and `$type`.
