# Drizzle Migrations Skill

## When to Use
Use this skill when you need to create database migrations for any service in distribute that uses Drizzle ORM.

## Migration Process

### 1. Update Schema
Edit the schema file in `apps/{service}/src/db/schema.ts`

### 2. Create Migration SQL
Create a new migration file in `apps/{service}/drizzle/`:
- Name format: `XXXX_description.sql` (increment from last migration)
- Use `--> statement-breakpoint` between SQL statements
- Example:
```sql
ALTER TABLE "campaigns" ADD COLUMN "brand_url" text;

--> statement-breakpoint

UPDATE "campaigns" SET "brand_url" = 'default' WHERE "brand_url" IS NULL;
```

### 3. Update Journal
Add entry to `apps/{service}/drizzle/meta/_journal.json`:
```json
{
  "idx": N,
  "version": "7",
  "when": TIMESTAMP,
  "tag": "XXXX_description",
  "breakpoints": true
}
```

### 4. Run Migration
Run migration directly - no need to ask permission:
```bash
cd apps/{service} && pnpm db:migrate
```

### 5. Verify with Neon MCP
After migration, verify with Neon MCP:
```
run_sql: SELECT column_name FROM information_schema.columns WHERE table_name = 'your_table'
```

## Important Rules

- **Never edit migrated files** - Create new migration instead
- **Never use CASCADE DROP** without explicit discussion
- **Never migrate down** - Create corrective migration instead
- **Always add `--> statement-breakpoint`** between SQL statements
- **Run migrations directly** - Don't ask for permission
- **Verify after migration** - Use Neon MCP to confirm changes

## Service Database URLs

Each service has its own Neon database. Check `.env` or `drizzle.config.ts` for the correct `DATABASE_URL` env var name:
- campaign-service: `CAMPAIGN_SERVICE_DATABASE_URL`
- brand-service: `BRAND_SERVICE_DATABASE_URL`
- apollo-service: `APOLLO_SERVICE_DATABASE_URL`
- etc.

## Common Patterns

### Add nullable column
```sql
ALTER TABLE "table" ADD COLUMN "new_col" text;
```

### Add column with default
```sql
ALTER TABLE "table" ADD COLUMN "new_col" text DEFAULT 'value';
```

### Populate from related table
```sql
UPDATE "target" t SET "col" = s."col" FROM "source" s WHERE t."fk" = s."id";
```

### Change FK behavior
```sql
ALTER TABLE "table" DROP CONSTRAINT IF EXISTS "fk_name";
--> statement-breakpoint
ALTER TABLE "table" ADD CONSTRAINT "fk_name" FOREIGN KEY ("col") REFERENCES "other"("id") ON DELETE SET NULL;
```
