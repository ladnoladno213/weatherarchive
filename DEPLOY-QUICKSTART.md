# Быстрый старт деплоя на Render.com

## За 5 минут до живого сайта

### Шаг 1: Регистрация
1. Откройте https://render.com
2. Нажмите "Get Started" → "Sign Up"
3. Выберите "Sign up with GitHub"
4. Авторизуйте Render

### Шаг 2: Создание Web Service
1. На главной странице Render нажмите "New +"
2. Выберите "Web Service"
3. Найдите репозиторий `ladnoladno213/weatherarchive`
4. Нажмите "Connect"

### Шаг 3: Настройка
Заполните форму:

```
Name: weatherwebsite
Region: Frankfurt (EU Central) или Oregon (US West)
Branch: main
Runtime: Node
Build Command: npm install
Start Command: npm start
Instance Type: Free
```

### Шаг 4: Переменные окружения
Нажмите "Advanced" → "Add Environment Variable":

```
NODE_ENV = production
EDIT_PASSWORD = ваш_секретный_пароль
```

### Шаг 5: Деплой
1. Нажмите "Create Web Service"
2. Подождите 2-3 минуты (следите за логами)
3. Когда статус станет "Live", нажмите на URL

**Готово!** 🎉 Ваш сайт работает!

---

## Автоматические обновления

Render автоматически деплоит изменения при каждом push в main ветку.

Чтобы отключить автодеплой:
1. Settings → Build & Deploy
2. Выключите "Auto-Deploy"

---

## Проблемы?

### Сайт не запускается
Проверьте логи: Dashboard → Logs

### Долго загружается
Это нормально для бесплатного плана - сервис "просыпается" ~30 секунд

### Нужна помощь
Документация: https://render.com/docs

---

**Время деплоя:** ~3 минуты  
**Стоимость:** $0 (бесплатно)
