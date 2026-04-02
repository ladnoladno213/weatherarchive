#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Диагностика формата CSV файла RP5
"""

import pandas as pd

csv_path = "data/rp5-csv/26063.csv"

print("=" * 60)
print("ДИАГНОСТИКА CSV ФОРМАТА")
print("=" * 60)

# Читаем CSV
df = pd.read_csv(
    csv_path,
    sep=';',
    comment='#',
    encoding='utf-8',
    low_memory=False
)

print(f"\n1. Всего строк: {len(df)}")
print(f"2. Всего столбцов: {len(df.columns)}")

print(f"\n3. Названия столбцов:")
for i, col in enumerate(df.columns[:10]):
    print(f"   [{i}] '{col}' (длина: {len(col)})")

print(f"\n4. Первый столбец (время):")
time_col = df.columns[0]
print(f"   Название: '{time_col}'")
print(f"   Тип данных: {df[time_col].dtype}")

print(f"\n5. Первые 5 значений времени:")
for i, val in enumerate(df[time_col].head()):
    print(f"   [{i}] '{val}' (тип: {type(val).__name__}, длина: {len(str(val))})")

print(f"\n6. Проверка на пустые значения:")
print(f"   Пустых в столбце времени: {df[time_col].isna().sum()}")

print(f"\n7. Попытка парсинга datetime:")
try:
    df_test = df.copy()
    df_test['parsed_datetime'] = pd.to_datetime(
        df_test[time_col],
        format='%d.%m.%Y %H:%M',
        errors='coerce'
    )
    
    valid = df_test['parsed_datetime'].notna().sum()
    invalid = df_test['parsed_datetime'].isna().sum()
    
    print(f"   Успешно распарсено: {valid}")
    print(f"   Не удалось распарсить: {invalid}")
    
    if invalid > 0:
        print(f"\n8. Примеры НЕраспарсенных значений:")
        failed = df_test[df_test['parsed_datetime'].isna()][time_col].head(10)
        for i, val in enumerate(failed):
            print(f"   [{i}] '{val}'")
    
    if valid > 0:
        print(f"\n9. Примеры успешно распарсенных значений:")
        success = df_test[df_test['parsed_datetime'].notna()].head(5)
        for i, row in success.iterrows():
            print(f"   '{row[time_col]}' -> {row['parsed_datetime']}")
            
except Exception as e:
    print(f"   ОШИБКА: {e}")

print("\n" + "=" * 60)
