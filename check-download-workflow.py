#!/usr/bin/env python3
"""
Проверяет статус workflow download-rp5.yml
"""

import requests
import sys
from datetime import datetime

# GitHub API
REPO = "ladnoladno213/weatherarchive"
WORKFLOW_FILE = "download-rp5.yml"
API_URL = f"https://api.github.com/repos/{REPO}/actions/workflows/{WORKFLOW_FILE}/runs"

try:
    response = requests.get(API_URL, params={"per_page": 5})
    response.raise_for_status()
    data = response.json()
    
    runs = data.get("workflow_runs", [])
    
    if not runs:
        print("Нет запусков для этого workflow")
        sys.exit(0)
    
    print("\n" + "="*80)
    print(f"ПОСЛЕДНИЕ ЗАПУСКИ: {WORKFLOW_FILE}")
    print("="*80)
    
    for i, run in enumerate(runs[:5], 1):
        run_number = run.get("run_number")
        status = run.get("status")
        conclusion = run.get("conclusion")
        created_at = run.get("created_at", "")
        run_id = run.get("id")
        
        # Форматируем дату
        if created_at:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            created_at = dt.strftime("%Y-%m-%d %H:%M:%S UTC")
        
        print(f"\n{i}. Запуск #{run_number}")
        print(f"   ID: {run_id}")
        print(f"   Статус: {status}")
        print(f"   Результат: {conclusion}")
        print(f"   Время: {created_at}")
        print(f"   URL: {run.get('html_url')}")
        
        if conclusion == "success":
            print("   ✅ Успешно")
        elif conclusion == "failure":
            print("   ⚠️  ОШИБКА!")
        elif status == "in_progress":
            print("   🔄 Выполняется...")
        elif status == "queued":
            print("   ⏳ В очереди...")
    
    print("\n" + "="*80)
    
except Exception as e:
    print(f"Ошибка: {e}")
    sys.exit(1)
