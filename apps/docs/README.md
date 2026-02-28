# distribute Documentation

Public documentation for distribute - The DFY, BYOK MCP Platform.

Part of the [distribute.you](https://github.com/shamanic-technologies/distribute.you) monorepo.

## Development

```bash
# From monorepo root
pnpm dev:docs
```

Open [http://localhost:3000](http://localhost:3000).

## Structure

```
src/
├── app/
│   ├── page.tsx              # Home / Introduction
│   ├── quickstart/           # Quick start guide
│   ├── api/                  # API reference
│   ├── sales-outreach/       # Sales Outreach MCP docs
│   └── [mcp]/                # Other MCP docs
├── components/
│   ├── header.tsx            # Top navigation
│   └── sidebar.tsx           # Left sidebar navigation
└── content/                  # MDX content (optional)
```

## Deployment

Deploy to Vercel as `docs.distribute.you`.

## License

MIT
