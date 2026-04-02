#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тестовый скрипт для отладки взаимодействия с формой RP5
"""

import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By

# Настройка Chrome
options = webdriver.ChromeOptions()
chrome_binary_path = os.path.join(os.getcwd(), 'chrome-win64', 'chrome-win64', 'chrome.exe')
options.binary_location = chrome_binary_path

chrome_driver_path = os.path.join(os.getcwd(), 'chromedriver-win64', 'chromedriver.exe')
service = Service(chrome_driver_path)

driver = webdriver.Chrome(service=service, options=options)

try:
    # Открываем страницу
    url = 'https://rp5.ru/archive.php?wmo_id=28573&lang=ru'
    print(f"1. Открытие: {url}")
    driver.get(url)
    time.sleep(5)
    
    # Переключаемся на вкладку
    print("\n2. Переключение на вкладку 'Скачать архив погоды'...")
    download_tab = driver.find_element(By.ID, 'tabSynopDLoad')
    download_tab.click()
    time.sleep(3)
    print("   Вкладка открыта")
    
    # Заполняем даты
    print("\n3. Заполнение дат...")
    date_start = '01.01.2016'
    date_end = '31.03.2026'
    
    date_start_input = driver.find_element(By.ID, 'calender_dload')
    date_end_input = driver.find_element(By.ID, 'calender_dload2')
    
    driver.execute_script(f"arguments[0].value = '{date_start}';", date_start_input)
    driver.execute_script(f"arguments[0].value = '{date_end}';", date_end_input)
    
    print(f"   Даты установлены: {date_start} - {date_end}")
    time.sleep(2)
    
    # Проверяем текущее состояние радиокнопок
    print("\n4. Проверка текущего состояния радиокнопок...")
    result = driver.execute_script("""
        var info = {
            f_pe_values: [],
            format_values: []
        };
        
        // Проверяем f_pe (тип данных)
        var fpeRadios = document.querySelectorAll('input[name="f_pe"]');
        fpeRadios.forEach(function(radio) {
            info.f_pe_values.push({
                value: radio.value,
                checked: radio.checked,
                visible: radio.offsetParent !== null
            });
        });
        
        // Проверяем format (кодировка)
        var formatRadios = document.querySelectorAll('input[name="format"]');
        formatRadios.forEach(function(radio) {
            info.format_values.push({
                id: radio.id,
                value: radio.value,
                checked: radio.checked,
                visible: radio.offsetParent !== null
            });
        });
        
        return info;
    """)
    
    print("   Радиокнопки f_pe (тип данных):")
    for item in result['f_pe_values']:
        print(f"     value={item['value']}, checked={item['checked']}, visible={item['visible']}")
    
    print("   Радиокнопки format (кодировка):")
    for item in result['format_values']:
        print(f"     id={item['id']}, value={item['value']}, checked={item['checked']}, visible={item['visible']}")
    
    # Выбираем CSV (f_pe=3)
    print("\n5. Выбор 'только CSV' (f_pe=3)...")
    driver.execute_script("""
        var csvRadio = document.querySelector('input[name="f_pe"][value="3"]');
        if (csvRadio) {
            csvRadio.checked = true;
            // Триггерим событие change
            var event = new Event('change', { bubbles: true });
            csvRadio.dispatchEvent(event);
            return 'OK';
        }
        return 'NOT FOUND';
    """)
    time.sleep(2)
    print("   Выбрано")
    
    # Выбираем UTF-8 (format1)
    print("\n6. Выбор кодировки UTF-8 (format1)...")
    driver.execute_script("""
        var utf8Radio = document.getElementById('format1');
        if (utf8Radio) {
            utf8Radio.checked = true;
            var event = new Event('change', { bubbles: true });
            utf8Radio.dispatchEvent(event);
            return 'OK';
        }
        return 'NOT FOUND';
    """)
    time.sleep(2)
    print("   Выбрано")
    
    # Проверяем состояние после выбора
    print("\n7. Проверка состояния ПОСЛЕ выбора...")
    result2 = driver.execute_script("""
        var info = {
            f_pe_checked: null,
            format_checked: null
        };
        
        var fpeRadios = document.querySelectorAll('input[name="f_pe"]');
        fpeRadios.forEach(function(radio) {
            if (radio.checked) info.f_pe_checked = radio.value;
        });
        
        var formatRadios = document.querySelectorAll('input[name="format"]');
        formatRadios.forEach(function(radio) {
            if (radio.checked) info.format_checked = radio.value;
        });
        
        return info;
    """)
    
    print(f"   f_pe выбрано: {result2['f_pe_checked']}")
    print(f"   format выбрано: {result2['format_checked']}")
    
    # Ищем кнопку скачивания
    print("\n8. Поиск кнопки скачивания...")
    buttons_info = driver.execute_script("""
        var buttons = [];
        var allButtons = document.querySelectorAll('input[type="submit"], input[type="button"]');
        allButtons.forEach(function(btn) {
            buttons.push({
                type: btn.type,
                value: btn.value,
                name: btn.name,
                form: btn.form ? btn.form.name : 'no form'
            });
        });
        return buttons;
    """)
    
    print("   Найденные кнопки:")
    for i, btn in enumerate(buttons_info, 1):
        print(f"     {i}. type={btn['type']}, value={btn['value']}, name={btn['name']}, form={btn['form']}")
    
    print("\n9. Нажмите Enter чтобы нажать кнопку скачивания...")
    input()
    
    # Нажимаем кнопку
    print("\n10. Нажатие кнопки...")
    result3 = driver.execute_script("""
        var buttons = document.querySelectorAll('input[type="submit"], input[type="button"]');
        for (var i = 0; i < buttons.length; i++) {
            if (buttons[i].value && buttons[i].value.includes('файл')) {
                buttons[i].click();
                return 'Clicked: ' + buttons[i].value;
            }
        }
        return 'Button not found';
    """)
    print(f"   Результат: {result3}")
    
    print("\n11. Нажмите Enter для закрытия браузера...")
    input()
    
finally:
    driver.quit()
    print("Браузер закрыт")
