import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import LiveJobSearch from "@/components/shared/LiveJobSearch";

export default function JobSuggestionsSection({ client, onAddApplication }) {
  return (
    <Card className="border-0 shadow-sm mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4" /> Live Job Search
          </CardTitle>
          <Badge variant="outline" className="text-xs">Powered by JSearch</Badge>
        </div>
        <p className="text-xs text-slate-500 mt-1">Search real-time listings from Indeed, LinkedIn, Glassdoor & more</p>
      </CardHeader>
      <CardContent>
        <LiveJobSearch client={client} onAddApplication={onAddApplication} />
      </CardContent>
    </Card>
  );
}