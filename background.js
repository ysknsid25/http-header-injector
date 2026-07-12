const STORAGE_KEY = "config";

// "ping" and "csp_report" are intentionally excluded: they are browser-generated
// requests that may target third-party endpoints unknown to the user, and should
// not carry user-configured credentials such as Authorization or X-API-Key headers.
const RESOURCE_TYPES = [
    "main_frame",
    "sub_frame",
    "stylesheet",
    "script",
    "image",
    "font",
    "object",
    "xmlhttprequest",
    "media",
    "websocket",
    "other",
];

async function loadConfig() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    return data[STORAGE_KEY] || { urlFilter: "", headers: [] };
}

function sanitize(str) {
    return String(str ?? "").replace(/[\r\n\x00]/g, "");
}

function buildRules(config) {
    const seen = new Set();
    const requestHeaders = [];
    for (const h of config.headers || []) {
        if (!h.enabled || !h.name || h.name.trim() === "") continue;
        const name = sanitize(h.name);
        const key = name.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        requestHeaders.push({
            header: name,
            operation: "set",
            value: sanitize(h.value),
        });
    }

    if (requestHeaders.length === 0) return [];

    const condition = { resourceTypes: RESOURCE_TYPES };
    const urlFilter = sanitize(config.urlFilter).trim();
    if (urlFilter !== "") {
        condition.urlFilter = urlFilter;
    }

    return [
        {
            id: 1,
            priority: 1,
            action: { type: "modifyHeaders", requestHeaders },
            condition,
        },
    ];
}

async function syncRules() {
    try {
        const config = await loadConfig();
        const existing = await chrome.declarativeNetRequest.getDynamicRules();
        const removeRuleIds = existing.map((r) => r.id);
        const addRules = buildRules(config);
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds,
            addRules,
        });
        const count = addRules.reduce((n, r) => n + (r.action.requestHeaders?.length || 0), 0);
        await chrome.action.setBadgeBackgroundColor({ color: "#F14E32" });
        await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    } catch (err) {
        console.error("[HTTP Header Injector] Failed to sync rules:", err);
    }
}

chrome.runtime.onInstalled.addListener(syncRules);
chrome.runtime.onStartup.addListener(syncRules);
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) {
        syncRules();
    }
});
