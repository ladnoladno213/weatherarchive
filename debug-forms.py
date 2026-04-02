#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Отладочный скрипт для поиска форм на странице RP5
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
    print(f"Открытие: {url}")
    driver.get(url)
    
    time.sleep(5)
    
    # Переключаемся на вкладку
    print("\nПереключение на вкладку 'Скачать архив погоды'...")
    download_tab = driver.find_element(By.ID, 'tabSynopDLoad')
    download_tab.click()
    time.sleep(3)
    
    # Ищем все формы
    print("\n" + "="*70)
    print("ВСЕ ФОРМЫ НА СТРАНИЦЕ:")
    print("="*70)
    
    forms = driver.find_elements(By.TAG_NAME, 'form')
    print(f"\nНайдено форм: {len(forms)}")
    
    for i, form in enumerate(forms, 1):
        form_id = form.get_attribute('id')
        form_name = form.get_attribute('name')
        form_action = form.get_attribute('action')
        
        print(f"\nФорма #{i}:")
        print(f"  ID: {form_id}")
        print(f"  Name: {form_name}")
        print(f"  Action: {form_action}")
        
        # Ищем все input поля в форме
        inputs = form.find_elements(By.TAG_NAME, 'input')
        if inputs:
            print(f"  Input полей: {len(inputs)}")
            for inp in inputs[:10]:  # Показываем первые 10
                inp_id = inp.get_attribute('id')
                inp_name = inp.get_attribute('name')
                inp_type = inp.get_attribute('type')
                inp_value = inp.get_attribute('value')
                print(f"    - ID={inp_id}, Name={inp_name}, Type={inp_type}, Value={inp_value[:30] if inp_value else ''}")
    
    print("\n" + "="*70)
    print("ПОИСК ЭЛЕМЕНТОВ С 'date' В ID/NAME:")
    print("="*70)
    
    # Ищем все элементы с 'date' в атрибутах
    all_elements = driver.find_elements(By.XPATH, "//*[contains(@id, 'date') or contains(@name, 'date')]")
    print(f"\nНайдено элементов: {len(all_elements)}")
    
    for elem in all_elements[:20]:  # Показываем первые 20
        tag = elem.tag_name
        elem_id = elem.get_attribute('id')
        elem_name = elem.get_attribute('name')
        elem_type = elem.get_attribute('type')
        elem_class = elem.get_attribute('class')
        
        print(f"\n  Tag: {tag}")
        print(f"    ID: {elem_id}")
        print(f"    Name: {elem_name}")
        print(f"    Type: {elem_type}")
        print(f"    Class: {elem_class}")
    
    # Сохраняем в файл
    print("\n" + "="*70)
    print("Сохранение в файл forms-debug.txt...")
    
    with open('forms-debug.txt', 'w', encoding='utf-8') as f:
        f.write("="*70 + "\n")
        f.write("ВСЕ ФОРМЫ НА СТРАНИЦЕ:\n")
        f.write("="*70 + "\n")
        f.write(f"\nНайдено форм: {len(forms)}\n")
        
        for i, form in enumerate(forms, 1):
            form_id = form.get_attribute('id')
            form_name = form.get_attribute('name')
            form_action = form.get_attribute('action')
            
            f.write(f"\nФорма #{i}:\n")
            f.write(f"  ID: {form_id}\n")
            f.write(f"  Name: {form_name}\n")
            f.write(f"  Action: {form_action}\n")
            
            inputs = form.find_elements(By.TAG_NAME, 'input')
            if inputs:
                f.write(f"  Input полей: {len(inputs)}\n")
                for inp in inputs:
                    inp_id = inp.get_attribute('id')
                    inp_name = inp.get_attribute('name')
                    inp_type = inp.get_attribute('type')
                    inp_value = inp.get_attribute('value')
                    f.write(f"    - ID={inp_id}, Name={inp_name}, Type={inp_type}, Value={inp_value[:30] if inp_value else ''}\n")
        
        f.write("\n" + "="*70 + "\n")
        f.write("ЭЛЕМЕНТЫ С 'date' В ID/NAME:\n")
        f.write("="*70 + "\n")
        f.write(f"\nНайдено элементов: {len(all_elements)}\n")
        
        for elem in all_elements:
            tag = elem.tag_name
            elem_id = elem.get_attribute('id')
            elem_name = elem.get_attribute('name')
            elem_type = elem.get_attribute('type')
            elem_class = elem.get_attribute('class')
            
            f.write(f"\n  Tag: {tag}\n")
            f.write(f"    ID: {elem_id}\n")
            f.write(f"    Name: {elem_name}\n")
            f.write(f"    Type: {elem_type}\n")
            f.write(f"    Class: {elem_class}\n")
    
    print("Готово! Проверьте файл forms-debug.txt")
    
finally:
    driver.quit()
    print("Браузер закрыт")
