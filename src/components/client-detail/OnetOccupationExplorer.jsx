import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
   searchOnetCareersByKeyword,
  getInterestProfilerJobZones,
  getInterestProfilerCareers,
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
  const [savingInterest, setSavingInterest] = useState(false);
  const [interestJobZones, setInterestJobZones] = useState([]);
  const [selectedInterestJobZone, setSelectedInterestJobZone] = useState("");
  const [loadingInterestJobZones, setLoadingInterestJobZones] = useState(false);
  const [loadingInterestCareers, setLoadingInterestCareers] = useState(false);
   const [interestCareerResults, setInterestCareerResults] = useState([]);
  const [interestProfilerProfile, setInterestProfilerProfile] = useState(null);
  const [error, setError] = useState("");
    const loadInterestJobZones = async () => {
    setLoadingInterestJobZones(true);
    setError("");

    try {
      const data = await getInterestProfilerJobZones();

      const zones =
        data?.job_zone ||
        data?.job_zones ||
        data?.zone ||
        data?.zones ||
        data?.items ||
        [];

            const normalized = Array.isArray(zones) ? zones : [zones];

      const fallbackZones = [
        { code: "1", title: "Job Zone 1" },
        { code: "2", title: "Job Zone 2" },
        { code: "3", title: "Job Zone 3" },
        { code: "4", title: "Job Zone 4" },
        { code: "5", title: "Job Zone 5" },
      ];

      const cleanZones = normalized.filter(Boolean);

      setInterestJobZones(cleanZones.length > 0 ? cleanZones : fallbackZones);
    } catch (err) {
      console.error("Failed to load O*NET job zones:", err);
      setError(err?.message || "Failed to load O*NET job zones.");
      toast.error("Failed to load O*NET job zones.");
    } finally {
      setLoadingInterestJobZones(false);
    }
  };

      useEffect(() => {
    loadInterestJobZones();

    async function loadInterestProfilerProfile() {
      if (!clientId) return;

      try {
        const assessments = base44.entities.Assessment?.filter
          ? await base44.entities.Assessment.filter({
              client_id: clientId,
            })
          : [];

        const interestProfiler = (assessments || []).find((assessment) => {
          const type = String(assessment?.assessment_type || "").toLowerCase();
          const title = String(assessment?.title || assessment?.name || "").toLowerCase();

          return (
            type === "interest_profiler" ||
            type.includes("interest_profiler") ||
            title.includes("interest profiler")
          );
        });

        const responses = interestProfiler?.responses || {};
        const answers =
          responses.answerString ||
          responses.answer_string ||
          (Array.isArray(responses.answers) ? responses.answers.join("") : "");

        const scores =
          responses.riasec_score_string ||
          responses.score_string ||
          responses.scores_string ||
          "";

        setInterestProfilerProfile({
          answers,
          scores,
        });
      } catch (err) {
        console.error("Failed to load Interest Profiler profile:", err);
      }
    }

    loadInterestProfilerProfile();
  }, [clientId]);

      const loadInterestCareersForZone = async (jobZone) => {
    if (!jobZone) {
      toast.error("Select a Job Zone first.");
      return;
    }

    setSelectedInterestJobZone(jobZone);
    setLoadingInterestCareers(true);
    setError("");
    setInterestCareerResults([]);

    try {
         const allCareers = [];
      let start = 1;
      let end = 20;
      let total = null;

      do {
        const data = await getInterestProfilerCareers({
          jobZone,
          answers: interestProfilerProfile?.answers || undefined,
          scores: interestProfilerProfile?.scores || undefined,
          start,
          end,
        });

        const careers =
          data?.career ||
          data?.careers ||
          data?.occupation ||
          data?.occupations ||
          data?.results ||
          [];

        console.log(
          "FIRST CAREER SAMPLE",
          careers?.[0]
        );
        
        const normalized = Array.isArray(careers) ? careers : [careers];

        allCareers.push(...normalized.filter(Boolean));

        total = Number(data?.total || 0);

        start += 20;
        end += 20;
      } while (total && allCareers.length < total);

            const careersWithVerifiedZones = [];

      for (const career of allCareers) {
        const code =
          career?.code ||
          career?.onet_code ||
          career?.occupation_code ||
          career?.onet_soc_code;

        if (!code) {
          careersWithVerifiedZones.push({
            ...career,
            verified_job_zone: null,
          });
          continue;
        }

        try {
          const zoneData = await getOnetOccupationJobZone(code);

          careersWithVerifiedZones.push({
            ...career,
            verified_job_zone: Number(zoneData?.code || 0),
            verified_job_zone_title: zoneData?.title || "",
          });
        } catch (err) {
          console.warn("Failed to verify Job Zone", code, err);

          careersWithVerifiedZones.push({
            ...career,
            verified_job_zone: null,
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      const filteredCareers = careersWithVerifiedZones.filter(
        (career) => career.verified_job_zone === Number(jobZone)
      );

      console.log(
        `Verified Zone ${jobZone}:`,
        filteredCareers.length,
        "occupations"
      );

      setInterestCareerResults(filteredCareers);
    } catch (err) {
      console.error("Failed to load O*NET suggested careers:", err);
      setError(err?.message || "Failed to load O*NET suggested careers.");
      toast.error("Failed to load O*NET suggested careers.");
    } finally {
      setLoadingInterestCareers(false);
    }
  };

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
  occupationDetails?.skills?.element ||
  occupationDetails?.skills
);
  const education = occupationDetails?.education;
  const technology = asArray(
  occupationDetails?.technology?.category ||
  occupationDetails?.technology?.technology ||
  occupationDetails?.technology?.example ||
  occupationDetails?.technology?.element ||
  occupationDetails?.technology
);
  const jobZone = occupationDetails?.jobZone;
const saveInterestedOccupation = async () => {
  if (!clientId || !occupationDetails || !selectedOccupation) {
    toast.error("Client or occupation information is missing.");
    return;
  }

  setSavingInterest(true);

  try {
    const existing =
  await base44.entities.ClientOccupationInterest.filter({
    client_id: clientId,
  });

console.log(
  "INTEREST CHECK",
  {
    clientId,
    onetCode: occupationDetails.code,
    existing,
  }
);

   console.log(
  "INTEREST RECORDS",
  existing.map((item) => ({
    id: item.id,
    onet_code: item.onet_code,
    occupation_title: item.occupation_title,
  }))
);

if (
  existing.some(
    (item) =>
      String(item.onet_code).trim() ===
      String(occupationDetails.code).trim()
  )
) {
      toast.success("Already marked as Interested.");
      return;
    }

    await base44.entities.ClientOccupationInterest.create({
      client_id: clientId,
      onet_code: occupationDetails.code,
      occupation_title:
        overview?.title || getOccupationTitle(selectedOccupation),
      occupation_description: overview?.what_they_do || "",
      job_zone_code: jobZone?.code || null,
      job_zone_title: jobZone?.title || "",
      source: "onet_explorer",
      status: "interested",
      notes: "",
    });

    toast.success("Occupation marked as Interested.");
  } catch (err) {
    console.error("Failed to save interested occupation:", err);
    toast.error("Failed to save interested occupation.");
  } finally {
    setSavingInterest(false);
  }
};
  
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

            <Card className="space-y-3 bg-blue-50 p-3">
        <div>
                    <p className="text-sm font-semibold text-slate-800">
            O*NET Interest Profiler Occupations
          </p>
          <p className="mt-1 text-xs text-slate-600">
            These occupations come from the client's completed Interest Profiler and are grouped by verified O*NET Job Zone / preparation level.
          </p>
        </div>

        {loadingInterestJobZones ? (
          <div className="flex items-center gap-2 text-xs text-blue-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Job Zones...
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {interestJobZones.map((zone, index) => {
              const zoneValue =
                String(zone?.code || zone?.value || zone?.id || index + 1);

              const zoneLabel =
                zone?.title ||
                zone?.name ||
                `Job Zone ${zoneValue}`;

              return (
                <Button
                  key={`${zoneValue}-${index}`}
                  size="sm"
                  variant={selectedInterestJobZone === zoneValue ? "default" : "outline"}
                  onClick={() => loadInterestCareersForZone(zoneValue)}
                  disabled={loadingInterestCareers}
                >
                  {zoneLabel}
                </Button>
              );
            })}
          </div>
        )}

        {loadingInterestCareers && (
          <div className="flex items-center gap-2 text-xs text-blue-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading suggested occupations...
          </div>
        )}

               {interestCareerResults.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600">
              Suggested Occupations
            </p>
            {interestCareerResults.map((item, index) => {
              const title = getOccupationTitle(item);
              const code = getOccupationCode(item);

              return (
                <Card key={`interest-${code || title}-${index}`} className="p-3">
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
        ) : selectedInterestJobZone && !loadingInterestCareers ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            No occupations from the client's Interest Profiler matched this verified Job Zone.
          </div>
        ) : null}
      </Card>

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
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedOccupation(null);
              setOccupationDetails(null);
            }
          }}
        >
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {overview?.title || getOccupationTitle(selectedOccupation)}
            </DialogTitle>
                    </DialogHeader>

          <div className="space-y-3">
            <div>
  <h4 className="text-xl font-semibold text-slate-900">
    {overview?.title || getOccupationTitle(selectedOccupation)}
  </h4>

  <p className="mt-1 text-sm text-slate-600">
    O*NET Code: {occupationDetails.code}
  </p>

  {overview?.bright_outlook && (
    <p className="mt-2 text-xs font-medium text-green-700">
      Bright Outlook Occupation
    </p>
  )}

  {overview?.green && (
    <p className="mt-1 text-xs font-medium text-emerald-700">
      Green Occupation
    </p>
  )}
            <Button
  size="sm"
  className="mt-3"
  onClick={saveInterestedOccupation}
  disabled={savingInterest}
>
  {savingInterest ? "Saving..." : "Interested"}
</Button>
</div>

         <DetailSection title="Overview">
  <p>
    {overview?.what_they_do ||
      overview?.description ||
      overview?.career?.description ||
      overview?.summary ||
      "No overview description returned."}
  </p>
</DetailSection>

         <DetailSection title="Job Zone / Preparation Level">
  <div className="space-y-2 text-xs leading-relaxed">
    <p className="font-semibold text-slate-800">
      {jobZone?.title || `Job Zone ${jobZone?.code || ""}`}
    </p>

    {jobZone?.education && (
      <p>
        <span className="font-semibold">Education: </span>
        {jobZone.education}
      </p>
    )}

    {jobZone?.related_experience && (
      <p>
        <span className="font-semibold">Related Experience: </span>
        {jobZone.related_experience}
      </p>
    )}

    {jobZone?.job_training && (
      <p>
        <span className="font-semibold">Job Training: </span>
        {jobZone.job_training}
      </p>
    )}

    {jobZone?.svp_range && (
      <p>
        <span className="font-semibold">SVP Range: </span>
        {jobZone.svp_range}
      </p>
    )}
  </div>
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
    <div className="space-y-3">
      {skills.map((group, groupIndex) => (
        <div key={group?.id || groupIndex}>
          <p className="text-xs font-semibold text-slate-800">
            {group?.name || "Skill Group"}
          </p>

          {asArray(group?.element).length > 0 && (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-600">
              {asArray(group.element).map((item, itemIndex) => (
                <li key={item?.id || itemIndex}>
                  {item?.name || JSON.stringify(item)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  ) : (
    <p className="text-xs text-slate-500">No skills returned.</p>
  )}
</DetailSection>

         <DetailSection title="Education / Training">
  <div className="space-y-2 text-xs leading-relaxed">
    {education?.job_zone?.education && (
      <p>
        <span className="font-semibold">Typical Education: </span>
        {education.job_zone.education}
      </p>
    )}

    {education?.job_zone?.experience && (
      <p>
        <span className="font-semibold">Experience: </span>
        {education.job_zone.experience}
      </p>
    )}

    {education?.job_zone?.training && (
      <p>
        <span className="font-semibold">Training: </span>
        {education.job_zone.training}
      </p>
    )}

    {asArray(education?.education_usually_needed).length > 0 && (
      <div>
        <p className="font-semibold text-slate-800">
          Education Usually Needed:
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">
          {asArray(education.education_usually_needed).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
</DetailSection>

          <DetailSection title="Technology">
  {technology.length > 0 ? (
    <div className="space-y-3">
      {technology.map((group, groupIndex) => (
        <div key={group?.code || groupIndex}>
          <p className="text-xs font-semibold text-slate-800">
            {group?.title || "Technology Category"}
          </p>

          {asArray(group?.example).length > 0 && (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-600">
              {asArray(group.example).map((item, itemIndex) => (
                <li key={`${item?.title || "tech"}-${itemIndex}`}>
                  {item?.title || JSON.stringify(item)}
                  {item?.hot_technology ? " — Hot technology" : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  ) : (
    <p className="text-xs text-slate-500">No technology returned.</p>
  )}
</DetailSection>
          </div>
               </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
