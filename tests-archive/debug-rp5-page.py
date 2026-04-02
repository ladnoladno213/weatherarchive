#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Отладочный скрипт для проверки страницы RP5
Сохраняет скриншот и HTML для анализа
"""

import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By

print("\n" + "="*70)
print("ОТЛАДКА СТРАНИЦЫ RP5")
print("="*70 + "\n")

# Настройки Chrome
options = webdriver.ChromeOptions()

# Путь к Chrome
chrome_binary_paths = [
    os.path.join(os.getcwd(), 'chrome-win64', 'chrome-win64', 'chrome.exe'),
    os.path.join(os.getcwd(), 'chrome-win64', 'chrome.exe'),
]

for chrome_binary_path in chrome_binary_paths:
    if os.path.exists(chrome_binary_path):
        options.binary_location = chrome_binary_path
        print(f"Используем Chrome: {chrome_binary_path}")
        break

# Путь к ChromeDriver
chrome_driver_path = os.path.join(os.getcwd(), 'chromedriver-win64', 'chromedriver.exe')
service = Service(chrome_driver_path)

# Запускаем браузер
print("Запуск браузера...")
driver = webdriver.Chrome(service=service, options=options)

try:
    # Открываем страницу
    url = 'https://rp5.ru/archive.php?wmo_id=28573&lang=ru'
    print(f"Открытие: {url}")
    driver.get(url)
    
    # Ждем загрузки
    print("Ожидание 10 секунд...")
    time.sleep(10)
    
    # Сохраняем скриншот
    screenshot_path = 'rp5-page-screenshot.png'
    driver.save_screenshot(screenshot_path)
    print(f"\n[OK] Скриншот сохранен: {screenshot_path}")
    
    # Сохраняем HTML
    html_path = 'rp5-page-source.html'
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(driver.page_source)
    print(f"[OK] HTML сохранен: {html_path}")
    
    # Пробуем найти все input поля
    print("\n[INFO] Поиск всех input полей на странице...")
    inputs = driver.find_elements(By.TAG_NAME, 'input')
    print(f"Найдено input полей: {len(inputs)}")
    
    print("\nПервые 20 input полей:")
    for i, inp in enumerate(inputs[:20], 1):
        inp_id = inp.get_attribute('id') or '(нет id)'
        inp_name = inp.get_attribute('name') or '(нет name)'
        inp_type = inp.get_attribute('type') or '(нет type)'
        print(f"  {i}. id='{inp_id}', name='{inp_name}', type='{inp_type}'")
    
    print("\n" + "="*70)
    print("ГОТОВО!")
    print("="*70)
    print("\nТеперь:")
    print("1. Откройте файл rp5-page-screenshot.png - посмотрите на страницу")
    print("2. Откройте файл rp5-page-source.html в блокноте")
    print("3. Найдите в HTML поля для ввода дат (Ctrl+F: 'date' или 'дата')")
    print("4. Посмотрите их id или name")
    print("="*70 + "\n")
    
    input("Нажмите Enter чтобы закрыть браузер...")
    
finally:
    driver.quit()
    print("Браузер закрыт")
