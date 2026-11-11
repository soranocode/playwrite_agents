// spec: specs/raft-store-test-plan.md
// seed: seed.spec.ts
import { test, expect } from './support/store-fixture';

test.describe('Создание заказа и обработка статусов HTTP', () => {
  test('04. HTTP 401: истёкшая сессия при покупке', async ({ store, page }) => {
    // 1. Покупка с mock bearer token получает 401, session clear и reload перехвачены.
    store.respondWith({ status: 401, body: { detail: 'Not Authenticated' } });
    await store.open();
    await store.login();
    await Promise.all([
      page.waitForEvent('framenavigated', frame => frame === page.mainFrame()),
      store.buyButton().click(),
    ]);
    // framenavigated marks document commit; module scripts may still be loading.
    // Wait for the new document before starting the UI assertion timeout.
    await page.waitForLoadState('domcontentloaded');
    await expect.poll(() => store.sessionClears).toBe(1);

    // 2. После reload покупка снова требует входа и не создаёт второй заказ.
    await store.waitForCatalog();
    await expect(store.buyButton()).toBeEnabled();
    await store.buyButton().click();
    await expect(page.getByPlaceholder('Введите идентификатор пользователя')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
    await store.expectOrder(1);
    expect(store.authRequests).toHaveLength(1);
    expect(store.checkoutRequests).toHaveLength(0);
    expect(store.sessionCommits).toBe(1);
  });
});
