import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Copy, Filter, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import FormEngine from "@/components/time-entry/FormEngine";
import { getEntryTypeOptions } from "@/lib/entryTypeRegistry";
import { resolveEntryTypeCode } from "@/lib/resolveEntryTypeCode";
import { getEntryTypeLabel } from "@/lib/getEntryTypeLabel";

function formatDurationMinutes(minutes) {
  const total = Number(minutes || 0);
  if (!total) return "0 min";
  if (total < 60) return `${total} min`;

  const hours = Math.floor(total / 60);
  const remainder = total % 60;

  if (remainder === 0) {
    return `${hours} hr${hours === 1 ? "" : "s"}`;
  }

  return `${hours} hr ${remainder} min`;
}

function parseDateOnly(dateString) {
  if (!dateString || typeof dateString !== "string") return null;

  const parts = dateString.split("-");
  if (parts.length !== 3) return null;

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!year || !month || !day) return null;

  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function addOneDayDateOnly(dateString) {
  const parsed = parseDateOnly(dateString);
  if (!parsed) return dateString || "";

  const next = new Date(parsed);
  next.setDate(next.getDate() + 1);
  return format(next, "yyyy-MM-dd");
}

function hasActiveFilters(filters) {
  return Object.values(filters).some((value) => value && value !== "all");
}

function activeFilterCount(filters) {
  return Object.values(filters).filter(
    (value) => value && value !== "all"
  ).length;
}

export default function TimeLogDashboard({
  timeEntries = [],
  clientId,
  clients = [],
  onRefresh,
  onEditEntry,
}) {
  const [filters, setFilters] = useState({
    clientId: clientId || "",
    employeeId: "",
    entryTypeCode: "",
    dateFrom: "",
    dateTo: "",
    reportable: "all",
    billable: "all",
    payrollEligible: "all",
  });

  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [selectedEntryTypeCode, setSelectedEntryTypeCode] = useState("");
  const [employees, setEmployees] = useState([]);
  const [resolvedEntryTypeCodes, setResolvedEntryTypeCodes] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  const entryTypes = useMemo(() => getEntryTypeOptions(), []);

  useEffect(() => {
    let active = true;

    base44.entities.User.filter({ role: "employee" })
      .then((emps) => {
        if (!active) return;
        setEmployees(Array.isArray(emps) ? emps : []);
      })
      .catch(() => {
        if (!active) return;
        setEmployees([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setFilters((prev) => {
      const nextClientId = clientId || "";
      if (prev.clientId === nextClientId) return prev;
      return { ...prev, clientId: nextClientId };
    });
  }, [clientId]);

  useEffect(() => {
    let active = true;

    async function resolveAllEntryTypeCodes() {
      if (!timeEntries?.length) {
        setResolvedEntryTypeCodes({});
        return;
      }

      const immediatePairs = [];
      const needsAsync = [];

      for (const entry of timeEntries) {
        const directCode =
          entry?.entry_type_code ||
          entry?.entry_type ||
          entry?.entry_type_key ||
          entry?.type ||
          entry?.category ||
          "";

        if (directCode) {
          immediatePairs.push([entry.id, directCode]);
        } else {
          needsAsync.push(entry);
        }
      }

      const baseMap = Object.fromEntries(immediatePairs);

      if (!needsAsync.length) {
        if (active) {
          setResolvedEntryTypeCodes(baseMap);
        }
        return;
      }

      const asyncPairs = await Promise.all(
        needsAsync.map(async (entry) => {
          try {
            const resolvedCode = await resolveEntryTypeCode(entry);
            return [entry.id, resolvedCode || ""];
          } catch (error) {
            console.error(
              "[TimeLogDashboard] Failed to resolve entry type code for row:",
              error
            );
            return [entry.id, ""];
          }
        })
      );

      if (!active) return;

      setResolvedEntryTypeCodes({
        ...baseMap,
        ...Object.fromEntries(asyncPairs),
      });
    }

    resolveAllEntryTypeCodes();

    return () => {
      active = false;
    };
  }, [timeEntries]);

  const employeeById = useMemo(() => {
    const map = {};
    for (const employee of employees) {
      map[employee.id] = employee;
    }
    return map;
  }, [employees]);

  const filtered = useMemo(() => {
    let result = [...timeEntries];

    if (filters.clientId) {
      result = result.filter((e) => e.client_id === filters.clientId);
    }

    if (filters.employeeId) {
      result = result.filter((e) => e.employee_id === filters.employeeId);
    }

    if (filters.entryTypeCode) {
      result = result.filter((e) => {
        const code =
          resolvedEntryTypeCodes[e.id] ||
          e.entry_type_code ||
          e.entry_type ||
          e.entry_type_key ||
          e.type ||
          e.category ||
          "";

        return (
          String(code).toLowerCase() ===
          String(filters.entryTypeCode).toLowerCase()
        );
      });
    }

    if (filters.dateFrom) {
      result = result.filter((e) => e.date && e.date >= filters.dateFrom);
    }

    if (filters.dateTo) {
      result = result.filter((e) => e.date && e.date <= filters.dateTo);
    }

    if (filters.reportable !== "all") {
      const val = filters.reportable === "true";
      result = result.filter((e) => Boolean(e.is_reportable) === val);
    }

    if (filters.billable !== "all") {
      const val = filters.billable === "true";
      result = result.filter((e) => Boolean(e.is_billable) === val);
    }

    if (filters.payrollEligible !== "all") {
      const val = filters.payrollEligible === "true";
      result = result.filter((e) => Boolean(e.is_payroll_eligible) === val);
    }

    return result.sort((a, b) => {
      const aDate = parseDateOnly(a.date);
      const bDate = parseDateOnly(b.date);

      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;

      return bDate.getTime() - aDate.getTime();
    });
  }, [timeEntries, filters, resolvedEntryTypeCodes]);

  const totalMinutes = useMemo(() => {
    return filtered.reduce(
      (sum, entry) => sum + Number(entry.duration_minutes || 0),
      0
    );
  }, [filtered]);

  const totalHours = useMemo(() => {
    return (totalMinutes / 60).toFixed(1);
  }, [totalMinutes]);

  const handleEditEntry = useCallback(
    async (entry) => {
      if (typeof onEditEntry === "
