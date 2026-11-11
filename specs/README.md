# Планы и запуск тестов

- [Страница руководства: 10 сценариев](raft-guide-test-plan.md)
- [Магазин: 10 сценариев покупки с подменами API](raft-store-test-plan.md)

Все тесты используют проект `chromium` из `playwright.config.ts`.

```powershell
npm test
npx playwright test tests/raft-store --project=chromium
npx playwright test tests/raft-store --project=chromium --ui --ui-host=127.0.0.1
```

Тесты магазина открывают настоящий frontend и подменяют авторизацию и создание заказа. Платёжные запросы перехватываются, переход в checkout направлен на тестовую заглушку. Проверяется передача заказа на оплату и обработка ошибок; фактическое списание, выдача предметов и финансовые статусы `paid`/`refunded` в это покрытие не входят.
