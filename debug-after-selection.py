#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Отладка: сохранение HTML после выбора CSV и UTF-8
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
    url = 'https://rp5.ru/archive.php?wmo_id=28573&lang=ru'
    print("1. Открытие страницы...")
    driver.get(url)
    time.sleep(5)
    
    print("2. Переключение на вкладку...")
    download_tab = driver.find_element(By.ID, 'tabSynopDLoad')
    download_tab.click()
    time.sleep(3)
    
    print("3. Заполнение дат...")
    date_start_input = driver.find_element(By.ID, 'calender_dload')
    date_end_input = driver.find_element(By.ID, 'calender_dload2')
    driver.execute_script("arguments[0].value = '01.01.2016';", date_start_input)
    driver.execute_script("arguments[0].value = '31.03.2026';", date_end_input)
    time.sleep(2)
    
    print("4. Выбор CSV...")
    driver.execute_script("""
        var csvRadio = document.querySelector('input[name="f_pe"][value="3"]');
        if (csvRadio) csvRadio.click();
    """)
    time.sleep(3)  # Ждем появления опций
    
    print("5. Выбор UTF-8...")
    driver.execute_script("""
        var utf8Radio = document.getElementById('format1');
        if (utf8Radio) utf8Radio.click();
    """)
    time.sleep(2)
    
    print("6. Поиск всех кнопок...")
    buttons_info = driver.execute_script("""
        var result = [];
        var allButtons = document.querySelectorAll('input, button');
        
        allButtons.forEach(function(btn) {
            if (btn.type === 'submit' || btn.type === 'button') {
                var isVisible = btn.offsetParent !== null;
                result.push({
                    tag: btn.tagName,
                    type: btn.type,
                    id: btn.id,
                    name: btn.name,
                    value: btn.value || '',
                    text: btn.textContent || '',
                    visible: isVisible,
                    form: btn.form ? btn.form.name : 'no form'
                });
            }
        });
        
        return result;
    """)
    
    print(f"\nНайдено кнопок: {len(buttons_info)}")
    print("\nВСЕ КНОПКИ:")
    for i, btn in enumerate(buttons_info, 1):
        print(f"\n{i}. {btn['tag']} - {btn['type']}")
        print(f"   ID: {btn['id']}")
        print(f"   Name: {btn['name']}")
        print(f"   Value: {btn['value'][:50]}")
        print(f"   Text: {btn['text'][:50]}")
        print(f"   Visible: {btn['visible']}")
        print(f"   Form: {btn['form']}")
    
    print("\n7. Сохранение HTML...")
    html = driver.page_source
    with open('after-selection.html', 'w', encoding='utf-8') as f:
        f.write(html)
    
    print("\n8. Сохранение скриншота...")
    driver.save_screenshot('after-selection.png')
    
    print("\nГотово! Проверьте файлы:")
    print("  - after-selection.html")
    print("  - after-selection.png")
    
    time.sleep(3)
    
finally:
    driver.quit()
    print("\nБраузер закрыт")
