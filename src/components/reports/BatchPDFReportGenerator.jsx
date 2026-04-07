import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Download, Loader2, CheckCircle, AlertCircle, X,
  Users, Play, ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function BatchPDFReportGenerator({ userRole }) {
  const [templates, setTemplates] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total, current }
  const [results, setResults] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.PDFTemplate.filter({ is_active: true }),
      base44.entities.Client.list(),
    ]).then(([tmpl, cls]) => {
      setTemplates(tmpl);
      setClients(cls.filter(c => !c.is_archived));
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleClient = (id) => {
    setSelectedClientIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedClientIds(filteredClients.map(c => c.id));
  const clearAll = () => setSelectedClientIds([]);

  const filteredClients = clients.filter(c => {
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    return name.includes(clientSearch.toLowerCase());
  });

  const handleGenerate = async () => {
    if (!selectedTemplateId) { toast.error("Please select a PDF template"); return; }
    if (selectedClientIds.length === 0) { toast.error("Please select at least one client"); return; }

    setRunning(true);
    setResults([]);
    setProgress({ done: 0, total: selectedClientIds.length, current: "" });

    try {
      const res = await base44.functions.invoke("generateBatchPDFReports", {
        templateId: selectedTemplateId,
        clientIds: selectedClientIds,
        startDate: startDate || null,
        endDate: endDate || null,
      });

      const data = res?.data;
      if (!data?.results) throw new Error(data?.error || "No results returned");

      setResults(data.results);
      const successCount = data.results.filter(r => r.status === 'success').length;
      const errorCount = data.results.filter(r => r.status === 'error').length;
      toast.success(`Generated ${successCount} report${successCount !== 1 ? 's' : ''}${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
    } catch (e) {
      toast.error("Batch generation failed: " + (e?.response?.data?.error || e.message));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const downloadAll = async () => {
    const successful = results.filter(r => r.status === 'success' && r.pdf_url);
    for (const r of successful) {
      const a = document.createElement('a');
      a.href = r.pdf_url;
      a.download = r.fileName || `report-${r.clientName}.pdf`;
      a.target = '_blank';
      a.click();
      await new Promise(res => setTimeout(res, 300));
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const successResults = results.filter(r => r.status === 'success');
  const errorResults = results.filter(r => r.status === 'error');

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 py-6">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading...
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-800">Batch Report Generator</h3>
        <p className="text-sm text-slate-500">Generate individual PDF reports for multiple clients at once</p>
      </div>

      <Card className="border-0 shadow-sm p-5 space-y-4">
        {/* Template */}
        <div>
          <Label className="text-xs text-slate-500 mb-1 block">PDF Template <span className="text-red-400">*</span></Label>
          {templates.length === 0 ? (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-sm text-amber-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              No PDF templates found. Ask an admin to upload one first.
            </div>
          ) : (
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger><SelectValue placeholder="Select a report template..." /></SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      {t.name}
                      {t.version && <Badge variant="outline" className="text-[10px] ml-1">{t.version}</Badge>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">From Date</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">To Date</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        {/* Client picker */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs text-slate-500">
              Clients <span className="text-red-400">*</span>
              {selectedClientIds.length > 0 && (
                <Badge className="ml-2 text-[10px] bg-blue-100 text-blue-700 border-0">
                  {selectedClientIds.length} selected
                </Badge>
              )}
            </Label>
            <button
              onClick={() => setShowClientPicker(p => !p)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              {showClientPicker ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showClientPicker ? "Hide" : "Select clients"}
            </button>
          </div>

          {/* Selected chips */}
          {selectedClientIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedClientIds.map(id => {
                const c = clients.find(x => x.id === id);
                if (!c) return null;
                return (
                  <span key={id} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-800">
                    {c.first_name} {c.last_name}
                    <button onClick={() => toggleClient(id)} className="text-blue-400 hover:text-blue-700">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {showClientPicker && (
            <div className="border border-slate-200 rounded-lg bg-white shadow-sm">
              <div className="p-2 border-b border-slate-100 flex items-center gap-2">
                <Input
                  placeholder="Search clients..."
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  className="text-xs h-7 flex-1"
                />
                <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap">All</button>
                <button onClick={clearAll} className="text-xs text-slate-400 hover:text-slate-600 whitespace-nowrap">Clear</button>
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
                {filteredClients.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3">No clients found</p>
                ) : filteredClients.map(c => {
                  const selected = selectedClientIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleClient(c.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors",
                        selected && "bg-blue-50"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                        selected ? "bg-blue-600 border-blue-600" : "border-slate-300"
                      )}>
                        {selected && <span className="text-white text-[10px] font-bold">✓</span>}
                      </div>
                      <span className={cn("font-medium", selected ? "text-blue-800" : "text-slate-700")}>
                        {c.first_name} {c.last_name}
                      </span>
                      {c.client_type && (
                        <span className="text-xs text-slate-400 ml-auto">{c.client_type.replace(/_/g, ' ')}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Generate button */}
        <Button
          className="w-full"
          onClick={handleGenerate}
          disabled={running || !selectedTemplateId || selectedClientIds.length === 0}
        >
          {running ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating {selectedClientIds.length} reports...</>
          ) : (
            <><Play className="w-4 h-4 mr-2" /> Generate {selectedClientIds.length > 0 ? selectedClientIds.length : ""} Reports</>
          )}
        </Button>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card className="border-0 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Results</p>
              <p className="text-xs text-slate-500">
                {successResults.length} succeeded · {errorResults.length} failed · Reports saved to each client's Documents
              </p>
            </div>
            {successResults.length > 1 && (
              <Button size="sm" variant="outline" onClick={downloadAll}>
                <Download className="w-3.5 h-3.5 mr-1" /> Download All
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {results.map((r, i) => {
              const c = clients.find(x => x.id === r.clientId);
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    r.status === 'success' ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                  )}
                >
                  {r.status === 'success'
                    ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", r.status === 'success' ? "text-emerald-800" : "text-red-700")}>
                      {r.clientName || c?.first_name + ' ' + c?.last_name || r.clientId}
                    </p>
                    {r.status === 'success' ? (
                      <p className="text-xs text-emerald-600">
                        {r.entryCount} time entr{r.entryCount === 1 ? 'y' : 'ies'} · Saved to client documents
                        {!r.hasData && <span className="ml-1 text-amber-600">(no data — blank report)</span>}
                      </p>
                    ) : (
                      <p className="text-xs text-red-500">{r.error}</p>
                    )}
                  </div>
                  {r.status === 'success' && r.pdf_url && (
                    <a href={r.pdf_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs px-2">
                        <Download className="w-3 h-3 mr-1" /> Download
                      </Button>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}