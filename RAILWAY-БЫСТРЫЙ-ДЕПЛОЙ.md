# Railway - Быстрый деплой

## Шаг 1: Установите Railway GitHub App

1. Откройте: https://github.com/apps/railway-app/installations/new
2. Выберите свой аккаунт
3. Выберите доступ к репозиториям:
   - Либо "All repositories" (все репозитории)
   - Либо "Only select repositories" и выберите `weatherarchive`
4. Нажмите "Install"

## Шаг 2: Создайте проект на Railway

1. Откройте: https://railway.app/new
2. Нажмите "Deploy from GitHub repo"
3. Выберите репозиторий `weatherarchive`
4. Railway автоматически обнаружит настройки из `railway.toml`

## Шаг 3: Настройте переменные окружения (опционально)

Railway автоматически установит `PORT`, но вы можете добавить:

```
NODE_ENV=production
```

## Шаг 4: Деплой

Railway автоматически:
- Установит зависимости (`npm install`)
- Запустит сервер (`npm start`)
- Выделит публичный URL

## Проверка

После деплоя:
1. Откройте выделенный URL (например, `https://weatherarchive-production.up.railway.app`)
2. Проверьте, что сайт загружается
3. Проверьте архив погоды и прогноз

## Преимущества Railway

- ✅ Автоматический деплой при push в GitHub
- ✅ Бесплатный план (500 часов/месяц)
- ✅ Простая настройка
- ✅ Поддержка Node.js из коробки
- ✅ Автоматические SSL сертификаты

## Troubleshooting

### Railway не видит репозиторий
- Убедитесь, что Railway GitHub App установлен
- Проверьте, что приложению дан доступ к репозиторию
- Попробуйте переустановить приложение

### Деплой падает
- Проверьте логи в Railway Dashboard
- Убедитесь, что `package.json` содержит правильные скрипты
- Проверьте, что все зависимости установлены

### Сайт не открывается
- Проверьте, что сервер слушает на `process.env.PORT`
- Проверьте логи на ошибки
- Убедитесь, что деплой завершился успешно

## Альтернативы

Если Railway не подходит, попробуйте:
- **Render.com** - уже настроен (`render.yaml`)
- **Vercel** - настроен (`vercel.json`)
- **GitHub Pages** - НЕ подходит (нужен Node.js backend)

## Полезные ссылки

- Railway Dashboard: https://railway.app/dashboard
- Railway Docs: https://docs.railway.app/
- GitHub App Settings: https://github.com/settings/installations
