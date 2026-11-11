import { test as base, expect } from '@playwright/test';
import { StoreMocks, ITEM, STORE_URL, TOKEN } from './store-mocks';

class Store extends StoreMocks {
  expectedOrderCount?: number;

  async expectOrder(count: number) {
    await expect.poll(() => this.orders.length).toBe(count);
    for (const order of this.orders) {
      expect(order.body).toMatchObject({
        item_id: ITEM.id, store_item_id: ITEM.storeId, locale: 'ru',
        event_info: { event_name: 'buy_click', event_data: ITEM.sku, locale_current: 'ru' },
      });
      expect(order.headers.authorization).toBe(`Bearer ${TOKEN}`);
    }
    this.expectedOrderCount = count;
  }

  async expectRecovered() {
    await expect(this.page).toHaveURL(STORE_URL);
    await expect(this.buyButton()).toBeEnabled();
    expect(this.checkoutRequests).toHaveLength(0);
  }
}

export const test = base.extend<{ store: Store }>({
  serviceWorkers: 'block',
  store: async ({ page }, use, testInfo) => {
    const store = new Store(page);
    await store.install();
    try {
      await use(store);
    } finally {
      await testInfo.attach('store-network', {
        contentType: 'application/json',
        body: JSON.stringify({
          orders: store.orders, authRequests: store.authRequests, checkoutRequests: store.checkoutRequests,
          sessionCommits: store.sessionCommits, sessionClears: store.sessionClears,
          blocked: store.blocked, unexpectedApi: store.unexpectedApi,
        }, null, 2),
      });
      expect(store.unexpectedApi, 'All API calls and payment destinations must have explicit mocks').toEqual([]);
      if (store.expectedOrderCount !== undefined) {
        expect(store.orders, 'No extra orders before the scenario finished').toHaveLength(store.expectedOrderCount);
      }
    }
  },
});

export { expect };
export { successfulOrder, CHECKOUT_URL } from './store-mocks';
