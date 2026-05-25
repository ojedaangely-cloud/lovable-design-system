-- 1. Drop existing restricted policies on sales
DROP POLICY IF EXISTS "Users manage own sales" ON public.sales_entries;

-- 2. Drop existing restricted policies on expenses
DROP POLICY IF EXISTS "Users manage own expenses" ON public.expense_entries;

-- 3. Drop existing restricted policies on inventory
DROP POLICY IF EXISTS "Users manage own inventory" ON public.inventory_items;


-- ==========================================
-- NEW ROBUST POLICIES FOR SALES ENTRIES
-- ==========================================

-- SELECT: Allow all authenticated users to see all sales
CREATE POLICY "Allow select for all authenticated users" 
ON public.sales_entries 
FOR SELECT 
TO authenticated 
USING (true);

-- INSERT: Allow admins and managers to insert sales
CREATE POLICY "Allow insert for admin and manager" 
ON public.sales_entries 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.jwt() ->> 'email' = 'ojedaangely@gmail.com' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
);

-- UPDATE/DELETE: Allow admin full control; manager control only over their own rows
CREATE POLICY "Allow update and delete for admin or owner manager" 
ON public.sales_entries 
FOR ALL 
TO authenticated 
USING (
  auth.jwt() ->> 'email' = 'ojedaangely@gmail.com' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
  (auth.uid() = user_id AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager')
) 
WITH CHECK (
  auth.jwt() ->> 'email' = 'ojedaangely@gmail.com' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
  (auth.uid() = user_id AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager')
);


-- ==========================================
-- NEW ROBUST POLICIES FOR EXPENSE ENTRIES
-- ==========================================

-- SELECT: Allow all authenticated users to see all expenses
CREATE POLICY "Allow select for all authenticated users" 
ON public.expense_entries 
FOR SELECT 
TO authenticated 
USING (true);

-- INSERT: Allow admins and managers to insert expenses
CREATE POLICY "Allow insert for admin and manager" 
ON public.expense_entries 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.jwt() ->> 'email' = 'ojedaangely@gmail.com' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
);

-- UPDATE/DELETE: Allow admin full control; manager control only over their own rows
CREATE POLICY "Allow update and delete for admin or owner manager" 
ON public.expense_entries 
FOR ALL 
TO authenticated 
USING (
  auth.jwt() ->> 'email' = 'ojedaangely@gmail.com' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
  (auth.uid() = user_id AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager')
) 
WITH CHECK (
  auth.jwt() ->> 'email' = 'ojedaangely@gmail.com' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
  (auth.uid() = user_id AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager')
);


-- ==========================================
-- NEW ROBUST POLICIES FOR INVENTORY ITEMS
-- ==========================================

-- SELECT: Allow all authenticated users to see all inventory items
CREATE POLICY "Allow select for all authenticated users" 
ON public.inventory_items 
FOR SELECT 
TO authenticated 
USING (true);

-- INSERT: Allow admins and managers to insert inventory items
CREATE POLICY "Allow insert for admin and manager" 
ON public.inventory_items 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.jwt() ->> 'email' = 'ojedaangely@gmail.com' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
);

-- UPDATE/DELETE: Allow admin full control; manager control only over their own rows
CREATE POLICY "Allow update and delete for admin or owner manager" 
ON public.inventory_items 
FOR ALL 
TO authenticated 
USING (
  auth.jwt() ->> 'email' = 'ojedaangely@gmail.com' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
  (auth.uid() = user_id AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager')
) 
WITH CHECK (
  auth.jwt() ->> 'email' = 'ojedaangely@gmail.com' OR
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
  (auth.uid() = user_id AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager')
);


-- ==========================================
-- STORAGE POLICIES ADJUSTMENTS FOR INVOICES
-- ==========================================

-- 1. Drop existing restricted storage policies
DROP POLICY IF EXISTS "Users view own invoices" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own invoices" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own invoices" ON storage.objects;

-- 2. SELECT: Allow all authenticated users to read/download invoices
CREATE POLICY "Allow all authenticated users to read invoices" 
ON storage.objects 
FOR SELECT 
TO authenticated 
USING (bucket_id = 'invoices');

-- 3. INSERT: Allow admin and owner manager to upload invoices
CREATE POLICY "Allow admin and owner manager to upload invoices" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'invoices' AND (
    auth.jwt() ->> 'email' = 'ojedaangely@gmail.com' OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
    ((auth.jwt() -> 'user_metadata' ->> 'role') = 'manager' AND auth.uid()::text = (storage.foldername(name))[1])
  )
);

-- 4. DELETE: Allow admin and owner manager to delete invoices
CREATE POLICY "Allow admin and owner manager to delete invoices" 
ON storage.objects 
FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'invoices' AND (
    auth.jwt() ->> 'email' = 'ojedaangely@gmail.com' OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
    ((auth.jwt() -> 'user_metadata' ->> 'role') = 'manager' AND auth.uid()::text = (storage.foldername(name))[1])
  )
);
