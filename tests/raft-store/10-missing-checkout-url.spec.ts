// spec: specs/raft-store-test-plan.md
// seed: seed.spec.ts
import { test, expect } from './support/store-fixture';

test.describe('Создание заказа и обработка статусов HTTP', () => {
  test('10. HTTP 200 без checkout_url: неполный успешный ответ', async ({ store, page }) => {
    // 1. Успешный HTTP ответ намеренно не содержит checkout_url.
    store.respondWith({ status: 200, body: { order_id: 'test-order-no-url', use_checkout_sdk: false } });
    await store.open();
    await store.buyAsGuest();
    await expect(page.locator('[data-sonner-toast]')).toContainText('Что-то пошло не так. Попробуйте, пожалуйста, позже.');

    // 2. Ошибка показана, магазин и кнопка восстановлены, некорректного перехода нет.
    await store.expectRecovered();
    await store.expectOrder(1);
  });
});
