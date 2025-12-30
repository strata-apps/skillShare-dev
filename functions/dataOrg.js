// functions/dataOrg.js

export async function loadAndOrganizeData() {
  const [
    dwa,
    contextSkills,
    techSkills,
    tasks,
    descriptions,
  ] = await Promise.all([
    fetch("./data/jobs_dwa.json").then(r => r.json()),
    fetch("./data/jobs_context_skills.json").then(r => r.json()),
    fetch("./data/jobs_tech_skills.json").then(r => r.json()),
    fetch("./data/jobs_tasks.json").then(r => r.json()),
    fetch("./data/jobs_descriptions.json").then(r => r.json()),
  ]);

  const jobs = new Map(); // jobTitle -> full job object
  const dwaIndex = new Map(); // dwa text -> Set(jobTitle)

  const jobTitles = new Set([
    ...Object.keys(dwa),
    ...Object.keys(contextSkills),
    ...Object.keys(techSkills),
    ...Object.keys(tasks),
    ...Object.keys(descriptions),
  ]);

  for (const job of jobTitles) {
    const jobObj = {
      title: job,
      description: descriptions[job] || null,
      dwas: (dwa[job] || []).filter(Boolean),
      contexts: contextSkills[job] || {},
      techSkills: techSkills[job] || {},
      tasks: tasks[job] || [],
    };

    jobs.set(job, jobObj);

    // index DWAs → jobs
    for (const d of jobObj.dwas) {
      if (!dwaIndex.has(d)) dwaIndex.set(d, new Set());
      dwaIndex.get(d).add(job);
    }
  }

  return {
    jobs,        // Map(jobTitle → full job profile)
    dwaIndex,    // Map(dwaText → Set(jobTitle))
    allDWAs: Array.from(dwaIndex.keys()).sort(),
  };
}
