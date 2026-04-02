#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RP5 Auto Service
Запускается на твоем компьютере и автоматически обновляет данные каждые 3 часа
"""

import os
import sys
import time
import schedule
import subprocess
from datetime import datetime
from pathlib import Path

# Добавляем текущую директорию в путь
sys.path.insert(0, str(Path(__file__).parent))

# Импортируем функции из rp5-realtime-updater
from rp5_realtime_updater import main as update_rp5, logger


def git_push():
    """Коммитит и пушит изменения"""
    try:
        logger.info("\n" + "="*70)
        logger.info("GIT COMMIT & PUSH")
        logger.info("="*70)
        
        # Проверяем изменения
        result = subprocess.run(
            ['git', 'status', '--porcelain'],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent
        )
        
        if not result.stdout.strip():
            logger.info("Нет изменений для коммита")
            return True
        
        # Добавляем файлы
        subprocess.run(
            ['git', 'add', 'data/rp5-realtime/'],
            check=True,
            cwd=Path(__file__).parent
        )
        
        # Коммитим
        commit_msg = f"Auto-update RP5 data - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        subprocess.run(
            ['git', 'commit', '-m', commit_msg],
            check=True,
            cwd=Path(__file__).parent
        )
        
        # Пушим
        subprocess.run(
            ['git', 'push', 'origin', 'main'],
            check=True,
            cwd=Path(__file__).parent
        )
        
        logger.info("✅ Успешно запушено в GitHub!")
        return True
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Ошибка Git: {e}")
        return False


def job():
    """Задача которая выполняется каждые 3 часа"""
    logger.info("\n\n" + "="*70)
    logger.info(f"ЗАПУСК ОБНОВЛЕНИЯ: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("="*70)
    
    try:
        # Обновляем данные с RP5
        update_rp5()
        
        # Пушим в GitHub
        git_push()
        
        logger.info("\n" + "="*70)
        logger.info("ОБНОВЛЕНИЕ ЗАВЕРШЕНО")
        logger.info(f"Следующее обновление через 3 часа")
        logger.info("="*70 + "\n")
        
    except Exception as e:
        logger.error(f"Ошибка при обновлении: {e}")
        import traceback
        logger.error(traceback.format_exc())


def main():
    """Основная функция"""
    print("\n" + "="*70)
    print("RP5 AUTO SERVICE")
    print("="*70)
    print("Этот сервис будет автоматически обновлять данные RP5 каждые 3 часа")
    print("и пушить их в GitHub")
    print("")
    print("Расписание:")
    print("  - 00:00")
    print("  - 03:00")
    print("  - 06:00")
    print("  - 09:00")
    print("  - 12:00")
    print("  - 15:00")
    print("  - 18:00")
    print("  - 21:00")
    print("")
    print("Для остановки нажми Ctrl+C")
    print("="*70 + "\n")
    
    # Запускаем сразу при старте
    print("Запускаю первое обновление...")
    job()
    
    # Настраиваем расписание
    schedule.every().day.at("00:00").do(job)
    schedule.every().day.at("03:00").do(job)
    schedule.every().day.at("06:00").do(job)
    schedule.every().day.at("09:00").do(job)
    schedule.every().day.at("12:00").do(job)
    schedule.every().day.at("15:00").do(job)
    schedule.every().day.at("18:00").do(job)
    schedule.every().day.at("21:00").do(job)
    
    print(f"\nСервис запущен. Следующее обновление: {schedule.next_run()}")
    print("Для остановки нажми Ctrl+C\n")
    
    # Основной цикл
    try:
        while True:
            schedule.run_pending()
            time.sleep(60)  # Проверяем каждую минуту
    except KeyboardInterrupt:
        print("\n\nСервис остановлен пользователем")
        sys.exit(0)


if __name__ == '__main__':
    # Проверяем зависимости
    try:
        import schedule
    except ImportError:
        print("Ошибка: модуль 'schedule' не установлен")
        print("Установи его командой: pip install schedule")
        sys.exit(1)
    
    main()
