#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тест генерации файлов на RP5

Этот скрипт тестирует различные варианты запросов для инициации генерации.
"""

import requests
import time
import json

def test_generation_method_1():
    """
    Метод 1: POST на reFileSynopShort.php
    """
    print("\n" + "="*70)
    print("ТЕСТ 1: POST на reFileSynopShort.php")
    print("="*70)
    
    session = requests.Session()
    
    # Получаем cookies
    print("\n[1] Получение cookies...")
    response = session.get('https://rp5.ru/')
    print(f"    Cookies: {dict(session.cookies)}")
    
    # Отправляем POST
    print("\n[2] Отправка POST запроса...")
    
    data = {
        'wmo_id': '26063',
        'a_date1': '01.01.2024',
        'a_date2': '31.12.2024',
        'f_ed3': '12',
        'f_ed4': '1',
        'f_ed5': '1',
        'f_pe': '1',
        'f_pe1': '01.01.2024',
        'f_pe2': '31.12.2024',
        'lng_id': '2'
    }
    
    headers = {
        'Accept': '*/*',
        'Accept-Language': 'ru-RU,ru;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://rp5.ru',
        'Referer': 'https://rp5.ru/archive.php?wmo_id=26063&lang=ru',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest'
    }
    
    response = session.post(
        'https://rp5.ru/responses/reFileSynopShort.php',
        data=data,
        headers=headers,
        timeout=30
    )
    
    print(f"    Status: {response.status_code}")
    print(f"    Response: {response.text[:500]}")
    
    return response.status_code == 200


def test_generation_method_2():
    """
    Метод 2: POST на reFileSynop.php (полная версия)
    """
    print("\n" + "="*70)
    print("ТЕСТ 2: POST на reFileSynop.php")
    print("="*70)
    
    session = requests.Session()
    
    # Получаем cookies
    print("\n[1] Получение cookies...")
    response = session.get('https://rp5.ru/')
    print(f"    Cookies: {dict(session.cookies)}")
    
    # Отправляем POST
    print("\n[2] Отправка POST запроса...")
    
    data = {
        'wmo_id': '26063',
        'a_date1': '01.01.2024',
        'a_date2': '31.12.2024',
        'f_ed3': '12',
        'f_ed4': '1',
        'f_ed5': '1',
        'lng_id': '2'
    }
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://rp5.ru/archive.php?wmo_id=26063&lang=ru',
        'X-Requested-With': 'XMLHttpRequest'
    }
    
    response = session.post(
        'https://rp5.ru/responses/reFileSynop.php',
        data=data,
        headers=headers,
        timeout=30
    )
    
    print(f"    Status: {response.status_code}")
    print(f"    Response: {response.text[:500]}")
    
    return response.status_code == 200


def test_direct_download_after_manual():
    """
    Метод 3: Прямое скачивание (предполагая, что файл уже сгенерирован вручную)
    """
    print("\n" + "="*70)
    print("ТЕСТ 3: Прямое скачивание")
    print("="*70)
    
    session = requests.Session()
    
    # Получаем cookies
    print("\n[1] Получение cookies...")
    response = session.get('https://rp5.ru/')
    
    # Пробуем скачать
    print("\n[2] Попытка скачивания...")
    
    url = "https://ru1.rp5.ru/download/files.synop/26/26063.01.01.2024.31.12.2024.1.0.0.ru.utf8.00000000.csv.gz"
    
    response = session.get(url, timeout=30)
    
    print(f"    Status: {response.status_code}")
    
    if response.status_code == 200:
        print(f"    Size: {len(response.content)} bytes")
        print("    [OK] Файл доступен!")
        return True
    elif response.status_code == 403:
        print("    [FAIL] 403 Forbidden - файл не сгенерирован")
        return False
    else:
        print(f"    [FAIL] Unexpected status: {response.status_code}")
        return False


def test_full_cycle():
    """
    Метод 4: Полный цикл - генерация + ожидание + скачивание
    """
    print("\n" + "="*70)
    print("ТЕСТ 4: Полный цикл (генерация + скачивание)")
    print("="*70)
    
    session = requests.Session()
    
    # Шаг 1: Получаем cookies
    print("\n[1] Получение cookies...")
    response = session.get('https://rp5.ru/')
    print(f"    Cookies: {dict(session.cookies)}")
    
    # Шаг 2: Инициируем генерацию
    print("\n[2] Инициация генерации...")
    
    data = {
        'wmo_id': '26063',
        'a_date1': '01.01.2024',
        'a_date2': '31.12.2024',
        'f_ed3': '12',
        'f_ed4': '1',
        'f_ed5': '1',
        'lng_id': '2'
    }
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://rp5.ru/archive.php?wmo_id=26063&lang=ru',
        'X-Requested-With': 'XMLHttpRequest'
    }
    
    response = session.post(
        'https://rp5.ru/responses/reFileSynopShort.php',
        data=data,
        headers=headers,
        timeout=30
    )
    
    print(f"    Status: {response.status_code}")
    print(f"    Response: {response.text[:200]}")
    
    if response.status_code != 200:
        print("    [FAIL] Не удалось инициировать генерацию")
        return False
    
    # Шаг 3: Ждем
    wait_time = 5
    print(f"\n[3] Ожидание {wait_time} секунд...")
    time.sleep(wait_time)
    
    # Шаг 4: Пробуем скачать
    print("\n[4] Попытка скачивания...")
    
    url = "https://ru1.rp5.ru/download/files.synop/26/26063.01.01.2024.31.12.2024.1.0.0.ru.utf8.00000000.csv.gz"
    
    for attempt in range(1, 4):
        print(f"    Попытка {attempt}/3...")
        
        response = session.get(url, timeout=30)
        
        if response.status_code == 200:
            print(f"    [OK] Файл скачан! Size: {len(response.content)} bytes")
            return True
        elif response.status_code == 403:
            print(f"    403 Forbidden - ждем еще...")
            time.sleep(3)
        else:
            print(f"    Status: {response.status_code}")
            break
    
    print("    [FAIL] Не удалось скачать файл")
    return False


def main():
    """Запуск всех тестов."""
    print("\n" + "="*70)
    print("ТЕСТИРОВАНИЕ ГЕНЕРАЦИИ ФАЙЛОВ НА RP5")
    print("="*70)
    
    results = {}
    
    # Тест 1
    try:
        results['method_1'] = test_generation_method_1()
    except Exception as e:
        print(f"\n[ERROR] Тест 1: {e}")
        results['method_1'] = False
    
    time.sleep(2)
    
    # Тест 2
    try:
        results['method_2'] = test_generation_method_2()
    except Exception as e:
        print(f"\n[ERROR] Тест 2: {e}")
        results['method_2'] = False
    
    time.sleep(2)
    
    # Тест 3
    try:
        results['method_3'] = test_direct_download_after_manual()
    except Exception as e:
        print(f"\n[ERROR] Тест 3: {e}")
        results['method_3'] = False
    
    time.sleep(2)
    
    # Тест 4
    try:
        results['method_4'] = test_full_cycle()
    except Exception as e:
        print(f"\n[ERROR] Тест 4: {e}")
        results['method_4'] = False
    
    # Итоги
    print("\n" + "="*70)
    print("ИТОГИ ТЕСТИРОВАНИЯ")
    print("="*70)
    
    for method, success in results.items():
        status = "[OK]" if success else "[FAIL]"
        print(f"{status} {method}")
    
    print("\n" + "="*70)
    
    # Рекомендации
    print("\nРЕКОМЕНДАЦИИ:")
    
    if results.get('method_4'):
        print("✓ Метод 4 работает - используйте полный цикл генерации")
    elif results.get('method_3'):
        print("✓ Прямое скачивание работает - файл уже сгенерирован")
        print("  Используйте ручную генерацию через браузер")
    else:
        print("✗ Автоматическая генерация не работает")
        print("  Возможные причины:")
        print("  1. Неверные параметры POST запроса")
        print("  2. RP5 блокирует автоматические запросы")
        print("  3. Требуется CAPTCHA или дополнительная авторизация")
        print("\n  Решения:")
        print("  1. Проанализировать запросы через DevTools")
        print("  2. Использовать Selenium для эмуляции браузера")
        print("  3. Генерировать файлы вручную и скачивать через скрипт")


if __name__ == '__main__':
    main()
