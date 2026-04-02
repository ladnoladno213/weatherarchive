#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Поиск кнопки скачивания в форме f_farchive
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
    print(f"Открытие: {url}")
    driver.get(url)
    time.sleep(5)
    
    print("\nПереключение на вкладку...")
    download_tab = driver.find_element(By.ID, 'tabSynopDLoad')
    download_tab.click()
    time.sleep(3)
    
    print("\nПоиск всех элементов в форме f_farchive...")
    form_elements = driver.execute_script("""
        var form = document.querySelector('form[name="f_farchive"]');
        if (!form) return {error: 'Form not found'};
        
        var elements = [];
        
        // Все input элементы
        var inputs = form.querySelectorAll('input');
        inputs.forEach(function(inp) {
            elements.push({
                tag: 'input',
                type: inp.type,
                id: inp.id,
                name: inp.name,
                value: inp.value,
                onclick: inp.onclick ? 'has onclick' : 'no onclick'
            });
        });
        
        // Все button элементы
        var buttons = form.querySelectorAll('button');
        buttons.forEach(function(btn) {
            elements.push({
                tag: 'button',
                type: btn.type,
                id: btn.id,
                name: btn.name,
                text: btn.textContent.trim(),
                onclick: btn.onclick ? 'has onclick' : 'no onclick'
            });
        });
        
        return {elements: elements, formAction: form.action};
    """)
    
    if 'error' in form_elements:
        print(f"ОШИБКА: {form_elements['error']}")
    else:
        print(f"\nForm action: {form_elements['formAction']}")
        print(f"\nНайдено элементов: {len(form_elements['elements'])}")
        print("\nВСЕ ЭЛЕМЕНТЫ ФОРМЫ:")
        for i, elem in enumerate(form_elements['elements'], 1):
            print(f"\n{i}. {elem['tag'].upper()}")
            for key, value in elem.items():
                if key != 'tag':
                    print(f"   {key}: {value}")
    
    print("\n" + "="*70)
    print("Сохранение в файл button-search.txt...")
    
    with open('button-search.txt', 'w', encoding='utf-8') as f:
        f.write("="*70 + "\n")
        f.write("ЭЛЕМЕНТЫ ФОРМЫ f_farchive\n")
        f.write("="*70 + "\n")
        if 'error' not in form_elements:
            f.write(f"\nForm action: {form_elements['formAction']}\n")
            f.write(f"\nНайдено элементов: {len(form_elements['elements'])}\n\n")
            for i, elem in enumerate(form_elements['elements'], 1):
                f.write(f"\n{i}. {elem['tag'].upper()}\n")
                for key, value in elem.items():
                    if key != 'tag':
                        f.write(f"   {key}: {value}\n")
    
    print("Готово!")
    time.sleep(2)
    
finally:
    driver.quit()
    print("Браузер закрыт")
