// spec: specs/raft-store-test-plan.md
// seed: seed.spec.ts
import { test, expect, successfulOrder, CHECKOUT_URL } from './support/store-fixture';

test.describe('Создание заказа и обработка статусов HTTP', () => {
  test('02. HTTP 201: корректный заказ передаётся в checkout', async ({ store, page }) => {
    // 1. Подменить успешный вход и POST orders, открыть магазин и купить Собаку.
    store.respondWith(successfulOrder());
    await store.open();
    await store.buyAsGuest();
    await store.expectOrder(1);

    // 2. Дождаться перехваченной navigation на checkout stub.
    await expect(page).toHaveURL(CHECKOUT_URL);
    expect(store.checkoutRequests).toHaveLength(1);
    expect(store.authRequests).toEqual([{ user_id: store.playerId }]);
  });
});
