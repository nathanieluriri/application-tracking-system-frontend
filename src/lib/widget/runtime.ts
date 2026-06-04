/**
 * Embeddable job-widget runtime.
 *
 * The render/theme/filter functions are PURE and self-contained (they reference
 * only each other + their arguments + standard globals), so they are:
 *   1. unit-testable in Node (vitest), and
 *   2. servable to browsers as a dependency-free IIFE built by stringifying the
 *      very same functions (`buildRuntimeScript`) — no bundler, no logic drift.
 *
 * Keep every function below self-contained: do NOT reference module-scope
 * imports/constants from inside them, or the stringified IIFE will break.
 */

export interface WidgetRole {
  id?: string | null;
  title: string;
  department?: string | null;
  location?: string | null;
  employment_type?: string | null;
}

export interface WidgetRenderConfig {
  id?: string | null;
  status?: string;
  layout?: "list" | "grid" | "compact";
  theme?: {
    mode?: "dark" | "light" | "auto";
    accent?: string;
    background?: string | null;
    radius?: number;
    font?: "system" | "inherit";
  };
  content?: {
    show_header?: boolean;
    heading?: string;
    subtitle?: string;
    cta_label?: string;
    show_view_all?: boolean;
    view_all_label?: string;
    view_all_url?: string | null;
    fields?: {
      department?: boolean;
      location?: boolean;
      employment_type?: boolean;
      posted_date?: boolean;
    };
  };
  behavior?: {
    enable_search?: boolean;
    enable_filters?: boolean;
    open_in_new_tab?: boolean;
  };
}

export interface RenderContext {
  /** Origin that hosts the careers pages, e.g. "https://ats.example.com". */
  origin: string;
}

// --- pure helpers (self-contained) ---

export function escapeHtml(value: unknown): string {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderTheme(theme: WidgetRenderConfig["theme"]): string {
  const t = theme || {};
  const accent = t.accent || "#ffffff";
  const radius = typeof t.radius === "number" ? t.radius : 14;
  const dark = t.mode !== "light";
  const bg = t.background || (dark ? "#0b0b0c" : "#ffffff");
  const fg = dark ? "#f4f4f5" : "#0b0b0c";
  const muted = dark ? "#a1a1aa" : "#52525b";
  const border = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
  const font =
    t.font === "inherit"
      ? "inherit"
      : "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  return (
    ":host{all:initial}" +
    ".atsw{--accent:" +
    accent +
    ";--radius:" +
    radius +
    "px;--bg:" +
    bg +
    ";--fg:" +
    fg +
    ";--muted:" +
    muted +
    ";--border:" +
    border +
    ";font-family:" +
    font +
    ";color:var(--fg);background:var(--bg);border-radius:var(--radius);padding:24px;box-sizing:border-box;line-height:1.5}" +
    ".atsw *{box-sizing:border-box}" +
    ".atsw-head{text-align:center;margin-bottom:20px}" +
    ".atsw-h{font-size:22px;font-weight:600;margin:0 0 6px}" +
    ".atsw-sub{color:var(--muted);font-size:14px;margin:0 auto;max-width:520px}" +
    ".atsw-pill{display:inline-block;margin-top:14px;padding:8px 16px;border:1px solid var(--border);border-radius:999px;color:var(--fg);text-decoration:none;font-size:13px}" +
    ".atsw-list{list-style:none;margin:0;padding:0}" +
    ".atsw-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 4px;border-top:1px solid var(--border)}" +
    ".atsw-row:last-child{border-bottom:1px solid var(--border)}" +
    ".atsw-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}" +
    ".atsw-card{border:1px solid var(--border);border-radius:calc(var(--radius) - 4px);padding:16px}" +
    ".atsw-compact .atsw-row{padding:8px 4px}" +
    ".atsw-title{font-weight:600;font-size:15px;margin:0}" +
    ".atsw-meta{color:var(--muted);font-size:13px;margin-top:2px}" +
    ".atsw-apply{color:var(--accent);text-decoration:none;font-size:13px;white-space:nowrap}" +
    ".atsw-apply:focus,.atsw-pill:focus{outline:2px solid var(--accent);outline-offset:2px}" +
    ".atsw-empty,.atsw-error{color:var(--muted);text-align:center;padding:24px 0;font-size:14px}" +
    ".atsw-search{width:100%;padding:10px 12px;margin-bottom:12px;border:1px solid var(--border);border-radius:calc(var(--radius) - 6px);background:transparent;color:var(--fg);font-size:14px}"
  );
}

/** Allow only http(s) or root-relative URLs; otherwise fall back (blocks javascript: etc). */
export function safeHref(url: unknown, fallback: string): string {
  const s = String(url == null ? "" : url).trim();
  if (/^https?:\/\//i.test(s) || /^\//.test(s)) return s;
  return fallback;
}

export function roleMeta(role: WidgetRole, fields: Record<string, boolean | undefined>): string {
  const parts: string[] = [];
  if (fields.department && role.department) parts.push(String(role.department));
  if (fields.location && role.location) parts.push(String(role.location));
  if (fields.employment_type && role.employment_type) {
    parts.push(String(role.employment_type).replace(/_/g, " "));
  }
  return parts.join(" · ");
}

export function renderRole(
  role: WidgetRole,
  config: WidgetRenderConfig,
  ctx: RenderContext,
): string {
  const content = config.content || {};
  const fields = content.fields || {};
  const behavior = config.behavior || {};
  const layout = config.layout || "list";
  const cta = content.cta_label || "Apply now";
  const target = behavior.open_in_new_tab === false ? "" : ' target="_blank" rel="noopener"';
  const href = ctx.origin + "/careers/" + encodeURIComponent(String(role.id || ""));
  const meta = roleMeta(role, fields);
  const titleBlock =
    '<div><p class="atsw-title">' +
    escapeHtml(role.title) +
    "</p>" +
    (meta ? '<p class="atsw-meta">' + escapeHtml(meta) + "</p>" : "") +
    "</div>";
  const apply =
    '<a class="atsw-apply" href="' + href + '"' + target + ">" + escapeHtml(cta) + " ↗</a>";
  if (layout === "grid") {
    return '<li class="atsw-card">' + titleBlock + '<div style="margin-top:10px">' + apply + "</div></li>";
  }
  return '<li class="atsw-row">' + titleBlock + apply + "</li>";
}

export function renderWidget(
  config: WidgetRenderConfig,
  roles: WidgetRole[],
  ctx: RenderContext,
): string {
  if (config && config.status === "disabled") {
    return '<div class="atsw"><p class="atsw-empty">This widget is currently unavailable.</p></div>';
  }
  const content = config.content || {};
  const behavior = config.behavior || {};
  const layout = config.layout || "list";
  const origin = ctx.origin;

  let head = "";
  if (content.show_header !== false) {
    const viewAllHref = safeHref(content.view_all_url, origin + "/careers");
    const target = behavior.open_in_new_tab === false ? "" : ' target="_blank" rel="noopener"';
    head =
      '<div class="atsw-head">' +
      '<h2 class="atsw-h">' +
      escapeHtml(content.heading || "Featured roles") +
      "</h2>" +
      (content.subtitle ? '<p class="atsw-sub">' + escapeHtml(content.subtitle) + "</p>" : "") +
      (content.show_view_all !== false
        ? '<a class="atsw-pill" href="' +
          escapeHtml(viewAllHref) +
          '"' +
          target +
          ">" +
          escapeHtml(content.view_all_label || "View open roles") +
          "</a>"
        : "") +
      "</div>";
  }

  const search = behavior.enable_search
    ? '<input class="atsw-search" type="search" placeholder="Search roles…" data-atsw-search>'
    : "";

  let body: string;
  if (!roles || roles.length === 0) {
    body = '<p class="atsw-empty">No open roles right now.</p>';
  } else {
    const items = roles.map((r) => renderRole(r, config, ctx)).join("");
    const listClass = layout === "grid" ? "atsw-grid" : "atsw-list";
    body = '<ul class="' + listClass + '" data-atsw-list>' + items + "</ul>";
  }

  const rootClass = "atsw" + (layout === "compact" ? " atsw-compact" : "");
  return '<div class="' + rootClass + '">' + head + search + body + "</div>";
}

export function filterRoles(roles: WidgetRole[], query: string): WidgetRole[] {
  const q = (query || "").trim().toLowerCase();
  if (!q) return roles;
  return roles.filter((r) => {
    const hay = [r.title, r.department, r.location, r.employment_type]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.indexOf(q) !== -1;
  });
}

// --- DOM bootstrap (browser-only; never invoked in Node tests) ---

export function bootstrap(): void {
  var doc: any = (globalThis as any).document;
  var fetchFn: any = (globalThis as any).fetch;
  if (!doc || !fetchFn) return;

  var scriptEl: any =
    doc.currentScript ||
    (function () {
      var s = doc.querySelectorAll("script[data-widget]");
      return s[s.length - 1];
    })();
  if (!scriptEl) return;
  var widgetId: string = scriptEl.getAttribute("data-widget");
  if (!widgetId) return;

  // Derive the ATS origin from this script's own src.
  var origin = "";
  try {
    origin = new URL(scriptEl.src).origin;
  } catch (e) {
    origin = "";
  }

  var mount: any =
    doc.getElementById("ats-widget-" + widgetId) ||
    (function () {
      var el = doc.createElement("div");
      if (scriptEl.parentNode) scriptEl.parentNode.insertBefore(el, scriptEl);
      return el;
    })();
  var shadow: any = mount.attachShadow ? mount.attachShadow({ mode: "open" }) : mount;
  var allRoles: any[] = [];
  var cfg: any = {};
  var ctx = { origin: origin };

  function paint(roles: any[]) {
    shadow.innerHTML =
      "<style>" + renderTheme(cfg.theme) + "</style>" + renderWidget(cfg, roles, ctx);
    var search = shadow.querySelector("[data-atsw-search]");
    if (search) {
      search.addEventListener("input", function (ev: any) {
        var list = shadow.querySelector("[data-atsw-list]");
        var filtered = filterRoles(allRoles, ev.target.value);
        if (list) {
          list.innerHTML = filtered
            .map(function (r: any) {
              return renderRole(r, cfg, ctx);
            })
            .join("");
        }
      });
    }
  }

  fetchFn(origin + "/api/public/widgets/" + encodeURIComponent(widgetId), { credentials: "omit" })
    .then(function (res: any) {
      return res.json();
    })
    .then(function (env: any) {
      var data = (env && env.data) || {};
      cfg = data.widget || {};
      allRoles = data.roles || [];
      paint(allRoles);
    })
    .catch(function () {
      shadow.innerHTML =
        "<style>" +
        renderTheme(cfg.theme) +
        '</style><div class="atsw"><p class="atsw-error">Unable to load roles.</p></div>';
    });
}

/**
 * Build the dependency-free IIFE served at /embed/widget.js, assembled from the
 * source of the pure functions above + the bootstrap. Because it stringifies
 * the real functions, the served runtime can never drift from what tests check.
 */
export function buildRuntimeScript(): string {
  const fns = [escapeHtml, safeHref, renderTheme, roleMeta, renderRole, renderWidget, filterRoles, bootstrap];
  const body = fns.map((f) => f.toString()).join("\n");
  // Reference the runtime name (survives prod minification; the functions
  // cross-reference each other by the same names in their stringified source).
  return "(function(){\n" + body + "\ntry{" + bootstrap.name + "()}catch(e){}\n})();";
}
