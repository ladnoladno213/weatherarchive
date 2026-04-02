#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RP5 Real-time Updater
Скачивает последние данные каждые 3 часа для всех городов
"""

import os
import sys
import time
import gzip
import json
import re
import logging
import requests
from datetime import datetime, timedelta
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_date_range():
    """Возвращает диапазон дат для скачивания (последние 7 дней)"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    
    return (
        start_date.strftime('%d.%m.%Y'),
        end_date.strftime('%d.%m.%Y')
    )


def load_stations_list():
    """Загружает список станций из data/wmo-mapping.js"""
    try:
        # Проверяем существование файла
        mapping_file = Path('data/wmo-mapping.js')
        if not mapping_file.exists():
            logger.error(f"Файл не найден: {mapping_file}")
            return []
        
        with open(mapping_file, 'r', encoding='utf-8') as f:
            content = f.read()
            logger.info(f"Прочитано {len(content)} символов из файла")
            
            # Используем регулярное выражение для извлечения всех WMO ID
            # Формат в файле: число: 'WMO_ID',
            pattern = r":\s*'(\d+)'"
            matches = re.findall(pattern, content)
            
            if not matches:
                logger.error("WMO ID не найдены в файле")
                logger.error(f"Первые 500 символов файла: {content[:500]}")
                return []
            
            # Убираем '0' и дубликаты, сортируем
            stations = sorted(set(m for m in matches if m != '0'))
            
            logger.info(f"Загружено {len(stations)} уникальных станций (исключая '0')")
            logger.info(f"Примеры станций: {stations[:10]}")
            
            return stations
            
    except Exception as e:
        logger.error(f"Ошибка загрузки списка станций: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []


def download_station_quick(station_id, start_date, end_date, output_dir='data/rp5-realtime'):
    """Быстрое скачивание данных для одной станции"""
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    options = Options()
    options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    
    # Пути для разных ОС
    chrome_paths = [
        '/usr/bin/google-chrome',  # Linux
        os.path.join(os.getcwd(), 'chrome-win64', 'chrome-win64', 'chrome.exe'),  # Windows
    ]
    
    for chrome_path in chrome_paths:
        if os.path.exists(chrome_path):
            options.binary_location = chrome_path
            break
    
    driver = webdriver.Chrome(options=options)
    
    try:
        logger.info(f"Станция {station_id}")
        
        # 1. Открываем страницу архива
        url = f'https://rp5.ru/archive.php?wmo_id={station_id}&lang=ru'
        driver.get(url)
        time.sleep(5)
        
        # 2. СТРОГО: Переключаемся на вкладку "Скачать архив погоды"
        logger.info("Шаг 1: Переключаемся на вкладку 'Скачать архив погоды'")
        download_tab = driver.find_element(By.ID, 'tabSynopDLoad')
        download_tab.click()
        time.sleep(3)
        
        # 3. СТРОГО: Заполняем диапазон дат (строка 1)
        logger.info(f"Шаг 2: Заполняем диапазон дат: {start_date} - {end_date}")
        driver.execute_script(f"""
            document.getElementById('calender_dload').value = '{start_date}';
            document.getElementById('calender_dload2').value = '{end_date}';
        """)
        time.sleep(2)
        
        # Строка 2 "все дни" уже выбрана по умолчанию, пропускаем
        
        # 4. СТРОГО: Выбираем формат CSV (строка 3)
        logger.info("Шаг 3: Выбираем формат CSV")
        driver.execute_script("""
            var csvRadio = document.querySelector('input[name="format"][value="f_csv"]');
            if (csvRadio) {
                csvRadio.click();
                console.log('CSV format selected');
            }
        """)
        time.sleep(3)
        
        # 5. СТРОГО: Выбираем кодировку UTF-8 (строка 4)
        logger.info("Шаг 4: Выбираем кодировку UTF-8")
        driver.execute_script("""
            var utf8Radio = document.getElementById('coding2');
            if (utf8Radio) {
                utf8Radio.click();
                console.log('UTF-8 encoding selected');
            }
        """)
        time.sleep(2)
        
        # 6. СТРОГО: Нажимаем кнопку "Выбрать в файл GZ" (строка 5)
        logger.info("Шаг 5: Нажимаем 'Выбрать в файл GZ'")
        driver.execute_script("""
            var buttons = document.querySelectorAll('.archButton');
            for (var i = 0; i < buttons.length; i++) {
                var text = buttons[i].textContent || '';
                if (text.includes('Выбрать') && text.includes('файл')) {
                    buttons[i].click();
                    console.log('Download button clicked');
                    break;
                }
            }
        """)
        time.sleep(7)
        
        # 7. Получаем URL для скачивания (появляется текст "Скачать")
        logger.info("Шаг 6: Получаем ссылку для скачивания")
        download_url = driver.execute_script("""
            var resultSpan = document.getElementById('f_result');
            if (resultSpan) {
                var link = resultSpan.querySelector('a');
                if (link) {
                    console.log('Download link found:', link.href);
                    return link.href;
                }
            }
            console.log('Download link not found');
            return null;
        """)
        
        if not download_url:
            logger.warning(f"Станция {station_id}: URL не найден")
            return False
        
        logger.info(f"URL получен: {download_url}")
        
        # 8. Ждем генерации файла
        logger.info("Ожидание генерации файла (15 сек)...")
        time.sleep(15)
        
        # 9. Скачиваем файл
        logger.info("Скачивание файла...")
        response = requests.get(download_url, timeout=60)
        
        if response.status_code == 200:
            gz_path = output_path / f"{station_id}.csv.gz"
            with open(gz_path, 'wb') as f:
                f.write(response.content)
            
            csv_path = output_path / f"{station_id}.csv"
            with gzip.open(gz_path, 'rb') as f_in:
                with open(csv_path, 'wb') as f_out:
                    f_out.write(f_in.read())
            
            gz_path.unlink()
            
            logger.info(f"Станция {station_id}: OK ({len(response.content)} байт)")
            return True
        else:
            logger.warning(f"Станция {station_id}: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"Станция {station_id}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False
    finally:
        driver.quit()


def main():
    """Основная функция"""
    
    logger.info("="*70)
    logger.info("RP5 REALTIME UPDATER")
    logger.info(f"Время запуска: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("="*70)
    
    # Получаем диапазон дат (последние 7 дней)
    start_date, end_date = get_date_range()
    logger.info(f"Период: {start_date} - {end_date}")
    
    # Загружаем список станций
    stations = load_stations_list()
    
    if not stations:
        logger.error("Список станций пуст!")
        sys.exit(1)
    
    logger.info(f"Станций для обновления: {len(stations)}")
    logger.info("="*70)
    
    success = 0
    failed = 0
    
    for i, station_id in enumerate(stations, 1):
        logger.info(f"[{i}/{len(stations)}] Обработка станции {station_id}...")
        
        if download_station_quick(station_id, start_date, end_date):
            success += 1
        else:
            failed += 1
        
        # Пауза между станциями (чтобы не перегружать RP5)
        if i < len(stations):
            time.sleep(10)
    
    logger.info("="*70)
    logger.info(f"ИТОГО: Успешно={success}, Ошибок={failed}")
    logger.info("="*70)
    
    if failed > len(stations) / 2:
        logger.error("Слишком много ошибок!")
        sys.exit(1)


if __name__ == '__main__':
    main()
