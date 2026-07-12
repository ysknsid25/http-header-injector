const path = require("node:path");
const { pathToFileURL } = require("node:url");

const POPUP_URL = pathToFileURL(path.resolve(__dirname, "../src/popup.html")).href;

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

function seedHeaders(headers, prefix = "h_seed") {
    return headers.map((h, i) => ({
        id: `${prefix}_${i}`,
        enabled: h.enabled !== false,
        name: h.name,
        value: h.value ?? "",
    }));
}

function configWith(headers, urlFilter = "") {
    return {
        config: {
            activeProfileId: "p_seed",
            profiles: [
                {
                    id: "p_seed",
                    name: "Default",
                    urlFilter,
                    headers: seedHeaders(headers),
                },
            ],
        },
    };
}

function profilesWith(profiles, activeIndex = 0) {
    const built = profiles.map((p, i) => ({
        id: `p_seed_${i}`,
        name: p.name,
        urlFilter: p.urlFilter ?? "",
        headers: seedHeaders(p.headers ?? [], `h_seed_${i}`),
    }));
    return {
        config: {
            activeProfileId: built[activeIndex].id,
            profiles: built,
        },
    };
}

module.exports = { POPUP_URL, openPopup, configWith, profilesWith };
