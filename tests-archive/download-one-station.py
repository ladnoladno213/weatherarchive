#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Простой скрипт для скачивания одной станции через Selenium

Использование:
    python download-one-station.py
"""

from rp5_selenium_downloader import RP5SeleniumDownloader

# НАСТРОЙКИ - ИЗМЕНИТЕ ПОД СВОИ НУЖДЫ
STATION_ID = '28573'  # Санкт-Петербург (можно изменить на любую станцию)
START_DATE = '01.01.2016'  # Дата начала
END_DATE = '31.03.2026'    # Дата окончания

print("\n" + "="*70)
print("СКАЧИВАНИЕ ОДНОЙ СТАНЦИИ")
print("="*70)
print(f"Станция: {STATION_ID}")
print(f"Период: {START_DATE} - {END_DATE}")
print("="*70 + "\n")

# Создаем загрузчик (headless=False чтобы видеть браузер)
downloader = RP5SeleniumDownloader(headless=False)

try:
    # Скачиваем
    file_path = downloader.generate_and_download(
        station_id=STATION_ID,
        start_date=START_DATE,
        end_date=END_DATE
    )
    
    if file_path:
        print("\n" + "="*70)
        print("[SUCCESS] ФАЙЛ СКАЧАН!")
        print("="*70)
        print(f"Файл: {file_path}")
        print(f"Размер: {file_path.stat().st_size / 1024:.1f} КБ")
        print("="*70 + "\n")
    else:
        print("\n" + "="*70)
        print("[FAIL] НЕ УДАЛОСЬ СКАЧАТЬ")
        print("="*70 + "\n")
        
finally:
    downloader.close()
