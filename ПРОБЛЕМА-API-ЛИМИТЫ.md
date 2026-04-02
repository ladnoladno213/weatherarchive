# Проблема: API лимиты на Render.com

## Что происходит

**Ошибка:** "Daily API request limit exceeded"

**Причина:** Используются бесплатные API с лимитами:
1. **GeoNames API** - 20,000 запросов/день (username: `vvvholder`)
2. **ip-api.com** - 45 запросов/минуту
3. **Open-Meteo** - без лимитов (отлично!)

## Почему на localhost работает, а на Render нет?

На localhost:
- Вы один пользователь
- Мало запросов
- Лимиты не достигаются

На Render.com:
- Публичный доступ
- Боты, краулеры
- Лимиты быстро исчерпываются

## 🔧 Решения

### Решение 1: Кэширование (быстрое)

Добавить кэш для GeoNames запросов:

```javascript
// Кэш на 24 часа
const geoCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;

async function getCachedGeoData(url) {
  const cached = geoCache.get(url);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetch(url).then(r => r.json());
  geoCache.set(url, { data, time: Date.now() });
  return data;
}
```

### Решение 2: Свой GeoNames аккаунт

1. Зарегистрируйтесь: http://www.geonames.org/login
2. Активируйте API: http://www.geonames.org/manageaccount
3. Добавьте переменную окружения на Render:
   ```
   GEONAMES_USER=ваш_username
   ```

### Решение 3: Использовать только локальные данные

У вас уже есть:
- `data/cities.json` - 18 MB городов
- `data/geo-db.js` - локальная база
- `data/airports.js` - аэропорты

Можно отключить GeoNames и использовать только локальные данные.

### Решение 4: Rate limiting

Ограничить количество запросов от одного IP:

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100 // максимум 100 запросов
});

app.use(limiter);
```

## 🎯 Рекомендация

**Комбинация решений 1 + 2 + 4:**

1. Добавить кэширование (уменьшит запросы в 10-100 раз)
2. Создать свой GeoNames аккаунт (20k лимит только для вас)
3. Добавить rate limiting (защита от ботов)

## 📝 Что нужно сделать

### Шаг 1: Создать GeoNames аккаунт

1. http://www.geonames.org/login → Sign Up
2. Подтвердите email
3. http://www.geonames.org/manageaccount → Enable Free Web Services
4. Запомните username

### Шаг 2: Добавить на Render

1. Dashboard → Your Service → Environment
2. Add Environment Variable:
   - Key: `GEONAMES_USER`
   - Value: `ваш_username`
3. Save Changes (автоматически перезапустится)

### Шаг 3: Обновить код

Я создам патч с кэшированием и rate limiting.

## ⚠️ Временное решение

Пока можно:
1. Перезапустить сервис на Render (лимит сбросится завтра)
2. Использовать только прямые ссылки с координатами
3. Тестировать локально

---

**Статус:** Требуется действие  
**Приоритет:** Высокий  
**Время исправления:** 15 минут
