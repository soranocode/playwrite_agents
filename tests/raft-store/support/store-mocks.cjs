const fs = require('node:fs');
const path = require('node:path');

const STORE_URL = 'https://rafthub.survivalgamesstudio.com/ru/store';
const API_PATH = '/hub/v1/websites/rafthub.survivalgamesstudio.com';
const PLAYER_ID = 'T:_f7ec91e010311a141dd130efa2db3376';
const TOKEN = 'mock-playwright-token';
const USER = { id: 'test-player', player_id: PLAYER_ID, name: 'Playwright Buyer', country: 'DE' };
const COMMIT = '26970a036cfa735d9691d0e668a6a1d781cbc23790608c53ceb3897b6f62cce6';
const CLEAR = '26f903866419702f2d488c6303862289ac03b4561838ef03c74ccb461bf4ddc2';
const readFixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, `${name}.json`), 'utf8'));
const successfulOrder = (orderId = 'test-order') => ({ status: 201, body: { order_id: orderId, checkout_url: `https://checkout.playwright.invalid/${orderId}`, use_checkout_sdk: false } });

// The live HTML and JS execute unchanged; only network contracts are replaced.
class StoreMocks {
  constructor(page) {
    this.page = page;
    this.playerId = PLAYER_ID;
    this.orders = [];
    this.authRequests = [];
    this.checkoutRequests = [];
    this.sessionCommits = 0;
    this.sessionClears = 0;
    this.blocked = [];
    this.unexpectedApi = [];
    this.response = successfulOrder();
    this.publicReads = {
      '/items': readFixture('catalog'),
      '/sections': readFixture('sections'),
      '/item_categories': readFixture('categories'),
      '/daily_rewards': readFixture('daily-rewards'),
      '/loyalty': readFixture('loyalty'),
    };
  }

  respondWith(response) { this.response = response; }

  async install() {
    const context = this.page.context();
    // No mock credential may reach a real WebSocket server.
    await context.routeWebSocket('**/*', socket => socket.close());
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      const json = (body, status = 200, headers = {}) => route.fulfill({ status, json: body, headers });
      if (url.hostname === 'checkout.playwright.invalid') {
        if (!request.isNavigationRequest()) return route.fulfill({ status: 204 });
        this.checkoutRequests.push(request.url());
        return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Checkout intercepted</title><p>Checkout intercepted</p>' });
      }
      // Fail closed for every actual payment destination (including SDK assets).
      if (/^(pay|checkout|payments?)\./.test(url.hostname) || /(?:stripe|adyen|paypal|braintree)/.test(url.hostname)) {
        this.blocked.push(request.url());
        return route.abort('blockedbyclient');
      }
      const isApi = ['hub-api.aghanim.com', 'hub-api-global.aghanim.com'].includes(url.hostname);
      if (isApi && url.pathname.startsWith(API_PATH)) {
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
        if (method === 'POST' && url.pathname.endsWith(COMMIT)) {
          this.sessionCommits++;
          return json({ result: null, context: {} });
        }
        if (method === 'POST' && url.pathname.endsWith(CLEAR)) {
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
    return this.page.locator('[data-card-item-id="itm_eFCPSOEuVEw"]').getByTestId('buy-button');
  }

  async open() {
    await this.page.goto(STORE_URL, { waitUntil: 'domcontentloaded' });
    await this.buyButton().waitFor();
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

module.exports = { StoreMocks, successfulOrder, STORE_URL, PLAYER_ID, TOKEN };
