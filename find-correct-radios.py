#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Поиск ВСЕХ радиокнопок на странице
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
    print("Открытие страницы...")
    driver.get(url)
    time.sleep(5)
    
    print("Переключение на вкладку...")
    download_tab = driver.find_element(By.ID, 'tabSynopDLoad')
    download_tab.click()
    time.sleep(3)
    
    print("\n" + "="*70)
    print("ВСЕ РАДИОКНОПКИ НА СТРАНИЦЕ:")
    print("="*70)
    
    radios_info = driver.execute_script("""
        var result = [];
        var radios = document.querySelectorAll('input[type="radio"]');
        
        radios.forEach(function(radio) {
            // Ищем текст рядом с радиокнопкой
            var label = '';
            var labels = document.querySelectorAll('label');
            for (var i = 0; i < labels.length; i++) {
                if (labels[i].htmlFor === radio.id || labels[i].contains(radio)) {
                    label = labels[i].textContent.trim();
                    break;
                }
            }
            
            // Если label не найден, берем текст из родителя
            if (!label && radio.parentElement) {
                label = radio.parentElement.textContent.trim().substring(0, 50);
            }
            
            result.push({
                name: radio.name,
                value: radio.value,
                id: radio.id,
                checked: radio.checked,
                label: label
            });
        });
        
        return result;
    """)
    
    # Группируем по name
    groups = {}
    for radio in radios_info:
        name = radio['name']
        if name not in groups:
            groups[name] = []
        groups[name].append(radio)
    
    for name, radios in groups.items():
        print(f"\nГруппа: name='{name}'")
        for radio in radios:
            checked = "✓" if radio['checked'] else " "
            print(f"  [{checked}] value='{radio['value']}', id='{radio['id']}'")
            if radio['label']:
                print(f"      label: {radio['label'][:60]}")
    
    print("\n" + "="*70)
    print("Нажмите Enter для закрытия...")
    input()
    
finally:
    driver.quit()
    print("Браузер закрыт")
