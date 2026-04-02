#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Получение логов GitHub Actions
"""

import requests
import json

# Ваш репозиторий
REPO_OWNER = "ladnoladno213"
REPO_NAME = "weatherarchive"

def get_run_logs(run_id):
    """Получает логи конкретного запуска"""
    
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/runs/{run_id}/jobs"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        
        data = response.json()
        jobs = data.get('jobs', [])
        
        if not jobs:
            print("Нет jobs")
            return
        
        for job in jobs:
            print(f"\n{'='*80}")
            print(f"JOB: {job['name']}")
            print(f"Статус: {job['status']} / {job.get('conclusion', 'N/A')}")
            print(f"{'='*80}\n")
            
            for step in job.get('steps', []):
                if step.get('conclusion') == 'failure':
                    print(f"❌ FAILED STEP: {step['name']}")
                    print(f"   Номер: {step['number']}")
                    print(f"   Время: {step.get('started_at', 'N/A')} - {step.get('completed_at', 'N/A')}")
                    print()
        
    except Exception as e:
        print(f"Ошибка: {e}")

if __name__ == '__main__':
    # Последний неудачный запуск
    run_id = 23881142486
    print(f"Проверяю запуск #{run_id}...")
    get_run_logs(run_id)
