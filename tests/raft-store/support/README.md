# Подмены магазина Raft

Тесты открывают настоящий HTML/JavaScript `https://rafthub.survivalgamesstudio.com/ru/store` в Chromium. План: `specs/raft-store-test-plan.md`. Каждый тест получает новый context; service workers заблокированы, маршруты устанавливаются до открытия сайта.

Снимки получены 11.11.2026 из публичных GET API (русский язык, страна DE):

| Файл | Источник |
| --- | --- |
| `catalog.json` | `https://hub-api.aghanim.com/hub/v1/websites/rafthub.survivalgamesstudio.com/items?current_page_path=%2Fstore` |
| `sections.json` | тот же API prefix, `/sections` |
| `categories.json` | `https://hub-api-global.aghanim.com/hub/v1/websites/rafthub.survivalgamesstudio.com/item_categories` |
| `daily-rewards.json` | `https://hub-api.aghanim.com/hub/v1/websites/rafthub.survivalgamesstudio.com/daily_rewards` |
| `loyalty.json` | `https://hub-api-global.aghanim.com/hub/v1/websites/rafthub.survivalgamesstudio.com/loyalty` |

Из реального массива каталога оставлена карточка **Собака** (`itm_eFCPSOEuVEw`, `stm_eFYprhpYTrh`, SKU `pet_dog_labrador_web`) вместе с её вложенными полями. Это фиксирует товар и цену, сохраняя реальный контракт. Другие снимки сохраняют ответы полностью. HTML, оформление и код приложения остаются сетевой зависимостью: изменение production frontend может потребовать обновить контракты и локаторы.

`store-mocks.cjs` перехватывает POST `/auth/authorize_user_id`, два session serverFn (commit/clear), POST `/orders` и `/activities/visit_page`. ID, введённый пользователем, отправляется только в mock входа; backend-пользователь и bearer token синтетические. GET `/user/me` получает mock-профиль; `/user_communications`, `/user/virtual_currencies`, `/user/reward_points`, `/orders/unhandled_paid` — пустые массивы. Публичные GET из таблицы берутся из снимков и до, и после авторизации. Эти ancillary-подмены предотвращают настоящий 401 на синтетический token и случайный reload.

Неизвестные API запросы, любые остальные мутации и запросы с Authorization блокируются. Неизвестный hub API вызов дополнительно проваливает тест. Все WebSocket соединения и реальные платёжные домены заблокированы. Ответы заказов ведут только на `checkout.playwright.invalid`; его документ — нейтральная заглушка, подтверждающая передачу управления в checkout. Счётчик переходов учитывает только navigation, без favicon. В кейсе 400 документ `/play` также перехватывается без запуска игры.

Тесты проверяют валидацию, создание заказа/его payload, HTTP 201/400/401/429/500, сетевой обрыв, удержанный ответ и защиту от дублей, ручной повтор и отсутствие checkout URL. `429` использует неизвестный `detail` для проверки реальной fallback-ошибки; наличие countdown не предполагается. Статусы финансовой транзакции `paid`/`refunded`, списание, выдача предметов и платёжный SDK не покрыты. Настоящие заказы и платежи не создаются.

Запуск:

```powershell
npx playwright test tests/raft-store --project=chromium --workers=2
```
