-- Add linked_user_id to employees so employees can be linked to their auth account
ALTER TABLE restaurant_borrego.employees
  ADD COLUMN IF NOT EXISTS linked_user_id uuid;

-- Create time_entries table for clock-in / clock-out tracking
CREATE TABLE IF NOT EXISTS restaurant_borrego.time_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  uuid NOT NULL REFERENCES restaurant_borrego.employees(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  date         date NOT NULL DEFAULT CURRENT_DATE,
  clock_in     timestamptz NOT NULL DEFAULT now(),
  clock_out    timestamptz,
  hours_worked numeric(6,2),
  is_paid      boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE restaurant_borrego.time_entries ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read and write time_entries
CREATE POLICY "allow_authenticated_time_entries"
  ON restaurant_borrego.time_entries
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
