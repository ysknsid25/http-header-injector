const STORAGE_KEY = "config";

const defaultConfig = () => ({
    urlFilter: "",
    headers: [],
});

function genId() {
    return "h_" + Math.random().toString(36).slice(2, 9);
}

function sanitize(str) {
    return str.replace(/[\r\n\x00]/g, "");
}

const els = {
    urlFilter: document.getElementById("urlFilter"),
    list: document.getElementById("headerList"),
    empty: document.getElementById("emptyState"),
    add: document.getElementById("addHeader"),
    save: document.getElementById("save"),
    status: document.getElementById("status"),
    template: document.getElementById("headerRowTemplate"),
};

let config = defaultConfig();
let dirty = false;

async function load() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    config = Object.assign(defaultConfig(), data[STORAGE_KEY] || {});
    if (!Array.isArray(config.headers)) config.headers = [];
    render();
    setDirty(false);
}

function validate() {
    const seen = new Map();
    const duplicates = new Set();
    const incomplete = new Set();
    for (const h of config.headers) {
        const name = h.name.trim();
        if (name === "") {
            incomplete.add(h.id);
            continue;
        }
        if (!h.enabled) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) {
            duplicates.add(h.id);
            duplicates.add(seen.get(key));
        } else {
            seen.set(key, h.id);
        }
    }
    return { duplicates, incomplete };
}

function update() {
    const { duplicates, incomplete } = validate();
    els.list.querySelectorAll(".header-row").forEach((row) => {
        row.classList.toggle("duplicate", duplicates.has(row.dataset.id));
        row.classList.toggle("invalid", incomplete.has(row.dataset.id));
    });

    if (duplicates.size > 0 || incomplete.size > 0) {
        els.save.disabled = true;
        els.status.className = "status error";
        els.status.textContent =
            duplicates.size > 0
                ? "Duplicate header name"
                : "Header name is required";
        return;
    }

    els.save.disabled = !dirty;
    els.status.className = dirty ? "status dirty" : "status saved";
    els.status.textContent = dirty ? "Unsaved changes" : "Saved";
}

function setDirty(value) {
    dirty = value;
    update();
}

async function save() {
    const { duplicates, incomplete } = validate();
    if (duplicates.size > 0 || incomplete.size > 0) return;
    await chrome.storage.local.set({ [STORAGE_KEY]: config });
    setDirty(false);
}

function render() {
    els.urlFilter.value = config.urlFilter || "";
    els.list.innerHTML = "";
    config.headers.forEach((h) => els.list.appendChild(renderRow(h)));
    els.empty.classList.toggle("hidden", config.headers.length > 0);
}

function renderRow(h) {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.dataset.id = h.id;
    node.classList.toggle("disabled", !h.enabled);

    const enabled = node.querySelector(".row-enabled");
    const name = node.querySelector(".row-name");
    const value = node.querySelector(".row-value");
    const remove = node.querySelector(".row-remove");

    enabled.checked = h.enabled;
    name.value = h.name;
    value.value = h.value;

    enabled.addEventListener("change", () => {
        h.enabled = enabled.checked;
        node.classList.toggle("disabled", !h.enabled);
        setDirty(true);
    });

    const bindText = (input, key) => {
        input.addEventListener("input", () => {
            const clean = sanitize(input.value);
            if (clean !== input.value) {
                const pos = input.selectionStart - (input.value.length - clean.length);
                input.value = clean;
                input.setSelectionRange(pos, pos);
            }
            h[key] = clean;
            setDirty(true);
        });
    };
    bindText(name, "name");
    bindText(value, "value");

    remove.addEventListener("click", () => {
        config.headers = config.headers.filter((x) => x.id !== h.id);
        render();
        setDirty(true);
    });

    return node;
}

els.urlFilter.addEventListener("input", () => {
    config.urlFilter = sanitize(els.urlFilter.value);
    if (config.urlFilter !== els.urlFilter.value) {
        els.urlFilter.value = config.urlFilter;
    }
    setDirty(true);
});

els.add.addEventListener("click", () => {
    config.headers.push({
        id: genId(),
        enabled: true,
        name: "",
        value: "",
    });
    render();
    setDirty(true);
});

els.save.addEventListener("click", save);

load();
