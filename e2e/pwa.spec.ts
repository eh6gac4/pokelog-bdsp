import { test, expect } from "@playwright/test";

test("pwa: manifest / apple meta / theme-color / sw が配信される", async ({
  page,
  request,
}) => {
  await page.goto("/");

  // <link rel="manifest"> が注入されている
  const manifestLink = page.locator('link[rel="manifest"]');
  await expect(manifestLink).toHaveCount(1);
  const href = await manifestLink.getAttribute("href");
  expect(href).toBeTruthy();

  // manifest 本体の内容
  const manifestRes = await request.get(href as string);
  expect(manifestRes.ok()).toBeTruthy();
  const manifest = await manifestRes.json();
  expect(manifest.name).toBe("ポケログBDSP");
  expect(manifest.short_name).toBe("ポケログBDSP");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(Array.isArray(manifest.icons)).toBe(true);
  expect(manifest.icons.length).toBeGreaterThan(0);

  // iOS 用 apple-touch-icon と apple web app メタ
  await expect(page.locator('link[rel="apple-touch-icon"]')).not.toHaveCount(0);
  await expect(
    page.locator('meta[name="apple-mobile-web-app-title"]'),
  ).toHaveAttribute("content", "ポケログBDSP");

  // theme-color（light/dark の media 付き）
  await expect(page.locator('meta[name="theme-color"]')).not.toHaveCount(0);

  // icon.svg が配信される
  const iconRes = await request.get("/icon.svg");
  expect(iconRes.ok()).toBeTruthy();
  expect(iconRes.headers()["content-type"]).toContain("image/svg+xml");

  // service worker が JS として配信される
  const swRes = await request.get("/sw.js");
  expect(swRes.ok()).toBeTruthy();
  expect(swRes.headers()["content-type"]).toContain("javascript");
});
