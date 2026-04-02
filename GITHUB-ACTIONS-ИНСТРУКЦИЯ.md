# GitHub Actions - Инструкция

## Настроенные Workflows

### 1. RP5 Frequent Updates (rp5-frequent.yml)
**Статус**: ✅ Работает

**Что делает**: Обновляет данные о погоде каждые 3 часа из RP5

**Расписание**: Каждые 3 часа (00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 UTC)

**Файлы**:
- Workflow: `.github/workflows/rp5-frequent.yml`
- Скрипт: `rp5-github-updater.py`

**Последнее исправление**: Исправлен парсинг `data/wmo-mapping.js` (использует regex вместо JSON)

---

### 2. Download RP5 Weather Data (download-rp5.yml)
**Статус**: ✅ Исправлено

**Что делает**: Скачивает архивные данные погоды с RP5 через Selenium

**Расписание**: 1-го числа каждого месяца в 03:00 UTC

**Файлы**:
- Workflow: `.github/workflows/download-rp5.yml`
- Скрипт: `rp5-github-action.py`

**Последнее исправление**: 
1. Упрощена установка ChromeDriver (используется `install-chromedriver: true`)
2. Добавлен webdriver-manager как fallback
3. Добавлена проверка версий Chrome и ChromeDriver
4. Обновлен setup-python до v5

**Проблема была**: Старый метод установки ChromeDriver через wget больше не работал

**Решение**: Используем встроенную установку ChromeDriver в action `browser-actions/setup-chrome@latest`

---

## Как запустить вручную

1. Перейдите на страницу Actions: https://github.com/ВАШ_USERNAME/weatherarchive/actions
2. Выберите нужный workflow слева
3. Нажмите "Run workflow" справа
4. Выберите ветку (обычно `main`)
5. Нажмите зеленую кнопку "Run workflow"

---

## Как проверить статус

### Через веб-интерфейс
https://github.com/ВАШ_USERNAME/weatherarchive/actions

### Через скрипты
```bash
# Проверить последние запуски
python check-github-actions.py

# Проверить логи конкретного запуска
python check-github-logs.py

# Проверить самый последний запуск
python check-latest-run.py
```

---

## Настройка станций для скачивания

Отредактируйте файл `rp5-github-action.py`:

```python
stations = [
    ('28573', '01.01.2016', '31.03.2026'),  # Ишим
    ('26063', '01.01.2020', '31.03.2026'),  # Другая станция
    # Добавьте свои станции здесь
]
```

Формат: `(WMO_ID, дата_начала, дата_окончания)`

---

## Troubleshooting

### Workflow падает с ошибкой "exit code 5"
- Проверьте, что ChromeDriver установлен правильно
- Убедитесь, что используется `install-chromedriver: true`

### Не скачиваются данные
- Проверьте, что WMO ID правильный
- Убедитесь, что даты в формате DD.MM.YYYY
- Проверьте логи workflow

### Изменения не коммитятся
- Убедитесь, что файлы действительно изменились
- Проверьте права доступа GitHub Action (Settings → Actions → General → Workflow permissions)

---

## История исправлений

**02.04.2026**
- ✅ Исправлен workflow download-rp5.yml (ChromeDriver installation)
- ✅ Добавлен webdriver-manager как fallback для ChromeDriver
- ✅ Добавлена проверка версий Chrome и ChromeDriver
- ✅ Обновлен setup-python до v5
- ✅ Исправлен workflow rp5-frequent.yml (парсинг wmo-mapping.js)
