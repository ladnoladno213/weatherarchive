#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Проверка готовности системы автообновления RP5
"""

import os
import sys
import json

def check_file(path, description):
    """Проверяет существование файла"""
    exists = os.path.exists(path)
    status = "✅" if exists else "❌"
    print(f"{status} {description}: {path}")
    return exists

def check_directory(path, description):
    """Проверяет существование директории"""
    exists = os.path.isdir(path)
    status = "✅" if exists else "❌"
    print(f"{status} {description}: {path}")
    return exists

def check_wmo_mapping():
    """Проверяет файл wmo-mapping.js"""
    path = 'data/wmo-mapping.js'
    if not os.path.exists(path):
        print(f"❌ Файл {path} не найден!")
        return False
    
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Проверяем что файл содержит module.exports
        if 'module.exports' not in content:
            print(f"❌ {path} не содержит module.exports!")
            return False
        
        # Считаем количество станций (примерно)
        station_count = content.count("'")
        print(f"✅ Файл wmo-mapping.js: найдено ~{station_count // 2} станций")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка чтения {path}: {e}")
        return False

def check_workflow():
    """Проверяет workflow файл"""
    path = '.github/workflows/rp5-frequent.yml'
    if not os.path.exists(path):
        print(f"❌ Файл {path} не найден!")
        return False
    
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем ключевые элементы
        checks = [
            ('schedule:', 'Расписание cron'),
            ('workflow_dispatch:', 'Ручной запуск'),
            ('rp5-realtime-updater.py', 'Скрипт обновления'),
            ('git commit', 'Коммит изменений'),
        ]
        
        all_ok = True
        for check, desc in checks:
            if check in content:
                print(f"  ✅ {desc}")
            else:
                print(f"  ❌ {desc} не найден!")
                all_ok = False
        
        return all_ok
        
    except Exception as e:
        print(f"❌ Ошибка чтения {path}: {e}")
        return False

def check_python_script():
    """Проверяет Python скрипт"""
    path = 'rp5-realtime-updater.py'
    if not os.path.exists(path):
        print(f"❌ Файл {path} не найден!")
        return False
    
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем ключевые функции
        checks = [
            ('def get_date_range', 'Функция получения дат'),
            ('def load_stations_list', 'Функция загрузки станций'),
            ('def download_station_quick', 'Функция скачивания'),
            ('from selenium import webdriver', 'Импорт Selenium'),
        ]
        
        all_ok = True
        for check, desc in checks:
            if check in content:
                print(f"  ✅ {desc}")
            else:
                print(f"  ❌ {desc} не найден!")
                all_ok = False
        
        return all_ok
        
    except Exception as e:
        print(f"❌ Ошибка чтения {path}: {e}")
        return False

def check_gitignore():
    """Проверяет что rp5-realtime не в .gitignore"""
    path = '.gitignore'
    if not os.path.exists(path):
        print("⚠️  Файл .gitignore не найден (это нормально)")
        return True
    
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'rp5-realtime' in content:
            print("❌ Папка rp5-realtime в .gitignore! Удалите эту строку!")
            return False
        else:
            print("✅ Папка rp5-realtime НЕ в .gitignore")
            return True
            
    except Exception as e:
        print(f"⚠️  Ошибка чтения .gitignore: {e}")
        return True

def main():
    """Основная функция проверки"""
    
    print("="*70)
    print("ПРОВЕРКА ГОТОВНОСТИ СИСТЕМЫ АВТООБНОВЛЕНИЯ RP5")
    print("="*70)
    print()
    
    results = []
    
    print("1. Проверка основных файлов:")
    print("-" * 70)
    results.append(check_file('.github/workflows/rp5-frequent.yml', 'GitHub Actions workflow'))
    results.append(check_file('rp5-realtime-updater.py', 'Python скрипт'))
    results.append(check_file('data/wmo-mapping.js', 'Маппинг станций'))
    print()
    
    print("2. Проверка директорий:")
    print("-" * 70)
    results.append(check_directory('data', 'Папка data'))
    results.append(check_directory('data/rp5-realtime', 'Папка для данных'))
    results.append(check_directory('.github', 'Папка .github'))
    results.append(check_directory('.github/workflows', 'Папка workflows'))
    print()
    
    print("3. Проверка содержимого wmo-mapping.js:")
    print("-" * 70)
    results.append(check_wmo_mapping())
    print()
    
    print("4. Проверка workflow файла:")
    print("-" * 70)
    results.append(check_workflow())
    print()
    
    print("5. Проверка Python скрипта:")
    print("-" * 70)
    results.append(check_python_script())
    print()
    
    print("6. Проверка .gitignore:")
    print("-" * 70)
    results.append(check_gitignore())
    print()
    
    print("7. Проверка документации:")
    print("-" * 70)
    docs = [
        'БЫСТРЫЙ-СТАРТ.md',
        'ЗАПУСК-GITHUB-ACTIONS.md',
        'ФИНАЛЬНАЯ-ПРОВЕРКА.md',
        'БЕСПЛАТНЫЕ-ВАРИАНТЫ.md',
        'README-АВТООБНОВЛЕНИЕ.md',
    ]
    for doc in docs:
        results.append(check_file(doc, f'Документация'))
    print()
    
    # Итоги
    print("="*70)
    total = len(results)
    passed = sum(results)
    failed = total - passed
    
    print(f"ИТОГО: {passed}/{total} проверок пройдено")
    
    if failed == 0:
        print()
        print("🎉 ВСЁ ГОТОВО К ЗАПУСКУ!")
        print()
        print("Следующие шаги:")
        print("1. git add .")
        print("2. git commit -m 'Add RP5 auto-update'")
        print("3. git push")
        print("4. Откройте GitHub → Actions → Run workflow")
        print()
        print("Подробнее: БЫСТРЫЙ-СТАРТ.md")
        return 0
    else:
        print()
        print(f"⚠️  Найдено {failed} проблем(ы)!")
        print()
        print("Исправьте ошибки выше и запустите проверку снова:")
        print("python check-setup.py")
        return 1

if __name__ == '__main__':
    sys.exit(main())
