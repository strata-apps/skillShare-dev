// functions/dataOrg.js

function normalizeTitle(s = "") {
  return String(s)
    .trim()
    .toLowerCase()
    // unify ampersands / "and"
    .replace(/\s*&\s*/g, " and ")
    // normalize punctuation/spacing
    .replace(/[’']/g, "")
    .replace(/[,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeArray(x) {
  return Array.isArray(x) ? x.filter(Boolean) : [];
}

function safeObj(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : {};
}

export async function loadAndOrganizeData() {
  const [
    dwa,
    contextSkills,
    techSkills,
    tasks,
    descriptions,
    wagesByOcc,
    occsByCategory,
  ] = await Promise.all([
    fetch("./data/jobs_dwa.json").then((r) => r.json()),
    fetch("./data/jobs_context_skills.json").then((r) => r.json()),
    fetch("./data/jobs_tech_skills.json").then((r) => r.json()),
    fetch("./data/jobs_tasks.json").then((r) => r.json()),
    fetch("./data/jobs_descriptions.json").then((r) => r.json()),
    fetch("./data/wages_by_occupation.json").then((r) => r.json()),
    fetch("./data/occupations_by_category.json").then((r) => r.json()),
  ]);

  // ---------------------------------------------------------------------------
  // 1) Build a master set of job titles (from ALL sources)
  // ---------------------------------------------------------------------------

  // Titles directly keyed by job title
  const titlesFromKeyedFiles = new Set([
    ...Object.keys(dwa || {}),
    ...Object.keys(contextSkills || {}),
    ...Object.keys(techSkills || {}),
    ...Object.keys(tasks || {}),
    ...Object.keys(descriptions || {}),
    ...Object.keys(wagesByOcc || {}),
  ]);

  // Titles embedded under categories (category -> [titles...])
  const titlesFromCategories = new Set();
  const categoryToTitles = safeObj(occsByCategory);

  for (const cat of Object.keys(categoryToTitles)) {
    for (const t of safeArray(categoryToTitles[cat])) {
      titlesFromCategories.add(t);
    }
  }

  // Combined titles (raw)
  const rawAllTitles = new Set([...titlesFromKeyedFiles, ...titlesFromCategories]);

  // ---------------------------------------------------------------------------
  // 2) Create a normalization index so cross-file matches work reliably
  //    normalizedTitle -> Set(rawTitleVariants)
  // ---------------------------------------------------------------------------
  const normToRaw = new Map();
  const addVariant = (rawTitle) => {
    if (!rawTitle) return;
    const key = normalizeTitle(rawTitle);
    if (!key) return;
    if (!normToRaw.has(key)) normToRaw.set(key, new Set());
    normToRaw.get(key).add(rawTitle);
  };

  for (const t of rawAllTitles) addVariant(t);

  // Helper: given a title, pick a “canonical” raw title for it
  // Preference order: one from jobs_* files, then wages, then categories
  const canonicalFor = (rawTitle) => {
    const key = normalizeTitle(rawTitle);
    const variants = normToRaw.get(key);
    if (!variants || variants.size === 0) return rawTitle;

    const v = Array.from(variants);

    const preferFrom = (obj) => v.find((x) => Object.prototype.hasOwnProperty.call(obj || {}, x));
    return (
      preferFrom(dwa) ||
      preferFrom(contextSkills) ||
      preferFrom(techSkills) ||
      preferFrom(tasks) ||
      preferFrom(descriptions) ||
      preferFrom(wagesByOcc) ||
      v[0]
    );
  };

  // ---------------------------------------------------------------------------
  // 3) Invert occupations_by_category to jobTitle -> [categories...]
  // ---------------------------------------------------------------------------
  const jobToCategories = new Map(); // normalizedTitle -> Set(category)

  for (const cat of Object.keys(categoryToTitles)) {
    const titles = safeArray(categoryToTitles[cat]);
    for (const rawTitle of titles) {
      const key = normalizeTitle(rawTitle);
      if (!key) continue;
      if (!jobToCategories.has(key)) jobToCategories.set(key, new Set());
      jobToCategories.get(key).add(cat);
    }
  }

  // ---------------------------------------------------------------------------
  // 4) Create wages index: normalizedTitle -> wageRecords[]
  // ---------------------------------------------------------------------------
  const wagesIndex = new Map(); // normalizedTitle -> array of wage records
  for (const rawTitle of Object.keys(wagesByOcc || {})) {
    const key = normalizeTitle(rawTitle);
    const recs = safeArray(wagesByOcc[rawTitle]); // file has arrays (sometimes duplicates)
    if (!key) continue;
    if (!wagesIndex.has(key)) wagesIndex.set(key, []);
    wagesIndex.get(key).push(...recs);
  }

  // Optional: reduce wages records into a single “best” record
  // (use first non-null, but you can customize later)
  const pickWageSummary = (records) => {
    const recs = safeArray(records);
    if (recs.length === 0) return null;

    // pick first record that has any wage values
    const best =
      recs.find((r) => r && (r.A_MEAN || r.H_MEAN || r.A_MEDIAN || r.H_MEDIAN)) || recs[0];

    return best || null;
  };

  // ---------------------------------------------------------------------------
  // 5) Build your main job map + DWA reverse index (as you already do)
  // ---------------------------------------------------------------------------
  const jobs = new Map(); // jobTitle(canonical raw) -> full job object
  const dwaIndex = new Map(); // dwa text -> Set(jobTitle canonical)

  for (const rawTitle of rawAllTitles) {
    const canonical = canonicalFor(rawTitle);
    const key = normalizeTitle(rawTitle);

    const jobObj = {
      title: canonical,

      // existing fields
      description: descriptions?.[canonical] ?? null,
      dwas: safeArray(dwa?.[canonical]),
      contexts: safeObj(contextSkills?.[canonical]),
      techSkills: safeObj(techSkills?.[canonical]),
      tasks: safeArray(tasks?.[canonical]),

      // NEW fields
      categories: Array.from(jobToCategories.get(key) || []).sort(),

      wages: {
        records: safeArray(wagesIndex.get(key)), // keep all raw records
        summary: pickWageSummary(wagesIndex.get(key)), // convenient single object
      },
    };

    jobs.set(canonical, jobObj);

    // index DWAs → jobs
    for (const d of jobObj.dwas) {
      if (!dwaIndex.has(d)) dwaIndex.set(d, new Set());
      dwaIndex.get(d).add(canonical);
    }
  }

  // ---------------------------------------------------------------------------
  // 6) Return bundle (add helpful indexes for UI lookup)
  // ---------------------------------------------------------------------------
  return {
    jobs, // Map(jobTitle → full job profile)
    dwaIndex, // Map(dwaText → Set(jobTitle))

    // helpers for dropdowns / UI
    allJobTitles: Array.from(jobs.keys()).sort((a, b) => a.localeCompare(b)),
    allDWAs: Array.from(dwaIndex.keys()).sort((a, b) => a.localeCompare(b)),

    // debug/diagnostics
    _indexes: {
      normToRaw, // normalized title -> Set(variants)
    },
  };
}
