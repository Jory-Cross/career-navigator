import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Download, AlertCircle, CheckCircle2, Clock, RefreshCw,
  ChevronDown, ChevronUp, ExternalLink, Eye, RotateCcw, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export default function BatchResultsDisplay({ batch, onRetry }) {
  const [expandedResults, setExpandedResults] = useState({});
  const [retryingClients, setRetryingClients] = useState(new Set());

  if (!batch) return null;

  const results = batch.results || [];
  const successCount = results.filter(r => r.status === "success").length;
  const failureCount = results.filter(r => r.status === "failed").length;
  const pendingCount = results.filter(r => r.status === "processing").length;

  const statusConfig = {
    success: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      icon: CheckCircle2,
      color: "text-emerald-600",
      label: "Completed"
    },
    failed: {
      bg: "bg-red-50",
      border: "border-red-200",
      icon: AlertCircle,
      color: "text-red-600",
      label: "Failed"
    },
    processing: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      icon: Clock,
      color: "text-blue-600",
      label: "Processing"
    }
  };

  const batchStatusConfig = {
    completed: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      color: "text-emerald-900",
      label: "All reports generated successfully"
    },
    partial_failure: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      color: "text-amber-900",
      label: `${successCount} succeeded, ${failureCount} failed`
    },
    failed: {
      bg: "bg-red-50",
      border: "border-red-200",
      color: "text-red-900",
      label: "All reports failed"
    },
    processing: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      color: "text-blue-900",
      label: `${successCount} completed, ${pendingCount} processing`
    }
  };

  const batchConfig = batchStatusConfig[batch.status] || batchStatusConfig.processing;

  const handleRetryFailed = async () => {
    const failedClients = results.filter(r => r.status === "failed").map(r => r.client_id);
    if (failedClients.length === 0) return;

    setRetryingClients(new Set(failedClients));
    try {
      await onRetry(failedClients);
      toast.success(`Retrying ${failedClients.length} failed client(s)...`);
    } catch (err) {
      toast.error("Retry failed: " + err.message);
    } finally {
      setRetryingClients(new Set());
    }
  };

  const handleExportSummary = () => {
    const summaryData = {
      batch_id: batch.id,
      status: batch.status,
      created_at: batch.created_at,
      completed_at: batch.completed_at,
      template_name: batch.pdf_template_id,
      entry_type: batch.entry_type_code,
      total_clients: results.length,
      successful: successCount,
      failed: failureCount,
      results: results.map(r => ({
        client: r.client_name || r.client_id,
        status: r.status,
        error: r.message || "",
        pdf_url: r.document?.file_url || ""
      }))
    };

    const csv = [
      ["Client", "Status", "PDF URL", "Error Message"],
      ...results.map(r => [
        r.client_name || r.client_id,
        r.status,
        r.document?.file_url || "",
        r.message || ""
      ])
    ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batch-results-${batch.id.slice(0, 8)}-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Batch summary exported");
  };

  return (
    <div className="space-y-6">
      {/* Batch Header */}
      <Card className={cn("border p-6", batchConfig.bg, batchConfig.border)}>
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className={cn("text-lg font-bold", batchConfig.color)}>
                Batch Report Generation
              </h3>
              <p className={cn("text-sm mt-1", batchConfig.color)}>
                {batchConfig.label}
              </p>
            </div>
            <Badge variant={batch.status === "completed" ? "outline" : "default"}>
              {batch.status.replace(/_/g, " ")}
            </Badge>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-2 bg-white/50 rounded border border-inherit">
              <p className="text-xs font-semibold opacity-60">Total</p>
              <p className="text-xl font-bold">{results.length}</p>
            </div>
            <div className="p-2 bg-emerald-100/30 rounded border border-emerald-200">
              <p className="text-xs font-semibold text-emerald-700">Success</p>
              <p className="text-xl font-bold text-emerald-700">{successCount}</p>
            </div>
            <div className="p-2 bg-red-100/30 rounded border border-red-200">
              <p className="text-xs font-semibold text-red-700">Failed</p>
              <p className="text-xl font-bold text-red-700">{failureCount}</p>
            </div>
            <div className="p-2 bg-white/50 rounded border border-inherit">
              <p className="text-xs font-semibold opacity-60">Generated</p>
              <p className="text-xl font-bold">
                {batch.completed_at
                  ? format(new Date(batch.completed_at), "MMM d, h:mm a")
                  : "—"
                }
              </p>
            </div>
          </div>

          {/* Batch Actions */}
          <div className="flex gap-2 pt-2 flex-wrap">
            {failureCount > 0 && (
              <Button
                onClick={handleRetryFailed}
                disabled={retryingClients.size > 0}
                variant="outline"
                size="sm"
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Retry {failureCount} Failed
              </Button>
            )}
            <Button
              onClick={handleExportSummary}
              variant="outline"
              size="sm"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Export Summary
            </Button>
          </div>
        </div>
      </Card>

      {/* Batch Metadata */}
      <Card className="p-4 bg-slate-50 border-slate-200">
        <div className="grid grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-slate-500 font-semibold">Batch ID</p>
            <p className="text-slate-700 font-mono mt-0.5">{batch.id.slice(0, 12)}...</p>
          </div>
          <div>
            <p className="text-slate-500 font-semibold">Entry Type</p>
            <p className="text-slate-700 mt-0.5">{batch.entry_type_code}</p>
          </div>
          <div>
            <p className="text-slate-500 font-semibold">Created By</p>
            <p className="text-slate-700 mt-0.5">{batch.created_by}</p>
          </div>
          <div>
            <p className="text-slate-500 font-semibold">Period</p>
            <p className="text-slate-700 mt-0.5">
              {batch.date_range_start} to {batch.date_range_end}
            </p>
          </div>
        </div>
      </Card>

      {/* Results Table */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700">Per-Client Results</h4>
        <div className="space-y-1 border border-slate-200 rounded-lg overflow-hidden">
          {results.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              <p>No results yet</p>
            </div>
          ) : (
            results.map((result, idx) => {
              const config = statusConfig[result.status] || statusConfig.failed;
              const Icon = config.icon;
              const isExpanded = expandedResults[idx];

              return (
                <div
                  key={idx}
                  className={cn(
                    "border-t first:border-t-0 transition-colors",
                    isExpanded ? "bg-slate-50" : "bg-white hover:bg-slate-50/50"
                  )}
                >
                  {/* Main Row */}
                  <button
                    onClick={() => setExpandedResults(p => ({
                      ...p,
                      [idx]: !p[idx]
                    }))}
                    className="w-full p-4 flex items-center gap-3 text-left"
                  >
                    {/* Status Icon */}
                    <Icon className={cn("w-4 h-4 shrink-0", config.color)} />

                    {/* Client Name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {result.client_name || result.client_id}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ID: {result.client_id.slice(0, 8)}...
                      </p>
                    </div>

                    {/* Status Badge */}
                    <Badge variant={result.status === "success" ? "outline" : "default"}>
                      {config.label}
                    </Badge>

                    {/* Quick Actions */}
                    <div className="flex gap-1 items-center">
                      {result.status === "success" && result.document?.file_url && (
                        <a href={result.document.file_url} target="_blank" rel="noopener noreferrer">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-200 bg-slate-50">
                      {/* Error Message */}
                      {result.status === "failed" && result.message && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                          <p className="font-semibold mb-1">Error:</p>
                          <p className="font-mono">{result.message}</p>
                        </div>
                      )}

                      {/* Success Details */}
                      {result.status === "success" && (
                        <div className="space-y-2">
                          {result.document?.file_url && (
                            <div>
                              <p className="text-xs font-semibold text-slate-600 mb-1">
                                📄 Generated PDF
                              </p>
                              <a
                                href={result.document.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline break-all font-mono flex items-start gap-1"
                              >
                                {result.document.file_name || result.document.file_url}
                                <ExternalLink className="w-3 h-3 shrink-0 mt-0.5" />
                              </a>
                            </div>
                          )}
                          {result.document?.id && (
                            <div>
                              <p className="text-xs font-semibold text-slate-600 mb-1">
                                🗂️ Document ID
                              </p>
                              <p className="text-xs text-slate-700 font-mono">
                                {result.document.id}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* All Status Details */}
                      {result.status !== "success" && result.status !== "failed" && (
                        <div className="text-xs text-slate-600">
                          <p className="font-semibold mb-1">Status Details:</p>
                          <p>{result.message || "Processing..."}</p>
                        </div>
                      )}

                      {/* Retry Button for Failed */}
                      {result.status === "failed" && (
                        <Button
                          onClick={() => handleRetryFailed()}
                          disabled={retryingClients.has(result.client_id)}
                          size="sm"
                          variant="outline"
                          className="text-amber-700 border-amber-300 hover:bg-amber-50 text-xs"
                        >
                          {retryingClients.has(result.client_id) ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Retrying...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Retry This Client
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}