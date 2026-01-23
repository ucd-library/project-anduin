CREATE SCHEMA IF NOT EXISTS anduin;

CREATE TYPE anduin.backfill_status_enum AS ENUM (
  'RUNNING',
  'FINISHED'
);

-- CREATE OR REPLACE FUNCTION anduin.run_status_counts(backfill text)
-- RETURNS TABLE(status text, total_count bigint)
-- LANGUAGE sql
-- STABLE
-- AS $$
--   SELECT
--     status,
--     COUNT(*) AS total_count
--   FROM public.runs
--   WHERE backfill_id = backfill
--   GROUP BY status;
-- $$;

-- CREATE OR REPLACE VIEW anduin.distinct_backfills AS
--   SELECT
--     backfill_id,
--     MIN(create_timestamp) AS first_created
--   FROM public.runs
--   WHERE backfill_id IS NOT NULL
--   GROUP BY backfill_id;

CREATE TABLE IF NOT EXISTS anduin.backfill_status (
  backfill_id text PRIMARY KEY,
  status anduin.backfill_status_enum NOT NULL DEFAULT 'RUNNING',
  notified boolean NOT NULL DEFAULT false,
  last_updated timestamp with time zone NOT NULL DEFAULT now()
);



-- CREATE OR REPLACE FUNCTION public.refresh_backfill_status()
-- RETURNS void
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--   -- 1) Ensure every distinct_backfill has a row in backfill_status.
--   INSERT INTO public.backfill_status (backfill_id)
--   SELECT db.backfill_id
--   FROM public.distinct_backfills db
--   ON CONFLICT (backfill_id) DO NOTHING;

--   -- 2) Mark FINISHED when all run statuses are terminal; skip if already FINISHED.
--   UPDATE public.backfill_status bs
--   SET status = 'FINISHED',
--       last_updated  = now()
--   FROM LATERAL (
--     SELECT
--       COUNT(*) AS n_statuses,
--       BOOL_AND(r.run_status IN ('CANCELED', 'SUCCESS', 'FAILURE')) AS all_terminal
--     FROM public.run_status_counts(bs.backfill_id) r
--   ) s
--   WHERE bs.status_flag IS DISTINCT FROM 'FINISHED'
--     AND s.n_statuses > 0
--     AND s.all_terminal = TRUE;
-- END;
-- $$;

CREATE OR REPLACE FUNCTION anduin.set_backfill_finished(backfill text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  current_status anduin.backfill_status_enum;
BEGIN
  -- Acquire a write lock on the row
  SELECT status INTO current_status
  FROM anduin.backfill_status
  WHERE backfill_id = backfill
  FOR UPDATE;

  -- Check if row exists and status is RUNNING
  IF current_status IS NULL THEN
    RETURN false;
  END IF;

  IF current_status = 'RUNNING' THEN
    UPDATE anduin.backfill_status
    SET status = 'FINISHED',
        last_updated = now()
    WHERE backfill_id = backfill;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

