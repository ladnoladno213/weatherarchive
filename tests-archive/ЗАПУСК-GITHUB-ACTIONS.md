# Запуск автоматического обновления через GitHub Actions

## Что уже готово ✅

1. ✅ Скрипт `rp5-realtime-updater.py` - скачивает последние 7 дней для всех станций
2. ✅ Workflow `.github/workflows/rp5-frequent.yml` - запускается 8 раз в день
3. ✅ Список станций в `data/wmo-mapping.js` - все города с прогнозом погоды

## Расписание обновлений

Данные будут обновляться каждые 3 часа по Екатеринбургскому времени (UTC+5):

- 00:00 (19:00 UTC предыдущего дня)
- 03:00 (22:00 UTC предыдущего дня)
- 06:00 (01:00 UTC)
- 09:00 (04:00 UTC)
- 12:00 (07:00 UTC)
- 15:00 (10:00 UTC)
- 18:00 (13:00 UTC)
- 21:00 (16:00 UTC)

## Шаг 1: Закоммитьте и запушьте файлы

```bash
git add .github/workflows/rp5-frequent.yml
git add rp5-realtime-updater.py
git add data/wmo-mapping.js
git commit -m "Add RP5 auto-update every 3 hours"
git push
```

## Шаг 2: Проверьте что Actions включены

1. Откройте ваш репозиторий на GitHub
2. Перейдите на вкладку **Actions**
3. Если Actions отключены, нажмите "I understand my workflows, go ahead and enable them"

## Шаг 3: Запустите первый раз вручную (для теста)

1. На вкладке **Actions** найдите workflow "RP5 Frequent Updates"
2. Нажмите на него
3. Справа нажмите кнопку **"Run workflow"**
4. Выберите ветку (обычно `main` или `master`)
5. Нажмите зелёную кнопку **"Run workflow"**

## Шаг 4: Следите за выполнением

1. Появится новый запуск в списке
2. Кликните на него чтобы увидеть детали
3. Кликните на job "update" чтобы увидеть логи
4. Процесс займёт примерно 5-10 минут

## Что произойдёт

1. GitHub Actions запустит Ubuntu контейнер
2. Установит Python, Chrome, ChromeDriver
3. Запустит `rp5-realtime-updater.py`
4. Скачает данные для всех станций из `data/wmo-mapping.js`
5. Сохранит CSV файлы в `data/rp5-realtime/`
6. Закоммитит и запушит изменения
7. Vercel автоматически задеплоит обновлённый сайт

## Проверка результатов

После успешного выполнения:

```bash
# Обновите локальную копию
git pull

# Проверьте что файлы появились
ls data/rp5-realtime/

# Должны быть файлы вида:
# 28440.csv
# 28698.csv
# 30230.csv
# и т.д.
```

## Мониторинг

### Просмотр логов

1. GitHub → Actions → последний запуск
2. Смотрите шаг "Download RP5 data"
3. Там будут логи вида:
   ```
   [1/150] Обработка станции 28440...
   Станция 28440: OK (12345 байт)
   ```

### Email уведомления

GitHub отправит email если workflow упадёт с ошибкой.

Настройка уведомлений:
1. GitHub → Settings → Notifications
2. Включите "Actions" в разделе "Email notification preferences"

## Лимиты GitHub Actions

- **2000 минут в месяц** (бесплатно)
- Один запуск: ~5 минут
- 8 запусков в день × 30 дней = 240 запусков
- 240 × 5 = **1200 минут в месяц**
- ✅ **Укладываемся в лимит!**

## Оптимизация (если нужно)

Если вдруг не хватит лимита, можно:

### 1. Уменьшить частоту обновлений

Редактируйте `.github/workflows/rp5-frequent.yml`:

```yaml
schedule:
  # Только 4 раза в день вместо 8
  - cron: '0 1 * * *'   # 06:00 Екатеринбург
  - cron: '0 7 * * *'   # 12:00 Екатеринбург
  - cron: '0 13 * * *'  # 18:00 Екатеринбург
  - cron: '0 19 * * *'  # 00:00 Екатеринбург
```

### 2. Кэшировать Chrome

Добавьте в `.github/workflows/rp5-frequent.yml` перед "Setup Chrome":

```yaml
- name: Cache Chrome
  uses: actions/cache@v3
  with:
    path: |
      ~/.cache/selenium
      /usr/bin/google-chrome
    key: chrome-${{ runner.os }}-${{ hashFiles('**/rp5-realtime-updater.py') }}
```

## Интеграция с Vercel

Vercel автоматически деплоит при каждом push в main!

Ничего дополнительно настраивать не нужно.

### Использование данных на сайте

В вашем Node.js коде:

```javascript
const fs = require('fs');
const path = require('path');

// Читаем данные для конкретной станции
function loadRP5Data(wmoId) {
  const filePath = path.join(__dirname, 'data', 'rp5-realtime', `${wmoId}.csv`);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  // Парсите CSV...
  return parseCSV(content);
}

// Пример использования
const weatherData = loadRP5Data('28440'); // Москва
```

## Troubleshooting

### Workflow не запускается по расписанию

- GitHub Actions cron может задерживаться на 5-15 минут
- Если репозиторий неактивен >60 дней, cron отключается
- Решение: сделайте любой commit раз в месяц

### Ошибка "Permission denied"

Нужно дать права на запись:

1. GitHub → Settings → Actions → General
2. Scroll down to "Workflow permissions"
3. Выберите "Read and write permissions"
4. Save

### Слишком долго выполняется

Если выполнение занимает >30 минут:

1. Уменьшите количество станций (обрабатывайте по частям)
2. Или увеличьте timeout в workflow:
   ```yaml
   timeout-minutes: 60  # вместо 360
   ```

### Файлы не коммитятся

Проверьте что в `.gitignore` нет строки:
```
data/rp5-realtime/
```

Если есть - удалите её!

## Альтернатива: Oracle Cloud

Если GitHub Actions не подойдёт, используйте Oracle Cloud Always Free:

- Полностью бесплатно БЕЗ кредитной карты
- VM работает 24/7
- Инструкция в `БЕСПЛАТНЫЕ-ВАРИАНТЫ.md`

## Поддержка

Если что-то не работает:

1. Проверьте логи в GitHub Actions
2. Убедитесь что файлы закоммичены
3. Проверьте права доступа (Workflow permissions)
4. Попробуйте запустить вручную через "Run workflow"

---

**Готово!** Теперь ваш сайт будет автоматически обновляться каждые 3 часа! 🎉
