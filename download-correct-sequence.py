#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Правильная последовательность скачивания с RP5
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
    print("СКАЧИВАНИЕ АРХИВА RP5")
    print("="*70)
    
    # 1. Открываем страницу
    url = 'https://rp5.ru/archive.php?wmo_id=28573&lang=ru'
    print("\n1. Открытие страницы...")
    driver.get(url)
    time.sleep(5)
    
    # 2. Переключаемся на вкладку "Скачать архив погоды"
    print("2. Переключение на вкладку 'Скачать архив погоды'...")
    download_tab = driver.find_element(By.ID, 'tabSynopDLoad')
    download_tab.click()
    time.sleep(3)
    print("   ✓ Вкладка открыта")
    
    # 3. Выбираем "Диапазон дат" (f_pe=2)
    print("\n3. Выбор 'Диапазон дат'...")
    driver.execute_script("""
        var rangeRadio = document.querySelector('input[name="f_pe"][value="2"]');
        if (rangeRadio) rangeRadio.click();
    """)
    time.sleep(2)
    print("   ✓ Диапазон дат выбран")
    
    # 4. Заполняем даты
    print("\n4. Заполнение дат...")
    date_start_input = driver.find_element(By.ID, 'calender_dload')
    date_end_input = driver.find_element(By.ID, 'calender_dload2')
    driver.execute_script("arguments[0].value = '01.01.2016';", date_start_input)
    driver.execute_script("arguments[0].value = '31.03.2026';", date_end_input)
    print("   ✓ Даты: 01.01.2016 - 31.03.2026")
    time.sleep(2)
    
    # 5. Прокручиваем вниз к разделу "Формат"
    print("\n5. Прокрутка к разделу 'Формат'...")
    driver.execute_script("window.scrollBy(0, 300);")
    time.sleep(1)
    
    # 6. Выбираем CSV (f_pe=3)
    print("\n6. Выбор формата CSV...")
    driver.execute_script("""
        var csvRadio = document.querySelector('input[name="f_pe"][value="3"]');
        if (csvRadio) csvRadio.click();
    """)
    time.sleep(3)  # Ждем появления опций кодировки
    print("   ✓ CSV выбран")
    
    # 7. Выбираем UTF-8 (format1)
    print("\n7. Выбор кодировки UTF-8...")
    driver.execute_script("""
        var utf8Radio = document.getElementById('format1');
        if (utf8Radio) utf8Radio.click();
    """)
    time.sleep(2)
    print("   ✓ UTF-8 выбран")
    
    # 8. Ищем и нажимаем кнопку "Выбрать в файл GZ"
    print("\n8. Поиск кнопки 'Выбрать в файл GZ'...")
    
    # Ищем все input элементы и выводим их
    buttons_info = driver.execute_script("""
        var result = [];
        var inputs = document.querySelectorAll('input[type="button"], input[type="submit"]');
        inputs.forEach(function(inp) {
            if (inp.offsetParent !== null) {  // Только видимые
                result.push({
                    value: inp.value,
                    id: inp.id,
                    name: inp.name
                });
            }
        });
        return result;
    """)
    
    print(f"   Найдено видимых кнопок: {len(buttons_info)}")
    for btn in buttons_info:
        print(f"     - value='{btn['value']}', id='{btn['id']}', name='{btn['name']}'")
    
    # Кликаем по кнопке с текстом содержащим "файл"
    button_clicked = driver.execute_script("""
        var inputs = document.querySelectorAll('input[type="button"], input[type="submit"]');
        for (var i = 0; i < inputs.length; i++) {
            var val = inputs[i].value || '';
            if (val.includes('файл') || val.includes('Выбрать')) {
                inputs[i].click();
                return val;
            }
        }
        return null;
    """)
    
    if button_clicked:
        print(f"   ✓ Кнопка нажата: '{button_clicked}'")
    else:
        print("   ✗ Кнопка не найдена!")
    
    # 9. Ждем появления ссылки "Скачать"
    print("\n9. Ожидание появления ссылки 'Скачать' (7 сек)...")
    time.sleep(7)
    
    # 10. Ищем и кликаем ссылку "Скачать"
    print("\n10. Поиск ссылки 'Скачать'...")
    
    download_link = driver.execute_script("""
        var links = document.querySelectorAll('a');
        for (var i = 0; i < links.length; i++) {
            var text = (links[i].textContent || '').trim();
            if (text === 'Скачать' || text.includes('Скачать')) {
                links[i].click();
                return text;
            }
        }
        return null;
    """)
    
    if download_link:
        print(f"   ✓ Ссылка нажата: '{download_link}'")
    else:
        print("   ✗ Ссылка 'Скачать' не найдена")
    
    # 11. Ждем генерации файла
    print("\n11. Ожидание генерации файла (30 сек)...")
    time.sleep(30)
    
    print("\n" + "="*70)
    print("ГОТОВО!")
    print("="*70)
    print("\nНажмите Enter для закрытия...")
    input()
    
finally:
    driver.quit()
    print("Браузер закрыт")
