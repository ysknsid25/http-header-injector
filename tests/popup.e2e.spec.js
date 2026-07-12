const { test, expect } = require("@playwright/test");
const { openPopup, configWith, profilesWith } = require("./helpers");

test.describe("popup e2e", () => {
    test("初期表示: 空状態でSaveは無効、statusはSaved", async ({ page }) => {
        await openPopup(page);

        await expect(page.locator("#emptyState")).toBeVisible();
        await expect(page.locator(".header-row")).toHaveCount(0);
        await expect(page.locator("#save")).toBeDisabled();
        await expect(page.locator("#status")).toHaveText("Saved");
    });

    test("保存済みconfigをstorageから読み込んで行を描画する", async ({ page }) => {
        await openPopup(page, {
            storage: configWith(
                [
                    { name: "X-Token", value: "abc" },
                    { name: "X-Env", value: "staging", enabled: false },
                ],
                "example.com",
            ),
        });

        await expect(page.locator(".header-row")).toHaveCount(2);
        await expect(page.locator("#urlFilter")).toHaveValue("example.com");
        await expect(page.locator("#emptyState")).toBeHidden();
        await expect(page.locator(".header-row").nth(1)).toHaveClass(/disabled/);
        await expect(page.locator("#status")).toHaveText("Saved");
    });

    test("Add で行が追加され、名前が空のうちはSave不可", async ({ page }) => {
        await openPopup(page);
        await page.locator("#addHeader").click();

        await expect(page.locator(".header-row")).toHaveCount(1);
        await expect(page.locator("#emptyState")).toBeHidden();
        await expect(page.locator("#save")).toBeDisabled();
        await expect(page.locator("#status")).toHaveText("Header name is required");
    });

    test("名前と値を入力するとSaveが有効になり、保存後はSaved", async ({ page }) => {
        await openPopup(page);
        await page.locator("#addHeader").click();
        await page.locator(".row-name").fill("Authorization");
        await page.locator(".row-value").fill("Bearer xyz");

        await expect(page.locator("#save")).toBeEnabled();
        await expect(page.locator("#status")).toHaveText("Unsaved changes");

        await page.locator("#save").click();

        await expect(page.locator("#status")).toHaveText("Saved");
        await expect(page.locator("#save")).toBeDisabled();

        const saved = await page.evaluate(() => window.__chromeStore.config);
        expect(saved.profiles).toHaveLength(1);
        expect(saved.profiles[0].headers).toHaveLength(1);
        expect(saved.profiles[0].headers[0]).toMatchObject({
            name: "Authorization",
            value: "Bearer xyz",
            enabled: true,
        });
    });

    test("重複ヘッダー名を検出してSaveを無効化する", async ({ page }) => {
        await openPopup(page);
        await page.locator("#addHeader").click();
        await page.locator("#addHeader").click();

        const rows = page.locator(".header-row");
        await rows.nth(0).locator(".row-name").fill("X-Dup");
        await rows.nth(1).locator(".row-name").fill("x-dup");

        await expect(page.locator("#status")).toHaveText("Duplicate header name");
        await expect(page.locator("#save")).toBeDisabled();
        await expect(rows.nth(0)).toHaveClass(/duplicate/);
        await expect(rows.nth(1)).toHaveClass(/duplicate/);
    });

    test("改行・NUL文字は入力時にサニタイズされる", async ({ page }) => {
        await openPopup(page);
        await page.locator("#addHeader").click();
        await page.locator(".row-value").evaluate((el) => {
            el.value = "a\r\nb\x00c";
            el.dispatchEvent(new Event("input", { bubbles: true }));
        });

        await expect(page.locator(".row-value")).toHaveValue("abc");
    });

    test("削除すると空状態に戻る", async ({ page }) => {
        await openPopup(page, {
            storage: configWith([{ name: "X-One", value: "1" }]),
        });

        await expect(page.locator(".header-row")).toHaveCount(1);
        await page.locator(".row-remove").click();

        await expect(page.locator(".header-row")).toHaveCount(0);
        await expect(page.locator("#emptyState")).toBeVisible();
    });

    test("URLフィルタの入力がstatusに反映される", async ({ page }) => {
        await openPopup(page);
        await page.locator("#urlFilter").fill("api.example.com");

        await expect(page.locator("#status")).toHaveText("Unsaved changes");
        await expect(page.locator("#save")).toBeEnabled();
    });
});

test.describe("Export", () => {
    test("現在のconfigをJSONとしてダウンロードする", async ({ page }) => {
        await openPopup(page, {
            storage: configWith(
                [
                    { name: "X-Token", value: "abc" },
                    { name: "X-Env", value: "staging", enabled: false },
                ],
                "example.com",
            ),
        });

        const downloadPromise = page.waitForEvent("download");
        await page.locator("#exportBtn").click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toBe("http-header-injector-config.json");

        const stream = await download.createReadStream();
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const data = JSON.parse(Buffer.concat(chunks).toString("utf-8"));

        expect(data).toMatchObject({
            version: 2,
            profiles: [
                {
                    name: "Default",
                    urlFilter: "example.com",
                    headers: [
                        { enabled: true, name: "X-Token", value: "abc" },
                        { enabled: false, name: "X-Env", value: "staging" },
                    ],
                },
            ],
        });
        expect(data.profiles[0].headers[0]).not.toHaveProperty("id");
        expect(data.profiles[0]).not.toHaveProperty("id");
    });

    test("すべてのプロファイルをエクスポートする", async ({ page }) => {
        await openPopup(page, {
            storage: profilesWith([
                {
                    name: "prd",
                    urlFilter: "prd.example.com",
                    headers: [{ name: "X-Env", value: "prd" }],
                },
                {
                    name: "stg",
                    urlFilter: "stg.example.com",
                    headers: [{ name: "X-Env", value: "stg" }],
                },
            ]),
        });

        const downloadPromise = page.waitForEvent("download");
        await page.locator("#exportBtn").click();
        const download = await downloadPromise;

        const stream = await download.createReadStream();
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const data = JSON.parse(Buffer.concat(chunks).toString("utf-8"));

        expect(data.version).toBe(2);
        expect(data.profiles).toHaveLength(2);
        expect(data.profiles.map((p) => p.name)).toEqual(["prd", "stg"]);
        expect(data.profiles[1].headers[0]).toMatchObject({ name: "X-Env", value: "stg" });
    });
});

test.describe("Import", () => {
    test("有効なJSONを読み込んで行を描画し未保存状態にする", async ({ page }) => {
        await openPopup(page);

        await page.locator("#importFile").setInputFiles({
            name: "config.json",
            mimeType: "application/json",
            buffer: Buffer.from(
                JSON.stringify({
                    version: 1,
                    urlFilter: "imported.example.com",
                    headers: [
                        { enabled: true, name: "X-Imported", value: "1" },
                        { enabled: false, name: "X-Off", value: "2" },
                    ],
                }),
            ),
        });

        await expect(page.locator(".header-row")).toHaveCount(2);
        await expect(page.locator("#urlFilter")).toHaveValue("imported.example.com");
        await expect(page.locator(".header-row").nth(1)).toHaveClass(/disabled/);
        await expect(page.locator("#status")).toHaveText("Unsaved changes");
    });

    test("名前が空のヘッダーは除外される", async ({ page }) => {
        await openPopup(page);

        await page.locator("#importFile").setInputFiles({
            name: "config.json",
            mimeType: "application/json",
            buffer: Buffer.from(
                JSON.stringify({
                    headers: [
                        { name: "X-Keep", value: "1" },
                        { name: "", value: "drop" },
                        { name: "   ", value: "drop-too" },
                    ],
                }),
            ),
        });

        await expect(page.locator(".header-row")).toHaveCount(1);
        await expect(page.locator(".row-name")).toHaveValue("X-Keep");
    });

    test("値に含まれる改行はサニタイズされる", async ({ page }) => {
        await openPopup(page);

        await page.locator("#importFile").setInputFiles({
            name: "config.json",
            mimeType: "application/json",
            buffer: Buffer.from(
                JSON.stringify({
                    headers: [{ name: "X-Multi", value: "a\r\nb" }],
                }),
            ),
        });

        await expect(page.locator(".row-value")).toHaveValue("ab");
    });

    test("不正なJSONはエラーステータスを表示する", async ({ page }) => {
        await openPopup(page);

        await page.locator("#importFile").setInputFiles({
            name: "broken.json",
            mimeType: "application/json",
            buffer: Buffer.from("{ not valid json "),
        });

        await expect(page.locator("#status")).toHaveText("Import failed: invalid JSON");
        await expect(page.locator("#save")).toBeDisabled();
    });

    test("v2形式(複数プロファイル)を読み込む", async ({ page }) => {
        await openPopup(page);

        await page.locator("#importFile").setInputFiles({
            name: "config.json",
            mimeType: "application/json",
            buffer: Buffer.from(
                JSON.stringify({
                    version: 2,
                    profiles: [
                        {
                            name: "prd",
                            urlFilter: "prd.example.com",
                            headers: [{ name: "X-Env", value: "prd" }],
                        },
                        {
                            name: "stg",
                            urlFilter: "stg.example.com",
                            headers: [{ name: "X-Env", value: "stg" }],
                        },
                    ],
                }),
            ),
        });

        await expect(page.locator("#profileSelect option")).toHaveCount(2);
        await expect(page.locator("#profileName")).toHaveValue("prd");
        await expect(page.locator("#urlFilter")).toHaveValue("prd.example.com");
        await expect(page.locator(".header-row")).toHaveCount(1);
        await expect(page.locator("#status")).toHaveText("Unsaved changes");
    });

    test("プロファイル名が無いv2データはデフォルト名で補完される", async ({ page }) => {
        await openPopup(page);

        await page.locator("#importFile").setInputFiles({
            name: "config.json",
            mimeType: "application/json",
            buffer: Buffer.from(
                JSON.stringify({
                    version: 2,
                    profiles: [
                        { headers: [{ name: "X-A", value: "1" }] },
                        { name: "", headers: [{ name: "X-B", value: "2" }] },
                    ],
                }),
            ),
        });

        const names = await page.locator("#profileSelect option").allTextContents();
        expect(names).toEqual(["Profile 1", "Default"]);
    });

    test("重複したプロファイル名はインポート時に一意化される", async ({ page }) => {
        await openPopup(page);

        await page.locator("#importFile").setInputFiles({
            name: "config.json",
            mimeType: "application/json",
            buffer: Buffer.from(
                JSON.stringify({
                    version: 2,
                    profiles: [
                        { name: "dev", headers: [{ name: "X-A", value: "1" }] },
                        { name: "dev", headers: [{ name: "X-B", value: "2" }] },
                    ],
                }),
            ),
        });

        const names = await page.locator("#profileSelect option").allTextContents();
        expect(names).toEqual(["dev", "dev 2"]);
        await expect(page.locator("#status")).toHaveText("Unsaved changes");
    });

    test("v1形式は単一のDefaultプロファイルに移行される", async ({ page }) => {
        await openPopup(page);

        await page.locator("#importFile").setInputFiles({
            name: "config.json",
            mimeType: "application/json",
            buffer: Buffer.from(
                JSON.stringify({
                    version: 1,
                    urlFilter: "legacy.example.com",
                    headers: [{ name: "X-Legacy", value: "1" }],
                }),
            ),
        });

        await expect(page.locator("#profileSelect option")).toHaveCount(1);
        await expect(page.locator("#profileName")).toHaveValue("Default");
        await expect(page.locator("#urlFilter")).toHaveValue("legacy.example.com");
    });
});

test.describe("Profiles", () => {
    test("旧形式(profiles無し)のconfigはDefaultプロファイルとして読み込まれる", async ({
        page,
    }) => {
        await openPopup(page, {
            storage: {
                config: {
                    urlFilter: "legacy.example.com",
                    headers: [{ id: "h_x", enabled: true, name: "X-Legacy", value: "1" }],
                },
            },
        });

        await expect(page.locator("#profileSelect option")).toHaveCount(1);
        await expect(page.locator("#profileName")).toHaveValue("Default");
        await expect(page.locator("#urlFilter")).toHaveValue("legacy.example.com");
        await expect(page.locator(".row-name")).toHaveValue("X-Legacy");
        await expect(page.locator("#status")).toHaveText("Saved");
    });

    test("複数プロファイルを読み込み、切り替えると内容が入れ替わる", async ({ page }) => {
        await openPopup(page, {
            storage: profilesWith([
                {
                    name: "prd",
                    urlFilter: "prd.example.com",
                    headers: [{ name: "X-Env", value: "prd" }],
                },
                {
                    name: "stg",
                    urlFilter: "stg.example.com",
                    headers: [{ name: "X-Env", value: "stg" }],
                },
            ]),
        });

        await expect(page.locator("#profileSelect option")).toHaveCount(2);
        await expect(page.locator("#profileName")).toHaveValue("prd");
        await expect(page.locator(".row-value")).toHaveValue("prd");

        await page.locator("#profileSelect").selectOption({ label: "stg" });

        await expect(page.locator("#profileName")).toHaveValue("stg");
        await expect(page.locator("#urlFilter")).toHaveValue("stg.example.com");
        await expect(page.locator(".row-value")).toHaveValue("stg");
        await expect(page.locator("#status")).toHaveText("Unsaved changes");
    });

    test("プロファイルを追加すると新しい空プロファイルに切り替わる", async ({ page }) => {
        await openPopup(page);

        await page.locator("#addProfile").click();

        await expect(page.locator("#profileSelect option")).toHaveCount(2);
        await expect(page.locator("#profileName")).toHaveValue("Profile 2");
        await expect(page.locator(".header-row")).toHaveCount(0);
        await expect(page.locator("#status")).toHaveText("Unsaved changes");
    });

    test("プロファイルが1つのときは削除できない", async ({ page }) => {
        await openPopup(page);
        await expect(page.locator("#deleteProfile")).toBeDisabled();
    });

    test("プロファイルを削除すると残りの先頭に切り替わる", async ({ page }) => {
        await openPopup(page, {
            storage: profilesWith([
                { name: "prd", headers: [{ name: "X-Env", value: "prd" }] },
                { name: "stg", headers: [{ name: "X-Env", value: "stg" }] },
            ]),
        });

        await page.locator("#profileSelect").selectOption({ label: "stg" });
        await page.locator("#deleteProfile").click();

        await expect(page.locator("#profileSelect option")).toHaveCount(1);
        await expect(page.locator("#profileName")).toHaveValue("prd");
    });

    test("プロファイル名を変更するとselectの表示も更新される", async ({ page }) => {
        await openPopup(page);

        await page.locator("#profileName").fill("local");

        await expect(page.locator("#profileSelect option")).toHaveText(["local"]);
        await expect(page.locator("#status")).toHaveText("Unsaved changes");
    });

    test("重複したプロファイル名はSaveを無効化する", async ({ page }) => {
        await openPopup(page, {
            storage: profilesWith([
                { name: "prd", headers: [{ name: "X-Env", value: "prd" }] },
                { name: "stg", headers: [{ name: "X-Env", value: "stg" }] },
            ]),
        });

        await page.locator("#profileSelect").selectOption({ label: "stg" });
        await page.locator("#profileName").fill("prd");

        await expect(page.locator("#status")).toHaveText("Duplicate profile name");
        await expect(page.locator("#save")).toBeDisabled();
        await expect(page.locator("#profileName")).toHaveClass(/invalid/);
    });

    test("プロファイル名が空だとSaveを無効化する", async ({ page }) => {
        await openPopup(page);

        await page.locator("#profileName").fill("");

        await expect(page.locator("#status")).toHaveText("Profile name is required");
        await expect(page.locator("#save")).toBeDisabled();
    });

    test("アクティブなプロファイルのヘッダーのみ保存される", async ({ page }) => {
        await openPopup(page, {
            storage: profilesWith([
                {
                    name: "prd",
                    urlFilter: "prd.example.com",
                    headers: [{ name: "X-Env", value: "prd" }],
                },
                {
                    name: "stg",
                    urlFilter: "stg.example.com",
                    headers: [{ name: "X-Env", value: "stg" }],
                },
            ]),
        });

        await page.locator("#profileSelect").selectOption({ label: "stg" });
        await page.locator("#save").click();

        await expect(page.locator("#status")).toHaveText("Saved");

        const saved = await page.evaluate(() => window.__chromeStore.config);
        expect(saved.profiles).toHaveLength(2);
        const active = saved.profiles.find((p) => p.id === saved.activeProfileId);
        expect(active.name).toBe("stg");
        expect(active.headers[0]).toMatchObject({ name: "X-Env", value: "stg" });
    });
});
