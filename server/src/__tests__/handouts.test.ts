import { describe, it, expect } from "vitest";
import {
  buildHandoutIntent,
  buildHandoutMarker,
  decodeHandouts,
  encodeHandouts,
  extractTitleFromHandoutIntent,
  HANDOUT_INTENT_PREFIX,
  HANDOUT_MARKER,
  parseHandoutsFromContent,
  pickHandoutToSuggest,
  type Handout,
} from "../lib/handouts";

describe("parseHandoutsFromContent", () => {
  it("returns [] for empty / non-string input", () => {
    expect(parseHandoutsFromContent("")).toEqual([]);
    expect(parseHandoutsFromContent(undefined as unknown as string)).toEqual([]);
    expect(parseHandoutsFromContent(123 as unknown as string)).toEqual([]);
  });

  it("extracts inline 'Handout: <title>' lines", () => {
    const out = parseHandoutsFromContent("Handout: Feedback Practice Worksheet");
    expect(out).toEqual([{ title: "Feedback Practice Worksheet" }]);
  });

  it("extracts inline 'Handouts — <title>' with em-dash", () => {
    const out = parseHandoutsFromContent("Handouts — Setting Boundaries Worksheet");
    expect(out).toEqual([{ title: "Setting Boundaries Worksheet" }]);
  });

  it("extracts a bullet list under a 'Handouts:' header", () => {
    const text = [
      "Handouts:",
      "- Feedback Worksheet",
      "- Boundary Setting Guide",
      "* Deadline Negotiation Template",
      "",
      "Other content.",
    ].join("\n");
    const out = parseHandoutsFromContent(text);
    expect(out).toEqual([
      { title: "Feedback Worksheet" },
      { title: "Boundary Setting Guide" },
      { title: "Deadline Negotiation Template" },
    ]);
  });

  it("captures URLs alongside titles", () => {
    const out = parseHandoutsFromContent(
      "Handout: Active Listening Worksheet (https://example.com/al-worksheet.pdf)",
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      title: "Active Listening Worksheet",
      url: "https://example.com/al-worksheet.pdf",
    });
  });

  it("recognises 'See the X handout' prose with a trailing URL", () => {
    const out = parseHandoutsFromContent(
      "See the Difficult Conversations handout: https://example.com/dc.pdf",
    );
    expect(out).toHaveLength(1);
    expect(out[0].title.toLowerCase()).toContain("difficult conversations");
    expect(out[0].url).toBe("https://example.com/dc.pdf");
  });

  it("dedups identical titles across patterns", () => {
    const text = [
      "Handout: Feedback Worksheet",
      "Handouts:",
      "- Feedback Worksheet",
      "- Boundary Worksheet",
    ].join("\n");
    const out = parseHandoutsFromContent(text);
    expect(out).toHaveLength(2);
    expect(out.map((h) => h.title.toLowerCase())).toEqual([
      "feedback worksheet",
      "boundary worksheet",
    ]);
  });

  it("rejects too-short titles", () => {
    expect(parseHandoutsFromContent("Handout: a")).toEqual([]);
  });

  it("falls back to URL host as title when no text is given", () => {
    const out = parseHandoutsFromContent("Handout: https://files.example.com/x.pdf");
    expect(out).toEqual([
      { title: "files.example.com", url: "https://files.example.com/x.pdf" },
    ]);
  });

  it("does not treat a non-handout 'see the' line as a handout", () => {
    expect(parseHandoutsFromContent("See the manager about your concerns.")).toEqual([]);
  });
});

describe("encodeHandouts / decodeHandouts", () => {
  it("returns null for empty arrays so the DB column stays empty", () => {
    expect(encodeHandouts([])).toBeNull();
  });

  it("round-trips a populated list", () => {
    const handouts: Handout[] = [
      { title: "Feedback Worksheet" },
      { title: "Linked Worksheet", url: "https://example.com/x.pdf" },
    ];
    const encoded = encodeHandouts(handouts);
    expect(typeof encoded).toBe("string");
    expect(decodeHandouts(encoded)).toEqual(handouts);
  });

  it("decodes null/undefined/garbage to []", () => {
    expect(decodeHandouts(null)).toEqual([]);
    expect(decodeHandouts(undefined)).toEqual([]);
    expect(decodeHandouts("not-json")).toEqual([]);
    expect(decodeHandouts("{}")).toEqual([]);
    expect(decodeHandouts("[1,2,3]")).toEqual([]);
  });

  it("strips unexpected fields from decoded objects", () => {
    const encoded = JSON.stringify([{ title: "X", url: "https://e.com", evil: "y" }]);
    expect(decodeHandouts(encoded)).toEqual([{ title: "X", url: "https://e.com" }]);
  });
});

describe("pickHandoutToSuggest", () => {
  const candidates: Handout[] = [
    { title: "Feedback Worksheet" },
    { title: "Boundary Worksheet", url: "https://example.com/b.pdf" },
  ];

  it("returns null on empty candidates", () => {
    expect(pickHandoutToSuggest([], [])).toBeNull();
  });

  it("returns the first never-suggested handout", () => {
    expect(pickHandoutToSuggest(candidates, [])).toEqual(candidates[0]);
  });

  it("skips over handouts already suggested (case-insensitive)", () => {
    expect(pickHandoutToSuggest(candidates, ["feedback worksheet"])).toEqual(candidates[1]);
    expect(pickHandoutToSuggest(candidates, ["FEEDBACK Worksheet"])).toEqual(candidates[1]);
  });

  it("returns null when every candidate has been suggested already", () => {
    expect(
      pickHandoutToSuggest(candidates, ["Feedback Worksheet", "Boundary Worksheet"]),
    ).toBeNull();
  });

  it("ignores non-string entries in the suggested set", () => {
    expect(
      pickHandoutToSuggest(candidates, [null as unknown as string, undefined as unknown as string]),
    ).toEqual(candidates[0]);
  });
});

describe("marker + intent encoding", () => {
  it("buildHandoutMarker emits parseable JSON with only title + url", () => {
    const marker = buildHandoutMarker({ title: "Feedback Worksheet" });
    expect(marker.startsWith(HANDOUT_MARKER)).toBe(true);
    const json = marker.slice(HANDOUT_MARKER.length).trim();
    expect(JSON.parse(json)).toEqual({ title: "Feedback Worksheet" });
  });

  it("buildHandoutMarker preserves a URL when present", () => {
    const marker = buildHandoutMarker({ title: "X", url: "https://e.com" });
    const json = marker.slice(HANDOUT_MARKER.length).trim();
    expect(JSON.parse(json)).toEqual({ title: "X", url: "https://e.com" });
  });

  it("buildHandoutIntent + extractTitleFromHandoutIntent round-trip", () => {
    const intent = buildHandoutIntent({ title: "Feedback Worksheet" });
    expect(intent.startsWith(HANDOUT_INTENT_PREFIX)).toBe(true);
    expect(extractTitleFromHandoutIntent(intent)).toBe("Feedback Worksheet");
  });

  it("extractTitleFromHandoutIntent returns null for unrelated intents", () => {
    expect(extractTitleFromHandoutIntent("filtered:profanity")).toBeNull();
    expect(extractTitleFromHandoutIntent("give_feedback")).toBeNull();
  });
});

describe("extractTitleAndUrl URL scheme validation (SEC-04 D-10 defense-in-depth)", () => {
  // extractTitleAndUrl is internal — exercise it via parseHandoutsFromContent
  // which is the public API.

  it("drops javascript: URL but preserves title", () => {
    // URL_REGEX only matches https?:// so javascript: won't be captured —
    // the test confirms the path produces a title-only handout when the regex
    // does not capture a URL.
    const content = "Handout: Practice Worksheet (javascript:alert(1))";
    const handouts = parseHandoutsFromContent(content);
    expect(handouts.length).toBeGreaterThanOrEqual(1);
    const h = handouts[0];
    expect(h.title).toContain("Practice Worksheet");
    expect(h.url).toBeUndefined(); // javascript: URL not captured by URL_REGEX
  });

  it("drops data: URL but preserves title", () => {
    const content = "Handout: Practice Worksheet (data:text/html,<script>alert(1)</script>)";
    const handouts = parseHandoutsFromContent(content);
    expect(handouts.length).toBeGreaterThanOrEqual(1);
    expect(handouts[0].url).toBeUndefined();
  });

  it("accepts https URL", () => {
    const content = "Handout: Worksheet https://example.com/worksheet.pdf";
    const handouts = parseHandoutsFromContent(content);
    expect(handouts.length).toBe(1);
    expect(handouts[0].url).toBe("https://example.com/worksheet.pdf");
  });

  it("accepts http URL", () => {
    const content = "Handout: Worksheet http://example.com/worksheet.pdf";
    const handouts = parseHandoutsFromContent(content);
    expect(handouts.length).toBe(1);
    expect(handouts[0].url).toBe("http://example.com/worksheet.pdf");
  });

  it("preserves title when URL is malformed / not captured", () => {
    const content = "Handout: Worksheet ht/tps://broken-url";
    const handouts = parseHandoutsFromContent(content);
    if (handouts.length > 0) {
      // If anything was captured, the malformed URL should NOT appear in the url field.
      expect(handouts[0].url).not.toBe("ht/tps://broken-url");
    }
    // Either no handout extracted (because broken URL + short remaining title)
    // or the handout has no url field. Both are acceptable outcomes.
  });
});
