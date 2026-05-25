-- Add restaurant_branch column to sales_entries to distinguish sales by restaurant branch
ALTER TABLE public.sales_entries ADD COLUMN IF NOT EXISTS restaurant_branch TEXT NOT NULL DEFAULT 'borrego';
