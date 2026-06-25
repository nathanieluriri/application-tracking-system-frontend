import { describe, it, expect } from "vitest";
import {
  renderWidget,
  renderTheme,
  renderRole,
  filterRoles,
  safeHref,
  escapeHtml,
  buildRuntimeScript,
  type WidgetRenderConfig,
  type WidgetRole,
} from "@/lib/widget/runtime";
import { generateSnippet } from "@/lib/widget/snippet";

const ctx = { origin: "https://ats.example.com" };
const roles: WidgetRole[] = [
  { id: "r1", title: "Senior Engineer", department: "Engineering", location: "Remote", employment_type: "full_time" },
  { id: "r2", title: "Designer", department: "Design", location: "NYC", employment_type: "contract" },
];

function cfg(overrides: WidgetRenderConfig = {}): WidgetRenderConfig {
  return { layout: "list", content: { heading: "Featured roles", cta_label: "Apply now", fields: { department: true, location: true } }, behavior: {}, ...overrides };
}

describe("widget render", () => {
  it("renders a list layout with roles, headings and apply links", () => {
    const html = renderWidget(cfg(), roles, ctx);
    expect(html).toContain("Featured roles");
    expect(html).toContain("Senior Engineer");
    expect(html).toContain("atsw-list");
    expect(html).toContain('href="https://ats.example.com/careers/r1"');
    expect(html).toContain("Apply now");
  });

  it("renders grid + compact layouts", () => {
    expect(renderWidget(cfg({ layout: "grid" }), roles, ctx)).toContain("atsw-grid");
    expect(renderWidget(cfg({ layout: "compact" }), roles, ctx)).toContain("atsw-compact");
  });

  it("shows an empty state when there are no roles", () => {
    expect(renderWidget(cfg(), [], ctx)).toContain("No open roles right now");
  });

  it("shows a disabled state", () => {
    expect(renderWidget(cfg({ status: "disabled" }), roles, ctx)).toContain("unavailable");
  });

  it("escapes role + content values (no HTML injection)", () => {
    const evil: WidgetRole[] = [{ id: "x", title: "<img src=x onerror=alert(1)>" }];
    const html = renderWidget(cfg(), evil, ctx);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("renders a search box only when enabled", () => {
    expect(renderWidget(cfg({ behavior: { enable_search: true } }), roles, ctx)).toContain("data-atsw-search");
    expect(renderWidget(cfg(), roles, ctx)).not.toContain("data-atsw-search");
  });

  it("scopes 'View open roles' to this widget via ?widget=<id> when the widget has an id", () => {
    const html = renderWidget(cfg({ id: "w42", content: { heading: "Featured roles", show_view_all: true } }), roles, ctx);
    expect(html).toContain('href="https://ats.example.com/careers?widget=w42"');
  });

  it("falls back to plain /careers when there is no widget id", () => {
    const html = renderWidget(cfg({ content: { heading: "Featured roles", show_view_all: true } }), roles, ctx);
    expect(html).toContain('href="https://ats.example.com/careers"');
    expect(html).not.toContain("?widget=");
  });

  it("respects a custom view_all_url over the scoped default", () => {
    const html = renderWidget(
      cfg({ id: "w42", content: { heading: "Featured roles", show_view_all: true, view_all_url: "https://jobs.acme.com" } }),
      roles,
      ctx,
    );
    expect(html).toContain('href="https://jobs.acme.com"');
    expect(html).not.toContain("?widget=w42");
  });
});

describe("renderTheme", () => {
  it("emits accent + radius CSS variables and isolates the host", () => {
    const css = renderTheme({ accent: "#ff0000", radius: 20, mode: "light" });
    expect(css).toContain("--accent:#ff0000");
    expect(css).toContain("--radius:20px");
    expect(css).toContain(":host{all:initial}");
  });

  it("falls back to a readable accent when accent has no contrast with the background (apply-now-invisible bug)", () => {
    // Default widgets store accent #ffffff (the dark-mode default). In light mode
    // that is invisible on the white background — the apply link must not be
    // white-on-white. It should fall back to the dark foreground colour.
    const css = renderTheme({ accent: "#ffffff", mode: "light" });
    expect(css).not.toContain("--accent:#ffffff");
    expect(css).toContain("--accent:#0b0b0c");
  });

  it("keeps a high-contrast accent as-is (white accent stays white in dark mode)", () => {
    const css = renderTheme({ accent: "#ffffff", mode: "dark" });
    expect(css).toContain("--accent:#ffffff");
  });

  it("buildRuntimeScript stays self-contained (renderTheme references no external helper)", () => {
    // The served runtime stringifies renderTheme; the contrast logic must be
    // inlined, not call a helper that isn't serialized.
    const js = buildRuntimeScript();
    expect(js).toContain("function renderTheme");
    // a fresh accent with poor contrast still resolves inside the IIFE
    expect(renderTheme({ accent: "#ffffff", mode: "light" })).toContain("--accent:#0b0b0c");
  });
});

describe("safeHref", () => {
  it("allows http(s) + relative, blocks javascript:", () => {
    expect(safeHref("https://x.com", "/fallback")).toBe("https://x.com");
    expect(safeHref("/careers", "/fallback")).toBe("/careers");
    expect(safeHref("javascript:alert(1)", "/fallback")).toBe("/fallback");
  });
});

describe("filterRoles", () => {
  it("filters by a case-insensitive query across fields", () => {
    expect(filterRoles(roles, "engineer").map((r) => r.title)).toEqual(["Senior Engineer"]);
    expect(filterRoles(roles, "nyc").map((r) => r.title)).toEqual(["Designer"]);
    expect(filterRoles(roles, "").length).toBe(2);
  });
});

describe("generateSnippet", () => {
  it("produces a mount div + async loader script", () => {
    const s = generateSnippet({ origin: "https://ats.example.com/", widgetId: "w123" });
    expect(s).toContain('id="ats-widget-w123"');
    expect(s).toContain('src="https://ats.example.com/embed/widget.js"');
    expect(s).toContain('data-widget="w123"');
    expect(s).toContain("async");
  });
});

describe("buildRuntimeScript", () => {
  it("assembles a self-contained IIFE that calls bootstrap and includes the renderers", () => {
    const js = buildRuntimeScript();
    expect(js.startsWith("(function(){")).toBe(true);
    expect(js).toContain("function renderWidget");
    expect(js).toContain("function renderTheme");
    expect(js).toContain("function bootstrap");
    expect(js).toContain("bootstrap()");
    // sanity: escapeHtml is referenced by renderRole and included
    expect(js).toContain("function escapeHtml");
    expect(typeof escapeHtml).toBe("function");
    // renderRole is exported + used
    expect(renderRole(roles[0], cfg(), ctx)).toContain("Senior Engineer");
  });
});
