-- Up Migration
-- Every column carries its data class (DC-01.1). Restricted values use app.encrypted_field,
-- the shape written by @heach/crypto (DC-01.2).

CREATE DOMAIN app.encrypted_field AS jsonb CHECK (
  VALUE ?& ARRAY['ciphertext', 'keyVersion', 'algorithm', 'domain']
  AND VALUE ->> 'domain' IN ('health', 'identity', 'payments', 'documents')
);

CREATE TABLE app.data_key (
  domain text NOT NULL CHECK (domain IN ('health', 'identity', 'payments', 'documents')),
  version integer NOT NULL CHECK (version > 0),
  wrapped_key bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  PRIMARY KEY (domain, version)
);
CREATE UNIQUE INDEX data_key_one_current ON app.data_key (domain) WHERE retired_at IS NULL;
COMMENT ON COLUMN app.data_key.domain IS 'class=Confidential';
COMMENT ON COLUMN app.data_key.version IS 'class=Confidential';
COMMENT ON COLUMN app.data_key.wrapped_key IS 'class=Confidential';
COMMENT ON COLUMN app.data_key.created_at IS 'class=Confidential';
COMMENT ON COLUMN app.data_key.retired_at IS 'class=Confidential';
