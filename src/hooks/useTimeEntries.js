import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listTimeEntries, createTimeEntry, deleteTimeEntry } from '../api/timeEntries';

export function useTimeEntries() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['timeEntries'], queryFn: () => listTimeEntries() });

  const add = useMutation({
    mutationFn: (payload) => createTimeEntry(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeEntries'] })
  });

  const del = useMutation({
    mutationFn: (id) => deleteTimeEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeEntries'] })
  });

  return {
    entries: data || [],
    isLoading,
    error,
    addEntry: (p) => add.mutate(p),
    removeEntry: (id) => del.mutate(id)
  };
}
