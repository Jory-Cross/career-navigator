import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, ExternalLink, Building2, Calendar, MapPin, Sparkles, Target, Loader2, Bell, Mail, Share2, Phone, Trash2, StickyNote, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import LiveJobSearch from "@/components/shared/LiveJobSearch";

const statusConfig = {
  saved: { color: "bg-slate-100 text-slate-600", label: "Saved" },
  applied: { color: "bg-blue-100 text-blue-700", label: "Applied" },
  phone_screen: { color: "bg-cyan-100 text-cyan-700", label: "Phone Screen" },
  interview: { color: "bg-violet-100 text-violet-700", label: "Interview" },
  final_round: { color: "bg-amber-100 text-amber-700", label: "Final Round" },
  offer: { color: "bg-emerald-100 text-emerald-700", label: "Offer" },
  rejected: { color: "bg-red-100 text-red-700", label: "Rejected" },
  accepted: { color: "bg-green-100 text-green-700", label: "Accepted" },
  withdrawn: { color: "bg-gray-100 text-gray-500", label: "Withdrawn" }
};

export default function JobApplicationsSection({ clientId, applications, onRefresh, client }) {
  const [activeTab, setActiveTab] = useState("applications"); // "applications" | "search"
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [calculatingFit, setCalculatingFit] = useState(null);
  const [sendingFollowUp, setSendingFollowUp] = useState(null);
  const [sharingLinkedIn, setSharingLinkedIn] = useState(null);
  const [linkedInPreview, setLinkedInPreview] = useState(null);
  const [linkedInPostText, setLinkedInPostText] = useState("");

  const INTERVIEW_STATUSES = ['phone_screen', 'interview', 'final_round'];

  const sendFollowUpEmail = async (e, app) => {
    e.stopPropagation();
    setSendingFollowUp(app.id);
    try {
      const res = await base44.functions.invoke('sendInterviewFollowUp', {
        applicationId: app.id,
        clientId: clientId,
        manual: true
      });
      if (res.data.sent) {
        toast.success(`Follow-up email sent to ${res.data.to}`);
      } else {
        toast.success("No contact email found — draft saved as a task");
      }
      onRefresh();
    } catch (error) {
      toast.error("Failed to send follow-up");
    } finally {
      setSendingFollowUp(null);
    }
  };

  const [newNote, setNewNote] = useState("");

  const addNote = () => {
    if (!newNote.trim()) return;
    const entry = { text: newNote.trim(), created_at: new Date().toISOString(), created_by: "" };
    setForm(p => ({ ...p, note_entries: [...(p.note_entries || []), entry] }));
    setNewNote("");
  };

  const removeNote = (idx) => {
    setForm(p => ({ ...p, note_entries: p.note_entries.filter((_, i) => i !== idx) }));
  };

  const openNew = () => {
    setForm({ company: "", position: "", status: "saved", applied_date: "", follow_up_date: "", job_url: "", salary_range: "", location: "", work_type: "", contact_name: "", contact_title: "", contact_email: "", contact_phone: "", notes: "", note_entries: [], next_step: "", next_step_date: "" });
    setEditId(null);
    setShowNew(true);
  };

  const openEdit = (app) => {
    setForm({ ...app });
    setEditId(app.id);
    setShowNew(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editId) {
      await base44.entities.JobApplication.update(editId, form);
      toast.success("Application updated");
    } else {
      await base44.entities.JobApplication.create({ ...form, client_id: clientId });
      toast.success("Application added");
    }
    setSaving(false);
    setShowNew(false);
    onRefresh();
  };

  const u = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const getAISuggestions = async () => {
    setLoadingSuggestions(true);
    setShowSuggestions(true);
    try {
      const prompt = `You are a career advisor AI. Analyze this client profile and suggest 5 relevant job openings they should pursue.

Client Profile:
- Name: ${client.first_name} ${client.last_name}
- Target Role: ${client.target_role || "Not specified"}
- Industry: ${client.industry || "Not specified"}
- Location: ${client.location || "Not specified"}
- Skills/Background: ${client.notes || "Not provided"}

Based on this profile, suggest 5 specific job opportunities with:
1. Company name (real or realistic)
2. Position title
3. Location
4. Why it's a good fit (1 sentence)

Make suggestions realistic and tailored to their profile.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  company: { type: "string" },
                  position: { type: "string" },
                  location: { type: "string" },
                  why_good_fit: { type: "string" }
                }
              }
            }
          }
        }
      });
      setSuggestions(result.suggestions || []);
    } catch (error) {
      toast.error("Failed to generate suggestions");
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const calculateFitScore = async (app) => {
    setCalculatingFit(app.id);
    try {
      const prompt = `You are a job fit analyzer. Score how well this candidate matches this job opportunity.

Candidate Profile:
- Target Role: ${client.target_role || "Not specified"}
- Industry: ${client.industry || "Not specified"}
- Location: ${client.location || "Not specified"}
- Background: ${client.notes || "Not provided"}

Job Application:
- Company: ${app.company}
- Position: ${app.position}
- Location: ${app.location || "Not specified"}
- Work Type: ${app.work_type || "Not specified"}
- Salary Range: ${app.salary_range || "Not specified"}
- Notes: ${app.notes || "Not provided"}

Provide:
1. A fit score from 0-100 (where 100 is perfect match)
2. A brief analysis explaining the score (2-3 sentences covering strengths and potential concerns)`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            fit_score: { type: "number" },
            analysis: { type: "string" }
          }
        }
      });

      await base44.entities.JobApplication.update(app.id, {
        ai_fit_score: result.fit_score,
        ai_fit_analysis: result.analysis
      });
      toast.success("Fit score calculated");
      onRefresh();
    } catch (error) {
      toast.error("Failed to calculate fit score");
    } finally {
      setCalculatingFit(null);
    }
  };

  const LINKEDIN_SHARE_STATUSES = ['offer', 'accepted', 'interview', 'final_round'];

  const openLinkedInShare = (e, app) => {
    e.stopPropagation();
    const statusLabel = statusConfig[app.status]?.label || app.status;
    let defaultText = '';
    if (app.status === 'accepted') {
      defaultText = `Excited to share that I've accepted an offer as ${app.position} at ${app.company}! Looking forward to this new chapter. #NewJob #Grateful`;
    } else if (app.status === 'offer') {
      defaultText = `Thrilled to have received an offer for ${app.position} at ${app.company}! Big things ahead. #CareerGrowth`;
    } else if (app.status === 'final_round') {
      defaultText = `Made it to the final round for ${app.position} at ${app.company}! Excited for what's next. #JobSearch`;
    } else if (app.status === 'interview') {
      defaultText = `Interviewing for ${app.position} at ${app.company} — grateful for the opportunity! #CareerJourney`;
    }
    setLinkedInPostText(defaultText);
    setLinkedInPreview(app);
  };

  const submitLinkedInPost = async () => {
    setSharingLinkedIn(linkedInPreview.id);
    try {
      await base44.functions.invoke('postToLinkedIn', { postText: linkedInPostText });
      toast.success("Posted to LinkedIn!");
      setLinkedInPreview(null);
    } catch (error) {
      toast.error("Failed to post to LinkedIn");
    } finally {
      setSharingLinkedIn(null);
    }
  };

  const addSuggestionAsApplication = (suggestion) => {
    setForm({
      company: suggestion.company,
      position: suggestion.position,
      location: suggestion.location,
      status: "saved",
      notes: `AI Suggested: ${suggestion.why_good_fit}`,
      applied_date: "",
      job_url: "",
      salary_range: "",
      work_type: "",
      contact_name: "",
      contact_email: "",
      next_step: "",
      next_step_date: ""
    });
    setEditId(null);
    setShowSuggestions(false);
    setShowNew(true);
  };

  const sorted = [...applications].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <>
      <Card className="border-0 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("applications")}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", activeTab === "applications" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              Applications ({applications.length})
            </button>
            <button
              onClick={() => setActiveTab("search")}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1", activeTab === "search" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              <Search className="w-3 h-3" /> Live Job Search
            </button>
          </div>
          {activeTab === "applications" && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={getAISuggestions}>
                <Sparkles className="w-3.5 h-3.5 mr-1" /> AI Suggestions
              </Button>
              <Button size="sm" variant="outline" onClick={openNew}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
            </div>
          )}
        </div>
        {activeTab === "search" && (
          <div className="p-4">
            <LiveJobSearch client={client} onAddApplication={onRefresh} />
          </div>
        )}
        {activeTab === "applications" && (
        <div className="divide-y divide-slate-50">
          {sorted.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No applications yet</div>
          ) : sorted.map(app => (
            <div key={app.id} className="p-4 hover:bg-slate-25 transition-colors cursor-pointer" onClick={() => openEdit(app)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-800">{app.position}</p>
                    <Badge className={cn("text-[10px] border-0", statusConfig[app.status]?.color)}>{statusConfig[app.status]?.label}</Badge>
                    {app.ai_fit_score != null && (
                      <Badge className={cn(
                        "text-[10px] border-0 flex items-center gap-0.5",
                        app.ai_fit_score >= 80 ? "bg-emerald-100 text-emerald-700" :
                        app.ai_fit_score >= 60 ? "bg-blue-100 text-blue-700" :
                        app.ai_fit_score >= 40 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        <Target className="w-2.5 h-2.5" /> {app.ai_fit_score}% fit
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{app.company}</span>
                    {app.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{app.location}</span>}
                    {app.applied_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Applied {format(new Date(app.applied_date), "MMM d")}</span>}
                    {app.follow_up_date && <span className="flex items-center gap-1 text-amber-600"><Bell className="w-3 h-3" />Follow-up {format(new Date(app.follow_up_date), "MMM d")}</span>}
                    {app.contact_name && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{app.contact_name}{app.contact_title ? ` · ${app.contact_title}` : ""}</span>}
                  </div>
                  {app.ai_fit_analysis && (
                    <p className="text-xs text-slate-600 mt-1.5 bg-slate-50 rounded p-2">{app.ai_fit_analysis}</p>
                  )}
                  {app.next_step && <p className="text-xs text-violet-600 mt-1">Next: {app.next_step}</p>}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {app.job_url && (
                    <a href={app.job_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-slate-400 hover:text-blue-600">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); calculateFitScore(app); }}
                    disabled={calculatingFit === app.id}
                    className="h-7 px-2"
                    title="Calculate fit score"
                  >
                    {calculatingFit === app.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Target className="w-3 h-3" />
                    )}
                  </Button>
                  {INTERVIEW_STATUSES.includes(app.status) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => sendFollowUpEmail(e, app)}
                      disabled={sendingFollowUp === app.id}
                      className="h-7 px-2 text-blue-600 hover:text-blue-700"
                      title="Send follow-up email"
                    >
                      {sendingFollowUp === app.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Mail className="w-3 h-3" />
                      )}
                    </Button>
                  )}
                  {LINKEDIN_SHARE_STATUSES.includes(app.status) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => openLinkedInShare(e, app)}
                      className="h-7 px-2 text-[#0077b5] hover:text-[#005885]"
                      title="Share on LinkedIn"
                    >
                      <Share2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Application" : "New Application"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-3">
            <div className="space-y-1"><Label className="text-xs text-slate-500">Company *</Label><Input value={form.company || ""} onChange={e => u("company", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-500">Position *</Label><Input value={form.position || ""} onChange={e => u("position", e.target.value)} /></div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Status</Label>
              <Select value={form.status || "saved"} onValueChange={v => u("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Job URL</Label>
              <div className="flex items-center gap-2">
                <Input value={form.job_url || ""} onChange={e => u("job_url", e.target.value)} />
                {form.job_url && (
                  <a href={form.job_url} target="_blank" rel="noopener noreferrer" title="Open job posting">
                    <ExternalLink className="w-4 h-4 text-blue-500 hover:text-blue-700 shrink-0" />
                  </a>
                )}
              </div>
            </div>
            <div className="space-y-1"><Label className="text-xs text-slate-500">Salary Range</Label><Input value={form.salary_range || ""} onChange={e => u("salary_range", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-500">Location</Label><Input value={form.location || ""} onChange={e => u("location", e.target.value)} /></div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Work Type</Label>
              <Select value={form.work_type || ""} onValueChange={v => u("work_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="onsite">On-site</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs text-slate-500">Applied Date</Label><Input type="date" value={form.applied_date || ""} onChange={e => u("applied_date", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-500">Follow-up Date</Label><Input type="date" value={form.follow_up_date || ""} onChange={e => u("follow_up_date", e.target.value)} /></div>

            {/* Employer Contact Info */}
            <div className="col-span-2 border-t border-slate-200 pt-3 mt-1">
              <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Employer Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs text-slate-500">Contact Name</Label><Input value={form.contact_name || ""} onChange={e => u("contact_name", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs text-slate-500">Contact Title</Label><Input value={form.contact_title || ""} onChange={e => u("contact_title", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs text-slate-500">Contact Email</Label><Input type="email" value={form.contact_email || ""} onChange={e => u("contact_email", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs text-slate-500">Contact Phone</Label><Input type="tel" value={form.contact_phone || ""} onChange={e => u("contact_phone", e.target.value)} /></div>
              </div>
            </div>

            <div className="space-y-1"><Label className="text-xs text-slate-500">Next Step</Label><Input value={form.next_step || ""} onChange={e => u("next_step", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-500">Next Step Date</Label><Input type="date" value={form.next_step_date || ""} onChange={e => u("next_step_date", e.target.value)} /></div>

            {/* Multi-entry Notes */}
            <div className="col-span-2 border-t border-slate-200 pt-3 mt-1">
              <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1"><StickyNote className="w-3.5 h-3.5" /> Notes</p>
              <div className="space-y-2 mb-2 max-h-40 overflow-y-auto">
                {(form.note_entries || []).length === 0 && (
                  <p className="text-xs text-slate-400 italic">No notes yet</p>
                )}
                {(form.note_entries || []).map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-slate-50 rounded-lg p-2 text-xs">
                    <div className="flex-1">
                      <p className="text-slate-700">{entry.text}</p>
                      <p className="text-slate-400 mt-0.5">{entry.created_at ? format(new Date(entry.created_at), "MMM d, yyyy h:mm a") : ""}</p>
                    </div>
                    <button onClick={() => removeNote(idx)} className="text-slate-300 hover:text-red-400 shrink-0 mt-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} rows={2} placeholder="Add a note..." className="text-sm flex-1" onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) addNote(); }} />
                <Button type="button" size="sm" variant="outline" onClick={addNote} className="self-end">Add</Button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Ctrl+Enter to add</p>
            </div>
            
            <div className="col-span-2 border-t border-slate-200 pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4 text-blue-600" />
                <Label className="text-sm font-semibold">Automated Follow-up Reminders</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Follow-up after (days)</Label>
                  <Input 
                    type="number" 
                    value={form.follow_up_cadence_days || 7} 
                    onChange={e => u("follow_up_cadence_days", parseInt(e.target.value))}
                    min="1"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.follow_up_enabled !== false}
                      onChange={e => u("follow_up_enabled", e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <span className="text-xs text-slate-600">Enable reminders</span>
                  </label>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">Automatic tasks will be created to remind you to follow up</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white">{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LinkedIn Share Dialog */}
      <Dialog open={!!linkedInPreview} onOpenChange={() => setLinkedInPreview(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[#0077b5]" />
              Share on LinkedIn
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-xs text-slate-500">Customize the post before sharing to your LinkedIn profile.</p>
            <Textarea
              value={linkedInPostText}
              onChange={e => setLinkedInPostText(e.target.value)}
              rows={5}
              className="text-sm"
            />
            <p className="text-xs text-slate-400">{linkedInPostText.length} characters</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkedInPreview(null)}>Cancel</Button>
            <Button
              onClick={submitLinkedInPost}
              disabled={sharingLinkedIn === linkedInPreview?.id || !linkedInPostText.trim()}
              className="bg-[#0077b5] hover:bg-[#005885] text-white"
            >
              {sharingLinkedIn === linkedInPreview?.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Share2 className="w-4 h-4 mr-1" />}
              Post to LinkedIn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Suggestions Dialog */}
      <Dialog open={showSuggestions} onOpenChange={setShowSuggestions}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-600" />
              AI Job Suggestions for {client.first_name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            {loadingSuggestions ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                <p className="text-sm text-slate-500">Analyzing profile and finding opportunities...</p>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">No suggestions available</div>
            ) : (
              <div className="space-y-3">
                {suggestions.map((suggestion, idx) => (
                  <Card key={idx} className="border border-slate-200 p-4 hover:border-violet-300 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900">{suggestion.position}</p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-slate-600">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>{suggestion.company}</span>
                          {suggestion.location && (
                            <>
                              <span>•</span>
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{suggestion.location}</span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-2 bg-violet-50 rounded p-2">
                          <strong>Why it's a fit:</strong> {suggestion.why_good_fit}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addSuggestionAsApplication(suggestion)}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuggestions(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}