#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RP5 Helper - Помощник для работы с архивами RP5

Этот скрипт помогает:
1. Проверить доступность архива
2. Получить URL для ручной генерации
3. Скачать архив (если доступен)
"""

import sys
from rp5_downloader import RP5Downloader
import logging

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s'
)
logger = logging.getLogger(__name__)


def check_station_availability(station_id: str, start_date: str, end_date: str):
    """
    Проверяет доступность архива для станции.
    
    Args:
        station_id: WMO ID станции
        start_date: Дата начала (DD.MM.YYYY)
        end_date: Дата окончания (DD.MM.YYYY)
    """
    print("\n" + "="*70)
    print(f"ПРОВЕРКА ДОСТУПНОСТИ АРХИВА")
    print("="*70)
    print(f"Станция: {station_id}")
    print(f"Период: {start_date} - {end_date}")
    print("="*70)
    
    downloader = RP5Downloader()
    
    try:
        # Получаем URL для ручной генерации
        manual_url = downloader.get_manual_download_url(station_id)
        
        # Получаем прямые URL
        direct_urls = downloader.get_direct_download_urls(station_id, start_date, end_date)
        
        print("\n[1] URL для ручной генерации архива:")
        print(f"    {manual_url}")
        print("\n    Инструкция:")
        print("    1. Откройте эту ссылку в браузере")
        print("    2. Выберите период и нажмите 'Скачать архив'")
        print("    3. После генерации файл будет доступен для прямого скачивания")
        
        print("\n[2] Прямые URL для скачивания (если файл уже сгенерирован):")
        for i, url in enumerate(direct_urls, 1):
            print(f"    Сервер {i}: {url}")
        
        print("\n[3] Попытка прямого скачивания...")
        
        # Пробуем скачать
        file_path = downloader.download_station(
            station_id=station_id,
            start_date=start_date,
            end_date=end_date
        )
        
        if file_path:
            print(f"\n[OK] Архив доступен и скачан!")
            print(f"     Файл: {file_path}")
            
            # Загружаем и показываем статистику
            df = downloader.load_csv_to_dataframe(file_path)
            if df is not None:
                print(f"\n[СТАТИСТИКА]")
                print(f"     Строк: {len(df)}")
                print(f"     Столбцов: {len(df.columns)}")
                print(f"     Период: {df.iloc[0, 0]} - {df.iloc[-1, 0]}")
        else:
            print(f"\n[FAIL] Архив недоступен (403 Forbidden)")
            print(f"\n[РЕШЕНИЕ]")
            print(f"     1. Откройте: {manual_url}")
            print(f"     2. Сгенерируйте архив через веб-интерфейс")
            print(f"     3. Запустите этот скрипт снова")
            
    finally:
        downloader.close()
    
    print("\n" + "="*70)


def download_with_retry(station_id: str, start_date: str, end_date: str, max_attempts: int = 3):
    """
    Скачивает архив с повторными попытками.
    
    Args:
        station_id: WMO ID станции
        start_date: Дата начала (DD.MM.YYYY)
        end_date: Дата окончания (DD.MM.YYYY)
        max_attempts: Максимальное количество попыток
    """
    print("\n" + "="*70)
    print(f"СКАЧИВАНИЕ АРХИВА С ПОВТОРНЫМИ ПОПЫТКАМИ")
    print("="*70)
    print(f"Станция: {station_id}")
    print(f"Период: {start_date} - {end_date}")
    print(f"Попыток: {max_attempts}")
    print("="*70)
    
    downloader = RP5Downloader()
    
    try:
        for attempt in range(1, max_attempts + 1):
            print(f"\n[Попытка {attempt}/{max_attempts}]")
            
            file_path = downloader.download_station(
                station_id=station_id,
                start_date=start_date,
                end_date=end_date
            )
            
            if file_path:
                print(f"\n[SUCCESS] Архив скачан: {file_path}")
                return
            
            if attempt < max_attempts:
                manual_url = downloader.get_manual_download_url(station_id)
                print(f"\n[ОЖИДАНИЕ] Архив недоступен")
                print(f"           Откройте {manual_url}")
                print(f"           и сгенерируйте архив")
                
                input(f"\nНажмите Enter для попытки {attempt + 1}...")
        
        print(f"\n[FAIL] Не удалось скачать архив после {max_attempts} попыток")
        
    finally:
        downloader.close()
    
    print("\n" + "="*70)


def show_popular_stations():
    """Показывает список популярных станций, которые обычно доступны."""
    print("\n" + "="*70)
    print("ПОПУЛЯРНЫЕ СТАНЦИИ (обычно доступны)")
    print("="*70)
    
    stations = [
        ("26063", "Санкт-Петербург", "Россия", "[OK] Стабильно работает"),
        ("27612", "Москва", "Россия", "Иногда доступна"),
        ("28573", "Ишим", "Россия", "Требует генерации"),
        ("29634", "Новосибирск", "Россия", "Требует генерации"),
        ("28698", "Екатеринбург", "Россия", "Требует генерации"),
    ]
    
    for wmo_id, city, country, status in stations:
        print(f"\n{wmo_id} - {city}, {country}")
        print(f"  Статус: {status}")
        print(f"  URL: https://rp5.ru/archive.php?wmo_id={wmo_id}")
    
    print("\n" + "="*70)


def main():
    """Главная функция."""
    if len(sys.argv) < 2:
        print("\n" + "="*70)
        print("RP5 HELPER - Помощник для работы с архивами RP5")
        print("="*70)
        print("\nИспользование:")
        print("  python rp5-helper.py check <WMO_ID> <START_DATE> <END_DATE>")
        print("  python rp5-helper.py download <WMO_ID> <START_DATE> <END_DATE>")
        print("  python rp5-helper.py popular")
        print("\nПримеры:")
        print("  python rp5-helper.py check 26063 01.01.2024 31.12.2024")
        print("  python rp5-helper.py download 28573 01.01.2024 31.12.2024")
        print("  python rp5-helper.py popular")
        print("\nДаты в формате: DD.MM.YYYY")
        print("="*70 + "\n")
        return
    
    command = sys.argv[1].lower()
    
    if command == "popular":
        show_popular_stations()
    
    elif command == "check":
        if len(sys.argv) != 5:
            print("[ERROR] Использование: python rp5-helper.py check <WMO_ID> <START_DATE> <END_DATE>")
            return
        
        station_id = sys.argv[2]
        start_date = sys.argv[3]
        end_date = sys.argv[4]
        
        check_station_availability(station_id, start_date, end_date)
    
    elif command == "download":
        if len(sys.argv) != 5:
            print("[ERROR] Использование: python rp5-helper.py download <WMO_ID> <START_DATE> <END_DATE>")
            return
        
        station_id = sys.argv[2]
        start_date = sys.argv[3]
        end_date = sys.argv[4]
        
        download_with_retry(station_id, start_date, end_date)
    
    else:
        print(f"[ERROR] Неизвестная команда: {command}")
        print("Доступные команды: check, download, popular")


if __name__ == '__main__':
    main()
