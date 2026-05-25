-- Crear schema dedicado para el sistema Restaurant Borrego
CREATE SCHEMA IF NOT EXISTS restaurant_borrego;

-- Permitir acceso desde la API de Supabase
GRANT USAGE ON SCHEMA restaurant_borrego TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA restaurant_borrego
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA restaurant_borrego
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA restaurant_borrego
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- Mover las tablas usadas por la aplicación al nuevo schema
ALTER TABLE public.sales_entries    SET SCHEMA restaurant_borrego;
ALTER TABLE public.expense_entries  SET SCHEMA restaurant_borrego;
ALTER TABLE public.inventory_items  SET SCHEMA restaurant_borrego;
ALTER TABLE public.employees        SET SCHEMA restaurant_borrego;
ALTER TABLE public.payroll_records  SET SCHEMA restaurant_borrego;

-- Asegurar permisos sobre las tablas movidas
GRANT ALL ON ALL TABLES IN SCHEMA restaurant_borrego TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA restaurant_borrego TO anon, authenticated, service_role;
