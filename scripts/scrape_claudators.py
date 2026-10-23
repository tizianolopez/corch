#!/usr/bin/env python3
"""
Scraper del corpus histórico de Claudàtors (claudators.com).
Extrae los enigmas y pistas del histórico diario para su uso como:
1. Dataset de Few-Shot Prompting en el agente de generación de Corchetes.
2. Archivo de entrenamiento supervisado (Fine-Tuning) para Google Gemini.
"""

import os
import sys
import json
import csv
import time
import datetime
import urllib.request
import urllib.error

# Forzar codificación UTF-8 en salida estándar de Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
os.makedirs(DATA_DIR, exist_ok=True)


def fetch_puzzle(date_str: str) -> dict | None:
    url = f"https://www.claudators.com/api/get_daily_puzzle?date={date_str}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=8) as res:
            if res.status == 200:
                payload = json.loads(res.read().decode('utf-8'))
                if payload.get('found') and payload.get('puzzle'):
                    return payload
    except urllib.error.HTTPError as e:
        if e.code != 404:
            print(f"[{date_str}] HTTP Error: {e.code}")
    except Exception as e:
        print(f"[{date_str}] Error: {e}")
    return None


def extract_clues_recursive(clue_list: list, depth: int, quote: str, date_str: str, results: list):
    for item in clue_list:
        sub_clues = item.get('clues', [])
        has_subclues = len(sub_clues) > 0
        clue_text = item.get('text', '').strip()
        solution = item.get('value', '').strip()
        start_index = item.get('startIndex', 0)

        if clue_text and solution:
            results.append({
                'date': date_str,
                'quote': quote,
                'clue_text': clue_text,
                'solution': solution,
                'length': len(solution),
                'depth': depth,
                'has_nested': has_subclues,
                'nested_count': len(sub_clues),
                'start_index': start_index,
            })

        if has_subclues:
            extract_clues_recursive(sub_clues, depth + 1, quote, date_str, results)


def categorize_technique(clue_text: str, solution: str) -> str:
    """Clasifica heurísticamente la técnica enigmística utilizada en la pista."""
    text_lower = clue_text.lower()
    sol_lower = solution.lower()

    # Indicadores de anagramas
    anagram_words = ['desorden', 'revuelto', 'caos', 'enderrocat', 'reves', 'revés', 'girat', 'girado', 'barrejat', 'mezclado']
    if any(w in text_lower for w in anagram_words):
        return 'anagrama'

    # Indicadores de telescopio / inclusión
    telescope_words = ['esconde', 'porta', 'té', 'amaga', 'dins', 'dentro', 'conté', 'inclou', 'oculta', 'mitad']
    if any(w in text_lower for w in telescope_words) or (len(sol_lower) >= 3 and sol_lower in text_lower):
        return 'telescopica'

    # Indicadores de charadas o partes
    charade_words = ['inici', 'final', 'primera', 'última', 'part', 'mitja', 'mitat', 'cap', 'cua']
    if any(w in text_lower for w in charade_words):
        return 'charada'

    return 'doble_sentido_o_referencia'


def main():
    days_to_scrape = 120
    base_date = datetime.date(2026, 10, 23)

    print(f"Iniciando extracción de histórico de Claudàtors ({days_to_scrape} días hacia atrás)...")

    corpus_puzzles = []
    flattened_clues = []

    for i in range(days_to_scrape):
        cur_date = (base_date - datetime.timedelta(days=i)).isoformat()
        puzzle_data = fetch_puzzle(cur_date)

        if puzzle_data:
            p_obj = puzzle_data['puzzle']
            quote = p_obj.get('text', '')
            clues = p_obj.get('clues', [])

            corpus_puzzles.append({
                'date': cur_date,
                'quote': quote,
                'raw_puzzle': p_obj
            })

            extract_clues_recursive(clues, 0, quote, cur_date, flattened_clues)
            print(f"✓ [{cur_date}] Extraídas {len(clues)} pistas principales de: «{quote[:45]}...»")
        else:
            print(f"· [{cur_date}] Sin puzle disponible.")

        time.sleep(0.08)  # Pausa respetuosa

    print(f"\nExtracción completada: {len(corpus_puzzles)} puzles, {len(flattened_clues)} pistas individuales procesadas.")

    # 1. Guardar corpus completo JSON
    corpus_file = os.path.join(DATA_DIR, 'claudators_corpus.json')
    with open(corpus_file, 'w', encoding='utf-8') as f:
        json.dump(corpus_puzzles, f, ensure_ascii=False, indent=2)
    print(f"→ Guardado: {corpus_file}")

    # 2. Guardar dataset CSV
    csv_file = os.path.join(DATA_DIR, 'claudators_dataset.csv')
    with open(csv_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'date', 'solution', 'clue_text', 'technique', 'length', 'depth', 'has_nested', 'nested_count', 'start_index', 'quote'
        ])
        writer.writeheader()
        for c in flattened_clues:
            row = dict(c)
            row['technique'] = categorize_technique(c['clue_text'], c['solution'])
            writer.writerow(row)
    print(f"→ Guardado: {csv_file}")

    # 3. Guardar formato Fine-Tuning JSONL (Google Gemini format)
    tuning_file = os.path.join(DATA_DIR, 'claudators_tuning.jsonl')
    with open(tuning_file, 'w', encoding='utf-8') as f:
        for c in flattened_clues:
            tech = categorize_technique(c['clue_text'], c['solution'])
            prompt_line = {
                "messages": [
                    {
                        "role": "system",
                        "content": "Eres un maestro creador de claudàtors y pistas crípticas de ingenio. Tu objetivo es escribir una pista de doble sentido, anagrama, telescopio o referencia sin usar definiciones de diccionario escolar."
                    },
                    {
                        "role": "user",
                        "content": f"Genera una pista críptica con técnica '{tech}' para la solución '{c['solution']}' (longitud {c['length']})."
                    },
                    {
                        "role": "model",
                        "content": json.dumps({"text": c['clue_text'], "value": c['solution'], "technique": tech}, ensure_ascii=False)
                    }
                ]
            }
            f.write(json.dumps(prompt_line, ensure_ascii=False) + '\n')
    print(f"→ Guardado: {tuning_file}")

    # 4. Guardar catálogo selecto de Few-Shot para inyección directa en prompts
    fewshot_file = os.path.join(DATA_DIR, 'claudators_fewshot.json')
    classified_examples = {
        'anagrama': [],
        'telescopica': [],
        'charada': [],
        'doble_sentido_o_referencia': []
    }
    for c in flattened_clues:
        tech = categorize_technique(c['clue_text'], c['solution'])
        if len(classified_examples[tech]) < 25:
            classified_examples[tech].append({
                'clue': c['clue_text'],
                'solution': c['solution'],
                'depth': c['depth']
            })

    with open(fewshot_file, 'w', encoding='utf-8') as f:
        json.dump(classified_examples, f, ensure_ascii=False, indent=2)
    print(f"→ Guardado: {fewshot_file}")


if __name__ == '__main__':
    main()
