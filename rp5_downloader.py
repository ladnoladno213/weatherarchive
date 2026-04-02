#!/usr/bin/env python3
"""
RP5 Weather Archive Downloader

Стабильная система скачивания архивов погоды (CSV.gz) с сайта rp5.ru
по прямым ссылкам. Использует Session для имитации браузера и получения cookies.

Автор: Weather Website Project
Дата: 2026-04-01
"""

import requests
import gzip
import time
import random
import logging
import os
from pathlib import Path
from typing import List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
import pandas as pd

# Настройка логирования с поддержкой UTF-8
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('rp5_downloader.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Для Windows консоли устанавливаем UTF-8
import sys
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except:
        pass


class RP5Downloader:
    """
    Класс для скачивания архивов погоды с RP5.
    
    Использует Session для сохранения cookies и имитации браузера.
    Поддерживает retry и альтернативные серверы.
    """
    
    # Альтернативные серверы RP5
    SERVERS = ['ru1', 'ru2', 'ru3']
    
    # Реалистичные HTTP заголовки
    HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
    }
    
    def __init__(self, output_dir: str = 'data/rp5-csv', max_retries: int = 3):
        """
        Инициализация загрузчика.
        
        Args:
            output_dir: Директория для сохранения файлов
            max_retries: Максимальное количество попыток при ошибке
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.max_retries = max_retries
        self.session = None
        
    def _init_session(self) -> requests.Session:
        """
        Инициализирует сессию и получает cookies с главной страницы RP5.
        
        Returns:
            Настроенная сессия с cookies
        """
        session = requests.Session()
        session.headers.update(self.HEADERS)
        
        try:
            # Предварительный запрос на главную страницу для получения cookies
            logger.info("Получение cookies с https://rp5.ru/")
            response = session.get('https://rp5.ru/', timeout=10)
            response.raise_for_status()
            
            logger.info(f"Получено cookies: {len(session.cookies)} шт.")
            logger.debug(f"Cookies: {session.cookies.get_dict()}")
            
            # Небольшая задержка после получения cookies
            time.sleep(random.uniform(1, 2))
            
        except Exception as e:
            logger.warning(f"Не удалось получить cookies: {e}")
            logger.info("Продолжаем без предварительных cookies")
        
        return session
    
    def _build_url(self, station_id: str, server: str = 'ru1',
                   start_date: str = '01.01.2000', 
                   end_date: str = '01.01.2026') -> str:
        """
        Формирует URL для скачивания архива.
        
        Args:
            station_id: WMO ID станции (5 цифр)
            server: Сервер (ru1, ru2, ru3)
            start_date: Дата начала (DD.MM.YYYY)
            end_date: Дата окончания (DD.MM.YYYY)
            
        Returns:
            URL для скачивания
        """
        # Первые 2 цифры для папки
        prefix = station_id[:2]
        
        # Формируем URL
        url = (f"https://{server}.rp5.ru/download/files.synop/{prefix}/"
               f"{station_id}.{start_date}.{end_date}.1.0.0.ru.utf8.00000000.csv.gz")
        
        return url
    
    def _download_with_retry(self, station_id: str, 
                            start_date: str = '01.01.2000',
                            end_date: str = '01.01.2026') -> Optional[bytes]:
        """
        Скачивает файл с retry и альтернативными серверами.
        
        Args:
            station_id: WMO ID станции
            start_date: Дата начала
            end_date: Дата окончания
            
        Returns:
            Содержимое файла в байтах или None при ошибке
        """
        # Инициализируем сессию если еще не создана
        if self.session is None:
            self.session = self._init_session()
        
        # Пробуем все серверы
        for server in self.SERVERS:
            url = self._build_url(station_id, server, start_date, end_date)
            
            # Пробуем несколько раз для каждого сервера
            for attempt in range(1, self.max_retries + 1):
                try:
                    logger.info(f"Попытка {attempt}/{self.max_retries}: {url}")
                    
                    # Добавляем Referer для этого запроса
                    headers = {'Referer': 'https://rp5.ru/'}
                    
                    response = self.session.get(url, headers=headers, timeout=30)
                    
                    # Проверяем статус
                    if response.status_code == 200:
                        logger.info(f"[OK] Успешно скачано: {len(response.content)} байт")
                        return response.content
                    
                    elif response.status_code == 403:
                        logger.warning(f"403 Forbidden - пробуем следующий сервер")
                        break  # Переходим к следующему серверу
                    
                    elif response.status_code == 404:
                        logger.warning(f"404 Not Found - файл не существует")
                        return None  # Файла нет, не пробуем другие серверы
                    
                    else:
                        logger.warning(f"HTTP {response.status_code}")
                        
                except requests.exceptions.Timeout:
                    logger.warning(f"Timeout на попытке {attempt}")
                    
                except requests.exceptions.RequestException as e:
                    logger.warning(f"Ошибка запроса: {e}")
                
                # Задержка перед следующей попыткой (увеличиваем с каждой попыткой)
                if attempt < self.max_retries:
                    delay = random.uniform(3, 6) * attempt  # Увеличиваем задержку
                    logger.info(f"Ожидание {delay:.1f} сек перед следующей попыткой...")
                    time.sleep(delay)
            
            # Задержка перед следующим сервером
            time.sleep(random.uniform(1, 2))
        
        logger.error(f"[FAIL] Не удалось скачать файл для станции {station_id}")
        return None
    
    def download_station(self, station_id: str,
                        start_date: str = '01.01.2000',
                        end_date: str = '01.01.2026',
                        decompress: bool = True) -> Optional[Path]:
        """
        Скачивает архив для одной станции.
        
        Args:
            station_id: WMO ID станции (5 цифр)
            start_date: Дата начала (DD.MM.YYYY)
            end_date: Дата окончания (DD.MM.YYYY)
            decompress: Распаковывать ли .gz файл
            
        Returns:
            Путь к сохраненному файлу или None при ошибке
        """
        # Проверяем формат station_id
        if not station_id.isdigit() or len(station_id) != 5:
            logger.error(f"Неверный формат WMO ID: {station_id} (должно быть 5 цифр)")
            return None
        
        logger.info(f"\n{'='*60}")
        logger.info(f"Скачивание станции {station_id}")
        logger.info(f"Период: {start_date} - {end_date}")
        logger.info(f"{'='*60}")
        
        # Скачиваем файл
        content = self._download_with_retry(station_id, start_date, end_date)
        
        if content is None:
            return None
        
        # Сохраняем .gz файл
        gz_path = self.output_dir / f"{station_id}.csv.gz"
        gz_path.write_bytes(content)
        logger.info(f"Сохранен .gz файл: {gz_path}")
        
        # Распаковываем если нужно
        if decompress:
            try:
                csv_path = self.output_dir / f"{station_id}.csv"
                
                with gzip.open(gz_path, 'rb') as f_in:
                    decompressed = f_in.read()
                
                csv_path.write_bytes(decompressed)
                logger.info(f"Распакован CSV файл: {csv_path} ({len(decompressed)} байт)")
                
                # Удаляем .gz файл после распаковки
                gz_path.unlink()
                logger.info(f"Удален .gz файл")
                
                return csv_path
                
            except Exception as e:
                logger.error(f"Ошибка распаковки: {e}")
                return gz_path
        
        return gz_path
    
    def download_stations(self, station_ids: List[str],
                         start_date: str = '01.01.2000',
                         end_date: str = '01.01.2026',
                         max_workers: int = 2) -> List[Tuple[str, Optional[Path]]]:
        """
        Скачивает архивы для нескольких станций параллельно.
        
        Args:
            station_ids: Список WMO ID станций
            start_date: Дата начала
            end_date: Дата окончания
            max_workers: Максимальное количество параллельных потоков
            
        Returns:
            Список кортежей (station_id, путь к файлу или None)
        """
        results = []
        
        logger.info(f"\n{'='*60}")
        logger.info(f"Начало скачивания {len(station_ids)} станций")
        logger.info(f"Параллельность: {max_workers} потока")
        logger.info(f"{'='*60}\n")
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Создаем задачи
            future_to_station = {
                executor.submit(
                    self.download_station, 
                    station_id, 
                    start_date, 
                    end_date
                ): station_id
                for station_id in station_ids
            }
            
            # Обрабатываем результаты по мере выполнения
            for future in as_completed(future_to_station):
                station_id = future_to_station[future]
                
                try:
                    file_path = future.result()
                    results.append((station_id, file_path))
                    
                    if file_path:
                        logger.info(f"[OK] Станция {station_id}: успешно")
                    else:
                        logger.warning(f"[FAIL] Станция {station_id}: ошибка")
                        
                except Exception as e:
                    logger.error(f"[FAIL] Станция {station_id}: исключение - {e}")
                    results.append((station_id, None))
                
                # Задержка между станциями
                time.sleep(random.uniform(1, 3))
        
        # Статистика
        successful = sum(1 for _, path in results if path is not None)
        logger.info(f"\n{'='*60}")
        logger.info(f"Завершено: {successful}/{len(station_ids)} успешно")
        logger.info(f"{'='*60}\n")
        
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
            
            # Читаем CSV с учетом комментариев и разделителя
            df = pd.read_csv(
                csv_path,
                sep=';',
                comment='#',
                encoding='utf-8',
                low_memory=False
            )
            
            logger.info(f"Загружено строк: {len(df)}, столбцов: {len(df.columns)}")
            logger.info(f"Столбцы: {', '.join(df.columns[:10])}...")
            
            return df
            
        except Exception as e:
            logger.error(f"Ошибка загрузки CSV: {e}")
            return None
    
    def prepare_for_database(self, df: pd.DataFrame, station_id: str) -> pd.DataFrame:
        """
        Подготавливает данные для загрузки в БД.
        
        Args:
            df: Исходный DataFrame
            station_id: WMO ID станции
            
        Returns:
            Подготовленный DataFrame
        """
        logger.info("Подготовка данных для БД...")
        
        # Создаем копию
        df_prepared = df.copy()
        
        # Добавляем station_id
        df_prepared['station_id'] = station_id
        
        # Переименовываем первый столбец (время) в datetime
        time_column = df_prepared.columns[0]
        df_prepared = df_prepared.rename(columns={time_column: 'datetime'})
        
        # Конвертируем datetime
        try:
            df_prepared['datetime'] = pd.to_datetime(
                df_prepared['datetime'], 
                format='%d.%m.%Y %H:%M',
                errors='coerce'  # Преобразуем ошибки в NaT
            )
            # Удаляем строки с невалидными датами
            invalid_dates = df_prepared['datetime'].isna().sum()
            if invalid_dates > 0:
                logger.warning(f"Найдено {invalid_dates} строк с невалидными датами, удаляем...")
                df_prepared = df_prepared.dropna(subset=['datetime'])
        except Exception as e:
            logger.warning(f"Не удалось конвертировать datetime: {e}")
        
        # Удаляем полностью пустые строки
        df_prepared = df_prepared.dropna(how='all')
        
        logger.info(f"Подготовлено строк: {len(df_prepared)}")
        
        return df_prepared
    
    def get_manual_download_url(self, station_id: str) -> str:
        """
        Возвращает URL для ручной генерации архива на сайте RP5.
        
        Args:
            station_id: WMO ID станции
            
        Returns:
            URL страницы архива на rp5.ru
        """
        return f"https://rp5.ru/archive.php?wmo_id={station_id}&lang=ru"
    
    def get_direct_download_urls(self, station_id: str, start_date: str, end_date: str) -> list:
        """
        Возвращает список прямых URL для скачивания (все серверы).
        
        Args:
            station_id: WMO ID станции
            start_date: Дата начала (DD.MM.YYYY)
            end_date: Дата окончания (DD.MM.YYYY)
            
        Returns:
            Список URL для всех серверов
        """
        prefix = station_id[:2]
        filename = f"{station_id}.{start_date}.{end_date}.1.0.0.ru.utf8.00000000.csv.gz"
        
        return [
            f"https://ru1.rp5.ru/download/files.synop/{prefix}/{filename}",
            f"https://ru2.rp5.ru/download/files.synop/{prefix}/{filename}",
            f"https://ru3.rp5.ru/download/files.synop/{prefix}/{filename}"
        ]
    
    def close(self):
        """Закрывает сессию."""
        if self.session:
            self.session.close()
            logger.info("Сессия закрыта")


def main():
    """
    Пример использования загрузчика.
    """
    # Список станций для скачивания (топ российские города)
    stations = [
        '28573',  # Ишим
        '27612',  # Москва
        '26063',  # Санкт-Петербург
        '29634',  # Новосибирск
        '28698',  # Екатеринбург
    ]
    
    # Создаем загрузчик
    downloader = RP5Downloader(output_dir='data/rp5-csv')
    
    try:
        # Скачиваем архивы
        results = downloader.download_stations(
            station_ids=stations,
            start_date='01.01.2020',
            end_date='01.01.2026',
            max_workers=2  # Не более 2 параллельных потоков
        )
        
        # Обрабатываем результаты
        for station_id, file_path in results:
            if file_path and file_path.exists():
                # Загружаем в DataFrame
                df = downloader.load_csv_to_dataframe(file_path)
                
                if df is not None:
                    # Подготавливаем для БД
                    df_prepared = downloader.prepare_for_database(df, station_id)
                    
                    # Здесь можно загрузить в БД
                    # df_prepared.to_sql('weather_data', engine, if_exists='append')
                    
                    logger.info(f"Станция {station_id}: готово к загрузке в БД")
    
    finally:
        # Закрываем сессию
        downloader.close()


if __name__ == '__main__':
    main()
