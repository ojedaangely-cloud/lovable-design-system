-- 1. Create employees table
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT 'Empleado',
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- SELECT: Allow all authenticated users
CREATE POLICY "Allow select for all authenticated users" 
ON public.employees 
FOR SELECT 
TO authenticated 
USING (true);

-- INSERT/UPDATE/DELETE: Allow admins and managers
CREATE POLICY "Allow write for admin and manager" 
ON public.employees 
FOR ALL 
TO authenticated 
USING (
  auth.jwt() ->> 'email' = 'ojedaangely@gmail.com' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
) 
WITH CHECK (
  auth.jwt() ->> 'email' = 'ojedaangely@gmail.com' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
);


-- 2. Create payroll_records table
CREATE TABLE IF NOT EXISTS public.payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  hours_worked NUMERIC NOT NULL DEFAULT 0,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendiente',
  notes TEXT DEFAULT '',
  expense_entry_id UUID REFERENCES public.expense_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on payroll_records
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

-- SELECT: Allow all authenticated users
CREATE POLICY "Allow select for all authenticated users" 
ON public.payroll_records 
FOR SELECT 
TO authenticated 
USING (true);

-- INSERT/UPDATE/DELETE: Allow admins and managers
CREATE POLICY "Allow write for admin and manager" 
ON public.payroll_records 
FOR ALL 
TO authenticated 
USING (
  auth.jwt() ->> 'email' = 'ojedaangely@gmail.com' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
) 
WITH CHECK (
  auth.jwt() ->> 'email' = 'ojedaangely@gmail.com' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
);
