-- API 360 (self-contained)
SET DEFINE OFF;

BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE api_sources (
      source_id        VARCHAR2(120) NOT NULL,
      display_name     VARCHAR2(256),
      project_id       VARCHAR2(40) DEFAULT ''sei'',
      project_program  VARCHAR2(40),
      feature_group    VARCHAR2(80),
      kind             VARCHAR2(30) DEFAULT ''OpenAPI'',
      release_version  VARCHAR2(40),
      geography        VARCHAR2(10),
      regulatory_scope VARCHAR2(40),
      spec_path        VARCHAR2(1000),
      endpoint_count   NUMBER DEFAULT 0,
      last_ingested    VARCHAR2(40),
      CONSTRAINT pk_api_sources PRIMARY KEY (source_id)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE api_endpoints (
      endpoint_key      VARCHAR2(520) NOT NULL,
      source_id         VARCHAR2(120),
      method            VARCHAR2(10),
      path              VARCHAR2(512),
      operation_id      VARCHAR2(256),
      summary           VARCHAR2(1000),
      description       CLOB,
      function_point_id VARCHAR2(40),
      full_endpoint_url VARCHAR2(1000),
      sei_version       VARCHAR2(40),
      server_url        VARCHAR2(512),
      example_count     NUMBER DEFAULT 0,
      error_count       NUMBER DEFAULT 0,
      requires_auth     CHAR(1) DEFAULT ''Y'',
      project_id        VARCHAR2(40),
      feature_group     VARCHAR2(80),
      CONSTRAINT pk_api_endpoints PRIMARY KEY (endpoint_key)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE api_endpoint_errors (
      endpoint_key       VARCHAR2(520) NOT NULL,
      http_status        VARCHAR2(10) NOT NULL,
      error_code         VARCHAR2(400) NOT NULL,
      sequence_no        NUMBER NOT NULL,
      business_exception CLOB,
      error_details      CLOB,
      CONSTRAINT pk_api_endpoint_errors PRIMARY KEY (endpoint_key, http_status, error_code, sequence_no)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE api_fields (
      endpoint_key  VARCHAR2(520) NOT NULL,
      field_name    VARCHAR2(256) NOT NULL,
      data_type     VARCHAR2(60),
      required      CHAR(1) DEFAULT ''N'',
      max_length    NUMBER,
      format        VARCHAR2(60),
      example_value VARCHAR2(4000),
      description   CLOB,
      is_pii        CHAR(1) DEFAULT ''N'',
      pii_category  VARCHAR2(60),
      pii_attribute VARCHAR2(128),
      CONSTRAINT pk_api_fields PRIMARY KEY (endpoint_key, field_name)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE api_flows (
      flow_key    VARCHAR2(256) NOT NULL,
      flow_name   VARCHAR2(256),
      project_id  VARCHAR2(40),
      description VARCHAR2(2000),
      step_count  NUMBER DEFAULT 0,
      CONSTRAINT pk_api_flows PRIMARY KEY (flow_key)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE api_flow_steps (
      flow_key        VARCHAR2(256) NOT NULL,
      step_order      NUMBER NOT NULL,
      endpoint_key    VARCHAR2(520),
      label           VARCHAR2(256),
      variable_passed VARCHAR2(256),
      CONSTRAINT pk_api_flow_steps PRIMARY KEY (flow_key, step_order)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE '
CREATE TABLE api_dependencies (
      from_endpoint VARCHAR2(520) NOT NULL,
      to_endpoint   VARCHAR2(520) NOT NULL,
      dep_type      VARCHAR2(40) DEFAULT ''calls'',
      CONSTRAINT pk_api_dependencies PRIMARY KEY (from_endpoint, to_endpoint)
)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE != -955 THEN RAISE; END IF;  -- -955 = name already used (table exists)
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_api_ep_source ON api_endpoints(source_id)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_api_ep_project ON api_endpoints(project_id)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX ix_api_fields_pii ON api_fields(is_pii)';
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;  -- already exists
END;
/
