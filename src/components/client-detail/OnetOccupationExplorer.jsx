import React, { useState } from "react";
import { Search, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  searchOnetCareersByKeyword,
  getOnetOccupationOverview,
  getOnetOccupationTasks,
  getOnetOccupationSkills,
  getOnetOccupationEducation,
  getOnetOccupationTechnology,
  getOnetOccupationJobZone,
} from "@/lib/onet/onetClient";
import { toast } from "sonner";

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getOccupationCode(item) {
  return (
    item?.code ||
    item?.onet_code ||
    item?.soc_code ||
    ""
  );
}

function getOccupationTitle(item) {
  return (
    item?.title ||
    item?.name ||
    item?.occupation_title ||
    item?.career_title ||
    "Untitled occupation"
  );
}

function DetailSection({ title, children }) {
  if (!children) return null;

  return (
    <Card className="p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="mt-2 text-sm text-slate-700">
        {children}
      </div>
    </Card>
  );
}

export default function OnetOccupationExplorer({ clientId, client }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedOccupation, setSelectedOccupation] = useState(null);
  const [occupationDetails, setOccupationDetails] = useState(null);
  const [searching, setSearching] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState("");

  const runSearch = async () => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      toast.error("Enter an occupation to search.");
      return;
    }

    setSearching(true);
    setError("");
    setResults([]);
    setSelectedOccupation(null);
    setOccupationDetails(null);

    try {
      const data = await searchOnetCareersByKeyword(trimmedQuery);

      const careers =
        data?.career ||
        data?.careers ||
        data?.occupation ||
        data?.occupations ||
        data?.results ||
        [];

      const normalized = Array.isArray(careers) ? careers : [careers];

      setResults(normalized.filter(Boolean));
    } catch (err) {
      console.error("O*NET occupation search failed:", err);
      setError(err?.message || "O*NET occupation search failed.");
      toast.error("O*NET occupation search failed.");
    } finally {
      setSearching(false);
    }
  };

  const loadOccupationDetails = async (occupation) => {
    const code = getOccupationCode(occupation);

    if (!code) {
      toast.error("This O*NET result does not include an occupation code.");
      return;
    }

    setSelectedOccupation(occupation);
    setLoadingDetails(true);
    setError("");

    try {
      const [
        overview,
        tasks,
        skills,
        education,
        technology,
        jobZone,
      ] = await Promise.allSettled([
        getOnetOccupationOverview(code),
        getOnetOccupationTasks(code),
        getOnetOccupationSkills(code),
        getOnetOccupationEducation(code),
        getOnetOccupationTechnology(code),
        getOnetOccupationJobZone(code),
      ]);

console.log("OCCUPATION OVERVIEW", overview.value);
console.log("OCCUPATION SKILLS", skills.value);
console.log("OCCUPATION TECHNOLOGY", technology.value);
      
      setOccupationDetails({
        code,
        overview: overview.status === "fulfilled" ? overview.value : null,
        tasks: tasks.status === "fulfilled" ? tasks.value : null,
        skills: skills.status === "fulfilled" ? skills.value : null,
        education: education.status === "fulfilled" ? education.value : null,
        technology: technology.status === "fulfilled" ? technology.value : null,
        jobZone: jobZone.status === "fulfilled" ? jobZone.value : null,
      });
    } catch (err) {
      console.error("O*NET occupation detail load failed:", err);
      setError(err?.message || "O*NET occupation detail load failed.");
      toast.error("O*NET occupation detail load failed.");
    } finally {
      setLoadingDetails(false);
    }
  };

  const overview = occupationDetails?.overview;
  const tasks = asArray(
    occupationDetails?.tasks?.task ||
    occupationDetails?.tasks?.tasks ||
    occupationDetails?.tasks?.element
  );
  const skills = asArray(
    occupationDetails?.skills?.group ||
    occupationDetails?.skills?.skill ||
    occupationDetails?.skills?.skills ||
    occupationDetails?.skills?.element
  );
  const education = occupationDetails?.education;
  const technology = asArray(
    occupationDetails?.technology?.category ||
    occupationDetails?.technology?.technology ||
    occupationDetails?.technology?.example ||
    occupationDetails?.technology?.element
  );
  const jobZone = occupationDetails?.jobZone;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-800">
          O*NET Occupation Explorer
        </h4>
        <p className="mt-1 text-xs text-slate-500">
          Search O*NET occupations by title, then open an occupation to review details.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              runSearch();
            }
          }}
          placeholder="Search occupations, e.g. Cashier, Janitor, Driver"
          className="text-sm"
        />

        <Button onClick={runSearch} disabled={searching} className="shrink-0">
          {searching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Search
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">
            Search Results
          </p>

          {results.map((item, index) => {
            const title = getOccupationTitle(item);
            const code = getOccupationCode(item);

            return (
              <Card key={`${code || title}-${index}`} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {title}
                    </p>

                    {code && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {code}
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => loadOccupationDetails(item)}
                    disabled={loadingDetails}
                  >
                    View Details
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {loadingDetails && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading O*NET occupation details...
        </div>
      )}

      {occupationDetails && selectedOccupation && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <h4 className="text-base font-semibold text-slate-900">
              {getOccupationTitle(selectedOccupation)}
            </h4>
            <p className="mt-0.5 text-xs text-slate-500">
              O*NET Code: {occupationDetails.code}
            </p>
          </div>

          <DetailSection title="Overview">
            <p>
              {overview?.description ||
                overview?.career?.description ||
                overview?.summary ||
                "No overview description returned."}
            </p>
          </DetailSection>

          <DetailSection title="Job Zone / Preparation Level">
            <pre className="whitespace-pre-wrap text-xs">
              {JSON.stringify(jobZone, null, 2)}
            </pre>
          </DetailSection>

          <DetailSection title="Tasks">
            {tasks.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-xs">
                {tasks.slice(0, 12).map((task, index) => (
                  <li key={index}>
                    {task?.statement || task?.title || task?.name || JSON.stringify(task)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">No tasks returned.</p>
            )}
          </DetailSection>

          <DetailSection title="Skills">
            {skills.length > 0 ? (
              <pre className="whitespace-pre-wrap text-xs">
                {JSON.stringify(skills.slice(0, 6), null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-slate-500">No skills returned.</p>
            )}
          </DetailSection>

          <DetailSection title="Education / Training">
            <pre className="whitespace-pre-wrap text-xs">
              {JSON.stringify(education, null, 2)}
            </pre>
          </DetailSection>

          <DetailSection title="Technology">
            {technology.length > 0 ? (
              <pre className="whitespace-pre-wrap text-xs">
                {JSON.stringify(technology.slice(0, 8), null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-slate-500">No technology returned.</p>
            )}
          </DetailSection>
        </div>
      )}
    </div>
  );
}
