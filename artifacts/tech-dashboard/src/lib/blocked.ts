interface MaybeProject {
  blocked?: boolean | null;
  latestUpdate?: { blocked?: boolean | null } | null;
}

export function isProjectBlocked(project: MaybeProject): boolean {
  if (project.blocked === true) return true;
  return project.latestUpdate?.blocked === true;
}
