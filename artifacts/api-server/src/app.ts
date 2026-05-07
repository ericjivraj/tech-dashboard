import fs from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import healthRouter from "./routes/health";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(healthRouter);
app.use("/api", router);

// In production the api also serves the built Vite dashboard from ./public
// (copied in by the Dockerfile's production stage). In development the dev
// server runs separately under Vite, so this block is skipped.
//
// `window.__APP_CONFIG__` is injected into index.html before the dashboard
// scripts run, so per-environment config lives in Doppler-managed env vars
// on the running pod and the same image artifact promotes through preprod
// and production unchanged.
if (process.env.NODE_ENV === "production") {
  const dashboardDist = path.resolve(__dirname, "../public");
  const indexHtmlTemplate = fs.readFileSync(
    path.join(dashboardDist, "index.html"),
    "utf8",
  );

  const renderedIndexHtml = indexHtmlTemplate.replace(
    "</head>",
    `<script>window.__APP_CONFIG__=${JSON.stringify({
      sitePasscode: process.env.TD_SITE_PASSCODE ?? "",
    })}</script></head>`,
  );

  app.use(express.static(dashboardDist, { index: false }));
  app.use("/tech-dashboard", express.static(dashboardDist, { index: false }));

  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/api")) return next();
    if (/\.[a-zA-Z0-9]+$/.test(req.path) && !req.path.endsWith(".html")) {
      return next();
    }
    res.type("html").send(renderedIndexHtml);
  });
}

export default app;
