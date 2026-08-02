import { describe, it, expect } from "vitest";
import { sanitizeEmailHtml } from "../src/lib/sanitize-email-html";

describe("sanitizeEmailHtml", () => {
  it("strips <script> tags entirely", () => {
    const dirty = `<p>hi</p><script>alert("xss")</script>`;
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/alert/);
  });

  it("strips <iframe> tags", () => {
    const dirty = `<p>hi</p><iframe src="https://evil.example"></iframe>`;
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).not.toMatch(/<iframe/i);
  });

  it("strips onclick / onload / onerror event handlers", () => {
    const dirty = `<a href="https://ok" onclick="alert(1)">link</a><img src="x" onerror="alert(2)" />`;
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).not.toMatch(/onclick/i);
    expect(clean).not.toMatch(/onerror/i);
    expect(clean).not.toMatch(/alert/);
  });

  it("strips javascript: URLs in href", () => {
    const dirty = `<a href="javascript:alert(1)">click</a>`;
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).not.toMatch(/javascript:/i);
  });

  it("preserves safe tags and inline styles", () => {
    const dirty = `<p style="color:red">hi</p><a href="https://example.com">link</a><img src="https://example.com/x.png" alt="x" />`;
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).toMatch(/<p[^>]*>hi<\/p>/);
    expect(clean).toMatch(/<a[^>]*href="https:\/\/example.com"[^>]*>link<\/a>/);
    expect(clean).toMatch(/<img[^>]*src="https:\/\/example.com\/x.png"/);
  });

  it("preserves table tags (common email layout)", () => {
    const dirty = `<table><tbody><tr><td>cell</td></tr></tbody></table>`;
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).toMatch(/<table>/);
    expect(clean).toMatch(/<tbody>/);
    expect(clean).toMatch(/<tr>/);
    expect(clean).toMatch(/<td>cell<\/td>/);
  });

  it("strips <form> and <input>", () => {
    const dirty = `<form action="https://evil.example"><input name="x" /></form>`;
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).not.toMatch(/<form/i);
    expect(clean).not.toMatch(/<input/i);
  });

  it("keeps the presentational table attributes email lays itself out with", () => {
    // Stripping these does not make the markup safer, it makes the rendering
    // wrong: our own investor update centres its 600px card with a single
    // align="center", so without it the preview shows a left-hugging column no
    // recipient will ever see.
    const dirty =
      `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f5f7">` +
      `<tr><td align="center" valign="top">card</td></tr></table>`;
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).toMatch(/align="center"/);
    expect(clean).toMatch(/valign="top"/);
    expect(clean).toMatch(/width="600"/);
    expect(clean).toMatch(/cellpadding="0"/);
    expect(clean).toMatch(/cellspacing="0"/);
    expect(clean).toMatch(/border="0"/);
    expect(clean).toMatch(/bgcolor="#f4f5f7"/);
    expect(clean).toMatch(/role="presentation"/);
  });

  it("allows mailto: and cid: URIs", () => {
    const dirty = `<a href="mailto:a@b.c">email</a><img src="cid:image001" />`;
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).toMatch(/href="mailto:a@b.c"/);
    expect(clean).toMatch(/src="cid:image001"/);
  });
});
