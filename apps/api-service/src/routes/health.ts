import { Router } from "express";
import { externalServices } from "../lib/service-client.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "api-gateway",
    version: "1.0.0",
  });
});

// Debug endpoint to check config (temporary)
router.get("/debug/config", (req, res) => {
  res.json({
    scraping: {
      url: externalServices.scraping.url,
      hasApiKey: !!externalServices.scraping.apiKey,
      apiKeyLength: externalServices.scraping.apiKey?.length || 0,
    },
    replyQualification: {
      url: externalServices.replyQualification.url,
      hasApiKey: !!externalServices.replyQualification.apiKey,
    },
  });
});

router.get("/", (req, res) => {
  res.json({
    name: "MCPFactory API",
    version: "1.0.0",
    docs: "https://docs.mcpfactory.org",
  });
});

export default router;
