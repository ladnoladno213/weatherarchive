#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RP5 Downloader для GitHub Actions
Адаптирован для работы в CI/CD окружении
"""

import os
import sys
import time
import gzip
import logging
import requests
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

# Пробуем импортировать webdriver-manager
try:
    from webdriver_manager.chrome import ChromeDriverManager
    HAS_WEBDRIVER_MANAGER = True
except ImportError:
    HAS_WEBDRIVER_MANAGER = False

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def download_station(station_id, start_date, end_date, output_dir='data/rp5-csv'):
    """Скачивает данные для одной станции"""
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Настройка Chrome для GitHub Actions
    options = Options()
    options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--window-size=1920,1080')
    
    # Пробуем создать драйвер с webdriver-manager или системным ChromeDriver
    try:
        if HAS_WEBDRIVER_MANAGER:
            logger.info("Using webdriver-manager to setup ChromeDriver")
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
        else:
            logger.info("Using system ChromeDriver")
            driver = webdriver.Chrome(options=options)
    except Exception as e:
        logger.error(f"Failed to initialize Chrome: {e}")
        raise
    
    try:
        logger.info(f"Скачивание станции {station_id}: {start_date} - {end_date}")
        
        # 1. Открываем страницу
        url = f'https://rp5.ru/archive.php?wmo_id={station_id}&lang=ru'
        driver.get(url)
        time.sleep(5)
        
        # 2. Переключаемся на вкладку
        download_tab = driver.find_element(By.ID, 'tabSynopDLoad')
        download_tab.click()
        time.sleep(3)
        
        # 3. Заполняем даты
        driver.execute_script(f"""
            document.getElementById('calender_dload').value = '{start_date}';
            document.getElementById('calender_dload2').value = '{end_date}';
        """)
        time.sleep(1)
        
        # 4. Выбираем CSV
        driver.execute_script("""
            var csvRadio = document.querySelector('input[name="format"][value="f_csv"]');
            if (csvRadio) csvRadio.click();
        """)
        time.sleep(3)
        
        # 5. Выбираем UTF-8
        driver.execute_script("""
            var utf8Radio = document.getElementById('coding2');
            if (utf8Radio) utf8Radio.click();
        """)
        time.sleep(2)
        
        # 6. Нажимаем кнопку
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
        
        # 7. Получаем URL
        download_url = driver.execute_script("""
            var resultSpan = document.getElementById('f_result');
            if (resultSpan) {
                var link = resultSpan.querySelector('a');
                if (link) return link.href;
            }
            return null;
        """)
        
        if not download_url:
            logger.error("URL не найден")
            return False
        
        logger.info(f"URL: {download_url}")
        
        # 8. Ждем генерации
        logger.info("Ожидание генерации (30 сек)...")
        time.sleep(30)
        
        # 9. Скачиваем
        logger.info("Скачивание...")
        response = requests.get(download_url, timeout=60)
        
        if response.status_code == 200:
            # Сохраняем и распаковываем
            gz_path = output_path / f"{station_id}.csv.gz"
            with open(gz_path, 'wb') as f:
                f.write(response.content)
            
            csv_path = output_path / f"{station_id}.csv"
            with gzip.open(gz_path, 'rb') as f_in:
                with open(csv_path, 'wb') as f_out:
                    f_out.write(f_in.read())
            
            gz_path.unlink()
            
            logger.info(f"Успех! Файл: {csv_path}")
            return True
        else:
            logger.error(f"HTTP {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"Ошибка: {e}")
        return False
    finally:
        driver.quit()


def main():
    """Основная функция"""
    
    # Список станций для скачивания
    stations = [
        ('28573', '01.01.2016', '31.03.2026'),  # Ишим
        # Добавьте другие станции здесь
    ]
    
    logger.info("="*70)
    logger.info("RP5 GITHUB ACTION DOWNLOADER")
    logger.info("="*70)
    
    success_count = 0
    fail_count = 0
    
    for station_id, start_date, end_date in stations:
        if download_station(station_id, start_date, end_date):
            success_count += 1
        else:
            fail_count += 1
        
        # Пауза между станциями
        if len(stations) > 1:
            time.sleep(60)
    
    logger.info("="*70)
    logger.info(f"Успешно: {success_count}, Ошибок: {fail_count}")
    logger.info("="*70)
    
    if fail_count > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
