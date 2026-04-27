// Returns a Postgres connection string. Prefers DATABASE_URL when set; otherwise
// constructs one from individual POSTGRES_HOST / POSTGRES_USER / POSTGRES_PASSWORD
// (the three vars Doppler injects into the running pod), defaulting POSTGRES_PORT
// to 5432 and POSTGRES_DB to POSTGRES_USER (matching the official postgres image
// behaviour where a user-named database is created if POSTGRES_DB is unset).
export function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const host = process.env.POSTGRES_HOST;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const port = process.env.POSTGRES_PORT ?? "5432";
  const database =
    process.env.POSTGRES_DB ?? process.env.POSTGRES_DATABASE ?? user;

  if (!host || !user || !password || !database) {
    throw new Error(
      "Database connection not configured. Set DATABASE_URL, " +
        "or at least POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD.",
    );
  }

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}
