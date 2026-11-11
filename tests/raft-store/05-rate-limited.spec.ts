// spec: specs/raft-store-test-plan.md
// seed: seed.spec.ts
import { test, expect } from './support/store-fixture';

test.describe('Создание заказа и обработка статусов HTTP', () => {
  test('05. HTTP 429: ограничение частоты покупок', async ({ store, page }) => {
    // 1. Вернуть 429 и Retry-After, войти и нажать покупку.
    store.respondWith({ status: 429, headers: { 'retry-after': '60' }, body: { detail: 'rate_limit_exceeded' } });
    await store.open();
    await store.buyAsGuest();
    await expect(page.locator('[data-sonner-toast]')).toContainText('Что-то пошло не так. Попробуйте, пожалуйста, позже.');

    // 2. После обработки ответа кнопка доступна, заказ не повторён, checkout не открыт.
    await store.expectRecovered();
    await store.expectOrder(1);
  });
});
