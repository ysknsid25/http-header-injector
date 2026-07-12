const { test, expect } = require("@playwright/test");
const { openPopup, configWith } = require("./helpers");

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
        expect(saved.headers).toHaveLength(1);
        expect(saved.headers[0]).toMatchObject({
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
            version: 1,
            urlFilter: "example.com",
            headers: [
                { enabled: true, name: "X-Token", value: "abc" },
                { enabled: false, name: "X-Env", value: "staging" },
            ],
        });
        expect(data.headers[0]).not.toHaveProperty("id");
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
});
