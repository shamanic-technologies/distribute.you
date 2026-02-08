// Sentry is loaded via --import flag in package.json start script
import * as Sentry from "@sentry/node";
import express from "express";
import cors from "cors";
import healthRoutes from "./routes/health.js";
import webhookRoutes from "./routes/webhooks.js";
import campaignsRoutes from "./routes/campaigns.js";
import keysRoutes from "./routes/keys.js";
import searchRoutes from "./routes/search.js";
import meRoutes from "./routes/me.js";
import qualifyRoutes from "./routes/qualify.js";
import brandRoutes from "./routes/brand.js";
import leadsRoutes from "./routes/leads.js";
import activityRoutes from "./routes/activity.js";
import performanceRoutes from "./routes/performance.js";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// CORS - allow dashboard and MCP clients
app.use(cors({
  origin: [
    "https://dashboard.mcpfactory.org",
    "https://mcpfactory.org",
    "http://localhost:3000",
    "http://localhost:3001",
    "https://performance.mcpfactory.org",
    "http://localhost:3007",
  ],
  credentials: true,
}));

app.use(express.json());

// OpenAPI spec endpoint
const openapiPath = join(__dirname, "..", "openapi.json");
app.get("/openapi.json", (_req, res) => {
  if (existsSync(openapiPath)) {
    const spec = JSON.parse(readFileSync(openapiPath, "utf-8"));
    res.json(spec);
  } else {
    res.status(404).json({ error: "OpenAPI spec not generated yet. Run: pnpm generate:openapi" });
  }
});

// Public routes
app.use(healthRoutes);
app.use(webhookRoutes);
app.use(performanceRoutes);

// Authenticated routes
app.use("/v1", meRoutes);
app.use("/v1", keysRoutes);
app.use("/v1", campaignsRoutes);
app.use("/v1", searchRoutes);
app.use("/v1", qualifyRoutes);
app.use("/v1", brandRoutes);
app.use("/v1", leadsRoutes);
app.use("/v1", activityRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Sentry error handler must be before any other error middleware
Sentry.setupExpressErrorHandler(app);

// Fallback error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Listen on :: for Railway private networking (IPv4 & IPv6 support)
app.listen(Number(PORT), "::", () => {
  console.log(`API Gateway running on port ${PORT}`);
});

export default app;
