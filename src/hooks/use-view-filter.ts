import { useState, useEffect, useMemo } from "react";
import { startOfWeek, endOfWeek, addWeeks, format, startOfYear, endOfYear } from "date-fns";
import { es } from "date-fns/locale";

export type FilterType = "semana" | "mes" | "ano" | "rango";

export interface FilterState {
  filterType: FilterType;
  selectedWeek: string; // key "yyyy-MM-dd"
  selectedMonth: string; // "0"-"11"
  selectedYear: string; // "yyyy"
  selectedRangeStart: string; // "yyyy-MM-dd"
  selectedRangeEnd: string; // "yyyy-MM-dd"
}

// Generate Wednesday-to-Tuesday weeks for 2025 and 2026, 2027
export function generateWeeksForYears(years: number[]) {
  const weeks: { label: string; from: Date; to: Date; key: string }[] = [];
  const today = new Date();

  for (const year of years) {
    const startOfY = startOfYear(new Date(year, 0, 1));
    const endOfY = endOfYear(new Date(year, 11, 31));

    // Find Wednesday of the week containing startOfY
    let current = startOfWeek(startOfY, { weekStartsOn: 3 });
    const limitDate = year === today.getFullYear() ? today : endOfY;

    const yearWeeks: typeof weeks = [];
    while (current <= limitDate) {
      const wFrom = new Date(current);
      const wTo = endOfWeek(current, { weekStartsOn: 3 });

      const label = `${format(wFrom, "dd MMM", { locale: es })} – ${format(wTo, "dd MMM yyyy", { locale: es })}`;
      const key = format(wFrom, "yyyy-MM-dd");

      yearWeeks.push({
        label,
        from: wFrom,
        to: wTo,
        key,
      });

      current = addWeeks(current, 1);
    }
    weeks.push(...yearWeeks.reverse());
  }

  // Deduplicate and sort newest first
  const seenKeys = new Set<string>();
  return weeks.filter(w => {
    if (seenKeys.has(w.key)) return false;
    seenKeys.add(w.key);
    return true;
  });
}

const STORAGE_KEYS = {
  FILTER_TYPE: "el_borrego_active_filter_type",
  WEEK: "el_borrego_active_week",
  MONTH: "el_borrego_active_month",
  YEAR: "el_borrego_active_year",
  RANGE_START: "el_borrego_active_range_start",
  RANGE_END: "el_borrego_active_range_end",
};

export function useViewFilter() {
  const today = new Date();
  const currentYearStr = today.getFullYear().toString();
  const currentMonthStr = today.getMonth().toString();

  // Static list of weeks
  const availableWeeks = useMemo(() => {
    const years = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1];
    return generateWeeksForYears(years);
  }, []);

  const defaultWeekKey = availableWeeks[0]?.key || format(startOfWeek(today, { weekStartsOn: 3 }), "yyyy-MM-dd");

  // Read initial states from localStorage or defaults
  const getStoredValue = (key: string, defaultValue: string) => {
    if (typeof window === "undefined") return defaultValue;
    return localStorage.getItem(key) || defaultValue;
  };

  // Active state (synchronized in localStorage)
  const [activeFilterType, setActiveFilterType] = useState<FilterType>(() => {
    return getStoredValue(STORAGE_KEYS.FILTER_TYPE, "mes") as FilterType;
  });
  const [activeWeek, setActiveWeek] = useState<string>(() => {
    return getStoredValue(STORAGE_KEYS.WEEK, defaultWeekKey);
  });
  const [activeMonth, setActiveMonth] = useState<string>(() => {
    return getStoredValue(STORAGE_KEYS.MONTH, currentMonthStr);
  });
  const [activeYear, setActiveYear] = useState<string>(() => {
    return getStoredValue(STORAGE_KEYS.YEAR, currentYearStr);
  });
  const [activeRangeStart, setActiveRangeStart] = useState<string>(() => {
    const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return getStoredValue(STORAGE_KEYS.RANGE_START, format(startOfCurrentMonth, "yyyy-MM-dd"));
  });
  const [activeRangeEnd, setActiveRangeEnd] = useState<string>(() => {
    return getStoredValue(STORAGE_KEYS.RANGE_END, format(today, "yyyy-MM-dd"));
  });

  // Draft state (for form bindings)
  const [draftFilterType, setDraftFilterType] = useState<FilterType>(activeFilterType);
  const [draftWeek, setDraftWeek] = useState<string>(activeWeek);
  const [draftMonth, setDraftMonth] = useState<string>(activeMonth);
  const [draftYear, setDraftYear] = useState<string>(activeYear);
  const [draftRangeStart, setDraftRangeStart] = useState<string>(activeRangeStart);
  const [draftRangeEnd, setDraftRangeEnd] = useState<string>(activeRangeEnd);

  // Sync draft states with active states on mount or if active states change (e.g. storage event)
  useEffect(() => {
    setDraftFilterType(activeFilterType);
    setDraftWeek(activeWeek);
    setDraftMonth(activeMonth);
    setDraftYear(activeYear);
    setDraftRangeStart(activeRangeStart);
    setDraftRangeEnd(activeRangeEnd);
  }, [activeFilterType, activeWeek, activeMonth, activeYear, activeRangeStart, activeRangeEnd]);

  // Listen to cross-tab/cross-component changes in localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (Object.values(STORAGE_KEYS).includes(e.key || "")) {
        setActiveFilterType(getStoredValue(STORAGE_KEYS.FILTER_TYPE, "mes") as FilterType);
        setActiveWeek(getStoredValue(STORAGE_KEYS.WEEK, defaultWeekKey));
        setActiveMonth(getStoredValue(STORAGE_KEYS.MONTH, currentMonthStr));
        setActiveYear(getStoredValue(STORAGE_KEYS.YEAR, currentYearStr));
        setActiveRangeStart(getStoredValue(STORAGE_KEYS.RANGE_START, format(new Date(today.getFullYear(), today.getMonth(), 1), "yyyy-MM-dd")));
        setActiveRangeEnd(getStoredValue(STORAGE_KEYS.RANGE_END, format(today, "yyyy-MM-dd")));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [defaultWeekKey, currentMonthStr, currentYearStr]);

  // Compute active date range from active filter state
  const activeDateRange = useMemo(() => {
    let fromStr = "";
    let toStr = "";

    if (activeFilterType === "semana") {
      const fromParts = activeWeek.split("-");
      const fromDate = new Date(Number(fromParts[0]), Number(fromParts[1]) - 1, Number(fromParts[2]));
      fromDate.setHours(0, 0, 0, 0);
      const toDate = endOfWeek(fromDate, { weekStartsOn: 3 });
      fromStr = activeWeek;
      toStr = format(toDate, "yyyy-MM-dd");
    } else if (activeFilterType === "mes") {
      const yearNum = Number(activeYear);
      const monthNum = Number(activeMonth);
      const lastDay = new Date(yearNum, monthNum + 1, 0).getDate();
      fromStr = `${yearNum}-${String(monthNum + 1).padStart(2, "0")}-01`;
      toStr = `${yearNum}-${String(monthNum + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    } else if (activeFilterType === "ano") {
      fromStr = `${activeYear}-01-01`;
      toStr = `${activeYear}-12-31`;
    } else if (activeFilterType === "rango") {
      fromStr = activeRangeStart;
      toStr = activeRangeEnd;
    }

    return { fromStr, toStr };
  }, [activeFilterType, activeWeek, activeMonth, activeYear, activeRangeStart, activeRangeEnd]);

  // Save drafts to active states (localStorage)
  const applyFilter = () => {
    localStorage.setItem(STORAGE_KEYS.FILTER_TYPE, draftFilterType);
    localStorage.setItem(STORAGE_KEYS.WEEK, draftWeek);
    localStorage.setItem(STORAGE_KEYS.MONTH, draftMonth);
    localStorage.setItem(STORAGE_KEYS.YEAR, draftYear);
    localStorage.setItem(STORAGE_KEYS.RANGE_START, draftRangeStart);
    localStorage.setItem(STORAGE_KEYS.RANGE_END, draftRangeEnd);

    // Apply state locally immediately
    setActiveFilterType(draftFilterType);
    setActiveWeek(draftWeek);
    setActiveMonth(draftMonth);
    setActiveYear(draftYear);
    setActiveRangeStart(draftRangeStart);
    setActiveRangeEnd(draftRangeEnd);
  };

  return {
    // Active states
    activeFilterType,
    activeWeek,
    activeMonth,
    activeYear,
    activeRangeStart,
    activeRangeEnd,
    fromStr: activeDateRange.fromStr,
    toStr: activeDateRange.toStr,

    // Draft states for UI binding
    draftFilterType,
    draftWeek,
    draftMonth,
    draftYear,
    draftRangeStart,
    draftRangeEnd,

    // Setters for drafts
    setDraftFilterType,
    setDraftWeek,
    setDraftMonth,
    setDraftYear,
    setDraftRangeStart,
    setDraftRangeEnd,

    // Trigger action
    applyFilter,
    availableWeeks,
  };
}
