-- Drop all triggers and check constraints on expense_entries that restrict or map paid_by values
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all triggers on expense_entries in restaurant_borrego and public schemas
    FOR r IN (
        SELECT trigger_name, event_object_schema, event_object_table
        FROM information_schema.triggers
        WHERE event_object_table = 'expense_entries'
          AND event_object_schema IN ('restaurant_borrego', 'public')
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON ' || quote_ident(r.event_object_schema) || '.' || quote_ident(r.event_object_table) || ' CASCADE;';
    END LOOP;

    -- Drop all check constraints on expense_entries in restaurant_borrego and public schemas
    FOR r IN (
        SELECT conname, nspname, relname
        FROM pg_constraint con
        JOIN pg_class c ON c.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'expense_entries'
          AND n.nspname IN ('restaurant_borrego', 'public')
          AND con.contype = 'c'
    ) LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.nspname) || '.' || quote_ident(r.relname) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE;';
    END LOOP;
END $$;

-- Update the specific row that the user registered and was saved as 'No especificado'
UPDATE restaurant_borrego.expense_entries
SET paid_by = 'Rony'
WHERE id = '44c78b30-c70b-44a9-be3d-6b3a14924a37';

UPDATE public.expense_entries
SET paid_by = 'Rony'
WHERE id = '44c78b30-c70b-44a9-be3d-6b3a14924a37';
