#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RP5 Selenium Downloader - Полностью автоматическое скачивание через браузер

Этот скрипт использует Selenium для эмуляции реального браузера,
что позволяет обойти защиту RP5 и автоматически генерировать файлы.
"""

import os
import time
import gzip
import logging
from pathlib import Path
from typing import List, Optional
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import requests

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class RP5SeleniumDownloader:
    """
    Автоматический загрузчик архивов RP5 через Selenium.
    """
    
    def __init__(self, output_dir: str = 'data/rp5-csv', headless: bool = False):
        """
        Инициализация загрузчика.
        
        Args:
            output_dir: Директория для сохранения файлов
            headless: Запускать браузер без GUI (True) или с GUI (False)
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.headless = headless
        self.driver = None
        
        # Статистика
        self.stats = {
            'success': 0,
            'failed': 0,
            'total': 0
        }

    
    def _init_driver(self):
        """Инициализирует Chrome WebDriver."""
        if self.driver:
            return
        
        logger.info("Инициализация Chrome WebDriver...")
        
        # Настройки Chrome
        options = webdriver.ChromeOptions()
        
        if self.headless:
            options.add_argument('--headless')
        
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        
        # Путь к Chrome из папки chrome-win64
        chrome_binary_paths = [
            # Вариант 1: Вложенная папка (новая структура)
            os.path.join(os.getcwd(), 'chrome-win64', 'chrome-win64', 'chrome.exe'),
            # Вариант 2: Прямо в папке (старая структура)
            os.path.join(os.getcwd(), 'chrome-win64', 'chrome.exe'),
        ]
        
        for chrome_binary_path in chrome_binary_paths:
            if os.path.exists(chrome_binary_path):
                options.binary_location = chrome_binary_path
                logger.info(f"Используем Chrome: {chrome_binary_path}")
                break
        
        # Пробуем разные варианты ChromeDriver
        chrome_driver_paths = [
            # Вариант 1: В папке chromedriver-win64
            os.path.join(os.getcwd(), 'chromedriver-win64', 'chromedriver.exe'),
            # Вариант 2: В корне проекта
            os.path.join(os.getcwd(), 'chromedriver.exe'),
            # Вариант 3: В папке chrome-win64 (старая структура)
            os.path.join(os.getcwd(), 'chrome-win64', 'chromedriver.exe'),
        ]
        
        chrome_driver_path = None
        for path in chrome_driver_paths:
            if os.path.exists(path):
                chrome_driver_path = path
                logger.info(f"Найден ChromeDriver: {path}")
                break
        
        if chrome_driver_path:
            # Используем найденный ChromeDriver
            service = Service(chrome_driver_path)
            self.driver = webdriver.Chrome(service=service, options=options)
        else:
            # Пробуем использовать системный Chrome
            logger.warning("ChromeDriver не найден в проекте, пробуем системный Chrome...")
            try:
                self.driver = webdriver.Chrome(options=options)
            except Exception as e:
                logger.error(f"Не удалось запустить Chrome: {e}")
                logger.error("\nРЕШЕНИЕ:")
                logger.error("1. Скачайте ChromeDriver с https://googlechromelabs.github.io/chrome-for-testing/")
                logger.error("2. Выберите 'chromedriver' для win64")
                logger.error("3. Распакуйте в папку проекта")
                logger.error("4. Должен получиться файл: chromedriver-win64/chromedriver.exe")
                raise
        
        logger.info("Chrome WebDriver инициализирован")

    
    def generate_and_download(self, station_id: str, start_date: str, end_date: str) -> Optional[Path]:
        """
        Генерирует и скачивает архив для станции.
        
        Args:
            station_id: WMO ID станции (5 цифр)
            start_date: Дата начала (DD.MM.YYYY)
            end_date: Дата окончания (DD.MM.YYYY)
            
        Returns:
            Path к скачанному файлу или None при ошибке
        """
        self._init_driver()
        
        logger.info("="*70)
        logger.info(f"Станция {station_id}: {start_date} - {end_date}")
        logger.info("="*70)
        
        self.stats['total'] += 1
        
        try:
            # Шаг 1: Открываем страницу архива
            url = f'https://rp5.ru/archive.php?wmo_id={station_id}&lang=ru'
            logger.info(f"Открытие страницы: {url}")
            
            self.driver.get(url)
            
            # Ждем загрузки страницы (увеличено время)
            logger.info("Ожидание загрузки страницы...")
            time.sleep(5)
            
            # Шаг 2: Переключаемся на вкладку "Скачать архив погоды"
            logger.info("Переключение на вкладку 'Скачать архив погоды'...")
            
            try:
                download_tab = self.driver.find_element(By.ID, 'tabSynopDLoad')
                download_tab.click()
                time.sleep(2)
                logger.info("Вкладка открыта")
            except NoSuchElementException:
                logger.error("Вкладка 'Скачать архив погоды' не найдена")
                self.stats['failed'] += 1
                return None
            
            # Шаг 3: Заполняем даты в полях формы
            logger.info("Заполнение дат...")
            
            try:
                # Находим поля дат (форма f_farchive)
                date_start_input = self.driver.find_element(By.ID, 'calender_dload')
                date_end_input = self.driver.find_element(By.ID, 'calender_dload2')
                
                # Очищаем и заполняем через JavaScript (надежнее чем send_keys)
                self.driver.execute_script(f"arguments[0].value = '{start_date}';", date_start_input)
                self.driver.execute_script(f"arguments[0].value = '{end_date}';", date_end_input)
                
                logger.info(f"Даты установлены: {start_date} - {end_date}")
                time.sleep(1)
                
            except NoSuchElementException as e:
                logger.error(f"Поля дат не найдены: {e}")
                self.stats['failed'] += 1
                return None
            
            # Шаг 4: Выбираем формат CSV (кликаем по label, чтобы показать опции кодировки)
            logger.info("Выбор формата 'CSV (текстовый)'...")
            
            try:
                # Ищем label для CSV радиокнопки и кликаем по нему
                csv_clicked = self.driver.execute_script("""
                    // Находим радиокнопку CSV (f_pe=3)
                    var csvRadio = document.querySelector('input[name="f_pe"][value="3"]');
                    if (!csvRadio) return 'Radio not found';
                    
                    // Ищем label для этой радиокнопки
                    var labels = document.querySelectorAll('label');
                    for (var i = 0; i < labels.length; i++) {
                        if (labels[i].htmlFor === csvRadio.id || labels[i].contains(csvRadio)) {
                            labels[i].click();
                            return 'Clicked label';
                        }
                    }
                    
                    // Если label не найден, кликаем по самой радиокнопке
                    csvRadio.click();
                    return 'Clicked radio';
                """)
                
                logger.info(f"CSV: {csv_clicked}")
                time.sleep(3)  # Увеличиваем ожидание для появления опций кодировки
                
            except Exception as e:
                logger.error(f"Ошибка при выборе CSV: {e}")
                self.stats['failed'] += 1
                return None
            
            # Шаг 5: Выбираем кодировку UTF-8
            logger.info("Выбор кодировки UTF-8...")
            
            try:
                # Ищем label для UTF-8 радиокнопки
                utf8_clicked = self.driver.execute_script("""
                    var utf8Radio = document.getElementById('format1');
                    if (!utf8Radio) return 'Radio not found';
                    
                    // Ищем label
                    var labels = document.querySelectorAll('label');
                    for (var i = 0; i < labels.length; i++) {
                        if (labels[i].htmlFor === 'format1' || labels[i].contains(utf8Radio)) {
                            labels[i].click();
                            return 'Clicked label';
                        }
                    }
                    
                    // Если label не найден, кликаем по радиокнопке
                    utf8Radio.click();
                    return 'Clicked radio';
                """)
                
                logger.info(f"UTF-8: {utf8_clicked}")
                time.sleep(2)
                
            except Exception as e:
                logger.warning(f"Ошибка при выборе UTF-8: {e}")
            
            # Шаг 6: Нажимаем кнопку "Выбрать в файл GZ (архив)"
            logger.info("Поиск и нажатие кнопки 'Выбрать в файл GZ (архив)'...")
            
            try:
                # Ищем кнопку или ссылку с текстом "Выбрать"
                button_clicked = self.driver.execute_script("""
                    // Ищем все возможные элементы
                    var elements = document.querySelectorAll('input, button, a');
                    
                    for (var i = 0; i < elements.length; i++) {
                        var elem = elements[i];
                        var text = elem.value || elem.textContent || elem.innerText || '';
                        text = text.trim();
                        
                        // Ищем "Выбрать в файл"
                        if (text.includes('Выбрать') && text.includes('файл')) {
                            elem.click();
                            return 'Clicked: ' + text;
                        }
                    }
                    
                    return false;
                """)
                
                if button_clicked:
                    logger.info(f"Кнопка нажата: {button_clicked}")
                else:
                    logger.error("Кнопка 'Выбрать в файл' не найдена")
                    self.stats['failed'] += 1
                    return None
                
            except Exception as e:
                logger.error(f"Ошибка при нажатии кнопки: {e}")
                self.stats['failed'] += 1
                return None
            
            # Шаг 7: Ждем появления ссылки "Скачать" (5-10 секунд)
            logger.info("Ожидание появления ссылки 'Скачать' (5-10 сек)...")
            time.sleep(7)
            
            # Шаг 8: Кликаем по ссылке "Скачать"
            logger.info("Поиск и клик по ссылке 'Скачать'...")
            
            try:
                download_clicked = self.driver.execute_script("""
                    // Ищем ссылку или текст "Скачать"
                    var elements = document.querySelectorAll('a, span, div');
                    
                    for (var i = 0; i < elements.length; i++) {
                        var elem = elements[i];
                        var text = (elem.textContent || elem.innerText || '').trim();
                        
                        if (text === 'Скачать' || text.includes('Скачать')) {
                            elem.click();
                            return 'Clicked: ' + text;
                        }
                    }
                    
                    return false;
                """)
                
                if download_clicked:
                    logger.info(f"Ссылка нажата: {download_clicked}")
                else:
                    logger.warning("Ссылка 'Скачать' не найдена, возможно файл уже генерируется")
                
            except Exception as e:
                logger.warning(f"Ошибка при клике на 'Скачать': {e}")
            
            # Шаг 9: Ждем генерации файла (файл уже запущен на генерацию)
            logger.info("Ожидание генерации файла (20-30 сек)...")
            time.sleep(25)  # Ждем генерации
            
            # Шаг 10: Скачиваем файл через requests
            logger.info("Скачивание файла...")
            
            file_path = self._download_file(station_id, start_date, end_date)
            
            if file_path:
                logger.info(f"[SUCCESS] Файл скачан: {file_path}")
                self.stats['success'] += 1
                return file_path
            else:
                logger.error(f"[FAIL] Не удалось скачать файл")
                self.stats['failed'] += 1
                return None
                
        except Exception as e:
            logger.error(f"Ошибка: {e}")
            self.stats['failed'] += 1
            return None

    
    def _download_file(self, station_id: str, start_date: str, end_date: str) -> Optional[Path]:
        """Скачивает сгенерированный файл."""
        prefix = station_id[:2]
        filename = f"{station_id}.{start_date}.{end_date}.1.0.0.ru.utf8.00000000.csv.gz"
        
        # Пробуем все серверы
        servers = ['ru1', 'ru2', 'ru3']
        
        for server in servers:
            url = f"https://{server}.rp5.ru/download/files.synop/{prefix}/{filename}"
            
            try:
                logger.info(f"Попытка скачивания с {server}...")
                
                response = requests.get(url, timeout=60)
                
                if response.status_code == 200:
                    # Сохраняем .gz файл
                    gz_path = self.output_dir / f"{station_id}.csv.gz"
                    
                    with open(gz_path, 'wb') as f:
                        f.write(response.content)
                    
                    logger.info(f"Скачано: {len(response.content)} байт")
                    
                    # Распаковываем
                    csv_path = self.output_dir / f"{station_id}.csv"
                    
                    with gzip.open(gz_path, 'rb') as f_in:
                        with open(csv_path, 'wb') as f_out:
                            f_out.write(f_in.read())
                    
                    logger.info(f"Распакован: {csv_path}")
                    
                    # Удаляем .gz
                    gz_path.unlink()
                    
                    return csv_path
                    
            except Exception as e:
                logger.warning(f"Ошибка с {server}: {e}")
                continue
        
        return None

    
    def download_stations(self, station_ids: List[str], start_date: str, end_date: str) -> List[tuple]:
        """
        Скачивает архивы для списка станций.
        
        Args:
            station_ids: Список WMO ID станций
            start_date: Дата начала (DD.MM.YYYY)
            end_date: Дата окончания (DD.MM.YYYY)
            
        Returns:
            Список кортежей (station_id, file_path)
        """
        logger.info("\n" + "="*70)
        logger.info(f"МАССОВОЕ СКАЧИВАНИЕ")
        logger.info(f"Станций: {len(station_ids)}")
        logger.info(f"Период: {start_date} - {end_date}")
        logger.info("="*70 + "\n")
        
        results = []
        
        for i, station_id in enumerate(station_ids, 1):
            logger.info(f"\n[{i}/{len(station_ids)}] Обработка станции {station_id}")
            
            file_path = self.generate_and_download(station_id, start_date, end_date)
            results.append((station_id, file_path))
            
            # Задержка между станциями
            if i < len(station_ids):
                delay = 3
                logger.info(f"Задержка {delay} сек перед следующей станцией...")
                time.sleep(delay)
        
        # Итоговая статистика
        logger.info("\n" + "="*70)
        logger.info("ИТОГИ")
        logger.info("="*70)
        logger.info(f"Всего: {self.stats['total']}")
        logger.info(f"Успешно: {self.stats['success']}")
        logger.info(f"Ошибок: {self.stats['failed']}")
        logger.info("="*70 + "\n")
        
        return results
    
    def close(self):
        """Закрывает браузер."""
        if self.driver:
            self.driver.quit()
            logger.info("Браузер закрыт")


def main():
    """
    Пример использования Selenium downloader.
    """
    # Список станций для скачивания
    stations = [
        '26063',  # Санкт-Петербург
        '27612',  # Москва
        '28573',  # Ишим
        '29634',  # Новосибирск
        '28698',  # Екатеринбург
    ]
    
    # Период загрузки
    start_date = '01.04.2016'
    end_date = '01.04.2026'
    
    # Создаем загрузчик (headless=False чтобы видеть браузер)
    downloader = RP5SeleniumDownloader(headless=False)
    
    try:
        # Скачиваем все станции
        results = downloader.download_stations(
            station_ids=stations,
            start_date=start_date,
            end_date=end_date
        )
        
        # Показываем результаты
        print("\n" + "="*70)
        print("РЕЗУЛЬТАТЫ СКАЧИВАНИЯ")
        print("="*70)
        
        for station_id, file_path in results:
            if file_path:
                print(f"[OK] {station_id}: {file_path.name}")
            else:
                print(f"[FAIL] {station_id}: не скачан")
        
        print("="*70)
        
    finally:
        downloader.close()


if __name__ == '__main__':
    main()
