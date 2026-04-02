#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RP5 Mass Downloader - Массовое скачивание архивов через генерацию

Этот скрипт инициирует генерацию CSV файлов на сервере RP5,
дожидается создания и скачивает их.

Основано на анализе запросов через DevTools.
"""

import requests
import time
import random
import gzip
import logging
from pathlib import Path
from typing import List, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import pandas as pd

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class RP5MassDownloader:
    """
    Массовый загрузчик архивов RP5 с автоматической генерацией файлов.
    """
    
    def __init__(self, output_dir: str = 'data/rp5-csv'):
        """
        Инициализация загрузчика.
        
        Args:
            output_dir: Директория для сохранения файлов
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.session = None
        self.cookies = {}
        
        # Серверы для скачивания
        self.servers = ['ru1', 'ru2', 'ru3']
        
        # Статистика
        self.stats = {
            'success': 0,
            'failed': 0,
            'retries': 0
        }
    
    def _get_headers(self, referer: str = None) -> dict:
        """
        Возвращает реалистичные HTTP заголовки.
        
        Args:
            referer: URL страницы-источника
            
        Returns:
            Словарь заголовков
        """
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Cache-Control': 'max-age=0'
        }
        
        if referer:
            headers['Referer'] = referer
        
        return headers
    
    def _init_session(self):
        """Инициализирует сессию и получает cookies."""
        if self.session:
            return
        
        logger.info("Инициализация сессии...")
        
        self.session = requests.Session()
        
        try:
            # Получаем cookies с главной страницы
            response = self.session.get(
                'https://rp5.ru/',
                headers=self._get_headers(),
                timeout=30
            )
            
            if response.status_code == 200:
                self.cookies = dict(self.session.cookies)
                logger.info(f"Получено cookies: {len(self.cookies)} шт.")
                logger.debug(f"Cookies: {self.cookies}")
            else:
                logger.warning(f"Не удалось получить cookies: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Ошибка инициализации сессии: {e}")
    
    def generate_file(self, station_id: str, start_date: str, end_date: str) -> bool:
        """
        Инициирует генерацию CSV файла на сервере RP5.
        
        Этот метод отправляет POST запрос на endpoint генерации файлов,
        аналогичный нажатию кнопки "Скачать архив" на сайте.
        
        Args:
            station_id: WMO ID станции (5 цифр)
            start_date: Дата начала (DD.MM.YYYY)
            end_date: Дата окончания (DD.MM.YYYY)
            
        Returns:
            True если генерация инициирована успешно
        """
        self._init_session()
        
        logger.info(f"Инициация генерации файла для станции {station_id}")
        
        # URL для генерации (нужно определить через DevTools)
        # Возможные варианты:
        # - https://rp5.ru/responses/reFileSynop.php
        # - https://rp5.ru/responses/reFileSynopShort.php
        generation_url = 'https://rp5.ru/responses/reFileSynopShort.php'
        
        # Параметры запроса (нужно уточнить через DevTools)
        data = {
            'wmo_id': station_id,
            'a_date1': start_date,
            'a_date2': end_date,
            'f_ed3': '12',  # Формат времени (UTC+0 или местное)
            'f_ed4': '1',   # Тип данных (SYNOP)
            'f_ed5': '1',   # Формат файла (CSV)
            'f_pe': '1',    # Период
            'f_pe1': start_date,
            'f_pe2': end_date,
            'lng_id': '2'   # Язык (русский)
        }
        
        referer = f'https://rp5.ru/archive.php?wmo_id={station_id}&lang=ru'
        
        try:
            response = self.session.post(
                generation_url,
                data=data,
                headers=self._get_headers(referer=referer),
                timeout=30
            )
            
            if response.status_code == 200:
                # Проверяем ответ на наличие ошибок
                response_text = response.text.lower()
                
                if 'error' in response_text or 'ошибка' in response_text:
                    logger.warning(f"Ошибка в ответе сервера: {response.text[:200]}")
                    return False
                
                logger.info(f"Генерация инициирована успешно")
                return True
            else:
                logger.warning(f"Ошибка генерации: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Ошибка при инициации генерации: {e}")
            return False
    
    def download_file(self, station_id: str, start_date: str, end_date: str, 
                     max_attempts: int = 3) -> Optional[Path]:
        """
        Скачивает сгенерированный файл с сервера.
        
        Args:
            station_id: WMO ID станции
            start_date: Дата начала (DD.MM.YYYY)
            end_date: Дата окончания (DD.MM.YYYY)
            max_attempts: Максимальное количество попыток
            
        Returns:
            Path к скачанному файлу или None при ошибке
        """
        self._init_session()
        
        prefix = station_id[:2]
        filename = f"{station_id}.{start_date}.{end_date}.1.0.0.ru.utf8.00000000.csv.gz"
        
        # Пробуем все серверы
        for server in self.servers:
            url = f"https://{server}.rp5.ru/download/files.synop/{prefix}/{filename}"
            
            for attempt in range(1, max_attempts + 1):
                try:
                    logger.info(f"Попытка {attempt}/{max_attempts}: {url}")
                    
                    response = self.session.get(
                        url,
                        headers=self._get_headers(),
                        timeout=60,
                        stream=True
                    )
                    
                    if response.status_code == 200:
                        # Сохраняем .gz файл
                        gz_path = self.output_dir / f"{station_id}.csv.gz"
                        
                        with open(gz_path, 'wb') as f:
                            for chunk in response.iter_content(chunk_size=8192):
                                if chunk:
                                    f.write(chunk)
                        
                        file_size = gz_path.stat().st_size
                        logger.info(f"[OK] Скачано: {file_size} байт")
                        
                        # Распаковываем
                        csv_path = self.output_dir / f"{station_id}.csv"
                        
                        with gzip.open(gz_path, 'rb') as f_in:
                            with open(csv_path, 'wb') as f_out:
                                f_out.write(f_in.read())
                        
                        csv_size = csv_path.stat().st_size
                        logger.info(f"Распакован CSV: {csv_path} ({csv_size} байт)")
                        
                        # Удаляем .gz
                        gz_path.unlink()
                        logger.info("Удален .gz файл")
                        
                        return csv_path
                    
                    elif response.status_code == 403:
                        logger.warning("403 Forbidden - файл еще не сгенерирован")
                        
                        if attempt < max_attempts:
                            wait_time = random.uniform(3, 6)
                            logger.info(f"Ожидание {wait_time:.1f} сек перед повтором...")
                            time.sleep(wait_time)
                        
                    else:
                        logger.warning(f"HTTP {response.status_code}")
                        break  # Пробуем следующий сервер
                        
                except Exception as e:
                    logger.error(f"Ошибка скачивания: {e}")
                    
                    if attempt < max_attempts:
                        wait_time = random.uniform(2, 4)
                        time.sleep(wait_time)
        
        return None
    
    def download_station_with_generation(self, station_id: str, start_date: str, 
                                        end_date: str, max_retries: int = 5) -> Optional[Path]:
        """
        Полный цикл: генерация → ожидание → скачивание с повторами.
        
        Args:
            station_id: WMO ID станции
            start_date: Дата начала (DD.MM.YYYY)
            end_date: Дата окончания (DD.MM.YYYY)
            max_retries: Максимальное количество повторов всего цикла
            
        Returns:
            Path к скачанному файлу или None
        """
        logger.info("="*70)
        logger.info(f"Станция {station_id}: {start_date} - {end_date}")
        logger.info("="*70)
        
        for retry in range(1, max_retries + 1):
            logger.info(f"\n[Попытка {retry}/{max_retries}]")
            
            # Шаг 1: Инициировать генерацию
            if self.generate_file(station_id, start_date, end_date):
                
                # Шаг 2: Подождать создания файла
                wait_time = random.uniform(2, 5)
                logger.info(f"Ожидание генерации файла: {wait_time:.1f} сек...")
                time.sleep(wait_time)
                
                # Шаг 3: Скачать файл
                file_path = self.download_file(station_id, start_date, end_date)
                
                if file_path:
                    logger.info(f"\n[SUCCESS] Станция {station_id}: {file_path}")
                    self.stats['success'] += 1
                    return file_path
                else:
                    logger.warning(f"Не удалось скачать после генерации")
                    self.stats['retries'] += 1
            else:
                logger.warning(f"Не удалось инициировать генерацию")
                self.stats['retries'] += 1
            
            # Задержка перед следующей попыткой
            if retry < max_retries:
                wait_time = random.uniform(3, 7)
                logger.info(f"Задержка перед повтором: {wait_time:.1f} сек...")
                time.sleep(wait_time)
        
        logger.error(f"\n[FAIL] Станция {station_id}: не удалось скачать после {max_retries} попыток")
        self.stats['failed'] += 1
        return None
    
    def download_stations(self, station_ids: List[str], start_date: str, 
                         end_date: str, max_workers: int = 2) -> List[Tuple[str, Optional[Path]]]:
        """
        Скачивает архивы для списка станций с ограниченной параллельностью.
        
        Args:
            station_ids: Список WMO ID станций
            start_date: Дата начала (DD.MM.YYYY)
            end_date: Дата окончания (DD.MM.YYYY)
            max_workers: Максимальное количество параллельных потоков
            
        Returns:
            Список кортежей (station_id, file_path)
        """
        logger.info("="*70)
        logger.info(f"Начало массового скачивания")
        logger.info(f"Станций: {len(station_ids)}")
        logger.info(f"Период: {start_date} - {end_date}")
        logger.info(f"Параллельность: {max_workers} потока")
        logger.info("="*70)
        
        results = []
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Создаем задачи
            future_to_station = {
                executor.submit(
                    self.download_station_with_generation,
                    station_id,
                    start_date,
                    end_date
                ): station_id
                for station_id in station_ids
            }
            
            # Обрабатываем результаты по мере завершения
            for future in as_completed(future_to_station):
                station_id = future_to_station[future]
                
                try:
                    file_path = future.result()
                    results.append((station_id, file_path))
                    
                    if file_path:
                        logger.info(f"[OK] {station_id}: успешно")
                    else:
                        logger.warning(f"[FAIL] {station_id}: ошибка")
                        
                except Exception as e:
                    logger.error(f"[ERROR] {station_id}: {e}")
                    results.append((station_id, None))
                
                # Задержка между станциями
                delay = random.uniform(1, 3)
                time.sleep(delay)
        
        # Итоговая статистика
        logger.info("\n" + "="*70)
        logger.info("ИТОГИ")
        logger.info("="*70)
        logger.info(f"Успешно: {self.stats['success']}/{len(station_ids)}")
        logger.info(f"Ошибок: {self.stats['failed']}/{len(station_ids)}")
        logger.info(f"Повторов: {self.stats['retries']}")
        logger.info("="*70)
        
        return results
    
    def load_csv_to_dataframe(self, csv_path: Path) -> Optional[pd.DataFrame]:
        """
        Загружает CSV файл в pandas DataFrame.
        
        Args:
            csv_path: Путь к CSV файлу
            
        Returns:
            DataFrame или None при ошибке
        """
        try:
            logger.info(f"Загрузка CSV в DataFrame: {csv_path}")
            
            df = pd.read_csv(
                csv_path,
                sep=';',
                comment='#',
                encoding='utf-8',
                low_memory=False
            )
            
            logger.info(f"Загружено строк: {len(df)}, столбцов: {len(df.columns)}")
            
            return df
            
        except Exception as e:
            logger.error(f"Ошибка загрузки CSV: {e}")
            return None
    
    def close(self):
        """Закрывает сессию."""
        if self.session:
            self.session.close()
            logger.info("Сессия закрыта")


def main():
    """
    Пример использования массового загрузчика.
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
    
    # Создаем загрузчик
    downloader = RP5MassDownloader()
    
    try:
        # Скачиваем все станции
        results = downloader.download_stations(
            station_ids=stations,
            start_date=start_date,
            end_date=end_date,
            max_workers=2  # Не более 2 параллельных потоков
        )
        
        # Обрабатываем результаты
        print("\n" + "="*70)
        print("РЕЗУЛЬТАТЫ СКАЧИВАНИЯ")
        print("="*70)
        
        for station_id, file_path in results:
            if file_path:
                print(f"[OK] {station_id}: {file_path.name}")
                
                # Загружаем в DataFrame для проверки
                df = downloader.load_csv_to_dataframe(file_path)
                if df is not None:
                    print(f"     Строк: {len(df)}, период: {df.iloc[0, 0]} - {df.iloc[-1, 0]}")
            else:
                print(f"[FAIL] {station_id}: не скачан")
        
        print("="*70)
        
    finally:
        downloader.close()


if __name__ == '__main__':
    main()
