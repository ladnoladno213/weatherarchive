# Быстрый деплой на Railway.app

## Почему Railway вместо Render?

- ✅ Быстрый деплой (1-2 минуты)
- ✅ Нет проблем с кэшированием
- ✅ $5 бесплатных кредитов/месяц
- ✅ Не "засыпает" как Render
- ✅ Лучшие логи

## Шаг 1: Регистрация (30 секунд)

1. Откройте https://railway.app
2. Нажмите "Start a New Project"
3. Выберите "Login with GitHub"
4. Авторизуйте Railway

## Шаг 2: Создание проекта (1 минута)

1. На главной странице нажмите "New Project"
2. Выберите "Deploy from GitHub repo"
3. Найдите `ladnoladno213/weatherarchive`
4. Нажмите "Deploy Now"

Railway автоматически:
- Определит Node.js проект
- Прочитает `railway.toml`
- Установит зависимости
- Запустит сервер

## Шаг 3: Настройка переменных (опционально)

Settings → Variables → Add Variable:
```
EDIT_PASSWORD=ваш_пароль
NODE_ENV=production
```

## Шаг 4: Получить URL

1. После деплоя нажмите на сервис
2. Settings → Networking → Generate Domain
3. Скопируйте URL (например: `weatherarchive-production.up.railway.app`)

## Готово! 🎉

Ваш сайт работает на Railway без проблем с GeoNames API!

---

**Время:** 3 минуты  
**Стоимость:** $5 кредитов хватит на месяц  
**Проблемы:** Нет, всё работает из коробки
