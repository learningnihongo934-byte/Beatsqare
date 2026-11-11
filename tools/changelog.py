#!/usr/bin/env python3
"""Regenerate CHANGELOG.md from public/js/changelog.js (the in-game update log is the source of truth)."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'public/js/changelog.js').read_text()
out = ['# Update log', '', 'Also in the game at `#/updates`.', '']
for m in re.finditer(r"v: '([\d.]+)', date: '([\d-]+)', title: '([^']+)',\s*items: \[(.*?)\n    \],", src, re.S):
    out += [f'## v{m[1]} — {m[3]} ({m[2]})', '']
    for k, t in re.findall(r"\['(\w+)', '((?:[^'\\]|\\.)*)'\]", m[4]):
        out.append(f"- **{ {'new': 'New', 'up': 'Improved', 'fix': 'Fixed'}[k]}:** {t}")
    out.append('')
(root / 'CHANGELOG.md').write_text('\n'.join(out))
