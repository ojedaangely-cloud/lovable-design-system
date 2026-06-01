import { supabase } from "./client";

/**
 * Untyped Supabase client for the restaurant_borrego schema.
 * Use this when querying tables that live in the restaurant_borrego schema
 * (sales_entries, expense_entries, inventory_items, employees, payroll_records, time_entries).
 */
export const restaurantDb = (supabase as any).schema("restaurant_borrego");
