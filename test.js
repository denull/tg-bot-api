const fs = require('fs');
const TelegramBotAPI = require('./index.js');

const bot = new TelegramBotAPI('INSERT_YOUR_TOKEN_HERE');

(async () => {
  try {
    // Simple methods
    
    console.log(await bot.getMe());

    console.log(await bot.sendMessage({
      chat_id: 888352,
      text: 'Test',
      reply_markup: {
        inline_keyboard: [[{
          text: 'Test',
          callback_data: 'test',
        }]]
      }
    }));

    // Multiple ways to send files

    const buffer = fs.readFileSync('./README.md');
    const uint8 = new DataView(buffer.buffer);
    console.log(await bot.sendDocument({
      chat_id: 888352,
      document: new File([uint8], 'READMEEE.md'),
      document$name: 'readme.txt',
      document$type: 'text/plain',
      reply_markup: {
        inline_keyboard: [[{
          text: 'Test',
          callback_data: 'test',
        }]]
      }
    }));

    const image = fs.readFileSync("C:\\Users\\denull\\Pictures\\calc.png");
    const stream = fs.createReadStream("C:\\Users\\denull\\Pictures\\wiki.png");
    const message = await bot.sendPhoto({
      chat_id: 888352,
      photo: image.buffer,
    });

    bot.editMessageMedia({
      chat_id: 888352,
      message_id: message.message_id,
      media: {
        type: 'photo',
        media: 'attach://attach',
      },
      attach: stream,
    });
  } catch (error) {
    console.error(error);
  }
})();