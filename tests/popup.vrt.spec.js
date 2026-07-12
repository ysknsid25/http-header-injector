const { test, expect } = require("@playwright/test");
const { openPopup, configWith } = require("./helpers");

async function snap(page, name) {
  await page.locator("#status").waitFor();
  await expect(page).toHaveScreenshot(name, { fullPage: true });
}

test.describe("popup VRT", () => {
  test("空状態", async ({ page }) => {
    await openPopup(page);
    await snap(page, "empty.png");
  });

  test("ヘッダーあり(有効/無効混在)", async ({ page }) => {
    await openPopup(page, {
      storage: configWith(
        [
          { name: "Authorization", value: "Bearer xyz" },
          { name: "X-Env", value: "staging", enabled: false },
        ],
        "example.com"
      ),
    });
    await snap(page, "populated.png");
  });

  test("重複エラー", async ({ page }) => {
    await openPopup(page, {
      storage: configWith([
        { name: "X-Dup", value: "1" },
        { name: "x-dup", value: "2" },
      ]),
    });
    await snap(page, "duplicate.png");
  });

  test("名前未入力エラー", async ({ page }) => {
    await openPopup(page, {
      storage: configWith([{ name: "", value: "orphan" }]),
    });
    await snap(page, "invalid.png");
  });
});
