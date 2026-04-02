#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Проверка последнего запуска workflow
"""

import requests
import json

REPO_OWNER = "ladnoladno213"
REPO_NAME = "weatherarchive"

def get_latest_run():
    """Получает детали последнего запуска"""
    
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/runs"
    
    try:
        response = requests.get(url, params={'per_page': 1})
        response.raise_for_status()
        
        data = response.json()
        runs = data.get('workflow_runs', [])
        
        if not runs:
            print("Нет запусков")
            return
        
        run = runs[0]
        run_id = run['id']
        
        print(f"\n{'='*80}")
        print(f"ПОСЛЕДНИЙ ЗАПУСК: #{run['run_number']}")
        print(f"{'='*80}")
        print(f"ID: {run_id}")
        print(f"Статус: {run['status']}")
        print(f"Результат: {run.get('conclusion', 'N/A')}")
        print(f"URL: {run['html_url']}")
        print()
        
        # Получаем jobs
        jobs_url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/runs/{run_id}/jobs"
        jobs_response = requests.get(jobs_url)
        jobs_response.raise_for_status()
        
        jobs_data = jobs_response.json()
        jobs = jobs_data.get('jobs', [])
        
        for job in jobs:
            print(f"\nJOB: {job['name']}")
            print(f"Статус: {job['status']} / {job.get('conclusion', 'N/A')}")
            print(f"\nШаги:")
            
            for step in job.get('steps', []):
                status_icon = "✅" if step.get('conclusion') == 'success' else "❌" if step.get('conclusion') == 'failure' else "⏳"
                print(f"  {status_icon} {step['name']} - {step.get('conclusion', 'running')}")
        
    except Exception as e:
        print(f"Ошибка: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    get_latest_run()
