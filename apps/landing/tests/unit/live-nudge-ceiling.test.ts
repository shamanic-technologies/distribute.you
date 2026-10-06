import { readFileSync } from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The homepage's live counters climb in-session, and the owner's rule (2026-10-06) is that
 * they never read MORE than the client really has. This runs the real `main.js` against a
 * fake DOM for ten simulated minutes and reads every figure it painted.
 */
const js = readFileSync(
  path.resolve(__dirname, "../../public/landing/v2/main.js"),
  "utf8"
);

type FakeEl = {
  textContent: string;
  painted: string[];
  attrs: Record<string, string>;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  classList: { add(): void; remove(): void };
  parentElement: { removeAttribute(): void; appendChild(): void };
};

function fakeEl(attrs: Record<string, string>, text: string): FakeEl {
  const el: FakeEl = {
    painted: [text],
    attrs: { ...attrs },
    get textContent() {
      return this.painted[this.painted.length - 1];
    },
    set textContent(v: string) {
      this.painted.push(v);
    },
    getAttribute(name) {
      return name in this.attrs ? this.attrs[name] : null;
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    classList: { add() {}, remove() {} },
    parentElement: { removeAttribute() {}, appendChild() {} },
  };
  return el;
}

function run(cardSteps: number[][], hotLeads: number) {
  const cards = cardSteps.map((steps) => {
    const cells = steps.map((n) => fakeEl({}, n.toLocaleString("en-US")));
    const card = fakeEl({ "data-steps": steps.join(",") }, "") as FakeEl & {
      cells: FakeEl[];
      querySelector(sel: string): FakeEl | null;
    };
    card.cells = cells;
    card.querySelector = (sel: string) => {
      const m = sel.match(/data-n="(\d+)"/);
      return m ? cells[Number(m[1])] ?? null : null;
    };
    return card;
  });
  const hot = fakeEl({ "data-n": String(hotLeads) }, hotLeads.toLocaleString("en-US"));
  const document = {
    hidden: false,
    querySelectorAll: (sel: string) => (sel === "[data-live]" ? cards : []),
    querySelector: (sel: string) => (sel === "[data-hot-leads]" ? hot : null),
    getElementById: () => null,
    createElement: () => ({ remove() {} }),
  };
  const window = {
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    scrollY: 0,
  };
  new Function("window", "document", js)(window, document);
  vi.advanceTimersByTime(10 * 60 * 1000);
  return { cards, hot };
}

const toNumber = (s: string) => Number(s.replace(/,/g, ""));

describe("the live nudge never passes the real figure", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("caps every card cell and the hot-lead count at the served figure, and lands on it", () => {
    vi.useFakeTimers();
    const real = [
      [12307, 20, 3, 0],
      [2157, 89],
      [2875, 4, 0, 0],
      [25, 1],
    ];
    const { cards, hot } = run(real, 142);
    cards.forEach((card, c) => {
      card.cells.forEach((cell, i) => {
        const painted = cell.painted.map(toNumber);
        expect(Math.max(...painted), `card ${c} step ${i}`).toBeLessThanOrEqual(real[c][i]);
        // Ten minutes is long enough for every counter to climb back to its real figure.
        expect(painted[painted.length - 1], `card ${c} step ${i}`).toBe(real[c][i]);
      });
    });
    const hotPainted = hot.painted.map(toNumber);
    expect(Math.max(...hotPainted)).toBeLessThanOrEqual(142);
    expect(hotPainted[hotPainted.length - 1]).toBe(142);
  });

  it("starts below the real figure so there is something to climb", () => {
    vi.useFakeTimers();
    const { cards, hot } = run([[2157, 89]], 142);
    // painted[0] is the server's figure, painted[1] the held-back start.
    expect(toNumber(cards[0].cells[0].painted[1])).toBe(2117);
    expect(toNumber(cards[0].cells[1].painted[1])).toBe(88);
    expect(toNumber(hot.painted[1])).toBe(139);
  });

  it("never moves a step nobody has reached", () => {
    vi.useFakeTimers();
    const { cards } = run([[2875, 4, 0, 0]], 0);
    expect(cards[0].cells[2].painted.map(toNumber).every((n) => n === 0)).toBe(true);
    expect(cards[0].cells[3].painted.map(toNumber).every((n) => n === 0)).toBe(true);
  });
});
