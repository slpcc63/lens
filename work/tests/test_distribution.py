import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate_release import ROOT, RELEASE_URL, validate_text


class DistributionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = (ROOT / 'dist/sniffies.user.js').read_text()
        cls.version = (ROOT / 'VERSION').read_text().strip()

    def test_release_eligible(self):
        self.assertEqual(validate_text(self.text, self.version, 'v' + self.version),
                         (ROOT / 'chrome/filter.js').read_text())

    def test_development_or_mismatched_tags_rejected(self):
        for version, tag in [('1.5.1-dev', 'v1.5.1-dev'), (self.version, 'v0.0.0'),
                             (self.version, 'main'), ('01.5.1', 'v01.5.1')]:
            with self.subTest(version=version, tag=tag), self.assertRaises(ValueError):
                validate_text(self.text, version, tag)

    def test_stable_channel_and_identity_cannot_drift(self):
        for old, new in [(RELEASE_URL, 'https://example.test/dev.user.js'),
                         ('Lens for Sniffies', 'Another script'),
                         ('document-start', 'document-end'),
                         ('@grant        none', '@grant        GM.xmlHttpRequest')]:
            with self.subTest(new=new), self.assertRaises(ValueError):
                validate_text(self.text.replace(old, new), self.version)

    def test_remote_runtime_dependency_rejected(self):
        with self.assertRaises(ValueError):
            validate_text(self.text.replace('// ==/UserScript==',
                          '// @require https://example.test/runtime.js\n// ==/UserScript=='), self.version)


if __name__ == '__main__':
    unittest.main()
