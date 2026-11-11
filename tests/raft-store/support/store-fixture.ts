import { test as base, expect } from '@playwright/test';
import { StoreMocks, successfulOrder, TOKEN } from './store-mocks.cjs';

class Store extends StoreMocks {
  async expectOrder(count: number) {
    await expect.poll(() => this.orders.length).toBe(count);
    for (const order of this.orders) {
      expect(order.body).toMatchObject({
        item_id: 'itm_eFCPSOEuVEw', store_item_id: 'stm_eFYprhpYTrh', locale: 'ru',
        event_info: { event_name: 'buy_click', event_data: 'pet_dog_labrador_web', locale_current: 'ru' },
      });
      expect(order.headers.authorization).toBe(`Bearer ${TOKEN}`);
    }
  }

  async expectRecovered() {
    await expect(this.page).toHaveURL('https://rafthub.survivalgamesstudio.com/ru/store');
    await expect(this.buyButton()).toBeEnabled();
    expect(this.checkoutRequests).toHaveLength(0);
  }
}

export const test = base.extend<{ store: Store }>({
  serviceWorkers: 'block',
  store: async ({ page }, use) => {
    const store = new Store(page);
    await store.install();
    await use(store);
    expect(store.unexpectedApi, 'All API calls must have explicit mock responses').toEqual([]);
  },
});

export { expect, successfulOrder };
