"""Real DuckDB regression tests. Generates actual Parquet; no mocked SQL reader."""
from pathlib import Path
import json, sys, tempfile, unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import duckdb
import catalog_backend as catalog
from automation_backend import load_filtered_facts

class RealParquetTests(unittest.TestCase):
    def test_catalog_read_real_parquet_from_unicode_space_path(self):
        with tempfile.TemporaryDirectory(prefix='grim parquet ') as root:
            folder=Path(root)/'그림 검사';folder.mkdir();path=folder/'labels.parquet'
            with duckdb.connect() as con:
                con.execute('CREATE TABLE labels(locale VARCHAR, tag VARCHAR, text VARCHAR)')
                con.execute('INSERT INTO labels VALUES (?, ?, ?)', ['ko','oath','서약운반자'])
                con.execute('COPY labels TO ? (FORMAT PARQUET)',[str(path)])
            self.assertEqual(catalog.read_parquet(path),[{'locale':'ko','tag':'oath','text':'서약운반자'}])
            self.assertEqual(catalog.read_parquet(path)[0]['text'],'서약운반자')

    def test_facts_real_parquet_last_value_and_filter(self):
        with tempfile.TemporaryDirectory(prefix='grim-facts-') as root:
            path=Path(root)/'facts.parquet'
            with duckdb.connect() as con:
                con.execute('CREATE TABLE facts(record VARCHAR, idx INTEGER, key VARCHAR, value VARCHAR, value_num DOUBLE)')
                con.executemany('INSERT INTO facts VALUES (?, ?, ?, ?, ?)', [
                    ('records/skills/test.dbr',1,'characterLife','10',10),
                    ('records/skills/test.dbr',2,'characterLife','20',20),
                    ('records/skills/test.dbr',3,'characterMana','0',0),
                    ('records/ignored/file.dbr',1,'characterLife','999',999),
                    ('records/items/a.dbr',1,'itemSkillLevel','3',3)])
                con.execute('COPY facts TO ? (FORMAT PARQUET)',[str(path)])
            rows=load_filtered_facts(path)
            self.assertEqual(len(rows),2)
            self.assertEqual(next(r for r in rows if r['key']=='characterLife')['value'],'20')

    def test_missing_file_fails(self):
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaises(duckdb.IOException):
                catalog.read_parquet(Path(root)/'missing.parquet')

    def test_corrupt_file_fails(self):
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'broken.parquet';path.write_bytes(b'not parquet')
            with self.assertRaises(duckdb.Error):catalog.read_parquet(path)

if __name__=='__main__':
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(RealParquetTests))
    report={'suite':'real DuckDB Parquet regression','duckdbVersion':duckdb.__version__,'platform':sys.platform,
      'mockedReader':False,'gameDataset':False,'passed':result.testsRun-len(result.errors)-len(result.failures),
      'failed':len(result.errors)+len(result.failures)}
    out=Path(__file__).resolve().parent/'reports';out.mkdir(exist_ok=True)
    (out/'parquet-real.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    sys.exit(0 if result.wasSuccessful() else 1)
