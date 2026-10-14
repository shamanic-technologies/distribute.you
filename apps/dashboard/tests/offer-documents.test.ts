import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OfferDocumentsResponseSchema, formatFileSize, offerDocumentRefusal, opensInBrowser } from "../src/lib/offer-documents";

const read = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8");

describe("offer documents", () => {
  it("parses the served list", () => {
    const parsed = OfferDocumentsResponseSchema.safeParse({
      documents: [
        {
          id: "d1",
          brandId: "b",
          offerId: "o",
          fileName: "Case study.pdf",
          description: "When they ask for proof",
          contentType: "application/pdf",
          sizeBytes: 120_000,
          sha256: "abc",
          createdAt: "2026-10-14T00:00:00Z",
          updatedAt: "2026-10-14T00:00:00Z",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("formats sizes in KB and MB", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(120_000)).toBe("117 KB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });

  it("says each refusal in plain words", () => {
    expect(offerDocumentRefusal(413, "file_too_large")).toContain("over 5 MB");
    expect(offerDocumentRefusal(413, null)).toContain("over 5 MB");
    expect(offerDocumentRefusal(400, "unsupported_type")).toContain("type of file");
    expect(offerDocumentRefusal(409, "too_many_documents")).toContain("25 files");
    expect(offerDocumentRefusal(500, null)).toBe("Not saved. Try again.");
  });

  it("lives on the offer page", () => {
    expect(read("components/v2/setup-pages.tsx")).toContain("<OfferDocuments brandId={brandId} offerId={offerId} />");
  });

  it("the proxy streams a multipart upload and keeps a file's name on the way back", () => {
    const route = read("app/(authed)/api/v1/[...path]/route.ts");
    expect(route).toContain("/^multipart\\/form-data/i.test(incomingType)");
    expect(route).toContain("req.body");
    expect(route).toContain('duplex: "half"');
    expect(route).toContain("Content-Disposition");
  });

  it("uploads as multipart without a JSON content type", () => {
    const api = read("lib/api.ts");
    expect(api).toContain("formData: form");
    expect(api).toContain('{ "Content-Type": "application/json", ...extraHeaders }');
  });

  it("opens in a tab only what a tab can show, downloads the rest under its own name", () => {
    expect(opensInBrowser("application/pdf")).toBe(true);
    expect(opensInBrowser("image/png")).toBe(true);
    expect(opensInBrowser("text/plain; charset=utf-8")).toBe(true);
    expect(opensInBrowser("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(false);
    expect(opensInBrowser("text/csv")).toBe(false);
    const src = read("components/v2/offer-documents.tsx");
    expect(src).toContain("if (!opensInBrowser(doc.contentType)) return download(doc);");
    expect(src).toContain("a.download = doc.fileName;");
  });
});
