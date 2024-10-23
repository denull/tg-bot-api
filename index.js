const { basename } = require('node:path');
const { Readable } = require('node:stream');
const { Blob, File } = require('node:buffer');
const { isTypedArray } = require('node:util/types');

function streamToFile(stream, name, type) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk))
      .once('end', () => resolve(new File(chunks, name || (stream.path && basename(stream.path)), { type })))
      .once('error', reject);
  });
}

class TelegramError extends Error {
  constructor(request, { error, cause }) {
    super(error ? error.description : cause.message, cause && { cause });
    this.stack = (this.stack || '').replace(/TelegramBotAPI\.callMethod/, `TelegramBotAPI\.${request.method}`);
    this.code = error && error.error_code || undefined;
    this.parameters = error && error.parameters || undefined;
    this.request = request;
  }
}
TelegramError.prototype.name = 'TelegramError';

class TelegramBotAPI {
  static TelegramError = TelegramError;

  constructor(token, endpoint = 'https://api.telegram.org/bot{token}/{method}') {
    this.token = token;
    this.endpoint = endpoint;
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) {
          return target[prop];
        }
        return function(params, autoRetry) {
          return target.callMethod(prop, params, autoRetry);
        }
      }
    });
  }

  async callMethod(method, params = {}, retryAttempts = 10) {
    let attempt = 0;
    try {
      while (true) { // Handle multiple attempts without recursion
        let formData = null;
        for (let k in params) {
          if (params[k] instanceof Buffer || params[k] instanceof ArrayBuffer || isTypedArray(params[k]) || params[k] instanceof DataView ||
            params[k] instanceof Readable || params[k] instanceof Blob || params[k] instanceof File) {
            formData = new FormData();
          }
        }

        if (formData) {
          for (let k in params) {
            let meta = {};
            for (const field of ['name', 'type']) {
              if (`${k}$${field}` in params) {
                meta[field] = params[`${k}$${field}`];
                formData.delete(`${k}$${field}`); // In case we already added it
              }
            }
            const value = params[k];
            if ((value instanceof Blob || value instanceof File) && !meta.name && !meta.type) {
              formData.set(k, value); // No need to transform
            } else
            if (value instanceof Blob || value instanceof File || value instanceof Buffer || value instanceof ArrayBuffer ||
              isTypedArray(value) || value instanceof DataView) {
              formData.set(k, new File([value], meta.name || value.name, { type: meta.type || value.type }));
            } else
            if (value instanceof Readable) {
              formData.set(k, await streamToFile(value, meta.name, meta.type));
            } else
            if (typeof value === 'object') {
              formData.set(k, JSON.stringify(value));
            } else {
              formData.set(k, value);
            }
          }
        }

        const response = await fetch(this.endpoint.replaceAll(/{token}/gi, this.token).replaceAll(/{method}/gi, method), {
          method: 'post',
          body: formData || JSON.stringify(params),
          ...(!formData && {
            headers: {
              'Content-Type': 'application/json',
            }
          })
        });
        const data = await response.json();
        if (!data.ok) {
          if ((retryAttempts === true || attempt < retryAttempts) && data.parameters && data.parameters.retry_after) {
            attempt += 1;
            await new Promise(resolve => setTimeout(resolve, data.parameters.retry_after * 1000));
            continue;
          }
          throw new TelegramError({ method, params, attempt, retryAttempts }, { error: data });
        }
        return data.result;
      }
    } catch (cause) { // Re-throw with additional information
      const error = cause instanceof TelegramError ? cause : new TelegramError({ method, params, attempt, retryAttempts }, { cause });
      this.onError && this.onError(error);
      throw error;
    }
  }
}

module.exports = TelegramBotAPI;