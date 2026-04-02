#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для массового скачивания станций через Selenium

Использование:
    python download-mass.py
"""

from rp5_selenium_downloader import RP5SeleniumDownloader

# НАСТРОЙКИ - ИЗМЕНИТЕ ПОД СВОИ НУЖДЫ

# Список станций (WMO ID)
STATIONS = [
    '26063',  # Санкт-Петербург
    '27612',  # Москва
    '28573',  # Ишим
    '29634',  # Новосибирск
    '28698',  # Екатеринбург
]

# Период загрузки
START_DATE = '01.04.2016'
END_DATE = '01.04.2026'

# Показывать браузер (False) или скрыть (True)
HEADLESS = False

print("\n" + "="*70)
print("МАССОВОЕ СКАЧИВАНИЕ СТАНЦИЙ")
print("="*70)
print(f"Станций: {len(STATIONS)}")
print(f"Период: {START_DATE} - {END_DATE}")
print(f"Режим: {'Скрытый' if HEADLESS else 'С отображением браузера'}")
print("="*70 + "\n")

# Создаем загрузчик
downloader = RP5SeleniumDownloader(headless=HEADLESS)

try:
    # Скачиваем все станции
    results = downloader.download_stations(
        station_ids=STATIONS,
        start_date=START_DATE,
        end_date=END_DATE
    )
    
    # Показываем результаты
    print("\n" + "="*70)
    print("РЕЗУЛЬТАТЫ СКАЧИВАНИЯ")
    print("="*70)
    
    success_count = 0
    failed_count = 0
    
    for station_id, file_path in results:
        if file_path:
            size_kb = file_path.stat().st_size / 1024
            print(f"[OK] {station_id}: {file_path.name} ({size_kb:.1f} КБ)")
            success_count += 1
        else:
            print(f"[FAIL] {station_id}: не скачан")
            failed_count += 1
    
    print("="*70)
    print(f"Успешно: {success_count}/{len(STATIONS)}")
    print(f"Ошибок: {failed_count}/{len(STATIONS)}")
    print("="*70 + "\n")
    
finally:
    downloader.close()
