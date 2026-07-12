const STORAGE_KEY = "config";

function genId(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function defaultProfile(name = "Default") {
    return { id: genId("p"), name, urlFilter: "", headers: [] };
}

function defaultConfig() {
    const p = defaultProfile();
    return { activeProfileId: p.id, profiles: [p] };
}

function sanitize(str) {
    return str.replace(/[\r\n\x00]/g, "");
}

function normalizeHeader(h) {
    return {
        id: typeof h?.id === "string" ? h.id : genId("h"),
        enabled: !(h && h.enabled === false),
        name: typeof h?.name === "string" ? h.name : "",
        value: typeof h?.value === "string" ? h.value : "",
    };
}

function dedupeProfileNames(profiles) {
    const seen = new Set();
    for (const p of profiles) {
        const base = p.name.trim() === "" ? "Default" : p.name;
        let candidate = base;
        let n = 2;
        while (seen.has(candidate.trim().toLowerCase())) {
            candidate = `${base} ${n}`;
            n++;
        }
        p.name = candidate;
        seen.add(candidate.trim().toLowerCase());
    }
    return profiles;
}

function migrate(raw) {
    if (raw && typeof raw === "object" && Array.isArray(raw.profiles) && raw.profiles.length > 0) {
        const profiles = dedupeProfileNames(
            raw.profiles.map((p, i) => ({
                id: typeof p?.id === "string" ? p.id : genId("p"),
                name:
                    typeof p?.name === "string" && p.name.trim() !== ""
                        ? p.name
                        : `Profile ${i + 1}`,
                urlFilter: typeof p?.urlFilter === "string" ? p.urlFilter : "",
                headers: Array.isArray(p?.headers) ? p.headers.map(normalizeHeader) : [],
            })),
        );
        const activeProfileId = profiles.some((p) => p.id === raw.activeProfileId)
            ? raw.activeProfileId
            : profiles[0].id;
        return { activeProfileId, profiles };
    }
    if (
        raw &&
        typeof raw === "object" &&
        (Array.isArray(raw.headers) || typeof raw.urlFilter === "string")
    ) {
        const p = {
            id: genId("p"),
            name: "Default",
            urlFilter: typeof raw.urlFilter === "string" ? raw.urlFilter : "",
            headers: Array.isArray(raw.headers) ? raw.headers.map(normalizeHeader) : [],
        };
        return { activeProfileId: p.id, profiles: [p] };
    }
    return defaultConfig();
}

function uniqueProfileName(base) {
    const existing = new Set(config.profiles.map((p) => p.name.trim().toLowerCase()));
    if (!existing.has(base.trim().toLowerCase())) return base;
    let n = 2;
    while (existing.has(`${base} ${n}`.trim().toLowerCase())) n++;
    return `${base} ${n}`;
}

const els = {
    profileSelect: document.getElementById("profileSelect"),
    profileName: document.getElementById("profileName"),
    addProfile: document.getElementById("addProfile"),
    deleteProfile: document.getElementById("deleteProfile"),
    urlFilter: document.getElementById("urlFilter"),
    list: document.getElementById("headerList"),
    empty: document.getElementById("emptyState"),
    add: document.getElementById("addHeader"),
    save: document.getElementById("save"),
    status: document.getElementById("status"),
    template: document.getElementById("headerRowTemplate"),
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importFile: document.getElementById("importFile"),
};

let config = defaultConfig();
let dirty = false;

function activeProfile() {
    return config.profiles.find((p) => p.id === config.activeProfileId) || config.profiles[0];
}

async function load() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    config = migrate(data[STORAGE_KEY]);
    render();
    setDirty(false);
}

function validate() {
    const seen = new Map();
    const duplicates = new Set();
    const incomplete = new Set();
    for (const h of activeProfile().headers) {
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

function validateProfiles() {
    const seen = new Map();
    const duplicates = new Set();
    const incomplete = new Set();
    for (const p of config.profiles) {
        const name = p.name.trim();
        if (name === "") {
            incomplete.add(p.id);
            continue;
        }
        const key = name.toLowerCase();
        if (seen.has(key)) {
            duplicates.add(p.id);
            duplicates.add(seen.get(key));
        } else {
            seen.set(key, p.id);
        }
    }
    return { duplicates, incomplete };
}

function update() {
    const header = validate();
    const profile = validateProfiles();
    const active = config.activeProfileId;

    els.list.querySelectorAll(".header-row").forEach((row) => {
        row.classList.toggle("duplicate", header.duplicates.has(row.dataset.id));
        row.classList.toggle("invalid", header.incomplete.has(row.dataset.id));
    });
    els.profileName.classList.toggle(
        "invalid",
        profile.duplicates.has(active) || profile.incomplete.has(active),
    );

    let error = null;
    if (profile.duplicates.size > 0) error = "Duplicate profile name";
    else if (profile.incomplete.size > 0) error = "Profile name is required";
    else if (header.duplicates.size > 0) error = "Duplicate header name";
    else if (header.incomplete.size > 0) error = "Header name is required";

    if (error) {
        els.save.disabled = true;
        els.status.className = "status error";
        els.status.textContent = error;
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
    const header = validate();
    const profile = validateProfiles();
    if (
        header.duplicates.size > 0 ||
        header.incomplete.size > 0 ||
        profile.duplicates.size > 0 ||
        profile.incomplete.size > 0
    ) {
        return;
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: config });
    setDirty(false);
}

function profileLabel(name) {
    return name.trim() === "" ? "Untitled" : name;
}

function renderProfiles() {
    els.profileSelect.innerHTML = "";
    for (const p of config.profiles) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = profileLabel(p.name);
        els.profileSelect.appendChild(opt);
    }
    els.profileSelect.value = config.activeProfileId;
    els.profileName.value = activeProfile().name;
    els.deleteProfile.disabled = config.profiles.length <= 1;
}

function render() {
    const prof = activeProfile();
    renderProfiles();
    els.urlFilter.value = prof.urlFilter || "";
    els.list.innerHTML = "";
    for (const h of prof.headers) {
        els.list.appendChild(renderRow(h));
    }
    els.empty.classList.toggle("hidden", prof.headers.length > 0);
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
        const prof = activeProfile();
        prof.headers = prof.headers.filter((x) => x.id !== h.id);
        render();
        setDirty(true);
    });

    return node;
}

function bindSanitizedInput(input, apply) {
    input.addEventListener("input", () => {
        const clean = sanitize(input.value);
        if (clean !== input.value) {
            const pos = input.selectionStart - (input.value.length - clean.length);
            input.value = clean;
            input.setSelectionRange(pos, pos);
        }
        apply(clean);
        setDirty(true);
    });
}

els.profileSelect.addEventListener("change", () => {
    config.activeProfileId = els.profileSelect.value;
    render();
    setDirty(true);
});

bindSanitizedInput(els.profileName, (clean) => {
    activeProfile().name = clean;
    const opt = els.profileSelect.querySelector(`option[value="${config.activeProfileId}"]`);
    if (opt) opt.textContent = profileLabel(clean);
});

els.addProfile.addEventListener("click", () => {
    const p = defaultProfile(uniqueProfileName(`Profile ${config.profiles.length + 1}`));
    config.profiles.push(p);
    config.activeProfileId = p.id;
    render();
    setDirty(true);
    els.profileName.focus();
    els.profileName.select();
});

els.deleteProfile.addEventListener("click", () => {
    if (config.profiles.length <= 1) return;
    config.profiles = config.profiles.filter((p) => p.id !== config.activeProfileId);
    config.activeProfileId = config.profiles[0].id;
    render();
    setDirty(true);
});

bindSanitizedInput(els.urlFilter, (clean) => {
    activeProfile().urlFilter = clean;
});

els.add.addEventListener("click", () => {
    activeProfile().headers.push({
        id: genId("h"),
        enabled: true,
        name: "",
        value: "",
    });
    render();
    setDirty(true);
});

function exportConfig() {
    const data = {
        version: 2,
        profiles: config.profiles.map((p) => ({
            name: p.name,
            urlFilter: p.urlFilter || "",
            headers: p.headers.map((h) => ({
                enabled: h.enabled !== false,
                name: h.name,
                value: h.value,
            })),
        })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "http-header-injector-config.json";
    a.click();
    URL.revokeObjectURL(url);
}

function importHeaders(arr) {
    const headers = Array.isArray(arr) ? arr : [];
    return headers
        .map((h) => ({
            id: genId("h"),
            enabled: !(h && h.enabled === false),
            name: sanitize(String(h?.name ?? "")),
            value: sanitize(String(h?.value ?? "")),
        }))
        .filter((h) => h.name.trim() !== "");
}

function importConfig(file) {
    const reader = new FileReader();
    reader.onload = () => {
        let data;
        try {
            data = JSON.parse(reader.result);
        } catch {
            els.save.disabled = true;
            els.status.className = "status error";
            els.status.textContent = "Import failed: invalid JSON";
            return;
        }

        let profiles;
        if (Array.isArray(data?.profiles)) {
            profiles = data.profiles.map((p, i) => ({
                id: genId("p"),
                name: sanitize(String(p?.name ?? `Profile ${i + 1}`)),
                urlFilter: sanitize(String(p?.urlFilter ?? "")),
                headers: importHeaders(p?.headers),
            }));
        } else {
            profiles = [
                {
                    id: genId("p"),
                    name: "Default",
                    urlFilter: sanitize(String(data?.urlFilter ?? "")),
                    headers: importHeaders(data?.headers),
                },
            ];
        }
        if (profiles.length === 0) profiles = [defaultProfile()];
        dedupeProfileNames(profiles);

        config = { activeProfileId: profiles[0].id, profiles };
        render();
        setDirty(true);
    };
    reader.readAsText(file);
}

els.exportBtn.addEventListener("click", exportConfig);
els.importBtn.addEventListener("click", () => els.importFile.click());
els.importFile.addEventListener("change", () => {
    const file = els.importFile.files[0];
    if (file) importConfig(file);
    els.importFile.value = "";
});

els.save.addEventListener("click", save);

load();
