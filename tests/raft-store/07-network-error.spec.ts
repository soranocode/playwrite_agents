// spec: specs/raft-store-test-plan.md
// seed: seed.spec.ts
import { test, expect } from './support/store-fixture';

test.describe('Создание заказа и обработка статусов HTTP', () => {
  test('07. Сетевая ошибка создания заказа', async ({ store, page }) => {
    // 1. После mock входа оборвать POST orders до отправки в backend.
    store.respondWith({ abort: true });
    await store.open();
    const [failed] = await Promise.all([
      page.waitForEvent('requestfailed', request => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/orders')),
      store.buyAsGuest(),
    ]);
    expect(failed.failure()?.errorText).toContain('ERR_CONNECTION_FAILED');

    // 2. Ошибка видна, магазин доступен, checkout не открыт и повторного заказа нет.
    await expect(page.locator('[data-sonner-toast]')).toContainText('Что-то пошло не так. Попробуйте, пожалуйста, позже.');
    await store.expectRecovered();
    await store.expectOrder(1);
  });
});
