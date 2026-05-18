-- Clean up test/mock records for sales and expenses
TRUNCATE TABLE public.sales_entries CASCADE;
TRUNCATE TABLE public.expense_entries CASCADE;
