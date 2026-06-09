import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { restaurantDb } from "@/integrations/supabase/restaurant-client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  DollarSign, 
  Clock, 
  UserPlus, 
  Calculator, 
  CheckCircle2, 
  AlertTriangle,
  Lock,
  Play,
  Square,
  Calendar,
  History
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/nomina")({
  component: Nomina,
});

type Employee = {
  id: string;
  name: string;
  position: string;
  hourly_rate: number;
  user_id: string;
  linked_user_id: string | null;
  created_at: string;
};

type PayrollRecord = {
  id: string;
  employee_id: string;
  date: string;
  hours_worked: number;
  hourly_rate: number;
  total_amount: number;
  status: string;
  notes: string;
  expense_entry_id?: string;
  user_id: string;
  created_at: string;
  employees?: {
    name: string;
    position: string;
  };
};

type TimeEntry = {
  id: string;
  employee_id: string;
  user_id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number | null;
  is_paid: boolean;
  created_at: string;
  employees?: {
    name: string;
    position: string;
    hourly_rate: number;
  };
};

function Nomina() {
  const { user, role } = useAuth();
  
  // Resolve role checks
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isEmployee = role === "employee";
  const canWrite = isAdmin || isManager;

  const [activeTab, setActiveTab] = useState<"employees" | "payroll" | "time_tracking">(
    isEmployee ? "time_tracking" : "employees"
  );
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);

  // Employee App State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [clockSubmitting, setClockSubmitting] = useState(false);

  // State for Add Employee
  const [empName, setEmpName] = useState("");
  const [empPosition, setEmpPosition] = useState("Mesero");
  const [empRate, setEmpRate] = useState("");
  const [empLinkedUser, setEmpLinkedUser] = useState("");

  // State for Add Payroll Log
  const [payEmployeeId, setPayEmployeeId] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payHours, setPayHours] = useState("");
  const [payRate, setPayRate] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // Editing States
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editEmpName, setEditEmpName] = useState("");
  const [editEmpPosition, setEditEmpPosition] = useState("");
  const [editEmpRate, setEditEmpRate] = useState("");
  const [editEmpLinkedUser, setEditEmpLinkedUser] = useState("");

  const [editingPayroll, setEditingPayroll] = useState<PayrollRecord | null>(null);
  const [editPayHours, setEditPayHours] = useState("");
  const [editPayRate, setEditPayRate] = useState("");
  const [editPayNotes, setEditPayNotes] = useState("");

  // Editing a time entry (Admin only)
  const [editingTimeEntry, setEditingTimeEntry] = useState<TimeEntry | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");

  // Helper: format ISO -> datetime-local string in local tz
  const toLocalInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Helper to get last Wednesday
  const getLastWednesday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = (day < 3 ? 7 : 0) + day - 3;
    d.setDate(d.getDate() - diff);
    return d;
  };

  // Helper to get next Wednesday
  const getNextWednesday = () => {
    const d = getLastWednesday();
    d.setDate(d.getDate() + 7);
    return d;
  };

  const lastWednesday = getLastWednesday();
  const nextWednesday = getNextWednesday();

  const loadData = async () => {
    if (!user) return;

    // Load employees
    const { data: empData } = await restaurantDb
      .from("employees")
      .select("*")
      .order("name");
    
    if (empData) {
      setEmployees(empData as Employee[]);

      // 1. First check: Is there a record already linked to the logged-in user?
      let linkedEmp = empData.find((e: any) => e.linked_user_id === user.id);
      
      // 2. Second check: If not linked, but the user is an employee, try to auto-link by matching the full name
      if (!linkedEmp && isEmployee) {
        const userFullName = user.user_metadata?.full_name || "";
        const emailName = user.email ? user.email.split("@")[0] : "";
        
        const normalize = (s: string) => 
          s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        
        const normUser = normalize(userFullName);
        const normEmail = normalize(emailName);
        
        linkedEmp = empData.find((e: any) => {
          const normEmp = normalize(e.name);
          // Match if exact match or if userFullName/email name matches/contains employee name
          if (normUser.length > 2 && (normEmp === normUser || normEmp.includes(normUser) || normUser.includes(normEmp))) {
            return true;
          }
          if (normEmail.length > 2 && (normEmp.includes(normEmail) || normEmail.includes(normEmp))) {
            return true;
          }
          return false;
        });

        if (linkedEmp) {
          // Permanently link this user.id to the employee profile in Supabase
          restaurantDb
            .from("employees")
            .update({ linked_user_id: user.id })
            .eq("id", linkedEmp.id)
            .then(({ error }: { error: any }) => {
              if (!error) {
                toast.success(`Vinculación automática: Tu usuario ha sido enlazado a ${linkedEmp?.name}`);
              }
            });
        }
      }

      // 3. Selection hierarchy
      if (linkedEmp) {
        setSelectedEmployeeId(linkedEmp.id);
        localStorage.setItem(`borrego_employee_id_${user.id}`, linkedEmp.id);
      } else if (!selectedEmployeeId && isEmployee) {
        // Fallback to user-isolated localStorage key
        const savedEmp = localStorage.getItem(`borrego_employee_id_${user.id}`);
        if (savedEmp && empData.find((e: any) => e.id === savedEmp)) {
          setSelectedEmployeeId(savedEmp);
        }
      }
    }

    if (canWrite) {
      // Load payroll records with employee joined details
      const { data: prData } = await restaurantDb
        .from("payroll_records")
        .select(`
          *,
          employees (
            name,
            position
          )
        `)
        .order("date", { ascending: false });
      if (prData) setPayrollRecords(prData as unknown as PayrollRecord[]);
    }

    // Load time entries based on role
    let timeQuery = restaurantDb
      .from("time_entries")
      .select(`
        *,
        employees (
          name,
          position,
          hourly_rate
        )
      `)
      .order("clock_in", { ascending: false });

    // If employee, only load their entries or if not linked yet, maybe we shouldn't show others
    // For safety, RLS policy allows authenticated users to see all time_entries, but we filter here
    if (isEmployee) {
       // We'll filter later or let them pick their name
    }

    const { data: teData } = await timeQuery;
    
    if (teData) {
      const entries = teData as unknown as TimeEntry[];
      setTimeEntries(entries);
      
      // Find active entry for selected employee
      if (selectedEmployeeId) {
        const active = entries.find(e => e.employee_id === selectedEmployeeId && !e.clock_out);
        setActiveEntry(active || null);
      }
    }
  };

  useEffect(() => {
    loadData();
    // Refresh active entry check every minute
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [user, selectedEmployeeId]);

  // Update payroll rate automatically when employee is selected
  useEffect(() => {
    if (payEmployeeId) {
      const selectedEmp = employees.find((e) => e.id === payEmployeeId);
      if (selectedEmp) {
        setPayRate(selectedEmp.hourly_rate.toString());
      }
    } else {
      setPayRate("");
    }
  }, [payEmployeeId, employees]);

  // Add Employee
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return toast.error("No tienes permisos para agregar empleados.");
    if (!empName || !empRate || !user) return;

    const { error } = await restaurantDb.from("employees").insert({
      user_id: user.id,
      name: empName,
      position: empPosition,
      hourly_rate: Number(empRate),
      linked_user_id: empLinkedUser || null
    });

    if (error) return toast.error(error.message);

    toast.success("Empleado registrado exitosamente");
    setEmpName("");
    setEmpPosition("Mesero");
    setEmpRate("");
    setEmpLinkedUser("");
    loadData();
  };

  // Edit Employee
  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee || !user) return;

    // Permissions check
    const isOwner = editingEmployee.user_id === user.id;
    if (!isAdmin && (!isManager || !isOwner)) {
      return toast.error("Solo puedes editar registros creados por ti mismo.");
    }

    const { error } = await restaurantDb
      .from("employees")
      .update({
        name: editEmpName,
        position: editEmpPosition,
        hourly_rate: Number(editEmpRate),
        linked_user_id: editEmpLinkedUser || null
      })
      .eq("id", editingEmployee.id);

    if (error) return toast.error(error.message);

    toast.success("Empleado actualizado");
    setEditingEmployee(null);
    loadData();
  };

  // Delete Employee
  const handleDeleteEmployee = async (emp: Employee) => {
    if (!canWrite) return toast.error("No tienes permisos para eliminar registros.");
    
    // Permissions check
    const isOwner = emp.user_id === user?.id;
    if (!isAdmin && (!isManager || !isOwner)) {
      return toast.error("Solo puedes eliminar empleados creados por ti mismo.");
    }

    const confirmDelete = window.confirm(
      `¿Estás seguro de eliminar a ${emp.name}? Esto eliminará todo su historial.`
    );
    if (!confirmDelete) return;

    // Delete linked expense entries first (via payroll cascade)
    const { data: logs } = await restaurantDb
      .from("payroll_records")
      .select("expense_entry_id")
      .eq("employee_id", emp.id);

    if (logs && logs.length > 0) {
      const expenseIds = logs
        .map((l: any) => l.expense_entry_id)
        .filter((id: any): id is string => !!id);
      if (expenseIds.length > 0) {
        await restaurantDb.from("expense_entries").delete().in("id", expenseIds);
      }
    }

    const { error } = await restaurantDb.from("employees").delete().eq("id", emp.id);
    if (error) return toast.error(error.message);

    toast.success("Empleado eliminado");
    if (selectedEmployeeId === emp.id) setSelectedEmployeeId("");
    loadData();
  };

  // Clock In / Clock Out
  const handleToggleClock = async () => {
    if (!user || !selectedEmployeeId) return toast.error("Selecciona tu nombre primero.");
    if (clockSubmitting) return;
    setClockSubmitting(true);
    try {

    if (activeEntry) {
      // Clock Out
      const clockOutTime = new Date().toISOString();
      const clockInTime = new Date(activeEntry.clock_in);
      
      // Calculate hours worked
      const diffMs = new Date(clockOutTime).getTime() - clockInTime.getTime();
      const hoursWorked = diffMs / (1000 * 60 * 60);

      const { error } = await restaurantDb
        .from("time_entries")
        .update({
          clock_out: clockOutTime,
          hours_worked: hoursWorked
        })
        .eq("id", activeEntry.id);

      if (error) return toast.error(error.message);
      toast.success("Salida registrada con éxito.");
    } else {
      // Clock In — prevent duplicate entry for the same employee on the same day
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await restaurantDb
        .from("time_entries")
        .select("id")
        .eq("employee_id", selectedEmployeeId)
        .eq("date", today)
        .limit(1);

      if (existing && existing.length > 0) {
        toast.error("Ya existe un registro de entrada para hoy. No se puede duplicar.");
        return;
      }

      const { error } = await restaurantDb
        .from("time_entries")
        .insert({
          employee_id: selectedEmployeeId,
          user_id: user.id,
          date: new Date().toISOString().split("T")[0]
        });

      if (error) return toast.error(error.message);
      toast.success("Entrada registrada con éxito.");
    }

    loadData();
    } finally {
      setClockSubmitting(false);
    }
  };

  const handleSelectEmployee = async (id: string) => {
    setSelectedEmployeeId(id);
    localStorage.setItem(`borrego_employee_id_${user?.id}`, id);
    
    // Automatically link in Supabase if not linked already!
    if (user) {
      const selectedEmp = employees.find(e => e.id === id);
      if (selectedEmp && !selectedEmp.linked_user_id) {
        const { error } = await restaurantDb
          .from("employees")
          .update({ linked_user_id: user.id })
          .eq("id", id);
        if (!error) {
          toast.success(`Tu cuenta de usuario ha sido vinculada a ${selectedEmp.name}`);
          loadData();
        }
      }
    }
  };

  // Liquidation process (Admin only)
  const handleLiquidate = async (empId: string, empName: string, unpaidTotal: number, unpaidHours: number, currentRate: number) => {
    if (!canWrite || !user) return;
    
    if (unpaidTotal <= 0) return toast.error("No hay saldo pendiente por liquidar.");

    const confirmLiquidate = window.confirm(
      `¿Liquidar pago de $${unpaidTotal.toFixed(2)} a ${empName}?\n\nEsto marcará las horas como pagadas y creará un registro de nómina y gasto automáticamente.`
    );
    if (!confirmLiquidate) return;

    // 1. Create corresponding expense entry
    const { data: expenseData, error: expenseError } = await restaurantDb
      .from("expense_entries")
      .insert({
        user_id: user.id,
        date: new Date().toISOString().split("T")[0],
        category: "personal",
        description: `Nómina (Ciclo Semanal): ${empName} - ${unpaidHours.toFixed(1)} hrs`,
        amount: unpaidTotal,
        paid_by: "caja_borrego"
      })
      .select()
      .single();

    if (expenseError) return toast.error(`Error al registrar gasto: ${expenseError.message}`);

    // 2. Insert the payroll record
    const { error: payrollError } = await restaurantDb.from("payroll_records").insert({
      user_id: user.id,
      employee_id: empId,
      date: new Date().toISOString().split("T")[0],
      hours_worked: unpaidHours,
      hourly_rate: currentRate,
      total_amount: unpaidTotal,
      status: "pagado",
      notes: "Liquidación ciclo semanal",
      expense_entry_id: expenseData.id,
    });

    if (payrollError) {
      await restaurantDb.from("expense_entries").delete().eq("id", expenseData.id);
      return toast.error(payrollError.message);
    }

    // 3. Mark time entries as paid
    const { error: updateError } = await restaurantDb
      .from("time_entries")
      .update({ is_paid: true })
      .eq("employee_id", empId)
      .eq("is_paid", false)
      .not("clock_out", "is", null);

    if (updateError) {
      return toast.error("Error al marcar horas como pagadas, contacte soporte.");
    }

    toast.success("Pago liquidado y registrado correctamente.");
    loadData();
  };

  // Add Payroll Log (Manual)
  const handleAddPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return toast.error("No tienes permisos para registrar horas.");
    if (!payEmployeeId || !payHours || !payRate || !user) return;

    const selectedEmp = employees.find((e) => e.id === payEmployeeId);
    if (!selectedEmp) return;

    const hours = Number(payHours);
    const rate = Number(payRate);
    const total = hours * rate;

    // 1. Create corresponding expense entry in expense_entries
    const { data: expenseData, error: expenseError } = await restaurantDb
      .from("expense_entries")
      .insert({
        user_id: user.id,
        date: payDate,
        category: "personal",
        description: `Nómina: ${selectedEmp.name} - ${hours} hrs @ $${rate}/hr${
          payNotes ? ` (${payNotes})` : ""
        }`,
        amount: total,
      })
      .select()
      .single();

    if (expenseError) return toast.error(`Error al registrar gasto: ${expenseError.message}`);

    // 2. Insert the payroll record referencing the new expense ID
    const { error: payrollError } = await restaurantDb.from("payroll_records").insert({
      user_id: user.id,
      employee_id: payEmployeeId,
      date: payDate,
      hours_worked: hours,
      hourly_rate: rate,
      total_amount: total,
      status: "pagado",
      notes: payNotes,
      expense_entry_id: expenseData.id,
    });

    if (payrollError) {
      await restaurantDb.from("expense_entries").delete().eq("id", expenseData.id);
      return toast.error(payrollError.message);
    }

    toast.success("Pago de horas registrado y cargado en Gastos automáticamente");
    setPayEmployeeId("");
    setPayHours("");
    setPayNotes("");
    loadData();
  };

  const handleDeletePayroll = async (record: PayrollRecord) => {
    if (!canWrite) return toast.error("No tienes permisos para eliminar pagos.");

    const isOwner = record.user_id === user?.id;
    if (!isAdmin && (!isManager || !isOwner)) {
      return toast.error("Solo puedes eliminar registros de pago creados por ti mismo.");
    }

    const confirmDelete = window.confirm("¿Estás seguro de eliminar este registro de pago? Esto también anulará el gasto financiero.");
    if (!confirmDelete) return;

    if (record.expense_entry_id) {
      await restaurantDb.from("expense_entries").delete().eq("id", record.expense_entry_id);
    }

    const { error } = await restaurantDb.from("payroll_records").delete().eq("id", record.id);
    if (error) return toast.error(error.message);

    toast.success("Registro de pago y gasto asociado eliminados");
    loadData();
  };

  const handleUpdatePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayroll || !user) return;

    const isOwner = editingPayroll.user_id === user.id;
    if (!isAdmin && (!isManager || !isOwner)) {
      return toast.error("Solo puedes editar registros creados por ti mismo.");
    }

    const hours = Number(editPayHours);
    const rate = Number(editPayRate);
    const total = hours * rate;

    const { error: prError } = await restaurantDb
      .from("payroll_records")
      .update({
        hours_worked: hours,
        hourly_rate: rate,
        total_amount: total,
        notes: editPayNotes,
      })
      .eq("id", editingPayroll.id);

    if (prError) return toast.error(prError.message);

    if (editingPayroll.expense_entry_id) {
      const empNameStr = editingPayroll.employees?.name || "Empleado";
      await restaurantDb
        .from("expense_entries")
        .update({
          amount: total,
          description: `Nómina: ${empNameStr} - ${hours} hrs @ $${rate}/hr${
            editPayNotes ? ` (${editPayNotes})` : ""
          }`,
        })
        .eq("id", editingPayroll.expense_entry_id);
    }

    toast.success("Registro de pago actualizado");
    setEditingPayroll(null);
    loadData();
  };

  // === Admin actions on time entries ===
  const handleCloseShift = async (entry: TimeEntry) => {
    if (!isAdmin) return toast.error("Solo el administrador puede cerrar turnos.");
    const confirm = window.confirm(`¿Cerrar turno de ${entry.employees?.name || "empleado"} ahora?`);
    if (!confirm) return;
    const clockOut = new Date().toISOString();
    const hours = (new Date(clockOut).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
    const { error } = await restaurantDb
      .from("time_entries")
      .update({ clock_out: clockOut, hours_worked: hours })
      .eq("id", entry.id);
    if (error) return toast.error(error.message);
    toast.success("Turno cerrado correctamente.");
    loadData();
  };

  const handleDeleteTimeEntry = async (entry: TimeEntry) => {
    if (!isAdmin) return toast.error("Solo el administrador puede eliminar registros de horas.");
    if (entry.is_paid) return toast.error("No se puede eliminar un registro ya pagado.");
    const confirm = window.confirm(`¿Eliminar registro de ${entry.employees?.name || "empleado"} del ${entry.date}?`);
    if (!confirm) return;
    const { error } = await restaurantDb.from("time_entries").delete().eq("id", entry.id);
    if (error) return toast.error(error.message);
    toast.success("Registro eliminado.");
    loadData();
  };

  const handleUpdateTimeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingTimeEntry) return;
    if (editingTimeEntry.is_paid) return toast.error("No se puede editar un registro ya pagado.");
    if (!editClockIn) return toast.error("La entrada es obligatoria.");

    const clockInIso = new Date(editClockIn).toISOString();
    let clockOutIso: string | null = null;
    let hours: number | null = null;
    if (editClockOut) {
      clockOutIso = new Date(editClockOut).toISOString();
      if (new Date(clockOutIso).getTime() <= new Date(clockInIso).getTime()) {
        return toast.error("La salida debe ser posterior a la entrada.");
      }
      hours = (new Date(clockOutIso).getTime() - new Date(clockInIso).getTime()) / (1000 * 60 * 60);
    }

    const newDate = clockInIso.split("T")[0];
    const { error } = await restaurantDb
      .from("time_entries")
      .update({
        clock_in: clockInIso,
        clock_out: clockOutIso,
        hours_worked: hours,
        date: newDate,
      })
      .eq("id", editingTimeEntry.id);
    if (error) return toast.error(error.message);
    toast.success("Registro de horas actualizado.");
    setEditingTimeEntry(null);
    loadData();
  };

  // Calculations
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthPaid = payrollRecords
    .filter((r) => {
      const recordDate = new Date(r.date);
      return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
    })
    .reduce((sum, r) => sum + r.total_amount, 0);

  const currentMonthHours = payrollRecords
    .filter((r) => {
      const recordDate = new Date(r.date);
      return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
    })
    .reduce((sum, r) => sum + r.hours_worked, 0);

  const selectedEmployeeData = employees.find(e => e.id === selectedEmployeeId);
  const myTimeEntries = timeEntries.filter(e => e.employee_id === selectedEmployeeId);
  
  // Accumulated un-paid for selected employee
  const myUnpaidEntries = myTimeEntries.filter(e => !e.is_paid && e.clock_out && e.hours_worked);
  const myAccumulatedHours = myUnpaidEntries.reduce((sum, e) => sum + (e.hours_worked || 0), 0);
  const myAccumulatedTotal = myAccumulatedHours * (selectedEmployeeData?.hourly_rate || 0);

  // Group employee statistics for Admin view
  const employeeStats = employees.map(emp => {
    const empEntries = timeEntries.filter(e => e.employee_id === emp.id && !e.is_paid && e.clock_out && e.hours_worked);
    const unpaidHours = empEntries.reduce((sum, e) => sum + (e.hours_worked || 0), 0);
    const unpaidTotal = unpaidHours * emp.hourly_rate;
    const isWorkingNow = timeEntries.some(e => e.employee_id === emp.id && !e.clock_out);
    return { ...emp, unpaidHours, unpaidTotal, isWorkingNow };
  });

  // Calculate elapsed time for active entry
  const [elapsedActiveHours, setElapsedActiveHours] = useState(0);
  useEffect(() => {
    if (!activeEntry) {
      setElapsedActiveHours(0);
      return;
    }
    const updateElapsed = () => {
      const diff = new Date().getTime() - new Date(activeEntry.clock_in).getTime();
      setElapsedActiveHours(diff / (1000 * 60 * 60));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 60000);
    return () => clearInterval(interval);
  }, [activeEntry]);


  // RENDER FOR PENDING ROLE
  if (role === "pending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 animate-fade-in text-center px-4">
        <div className="bg-amber-500/10 p-6 rounded-full">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold">Cuenta en Revisión</h2>
        <p className="text-muted-foreground max-w-md">
          Tu cuenta ha sido creada exitosamente, pero un administrador aún debe asignarte un rol (Gerente o Empleado) para que puedas acceder a las funciones del sistema.
        </p>
      </div>
    );
  }

  // RENDER FOR EMPLOYEE
  if (isEmployee) {
    return (
      <div className="space-y-6 pb-12 animate-fade-in max-w-2xl mx-auto">
        <div className="text-center py-6">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-primary bg-clip-text text-transparent">
            Control de Horas
          </h1>
          <p className="text-muted-foreground mt-2">Registra tu entrada y salida diaria.</p>
        </div>

        {!selectedEmployeeId ? (
          <Card className="border-border/60 shadow-lg p-6">
            <CardHeader className="text-center pb-6">
              <CardTitle>Identifícate</CardTitle>
              <CardDescription>Selecciona tu nombre de la lista para continuar.</CardDescription>
            </CardHeader>
            <CardContent>
              <select
                className="flex h-12 w-full rounded-xl border border-border/80 bg-background px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                onChange={(e) => handleSelectEmployee(e.target.value)}
                value={selectedEmployeeId}
              >
                <option value="">-- Seleccionar mi nombre --</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} - {e.position}</option>
                ))}
              </select>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-border/80 shadow-xl overflow-hidden relative">
              <div className={`absolute top-0 left-0 w-full h-1 ${activeEntry ? 'bg-emerald-500 animate-pulse' : 'bg-muted'}`} />
              <CardContent className="p-8">
                <div className="flex flex-col items-center justify-center space-y-6">
                  
                  <div className="text-center">
                    <h2 className="text-2xl font-bold">{selectedEmployeeData?.name}</h2>
                    <Badge variant="outline" className="mt-2 text-sm">{selectedEmployeeData?.position}</Badge>
                  </div>

                  {activeEntry ? (
                    <div className="flex flex-col items-center space-y-2 py-4">
                      <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        Turno Activo
                      </div>
                      <div className="text-4xl font-mono font-black tabular-nums tracking-tighter">
                        {elapsedActiveHours.toFixed(2)} <span className="text-2xl text-muted-foreground">hrs</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Entrada: {new Date(activeEntry.clock_in).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-muted-foreground font-medium">
                      Actualmente fuera de turno.
                    </div>
                  )}

                  <Button 
                    onClick={handleToggleClock}
                    disabled={clockSubmitting}
                    className={`w-full h-16 text-lg font-bold rounded-2xl shadow-lg transition-all duration-300 ${
                      activeEntry 
                        ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" 
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                  >
                    {activeEntry ? (
                      <><Square className="mr-3 h-5 w-5" fill="currentColor" /> Finalizar Turno</>
                    ) : (
                      <><Play className="mr-3 h-5 w-5" fill="currentColor" /> Iniciar Turno</>
                    )}
                  </Button>

                  <div className="w-full flex justify-end">
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="text-xs text-muted-foreground" 
                      onClick={() => {
                        setSelectedEmployeeId("");
                        localStorage.removeItem(`borrego_employee_id_${user?.id}`);
                      }}
                    >
                      ¿No eres {selectedEmployeeData?.name}?
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card className="border-border/60 shadow-sm bg-card/50">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1 h-full">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Horas Acumuladas</span>
                  <span className="text-2xl font-black">{myAccumulatedHours.toFixed(2)}</span>
                  <span className="text-[10px] text-muted-foreground">Este ciclo de pago</span>
                </CardContent>
              </Card>
              <Card className="border-border/60 shadow-sm bg-card/50">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-1 h-full">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Ganancia Estimada</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">${myAccumulatedTotal.toFixed(2)}</span>
                  <span className="text-[10px] text-muted-foreground">A pagar el miércoles</span>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <History className="h-4 w-4" /> Historial Reciente
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-xs">Día</TableHead>
                        <TableHead className="text-xs">Entrada - Salida</TableHead>
                        <TableHead className="text-xs text-center">Horas</TableHead>
                        <TableHead className="text-xs text-right">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myTimeEntries.slice(0, 10).map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-xs font-medium whitespace-nowrap">
                            {new Date(entry.date).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(entry.clock_in).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})} 
                            {' - '} 
                            {entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'}) : '...'}
                          </TableCell>
                          <TableCell className="text-xs font-mono font-bold text-center">
                            {entry.hours_worked ? entry.hours_worked.toFixed(2) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.is_paid ? (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-none">Pagado</Badge>
                            ) : entry.clock_out ? (
                              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-none">Pendiente</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-none animate-pulse">Activo</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {myTimeEntries.length === 0 && (
                         <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground italic">No hay registros recientes.</TableCell>
                         </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  }

  // RENDER FOR ADMIN / MANAGER
  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-primary bg-clip-text text-transparent">
            Nómina y Personal
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Administra a tus empleados, registra horas trabajadas y liquida pagos.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/50 backdrop-blur-md border border-border/80 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Empleados Activos
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Catálogo de personal registrado
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-md border border-border/80 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Nómina del Mes
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ${currentMonthPaid.toFixed(2)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Total pagado este mes corriente
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-md border border-border/80 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Horas Trabajadas (Mes)
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMonthHours.toFixed(1)} hrs</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Horas pagadas este mes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Selector */}
      <div className="flex flex-wrap gap-2 p-1 bg-muted/60 rounded-xl w-full max-w-xl border border-border/40 overflow-x-auto">
        <button
          onClick={() => setActiveTab("time_tracking")}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold rounded-lg transition-all ${
            activeTab === "time_tracking"
              ? "bg-card shadow-sm text-foreground border border-border/40"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-4 w-4 text-blue-500" />
          Control de Horas
        </button>
        <button
          onClick={() => setActiveTab("employees")}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold rounded-lg transition-all ${
            activeTab === "employees"
              ? "bg-card shadow-sm text-foreground border border-border/40"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" />
          Empleados
        </button>
        <button
          onClick={() => setActiveTab("payroll")}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold rounded-lg transition-all ${
            activeTab === "payroll"
              ? "bg-card shadow-sm text-foreground border border-border/40"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <DollarSign className="h-4 w-4" />
          Historial Pagos
        </button>
      </div>

      {/* TAB CONTENT: TIME TRACKING (NEW) */}
      {activeTab === "time_tracking" && (
        <div className="space-y-6">
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Ciclo de Pago Semanal</h3>
                <p className="text-xs text-muted-foreground">
                  Corte: Miércoles a Miércoles
                </p>
              </div>
            </div>
            <div className="flex gap-4 text-sm font-medium bg-background px-4 py-2 rounded-xl border border-border/50 shadow-sm">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase">Inicio</span>
                <span>{lastWednesday.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
              </div>
              <div className="w-px bg-border/60 mx-1"></div>
              <div className="flex flex-col">
                <span className="text-[10px] text-primary uppercase font-bold">Próx. Pago</span>
                <span className="text-primary font-bold">{nextWednesday.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {employeeStats.map(emp => (
              <Card key={emp.id} className={`border-border/60 shadow-md relative overflow-hidden transition-all hover:shadow-lg ${emp.isWorkingNow ? 'ring-2 ring-emerald-500/50' : ''}`}>
                {emp.isWorkingNow && (
                   <div className="absolute top-3 right-3 flex h-3 w-3">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                   </div>
                )}
                <CardHeader className="pb-2 pt-5">
                  <CardTitle className="text-lg font-extrabold">{emp.name}</CardTitle>
                  <CardDescription className="flex items-center justify-between">
                    <span>{emp.position}</span>
                    <span className="font-mono font-medium">${emp.hourly_rate}/hr</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted/40 rounded-xl p-3 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Horas por Pagar</span>
                      <span className="font-black text-xl font-mono">{emp.unpaidHours.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Total a Pagar</span>
                      <span className="font-black text-xl text-emerald-600 dark:text-emerald-400 font-mono">${emp.unpaidTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold"
                    disabled={emp.unpaidTotal <= 0}
                    onClick={() => handleLiquidate(emp.id, emp.name, emp.unpaidTotal, emp.unpaidHours, emp.hourly_rate)}
                  >
                    Liquidar Pago
                  </Button>
                </CardContent>
              </Card>
            ))}
            
            {employeeStats.length === 0 && (
              <div className="col-span-full p-8 text-center border-2 border-dashed border-border/60 rounded-2xl text-muted-foreground">
                No hay empleados registrados. Añade personal desde la pestaña "Empleados".
              </div>
            )}
          </div>

          <Card className="border-border/60 shadow-sm mt-8">
            <CardHeader>
              <CardTitle className="text-base">Últimas Entradas y Salidas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead className="text-xs">Día</TableHead>
                       <TableHead className="text-xs">Empleado</TableHead>
                       <TableHead className="text-xs">Horario</TableHead>
                       <TableHead className="text-xs text-center">Horas</TableHead>
                       <TableHead className="text-xs text-right">Estado Pago</TableHead>
                       {isAdmin && <TableHead className="text-xs text-right">Acciones</TableHead>}
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                      {timeEntries.slice(0, 20).map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-xs font-medium whitespace-nowrap">
                            {new Date(entry.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                          </TableCell>
                          <TableCell className="text-xs font-bold whitespace-nowrap">
                            {entry.employees?.name}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                            {new Date(entry.clock_in).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})} 
                            {' - '} 
                            {entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'}) : '...'}
                          </TableCell>
                          <TableCell className="text-xs font-mono font-bold text-center">
                            {entry.hours_worked ? entry.hours_worked.toFixed(2) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.is_paid ? (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-none">Pagado</Badge>
                            ) : entry.clock_out ? (
                              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-none">Pendiente</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-none animate-pulse">Activo</Badge>
                            )}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {!entry.clock_out && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                    onClick={() => handleCloseShift(entry)}
                                  >
                                    <Square className="h-3 w-3 mr-1" fill="currentColor" /> Cerrar
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  disabled={entry.is_paid}
                                  onClick={() => {
                                    setEditingTimeEntry(entry);
                                    setEditClockIn(toLocalInput(entry.clock_in));
                                    setEditClockOut(toLocalInput(entry.clock_out));
                                  }}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  disabled={entry.is_paid}
                                  onClick={() => handleDeleteTimeEntry(entry)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                   </TableBody>
                 </Table>
               </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB CONTENT: EMPLOYEES */}
      {activeTab === "employees" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="bg-card/50 backdrop-blur-md border border-border/80 shadow-lg h-fit">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Registrar Empleado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddEmployee} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="empName">Nombre y Apellido</Label>
                  <Input
                    id="empName"
                    required
                    placeholder="Ej. Juan Pérez"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="empPosition">Cargo / Posición</Label>
                  <select
                    id="empPosition"
                    value={empPosition}
                    onChange={(e) => setEmpPosition(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Mesero">Mesero / Mesera</option>
                    <option value="Cocinero">Cocinero / Chef</option>
                    <option value="Cajero">Cajero / Cajera</option>
                    <option value="Repartidor">Repartidor</option>
                    <option value="Gerente">Gerente</option>
                    <option value="Limpieza">Personal de Limpieza</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="empRate">Pago por Hora ($)</Label>
                  <Input
                    id="empRate"
                    required
                    type="number"
                    step="0.01"
                    placeholder="Ej. 12.50"
                    value={empRate}
                    onChange={(e) => setEmpRate(e.target.value)}
                  />
                </div>
                
                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <Label htmlFor="empLinkedUser" className="text-xs text-muted-foreground">
                    ID de Usuario (Opcional - Para vincular cuenta de login)
                  </Label>
                  <Input
                    id="empLinkedUser"
                    placeholder="Ej. d0d8f..."
                    value={empLinkedUser}
                    onChange={(e) => setEmpLinkedUser(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-md">
                  Registrar Empleado
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-md border border-border/80 shadow-lg lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Listado de Empleados</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {employees.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No hay empleados registrados todavía. Registra tu primer personal a la izquierda.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Pago por Hora</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((emp) => {
                        const isOwner = emp.user_id === user?.id;
                        const canEdit = isAdmin || (isManager && isOwner);

                        return (
                          <TableRow key={emp.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="font-bold">
                              {emp.name}
                              {emp.linked_user_id && <Badge variant="secondary" className="ml-2 text-[8px] h-4">Vinculado</Badge>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="rounded-lg px-2.5 py-0.5">
                                {emp.position}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                              ${emp.hourly_rate.toFixed(2)}/hr
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                  onClick={() => {
                                    if (!canEdit) {
                                      return toast.error("No tienes permisos para editar este registro.");
                                    }
                                    setEditingEmployee(emp);
                                    setEditEmpName(emp.name);
                                    setEditEmpPosition(emp.position);
                                    setEditEmpRate(emp.hourly_rate.toString());
                                    setEditEmpLinkedUser(emp.linked_user_id || "");
                                  }}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                                  onClick={() => handleDeleteEmployee(emp)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB CONTENT: PAYROLL (HISTORICAL MANUALLY ADDED) */}
      {activeTab === "payroll" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="bg-card/50 backdrop-blur-md border border-border/80 shadow-lg h-fit">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Registrar Pago Manual
              </CardTitle>
              <CardDescription className="text-xs">Solo para ajustes o pagos fuera de ciclo.</CardDescription>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-amber-500/10 rounded-2xl text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  Debes registrar al menos un empleado.
                </div>
              ) : (
                <form onSubmit={handleAddPayroll} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="payEmployee">Seleccionar Empleado</Label>
                    <select
                      id="payEmployee"
                      required
                      value={payEmployeeId}
                      onChange={(e) => setPayEmployeeId(e.target.value)}
                      className="flex h-10 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">-- Seleccionar --</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} ({e.position})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="payDate">Fecha del Pago</Label>
                    <Input
                      id="payDate"
                      type="date"
                      required
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="payHours">Horas Trab.</Label>
                      <Input
                        id="payHours"
                        required
                        type="number"
                        step="0.1"
                        placeholder="Ej. 40"
                        value={payHours}
                        onChange={(e) => setPayHours(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="payRate">Tarifa ($)</Label>
                      <Input
                        id="payRate"
                        required
                        type="number"
                        step="0.01"
                        placeholder="12.00"
                        value={payRate}
                        onChange={(e) => setPayRate(e.target.value)}
                      />
                    </div>
                  </div>

                  {payHours && payRate && (
                    <div className="p-3 bg-muted/60 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-bold">Total a pagar:</span>
                      <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                        ${(Number(payHours) * Number(payRate)).toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="payNotes">Notas / Periodo</Label>
                    <Input
                      id="payNotes"
                      placeholder="Ej. Adelanto o Ajuste"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                    />
                  </div>

                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-600/95 text-white font-bold rounded-xl shadow-md">
                    Registrar Pago Manual
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-md border border-border/80 shadow-lg lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Historial de Pagos y Liquidaciones</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {payrollRecords.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No hay registros de pago cargados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Empleado</TableHead>
                        <TableHead>Detalles</TableHead>
                        <TableHead>Total Pago</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollRecords.map((record) => {
                        const isOwner = record.user_id === user?.id;
                        const canEdit = isAdmin || (isManager && isOwner);

                        return (
                          <TableRow key={record.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="font-semibold whitespace-nowrap">
                              {new Date(record.date).toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-foreground">{record.employees?.name || "Empleado"}</span>
                                <span className="text-[10px] text-muted-foreground">{record.employees?.position}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col text-xs">
                                <span className="text-muted-foreground">
                                  {record.hours_worked} hrs @ ${record.hourly_rate.toFixed(2)}/hr
                                </span>
                                {record.notes && (
                                  <span className="text-[10px] text-primary italic max-w-[150px] truncate">
                                    {record.notes}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-bold text-emerald-600 dark:text-emerald-400">
                              ${record.total_amount.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-none rounded-lg flex items-center gap-1 w-fit">
                                <CheckCircle2 className="h-3 w-3" />
                                Pagado
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                  onClick={() => {
                                    if (!canEdit) {
                                      return toast.error("No tienes permisos para editar este registro.");
                                    }
                                    setEditingPayroll(record);
                                    setEditPayHours(record.hours_worked.toString());
                                    setEditPayRate(record.hourly_rate.toString());
                                    setEditPayNotes(record.notes || "");
                                  }}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                                  onClick={() => handleDeletePayroll(record)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* EDIT EMPLOYEE DIALOG */}
      <Dialog open={!!editingEmployee} onOpenChange={(open) => !open && setEditingEmployee(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md rounded-2xl bg-card border border-border/80 p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40 shrink-0">
            <DialogTitle>Editar Empleado</DialogTitle>
            <DialogDescription>Modifica los datos del personal seleccionado.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateEmployee} className="space-y-4 px-6 py-4 min-w-0 overflow-y-auto flex-1">
            <div className="space-y-1.5">
              <Label htmlFor="editEmpName">Nombre y Apellido</Label>
              <Input
                id="editEmpName"
                required
                value={editEmpName}
                className="w-full rounded-xl"
                onChange={(e) => setEditEmpName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editEmpPosition">Cargo / Posición</Label>
              <select
                id="editEmpPosition"
                value={editEmpPosition}
                onChange={(e) => setEditEmpPosition(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Mesero">Mesero / Mesera</option>
                <option value="Cocinero">Cocinero / Chef</option>
                <option value="Cajero">Cajero / Cajera</option>
                <option value="Repartidor">Repartidor</option>
                <option value="Gerente">Gerente</option>
                <option value="Limpieza">Personal de Limpieza</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editEmpRate">Pago por Hora ($)</Label>
              <Input
                id="editEmpRate"
                required
                type="number"
                step="0.01"
                value={editEmpRate}
                className="w-full rounded-xl"
                onChange={(e) => setEditEmpRate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <Label htmlFor="editEmpLinkedUser" className="text-xs text-muted-foreground">
                ID de Usuario Vinculado (Opcional)
              </Label>
              <Input
                id="editEmpLinkedUser"
                value={editEmpLinkedUser}
                className="w-full rounded-xl"
                onChange={(e) => setEditEmpLinkedUser(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0 pt-4 w-full shrink-0">
              <Button type="button" variant="outline" className="rounded-xl flex-1 sm:flex-initial" onClick={() => setEditingEmployee(null)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-md flex-1 sm:flex-initial">
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT PAYROLL DIALOG */}
      <Dialog open={!!editingPayroll} onOpenChange={(open) => !open && setEditingPayroll(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md rounded-2xl bg-card border border-border/80 p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40 shrink-0">
            <DialogTitle>Editar Registro de Pago</DialogTitle>
            <DialogDescription>Modifica los detalles de horas o tarifa.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdatePayroll} className="space-y-4 px-6 py-4 min-w-0 overflow-y-auto flex-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="editPayHours">Horas Trab.</Label>
                <Input
                  id="editPayHours"
                  required
                  type="number"
                  step="0.1"
                  value={editPayHours}
                  className="w-full rounded-xl"
                  onChange={(e) => setEditPayHours(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editPayRate">Tarifa ($)</Label>
                <Input
                  id="editPayRate"
                  required
                  type="number"
                  step="0.01"
                  value={editPayRate}
                  className="w-full rounded-xl"
                  onChange={(e) => setEditPayRate(e.target.value)}
                />
              </div>
            </div>
            {editPayHours && editPayRate && (
              <div className="p-3 bg-muted/60 rounded-xl flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-bold">Nuevo total:</span>
                <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                  ${(Number(editPayHours) * Number(editPayRate)).toFixed(2)}
                </span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="editPayNotes">Notas / Periodo</Label>
              <Input
                id="editPayNotes"
                value={editPayNotes}
                className="w-full rounded-xl"
                onChange={(e) => setEditPayNotes(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0 pt-4 w-full shrink-0">
              <Button type="button" variant="outline" className="rounded-xl flex-1 sm:flex-initial" onClick={() => setEditingPayroll(null)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-600/95 text-white font-bold rounded-xl shadow-md flex-1 sm:flex-initial">
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
