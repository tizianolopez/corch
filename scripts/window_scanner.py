#!/usr/bin/env python3
"""
Motor de Ventana Deslizante (Window Scanner) para Enigmas Crípticos de Corchetes.
Analiza una frase en español y detecta oportunidades enigmísticas mediante fuerza bruta:
1. Cruces entre palabras (Cross-boundary words que cruzan espacios, ej. 'santiago lento' -> 'GOL').
2. Palabras telescópicas / Inclusiones (Palabras dentro de palabras, ej. 'diabética' -> 'ÉTICA').
3. Charadas morfológicas (Partición de una palabra en dos términos válidos, ej. 'soldado' -> 'SOL' + 'DADO').
4. Anagramas válidos (Reordenación exacta de letras en otra palabra del diccionario).
"""

import os
import sys
import json
import re
import unicodedata
from collections import defaultdict

# Forzar UTF-8 en salida estándar
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
DICT_PATH = os.path.join(DATA_DIR, 'spanish_words.txt')


def strip_accents(text: str) -> str:
    """Normaliza tildes conservando la letra Ñ."""
    # Preservar Ñ temporalmente
    text = text.replace('ñ', '###ENE_MIN###').replace('Ñ', '###ENE_MAY###')
    text = ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )
    return text.replace('###ENE_MIN###', 'ñ').replace('###ENE_MAY###', 'ñ')


class Lexicon:
    def __init__(self, dict_path: str = DICT_PATH):
        self.words = set()
        self.normalized_words = set()
        self.norm_to_original = defaultdict(list)
        self.anagram_map = defaultdict(list)

        if not os.path.exists(dict_path):
            raise FileNotFoundError(f"No se encontró el diccionario en {dict_path}")

        with open(dict_path, 'r', encoding='utf-8') as f:
            for line in f:
                w = line.strip().lower()
                if not w or len(w) < 3:
                    continue
                self.words.add(w)
                norm = strip_accents(w)
                self.normalized_words.add(norm)
                self.norm_to_original[norm].append(w)

                sorted_key = ''.join(sorted(norm))
                self.anagram_map[sorted_key].append(w)

    def contains(self, word: str) -> bool:
        return word.lower() in self.words or strip_accents(word.lower()) in self.normalized_words


def clean_tokens(sentence: str):
    """Extrae palabras conservando puntuación y posiciones relativas."""
    # Extraer palabras individuales (letras y acentos)
    tokens = re.findall(r'[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+', sentence)
    return tokens


def find_cross_boundaries(sentence: str, lexicon: Lexicon, min_len: int = 3, max_len: int = 7):
    """Busca palabras que cruzan exactamente un espacio entre dos palabras consecutivas."""
    tokens = clean_tokens(sentence)
    results = []

    for i in range(len(tokens) - 1):
        w1 = tokens[i].lower()
        w2 = tokens[i + 1].lower()
        norm1 = strip_accents(w1)
        norm2 = strip_accents(w2)

        # Letras tomadas del final de w1 (al menos 1 letra)
        for take_left in range(1, len(norm1)):
            left_part = norm1[-take_left:]
            # Letras tomadas del principio de w2 (al menos 1 letra)
            for take_right in range(1, len(norm2) + 1):
                total_len = take_left + take_right
                if min_len <= total_len <= max_len:
                    candidate = left_part + norm2[:take_right]
                    if candidate in lexicon.normalized_words:
                        real_words = lexicon.norm_to_original[candidate]
                        results.append({
                            'type': 'cruce_espacio',
                            'hidden_word': real_words[0],
                            'left_word': w1,
                            'right_word': w2,
                            'left_slice': left_part,
                            'right_slice': norm2[:take_right],
                            'context': f"...{w1} {w2}...",
                            'length': len(candidate),
                            'explanation': f"El cruce entre '{w1}' y '{w2}' oculta la palabra '{real_words[0]}'"
                        })

    return results


def find_telescopes(sentence: str, lexicon: Lexicon, min_len: int = 3, max_len: int = 7):
    """Busca palabras de 3 a 7 letras estrictamente contenidas dentro de una palabra más larga."""
    tokens = clean_tokens(sentence)
    results = []
    seen = set()

    for word in tokens:
        w_lower = word.lower()
        w_norm = strip_accents(w_lower)
        if len(w_norm) <= min_len:
            continue

        for length in range(min_len, min(len(w_norm), max_len + 1)):
            for start in range(0, len(w_norm) - length + 1):
                sub = w_norm[start:start + length]
                # No considerar la palabra entera
                if sub == w_norm:
                    continue
                if sub in lexicon.normalized_words:
                    real_words = lexicon.norm_to_original[sub]
                    for rw in real_words:
                        key = (rw, w_lower)
                        if key not in seen and rw != w_lower:
                            seen.add(key)
                            results.append({
                                'type': 'palabra_telescopica',
                                'hidden_word': rw,
                                'parent_word': w_lower,
                                'context': f"...{word}...",
                                'start_offset': start,
                                'length': len(rw),
                                'explanation': f"La palabra '{w_lower}' contiene escondida en su interior la palabra '{rw}'"
                            })

    return results


def find_charades(sentence: str, lexicon: Lexicon):
    """Descompone una palabra en dos términos consecutivos que forman la palabra completa."""
    tokens = clean_tokens(sentence)
    results = []
    seen = set()

    for word in tokens:
        w_lower = word.lower()
        w_norm = strip_accents(w_lower)
        if len(w_norm) < 5:
            continue

        for split_idx in range(2, len(w_norm) - 1):
            left = w_norm[:split_idx]
            right = w_norm[split_idx:]

            if left in lexicon.normalized_words and right in lexicon.normalized_words:
                left_real = lexicon.norm_to_original[left][0]
                right_real = lexicon.norm_to_original[right][0]
                key = (w_lower, left_real, right_real)
                if key not in seen:
                    seen.add(key)
                    results.append({
                        'type': 'charada_morfologica',
                        'compound_word': w_lower,
                        'part_1': left_real,
                        'part_2': right_real,
                        'context': f"...{word}...",
                        'length': len(w_lower),
                        'explanation': f"'{w_lower}' se compone de '{left_real}' + '{right_real}'"
                    })

    return results


def find_anagrams(sentence: str, lexicon: Lexicon):
    """Busca si alguna palabra de la frase es anagrama de otra palabra del diccionario."""
    tokens = clean_tokens(sentence)
    results = []
    seen = set()

    for word in tokens:
        w_lower = word.lower()
        w_norm = strip_accents(w_lower)
        if len(w_norm) < 3 or len(w_norm) > 7:
            continue

        sorted_key = ''.join(sorted(w_norm))
        matches = [m for m in lexicon.anagram_map.get(sorted_key, []) if strip_accents(m.lower()) != w_norm]

        if matches:
            for match in matches[:3]:
                key = tuple(sorted([w_lower, match]))
                if key not in seen:
                    seen.add(key)
                    results.append({
                        'type': 'anagrama',
                        'source_word': w_lower,
                        'anagram_word': match,
                        'context': f"...{word}...",
                        'length': len(w_lower),
                        'explanation': f"'{w_lower}' es un anagrama exacto de '{match}'"
                    })

    return results


def scan_sentence(sentence: str, lexicon: Lexicon = None) -> dict:
    """Escanea la frase completa y agrupa todas las oportunidades enigmísticas detectadas."""
    if lexicon is None:
        lexicon = Lexicon()

    crosses = find_cross_boundaries(sentence, lexicon)
    telescopes = find_telescopes(sentence, lexicon)
    charades = find_charades(sentence, lexicon)
    anagrams = find_anagrams(sentence, lexicon)

    total_opportunities = len(crosses) + len(telescopes) + len(charades) + len(anagrams)

    return {
        'sentence': sentence,
        'total_opportunities': total_opportunities,
        'cross_boundaries': crosses[:10],
        'telescopes': telescopes[:10],
        'charades': charades[:10],
        'anagrams': anagrams[:10],
    }


def main():
    if len(sys.argv) > 1:
        test_sentence = " ".join(sys.argv[1:])
    else:
        test_sentence = (
            "Un día como hoy, pero en 1962, John F. Kennedy anunció el bloqueo naval a Cuba "
            "durante la Crisis de los Misiles, mientras el pintor santiago lento desafiaba al soldado."
        )

    print(f"Cargando lexicón en español desde {DICT_PATH}...")
    lex = Lexicon()
    print(f"Lexicón cargado: {len(lex.words)} palabras.")
    print(f"\nEscaneando frase:\n«{test_sentence}»\n")

    res = scan_sentence(test_sentence, lex)

    print(f"--- OPORTUNIDADES ENIGMÍSTICAS DETECTADAS ({res['total_opportunities']}) ---")
    print(f"1. Cruces entre palabras ({len(res['cross_boundaries'])}):")
    for item in res['cross_boundaries'][:5]:
        print(f"   • {item['explanation']} (contexto: {item['context']})")

    print(f"\n2. Palabras telescópicas / Inclusiones ({len(res['telescopes'])}):")
    for item in res['telescopes'][:5]:
        print(f"   • {item['explanation']} (contexto: {item['context']})")

    print(f"\n3. Charadas morfológicas ({len(res['charades'])}):")
    for item in res['charades'][:5]:
        print(f"   • {item['explanation']} (contexto: {item['context']})")

    print(f"\n4. Anagramas exactos ({len(res['anagrams'])}):")
    for item in res['anagrams'][:5]:
        print(f"   • {item['explanation']} (contexto: {item['context']})")


if __name__ == '__main__':
    main()
