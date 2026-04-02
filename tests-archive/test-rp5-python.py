#!/usr/bin/env python3
"""
Тест RP5 Python Downloader
Проверяет работу скачивания с разными станциями
"""

from rp5_downloader import RP5Downloader
import logging

# Включаем DEBUG логирование
logging.getLogger().setLevel(logging.DEBUG)

def test_single_station():
    """Тест скачивания одной станции"""
    print("\n" + "="*60)
    print("ТЕСТ 1: Скачивание одной станции (Санкт-Петербург)")
    print("="*60)
    
    downloader = RP5Downloader()
    
    try:
        file_path = downloader.download_station(
            station_id='26063',  # Санкт-Петербург (работает!)
            start_date='01.01.2024',
            end_date='31.12.2024'
        )
        
        if file_path:
            print(f"\n[SUCCESS] Файл скачан: {file_path}")
            
            # Загружаем в DataFrame
            df = downloader.load_csv_to_dataframe(file_path)
            if df is not None:
                print(f"[SUCCESS] Загружено {len(df)} строк")
                print(f"[INFO] Столбцы: {list(df.columns[:5])}")
        else:
            print("\n[FAIL] Не удалось скачать файл")
            
    finally:
        downloader.close()


def test_multiple_stations():
    """Тест скачивания нескольких станций"""
    print("\n" + "="*60)
    print("ТЕСТ 2: Скачивание нескольких станций")
    print("="*60)
    
    # Пробуем разные станции
    stations = [
        '26063',  # Санкт-Петербург (работает!)
        '27612',  # Москва
        '28573',  # Ишим
    ]
    
    downloader = RP5Downloader()
    
    try:
        results = downloader.download_stations(
            station_ids=stations,
            start_date='01.01.2024',
            end_date='31.03.2024',  # Короткий период
            max_workers=1  # По одной станции
        )
        
        print("\n" + "="*60)
        print("РЕЗУЛЬТАТЫ:")
        print("="*60)
        
        for station_id, file_path in results:
            if file_path:
                print(f"[OK] {station_id}: {file_path.name}")
            else:
                print(f"[FAIL] {station_id}: не скачан")
                
    finally:
        downloader.close()


def test_different_periods():
    """Тест разных периодов"""
    print("\n" + "="*60)
    print("ТЕСТ 3: Разные периоды для Санкт-Петербурга")
    print("="*60)
    
    periods = [
        ('01.01.2024', '31.01.2024', '1 месяц'),
        ('01.01.2023', '31.12.2023', '1 год'),
        ('01.01.2020', '31.12.2024', '5 лет'),
    ]
    
    downloader = RP5Downloader()
    
    try:
        for start, end, desc in periods:
            print(f"\nПериод: {desc} ({start} - {end})")
            
            file_path = downloader.download_station(
                station_id='26063',
                start_date=start,
                end_date=end
            )
            
            if file_path:
                size_mb = file_path.stat().st_size / (1024 * 1024)
                print(f"[OK] Скачано: {size_mb:.2f} МБ")
            else:
                print(f"[FAIL] Не удалось скачать")
                
    finally:
        downloader.close()


if __name__ == '__main__':
    print("\n" + "="*60)
    print("RP5 PYTHON DOWNLOADER - ТЕСТЫ")
    print("="*60)
    
    # Запускаем тесты
    test_single_station()
    # test_multiple_stations()
    # test_different_periods()
    
    print("\n" + "="*60)
    print("ТЕСТЫ ЗАВЕРШЕНЫ")
    print("="*60)
