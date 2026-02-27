import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "../src/schemas.js";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

const generator = new OpenApiGeneratorV3(registry.definitions);

const document = generator.generateDocument({
  openapi: "3.0.0",
  info: {
    title: "MCPFactory API Service",
    description:
      "API Gateway for MCPFactory. Handles authentication, proxies to internal services, and exposes the public REST API.",
    version: "1.0.0",
  },
  servers: [
    {
      url: process.env.SERVICE_URL || "https://api.mcpfactory.org",
    },
  ],
  tags: [
    { name: "Health", description: "Health check and debug endpoints" },
    { name: "Apps", description: "App registration" },
    { name: "Performance", description: "Public performance leaderboard" },
    { name: "User", description: "Current user information" },
    { name: "Campaigns", description: "Campaign management" },
    { name: "Keys", description: "BYOK key management" },
    { name: "API Keys", description: "API key management" },
    { name: "Leads", description: "Lead search" },
    { name: "Qualify", description: "Email reply qualification" },
    { name: "Brand", description: "Brand scraping and management" },
    { name: "Activity", description: "User activity tracking" },
    { name: "Chat", description: "AI chat with SSE streaming" },
    { name: "Billing", description: "Billing, credits, and checkout" },
  ],
});

const outputFile = join(projectRoot, "openapi.json");
fs.writeFileSync(outputFile, JSON.stringify(document, null, 2));
console.log("✅ api-service openapi.json generated");
