import { defineConfig } from "drizzle-kit";
import path from "path";
import { resolveDatabaseUrl } from "./src/url";

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
});
