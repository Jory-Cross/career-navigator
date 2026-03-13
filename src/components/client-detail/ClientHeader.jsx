import React, { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Mail, Phone, MapPin, Briefcase, Globe, Pencil, Save, X, Upload, FileText, Download, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusColors = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-slate-100 text-slate-500",
  completed: "bg-blue-100 text-blue-700"
};

export default function ClientHeader({ client, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadingCoverLetter, setUploadingCoverLetter] = useState(false);
  const fileInputRef = useRef(null);
  const coverLetterInputRef = useRef(null);

  const startEdit = () => {
    setForm({ ...client });
    setEditing(true);
  };

  const save = async () => {
    await base44.entities.Client.update(client.id, form);
    toast.success("Client updated");
    setEditing(false);
    onUpdate();
  };

  const u = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a PDF or Word document");
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Client.update(client.id, {
        resume_file_url: file_url,
        resume_file_name: file.name
      });
      toast.success("Resume uploaded");
      onUpdate();
    } catch (error) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleCoverLetterUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a PDF or Word document");
      return;
    }

    setUploadingCoverLetter(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Client.update(client.id, {
        cover_letter_file_url: file_url,
        cover_letter_file_name: file.name
      });
      toast.success("Cover letter uploaded");
      onUpdate();
    } catch (error) {
      toast.error("Upload failed");
    } finally {
      setUploadingCoverLetter(false);
    }
  };

  if (editing) {
    return (
      <Card className="border-0 shadow-sm p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-slate-800">Edit Client</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="w-4 h-4" /></Button>
            <Button size="sm" onClick={save} className="bg-slate-900 hover:bg-slate-800 text-white"><Save className="w-4 h-4 mr-1" /> Save</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input value={form.first_name || ""} onChange={e => u("first_name", e.target.value)} placeholder="First Name" />
          <Input value={form.last_name || ""} onChange={e => u("last_name", e.target.value)} placeholder="Last Name" />
          <Input value={form.email || ""} onChange={e => u("email", e.target.value)} placeholder="Email" />
          <Input value={form.phone || ""} onChange={e => u("phone", e.target.value)} placeholder="Phone" />
          <Input value={form.target_role || ""} onChange={e => u("target_role", e.target.value)} placeholder="Target Role" />
          <Input value={form.industry || ""} onChange={e => u("industry", e.target.value)} placeholder="Industry" />
          <Input value={form.location || ""} onChange={e => u("location", e.target.value)} placeholder="Location" />
          <Input value={form.linkedin_url || ""} onChange={e => u("linkedin_url", e.target.value)} placeholder="LinkedIn URL" />
          <Select value={form.status || "active"} onValueChange={v => u("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={form.client_type || "client"} onValueChange={v => u("client_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="pre_ets">Pre-ETS</SelectItem>
              <SelectItem value="dspd">DSPD</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea value={form.notes || ""} onChange={e => u("notes", e.target.value)} placeholder="Notes" rows={3} />
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="h-20 bg-gradient-to-r from-slate-800 to-slate-900" />
      <div className="px-6 pb-6 -mt-8">
        <div className="flex items-end gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center text-slate-800 font-bold text-xl border-4 border-white">
            {client.first_name?.[0]}{client.last_name?.[0]}
          </div>
          <div className="flex-1 pt-10">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{client.first_name} {client.last_name}</h1>
              <Badge className={cn("text-xs border-0", statusColors[client.status])}>{client.status}</Badge>
            </div>
            {client.target_role && <p className="text-sm text-slate-500 mt-0.5">{client.target_role}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
        </div>
        <div className="flex flex-wrap gap-4 mt-4 text-xs text-slate-500">
          {client.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {client.email}</span>}
          {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {client.phone}</span>}
          {client.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {client.location}</span>}
          {client.industry && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {client.industry}</span>}
          {client.linkedin_url && (
            <a href={client.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
              <Globe className="w-3 h-3" /> LinkedIn
            </a>
          )}
        </div>
        {client.notes && <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{client.notes}</p>}
        
        {/* Resume Upload Section */}
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Resume File</span>
            </div>
            <div className="flex items-center gap-2">
              {client.resume_file_url ? (
                <>
                  <a
                    href={client.resume_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    {client.resume_file_name || "Download"}
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="text-xs h-7"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3 mr-1" />
                        Replace
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs h-7"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3 h-3 mr-1" />
                      Upload Resume
                    </>
                  )}
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Cover Letter Upload */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Cover Letter</span>
            </div>
            <div className="flex items-center gap-2">
              {client.cover_letter_file_url ? (
                <>
                  <a
                    href={client.cover_letter_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    {client.cover_letter_file_name || "Download"}
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => coverLetterInputRef.current?.click()}
                    disabled={uploadingCoverLetter}
                    className="text-xs h-7"
                  >
                    {uploadingCoverLetter ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3 mr-1" />
                        Replace
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => coverLetterInputRef.current?.click()}
                  disabled={uploadingCoverLetter}
                  className="text-xs h-7"
                >
                  {uploadingCoverLetter ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3 h-3 mr-1" />
                      Upload Cover Letter
                    </>
                  )}
                </Button>
              )}
              <input
                ref={coverLetterInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleCoverLetterUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}