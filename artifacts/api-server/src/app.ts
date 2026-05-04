import fs from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
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

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

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

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerkKeyLooksReal =
  !!clerkSecretKey &&
  /^sk_(test|live)_/.test(clerkSecretKey) &&
  !clerkSecretKey.includes("replace_me");
if (clerkKeyLooksReal) {
  app.use(clerkMiddleware());
} else {
  logger.warn("Clerk middleware disabled — CLERK_SECRET_KEY is missing or a placeholder.");
}

app.use(healthRouter);
app.use("/api", router);

// Project attachments. In dev, served from the host-mounted repo at
// `/app/data/attachments/`; in prod, the Dockerfile copies the directory in
// at the same path. Mounted at both `/attachments` and
// `/tech-dashboard/attachments` for parity with the dashboard's path-prefix
// behaviour.
const attachmentsDir = path.resolve("/app/data/attachments");
if (fs.existsSync(attachmentsDir)) {
  app.use("/attachments", express.static(attachmentsDir));
  app.use("/tech-dashboard/attachments", express.static(attachmentsDir));
}

// In production the api also serves the built Vite dashboard from ./public
// (copied in by the Dockerfile's production stage). In development the dev
// server runs separately under Vite, so this block is skipped.
//
// `window.__APP_CONFIG__` is injected into index.html before the dashboard
// scripts run, so per-environment config (Clerk publishable key, passcode,
// etc.) lives in Doppler-managed env vars on the running pod and the same
// image artifact promotes through preprod and production unchanged.
if (process.env.NODE_ENV === "production") {
  const dashboardDist = path.resolve(__dirname, "../public");
  const indexHtmlTemplate = fs.readFileSync(
    path.join(dashboardDist, "index.html"),
    "utf8",
  );

  const renderedIndexHtml = indexHtmlTemplate.replace(
    "</head>",
    `<script>window.__APP_CONFIG__=${JSON.stringify({
      clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY ?? "",
      clerkProxyUrl: process.env.CLERK_PROXY_URL ?? "",
      sitePasscode: process.env.TD_SITE_PASSCODE ?? "",
      resendConfigured: Boolean(process.env.RESEND_API_KEY),
    })}</script></head>`,
  );

  // Serve dashboard assets at BOTH the root and the path-prefix the Vite build
  // baked in. This way the app works whether or not Traefik's StripPrefix
  // middleware is active in front of us, and direct pod access also works.
  app.use(express.static(dashboardDist, { index: false }));
  app.use("/tech-dashboard", express.static(dashboardDist, { index: false }));

  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/api")) return next();
    // Anything that looks like a static asset (has a non-html file extension)
    // should 404 cleanly rather than be replaced with HTML — otherwise the
    // browser tries to execute index.html as JS/CSS and the page silently
    // breaks.
    if (/\.[a-zA-Z0-9]+$/.test(req.path) && !req.path.endsWith(".html")) {
      return next();
    }
    res.type("html").send(renderedIndexHtml);
  });
}

export default app;
