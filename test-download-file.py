#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тест скачивания файла после генерации
"""

import requests
import gzip
import time

url = "https://ru6.rp5.ru/download/files.synop/28/28573.01.01.2016.31.03.2026.1.0.0.ru.utf8.00000000.csv.gz"

print("Попытка скачивания файла...")
print(f"URL: {url}")

try:
    response = requests.get(url, timeout=60)
    
    if response.status_code == 200:
        print(f"\n[SUCCESS] Файл скачан! Размер: {len(response.content)} байт")
        
        # Сохраняем .gz
        with open('28573.csv.gz', 'wb') as f:
            f.write(response.content)
        print("Сохранен: 28573.csv.gz")
        
        # Распаковываем
        with gzip.open('28573.csv.gz', 'rb') as f_in:
            with open('28573.csv', 'wb') as f_out:
                f_out.write(f_in.read())
        print("Распакован: 28573.csv")
        
    else:
        print(f"\n[FAIL] Ошибка: HTTP {response.status_code}")
        
except Exception as e:
    print(f"\n[ERROR] {e}")
