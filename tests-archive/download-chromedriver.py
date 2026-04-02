#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для скачивания ChromeDriver

Автоматически скачивает ChromeDriver версии 146 (совместимую с вашим Chrome).
"""

import requests
import zipfile
import os
from pathlib import Path

print("\n" + "="*70)
print("СКАЧИВАНИЕ CHROMEDRIVER ВЕРСИИ 146")
print("="*70 + "\n")

# Прямая ссылка на ChromeDriver 146 для Windows
CHROMEDRIVER_URL = "https://storage.googleapis.com/chrome-for-testing-public/146.0.7680.178/win64/chromedriver-win64.zip"

print("Скачивание ChromeDriver 146.0.7680.178...")
print(f"URL: {CHROMEDRIVER_URL}")
print("\nСкачивание...")

try:
    # Скачиваем
    response = requests.get(CHROMEDRIVER_URL, timeout=120, stream=True)
    
    if response.status_code != 200:
        print(f"[ОШИБКА] HTTP {response.status_code}")
        exit(1)
    
    zip_path = "chromedriver-win64-v146.zip"
    
    with open(zip_path, 'wb') as f:
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                
                if total_size > 0:
                    percent = (downloaded / total_size) * 100
                    print(f"\rПрогресс: {percent:.1f}%", end='')
    
    print("\n\nРаспаковка...")
    
    # Удаляем старую папку если есть
    if os.path.exists('chromedriver-win64'):
        import shutil
        shutil.rmtree('chromedriver-win64')
        print("Удалена старая версия")
    
    # Распаковываем
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall('.')
    
    # Удаляем zip
    os.remove(zip_path)
    
    # Проверяем
    chromedriver_path = Path('chromedriver-win64') / 'chromedriver.exe'
    
    if chromedriver_path.exists():
        print("\n" + "="*70)
        print("[SUCCESS] CHROMEDRIVER 146 УСТАНОВЛЕН!")
        print("="*70)
        print(f"Файл: {chromedriver_path}")
        print(f"Версия: 146.0.7680.178 (совместима с вашим Chrome)")
        print("="*70 + "\n")
        print("Теперь можно запустить:")
        print("  python download-one-station.py")
        print("="*70 + "\n")
    else:
        print("\n[ОШИБКА] Файл не найден после распаковки")
        
except Exception as e:
    print(f"\n[ОШИБКА] {e}")
    print("\nРУЧНОЕ СКАЧИВАНИЕ:")
    print("1. Откройте: https://googlechromelabs.github.io/chrome-for-testing/")
    print("2. Найдите версию 146.0.7680.178")
    print("3. Скачайте 'chromedriver' для 'win64'")
    print("4. Распакуйте в папку проекта")
    print("5. Должна получиться папка: chromedriver-win64")
