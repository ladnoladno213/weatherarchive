#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ручной запуск GitHub Actions workflow
"""

import requests
import json
import os

# Ваш репозиторий
REPO_OWNER = "ladnoladno213"
REPO_NAME = "weatherarchive"
WORKFLOW_ID = "rp5-frequent.yml"

def trigger_workflow(token):
    """Запускает workflow вручную"""
    
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/workflows/{WORKFLOW_ID}/dispatches"
    
    headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': f'Bearer {token}',
        'X-GitHub-Api-Version': '2022-11-28'
    }
    
    data = {
        'ref': 'main'
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code == 204:
            print("✅ Workflow успешно запущен!")
            print(f"Проверьте статус: https://github.com/{REPO_OWNER}/{REPO_NAME}/actions")
        else:
            print(f"❌ Ошибка: {response.status_code}")
            print(response.text)
        
    except Exception as e:
        print(f"Ошибка: {e}")

if __name__ == '__main__':
    # Токен нужно получить из переменных окружения или ввести вручную
    token = os.environ.get('GITHUB_TOKEN')
    
    if not token:
        print("Для запуска workflow нужен GitHub Personal Access Token")
        print("Создайте токен: https://github.com/settings/tokens")
        print("Права: repo, workflow")
        print()
        token = input("Введите токен (или нажмите Enter для пропуска): ").strip()
    
    if token:
        trigger_workflow(token)
    else:
        print("\nАльтернатива: запустите workflow вручную через веб-интерфейс:")
        print(f"https://github.com/{REPO_OWNER}/{REPO_NAME}/actions/workflows/{WORKFLOW_ID}")
        print("Нажмите 'Run workflow' → выберите ветку 'main' → 'Run workflow'")
