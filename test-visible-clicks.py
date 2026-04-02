#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тест с видимыми кликами и паузами
"""

import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

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
    print("   ✓ Даты установлены")
    time.sleep(2)
    
    print("\n4. Поиск радиокнопки CSV...")
    # Ищем все радиокнопки f_pe
    radios = driver.find_elements(By.NAME, 'f_pe')
    print(f"   Найдено радиокнопок f_pe: {len(radios)}")
    
    for i, radio in enumerate(radios):
        value = radio.get_attribute('value')
        print(f"   Radio {i+1}: value={value}")
        if value == '3':
            print(f"   Пробуем кликнуть по радиокнопке CSV (value=3)...")
            try:
                # Пробуем прокрутить к элементу
                driver.execute_script("arguments[0].scrollIntoView(true);", radio)
                time.sleep(1)
                
                # Пробуем кликнуть
                radio.click()
                print("   ✓ Клик выполнен через Selenium")
            except Exception as e:
                print(f"   ✗ Ошибка Selenium клика: {e}")
                print("   Пробуем JavaScript клик...")
                driver.execute_script("arguments[0].click();", radio)
                print("   ✓ JavaScript клик выполнен")
            
            time.sleep(3)
            break
    
    print("\n5. Проверка появления опций кодировки...")
    format_radios = driver.find_elements(By.NAME, 'format')
    print(f"   Найдено радиокнопок format: {len(format_radios)}")
    
    if len(format_radios) > 0:
        print("   ✓ Опции кодировки появились!")
        
        print("\n6. Выбор UTF-8 (format1)...")
        utf8_radio = driver.find_element(By.ID, 'format1')
        try:
            driver.execute_script("arguments[0].scrollIntoView(true);", utf8_radio)
            time.sleep(1)
            utf8_radio.click()
            print("   ✓ UTF-8 выбран через Selenium")
        except Exception as e:
            print(f"   ✗ Ошибка: {e}")
            driver.execute_script("arguments[0].click();", utf8_radio)
            print("   ✓ UTF-8 выбран через JavaScript")
        
        time.sleep(2)
    else:
        print("   ✗ Опции кодировки НЕ появились!")
    
    print("\n7. Поиск кнопки 'Выбрать в файл GZ (архив)'...")
    
    # Ищем по XPath с текстом
    try:
        button = driver.find_element(By.XPATH, "//input[@value[contains(., 'файл')]]")
        print(f"   ✓ Найдена кнопка: {button.get_attribute('value')}")
        
        print("\n8. Нажатие кнопки...")
        driver.execute_script("arguments[0].scrollIntoView(true);", button)
        time.sleep(1)
        button.click()
        print("   ✓ Кнопка нажата!")
        
    except Exception as e:
        print(f"   ✗ Кнопка не найдена: {e}")
        print("\n   Ищем все input элементы...")
        all_inputs = driver.find_elements(By.TAG_NAME, 'input')
        for inp in all_inputs:
            inp_type = inp.get_attribute('type')
            inp_value = inp.get_attribute('value')
            if inp_type in ['button', 'submit'] and inp_value:
                print(f"     - type={inp_type}, value={inp_value}")
    
    print("\n9. Ожидание появления ссылки 'Скачать' (7 сек)...")
    time.sleep(7)
    
    print("\n10. Поиск ссылки 'Скачать'...")
    try:
        download_link = driver.find_element(By.LINK_TEXT, 'Скачать')
        print("   ✓ Ссылка найдена!")
        download_link.click()
        print("   ✓ Ссылка нажата!")
    except Exception as e:
        print(f"   ✗ Ссылка не найдена: {e}")
    
    print("\n11. Ожидание 30 секунд для генерации файла...")
    time.sleep(30)
    
    print("\nГотово! Нажмите Enter для закрытия...")
    input()
    
finally:
    driver.quit()
    print("Браузер закрыт")
