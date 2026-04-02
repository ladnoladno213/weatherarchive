#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Проверка статуса GitHub Actions
"""

import requests
import json
from datetime import datetime

# Ваш репозиторий
REPO_OWNER = "ladnoladno213"
REPO_NAME = "weatherarchive"
WORKFLOW_NAME = "rp5-frequent.yml"

def check_workflow_runs():
    """Проверяет последние запуски workflow"""
    
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/workflows/{WORKFLOW_NAME}/runs"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        
        data = response.json()
        runs = data.get('workflow_runs', [])
        
        if not runs:
            print("Нет запусков workflow")
            return
        
        print(f"\n{'='*80}")
        print(f"ПОСЛЕДНИЕ ЗАПУСКИ WORKFLOW: {WORKFLOW_NAME}")
        print(f"{'='*80}\n")
        
        for i, run in enumerate(runs[:5], 1):
            status = run['status']
            conclusion = run.get('conclusion', 'N/A')
            created_at = datetime.fromisoformat(run['created_at'].replace('Z', '+00:00'))
            
            print(f"{i}. Запуск #{run['run_number']}")
            print(f"   Статус: {status}")
            print(f"   Результат: {conclusion}")
            print(f"   Время: {created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
            print(f"   URL: {run['html_url']}")
            
            if conclusion == 'failure':
                print(f"   ⚠️  ОШИБКА!")
            elif conclusion == 'success':
                print(f"   ✅ Успешно")
            
            print()
        
    except Exception as e:
        print(f"Ошибка: {e}")

if __name__ == '__main__':
    check_workflow_runs()
