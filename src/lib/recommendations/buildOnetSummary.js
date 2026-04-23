export function buildOnetSummary(onetItems = []) {
  const items = Array.isArray(onetItems) ? onetItems : [];

  if (items.length === 0) {
    return {
      top_titles: [],
      top_codes: [],
      highlights: [],
      narrative: "No O*NET occupations were returned for this client profile yet.",
    };
  }

  const topItems = items.slice(0, 5);

  const top_titles = topItems
    .map((item) => String(item?.title || "").trim())
    .filter(Boolean);

  const top_codes = topItems
    .map((item) => String(item?.onet_code || "").trim())
    .filter(Boolean);

  const highlights = topItems.map((item) => ({
    onet_code: String(item?.onet_code || "").trim(),
    title: String(item?.title || "").trim(),
    href: item?.href || null,
    bright_outlook: Boolean(item?.bright_outlook),
    green: Boolean(item?.green),
    apprenticeship: Boolean(item?.apprenticeship),
  }));

  const narrative = `Top O*NET matches identified: ${top_titles.join(", ")}.`;

  return {
    top_titles,
    top_codes,
    highlights,
    narrative,
  };
}
