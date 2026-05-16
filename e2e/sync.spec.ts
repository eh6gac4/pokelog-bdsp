import { test, expect, type Route } from "@playwright/test";

// 同期エンドポイントはスタブ（playwright.config の NEXT_PUBLIC_SYNC_URL=
// http://sync.e2e.local に対して page.route で応答）。

const REMOTE = {
  schema: 1,
  updatedAt: "2026-04-04T00:00:00.000Z",
  party: { name: "E2E同期テスト", version: "bd", members: [] },
  log: [],
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("sync: コード生成で同期が有効化される", async ({ page }) => {
  // サーバ未保存 → GET 404、初期 PUT 200。
  await page.route("**/v1/sync/**", (route: Route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 404, body: JSON.stringify({}) });
    }
    return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/");
  await expect(page.getByText("0 / 6 体")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "同期" }).click();
  await expect(page.getByText("端末間同期")).toBeVisible();

  await page
    .getByRole("button", { name: /同期を有効化/ })
    .click();

  // 生成コードが readonly 入力に表示される（24 文字）。
  const codeInput = page.locator('input[readonly]');
  await expect(codeInput).toBeVisible();
  const code = await codeInput.inputValue();
  expect(code).toHaveLength(24);

  // localStorage にコードが保存されている。
  const stored = await page.evaluate(() =>
    localStorage.getItem("pokelog-bdsp-sync-code-v1"),
  );
  expect(stored).toBe(code);
});

test("sync: 既存コードに接続するとサーバ内容を取り込む", async ({ page }) => {
  await page.route("**/v1/sync/**", (route: Route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(REMOTE),
      });
    }
    return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/");
  await expect(page.getByText("0 / 6 体")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "同期" }).click();
  await page
    .getByPlaceholder("同期コード")
    .fill("AAAAAAAAAAAAAAAAAAAAAAAA"); // 24 文字
  await page.getByRole("button", { name: "接続" }).click();

  // pulled → reload。取り込んだパーティ名が反映される。
  await expect(page.getByPlaceholder("旅パ名")).toHaveValue("E2E同期テスト", {
    timeout: 15000,
  });
});
