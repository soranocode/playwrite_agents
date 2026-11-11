import { test, expect } from '@playwright/test';

const url = 'https://rafthub.survivalgamesstudio.com/ru/guides/about-raft-survival-ocean-nomad';

test('1. Страница отвечает и имеет заголовок вкладки', async ({ page }) => {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/О Raft Survival: Ocean Nomad/);
});

test('2. Основной заголовок статьи виден', async ({ page }) => {
  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1, name: 'О Raft Survival: Ocean Nomad' })).toBeVisible();
});

test('3. Основные разделы статьи видны', async ({ page }) => {
  await page.goto(url);
  for (const name of [/После Катастрофы/, /Геймплей: Выживание/, /Цель: Не просто выживание/, /Все начинается здесь/]) {
    await expect(page.getByRole('heading', { name })).toBeVisible();
  }
});

test('4. Изображение статьи загружено', async ({ page }) => {
  await page.goto(url);
  const image = page.getByRole('img', { name: 'О Raft Survival: Ocean Nomad' });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});

test('5. Переход к списку руководств', async ({ page }) => {
  await page.goto(url);
  await page.getByRole('link', { name: 'Руководства', exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/guides\/?(?:\?.*)?$/);
});

test('6. Переход на главную через логотип', async ({ page }) => {
  await page.goto(url);
  await page.getByRole('link', { name: /Raft® - Симулятор выживания/ }).click();
  await expect(page).toHaveURL(/^https:\/\/rafthub\.survivalgamesstudio\.com\/(?:ru\/?(?:\?.*)?)?$/);
});

test('7. Ссылка App Store ведёт на страницу игры', async ({ page }) => {
  await page.goto(url);
  const link = page.getByRole('link', { name: 'App Store', exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /^https:\/\/apps\.apple\.com\/.*\/id1326046015/);
});

test('8. Ссылка Google Play ведёт на страницу игры', async ({ page }) => {
  await page.goto(url);
  const link = page.getByRole('link', { name: 'Google Play', exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /^https:\/\/play\.google\.com\/store\/apps\/details\?id=ocean\.nomad\.survival\.simulator/);
});

test('9. Страница помещается на мобильном экране', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1, name: 'О Raft Survival: Ocean Nomad' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('10. Переключатель языка доступен', async ({ page }) => {
  await page.goto(url);
  const switcher = page.getByRole('combobox');
  await expect(switcher).toBeVisible();
  await switcher.click();
  await expect(page.getByText('English', { exact: true })).toBeVisible();
});
