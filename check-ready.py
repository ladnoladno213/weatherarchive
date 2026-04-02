#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Проверка готовности к запуску
"""

import os
import sys

print("\n" + "="*70)
print("ПРОВЕРКА ГОТОВНОСТИ")
print("="*70 + "\n")

# Проверка 1: Selenium
print("[1] Проверка Selenium...")
try:
    import selenium
    print("    ✓ Selenium установлен")
    selenium_ok = True
except ImportError:
    print("    ✗ Selenium НЕ установлен")
    print("    Выполните: pip install selenium")
    selenium_ok = False

# Проверка 2: Requests
print("\n[2] Проверка Requests...")
try:
    import requests
    print("    ✓ Requests установлен")
    requests_ok = True
except ImportError:
    print("    ✗ Requests НЕ установлен")
    print("    Выполните: pip install requests")
    requests_ok = False

# Проверка 3: ChromeDriver
print("\n[3] Проверка ChromeDriver...")
chromedriver_path = os.path.join(os.getcwd(), 'chromedriver-win64', 'chromedriver.exe')
if os.path.exists(chromedriver_path):
    print(f"    ✓ ChromeDriver найден: {chromedriver_path}")
    chromedriver_ok = True
else:
    print(f"    ✗ ChromeDriver НЕ найден: {chromedriver_path}")
    chromedriver_ok = False

# Проверка 4: Папка для файлов
print("\n[4] Проверка папки для файлов...")
output_dir = os.path.join(os.getcwd(), 'data', 'rp5-csv')
if os.path.exists(output_dir):
    print(f"    ✓ Папка существует: {output_dir}")
    folder_ok = True
else:
    print(f"    ✗ Папка не существует, создаем...")
    os.makedirs(output_dir, exist_ok=True)
    print(f"    ✓ Папка создана: {output_dir}")
    folder_ok = True

# Итоги
print("\n" + "="*70)
print("ИТОГИ")
print("="*70)

all_ok = selenium_ok and requests_ok and chromedriver_ok and folder_ok

if all_ok:
    print("\n✓ ВСЁ ГОТОВО К ЗАПУСКУ!")
    print("\nТеперь можно запустить:")
    print("  python download-one-station.py")
    print("\n" + "="*70 + "\n")
else:
    print("\n✗ НЕ ВСЁ ГОТОВО")
    print("\nЧто нужно сделать:")
    
    if not selenium_ok:
        print("  1. pip install selenium")
    if not requests_ok:
        print("  2. pip install requests")
    if not chromedriver_ok:
        print("  3. Скачать ChromeDriver")
    
    print("\n" + "="*70 + "\n")
    sys.exit(1)
