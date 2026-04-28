// Returns a Postgres connection string. Prefers DATABASE_URL when set; otherwise
// constructs one from individual POSTGRES_HOST / POSTGRES_USER / POSTGRES_PASSWORD
// (the three vars Doppler injects into the running pod), defaulting POSTGRES_PORT
// to 5432 and POSTGRES_DB to POSTGRES_USER (matching the official postgres image
// behaviour where a user-named database is created if POSTGRES_DB is unset).
//
// Both branches validate the resulting URL with `new URL(...)` and throw a
// sanitised error (host/port/user/db visible, password never logged) when the
// URL is malformed — pg-connection-string redacts the offending value, so
// without this validation a misinjected env var produces an opaque
// `TypeError: Invalid URL` deep inside the driver.
export function resolveDatabaseUrl(): string {
  const explicit = process.env.DATABASE_URL;
  if (explicit) {
    validateOrThrow(explicit, "DATABASE_URL (set explicitly)");
    return explicit;
  }

  const host = process.env.POSTGRES_HOST;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const port = process.env.POSTGRES_PORT ?? "5432";
  const database =
    process.env.POSTGRES_DB ?? process.env.POSTGRES_DATABASE ?? user;

  if (!host || !user || !password || !database) {
    throw new Error(
      "Database connection not configured. Set DATABASE_URL, " +
        "or at least POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD. " +
        `(got POSTGRES_HOST=${describe(host)}, POSTGRES_USER=${describe(user)}, ` +
        `POSTGRES_PASSWORD=${password ? "(set)" : "(unset)"}, ` +
        `POSTGRES_DB=${describe(process.env.POSTGRES_DB ?? process.env.POSTGRES_DATABASE)}, ` +
        `defaulted_db=${describe(database)})`,
    );
  }

  const constructed = `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  validateOrThrow(constructed, `host=${host} port=${port} user=${user} db=${database}`);
  return constructed;
}

function describe(v: string | undefined | null): string {
  if (v == null) return "(unset)";
  if (v === "") return '""';
  return JSON.stringify(v);
}

function validateOrThrow(url: string, source: string): void {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch (err) {
    throw new Error(
      `Postgres connection URL is malformed [${source}]. ` +
        `Underlying URL parse error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
