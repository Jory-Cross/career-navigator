export const ONET_SOURCE_OF_TRUTH = {
  platform_role: "primary_career_intelligence_source",

  official_sources: {
    interest_profiler: "https://onetinterestprofiler.org/",
    my_next_move: "https://www.mynextmove.org/",
    web_services: "https://services.onetcenter.org/",
  },

  required_onet_features: [
    "Interest Profiler questions",
    "RIASEC score calculation",
    "RIASEC results",
    "Job Zone selection",
    "Matching careers",
    "Career keyword search",
    "Career listings",
    "Career reports",
    "Knowledge",
    "Skills",
    "Abilities",
    "Work activities",
    "Technology",
    "Education",
    "Job outlook",
    "Related occupations",
  ],

  recommendation_backbone: {
    primary: [
      "O*NET Interest Profiler results",
      "RIASEC scores",
      "My Next Move matching careers",
      "O*NET occupation details",
      "O*NET job zones",
      "O*NET career reports",
    ],
    local_overlay: [
      "WSA constraints",
      "resume skills",
      "assessment notes",
      "support needs",
      "accommodations",
      "physical limitations",
      "schedule limits",
      "transportation limits",
      "staff notes",
    ],
  },

  build_rule:
    "Do not build custom-only career recommendation logic when an O*NET or My Next Move source should drive the feature. Use local CRM data only as an overlay on top of O*NET career intelligence.",
};
