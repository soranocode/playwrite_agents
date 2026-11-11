// spec: specs/raft-store-test-plan.md
// seed: seed.spec.ts
import { test, expect, successfulOrder } from './support/store-fixture';

test.describe('Создание заказа и обработка статусов HTTP', () => {
  test('08. Медленный ответ: повторный клик не дублирует заказ', async ({ store, page }) => {
    // 1. После mock входа удержать ответ POST orders и нажать покупку.
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    store.respondWith(async () => { await pending; return successfulOrder(); });
    await store.open();
    await store.login();
    const requested = page.waitForRequest(request => request.url().endsWith('/orders') && request.method() === 'POST');
    await store.buyButton().click();
    await requested;
    try {
      await expect(store.buyButton()).toBeDisabled();

      // 2. Повторить активацию клавишей Enter во время ожидания ответа.
      await store.buyButton().press('Enter');
      expect(store.orders).toHaveLength(1);
      expect(store.checkoutRequests).toHaveLength(0);
    } finally {
      // 3. Освободить ответ: создаётся один переход в checkout.
      release();
    }
    await expect(page).toHaveURL('https://checkout.playwright.invalid/test-order?mode=dark');
    await store.expectOrder(1);
    expect(store.checkoutRequests).toHaveLength(1);
  });
});
