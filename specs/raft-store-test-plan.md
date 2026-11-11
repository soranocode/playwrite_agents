# Магазин Raft: 10 сценариев покупки с сетевыми подменами

## Application Overview

Цель: проверить реальный frontend https://rafthub.survivalgamesstudio.com/ru/store в Chromium, ровно 10 независимых сценариев создания покупки, ошибок и повторов, с сетевыми подменами. Исследовано 11.11.2026 через planner_setup_page и browser_* MCP; seed.spec.ts. Реальные платежи и заказы не создавались: мутации hub-api abort/fulfill.

ОБЩИЕ ПРЕДУСЛОВИЯ КАЖДОГО КЕЙСА: новый browser context без cookies/storage; все маршруты установлены ДО goto. Реальный HTML/JS магазина, реальная форма входа/кнопка покупки. Подменять JSON API, а не рисовать свою страницу успеха. Fail-closed: разрешены только перечисленные mock-мутации, остальные POST/PUT/PATCH/DELETE к hub/payment API abort; checkout URL только https://checkout.playwright.invalid/<order_id>, navigation fulfill минимальной нейтральной заглушкой, реальный pay.aghanim.com заблокирован. serviceWorkers block. Фикстура каталога должна исходить из фактического GET items; фиксировать выбранный товар Собака (itm_eFCPSOEuVEw, stm_eFYprhpYTrh, SKU pet_dog_labrador_web), а не зависеть от геоцены.

ПОДТВЕРЖДЕННЫЙ КОНТРАКТ И АВТОРИЗАЦИЯ: API prefix https://hub-api.aghanim.com/hub/v1/websites/rafthub.survivalgamesstudio.com; GET /items?current_page_path=%2Fstore и /sections, категории на hub-api-global. POST /auth/authorize_user_id body {user_id,update_attributes?}; пользовательский ID для поля user_id: T:_f7ec91e010311a141dd130efa2db3376 (только mock, не отправлять в production); mock response {token:"mock-playwright-token",user:{id:"test-player",player_id:"T:_f7ec91e010311a141dd130efa2db3376",name:"Playwright Buyer",country:"DE"},is_registration:false}. Подтверждённый независимым прогоном стабильный вход: нажать верхнюю кнопку Войти, заполнить ID, отправить login-submit-button, дождаться профиля Playwright Buyer и затем инициировать покупку. Auth.setToken делает POST /_serverFn/26970a036cfa735d9691d0e668a6a1d781cbc23790608c53ceb3897b6f62cce6; подменить session commit и session clear (/26f903866419702f2d488c6303862289ac03b4561838ef03c74ccb461bf4ddc2) JSON {result:null,context:{}}. Защищённые GET /user/me возвращают mock user; /user_communications, /user/virtual_currencies, /user/reward_points и /orders/unhandled_paid возвращают []. До goto установить routeWebSocket с закрытием соединений. Эти подмены сохранили авторизацию и toast после ошибки заказа без SSR/context revalidation mocks. Неподменённые защищённые GET ранее получали 401 и запускали очистку сессии/reload. Не отправлять fake token в production API и не вызывать production session commit.

POST /orders body item_id,store_item_id,locale:"ru",event_info; необязательные поля datahouse_user_id,campaign_id,user_campaign_id,coupon_code,automation_job_id,ga4_client_id. Выбранный товар должен попасть в body без искажений; не сравнивать динамические analytics поля целиком. Успешный JSON {order_id,checkout_url,use_checkout_sdk:false} запускает redirect с mode (режим из реального website.config). SDK не тестируется. Ошибки читаются из response.data.detail (строка либо [{msg}]); useOrderErrorToast переводит detail, неизвестный detail -> Errors.unknown_error. HTTP401 с текущим bearer token ведёт к очистке session и reload. HTTP400 detail user_player_id_required имеет отдельную ветку toast + действие /play. Buy button в PurchaseDialog имеет data-testid=buy-button; login submit data-testid=login-submit-button; textbox placeholder Введите идентификатор пользователя; dialog Добро пожаловать в Raft® Survival - Ocean Nomad Hub; кнопка закрытия Закрыть. Цена зависит от страны; выбирать карточку по Собака, а не жёстко по 5,49 €.

ОГРАНИЧЕНИЯ: backend enum найден в реальном JS: created,captured,paid,canceled,refunded,refund_requested,reattempted,disputed. Известны GET /orders/{order_id}/status, /items, /purchase_result; cart settlement считает created/captured открытым заказом, paid очищает корзину, остальные закрывают сохранённый order_id. Но видимый экран результата оплаты и URL возврата/его polling при текущем публичном потоке не подтверждены. Эти 10 кейсов проверяют HTTP-статусы/состояния создания покупки, НЕ финансовое списание, доставку предметов, paid/refunded или платёжный SDK. Не выдумывать pending/failed как backend enum. Если ожидаемая защита от дублей или восстановление не работает, оставить тест падающим и описать дефект. Критерий для всех: перехваты реально сработали, никакая покупочная мутация не дошла в production, результат проверяется в реальном UI/навигации.

## Test Scenarios

### 1. Создание заказа и обработка статусов HTTP

**Seed:** `seed.spec.ts`

#### 1.1. 01. Гость не может отправить покупку с пустым ID

**File:** `tests/raft-store/01-empty-player-id.spec.ts`

**Steps:**
  1. Открыть магазин с пустой сессией, выбрать карточку Собака и нажать её цену.
    - expect: Открыт dialog входа с textbox ID и кнопкой Войти; POST orders ещё не отправлен.
  2. Оставить ID пустым, нажать login-submit-button.
    - expect: Форма остаётся открытой; нет POST authorize_user_id и orders; пользователь получает подсказку ввода ID.
  3. Закрыть dialog кнопкой Закрыть.
    - expect: Магазин доступен; ни одного заказа и перехода checkout нет.

#### 1.2. 02. HTTP 201: корректный заказ передаётся в checkout

**File:** `tests/raft-store/02-created-checkout.spec.ts`

**Steps:**
  1. Подменить успешный вход и POST orders ответом 201 с фиксированным order_id, checkout_url на checkout.playwright.invalid и use_checkout_sdk:false; открыть магазин, нажать покупку Собака, ввести T:_f7ec91e010311a141dd130efa2db3376 и войти.
    - expect: Ровно один POST orders; item_id/store_item_id выбранной Собаки, locale ru и событие buy_click соответствуют контракту; bearer mock token присутствует.
  2. Дождаться перехваченной navigation на checkout stub.
    - expect: URL соответствует checkout_url и содержит mode; нет запросов реальной оплаты; переход является передачей в checkout, а не подтверждением paid.

#### 1.3. 03. HTTP 400: заказу нужен ID игрока

**File:** `tests/raft-store/03-player-id-required.spec.ts`

**Steps:**
  1. Подменить POST orders ответом 400 {detail:'user_player_id_required'}, войти mock-пользователем и инициировать покупку Собака.
    - expect: Сработал ровно один mock POST; [data-sonner-toast] содержит «Пожалуйста, завершите регистрацию, начав игру.» и кнопку «Играть», предусмотренную useOrderErrorToast.
  2. Проверить адрес страницы и доступность магазина.
    - expect: Нет перехода checkout и подтверждения покупки; магазин и mock-профиль остаются доступны, пользователь может перейти в игру по действию уведомления.
  3. Нажать «Играть», заранее перехватив документ игры нейтральной заглушкой.
    - expect: Выполнен переход на https://rafthub.survivalgamesstudio.com/play, checkout не открыт, количество заказов остаётся один. Игра и её покупки не запускаются.

#### 1.4. 04. HTTP 401: истёкшая сессия при покупке

**File:** `tests/raft-store/04-expired-session.spec.ts`

**Steps:**
  1. Установить mock авторизацию с bearer token; POST orders вернуть 401 {detail:'Not Authenticated'}; clear-session serverFn тоже перехватить. После очистки загрузить настоящую SSR-страницу без сохранённой сессии.
    - expect: Покупка получила 401; вызвана подменённая очистка сессии и reload согласно реальному interceptor.
  2. После перезагрузки дождаться магазина и нажать цену товара.
    - expect: Показана форма входа; истёкший mock token не используется для повторной покупки; checkout не открыт; нет бесконечных reload или автоматических POST orders.

#### 1.5. 05. HTTP 429: ограничение частоты покупок

**File:** `tests/raft-store/05-rate-limited.spec.ts`

**Steps:**
  1. POST orders вернуть 429, Retry-After: 60, JSON {detail:'rate_limit_exceeded'} (контролируемый неизвестный код ошибки для ветки fallback); авторизоваться и нажать покупку.
    - expect: Показано общее сообщение ошибки, frontend остаётся в магазине, checkout не открыт.
  2. Дождаться завершения обработки ответа без дополнительного пользовательского клика.
    - expect: Кнопка покупки восстановлена; POST не повторяется автоматически. Не требовать countdown: его наличие в frontend не подтверждено.

#### 1.6. 06. HTTP 500: ошибка сервера создания заказа

**File:** `tests/raft-store/06-server-error.spec.ts`

**Steps:**
  1. POST orders вернуть 500 {detail:'store_test_error'}, авторизоваться и купить Собака.
    - expect: Общее сообщение ошибки реального UI; не появляется подтверждение успеха и не открывается checkout.
  2. Проверить магазин после ответа.
    - expect: Состояние loading завершено, кнопка покупки доступна; сделана одна попытка POST, ошибочный ответ не запускает фоновый повтор.

#### 1.7. 07. Сетевая ошибка создания заказа

**File:** `tests/raft-store/07-network-error.spec.ts`

**Steps:**
  1. После mock входа abort POST orders с connectionfailed.
    - expect: Запрос перехвачен и завершён сетевой ошибкой, не дошёл в backend.
  2. Дождаться обработки ошибки.
    - expect: Показано сообщение ошибки; frontend остаётся в магазине; покупка доступна снова, checkout не открыт; нет автоматического дублирования POST.

#### 1.8. 08. Медленный ответ: повторный клик не дублирует заказ

**File:** `tests/raft-store/08-no-duplicate-order.spec.ts`

**Steps:**
  1. После стабильного mock входа удержать response POST orders управляемым promise; нажать реальную кнопку покупки Собака.
    - expect: Зафиксирован один POST; loading/disabled состояние кнопки активно.
  2. Во время удержания ответа повторно активировать ту же кнопку через пользовательский click/keyboard, не force DOM и не invoke handler.
    - expect: Количество POST остаётся один; магазин не перешёл в checkout до ответа. При отсутствии защиты тест должен выявить дефект.
  3. Освободить ответ 201 с mock checkout_url.
    - expect: Ровно один переход в checkout stub, ровно один order; loading не остаётся навсегда.

#### 1.9. 09. Повтор покупки после HTTP 500

**File:** `tests/raft-store/09-retry-after-error.spec.ts`

**Steps:**
  1. Первый POST orders вернуть 500 с detail store_test_error, второй — 201 c checkout stub. Авторизоваться и сделать первую попытку.
    - expect: Первая попытка показала ошибку и осталась в магазине; кнопка восстановлена.
  2. Нажать покупку ещё раз вручную (при необходимости снова mock вход, если UI вернулся к гостю).
    - expect: Второй POST содержит те же выбранные item_id/store_item_id и locale, без автоматических лишних попыток.
  3. Дождаться ответа второй попытки.
    - expect: Выполнен единственный переход checkout только после второго ответа; общее число POST orders ровно два.

#### 1.10. 10. HTTP 200 без checkout_url: неполный успешный ответ

**File:** `tests/raft-store/10-missing-checkout-url.spec.ts`

**Steps:**
  1. POST orders вернуть 200 {order_id:'test-order-no-url',use_checkout_sdk:false}, намеренно без checkout_url; авторизоваться и нажать покупку.
    - expect: Реальная ветка goToPayment выбрасывает Checkout URL is not provided; ошибка обработана интерфейсом, а не navigation на undefined.
  2. Проверить URL, сообщения и кнопку.
    - expect: Пользователь видит сообщение ошибки; остаётся в магазине; кнопка восстановлена; ни checkout, ни подтверждения оплаченного заказа нет.
