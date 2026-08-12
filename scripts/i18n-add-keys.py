#!/usr/bin/env python3
"""Adds i18n keys to all four locale files at once, keeping exact parity.

Usage: pass a JSON file whose shape is {"dotted.key.path": {"es": ..., "en": ..., "fr": ..., "it": ...}}
"""
import json, sys, collections

LOCALES = ["es", "en", "fr", "it"]
BASE = "client/src/i18n/locales"

def set_path(d, path, value):
    parts = path.split(".")
    for p in parts[:-1]:
        d = d.setdefault(p, {})
        if not isinstance(d, dict):
            raise SystemExit(f"path collision at {path}")
    d[parts[-1]] = value

def count(d):
    n = 0
    for v in d.values():
        n += count(v) if isinstance(v, dict) else 1
    return n

def flat(d, prefix=""):
    out = set()
    for k, v in d.items():
        p = f"{prefix}{k}"
        if isinstance(v, dict):
            out |= flat(v, p + ".")
        else:
            out.add(p)
    return out

additions = json.load(open(sys.argv[1]))

loaded = {}
for lang in LOCALES:
    path = f"{BASE}/{lang}.json"
    loaded[lang] = json.load(open(path), object_pairs_hook=collections.OrderedDict)

for key, values in additions.items():
    missing = [l for l in LOCALES if l not in values or not str(values[l]).strip()]
    if missing:
        raise SystemExit(f"{key} is missing {missing}")
    for lang in LOCALES:
        set_path(loaded[lang], key, values[lang])

for lang in LOCALES:
    with open(f"{BASE}/{lang}.json", "w") as fh:
        json.dump(loaded[lang], fh, ensure_ascii=False, indent=2)
        fh.write("\n")

ref = flat(loaded["es"])
for lang in LOCALES:
    diff = ref ^ flat(loaded[lang])
    if diff:
        raise SystemExit(f"parity broken in {lang}: {sorted(diff)[:10]}")

print(f"ok — {count(loaded['es'])} keys in each of {', '.join(LOCALES)}")
