import { STATUS_LABELS } from "@/lib/constants";

interface MaybeProject {
  title?: string | null;
  description?: string | null;
  team?: string | null;
  impact?: string | null;
  status?: string | null;
  sprintName?: string | null;
  goals?: { name?: string | null }[] | null;
  latestUpdate?: { content?: string | null; authorName?: string | null } | null;
}

export function matchesSearch(project: MaybeProject, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  const haystack: (string | null | undefined)[] = [
    project.title,
    project.description,
    project.team,
    project.impact,
    project.sprintName,
    project.latestUpdate?.content,
    project.latestUpdate?.authorName,
    project.status ? STATUS_LABELS[project.status as keyof typeof STATUS_LABELS] : null,
  ];

  for (const goal of project.goals ?? []) {
    haystack.push(goal?.name);
  }

  for (const value of haystack) {
    if (value && value.toLowerCase().includes(query)) return true;
  }
  return false;
}
