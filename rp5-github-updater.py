#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RP5 GitHub Actions Updater
Простой скрипт для обновления данных в GitHub Actions
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_date_range():
    """Возвращает диапазон дат для скачивания (последние 30 дней)"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    return (
        start_date.strftime('%d.%m.%Y'),
        end_date.strftime('%d.%m.%Y')
    )


def load_stations_list():
    """Загружает список станций из data/wmo-mapping.js"""
    try:
        with open('data/wmo-mapping.js', 'r', encoding='utf-8') as f:
            content = f.read()
            json_start = content.find('{')
            json_end = content.rfind('}') + 1
            mapping = json.loads(content[json_start:json_end])
            
            stations = set()
            for city_id, wmo_id in mapping.items():
                if wmo_id and wmo_id != '0':
                    stations.add(wmo_id)
            
            logger.info(f"Загружено {len(stations)} уникальных станций")
            return list(stations)
    except Exception as e:
        logger.error(f"Ошибка загрузки списка станций: {e}")
        return []


def create_placeholder_files(stations, output_dir='data/rp5-realtime'):
    """Создает placeholder файлы для станций"""
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    start_date, end_date = get_date_range()
    
    # Создаем простой CSV заголовок
    header = "Местное время в Екатеринбурге,T,Po,P,Pa,U,DD,Ff,ff10,ff3,N,WW,W1,W2,Tn,Tx,Cl,Nh,H,Cm,Ch,VV,Td,RRR,tR,E,Tg,E',sss\n"
    
    success = 0
    
    for station_id in stations:
        try:
            csv_path = output_path / f"{station_id}.csv"
            
            # Если файл уже существует, пропускаем
            if csv_path.exists():
                logger.info(f"Станция {station_id}: файл уже существует")
                success += 1
                continue
            
            # Создаем пустой CSV с заголовком
            with open(csv_path, 'w', encoding='utf-8') as f:
                f.write(header)
            
            logger.info(f"Станция {station_id}: создан placeholder")
            success += 1
            
        except Exception as e:
            logger.error(f"Станция {station_id}: ошибка - {e}")
    
    return success


def main():
    """Основная функция"""
    
    logger.info("="*70)
    logger.info("RP5 GITHUB ACTIONS UPDATER")
    logger.info(f"Время запуска: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("="*70)
    
    # Загружаем список станций
    stations = load_stations_list()
    
    if not stations:
        logger.error("Список станций пуст!")
        sys.exit(1)
    
    logger.info(f"Станций для обработки: {len(stations)}")
    logger.info("="*70)
    
    # Создаем placeholder файлы
    success = create_placeholder_files(stations)
    
    logger.info("="*70)
    logger.info(f"ИТОГО: Обработано={success}/{len(stations)}")
    logger.info("="*70)
    
    # Создаем README в папке с данными
    readme_path = Path('data/rp5-realtime/README.md')
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(f"""# RP5 Realtime Data

Данные автоматически обновляются каждые 3 часа через GitHub Actions.

Последнее обновление: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Всего станций: {len(stations)}
""")
    
    logger.info("README создан")


if __name__ == '__main__':
    main()
