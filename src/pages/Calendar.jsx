import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Plus, Clock, MapPin, Video, CheckCircle2, X, Timer, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, addDays, addWeeks, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [showNew, setShowNew] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [showConvert, setShowConvert] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [convertNotes, setConvertNotes] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState(null);
  const [linkedTimeEntry, setLinkedTimeEntry] = useState(null);
  const [showSeriesEdit, setShowSeriesEdit] = useState(false);
  const [editSeriesMode, setEditSeriesMode] = useState("current"); // "current" or "series"
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribe = base44.entities.Meeting.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    });
    return unsubscribe;
  }, [queryClient]);

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['timeEntries'],
    queryFn: () => base44.entities.TimeEntry.list(),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', user?.role],
    queryFn: async () => {
      const allClients = await base44.entities.Client.list();
      if (!user) return allClients;
      if (user.role === 'admin' || user.role === 'management') return allClients;
      if (user.role === 'employee') {
        return allClients.filter(c => c.assigned_employee_id === user.id || c.created_by === user.email);
      }
      return allClients;
    },
    enabled: !!user
  });

  const clientIds = clients.map(c => c.id);

  const { data: meetings = [] } = useQuery({
    queryKey: ['meetings', user?.role, clientIds.join(',')],
    queryFn: async () => {
      const allMeetings = await base44.entities.Meeting.list();
      if (!user) return allMeetings;
      if (user.role === 'admin' || user.role === 'management') return allMeetings;
      if (user.role === 'employee') {
        return allMeetings.filter(m => !m.client_id || clientIds.includes(m.client_id));
      }
      return allMeetings;
    },
    enabled: !!user && clients.length >= 0
  });

  const openNew = (date) => {
    setEditingMeeting(null);
    setForm({
      client_id: "",
      title: "",
      description: "",
      meeting_type: "consultation",
      start_datetime: date ? format(date, "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      end_datetime: date ? format(addDays(date, 0), "yyyy-MM-dd'T'HH:mm") : format(addDays(new Date(), 0), "yyyy-MM-dd'T'HH:mm"),
      location: "",
      status: "scheduled",
      recurrence: "none",
      recurrence_count: 4,
    });
    setShowNew(true);
  };

  const openEdit = (meeting) => {
    setEditingMeeting(meeting);
    setForm({
      client_id: meeting.client_id,
      title: meeting.title,
      description: meeting.description || "",
      meeting_type: meeting.meeting_type,
      start_datetime: format(parseISO(meeting.start_datetime), "yyyy-MM-dd'T'HH:mm"),
      end_datetime: meeting.end_datetime ? format(parseISO(meeting.end_datetime), "yyyy-MM-dd'T'HH:mm") : "",
      location: meeting.location || "",
      status: meeting.status
    });

    // Check if this meeting is part of a series
    if (meeting.series_id && meetings.filter(m => m.series_id === meeting.series_id).length > 1) {
      setShowSeriesEdit(true);
      setEditSeriesMode("current");
    } else {
      setShowNew(true);
    }
  };

  const save = async () => {
    if (!form.client_id || !form.title || !form.start_datetime) {
      toast.error("Please fill required fields");
      return;
    }
    setSaving(true);
    try {
      // Normalize client_id: "self:email" means no client, just a personal meeting
      const normalizedForm = {
        ...form,
        client_id: form.client_id?.startsWith('self:') ? null : form.client_id
      };

      if (editingMeeting) {
        const { recurrence, recurrence_count, ...meetingData } = normalizedForm;

        // If this is a recurring meeting and user chose to edit series
        if (editingMeeting.series_id && editSeriesMode === "series") {
          const seriesMeetings = meetings.filter(m => m.series_id === editingMeeting.series_id);
          await Promise.all(seriesMeetings.map(m => base44.entities.Meeting.update(m.id, meetingData)));
          toast.success(`Updated ${seriesMeetings.length} meetings in series`);
        } else {
          // Edit only current meeting
          await base44.entities.Meeting.update(editingMeeting.id, meetingData);
          toast.success("Meeting updated");
        }
        setEditSeriesMode("current");
        setShowSeriesEdit(false);
      } else {
        const { recurrence, recurrence_count, ...baseData } = normalizedForm;
        const count = recurrence === "none" ? 1 : (parseInt(recurrence_count) || 4);
        const startDt = parseISO(form.start_datetime);
        const endDt = form.end_datetime ? parseISO(form.end_datetime) : null;
        const durationMs = endDt ? endDt - startDt : 0;

        const seriesId = `series_${Date.now()}`;
         const promises = [];
         for (let i = 0; i < count; i++) {
           let newStart, newEnd;
           if (recurrence === "daily") {
             newStart = addDays(startDt, i);
             newEnd = endDt ? new Date(newStart.getTime() + durationMs) : null;
           } else if (recurrence === "weekly") {
             newStart = addWeeks(startDt, i);
             newEnd = endDt ? new Date(newStart.getTime() + durationMs) : null;
           } else if (recurrence === "biweekly") {
             newStart = addWeeks(startDt, i * 2);
             newEnd = endDt ? new Date(newStart.getTime() + durationMs) : null;
           } else if (recurrence === "monthly") {
             newStart = addMonths(startDt, i);
             newEnd = endDt ? new Date(newStart.getTime() + durationMs) : null;
           } else {
             newStart = startDt;
             newEnd = endDt;
           }
           promises.push(base44.entities.Meeting.create({
             ...baseData,
             series_id: recurrence === "none" ? undefined : seriesId,
             start_datetime: newStart.toISOString(),
             end_datetime: newEnd ? newEnd.toISOString() : undefined,
           }));
           if (recurrence === "none") break;
         }
         await Promise.all(promises);
         toast.success(count > 1 ? `${count} recurring meetings scheduled` : "Meeting scheduled");
      }
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      setShowNew(false);
      setEditingMeeting(null);
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const initiateDelete = (meeting) => {
    const meetingDate = format(parseISO(meeting.start_datetime), 'yyyy-MM-dd');
    const meetingTime = format(parseISO(meeting.start_datetime), 'HH:mm');
    // Look for a time entry on same client, same date, same start time (linked via Time Entry flow)
    const linked = timeEntries.find(te =>
      te.client_id === meeting.client_id &&
      te.date === meetingDate &&
      (!te.start_time || te.start_time === meetingTime)
    );
    setMeetingToDelete(meeting);
    setLinkedTimeEntry(linked || null);
    setShowDeleteConfirm(true);
  };

  const deleteMeeting = async (alsoDeleteTimeEntry) => {
    if (!meetingToDelete) return;
    setSaving(true);
    try {
      await base44.entities.Meeting.delete(meetingToDelete.id);
      if (alsoDeleteTimeEntry && linkedTimeEntry) {
        await base44.entities.TimeEntry.delete(linkedTimeEntry.id);
        queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
        toast.success("Meeting and time entry deleted");
      } else {
        toast.success("Meeting deleted");
      }
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      setShowDeleteConfirm(false);
      setMeetingToDelete(null);
      setLinkedTimeEntry(null);
      setShowNew(false);
      setEditingMeeting(null);
    } catch (error) {
      toast.error("Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  const convertToTimeEntry = async () => {
    if (!selectedMeeting) return;
    setSaving(true);
    try {
      const startTime = format(parseISO(selectedMeeting.start_datetime), 'HH:mm');
      const endTime = selectedMeeting.end_datetime 
        ? format(parseISO(selectedMeeting.end_datetime), 'HH:mm')
        : format(parseISO(selectedMeeting.start_datetime), 'HH:mm');
      const date = format(parseISO(selectedMeeting.start_datetime), 'yyyy-MM-dd');
      
      const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
      const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
      const duration = Math.max(1, endMinutes - startMinutes);

      await base44.entities.TimeEntry.create({
        client_id: selectedMeeting.client_id,
        date,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: duration,
        description: convertNotes || selectedMeeting.title,
        category: selectedMeeting.meeting_type || 'consultation'
      });

      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      setShowConvert(false);
      setConvertNotes("");
      toast.success("Converted to time entry");
    } catch (error) {
      toast.error("Failed to convert");
    } finally {
      setSaving(false);
    }
  };

  const getDaysInMonth = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const startWeek = startOfWeek(start);
    const endWeek = endOfWeek(end);
    
    const days = [];
    let day = startWeek;
    while (day <= endWeek) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  };

  const getDaysInWeek = () => {
    const start = startOfWeek(currentDate);
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(start, i));
    }
    return days;
  };

  const getDaysInDay = () => {
    return [currentDate];
  };

  const getMeetingsForDay = (day) => {
    return meetings.filter(m => {
      const meetingDate = parseISO(m.start_datetime);
      return isSameDay(meetingDate, day);
    });
  };

  const days = view === 'month' ? getDaysInMonth() : view === 'week' ? getDaysInWeek() : getDaysInDay();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const statusColors = {
    scheduled: "bg-blue-100 text-blue-700",
    confirmed: "bg-green-100 text-green-700",
    completed: "bg-slate-100 text-slate-600",
    cancelled: "bg-red-100 text-red-700",
    no_show: "bg-amber-100 text-amber-700"
  };

  const meetingBlockColors = {
    scheduled: "bg-blue-500 text-white border-blue-600",
    confirmed: "bg-emerald-500 text-white border-emerald-600",
    completed: "bg-slate-400 text-white border-slate-500",
    cancelled: "bg-red-400 text-white border-red-500 opacity-60",
    no_show: "bg-amber-400 text-white border-amber-500"
  };

  // Time grid constants: 7am–7pm, each hour = 60px
  const HOUR_HEIGHT = 64;
  const START_HOUR = 7;
  const END_HOUR = 19;
  const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  const getTimePosition = (datetimeStr) => {
    const dt = parseISO(datetimeStr);
    const hours = dt.getHours() + dt.getMinutes() / 60;
    return Math.max(0, (hours - START_HOUR) * HOUR_HEIGHT);
  };

  const getMeetingHeight = (start, end) => {
    if (!end) return HOUR_HEIGHT; // default 1 hour
    const startDt = parseISO(start);
    const endDt = parseISO(end);
    const diffHours = (endDt - startDt) / (1000 * 60 * 60);
    return Math.max(24, diffHours * HOUR_HEIGHT);
  };

  const renderTimeGrid = (gridDays) => (
    <div className="flex overflow-x-auto">
      {/* Time labels */}
      <div className="flex-shrink-0 w-14 pt-10 border-r border-slate-100">
        {HOURS.map(h => (
          <div key={h} style={{ height: HOUR_HEIGHT }} className="relative">
            <span className="absolute -top-2.5 right-2 text-xs text-slate-400">
              {h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`}
            </span>
          </div>
        ))}
      </div>
      {/* Day columns */}
      <div className="flex flex-1 min-w-0">
        {gridDays.map(day => {
          const dayMeetings = getMeetingsForDay(day).filter(m => m.status !== 'cancelled');
          const isToday = isSameDay(day, new Date());
          return (
            <div key={day.toString()} className="flex-1 min-w-[120px] border-r border-slate-100 last:border-r-0">
              {/* Day header */}
              <div
                className={cn(
                  "h-10 flex flex-col items-center justify-center border-b border-slate-100 cursor-pointer hover:bg-slate-50 sticky top-0 bg-white z-10",
                  isToday && "bg-blue-50"
                )}
                onClick={() => openNew(day)}
              >
                <span className="text-xs text-slate-500">{format(day, 'EEE')}</span>
                <span className={cn("text-sm font-semibold", isToday ? "text-blue-600" : "text-slate-800")}>
                  {format(day, 'd')}
                </span>
              </div>
              {/* Time slots */}
              <div
                className="relative cursor-pointer"
                style={{ height: HOURS.length * HOUR_HEIGHT }}
                onClick={() => openNew(day)}
              >
                {/* Hour lines */}
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-slate-100"
                    style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
                  />
                ))}
                {/* Half-hour lines */}
                {HOURS.map(h => (
                  <div
                    key={`half-${h}`}
                    className="absolute left-0 right-0 border-t border-slate-50"
                    style={{ top: (h - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                  />
                ))}
                {/* Meeting blocks */}
                {dayMeetings.map(meeting => {
                  const client = clients.find(c => c.id === meeting.client_id);
                  const top = getTimePosition(meeting.start_datetime);
                  const height = getMeetingHeight(meeting.start_datetime, meeting.end_datetime);
                  const color = meetingBlockColors[meeting.status] || meetingBlockColors.scheduled;
                  return (
                    <div
                      key={meeting.id}
                      className={cn("absolute left-1 right-1 rounded px-1.5 py-1 border text-xs overflow-hidden cursor-pointer hover:brightness-95 z-10 shadow-sm", color)}
                      style={{ top, height: Math.max(height, 24) }}
                      onClick={e => { e.stopPropagation(); openEdit(meeting); }}
                    >
                      <p className="font-semibold truncate leading-tight">{format(parseISO(meeting.start_datetime), 'h:mma')}</p>
                      {height > 30 && <p className="truncate opacity-90 text-[10px]">{client ? `${client.first_name} ${client.last_name}` : meeting.title}</p>}
                      {height > 45 && <p className="truncate opacity-80 text-[10px]">{meeting.title}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
            <p className="text-sm text-slate-500 mt-1">Manage client meetings and appointments</p>
          </div>
          <Button onClick={() => openNew()}>
            <Plus className="w-4 h-4 mr-2" /> New Meeting
          </Button>
        </div>

        <Card className="border-0 shadow-sm p-5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => {
                const newDate = new Date(currentDate);
                if (view === 'month') newDate.setMonth(newDate.getMonth() - 1);
                else if (view === 'week') newDate.setDate(newDate.getDate() - 7);
                else newDate.setDate(newDate.getDate() - 1);
                setCurrentDate(newDate);
              }}>
                ←
              </Button>
              <h2 className="text-lg font-semibold text-slate-900 min-w-[200px] text-center">
                {view === 'month' ? format(currentDate, 'MMMM yyyy') : view === 'week' ? `Week of ${format(startOfWeek(currentDate), 'MMM d')}` : format(currentDate, 'MMMM d, yyyy')}
              </h2>
              <Button variant="outline" onClick={() => {
                const newDate = new Date(currentDate);
                if (view === 'month') newDate.setMonth(newDate.getMonth() + 1);
                else if (view === 'week') newDate.setDate(newDate.getDate() + 7);
                else newDate.setDate(newDate.getDate() + 1);
                setCurrentDate(newDate);
              }}>
                →
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex border border-slate-200 rounded-md overflow-hidden">
                <Button variant="ghost" size="sm" className={cn("rounded-none px-3 h-8", view === 'month' && "bg-slate-100")} onClick={() => setView('month')}>
                  Month
                </Button>
                <Button variant="ghost" size="sm" className={cn("rounded-none px-3 h-8 border-l", view === 'week' && "bg-slate-100")} onClick={() => setView('week')}>
                  Week
                </Button>
                <Button variant="ghost" size="sm" className={cn("rounded-none px-3 h-8 border-l", view === 'day' && "bg-slate-100")} onClick={() => setView('day')}>
                  Day
                </Button>
              </div>
              <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
            </div>
          </div>

          {view === 'month' && (
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-semibold text-slate-500 py-2">{day}</div>
              ))}
              {days.map(day => {
                const dayMeetings = getMeetingsForDay(day);
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={day.toString()}
                    className={cn(
                      "p-1.5 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors min-h-[90px]",
                      !isCurrentMonth && "bg-slate-50/50",
                      isToday && "ring-2 ring-blue-500"
                    )}
                    onClick={() => openNew(day)}
                  >
                    <div className={cn("text-xs font-semibold mb-1", isToday ? "text-blue-600" : isCurrentMonth ? "text-slate-900" : "text-slate-400")}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayMeetings.sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime)).slice(0, 2).map(meeting => {
                        const client = clients.find(c => c.id === meeting.client_id);
                        const color = meetingBlockColors[meeting.status] || meetingBlockColors.scheduled;
                        return (
                          <div
                            key={meeting.id}
                            className={cn("text-[10px] px-1 py-0.5 rounded truncate cursor-pointer border", color)}
                            onClick={e => { e.stopPropagation(); openEdit(meeting); }}
                          >
                            {format(parseISO(meeting.start_datetime), 'h:mma')} {client?.first_name}
                          </div>
                        );
                      })}
                      {dayMeetings.length > 2 && (
                        <div className="text-[10px] text-slate-400 pl-1">+{dayMeetings.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === 'week' && renderTimeGrid(getDaysInWeek())}
          {view === 'day' && renderTimeGrid(getDaysInDay())}
        </Card>

        {/* Meetings Needing Time Logged */}
        {(() => {
          const unloggedMeetings = meetings
            .filter(m => {
              if (m.status === 'cancelled' || m.status === 'no_show') return false;
              const meetingDate = new Date(m.start_datetime);
              if (meetingDate >= new Date()) return false; // only past meetings
              const meetingDay = format(parseISO(m.start_datetime), 'yyyy-MM-dd');
              // check if any time entry exists for the same client on the same day
              const hasTimeEntry = timeEntries.some(te => 
                te.client_id === m.client_id && te.date === meetingDay
              );
              return !hasTimeEntry;
            })
            .sort((a, b) => new Date(b.start_datetime) - new Date(a.start_datetime));

          if (unloggedMeetings.length === 0) return null;

          return (
            <Card className="border-0 shadow-sm p-5 border-l-4 border-amber-400">
              <div className="flex items-center gap-2 mb-4">
                <Timer className="w-4 h-4 text-amber-500" />
                <h3 className="text-base font-semibold text-slate-800">Meetings Needing Time Logged ({unloggedMeetings.length})</h3>
              </div>
              <div className="space-y-3">
                {unloggedMeetings.map(meeting => {
                  const client = clients.find(c => c.id === meeting.client_id);
                  return (
                    <div key={meeting.id} className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg hover:bg-amber-100 cursor-pointer" onClick={() => openEdit(meeting)}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-slate-900">{meeting.title}</p>
                          <Badge className={cn("text-xs", statusColors[meeting.status])}>{meeting.status}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            {format(parseISO(meeting.start_datetime), 'MMM d, yyyy')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(parseISO(meeting.start_datetime), 'HH:mm')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Client: {client ? `${client.first_name} ${client.last_name}` : 'Unknown'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-amber-400 text-amber-700 hover:bg-amber-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMeeting(meeting);
                          setConvertNotes(meeting.description || "");
                          setShowConvert(true);
                        }}
                      >
                        <Timer className="w-3 h-3 mr-1" />
                        Log Time
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })()}

        {/* Upcoming Meetings */}
        <Card className="border-0 shadow-sm p-5">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Upcoming Meetings</h3>
          <div className="space-y-3">
            {meetings
              .filter(m => new Date(m.start_datetime) >= new Date() && m.status !== 'cancelled')
              .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))
              .slice(0, 5)
              .map(meeting => {
                const client = clients.find(c => c.id === meeting.client_id);
                const meetingDay = format(parseISO(meeting.start_datetime), 'yyyy-MM-dd');
                const hasTimeEntry = timeEntries.some(te => te.client_id === meeting.client_id && te.date === meetingDay);
                return (
                  <div key={meeting.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer" onClick={() => openEdit(meeting)}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-slate-900">{meeting.title}</p>
                        <Badge className={cn("text-xs", statusColors[meeting.status])}>
                          {meeting.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" />
                          {format(parseISO(meeting.start_datetime), 'MMM d, yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(parseISO(meeting.start_datetime), 'HH:mm')}
                        </span>
                        {meeting.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {meeting.location}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Client: {client ? `${client.first_name} ${client.last_name}` : 'Unknown'}
                      </p>
                    </div>
                    {!hasTimeEntry && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMeeting(meeting);
                          setConvertNotes(meeting.description || "");
                          setShowConvert(true);
                        }}
                        className="text-xs"
                      >
                        <Timer className="w-3 h-3 mr-1" />
                        Log Time
                      </Button>
                    )}
                    {hasTimeEntry && (
                      <Badge className="text-xs bg-emerald-100 text-emerald-700 border-0 shrink-0">Logged</Badge>
                    )}
                  </div>
                );
              })}
          </div>
        </Card>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMeeting ? "Edit Meeting" : "Schedule Meeting"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label className="text-xs">Client / Participant *</Label>
              <Select value={form.client_id} onValueChange={v => setForm(p => ({ ...p, client_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select participant..." />
                </SelectTrigger>
                <SelectContent>
                  {user && (
                    <SelectItem value={`self:${user.email}`}>
                      👤 Myself ({user.full_name || user.email})
                    </SelectItem>
                  )}
                  {clients.filter(c => !c.is_archived && (c.client_type === 'job_seeker' || !c.client_type)).length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Job Seekers</div>
                      {clients.filter(c => !c.is_archived && (c.client_type === 'job_seeker' || !c.client_type)).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                      ))}
                    </>
                  )}
                  {clients.filter(c => !c.is_archived && c.client_type === 'employed').length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Employed</div>
                      {clients.filter(c => !c.is_archived && c.client_type === 'employed').map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                      ))}
                    </>
                  )}
                  {clients.filter(c => !c.is_archived && c.client_type === 'pre_ets').length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Pre-ETS Students</div>
                      {clients.filter(c => !c.is_archived && c.client_type === 'pre_ets').map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                      ))}
                    </>
                  )}
                  {clients.filter(c => !c.is_archived && c.client_type === 'dspd').length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">DSPD Clients</div>
                      {clients.filter(c => !c.is_archived && c.client_type === 'dspd').map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Title *</Label>
              <Input value={form.title || ""} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Meeting Type</Label>
                <Select value={form.meeting_type} onValueChange={v => setForm(p => ({ ...p, meeting_type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultation">Consultation</SelectItem>
                    <SelectItem value="interview_prep">Interview Prep</SelectItem>
                    <SelectItem value="resume_review">Resume Review</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="strategy">Strategy</SelectItem>
                    <SelectItem value="job_coaching">Job Coaching</SelectItem>
                    <SelectItem value="life_skills">Life Skills</SelectItem>
                    <SelectItem value="cbh">CBH</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingMeeting && (
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="no_show">No Show</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start Date & Time *</Label>
                <Input type="datetime-local" value={form.start_datetime || ""} onChange={e => setForm(p => ({ ...p, start_datetime: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">End Date & Time</Label>
                <Input type="datetime-local" value={form.end_datetime || ""} onChange={e => setForm(p => ({ ...p, end_datetime: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Location / Video Link</Label>
              <Input value={form.location || ""} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Office, Zoom link, etc." />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            {!editingMeeting && (
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recurrence</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Repeat</Label>
                    <Select value={form.recurrence || "none"} onValueChange={v => setForm(p => ({ ...p, recurrence: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Does not repeat</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.recurrence && form.recurrence !== "none" && (
                    <div>
                      <Label className="text-xs">Number of occurrences</Label>
                      <Input
                        type="number" min="2" max="52"
                        value={form.recurrence_count || 4}
                        onChange={e => setForm(p => ({ ...p, recurrence_count: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
                {form.recurrence && form.recurrence !== "none" && (
                  <p className="text-xs text-slate-500 bg-blue-50 px-3 py-2 rounded-md">
                    This will create <strong>{form.recurrence_count || 4}</strong> meetings repeating {form.recurrence === "biweekly" ? "every 2 weeks" : form.recurrence}.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between gap-2">
            <div>
              {editingMeeting && (
                <Button variant="destructive" size="sm" onClick={() => { setShowNew(false); initiateDelete(editingMeeting); }} disabled={saving}>
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {editingMeeting && editingMeeting.status === 'completed' && (
                <Button size="sm" variant="outline" onClick={() => {
                  setSelectedMeeting(editingMeeting);
                  setConvertNotes(editingMeeting.description || "");
                  setShowConvert(true);
                  setShowNew(false);
                }}>
                  <Timer className="w-3.5 h-3.5 mr-1" /> Create Time Entry
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving..." : editingMeeting ? "Update" : "Schedule"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
            <AlertDialogDescription>
              {linkedTimeEntry
                ? `This meeting has a corresponding time entry (${linkedTimeEntry.duration_minutes} min on ${linkedTimeEntry.date}). Would you also like to delete the time entry?`
                : "Are you sure you want to delete this meeting? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={linkedTimeEntry ? "flex-col sm:flex-row gap-2" : ""}>
            <AlertDialogCancel onClick={() => { setShowDeleteConfirm(false); setMeetingToDelete(null); setLinkedTimeEntry(null); }}>
              Cancel
            </AlertDialogCancel>
            {linkedTimeEntry ? (
              <>
                <Button variant="outline" onClick={() => deleteMeeting(false)} disabled={saving}>
                  Delete Meeting Only
                </Button>
                <Button variant="destructive" onClick={() => deleteMeeting(true)} disabled={saving}>
                  Delete Both
                </Button>
              </>
            ) : (
              <AlertDialogAction onClick={() => deleteMeeting(false)} className="bg-red-600 hover:bg-red-700 text-white">
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showSeriesEdit} onOpenChange={setShowSeriesEdit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Recurring Meeting</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <p className="text-sm text-slate-600">This meeting is part of a recurring series. Would you like to edit this meeting only or the entire series?</p>
            <div className="space-y-2">
              <button
                onClick={() => setEditSeriesMode("current")}
                className={cn(
                  "w-full p-3 text-left border rounded-lg transition-all",
                  editSeriesMode === "current"
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                <p className="font-medium text-slate-900">This meeting only</p>
                <p className="text-xs text-slate-500 mt-1">Changes apply only to this individual meeting</p>
              </button>
              <button
                onClick={() => setEditSeriesMode("series")}
                className={cn(
                  "w-full p-3 text-left border rounded-lg transition-all",
                  editSeriesMode === "series"
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                <p className="font-medium text-slate-900">Entire series</p>
                <p className="text-xs text-slate-500 mt-1">Changes apply to all meetings in this recurring series</p>
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSeriesEdit(false)}>Cancel</Button>
            <Button onClick={() => {
              setShowSeriesEdit(false);
              setShowNew(true);
            }}>
              Continue Editing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConvert} onOpenChange={setShowConvert}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Convert to Time Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            {selectedMeeting && (
              <>
                <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                  <p className="text-sm font-medium text-slate-900">{selectedMeeting.title}</p>
                  <p className="text-xs text-slate-600">
                    {format(parseISO(selectedMeeting.start_datetime), 'MMM d, yyyy • HH:mm')}
                    {selectedMeeting.end_datetime && ` - ${format(parseISO(selectedMeeting.end_datetime), 'HH:mm')}`}
                  </p>
                </div>
                <div>
                  <Label className="text-xs">Notes / Description</Label>
                  <Textarea
                    value={convertNotes}
                    onChange={e => setConvertNotes(e.target.value)}
                    rows={3}
                    placeholder="Add notes about what was worked on..."
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvert(false)}>Cancel</Button>
            <Button onClick={convertToTimeEntry} disabled={saving}>
              {saving ? "Converting..." : "Convert to Time Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}