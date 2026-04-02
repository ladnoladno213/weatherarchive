# Почему нельзя использовать GitHub Pages?

## Проблема

**GitHub Pages** - это хостинг только для статических сайтов:
- ✅ HTML, CSS, JavaScript
- ✅ Статические генераторы (Jekyll, Hugo)
- ❌ Node.js серверы
- ❌ Express.js
- ❌ Серверный рендеринг (EJS)
- ❌ API endpoints

## Ваш проект

У вас **динамический сайт** на Node.js:
- Express.js сервер (`server.js`)
- EJS шаблоны (`views/*.ejs`)
- Серверная логика (погода, архивы)
- API endpoints
- Обработка данных в реальном времени

**Вывод:** GitHub Pages не подходит.

## ✅ Решение: GitHub + Render.com

Используйте GitHub для кода + Render.com для хостинга.

### Преимущества:

1. **Бесплатно** (оба сервиса)
2. **Автоматический деплой** из GitHub
3. **Простая настройка** (5 минут)
4. **GitHub Actions** для автообновления данных

### Как это работает:

```
GitHub (код) → Render.com (хостинг) → Ваш сайт онлайн
     ↓
GitHub Actions (обновление данных каждые 3 часа)
```

## 🚀 Быстрый старт

### Шаг 1: Создайте аккаунт на Render.com
https://render.com → Sign up with GitHub

### Шаг 2: Подключите репозиторий
1. New + → Web Service
2. Выберите `weatherarchive`
3. Настройки автоматически определятся из `render.yaml`

### Шаг 3: Добавьте переменные окружения
```
NODE_ENV = production
EDIT_PASSWORD = ваш_пароль
```

### Шаг 4: Deploy
Нажмите "Create Web Service" - готово!

## 🔄 Автоматический деплой

Создан workflow `.github/workflows/deploy-render.yml`:
- Автоматически деплоит при push в main
- Игнорирует изменения в данных и документации

### Настройка (опционально):

1. На Render.com: Settings → Deploy Hook → Copy URL
2. На GitHub: Settings → Secrets → Actions → New secret
3. Имя: `RENDER_DEPLOY_HOOK`
4. Значение: вставьте URL

Теперь каждый push автоматически обновит сайт!

## 📊 Сравнение вариантов

| Функция | GitHub Pages | Render.com |
|---------|--------------|------------|
| Статика | ✅ | ✅ |
| Node.js | ❌ | ✅ |
| Express | ❌ | ✅ |
| Бесплатно | ✅ | ✅ (750 ч/мес) |
| Custom domain | ✅ | ✅ |
| HTTPS | ✅ | ✅ |
| Автодеплой | ✅ | ✅ |

## 🎯 Рекомендация

Используйте **Render.com** - это лучший бесплатный вариант для Node.js приложений.

Альтернативы:
- **Railway.app** - $5 кредитов/месяц
- **Vercel** - отлично для Next.js, но ограничения для Express

---

**Подробная инструкция:** `DEPLOY-QUICKSTART.md`
