// spec: specs/raft-store-test-plan.md
// seed: seed.spec.ts
import { test, expect } from './support/store-fixture';

test.describe('Создание заказа и обработка статусов HTTP', () => {
  test('01. Гость не может отправить покупку с пустым ID', async ({ store, page }) => {
    // 1. Открыть магазин с пустой сессией, выбрать Собаку и нажать цену.
    await store.open();
    await store.buyButton().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(store.orders).toHaveLength(0);

    // 2. Оставить ID пустым и нажать кнопку входа.
    await page.getByTestId('login-submit-button').click();
    await expect(page.locator('[data-sonner-toast]')).toContainText('Введите идентификатор пользователя');
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(store.authRequests).toHaveLength(0);
    expect(store.orders).toHaveLength(0);

    // 3. Закрыть диалог: магазин доступен, заказ и checkout не созданы.
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await store.expectRecovered();
    await store.expectOrder(0);
  });
});
