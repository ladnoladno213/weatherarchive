# RP5 Python Downloader

Стабильная система скачивания архивов погоды (CSV.gz) с сайта rp5.ru.

## ⚠️ Важное открытие: On-Demand Generation

RP5 использует систему генерации архивов **по запросу**:
- Файлы создаются только после запроса через веб-интерфейс
- После генерации кэшируются на некоторое время  
- Прямые запросы к несгенерированным файлам возвращают **403 Forbidden**
- Популярные станции (Санкт-Петербург) обычно доступны

**Подробнее:** см. `RP5-ON-DEMAND-GENERATION.md`

## Быстрый старт

### Проверка доступности станции
```bash
python rp5-helper.py check 26063 01.01.2024 31.12.2024
```

### Скачивание с повторными попытками
```bash
python rp5-helper.py download 28573 01.01.2024 31.12.2024
```

### Список популярных станций
```bash
python rp5-helper.py popular
```

## Особенности

✅ Использует `requests.Session()` для имитации браузера  
✅ Получает cookies с главной страницы перед скачиванием  
✅ Реалистичные HTTP заголовки (User-Agent, Referer, Accept-Language)  
✅ Случайные задержки между запросами (1-3 секунды)  
✅ Ограниченная параллельность (не более 2 потоков)  
✅ Retry механизм (3 попытки при ошибке)  
✅ Альтернативные серверы (ru1, ru2, ru3)  
✅ Автоматическая распаковка .gz файлов  
✅ Загрузка в pandas DataFrame  
✅ Подготовка данных для БД  

## Установка

### 1. Установить Python 3.8+

```bash
python3 --version
```

### 2. Установить зависимости

```bash
pip install -r requirements.txt
```

Или вручную:

```bash
pip install requests pandas numpy
```

## Использование

### Базовый пример

```python
from rp5_downloader import RP5Downloader

# Создаем загрузчик
downloader = RP5Downloader(output_dir='data/rp5-csv')

# Скачиваем одну станцию
file_path = downloader.download_station(
    station_id='28573',  # Ишим
    start_date='01.01.2020',
    end_date='01.01.2026'
)

if file_path:
    print(f"Файл сохранен: {file_path}")
    
    # Загружаем в DataFrame
    df = downloader.load_csv_to_dataframe(file_path)
    print(f"Загружено строк: {len(df)}")

# Закрываем сессию
downloader.close()
```

### Скачивание нескольких станций

```python
from rp5_downloader import RP5Downloader

# Список станций
stations = [
    '28573',  # Ишим
    '27612',  # Москва
    '26063',  # Санкт-Петербург
]

downloader = RP5Downloader()

try:
    # Скачиваем параллельно (макс. 2 потока)
    results = downloader.download_stations(
        station_ids=stations,
        start_date='01.01.2020',
        end_date='01.01.2026',
        max_workers=2
    )
    
    # Обрабатываем результаты
    for station_id, file_path in results:
        if file_path:
            print(f"✓ {station_id}: {file_path}")
        else:
            print(f"✗ {station_id}: ошибка")
            
finally:
    downloader.close()
```

### Подготовка для БД

```python
from rp5_downloader import RP5Downloader

downloader = RP5Downloader()

# Скачиваем
file_path = downloader.download_station('28573')

if file_path:
    # Загружаем в DataFrame
    df = downloader.load_csv_to_dataframe(file_path)
    
    # Подготавливаем для БД
    df_prepared = downloader.prepare_for_database(df, '28573')
    
    # Загружаем в БД (пример с SQLAlchemy)
    # from sqlalchemy import create_engine
    # engine = create_engine('postgresql://user:pass@localhost/weather')
    # df_prepared.to_sql('weather_data', engine, if_exists='append', index=False)
    
    print(f"Готово к загрузке: {len(df_prepared)} строк")

downloader.close()
```

## Запуск из командной строки

```bash
# Запустить основной скрипт
python3 rp5_downloader.py

# Или с логированием в файл
python3 rp5_downloader.py > output.log 2>&1
```

## Настройка через cron (Linux)

Для автоматического скачивания каждый день в 3:00:

```bash
# Открыть crontab
crontab -e

# Добавить строку
0 3 * * * cd /path/to/project && /usr/bin/python3 rp5_downloader.py >> /var/log/rp5_downloader.log 2>&1
```

## Структура файлов

После скачивания:

```
data/rp5-csv/
├── 28573.csv          # Ишим (распакованный)
├── 27612.csv          # Москва
├── 26063.csv          # Санкт-Петербург
└── ...

rp5_downloader.log     # Лог файл
```

## Формат данных

CSV файлы содержат:

- Разделитель: `;` (точка с запятой)
- Кодировка: UTF-8
- Комментарии: строки начинающиеся с `#`
- Столбцы: Местное время, T, Po, P, Pa, U, DD, Ff, ff10, ff3, N, WW, W1, W2, Cl, Nh, H, Cm, Ch, VV, Td, RRR, tR, E, Tg, E', sss

Пример:
```csv
#Метеостанция Ишим (28573)
#Период: 01.01.2020 - 01.01.2026
#
Местное время;T;Po;P;Pa;U;DD;Ff;ff10;ff3;N;WW;W1;W2;...
01.01.2020 00:00;-15.2;752.3;768.1;0.2;78;Ветер, дующий с юга;2.0;...
```

## Параметры класса RP5Downloader

### Конструктор

```python
RP5Downloader(
    output_dir='data/rp5-csv',  # Директория для сохранения
    max_retries=3                # Количество попыток при ошибке
)
```

### Методы

#### download_station()

Скачивает архив для одной станции.

```python
download_station(
    station_id: str,              # WMO ID (5 цифр)
    start_date: str = '01.01.2000',  # Дата начала (DD.MM.YYYY)
    end_date: str = '01.01.2026',    # Дата окончания (DD.MM.YYYY)
    decompress: bool = True       # Распаковывать .gz
) -> Optional[Path]
```

#### download_stations()

Скачивает архивы для нескольких станций параллельно.

```python
download_stations(
    station_ids: List[str],       # Список WMO ID
    start_date: str = '01.01.2000',
    end_date: str = '01.01.2026',
    max_workers: int = 2          # Макс. параллельных потоков
) -> List[Tuple[str, Optional[Path]]]
```

#### load_csv_to_dataframe()

Загружает CSV в pandas DataFrame.

```python
load_csv_to_dataframe(
    csv_path: Path
) -> Optional[pd.DataFrame]
```

#### prepare_for_database()

Подготавливает данные для загрузки в БД.

```python
prepare_for_database(
    df: pd.DataFrame,
    station_id: str
) -> pd.DataFrame
```

## Логирование

Логи сохраняются в:
- `rp5_downloader.log` - файл
- `stdout` - консоль

Уровни логирования:
- `INFO` - основная информация
- `WARNING` - предупреждения (403, timeout)
- `ERROR` - ошибки
- `DEBUG` - детальная отладка

Изменить уровень:

```python
import logging
logging.getLogger('rp5_downloader').setLevel(logging.DEBUG)
```

## Обработка ошибок

Скрипт обрабатывает:

- ✅ HTTP 403 Forbidden - пробует другой сервер
- ✅ HTTP 404 Not Found - файл не существует
- ✅ Timeout - повторная попытка
- ✅ Connection errors - повторная попытка
- ✅ Gzip errors - сохраняет .gz файл

## Список WMO ID для российских городов

| Город | WMO ID |
|-------|--------|
| Москва | 27612 |
| Санкт-Петербург | 26063 |
| Новосибирск | 29634 |
| Екатеринбург | 28698 |
| Казань | 27595 |
| Нижний Новгород | 27459 |
| Челябинск | 28722 |
| Самара | 27995 |
| Омск | 28698 |
| Ростов-на-Дону | 34731 |
| Уфа | 28722 |
| Красноярск | 29570 |
| Воронеж | 34123 |
| Пермь | 28224 |
| Волгоград | 34560 |
| Краснодар | 34927 |
| Саратов | 34172 |
| Тюмень | 28367 |
| Ижевск | 28411 |
| Ишим | 28573 |

Полный список в `data/wmo-mapping.js` (167,410 городов).

## Производительность

- Скорость: ~1-2 станции в минуту (с задержками)
- Размер файла: ~1-5 МБ на станцию (сжатый)
- Размер после распаковки: ~5-20 МБ
- Память: ~100-200 МБ на DataFrame

## Рекомендации

1. **Не превышайте 2 параллельных потока** - чтобы не получить блокировку
2. **Используйте задержки** - уже встроены в скрипт
3. **Скачивайте ночью** - меньше нагрузка на сервер
4. **Кэшируйте файлы** - не скачивайте повторно
5. **Проверяйте логи** - для отладки проблем

## Troubleshooting

### Все запросы возвращают 403

- Проверьте, что cookies получены успешно
- Попробуйте увеличить задержки
- Проверьте, не заблокирован ли ваш IP

### Timeout ошибки

- Увеличьте timeout в коде (по умолчанию 30 сек)
- Проверьте интернет соединение

### Ошибки распаковки

- Файл может быть поврежден
- Попробуйте скачать заново
- Проверьте размер файла

### Не находит станцию (404)

- Проверьте правильность WMO ID
- Не все станции имеют архивы
- Попробуйте другой период дат

## Лицензия

MIT License - свободное использование

## Автор

Weather Website Project, 2026
