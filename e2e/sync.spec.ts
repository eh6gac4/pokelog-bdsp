import { test, expect, type Route } from "@playwright/test";

// 同期エンドポイントはスタブ（playwright.config の NEXT_PUBLIC_SYNC_URL に
// 対し page.route で応答。導出キーでもパス glob で捕捉される）。

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

test("sync: ランダム生成で同期が有効化される", async ({ page }) => {
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

  await page.getByRole("button", { name: "ランダム生成" }).click();

  // 生成コードが readonly 入力に表示される（24 文字）。
  const codeInput = page.locator("input[readonly]");
  await expect(codeInput).toBeVisible();
  const code = await codeInput.inputValue();
  expect(code).toHaveLength(24);

  const stored = await page.evaluate(() =>
    localStorage.getItem("pokelog-bdsp-sync-code-v1"),
  );
  expect(stored).toBe(code);
});

test("sync: 任意の日本語合言葉で接続できる", async ({ page }) => {
  await page.route("**/v1/sync/**", (route: Route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 404, body: JSON.stringify({}) });
    }
    return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/");
  await expect(page.getByText("0 / 6 体")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "同期" }).click();
  // URL 非安全な日本語＋記号の合言葉（12 文字以上）。
  const phrase = "ポケログ合言葉！ダイパ旅パ";
  await page.getByPlaceholder(/文字以上の合言葉/).fill(phrase);
  await page.getByRole("button", { name: "この合言葉で同期" }).click();

  // 接続後、合言葉が読み取り専用入力にそのまま表示される。
  const codeInput = page.locator("input[readonly]");
  await expect(codeInput).toHaveValue(phrase, { timeout: 15000 });
  const stored = await page.evaluate(() =>
    localStorage.getItem("pokelog-bdsp-sync-code-v1"),
  );
  expect(stored).toBe(phrase);
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
    .getByPlaceholder(/文字以上の合言葉/)
    .fill("きょうゆうあいことば旅パ"); // 12 文字
  await page.getByRole("button", { name: "この合言葉で同期" }).click();

  // pulled → reload。取り込んだパーティ名が反映される。
  await expect(page.getByPlaceholder("旅パ名")).toHaveValue("E2E同期テスト", {
    timeout: 15000,
  });
});
