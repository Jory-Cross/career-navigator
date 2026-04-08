import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * getReportAggregation
 *
 * Actions:
 *   assemble_report  → assembles { header, rows, summary, totals,
 *                                   included_time_entry_ids, included_answer_ids }
 *   stats            → lightweight dashboard analytics
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, client_id, entry_type_code, date_from, date_to, report_mode, year, month } = body;

    if (!action) return Response.json({ error: 'Missing action' }, { status: 400 });

    // ── assemble_report ───────────────────────────────────────────────────────
    if (action === 'assemble_report') {
      if (!client_id)   return Response.json({ error: 'client_id required' }, { status: 400 });
      if (!date_from)   return Response.json({ error: 'date_from required' }, { status: 400 });
      if (!date_to)     return Response.json({ error: 'date_to required' }, { status: 400 });
      if (!report_mode) return Response.json({ error: 'report_mode required' }, { status: 400 });

      const etCode = resolveEntryTypeCode(report_mode, entry_type_code);

      const [client, allEntries, authorizations] = await Promise.all([
        base44.entities.Client.filter({ id: client_id }).then(r => r[0] || null),
        etCode
          ? base44.entities.TimeEntry.filter({ client_id, entry_type_code: etCode })
          : base44.entities.TimeEntry.filter({ client_id }),
        base44.entities.ServiceAuthorization.filter({ client_id })
      ]);

      if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

      const entries = allEntries.filter(e => e.date >= date_from && e.date <= date_to);

      // Fetch answers scoped to this entry type (or all if no type)
      const answerFilter = etCode ? { entry_type_code: etCode } : {};
      const allAnswers = entries.length > 0
        ? await base44.entities.ReportFieldAnswer.filter(answerFilter)
        : [];

      const answersMap = {};
      allAnswers.forEach(a => { answersMap[a.time_entry_id] = a; });

      const authMap = {};
      authorizations.forEach(a => { authMap[a.id] = a; });

      const result = assembleReport(report_mode, client, entries, answersMap, authMap, { date_from, date_to });
      return Response.json({ success: true, report_mode, data: result });
    }

    // ── stats (dashboard analytics) ───────────────────────────────────────────
    if (action === 'stats') {
      const filters = {
        ...(client_id      && { client_id }),
        ...(entry_type_code && { entry_type_code })
      };
      const [timeEntries, authorizations] = await Promise.all([
        base44.entities.TimeEntry.filter(filters),
        client_id ? base44.entities.ServiceAuthorization.filter({ client_id }) : Promise.resolve([])
      ]);

      const filtered = timeEntries.filter(e => {
        if (date_from && e.date < date_from) return false;
        if (date_to   && e.date > date_to)   return false;
        if (year && month) {
          const monthStr = `${year}-${String(month).padStart(2, '0')}`;
          if (!e.date.startsWith(monthStr)) return false;
        }
        return true;
      });

      return Response.json({ success: true, data: buildStats(filtered, authorizations) });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    console.error('getReportAggregation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Report Mode → Entry Type Code ───────────────────────────────────────────

function resolveEntryTypeCode(report_mode, override) {
  if (override) return override;
  const map = {
    usor95_monthly:         'job_coaching',
    usor96_monthly:         'job_development',
    usor148_service_period: null   // all types
  };
  return map[report_mode] ?? null;
}

// ─── Report Assembly ──────────────────────────────────────────────────────────

function assembleReport(report_mode, client, entries, answersMap, authMap, options) {
  const { date_from, date_to } = options;

  const header  = buildHeader(client, entries, authMap, date_from, date_to);
  const rows    = report_mode === 'usor148_service_period'
    ? buildServicePeriodRows(entries, answersMap)
    : buildMonthlyRows(entries, answersMap);
  const summary = buildSummary(entries, answersMap, authMap);
  const totals  = buildTotals(entries);

  // IDs for audit trail / GeneratedReport record
  const included_time_entry_ids = entries.map(e => e.id);
  const included_answer_ids     = entries.map(e => answersMap[e.id]?.id).filter(Boolean);

  return { header, rows, summary, totals, included_time_entry_ids, included_answer_ids };
}

function buildHeader(client, entries, authMap, date_from, date_to) {
  const authIds = [...new Set(entries.map(e => e.service_authorization_id).filter(Boolean))];
  const auth    = authIds.length ? authMap[authIds[0]] : null;

  return {
    client_id:               client.id,
    client_first_name:       client.first_name || '',
    client_last_name:        client.last_name  || '',
    client_full_name:        `${client.first_name || ''} ${client.last_name || ''}`.trim(),
    client_email:            client.email   || '',
    client_phone:            client.phone   || '',
    client_address:          client.address || '',
    report_period_start:     date_from,
    report_period_end:       date_to,
    authorization_number:    auth?.authorization_number  || '',
    vr_counselor:            auth?.vr_counselor_name     || '',
    job_goal:                auth?.job_goal              || client.target_role || '',
    employer_name:           auth?.employer_name         || client.workplace_name || '',
    total_authorized_hours:  auth?.total_authorized_hours || 0,
    hours_used:              auth?.used_hours            || 0,
    hours_remaining:         auth?.remaining_hours       || 0,
    report_generated_date:   new Date().toISOString().split('T')[0]
  };
}

function buildMonthlyRows(entries, answersMap) {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date)).map((entry, idx) => {
    const answers = answersMap[entry.id]?.answers || {};
    return {
      row_number:       idx + 1,
      time_entry_id:    entry.id,
      date:             entry.date,
      start_time:       entry.start_time  || '',
      end_time:         entry.end_time    || '',
      duration_minutes: entry.duration_minutes || 0,
      duration_hours:   roundHours(entry.duration_minutes),
      entry_type_code:  entry.entry_type_code || '',
      description:      entry.description || '',
      service_authorization_id: entry.service_authorization_id || '',
      ...answers
    };
  });
}

function buildServicePeriodRows(entries, answersMap) {
  const byType = {};
  entries.forEach(entry => {
    const code = entry.entry_type_code || 'other';
    if (!byType[code]) byType[code] = [];
    byType[code].push(entry);
  });

  return Object.entries(byType).map(([code, typeEntries]) => {
    const sorted = [...typeEntries].sort((a, b) => a.date.localeCompare(b.date));
    return {
      entry_type_code: code,
      subtotal_hours:  roundHours(typeEntries.reduce((s, e) => s + (e.duration_minutes || 0), 0)),
      rows: sorted.map((entry, idx) => ({
        row_number:       idx + 1,
        time_entry_id:    entry.id,
        date:             entry.date,
        duration_minutes: entry.duration_minutes || 0,
        duration_hours:   roundHours(entry.duration_minutes),
        description:      entry.description || '',
        ...(answersMap[entry.id]?.answers || {})
      }))
    };
  });
}

function buildSummary(entries, answersMap, authMap) {
  const byType = {};
  entries.forEach(e => {
    const code = e.entry_type_code || 'other';
    if (!byType[code]) byType[code] = { count: 0, total_minutes: 0 };
    byType[code].count++;
    byType[code].total_minutes += e.duration_minutes || 0;
  });

  const byAuth = {};
  entries.forEach(e => {
    const authId = e.service_authorization_id;
    if (!authId) return;
    if (!byAuth[authId]) {
      const auth = authMap[authId] || {};
      byAuth[authId] = {
        authorization_number:    auth.authorization_number || authId,
        total_authorized_hours:  auth.total_authorized_hours || null,
        count: 0,
        total_minutes: 0
      };
    }
    byAuth[authId].count++;
    byAuth[authId].total_minutes += e.duration_minutes || 0;
  });

  return {
    by_entry_type: Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [k, { ...v, total_hours: roundHours(v.total_minutes) }])
    ),
    by_authorization: Object.fromEntries(
      Object.entries(byAuth).map(([k, v]) => [k, { ...v, total_hours: roundHours(v.total_minutes) }])
    )
  };
}

function buildTotals(entries) {
  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  return {
    entry_count:   entries.length,
    total_minutes: totalMinutes,
    total_hours:   roundHours(totalMinutes)
  };
}

// ─── Lightweight Stats ────────────────────────────────────────────────────────

function buildStats(entries, authorizations) {
  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);

  const byMonth = {};
  const byType  = {};
  entries.forEach(e => {
    const m = e.date.substring(0, 7);
    if (!byMonth[m]) byMonth[m] = { count: 0, total_minutes: 0 };
    byMonth[m].count++;
    byMonth[m].total_minutes += e.duration_minutes || 0;

    const t = e.entry_type_code || 'other';
    if (!byType[t]) byType[t] = { count: 0, total_minutes: 0 };
    byType[t].count++;
    byType[t].total_minutes += e.duration_minutes || 0;
  });

  const normalizeHours = obj =>
    Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, { ...v, total_hours: roundHours(v.total_minutes) }])
    );

  const authSummary = authorizations.map(a => ({
    id:                     a.id,
    authorization_number:   a.authorization_number,
    entry_type_code:        a.entry_type_code,
    total_authorized_hours: a.total_authorized_hours,
    used_hours:             a.used_hours       || 0,
    remaining_hours:        a.remaining_hours  || (a.total_authorized_hours - (a.used_hours || 0)),
    status:                 a.status
  }));

  return {
    total_entries:  entries.length,
    total_hours:    roundHours(totalMinutes),
    by_month:       normalizeHours(byMonth),
    by_entry_type:  normalizeHours(byType),
    authorizations: authSummary
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundHours(minutes) {
  return Math.round(((minutes || 0) / 60) * 100) / 100;
}