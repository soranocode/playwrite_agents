import { test, expect, type Page } from '@playwright/test';

const url = 'https://rafthub.survivalgamesstudio.com/ru/guides/about-raft-survival-ocean-nomad';

async function openGuide(page: Page) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), 'Guide document responds successfully').toBe(200);
}

async function waitForClientLayout(page: Page) {
  // Sidebar navigation is absent from SSR and mounts with the client layout.
  // It can be hidden by the mobile layout, so attachment is the readiness signal.
  await page.getByRole('link', { name: 'Магазин', exact: true, includeHidden: true }).waitFor({ state: 'attached' });
}

test('1. Страница отвечает и имеет заголовок вкладки', async ({ page }) => {
  await openGuide(page);
  await expect(page).toHaveTitle(/О Raft Survival: Ocean Nomad/);
});

test('2. Основной заголовок статьи виден', async ({ page }) => {
  await openGuide(page);
  await expect(page.getByRole('heading', { level: 1, name: 'О Raft Survival: Ocean Nomad' })).toBeVisible();
});

test('3. Основные разделы статьи видны', async ({ page }) => {
  await openGuide(page);
  for (const name of [/После Катастрофы/, /Геймплей: Выживание/, /Цель: Не просто выживание/, /Все начинается здесь/]) {
    await expect(page.getByRole('heading', { name })).toBeVisible();
  }
});

test('4. Изображение статьи загружено', async ({ page }) => {
  await openGuide(page);
  const image = page.getByRole('img', { name: 'О Raft Survival: Ocean Nomad', exact: true });
  // The article image mounts on the client and uses loading="lazy".
  await image.waitFor({ state: 'attached' });
  await image.scrollIntoViewIfNeeded();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});

test('5. Переход к списку руководств', async ({ page }) => {
  await openGuide(page);
  await waitForClientLayout(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Руководства', exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/guides\/?(?:\?.*)?$/);
});

test('6. Переход на главную через логотип', async ({ page }) => {
  await openGuide(page);
  await waitForClientLayout(page);
  await page.getByRole('link', { name: /Raft® - Симулятор выживания/ }).click();
  await expect(page).toHaveURL(/^https:\/\/rafthub\.survivalgamesstudio\.com\/(?:ru\/?(?:\?.*)?)?$/);
});

test('7. Ссылка App Store ведёт на страницу игры', async ({ page }) => {
  await openGuide(page);
  const link = page.getByRole('link', { name: 'App Store', exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /^https:\/\/apps\.apple\.com\/.*\/id1326046015/);
});

test('8. Ссылка Google Play ведёт на страницу игры', async ({ page }) => {
  await openGuide(page);
  const link = page.getByRole('link', { name: 'Google Play', exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /^https:\/\/play\.google\.com\/store\/apps\/details\?id=ocean\.nomad\.survival\.simulator/);
});

test('9. Страница помещается на мобильном экране', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openGuide(page);
  await waitForClientLayout(page);
  await expect(page.getByRole('heading', { level: 1, name: 'О Raft Survival: Ocean Nomad' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), {
    message: 'The article fits the mobile viewport without horizontal overflow',
  }).toBe(true);
});

test('10. Переключатель языка доступен', async ({ page }) => {
  await openGuide(page);
  // The server renders the trigger before attaching its event handlers.
  await waitForClientLayout(page);
  const switcher = page.getByTestId('select');
  await expect(switcher).toBeVisible();
  await switcher.click();
  await expect(switcher).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('listbox').getByRole('option', { name: /English/ })).toBeVisible();
});
