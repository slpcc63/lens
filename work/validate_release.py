"""Validate the canonical release artifact, without modifying files or publishing."""
import argparse
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
RELEASE_URL = 'https://github.com/slpcc63/lens/releases/latest/download/sniffies.user.js'


def validate_text(text, version, tag=None):
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version):
        raise ValueError('Only stable major.minor.patch versions are release eligible')
    if tag is not None and tag != 'v' + version:
        raise ValueError('Tag must exactly match v + VERSION')
    if not text.startswith('// ==UserScript==\n') or text.count('// ==/UserScript==') != 1:
        raise ValueError('Expected one leading userscript metadata block')
    header, body = text.split('// ==/UserScript==\n\n', 1)
    fields = {}
    for key, value in re.findall(r'^// @(\S+)[ \t]*(.*)$', header, re.M):
        fields.setdefault(key, []).append(value.strip())
    expected = {
        'name': ['Lens for Sniffies'], 'namespace': ['local.sniffies-comfort-filter'],
        'version': [version], 'updateURL': [RELEASE_URL], 'downloadURL': [RELEASE_URL],
        'match': ['https://sniffies.com/*', 'https://www.sniffies.com/*'],
        'run-at': ['document-start'], 'inject-into': ['page'], 'grant': ['none'],
        'noframes': [''],
    }
    for key, values in expected.items():
        if fields.get(key) != values:
            raise ValueError('Unexpected metadata: ' + key)
    if 'require' in fields or '__LENS_VERSION__' in text:
        raise ValueError('Release must be self contained with a resolved version')
    return body


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tag')
    args = parser.parse_args()
    version = (ROOT / 'VERSION').read_text().strip()
    artifact = ROOT / 'dist/sniffies.user.js'
    text = artifact.read_text()
    body = validate_text(text, version, args.tag)
    if body != (ROOT / 'chrome/filter.js').read_text():
        raise ValueError('Userscript and Chrome runtime differ')
    if artifact.read_bytes() != (ROOT / 'sniffies-comfort-filter.user.js').read_bytes():
        raise ValueError('Legacy compatibility copy differs')
    if json.loads((ROOT / 'chrome/manifest.json').read_text())['version'] != version:
        raise ValueError('Chrome manifest version differs')
    print(json.dumps({'artifact': 'dist/sniffies.user.js', 'version': version,
                      'sha256': hashlib.sha256(artifact.read_bytes()).hexdigest()}))


if __name__ == '__main__':
    main()
