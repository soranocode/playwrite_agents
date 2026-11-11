// spec: specs/raft-store-test-plan.md
// seed: seed.spec.ts
import { test, expect, successfulOrder, CHECKOUT_URL } from './support/store-fixture';

test.describe('Создание заказа и обработка статусов HTTP', () => {
  test('08. Медленный ответ: повторный клик не дублирует заказ', async ({ store, page }) => {
    // 1. После mock входа удержать ответ POST orders и нажать покупку.
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    store.respondWith(async () => { await pending; return successfulOrder(); });
    await store.open();
    await store.login();
    try {
      await Promise.all([
        page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/orders')),
        store.buyButton().click(),
      ]);
      await expect(store.buyButton()).toBeDisabled();

      // 2. Кликнуть по disabled-кнопке и нажать Enter, пока ответ удерживается.
      // locator.click() ждал бы enabled; mouse воспроизводит реальный клик без force.
      const bounds = await store.buyButton().boundingBox();
      expect(bounds, 'The disabled buy button stays on screen').not.toBeNull();
      await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
      await store.buyButton().press('Enter');
      expect(store.orders).toHaveLength(1);
      expect(store.checkoutRequests).toHaveLength(0);
    } finally {
      // 3. Освободить ответ: создаётся один переход в checkout.
      release();
    }
    await expect(page).toHaveURL(CHECKOUT_URL);
    await store.expectOrder(1);
    expect(store.checkoutRequests).toHaveLength(1);
  });
});
