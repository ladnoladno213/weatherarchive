#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RP5 Автоматический загрузчик
Работает в headless режиме для запуска на сервере
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
from selenium.webdriver.common.by import By

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class RP5Downloader:
    def __init__(self, output_dir='data/rp5-csv', headless=True):
        """
        Args:
            output_dir: Папка для сохранения файлов
            headless: True для запуска без GUI (для сервера)
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.headless = headless
        self.driver = None
    
    def _init_driver(self):
        """Инициализация Chrome WebDriver"""
        if self.driver:
            return
        
        logger.info("Инициализация Chrome WebDriver...")
        
        options = webdriver.ChromeOptions()
        
        if self.headless:
            options.add_argument('--headless=new')
            options.add_argument('--disable-gpu')
        
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-blink-features=AutomationControlled')
        
        # Пути к Chrome и ChromeDriver
        chrome_paths = [
            os.path.join(os.getcwd(), 'chrome-win64', 'chrome-win64', 'chrome.exe'),
            os.path.join(os.getcwd(), 'chrome-win64', 'chrome.exe'),
        ]
        
        for chrome_path in chrome_paths:
            if os.path.exists(chrome_path):
                options.binary_location = chrome_path
                break
        
        driver_paths = [
            os.path.join(os.getcwd(), 'chromedriver-win64', 'chromedriver.exe'),
            os.path.join(os.getcwd(), 'chromedriver.exe'),
        ]
        
        driver_path = None
        for path in driver_paths:
            if os.path.exists(path):
                driver_path = path
                break
        
        if driver_path:
            service = Service(driver_path)
            self.driver = webdriver.Chrome(service=service, options=options)
        else:
            self.driver = webdriver.Chrome(options=options)
        
        logger.info("Chrome WebDriver инициализирован")
    
    def download_station(self, station_id, start_date, end_date):
        """
        Скачивает архив для одной станции
        
        Args:
            station_id: WMO ID станции (например, '28573')
            start_date: Дата начала в формате DD.MM.YYYY
            end_date: Дата окончания в формате DD.MM.YYYY
            
        Returns:
            Path к скачанному файлу или None
        """
        self._init_driver()
        
        logger.info(f"Станция {station_id}: {start_date} - {end_date}")
        
        try:
            # 1. Открываем страницу
            url = f'https://rp5.ru/archive.php?wmo_id={station_id}&lang=ru'
            self.driver.get(url)
            time.sleep(5)
            
            # 2. Переключаемся на вкладку
            download_tab = self.driver.find_element(By.ID, 'tabSynopDLoad')
            download_tab.click()
            time.sleep(3)
            
            # 3. Заполняем даты
            date_start_input = self.driver.find_element(By.ID, 'calender_dload')
            date_end_input = self.driver.find_element(By.ID, 'calender_dload2')
            self.driver.execute_script(f"arguments[0].value = '{start_date}';", date_start_input)
            self.driver.execute_script(f"arguments[0].value = '{end_date}';", date_end_input)
            time.sleep(1)
            
            # 4. Выбираем CSV
            self.driver.execute_script("""
                var csvRadio = document.querySelector('input[name="format"][value="f_csv"]');
                if (csvRadio) csvRadio.click();
            """)
            time.sleep(3)
            
            # 5. Выбираем UTF-8
            self.driver.execute_script("""
                var utf8Radio = document.getElementById('coding2');
                if (utf8Radio) utf8Radio.click();
            """)
            time.sleep(2)
            
            # 6. Нажимаем кнопку "Выбрать в файл GZ"
            self.driver.execute_script("""
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
            download_url = self.driver.execute_script("""
                var resultSpan = document.getElementById('f_result');
                if (resultSpan) {
                    var link = resultSpan.querySelector('a');
                    if (link) return link.href;
                }
                return null;
            """)
            
            if not download_url:
                logger.error("URL файла не найден")
                return None
            
            logger.info(f"URL получен: {download_url}")
            
            # 8. Ждем генерации файла
            logger.info("Ожидание генерации файла (30 сек)...")
            time.sleep(30)
            
            # 9. Скачиваем файл
            logger.info("Скачивание файла...")
            response = requests.get(download_url, timeout=60)
            
            if response.status_code == 200:
                # Сохраняем .gz
                gz_path = self.output_dir / f"{station_id}.csv.gz"
                with open(gz_path, 'wb') as f:
                    f.write(response.content)
                
                logger.info(f"Скачано: {len(response.content)} байт")
                
                # Распаковываем
                csv_path = self.output_dir / f"{station_id}.csv"
                with gzip.open(gz_path, 'rb') as f_in:
                    with open(csv_path, 'wb') as f_out:
                        f_out.write(f_in.read())
                
                # Удаляем .gz
                gz_path.unlink()
                
                logger.info(f"Файл сохранен: {csv_path}")
                return csv_path
            else:
                logger.error(f"Ошибка скачивания: HTTP {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Ошибка: {e}")
            return None
    
    def close(self):
        """Закрывает браузер"""
        if self.driver:
            self.driver.quit()
            logger.info("Браузер закрыт")


def main():
    """Пример использования"""
    # Настройки
    STATION_ID = '28573'  # Ишим
    START_DATE = '01.01.2016'
    END_DATE = '31.03.2026'
    OUTPUT_DIR = 'data/rp5-csv'
    HEADLESS = True  # True для сервера, False для отладки
    
    logger.info("="*70)
    logger.info("RP5 АВТОМАТИЧЕСКИЙ ЗАГРУЗЧИК")
    logger.info("="*70)
    
    downloader = RP5Downloader(output_dir=OUTPUT_DIR, headless=HEADLESS)
    
    try:
        file_path = downloader.download_station(STATION_ID, START_DATE, END_DATE)
        
        if file_path:
            logger.info("="*70)
            logger.info("УСПЕХ!")
            logger.info(f"Файл: {file_path}")
            logger.info("="*70)
        else:
            logger.error("="*70)
            logger.error("ОШИБКА СКАЧИВАНИЯ")
            logger.error("="*70)
            sys.exit(1)
            
    finally:
        downloader.close()


if __name__ == '__main__':
    main()
