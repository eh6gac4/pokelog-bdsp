import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("party: empty state and meta persistence", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("メンバー未登録")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText("0 / 6 体")).toBeVisible();

  // Party name input: placeholder 旅パ名
  const nameInput = page.getByPlaceholder("旅パ名");
  await nameInput.fill("クリア後の旅パ");

  // Version select -> シャイニングパール (value sp)
  const versionSelect = page.locator("select");
  await versionSelect.selectOption("sp");

  await page.reload();

  await expect(page.getByPlaceholder("旅パ名")).toHaveValue("クリア後の旅パ", {
    timeout: 15000,
  });
  await expect(page.locator("select")).toHaveValue("sp");
});

test("party: add 6 members up to cap then reset", async ({ page }) => {
  // Accept the reset confirm dialog (party will be non-empty).
  page.on("dialog", (d) => d.accept());

  await page.goto("/");
  await expect(page.getByText("メンバー未登録")).toBeVisible({
    timeout: 15000,
  });

  for (let i = 1; i <= 6; i++) {
    await page.getByRole("button", { name: "+ メンバー追加" }).click();
    await expect(
      page.getByRole("heading", { name: "メンバーを追加" })
    ).toBeVisible();

    // 新規入力 tab is the default; ensure it's selected.
    await page.getByRole("button", { name: "新規入力" }).click();

    await page.getByPlaceholder("ポッチャマ").fill(`ポケモン${i}`);
    await page.getByRole("button", { name: "追加", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "メンバーを追加" })
    ).toBeHidden();
    await expect(page.getByText(`${i} / 6 体`)).toBeVisible();
  }

  await expect(page.getByText("6 / 6 体")).toBeVisible();
  // Cap reached: add button no longer rendered.
  await expect(
    page.getByRole("button", { name: "+ メンバー追加" })
  ).toHaveCount(0);

  // Reset flow
  await page.getByRole("button", { name: "リセット" }).click();
  await expect(page.getByText("メンバー未登録")).toBeVisible();
  await expect(page.getByText("0 / 6 体")).toBeVisible();
});

test("party: set 4 moves on a member and persist across reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("メンバー未登録")).toBeVisible({
    timeout: 15000,
  });

  await page.getByRole("button", { name: "+ メンバー追加" }).click();
  await expect(
    page.getByRole("heading", { name: "メンバーを追加" })
  ).toBeVisible();
  await page.getByRole("button", { name: "新規入力" }).click();

  // 種族名を確定すると speciesId が解決され、わざが種族の学習技 select になる。
  await page.getByPlaceholder("ポッチャマ").fill("ポッチャマ");

  // わざ 1..4 を選択（重複除外により index:1 でも各スロット別の技になる）。
  const chosen: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const sel = page.getByLabel(`わざ${i}`);
    await expect(sel).toBeVisible();
    await sel.selectOption({ index: 1 });
    chosen.push(await sel.inputValue());
  }
  expect(new Set(chosen).size).toBe(4); // 4 つとも別の技

  await page.getByRole("button", { name: "追加", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "メンバーを追加" })
  ).toBeHidden();

  // カードを展開して反映を確認
  await page.getByRole("button", { name: /ポッチャマ/ }).click();
  for (let i = 1; i <= 4; i++) {
    await expect(page.getByLabel(`わざ${i}`)).toHaveValue(chosen[i - 1]);
  }

  // リロードしても永続している
  await page.reload();
  await expect(page.getByText("1 / 6 体")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /ポッチャマ/ }).click();
  for (let i = 1; i <= 4; i++) {
    await expect(page.getByLabel(`わざ${i}`)).toHaveValue(chosen[i - 1]);
  }
});

test("navigation between party and EV log", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("メンバー未登録")).toBeVisible({
    timeout: 15000,
  });

  // / -> /ev via "← 努力値ログ" link
  await page.getByRole("link", { name: "← 努力値ログ" }).click();
  await expect(page).toHaveURL(/\/ev$/);
  await expect(
    page.getByRole("heading", { name: "pokelog-bdsp" })
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("まだ登録がありません")).toBeVisible();

  // /ev -> / via "旅パ →" link
  await page.getByRole("link", { name: "旅パ →" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "旅パ" })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText("メンバー未登録")).toBeVisible();
});
