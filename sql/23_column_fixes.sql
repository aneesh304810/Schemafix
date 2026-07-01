-- =====================================================================
-- sql/23_column_fixes.sql
-- Post-hoc column widenings for existing installs (guarded, idempotent).
-- Safe to run repeatedly. ORA-01441/01442/-1440 tolerated.
-- =====================================================================
SET DEFINE OFF;
DECLARE
  PROCEDURE mod_col(p VARCHAR2) IS
  BEGIN EXECUTE IMMEDIATE p;
  EXCEPTION WHEN OTHERS THEN
    -- ORA-01441 (cannot decrease), ORA-01442/-1451 (nullability no-op),
    -- ORA-00942 (table absent) -> ignore; anything else re-raise
    IF SQLCODE NOT IN (-1441, -1442, -1451, -942, -1440) THEN RAISE; END IF;
  END;
BEGIN
  -- api endpoint error codes can be long messages, not short codes
  mod_col('ALTER TABLE api_endpoint_errors MODIFY (error_code VARCHAR2(400))');
END;
/
