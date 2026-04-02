#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
РАБОЧАЯ версия - на основе реальной структуры HTML
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
    
    url = 'https://rp5.ru/archive.php?wmo_id=28573&lang=ru'
    print("\n1. Открытие страницы...")
    driver.get(url)
    time.sleep(5)
    
    print("2. Переключение на вкладку 'Скачать архив погоды'...")
    download_tab = driver.find_element(By.ID, 'tabSynopDLoad')
    download_tab.click()
    time.sleep(3)
    print("   ✓ Вкладка открыта")
    
    print("\n3. Заполнение дат...")
    date_start_input = driver.find_element(By.ID, 'calender_dload')
    date_end_input = driver.find_element(By.ID, 'calender_dload2')
    driver.execute_script("arguments[0].value = '01.01.2016';", date_start_input)
    driver.execute_script("arguments[0].value = '31.03.2026';", date_end_input)
    print("   ✓ Даты: 01.01.2016 - 31.03.2026")
    time.sleep(1)
    
    print("\n4. Пропускаем строку 2 (уже выбрано 'все дни' по умолчанию)")
    
    print("\n5. Выбор формата CSV (name='format', value='f_csv')...")
    driver.execute_script("""
        var csvRadio = document.querySelector('input[name="format"][value="f_csv"]');
        if (csvRadio) {
            csvRadio.click();
            return true;
        }
        return false;
    """)
    time.sleep(3)  # Ждем появления кодировок
    print("   ✓ CSV выбран")
    
    print("\n6. Выбор кодировки UTF-8 (id='coding2')...")
    driver.execute_script("""
        var utf8Radio = document.getElementById('coding2');
        if (utf8Radio) {
            utf8Radio.click();
            return true;
        }
        return false;
    """)
    time.sleep(2)
    print("   ✓ UTF-8 выбран")
    
    print("\n7. Поиск кнопки 'Выбрать в файл GZ (архив)'...")
    button_clicked = driver.execute_script("""
        // Ищем div с классом archButton
        var buttons = document.querySelectorAll('.archButton');
        for (var i = 0; i < buttons.length; i++) {
            var text = buttons[i].textContent || '';
            if (text.includes('Выбрать') && text.includes('файл')) {
                buttons[i].click();
                return text.trim();
            }
        }
        return null;
    """)
    
    if button_clicked:
        print(f"   ✓ Кнопка нажата: '{button_clicked}'")
    else:
        print("   ✗ Кнопка не найдена")
    
    print("\n8. Ожидание появления ссылки 'Скачать' (7 сек)...")
    time.sleep(7)
    
    print("\n9. Поиск ссылки 'Скачать' (span id='f_result')...")
    download_link = driver.execute_script("""
        // Ищем span с id f_result
        var resultSpan = document.getElementById('f_result');
        if (resultSpan) {
            // Ищем ссылку внутри
            var link = resultSpan.querySelector('a');
            if (link) {
                link.click();
                return link.href;
            }
        }
        return null;
    """)
    
    if download_link:
        print(f"   ✓ Ссылка нажата!")
        print(f"   URL: {download_link}")
    else:
        print("   ✗ Ссылка не найдена")
    
    print("\n10. Ожидание генерации файла (30 сек)...")
    time.sleep(30)
    
    print("\n" + "="*70)
    print("ГОТОВО!")
    print("="*70)
    print("\nНажмите Enter для закрытия...")
    input()
    
finally:
    driver.quit()
    print("Браузер закрыт")
