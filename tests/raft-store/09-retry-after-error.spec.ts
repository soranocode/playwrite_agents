// spec: specs/raft-store-test-plan.md
// seed: seed.spec.ts
import { test, expect, successfulOrder, CHECKOUT_URL } from './support/store-fixture';

test.describe('Создание заказа и обработка статусов HTTP', () => {
  test('09. Повтор покупки после HTTP 500', async ({ store, page }) => {
    // 1. Первый заказ получает 500: ошибка видна, кнопка покупки восстановлена.
    store.respondWith(count => count === 1 ? { status: 500, body: { detail: 'store_test_error' } } : successfulOrder());
    await store.open();
    await store.login();
    await store.buyButton().click();
    await expect(page.locator('[data-sonner-toast]')).toContainText('Что-то пошло не так. Попробуйте, пожалуйста, позже.');
    await store.expectRecovered();
    await store.expectOrder(1);

    // 2. Нажать покупку ещё раз вручную, сохранив выбранный товар.
    await store.buyButton().click();

    // 3. Только второй ответ ведёт в checkout: всего два заказа и один переход.
    await expect(page).toHaveURL(CHECKOUT_URL);
    await store.expectOrder(2);
    expect(store.checkoutRequests).toHaveLength(1);
    expect(store.authRequests).toHaveLength(1);
  });
});
