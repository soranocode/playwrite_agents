// spec: specs/raft-store-test-plan.md
// seed: seed.spec.ts
import { test, expect } from './support/store-fixture';

test.describe('Создание заказа и обработка статусов HTTP', () => {
  test('03. HTTP 400: заказу нужен ID игрока', async ({ store, page }) => {
    // 1. Вернуть 400 user_player_id_required, войти mock-пользователем и купить Собаку.
    store.respondWith({ status: 400, body: { detail: 'user_player_id_required' } });
    await page.context().route('**/play', async route => {
      if (route.request().isNavigationRequest()) {
        await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Game destination intercepted</title>' });
      } else {
        await route.fallback();
      }
    });
    await store.open();
    await store.buyAsGuest();
    const toast = page.locator('[data-sonner-toast]');
    await expect(toast).toContainText('Пожалуйста, завершите регистрацию, начав игру.');
    const play = toast.getByRole('button', { name: 'Играть', exact: true });
    await expect(play).toBeVisible();

    // 2. Ошибка оставляет магазин доступным без перехода в checkout.
    await store.expectRecovered();
    await store.expectOrder(1);

    // 3. Действие «Играть» ведёт в /play; документ перехвачен без запуска игры.
    await play.click();
    await expect(page).toHaveURL('https://rafthub.survivalgamesstudio.com/play');
    expect(store.checkoutRequests).toHaveLength(0);
    expect(store.orders).toHaveLength(1);
  });
});
