CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cas_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

DO $$
BEGIN
  INSERT INTO users (cas_id, name)
  VALUES ('jrmerz', 'Justin Merz'),
          ('quinn', 'Quinn Hart'),
          ('rakunkel', 'Roger Kunkel')
  ON CONFLICT (cas_id) DO NOTHING;
END $$;
