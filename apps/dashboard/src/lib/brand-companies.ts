import { z } from "zod";

/**
 * The brand's companies, PAGED and SLIM (features-service `GET /brands/:brandId/companies` and
 * `/companies/:companyKey`, MON-PAGE-SPEED-2-1112). The Companies page, a Company page and the search
 * palette read these instead of the revenue body's `organizations[]` (7.1 MB on our own brand) and the
 * company lifecycle body (2.0 MB): a page of 60 rows is ~35 KB, so it fits the persisted cache and
 * paints at once. The rows are features-service's, field for field, each with its lifecycle rung;
 * sort, search, rung filter and paging are the producer's. Alias-free (real unit tests).
 */

const RungRefSchema = z.object({ key: z.string(), rank: z.number(), label: z.string() });

export const BrandCompanyRowSchema = z.object({
  organizationKey: z.string(),
  companyKey: z.string().nullable(),
  orgId: z.string().nullable(),
  orgName: z.string().nullable(),
  orgDomain: z.string().nullable(),
  topPerson: z.object({ firstName: z.string().nullable(), lastName: z.string().nullable(), photoUrl: z.string().nullable() }).nullable(),
  peopleCount: z.number(),
  tags: z.array(z.string()),
  expectedRevenueUsd: z.number(),
  mostAdvancedDate: z.string().nullable(),
  lifecycle: RungRefSchema.nullable(),
});
export type BrandCompanyRow = z.infer<typeof BrandCompanyRowSchema>;

const RungSchema = RungRefSchema.extend({ organizationCount: z.number() });
export type BrandCompanyRung = z.infer<typeof RungSchema>;

export const BrandCompaniesPageSchema = z.object({
  brandId: z.string(),
  sort: z.enum(["value", "touch", "name"]),
  q: z.string().nullable(),
  rung: z.string().nullable(),
  offset: z.number(),
  limit: z.number(),
  total: z.number(),
  organizationCount: z.number(),
  rungs: z.array(RungSchema),
  companies: z.array(BrandCompanyRowSchema),
});
export type BrandCompaniesPage = z.infer<typeof BrandCompaniesPageSchema>;

export const BrandCompanySchema = z.object({
  brandId: z.string(),
  company: BrandCompanyRowSchema,
  position: z.number(),
  previousKey: z.string().nullable(),
  nextKey: z.string().nullable(),
  organizationCount: z.number(),
  rungs: z.array(RungSchema),
});
export type BrandCompany = z.infer<typeof BrandCompanySchema>;

export type CompanySort = BrandCompaniesPage["sort"];

/** What a list read asks: the page's order, search and rung tab (null = every rung). */
export interface CompanyListQuery {
  sort: CompanySort;
  q: string | null;
  rung: string | null;
}

/** Rows per page: one screen and a half, as the page drew per step before (~35 KB). */
export const COMPANIES_PAGE_SIZE = 60;

/** The query string of one page (`pricing=net`: the row values are what the org pays, as every money read). */
export function companiesPageQuery(query: CompanyListQuery, offset: number, limit = COMPANIES_PAGE_SIZE): string {
  const params = new URLSearchParams({ pricing: "net", sort: query.sort, offset: String(offset), limit: String(limit) });
  if (query.q) params.set("q", query.q);
  if (query.rung) params.set("rung", query.rung);
  return params.toString();
}

export function parseBrandCompaniesPage(raw: unknown, label: string): BrandCompaniesPage {
  const parsed = BrandCompaniesPageSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${label}: brand companies response shape mismatch`, { issues: parsed.error.issues });
    throw new Error(`[dashboard] ${label}: invalid brand companies response shape`);
  }
  return parsed.data;
}

export function parseBrandCompany(raw: unknown, label: string): BrandCompany {
  const parsed = BrandCompanySchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${label}: brand company response shape mismatch`, { issues: parsed.error.issues });
    throw new Error(`[dashboard] ${label}: invalid brand company response shape`);
  }
  return parsed.data;
}

/** The next page's offset, or undefined once every matching row is loaded. */
export function nextCompaniesOffset(last: BrandCompaniesPage): number | undefined {
  const next = last.offset + last.companies.length;
  return last.companies.length > 0 && next < last.total ? next : undefined;
}
