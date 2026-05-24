import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Section } from "@/components/section";

describe("Section component — width tiers", () => {
  it("variant='prose' wraps children in max-w-3xl", () => {
    const html = renderToStaticMarkup(
      createElement(Section, { variant: "prose" }, "hi")
    );
    expect(html).toContain("max-w-3xl");
    expect(html).not.toContain("max-w-5xl");
    expect(html).not.toContain("max-w-7xl");
  });

  it("variant='content' wraps children in max-w-5xl", () => {
    const html = renderToStaticMarkup(
      createElement(Section, { variant: "content" }, "hi")
    );
    expect(html).toContain("max-w-5xl");
  });

  it("variant='wide' wraps children in max-w-7xl", () => {
    const html = renderToStaticMarkup(
      createElement(Section, { variant: "wide" }, "hi")
    );
    expect(html).toContain("max-w-7xl");
  });

  it("default variant is 'content' (max-w-5xl)", () => {
    const html = renderToStaticMarkup(createElement(Section, {}, "hi"));
    expect(html).toContain("max-w-5xl");
  });

  it("applies standard horizontal padding px-4 sm:px-6 lg:px-8", () => {
    const html = renderToStaticMarkup(createElement(Section, {}, "hi"));
    expect(html).toContain("px-4");
    expect(html).toContain("sm:px-6");
    expect(html).toContain("lg:px-8");
  });

  it("renders <section> tag by default", () => {
    const html = renderToStaticMarkup(createElement(Section, {}, "hi"));
    expect(html.startsWith("<section")).toBe(true);
  });

  it("respects custom `as` prop", () => {
    const html = renderToStaticMarkup(
      createElement(Section, { as: "div" }, "hi")
    );
    expect(html.startsWith("<div")).toBe(true);
  });

  it("merges outerClassName onto wrapper, className onto inner", () => {
    const html = renderToStaticMarkup(
      createElement(
        Section,
        { outerClassName: "bg-red-500 py-12", className: "text-center" },
        "hi"
      )
    );
    expect(html).toContain("bg-red-500");
    expect(html).toContain("py-12");
    expect(html).toContain("text-center");
  });
});
