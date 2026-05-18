import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Lock
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

function Nomina() {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState<"employees" | "payroll">("employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);

  // State for Add Employee
  const [empName, setEmpName] = useState("");
  const [empPosition, setEmpPosition] = useState("Mesero");
  const [empRate, setEmpRate] = useState("");

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

  const [editingPayroll, setEditingPayroll] = useState<PayrollRecord | null>(null);
  const [editPayHours, setEditPayHours] = useState("");
  const [editPayRate, setEditPayRate] = useState("");
  const [editPayNotes, setEditPayNotes] = useState("");

  // Resolve role checks
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isEmployee = role === "employee";
  const canWrite = isAdmin || isManager;

  const loadData = async () => {
    // Load employees
    const { data: empData } = await supabase
      .from("employees")
      .select("*")
      .order("name");
    if (empData) setEmployees(empData as Employee[]);

    // Load payroll records with employee joined details
    const { data: prData } = await supabase
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
  };

  useEffect(() => {
    loadData();
  }, []);

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

    const { error } = await supabase.from("employees").insert({
      user_id: user.id,
      name: empName,
      position: empPosition,
      hourly_rate: Number(empRate),
    });

    if (error) return toast.error(error.message);

    toast.success("Empleado registrado exitosamente");
    setEmpName("");
    setEmpPosition("Mesero");
    setEmpRate("");
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

    const { error } = await supabase
      .from("employees")
      .update({
        name: editEmpName,
        position: editEmpPosition,
        hourly_rate: Number(editEmpRate),
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
      `¿Estás seguro de eliminar a ${emp.name}? Esto eliminará todo su historial de nóminas.`
    );
    if (!confirmDelete) return;

    // Delete linked expense entries first (via payroll cascade)
    const { data: logs } = await supabase
      .from("payroll_records")
      .select("expense_entry_id")
      .eq("employee_id", emp.id);

    if (logs && logs.length > 0) {
      const expenseIds = logs
        .map((l) => l.expense_entry_id)
        .filter((id): id is string => !!id);
      if (expenseIds.length > 0) {
        await supabase.from("expense_entries").delete().in("id", expenseIds);
      }
    }

    const { error } = await supabase.from("employees").delete().eq("id", emp.id);
    if (error) return toast.error(error.message);

    toast.success("Empleado eliminado");
    loadData();
  };

  // Add Payroll Log (Registers Hours & creates Gasto Automatically!)
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
    const { data: expenseData, error: expenseError } = await supabase
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
    const { error: payrollError } = await supabase.from("payroll_records").insert({
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
      // Rollback the expense if payroll fails
      await supabase.from("expense_entries").delete().eq("id", expenseData.id);
      return toast.error(payrollError.message);
    }

    toast.success("Pago de horas registrado y cargado en Gastos automáticamente");
    setPayEmployeeId("");
    setPayHours("");
    setPayNotes("");
    loadData();
  };

  // Delete Payroll Log (Deletes linked Gasto Automatically!)
  const handleDeletePayroll = async (record: PayrollRecord) => {
    if (!canWrite) return toast.error("No tienes permisos para eliminar pagos.");

    // Permissions check
    const isOwner = record.user_id === user?.id;
    if (!isAdmin && (!isManager || !isOwner)) {
      return toast.error("Solo puedes eliminar registros de pago creados por ti mismo.");
    }

    const confirmDelete = window.confirm("¿Estás seguro de eliminar este registro de pago? Esto también anulará el gasto financiero.");
    if (!confirmDelete) return;

    // 1. Delete associated expense entry
    if (record.expense_entry_id) {
      const { error: expError } = await supabase
        .from("expense_entries")
        .delete()
        .eq("id", record.expense_entry_id);
      if (expError) console.warn("Error al anular gasto asociado:", expError.message);
    }

    // 2. Delete payroll record
    const { error } = await supabase.from("payroll_records").delete().eq("id", record.id);
    if (error) return toast.error(error.message);

    toast.success("Registro de pago y gasto asociado eliminados");
    loadData();
  };

  // Edit Payroll
  const handleUpdatePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayroll || !user) return;

    // Permissions check
    const isOwner = editingPayroll.user_id === user.id;
    if (!isAdmin && (!isManager || !isOwner)) {
      return toast.error("Solo puedes editar registros creados por ti mismo.");
    }

    const hours = Number(editPayHours);
    const rate = Number(editPayRate);
    const total = hours * rate;

    // Update payroll record
    const { error: prError } = await supabase
      .from("payroll_records")
      .update({
        hours_worked: hours,
        hourly_rate: rate,
        total_amount: total,
        notes: editPayNotes,
      })
      .eq("id", editingPayroll.id);

    if (prError) return toast.error(prError.message);

    // Update linked expense entry
    if (editingPayroll.expense_entry_id) {
      const empNameStr = editingPayroll.employees?.name || "Empleado";
      await supabase
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

  // Financial Summaries for current month
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

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-primary bg-clip-text text-transparent">
            Nómina y Personal
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Administra a tus empleados, registra horas trabajadas y mantén al día tus gastos financieros.
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
              Horas totales registradas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Selector */}
      <div className="flex gap-2 p-1 bg-muted/60 rounded-xl max-w-sm border border-border/40">
        <button
          onClick={() => setActiveTab("employees")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
            activeTab === "employees"
              ? "bg-card shadow-sm text-foreground border border-border/40"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Empleados
        </button>
        <button
          onClick={() => setActiveTab("payroll")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
            activeTab === "payroll"
              ? "bg-card shadow-sm text-foreground border border-border/40"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          Nómina y Pagos
        </button>
      </div>

      {/* TAB CONTENT: EMPLOYEES */}
      {activeTab === "employees" && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Add Employee Form */}
          <Card className="bg-card/50 backdrop-blur-md border border-border/80 shadow-lg h-fit">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Registrar Empleado
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEmployee ? (
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-2xl text-xs text-muted-foreground">
                  <Lock className="h-5 w-5 text-primary" />
                  Solo los administradores y gerentes pueden registrar empleados.
                </div>
              ) : (
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

                  <Button type="submit" className="w-full bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-md">
                    Registrar Empleado
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Employees List */}
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
                            <TableCell className="font-bold">{emp.name}</TableCell>
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

      {/* TAB CONTENT: PAYROLL */}
      {activeTab === "payroll" && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Add Payroll Log Form */}
          <Card className="bg-card/50 backdrop-blur-md border border-border/80 shadow-lg h-fit">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Registrar Pago de Horas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEmployee ? (
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-2xl text-xs text-muted-foreground">
                  <Lock className="h-5 w-5 text-primary" />
                  Solo los administradores y gerentes pueden registrar pagos.
                </div>
              ) : employees.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-amber-500/10 rounded-2xl text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  Debes registrar al menos un empleado antes de registrar pagos de nómina.
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
                      placeholder="Ej. Semana del 11 al 17 de Mayo"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                    />
                  </div>

                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-600/95 text-white font-bold rounded-xl shadow-md">
                    Registrar Pago y Cargar Gasto
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Payroll List */}
          <Card className="bg-card/50 backdrop-blur-md border border-border/80 shadow-lg lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Historial de Pagos y Nóminas</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {payrollRecords.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No hay registros de pago cargados. Registra las primeras horas trabajadas a la izquierda.
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
        <DialogContent className="max-w-md rounded-2xl bg-card border border-border/80">
          <DialogHeader>
            <DialogTitle>Editar Empleado</DialogTitle>
            <DialogDescription>Modifica los datos del personal seleccionado.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateEmployee} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="editEmpName">Nombre y Apellido</Label>
              <Input
                id="editEmpName"
                required
                value={editEmpName}
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
                onChange={(e) => setEditEmpRate(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditingEmployee(null)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-md">
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT PAYROLL DIALOG */}
      <Dialog open={!!editingPayroll} onOpenChange={(open) => !open && setEditingPayroll(null)}>
        <DialogContent className="max-w-md rounded-2xl bg-card border border-border/80">
          <DialogHeader>
            <DialogTitle>Editar Registro de Pago</DialogTitle>
            <DialogDescription>Modifica los detalles de horas o tarifa.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdatePayroll} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="editPayHours">Horas Trab.</Label>
                <Input
                  id="editPayHours"
                  required
                  type="number"
                  step="0.1"
                  value={editPayHours}
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
                onChange={(e) => setEditPayNotes(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditingPayroll(null)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-600/95 text-white font-bold rounded-xl shadow-md">
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
