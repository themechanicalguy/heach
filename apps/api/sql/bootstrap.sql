-- Database roles, schemas and the audit log (EN-10.2, SE-05). Run by the superuser on every
-- deploy; idempotent. Passwords are set by bootstrap.ts, never written here.
--   heach_migrator    runs migrations; owns schemas app and migrations
--   heach_app         the API: reads and writes app tables; may only append to the audit log
--   heach_audit_owner owns schema audit; cannot log in, so neither role above can change it

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'heach_migrator') THEN
    CREATE ROLE heach_migrator LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'heach_app') THEN
    CREATE ROLE heach_app LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'heach_audit_owner') THEN
    CREATE ROLE heach_audit_owner NOLOGIN;
  END IF;
END
$roles$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION heach_migrator;
CREATE SCHEMA IF NOT EXISTS migrations AUTHORIZATION heach_migrator;
CREATE SCHEMA IF NOT EXISTS audit AUTHORIZATION heach_audit_owner;
REVOKE ALL ON SCHEMA app, migrations, audit FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO heach_app;
GRANT USAGE ON SCHEMA audit TO heach_app, heach_migrator;

ALTER DEFAULT PRIVILEGES FOR ROLE heach_migrator IN SCHEMA app
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO heach_app;
ALTER DEFAULT PRIVILEGES FOR ROLE heach_migrator IN SCHEMA app
  GRANT USAGE, SELECT ON SEQUENCES TO heach_app;
ALTER DEFAULT PRIVILEGES FOR ROLE heach_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

SET ROLE heach_audit_owner;

-- Hash chain: each entry's hash covers the previous hash and its own fields (SE-05.2, SE-05.3).
-- No Restricted values: entity IDs are UUIDs, never names, numbers or note text.
CREATE TABLE IF NOT EXISTS audit.entry (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id uuid NOT NULL UNIQUE,
  at timestamptz NOT NULL,
  actor_id text,
  actor_role text NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  correlation_id text NOT NULL,
  prev_hash text NOT NULL,
  hash text NOT NULL
);
COMMENT ON TABLE audit.entry IS 'Append-only audit log; heach_app may only call audit.append';
COMMENT ON COLUMN audit.entry.seq IS 'class=Internal';
COMMENT ON COLUMN audit.entry.id IS 'class=Internal';
COMMENT ON COLUMN audit.entry.at IS 'class=Internal';
COMMENT ON COLUMN audit.entry.actor_id IS 'class=Internal';
COMMENT ON COLUMN audit.entry.actor_role IS 'class=Internal';
COMMENT ON COLUMN audit.entry.action IS 'class=Internal';
COMMENT ON COLUMN audit.entry.entity IS 'class=Internal';
COMMENT ON COLUMN audit.entry.entity_id IS 'class=Internal';
COMMENT ON COLUMN audit.entry.correlation_id IS 'class=Internal';
COMMENT ON COLUMN audit.entry.prev_hash IS 'class=Internal';
COMMENT ON COLUMN audit.entry.hash IS 'class=Internal';

CREATE OR REPLACE FUNCTION audit.entry_hash(
  p_prev text, p_id uuid, p_at timestamptz, p_actor_id text, p_actor_role text,
  p_action text, p_entity text, p_entity_id text, p_correlation_id text
) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $fn$
  SELECT encode(sha256(convert_to(concat_ws('|',
    p_prev, p_id::text, to_char(p_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    coalesce(p_actor_id, ''), p_actor_role, p_action, p_entity, coalesce(p_entity_id, ''),
    p_correlation_id), 'UTF8')), 'hex')
$fn$;

CREATE OR REPLACE FUNCTION audit.append(
  p_actor_id text, p_actor_role text, p_action text, p_entity text, p_entity_id text,
  p_correlation_id text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, audit AS $fn$
DECLARE
  v_prev text;
  v_id uuid := gen_random_uuid();
  v_at timestamptz := clock_timestamp();
BEGIN
  -- One writer at a time keeps the chain linear.
  PERFORM pg_advisory_xact_lock(hashtext('audit.entry'));
  SELECT hash INTO v_prev FROM audit.entry ORDER BY seq DESC LIMIT 1;
  v_prev := coalesce(v_prev, repeat('0', 64));
  INSERT INTO audit.entry (id, at, actor_id, actor_role, action, entity, entity_id,
                           correlation_id, prev_hash, hash)
  VALUES (v_id, v_at, p_actor_id, p_actor_role, p_action, p_entity, p_entity_id,
          p_correlation_id, v_prev,
          audit.entry_hash(v_prev, v_id, v_at, p_actor_id, p_actor_role, p_action, p_entity,
                           p_entity_id, p_correlation_id));
  RETURN v_id;
END
$fn$;

-- Returns the seq of the first entry whose link or hash does not match, or NULL if intact.
CREATE OR REPLACE FUNCTION audit.verify_chain() RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, audit AS $fn$
DECLARE
  r audit.entry;
  v_prev text := repeat('0', 64);
BEGIN
  FOR r IN SELECT * FROM audit.entry ORDER BY seq LOOP
    IF r.prev_hash <> v_prev OR r.hash <> audit.entry_hash(r.prev_hash, r.id, r.at, r.actor_id,
        r.actor_role, r.action, r.entity, r.entity_id, r.correlation_id) THEN
      RETURN r.seq;
    END IF;
    v_prev := r.hash;
  END LOOP;
  RETURN NULL;
END
$fn$;

REVOKE ALL ON ALL TABLES IN SCHEMA audit FROM PUBLIC, heach_app, heach_migrator;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA audit FROM PUBLIC;
GRANT EXECUTE ON FUNCTION audit.append(text, text, text, text, text, text) TO heach_app;
GRANT EXECUTE ON FUNCTION audit.verify_chain() TO heach_migrator;

RESET ROLE;
