import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("EV log: empty state, add, persist, over-cap warning, delete", async ({
  page,
}) => {
  await page.goto("/ev");

  // Empty state visible after hydration (auto-wait past 読み込み中...)
  await expect(
    page.getByText("まだ登録がありません")
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("0 匹登録中")).toBeVisible();

  // Open add modal
  await page.getByRole("button", { name: "+ 追加" }).click();
  await expect(
    page.getByRole("heading", { name: "ポケモンを追加" })
  ).toBeVisible();

  // Fill species name (placeholder ポッチャマ) and submit
  await page.getByPlaceholder("ポッチャマ").fill("フシギダネ");
  await page.getByRole("button", { name: "追加", exact: true }).click();

  // Modal closed, card visible, count updated
  await expect(
    page.getByRole("heading", { name: "ポケモンを追加" })
  ).toBeHidden();
  await expect(page.getByText("フシギダネ")).toBeVisible();
  await expect(page.getByText("1 匹登録中")).toBeVisible();

  // Reload -> persistence via localStorage
  await page.reload();
  await expect(page.getByText("フシギダネ")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("1 匹登録中")).toBeVisible();

  // Expand the card via its header toggle button
  await page.getByRole("button", { name: /フシギダネ/ }).click();

  // EV number inputs within expanded card. EvBar inputs are the only
  // number inputs with max=252 (HP, こうげき, ぼうぎょ, とくこう, とくぼう, すばやさ).
  const evNumberInputs = page.locator('input[type="number"][max="252"]');
  await expect(evNumberInputs).toHaveCount(6);

  await evNumberInputs.nth(0).fill("252"); // HP
  await evNumberInputs.nth(1).fill("260"); // こうげき -> total 512 > 510

  await expect(page.getByText("超過!")).toBeVisible();

  // Delete the card
  await page.getByRole("button", { name: "削除" }).click();
  await expect(page.getByText("フシギダネ")).toBeHidden();
  await expect(page.getByText("0 匹登録中")).toBeVisible();
  await expect(page.getByText("まだ登録がありません")).toBeVisible();
});
