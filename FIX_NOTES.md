# Schema-mismatch fixes (5 bugs from the live run)

Root cause: several connectors were written against an assumed `columns` schema
(dataset_key / name / project_id) but your real `columns` table uses
platform_id / schema_name / object_name / column_name. That mismatch broke the
columns load, which cascaded: datapoint_index found 0 data points, so all 52
flow-datapoint and 197 reference resolutions failed as "unresolved" (FALSE gaps).

## Fixes (replace these files)
1. ingestion/feed_dictionary_conn.py
   - 'ReadOnlyCell has no attribute hyperlink' -> load the hyperlink workbook with
     read_only=False (read-only mode doesn't expose cell.hyperlink); guarded the access.
2. ingestion/feed_catalog_conn.py
   - ORA-00904 "T"."NAME" -> map feed fields to the real columns schema
     (platform_id, schema_name, object_name, column_name, ...). Merge key is now
     (platform_id, schema_name, object_name, column_name).
3. ingestion/loader_workbook_conn.py
   - same ORA-00904 -> loader attributes now map to the real columns schema
     (platform_id='SWP', schema_name='LOADERS', object_name=loader_id, column_name=attr).
4. ingestion/datapoint_indexer.py
   - "NAME"/"PROJECT_ID" invalid -> columns scan now selects column_name and a
     computed dataset_key; api_fields scan no longer selects project_id.
5. ingestion/search_index_builder.py
   - 'LOB' object is not subscriptable -> CLOB descr/business_desc are .read() to str
     before slicing; columns query uses the real schema (column_name, computed dataset_key).
6. sql/07_api360.sql + sql/23_column_fixes.sql
   - ORA-12899 ERROR_CODE too large (124>60) -> error_code widened VARCHAR2(60)->(400).
     07 is the fresh-install version; 23 is a guarded MODIFY for your EXISTING table.

## Apply
1. Widen the existing error_code column:
   sqlplus <dsn> @sql\23_column_fixes.sql
2. Replace the 5 ingestion .py files.
3. Re-run the full ingestion (order matters; a full run handles it):
   python -m ingestion.run
   -- or just the affected chain:
   python -m ingestion.run feed_dictionary feed_catalog loader_workbook api360 datapoint_index business_flow reference_data search_index

## What to expect after
- feed_catalog + loader_workbook: columns load cleanly (no ORA-00904).
- datapoint_index: builds a NON-zero dp_registry (this is the key one).
- business_flow + reference_data: the 52 + 197 "unresolved" should drop sharply now
  that dp_registry is populated. Whatever remains unresolved is a REAL gap worth review
  (e.g. reference codes like CURRENCY/COUNTRY that aren't feed fields).
- api360: loads its 1556 errors without truncation.
- search_index: builds without the LOB error.

## Note on the reference "category = ''" warning
Every reference row logged category ''. Your reference file's Category column may be
empty or under a different header. The rows still load and match on field name; only the
Browse-by-Category grouping needs categories. Worth confirming the real file's header row.
