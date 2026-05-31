import React, { useState } from "react";
import { Search, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { searchOnetCareersByKeyword } from "@/lib/onet/onetClient";
import { toast } from "sonner";

export default function OnetOccupationExplorer({ clientId, client }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
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
            const title =
              item?.title ||
              item?.name ||
              item?.occupation_title ||
              item?.career_title ||
              "Untitled occupation";

            const code =
              item?.code ||
              item?.onet_code ||
              item?.soc_code ||
              item?.href ||
              "";

            const description =
              item?.description ||
              item?.tags?.bright_outlook ||
              item?.tags?.green ||
              "";

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

                    {description && (
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">
                        {description}
                      </p>
                    )}
                  </div>

                  <Button size="sm" variant="outline" className="h-8 text-xs">
                    View Details
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!searching && query && results.length === 0 && !error && (
        <p className="text-xs text-slate-500">
          No occupations shown yet. Run a search to see O*NET results.
        </p>
      )}
    </div>
  );
}
