const path = require("path");
const { pathToFileURL } = require("url");

const POPUP_URL = pathToFileURL(
  path.resolve(__dirname, "../src/popup.html")
).href;

async function openPopup(page, { storage = {} } = {}) {
  await page.addInitScript((initial) => {
    const store = { ...initial };
    window.__chromeStore = store;
    window.chrome = {
      storage: {
        local: {
          get: async (key) => {
            if (typeof key === "string") {
              return key in store ? { [key]: store[key] } : {};
            }
            return { ...store };
          },
          set: async (obj) => {
            Object.assign(store, obj);
          },
        },
      },
    };
  }, storage);

  await page.goto(POPUP_URL);
  await page.waitForFunction(() => window.chrome && window.__chromeStore);
}

function configWith(headers, urlFilter = "") {
  return {
    config: {
      urlFilter,
      headers: headers.map((h, i) => ({
        id: `h_seed_${i}`,
        enabled: h.enabled !== false,
        name: h.name,
        value: h.value ?? "",
      })),
    },
  };
}

module.exports = { POPUP_URL, openPopup, configWith };
