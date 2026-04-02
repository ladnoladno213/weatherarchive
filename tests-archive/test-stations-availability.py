#!/usr/bin/env python3
"""
Тест доступности станций RP5
Проверяет, какие станции доступны для скачивания
"""

from rp5_downloader import RP5Downloader
import json
import time

# Список станций для тестирования (топ российские города)
STATIONS_TO_TEST = {
    '28573': 'Ишим',
    '27612': 'Москва',
    '26063': 'Санкт-Петербург',
    '29634': 'Новосибирск',
    '28698': 'Екатеринбург',
    '27595': 'Казань',
    '27459': 'Нижний Новгород',
    '28722': 'Челябинск',
    '27995': 'Самара',
    '34731': 'Ростов-на-Дону',
    '29570': 'Красноярск',
    '34123': 'Воронеж',
    '28224': 'Пермь',
    '34560': 'Волгоград',
    '34927': 'Краснодар',
    '34172': 'Саратов',
    '28367': 'Тюмень',
    '28411': 'Ижевск',
}


def test_station_availability(downloader, station_id, city_name):
    """
    Тестирует доступность одной станции
    
    Returns:
        dict: Результат теста
    """
    print(f"\nТестирование: {city_name} ({station_id})")
    print("-" * 50)
    
    result = {
        'station_id': station_id,
        'city_name': city_name,
        'available': False,
        'server': None,
        'file_size': 0,
        'rows': 0,
        'error': None
    }
    
    try:
        # Пробуем скачать небольшой период (1 месяц)
        file_path = downloader.download_station(
            station_id=station_id,
            start_date='01.01.2024',
            end_date='31.01.2024',
            decompress=True
        )
        
        if file_path and file_path.exists():
            result['available'] = True
            result['file_size'] = file_path.stat().st_size
            
            # Пробуем загрузить в DataFrame
            df = downloader.load_csv_to_dataframe(file_path)
            if df is not None:
                result['rows'] = len(df)
            
            print(f"[OK] Доступна! Размер: {result['file_size']/1024:.1f} КБ, Строк: {result['rows']}")
            
            # Удаляем тестовый файл
            file_path.unlink()
        else:
            result['error'] = '403 Forbidden'
            print(f"[FAIL] Недоступна (403)")
            
    except Exception as e:
        result['error'] = str(e)
        print(f"[ERROR] Ошибка: {e}")
    
    return result


def main():
    """Основная функция"""
    print("="*60)
    print("ТЕСТ ДОСТУПНОСТИ СТАНЦИЙ RP5")
    print("="*60)
    print(f"Всего станций для тестирования: {len(STATIONS_TO_TEST)}")
    print("="*60)
    
    downloader = RP5Downloader()
    results = []
    
    try:
        for station_id, city_name in STATIONS_TO_TEST.items():
            result = test_station_availability(downloader, station_id, city_name)
            results.append(result)
            
            # Задержка между станциями
            time.sleep(2)
        
        # Статистика
        print("\n" + "="*60)
        print("РЕЗУЛЬТАТЫ")
        print("="*60)
        
        available = [r for r in results if r['available']]
        unavailable = [r for r in results if not r['available']]
        
        print(f"\nДоступно: {len(available)}/{len(results)} ({len(available)/len(results)*100:.1f}%)")
        print(f"Недоступно: {len(unavailable)}/{len(results)} ({len(unavailable)/len(results)*100:.1f}%)")
        
        if available:
            print("\nДОСТУПНЫЕ СТАНЦИИ:")
            print("-" * 60)
            for r in available:
                print(f"  {r['station_id']}: {r['city_name']}")
                print(f"    Размер: {r['file_size']/1024:.1f} КБ, Строк: {r['rows']}")
        
        if unavailable:
            print("\nНЕДОСТУПНЫЕ СТАНЦИИ:")
            print("-" * 60)
            for r in unavailable:
                print(f"  {r['station_id']}: {r['city_name']} - {r['error']}")
        
        # Сохраняем результаты в JSON
        with open('stations-availability.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        
        print("\n" + "="*60)
        print("Результаты сохранены в: stations-availability.json")
        print("="*60)
        
    finally:
        downloader.close()


if __name__ == '__main__':
    main()
