#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Простой скрипт для скачивания уже сгенерированных архивов RP5

ИНСТРУКЦИЯ:
1. Откройте https://rp5.ru/archive.php?wmo_id=28573 в браузере
2. Прокрутите вниз до раздела "Скачать архив погоды"
3. Выберите даты: 01.01.2016 - 31.03.2026
4. Нажмите кнопку для генерации
5. Дождитесь генерации (5-30 сек)
6. Запустите этот скрипт - он скачает файл

Этот скрипт НЕ генерирует файлы, а только скачивает уже сгенерированные.
"""

import requests
import gzip
import time
from pathlib import Path

# НАСТРОЙКИ
STATION_ID = '28573'  # Ишим
START_DATE = '01.01.2016'
END_DATE = '31.03.2026'
OUTPUT_DIR = Path('data/rp5-csv')

print("\n" + "="*70)
print("ПРОСТОЕ СКАЧИВАНИЕ АРХИВА RP5")
print("="*70)
print(f"Станция: {STATION_ID}")
print(f"Период: {START_DATE} - {END_DATE}")
print("="*70 + "\n")

# Создаем папку
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Формируем URL
prefix = STATION_ID[:2]
filename = f"{STATION_ID}.{START_DATE}.{END_DATE}.1.0.0.ru.utf8.00000000.csv.gz"

servers = ['ru1', 'ru2', 'ru3']

print("ВАЖНО: Перед запуском этого скрипта:")
print("1. Откройте https://rp5.ru/archive.php?wmo_id=28573")
print("2. Прокрутите вниз до 'Скачать архив погоды'")
print("3. Выберите даты и нажмите кнопку генерации")
print("4. Дождитесь генерации файла")
print("\nЕсли вы уже сделали это, нажмите Enter...")
input()

print("\nПопытка скачивания...")

for server in servers:
    url = f"https://{server}.rp5.ru/download/files.synop/{prefix}/{filename}"
    
    print(f"\nПробуем {server}...")
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=60)
        
        if response.status_code == 200:
            # Сохраняем .gz
            gz_path = OUTPUT_DIR / f"{STATION_ID}.csv.gz"
            with open(gz_path, 'wb') as f:
                f.write(response.content)
            
            print(f"[OK] Скачано: {len(response.content)} байт")
            
            # Распаковываем
            csv_path = OUTPUT_DIR / f"{STATION_ID}.csv"
            with gzip.open(gz_path, 'rb') as f_in:
                with open(csv_path, 'wb') as f_out:
                    f_out.write(f_in.read())
            
            print(f"[OK] Распаковано: {csv_path}")
            
            # Удаляем .gz
            gz_path.unlink()
            
            print("\n" + "="*70)
            print("[SUCCESS] ФАЙЛ СКАЧАН!")
            print("="*70)
            print(f"Файл: {csv_path}")
            print(f"Размер: {csv_path.stat().st_size / 1024 / 1024:.1f} МБ")
            print("="*70 + "\n")
            
            break
            
        elif response.status_code == 403:
            print(f"[FAIL] 403 Forbidden - файл не сгенерирован")
            
        else:
            print(f"[FAIL] HTTP {response.status_code}")
            
    except Exception as e:
        print(f"[ERROR] {e}")

else:
    print("\n" + "="*70)
    print("[FAIL] НЕ УДАЛОСЬ СКАЧАТЬ")
    print("="*70)
    print("\nФайл не найден на серверах RP5.")
    print("Возможно, он еще не сгенерирован.")
    print("\nЧто делать:")
    print("1. Откройте https://rp5.ru/archive.php?wmo_id=28573")
    print("2. Прокрутите вниз до 'Скачать архив погоды'")
    print("3. Выберите даты: 01.01.2016 - 31.03.2026")
    print("4. Нажмите кнопку генерации")
    print("5. Дождитесь 10-30 секунд")
    print("6. Запустите этот скрипт снова")
    print("="*70 + "\n")
