#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RP5 Monthly Update Script
Запускай этот скрипт раз в месяц на своем компьютере
Он скачает архивы и автоматически закоммитит в GitHub
"""

import os
import sys
import time
import gzip
import logging
import requests
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Список станций для обновления
STATIONS = [
    {
        'wmo_id': '28573',
        'name': 'Ишим',
        'start_date': '01.01.2005',  # Начало архива
    },
    # Добавь другие станции здесь
]


def download_station(wmo_id, start_date, name):
    """Скачивает архив для одной станции"""
    
    # Конечная дата - сегодня
    end_date = datetime.now().strftime('%d.%m.%Y')
    
    logger.info(f"\n{'='*70}")
    logger.info(f"Станция: {name} (WMO {wmo_id})")
    logger.info(f"Период: {start_date} - {end_date}")
    logger.info(f"{'='*70}")
    
    output_dir = Path('data/rp5-csv')
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Настройка Chrome
    options = Options()
    options.add_argument('--start-maximized')
    options.add_argument('--disable-blink-features=AutomationControlled')
    
    # Настройка автоматического скачивания
    prefs = {
        'download.default_directory': str(output_dir.absolute()),
        'download.prompt_for_download': False,
        'download.directory_upgrade': True,
        'safebrowsing.enabled': True
    }
    options.add_experimental_option('prefs', prefs)
    
    driver = webdriver.Chrome(options=options)
    
    try:
        # 1. Открываем страницу
        url = f'https://rp5.ru/archive.php?wmo_id={wmo_id}&lang=ru'
        logger.info(f"Открываем {url}")
        driver.get(url)
        time.sleep(5)
        
        # 2. Переключаемся на вкладку скачивания
        logger.info("Переключаемся на вкладку 'Скачать архив'")
        download_tab = driver.find_element(By.ID, 'tabSynopDLoad')
        download_tab.click()
        time.sleep(3)
        
        # 3. Заполняем даты
        logger.info(f"Заполняем даты: {start_date} - {end_date}")
        driver.execute_script(f"""
            document.getElementById('calender_dload').value = '{start_date}';
            document.getElementById('calender_dload2').value = '{end_date}';
        """)
        time.sleep(1)
        
        # 4. Выбираем CSV
        logger.info("Выбираем формат CSV")
        driver.execute_script("""
            var csvRadio = document.querySelector('input[name="format"][value="f_csv"]');
            if (csvRadio) csvRadio.click();
        """)
        time.sleep(3)
        
        # 5. Выбираем UTF-8
        logger.info("Выбираем кодировку UTF-8")
        driver.execute_script("""
            var utf8Radio = document.getElementById('coding2');
            if (utf8Radio) utf8Radio.click();
        """)
        time.sleep(2)
        
        # 6. Нажимаем кнопку "Выбрать в файл GZ"
        logger.info("Нажимаем кнопку 'Выбрать в файл'")
        driver.execute_script("""
            var buttons = document.querySelectorAll('.archButton');
            for (var i = 0; i < buttons.length; i++) {
                var text = buttons[i].textContent || '';
                if (text.includes('Выбрать') && text.includes('файл')) {
                    buttons[i].click();
                    break;
                }
            }
        """)
        time.sleep(7)
        
        # 7. Получаем URL файла
        download_url = driver.execute_script("""
            var resultSpan = document.getElementById('f_result');
            if (resultSpan) {
                var link = resultSpan.querySelector('a');
                if (link) return link.href;
            }
            return null;
        """)
        
        if not download_url:
            logger.error("URL файла не найден")
            return False
        
        logger.info(f"URL получен: {download_url}")
        
        # 8. Ждем генерации файла
        logger.info("Ожидание генерации файла (30 сек)...")
        time.sleep(30)
        
        # 9. Скачиваем файл
        logger.info("Скачивание файла...")
        response = requests.get(download_url, timeout=120)
        
        if response.status_code == 200:
            # Сохраняем .gz
            gz_filename = f"{wmo_id}.csv.gz"
            gz_path = output_dir / gz_filename
            with open(gz_path, 'wb') as f:
                f.write(response.content)
            
            logger.info(f"Скачано: {len(response.content)} байт")
            
            # Распаковываем
            csv_filename = f"{wmo_id}.csv"
            csv_path = output_dir / csv_filename
            with gzip.open(gz_path, 'rb') as f_in:
                with open(csv_path, 'wb') as f_out:
                    f_out.write(f_in.read())
            
            # Удаляем .gz
            gz_path.unlink()
            
            logger.info(f"✅ Файл сохранен: {csv_path}")
            return True
        else:
            logger.error(f"Ошибка скачивания: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"Ошибка: {e}")
        return False
    finally:
        driver.quit()


def git_commit_and_push():
    """Коммитит и пушит изменения в GitHub"""
    
    logger.info("\n" + "="*70)
    logger.info("КОММИТ И ПУШ В GITHUB")
    logger.info("="*70)
    
    try:
        # Проверяем, есть ли изменения
        result = subprocess.run(
            ['git', 'status', '--porcelain'],
            capture_output=True,
            text=True
        )
        
        if not result.stdout.strip():
            logger.info("Нет изменений для коммита")
            return True
        
        # Добавляем файлы
        logger.info("Добавляем файлы...")
        subprocess.run(['git', 'add', 'data/rp5-csv/*.csv'], check=True)
        
        # Коммитим
        commit_message = f"Update RP5 archives - {datetime.now().strftime('%Y-%m-%d')}"
        logger.info(f"Коммитим: {commit_message}")
        subprocess.run(['git', 'commit', '-m', commit_message], check=True)
        
        # Пушим
        logger.info("Пушим в GitHub...")
        subprocess.run(['git', 'push', 'origin', 'main'], check=True)
        
        logger.info("✅ Успешно запушено в GitHub!")
        return True
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Ошибка Git: {e}")
        return False


def main():
    """Основная функция"""
    
    print("\n" + "="*70)
    print("RP5 MONTHLY UPDATE SCRIPT")
    print("="*70)
    print(f"Дата: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Станций для обновления: {len(STATIONS)}")
    print("="*70)
    
    input("\nНажми Enter чтобы начать скачивание...")
    
    success_count = 0
    fail_count = 0
    
    for station in STATIONS:
        if download_station(
            station['wmo_id'],
            station['start_date'],
            station['name']
        ):
            success_count += 1
        else:
            fail_count += 1
        
        # Пауза между станциями
        if len(STATIONS) > 1:
            logger.info("\nПауза 60 секунд перед следующей станцией...")
            time.sleep(60)
    
    # Итоги
    print("\n" + "="*70)
    print("ИТОГИ СКАЧИВАНИЯ")
    print("="*70)
    print(f"Успешно: {success_count}")
    print(f"Ошибок: {fail_count}")
    print("="*70)
    
    if success_count > 0:
        print("\nХочешь закоммитить и запушить в GitHub? (y/n)")
        answer = input().strip().lower()
        
        if answer == 'y':
            if git_commit_and_push():
                print("\n✅ ВСЁ ГОТОВО! Данные обновлены и загружены в GitHub")
            else:
                print("\n⚠️ Ошибка при пуше в GitHub. Попробуй вручную:")
                print("git add data/rp5-csv/*.csv")
                print(f"git commit -m 'Update RP5 archives - {datetime.now().strftime('%Y-%m-%d')}'")
                print("git push origin main")
        else:
            print("\nДанные скачаны, но не закоммичены.")
            print("Закоммить вручную:")
            print("git add data/rp5-csv/*.csv")
            print(f"git commit -m 'Update RP5 archives - {datetime.now().strftime('%Y-%m-%d')}'")
            print("git push origin main")
    
    print("\n" + "="*70)
    print("ГОТОВО!")
    print("="*70)


if __name__ == '__main__':
    main()
