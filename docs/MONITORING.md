# Monitoring Setup for MCP Factory

## Sentry (Error Tracking)

All services are configured with Sentry. One project, multiple services identified by tags.

### Setup Steps

1. Create account at https://sentry.io
2. Create a new project (Node.js)
3. Copy the DSN
4. Add `SENTRY_DSN` to Railway environment variables for each service

### Services with Sentry

| Service | Tag |
|---------|-----|
| dashboard | `service:dashboard` |

> **Note:** api-service and mcp-service have been extracted to their own repos. See [api-service](https://github.com/shamanic-technologies/api-service) and [mcp](https://github.com/shamanic-technologies/mcp).

### Filtering in Sentry

Use the search bar: `service:dashboard` to filter errors by service.

---

## Better Stack (Status Page)

Public status page at `status.distribute.you`.

### Setup Steps

1. Create account at https://betterstack.com
2. Go to Uptime → Monitors
3. Add each endpoint (see below)
4. Go to Status Pages → Create
5. Add custom domain: `status.distribute.you`
6. Add DNS CNAME record pointing to Better Stack

### Endpoints to Monitor

| Name | URL | Method | Expected Status |
|------|-----|--------|-----------------|
| Dashboard | `https://dashboard.distribute.you` | GET | 200 |
| Docs | `https://docs.distribute.you` | GET | 200 |
| Sales Landing | `https://salescoldemail.distribute.you` | GET | 200 |

### Custom Domain Setup

1. Add CNAME record in your DNS provider:
   - Name: `status`
   - Value: `statuspage.betterstack.com`
2. Enable SSL in Better Stack dashboard
3. Update `STATUS_PAGE_URL` in status indicator components if needed

---

## Integration: Sentry → Better Stack

To auto-create incidents from Sentry alerts:

1. In Sentry, go to Settings → Integrations
2. Search for "Webhook"
3. Add Better Stack incident webhook URL
4. Configure alert rules to trigger webhook on critical errors

---

## Quick Reference

| Tool | Purpose | URL |
|------|---------|-----|
| Sentry | Error tracking | https://sentry.io |
| Better Stack | Uptime + Status page | https://betterstack.com |
| Status Page | Public status | https://status.distribute.you |
