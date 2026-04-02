#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ФИНАЛЬНАЯ версия скрипта скачивания с RP5
Правильная последовательность действий
"""

import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By

options = webdriver.ChromeOptions()
chrome_binary_path = os.path.join(os.getcwd(), 'chrome-win64', 'chrome-win64', 'chrome.exe')
options.binary_location = chrome_binary_path

chrome_driver_path = os.path.join(os.getcwd(), 'chromedriver-win64', 'chromedriver.exe')
service = Service(chrome_driver_path)

driver = webdriver.Chrome(service=service, options=options)

try:
    print("="*70)
    print("СКАЧИВАНИЕ АРХИВА RP5 - ПРАВИЛЬНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ")
    print("="*70)
    
    # Открываем страницу
    url = 'https://rp5.ru/archive.php?wmo_id=28573&lang=ru'
    print("\n1. Открытие страницы...")
    driver.get(url)
    time.sleep(5)
    
    # Переключаемся на вкладку
    print("2. Переключение на вкладку 'Скачать архив погоды'...")
    download_tab = driver.find_element(By.ID, 'tabSynopDLoad')
    download_tab.click()
    time.sleep(3)
    print("   ✓ Вкладка открыта")
    
    # ШАГ 1: Заполняем даты
    print("\n3. Заполнение диапазона дат...")
    date_start_input = driver.find_element(By.ID, 'calender_dload')
    date_end_input = driver.find_element(By.ID, 'calender_dload2')
    driver.execute_script("arguments[0].value = '01.01.2016';", date_start_input)
    driver.execute_script("arguments[0].value = '31.03.2026';", date_end_input)
    print("   ✓ Даты: 01.01.2016 - 31.03.2026")
    time.sleep(1)
    
    # ШАГ 2: СНАЧАЛА выбираем формат CSV (f_pe=3)
    print("\n4. Выбор формата CSV (текстовый)...")
    driver.execute_script("""
        var csvRadio = document.querySelector('input[name="f_pe"][value="3"]');
        if (csvRadio) {
            csvRadio.click();
            return true;
        }
        return false;
    """)
    time.sleep(3)  # Ждем появления опций кодировки
    print("   ✓ CSV выбран")
    
    # ШАГ 3: ПОТОМ выбираем "ВСЕ ДНИ" (f_pe=1) - это перезапишет выбор!
    print("\n5. Выбор 'ВСЕ ДНИ' для диапазона...")
    driver.execute_script("""
        var allDaysRadio = document.querySelector('input[name="f_pe"][value="1"]');
        if (allDaysRadio) {
            allDaysRadio.click();
            return true;
        }
        return false;
    """)
    time.sleep(2)
    print("   ✓ 'ВСЕ ДНИ' выбрано")
    
    # ШАГ 4: Выбираем кодировку UTF-8
    print("\n6. Выбор кодировки UTF-8...")
    driver.execute_script("""
        var utf8Radio = document.getElementById('format1');
        if (utf8Radio) {
            utf8Radio.click();
            return true;
        }
        return false;
    """)
    time.sleep(2)
    print("   ✓ UTF-8 выбран")
    
    # ШАГ 5: Нажимаем синюю кнопку "Выбрать в файл GZ (архив)"
    print("\n7. Поиск и нажатие кнопки 'Выбрать в файл GZ (архив)'...")
    
    button_clicked = driver.execute_script("""
        // Ищем все input кнопки
        var inputs = document.querySelectorAll('input[type="button"], input[type="submit"]');
        for (var i = 0; i < inputs.length; i++) {
            var val = (inputs[i].value || '').trim();
            // Ищем кнопку с текстом "Выбрать" и "файл"
            if (val.includes('Выбрать') && val.includes('файл')) {
                inputs[i].click();
                return val;
            }
        }
        return null;
    """)
    
    if button_clicked:
        print(f"   ✓ Кнопка нажата: '{button_clicked}'")
    else:
        print("   ✗ ОШИБКА: Кнопка не найдена!")
        print("\n   Доступные кнопки:")
        buttons = driver.execute_script("""
            var result = [];
            var inputs = document.querySelectorAll('input[type="button"], input[type="submit"]');
            inputs.forEach(function(inp) {
                if (inp.offsetParent !== null) {
                    result.push(inp.value);
                }
            });
            return result;
        """)
        for btn in buttons:
            print(f"     - '{btn}'")
    
    # ШАГ 6: Ждем появления ссылки "Скачать" (5-7 секунд)
    print("\n8. Ожидание появления ссылки 'Скачать' (7 сек)...")
    time.sleep(7)
    
    # ШАГ 7: Кликаем по ссылке "Скачать"
    print("\n9. Поиск и клик по ссылке 'Скачать'...")
    
    download_link = driver.execute_script("""
        // Ищем ссылку или текст "Скачать"
        var elements = document.querySelectorAll('a, span, div');
        for (var i = 0; i < elements.length; i++) {
            var text = (elements[i].textContent || '').trim();
            if (text === 'Скачать') {
                elements[i].click();
                return text;
            }
        }
        return null;
    """)
    
    if download_link:
        print(f"   ✓ Ссылка нажата: '{download_link}'")
    else:
        print("   ✗ Ссылка 'Скачать' не найдена")
    
    # Ждем генерации файла
    print("\n10. Ожидание генерации файла (30 сек)...")
    time.sleep(30)
    
    print("\n" + "="*70)
    print("ПРОЦЕСС ЗАВЕРШЕН!")
    print("="*70)
    print("\nТеперь файл должен быть доступен для скачивания через прямую ссылку.")
    print("Нажмите Enter для закрытия браузера...")
    input()
    
finally:
    driver.quit()
    print("Браузер закрыт")
