import React, { useState, useRef, useEffect } from "react";
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
import ContactsSection from "./ContactsSection";
import { ClientContactSectionsView, ClientContactSectionsEdit } from "./ClientContactSections";

const statusColors = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-slate-100 text-slate-500",
  completed: "bg-blue-100 text-blue-700"
};

export default function ClientHeader({ client, onUpdate, showDetails = true, allowEdit = true, formOnly = false }) {
  const [editing, setEditing] = useState(formOnly);
  const [form, setForm] = useState(() => (formOnly ? { ...client } : {}));
  const [uploading, setUploading] = useState(false);
  const [uploadingCoverLetter, setUploadingCoverLetter] = useState(false);
  const [employers, setEmployers] = useState([]);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef(null);
  const coverLetterInputRef = useRef(null);

    const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const formRef = useRef(form);

  useEffect(() => {
    if (client.client_type === 'pre_ets') {
      base44.entities.User.list()
        .then(users => {
          setEmployers(users.filter(u => u.role === 'pre_ets_employer'));
        })
        .catch(() => {});
    }
  }, [client.client_type]);

     useEffect(() => {
    if (formOnly) {
      setForm({ ...client });
      dirtyRef.current = false;
    }
  }, [client?.id, formOnly]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!dirtyRef.current) return;

      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

        const save = async ({ closeAfterSave = true, showToast = true } = {}) => {
    if (savingRef.current) return;

    try {
      savingRef.current = true;
      setSaving(true);

      const updates = {
        first_name: form.first_name || "",
        last_name: form.last_name || "",
        email: form.email || "",
        phone: form.phone || "",
        address: form.address || "",
        target_role: form.target_role || "",
        industry: form.industry || "",
        location: form.location || "",
        linkedin_url: form.linkedin_url || "",
        status: form.status || "active",
        client_type: form.client_type || "job_seeker",
        assigned_employer_id: form.assigned_employer_id || "",
        notes: form.notes || "",
        school: form.school || "",
        graduation_year: form.graduation_year || ""
      };

      const updatedClient = await base44.entities.Client.update(
        client.id,
        updates
      );

      setForm(updatedClient);
      dirtyRef.current = false;

      // Notify parent to re-fetch the client from the server
      if (typeof onUpdate === "function") {
        onUpdate();
      }

           if (showToast) {
        toast.success("Client updated");
      }

      if (closeAfterSave && !formOnly) {
        setEditing(false);
      }

    } catch (error) {
      console.error("Failed to save client", error);
      toast.error("Failed to save client");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

    const u = (f, v) => {
    dirtyRef.current = true;

    setForm((p) => {
      const nextForm = {
        ...p,
        [f]: v
      };

      formRef.current = nextForm;

      return nextForm;
    });
  };

  const cancelEdit = () => {
    setForm({ ...client });
    dirtyRef.current = false;
    setEditing(false);
  };
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

if (editing || formOnly) {
    return (
     <Card className="rounded-2xl border bg-slate-50/60 shadow-sm p-6 space-y-6">
       <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
  <div>
    <h2 className="text-lg font-semibold text-slate-900">Client Details</h2>
    <p className="text-sm text-slate-500">Update client information below.</p>
  </div>

  <div className="flex gap-2">
    <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
      <X className="w-4 h-4 mr-1" />
      Cancel
    </Button>
        <Button size="sm" onClick={() => save()} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white">
      <Save className="w-4 h-4 mr-1" />
      Save
    </Button>
  </div>
</div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <Input className="h-10" value={form.first_name || ""} onChange={e => u("first_name", e.target.value)} placeholder="First Name" />
        <Input className="h-10" value={form.last_name || ""} onChange={e => u("last_name", e.target.value)} placeholder="Last Name" />
         <Input className="h-10" value={form.email || ""} onChange={e => u("email", e.target.value)} placeholder="Email" />
        <Input className="h-10" value={form.phone || ""} onChange={e => u("phone", e.target.value)} placeholder="Phone" />
        <Input className="h-10 md:col-span-2" value={form.address || ""} onChange={e => u("address", e.target.value)} placeholder="Home Address" />
          <Input className="h-10" value={form.target_role || ""} onChange={e => u("target_role", e.target.value)} placeholder="Target Role" />
         <Input className="h-10" value={form.industry || ""} onChange={e => u("industry", e.target.value)} placeholder="Industry" />
         <Input className="h-10" value={form.location || ""} onChange={e => u("location", e.target.value)} placeholder="Location" />
        <Input className="h-10" value={form.linkedin_url || ""} onChange={e => u("linkedin_url", e.target.value)} placeholder="LinkedIn URL" />
        <Select value={form.status || "active"} onValueChange={v => u("status", v)}>
  <SelectTrigger className="h-10">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="active">Active</SelectItem>
    <SelectItem value="inactive">Inactive</SelectItem>
    <SelectItem value="completed">Completed</SelectItem>
  </SelectContent>
</Select>
          <Select value={form.client_type || "job_seeker"} onValueChange={v => u("client_type", v)}>
           <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="job_seeker">Job Seeker</SelectItem>
              <SelectItem value="employed">Employed</SelectItem>
              <SelectItem value="pre_ets">Pre-ETS</SelectItem>
              <SelectItem value="dspd">DSPD</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.client_type === 'pre_ets' && employers.length > 0 && (
       <div className="md:col-span-2">
            <Select value={form.assigned_employer_id || "none"} onValueChange={v => u("assigned_employer_id", v === "none" ? "" : v)}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Assign Pre-ETS Employer..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No Employer Assigned —</SelectItem>
                {employers.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name || e.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      <Textarea className="h-24 md:col-span-2" value={form.notes || ""} onChange={e => u("notes", e.target.value)} placeholder="Notes" rows={3} />
    <div className="pt-4 border-t">
  <ClientContactSectionsEdit form={form} onChange={u} clientType={form.client_type} />
</div>
      </Card>
    );
  }

  return (
   <Card className="rounded-2xl border shadow-sm overflow-hidden">
     <div className="h-16 bg-gradient-to-r from-slate-800 to-slate-900 rounded-t-2xl" />
     <div className="px-6 pb-6 -mt-6">
    <div className="flex items-end gap-3">
        <div className="w-14 h-14 rounded-xl bg-white shadow-md flex items-center justify-center text-slate-800 font-semibold text-lg border-2 border-white">
            {client.first_name?.[0]}{client.last_name?.[0]}
          </div>
          <div className="flex-1 pt-10">
            <div className="flex items-center gap-2 flex-wrap">
           <h1 className="text-lg font-semibold text-slate-900">{client.first_name} {client.last_name}</h1>
              <Badge className={cn("text-xs border-0", statusColors[client.status])}>{client.status}</Badge>
            </div>
            {client.target_role && <p className="text-sm text-slate-500 mt-0.5">{client.target_role}</p>}
          </div>
         {allowEdit && (
<Button variant="outline" size="sm" className="rounded-lg" onClick={() => { setForm({ ...client }); setEditing(true); }}>
    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
  </Button>
)}
        </div>
        {showDetails && (
 <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">
    {client.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {client.email}</span>}
    {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {client.phone}</span>}
    {client.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {client.address}</span>}
    {client.location && !client.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {client.location}</span>}
    {client.industry && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {client.industry}</span>}
    {client.linkedin_url && (
      <a href={client.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
        <Globe className="w-3 h-3" /> LinkedIn
      </a>
    )}
  </div>
)}
   {showDetails && client.notes && <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-xl p-3">{client.notes}</p>}
        
       
{showDetails && <ClientContactSectionsView client={client} />}
       {showDetails && <ContactsSection client={client} onUpdate={onUpdate} />}
      </div>
    </Card>
  );
}
