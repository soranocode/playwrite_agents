// spec: specs/raft-store-test-plan.md
// seed: seed.spec.ts
import { test, expect } from './support/store-fixture';

test.describe('Создание заказа и обработка статусов HTTP', () => {
  test('06. HTTP 500: ошибка сервера создания заказа', async ({ store, page }) => {
    // 1. POST orders вернуть 500, авторизоваться и купить Собаку.
    store.respondWith({ status: 500, body: { detail: 'store_test_error' } });
    await store.open();
    await store.buyAsGuest();
    await expect(page.locator('[data-sonner-toast]')).toContainText('Что-то пошло не так. Попробуйте, пожалуйста, позже.');

    // 2. Проверить магазин после ответа.
    await store.expectRecovered();
    await store.expectOrder(1);
  });
});
