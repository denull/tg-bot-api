const { basename } = require('path');
const { Readable } = require('stream');
const { isTypedArray } = require('util/types');

function streamToFile(stream, name, type) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk))
      .once('end', () => resolve(new File(chunks, name || (stream.path && basename(stream.path)), { type })))
      .once('error', reject);
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class TelegramBotAPI {
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

  async callMethod(method, params = {}, autoRetry = true) {
    let formData = null;
    for (let k in params) {
      // Node now has way too many file-like data structures
      if (params[k] instanceof Buffer || params[k] instanceof ArrayBuffer || isTypedArray(params[k]) || params[k] instanceof DataView ||
        params[k] instanceof Blob || params[k] instanceof File || params[k] instanceof Readable) {
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
        'Content-Type': 'application/json',
      })
    });

    const data = await response.json();
    if (!data.ok) {
      if (autoRetry && data.retry_after) { // Retry automatically, if allowed
        await delay(data.retry_after * 1000);
        return this.callMethod(method, params);
      }
      throw data;
    }

    return data.result;
  }
}

module.exports = TelegramBotAPI;