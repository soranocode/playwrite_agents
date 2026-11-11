import type { Page } from '@playwright/test';
import catalog from './catalog.json';
import sections from './sections.json';
import categories from './categories.json';
import dailyRewards from './daily-rewards.json';
import loyalty from './loyalty.json';

export const STORE_URL = 'https://rafthub.survivalgamesstudio.com/ru/store';
const API_PATH = '/hub/v1/websites/rafthub.survivalgamesstudio.com';
export const PLAYER_ID = 'T:_f7ec91e010311a141dd130efa2db3376';
export const TOKEN = 'mock-playwright-token';
export const ITEM = { id: 'itm_eFCPSOEuVEw', storeId: 'stm_eFYprhpYTrh', sku: 'pet_dog_labrador_web' };
export const CHECKOUT_URL = 'https://checkout.playwright.invalid/test-order?mode=dark';
const USER = { id: 'test-player', player_id: PLAYER_ID, name: 'Playwright Buyer', country: 'DE' };
const COMMIT = '26970a036cfa735d9691d0e668a6a1d781cbc23790608c53ceb3897b6f62cce6';
const CLEAR = '26f903866419702f2d488c6303862289ac03b4561838ef03c74ccb461bf4ddc2';
type JsonResponse = { status: number; body: unknown; headers?: Record<string, string>; abort?: false };
type OrderResponse = JsonResponse | { abort: true };
type OrderResponder = OrderResponse | ((count: number) => OrderResponse | Promise<OrderResponse>);
type RecordedOrder = { body: Record<string, unknown>; headers: Record<string, string> };

export const successfulOrder = (orderId = 'test-order'): JsonResponse => ({ status: 201, body: { order_id: orderId, checkout_url: `https://checkout.playwright.invalid/${orderId}`, use_checkout_sdk: false } });

// The live HTML and JS execute unchanged; only network contracts are replaced.
export class StoreMocks {
  readonly playerId = PLAYER_ID;
  readonly orders: RecordedOrder[] = [];
  readonly authRequests: unknown[] = [];
  readonly checkoutRequests: string[] = [];
  sessionCommits = 0;
  sessionClears = 0;
  readonly blocked: string[] = [];
  readonly unexpectedApi: string[] = [];
  private response: OrderResponder = successfulOrder();
  private readonly publicReads: Record<string, unknown> = {
    '/items': catalog, '/sections': sections, '/item_categories': categories,
    '/daily_rewards': dailyRewards, '/loyalty': loyalty,
  };

  constructor(readonly page: Page) {}

  respondWith(response: OrderResponder) { this.response = response; }

  async install() {
    const context = this.page.context();
    // No mock credential may reach a real WebSocket server.
    await context.routeWebSocket('**/*', socket => socket.close());
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => route.fulfill({ status, json: body, headers });
      if (url.hostname === 'checkout.playwright.invalid') {
        if (!request.isNavigationRequest()) return route.fulfill({ status: 204 });
        this.checkoutRequests.push(request.url());
        return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Checkout intercepted</title><p>Checkout intercepted</p>' });
      }
      // Block known payment hosts, including SDK assets, and report contract drift.
      if (/^(pay|checkout|payments?)\./.test(url.hostname) || /(?:stripe|adyen|paypal|braintree)/.test(url.hostname)) {
        this.blocked.push(request.url());
        this.unexpectedApi.push(`Unexpected payment destination: ${request.url()}`);
        return route.abort('blockedbyclient');
      }
      const isApi = ['hub-api.aghanim.com', 'hub-api-global.aghanim.com'].includes(url.hostname);
      if (isApi) {
        if (!url.pathname.startsWith(`${API_PATH}/`)) {
          this.unexpectedApi.push(`${method} ${url.origin}${url.pathname}`);
          return route.abort('blockedbyclient');
        }
        const endpoint = url.pathname.slice(API_PATH.length);
        if (method === 'OPTIONS') return route.fulfill({ status: 204 });
        if (method === 'POST' && endpoint === '/auth/authorize_user_id') {
          this.authRequests.push(request.postDataJSON());
          return json({ token: TOKEN, user: USER, is_registration: false });
        }
        if (method === 'POST' && endpoint === '/orders') {
          this.orders.push({ body: request.postDataJSON(), headers: request.headers() });
          const response = typeof this.response === 'function' ? await this.response(this.orders.length) : this.response;
          if (response.abort) return route.abort('connectionfailed');
          return json(response.body, response.status, response.headers);
        }
        if (method === 'POST' && endpoint === '/activities/visit_page') {
          return route.fulfill({ status: 204 });
        }
        if (method === 'GET') {
          if (endpoint in this.publicReads) return json(this.publicReads[endpoint]);
          if (endpoint === '/user/me') return json(USER);
          if (['/user_communications', '/user/virtual_currencies', '/user/reward_points', '/orders/unhandled_paid'].includes(endpoint)) return json([]);
        }
        this.unexpectedApi.push(`${method} ${endpoint}`);
        return route.abort('blockedbyclient');
      }
      if (url.hostname === 'rafthub.survivalgamesstudio.com' && url.pathname.startsWith('/_serverFn/')) {
        if (method === 'POST' && url.pathname === `/_serverFn/${COMMIT}`) {
          this.sessionCommits++;
          return json({ result: null, context: {} });
        }
        if (method === 'POST' && url.pathname === `/_serverFn/${CLEAR}`) {
          this.sessionClears++;
          return json({ result: null, context: {} });
        }
        // No fake token is committed to the production session.
        if (method !== 'GET') {
          this.unexpectedApi.push(`${method} ${url.pathname}`);
          return route.abort('blockedbyclient');
        }
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method) || request.headers().authorization) {
        // Analytics and any new, unknown mutation are also blocked by default.
        this.blocked.push(`${method} ${request.url()}`);
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
  }

  buyButton() {
    return this.page.locator(`[data-card-item-id="${ITEM.id}"]`).getByTestId('buy-button');
  }

  async waitForCatalog() {
    // The catalog mounts on the client, including after a full document reload.
    await this.buyButton().waitFor();
  }

  async open() {
    const response = await this.page.goto(STORE_URL, { waitUntil: 'domcontentloaded' });
    if (!response?.ok()) throw new Error(`Store document failed: HTTP ${response?.status() ?? 'no response'}`);
    await this.waitForCatalog();
    const decline = this.page.getByRole('button', { name: 'Decline', exact: true });
    if (await decline.isVisible()) await decline.click();
  }

  async buyAsGuest() {
    await this.buyButton().click();
    await this.page.getByPlaceholder('Введите идентификатор пользователя').fill(PLAYER_ID);
    await this.page.getByTestId('login-submit-button').click();
  }

  async login() {
    await this.page.getByRole('button', { name: 'Войти', exact: true }).click();
    await this.page.getByPlaceholder('Введите идентификатор пользователя').fill(PLAYER_ID);
    await this.page.getByTestId('login-submit-button').click();
    await this.page.getByText('Playwright Buyer', { exact: true }).waitFor();
  }
}
