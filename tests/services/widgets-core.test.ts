import { describe, it, expect } from "vitest";
import { widgetCreateDoc, widgetOut } from "@server/schemas/widgets";
import { selectWidgetRoles } from "@server/services/widget-roles";
import type { PositionOut } from "@server/schemas/positions";

function role(
  title: string,
  opts: { department?: string | null; location?: string | null; employment_type?: string } = {},
): PositionOut {
  return {
    id: title,
    title,
    department: opts.department ?? null,
    location: opts.location ?? null,
    employment_type: opts.employment_type ?? "full_time",
    description: null,
    requirements: null,
    status: "open",
    process_template_id: null,
    created_by: null,
    date_created: null,
    last_updated: null,
  };
}

describe("widget schema defaults", () => {
  it("matches the reference design when created with just a name", () => {
    const doc = widgetCreateDoc({ name: "Careers page" }, "admin-1");
    expect(doc.layout).toBe("list");
    expect(doc.status).toBe("active");
    expect(doc.theme.mode).toBe("dark");
    expect(doc.theme.accent).toBe("#ffffff");
    expect(doc.theme.radius).toBe(14);
    expect(doc.content.heading).toBe("Featured roles");
    expect(doc.content.cta_label).toBe("Apply now");
    expect(doc.content.show_view_all).toBe(true);
    expect(doc.content.view_all_label).toBe("View open roles");
    expect(doc.content.fields.department).toBe(true);
    expect(doc.content.fields.employment_type).toBe(false);
    expect(doc.filters.departments).toEqual([]);
    expect(doc.filters.max_roles).toBe(10);
    expect(doc.behavior.open_in_new_tab).toBe(true);
    expect(doc.created_by).toBe("admin-1");
    expect(typeof doc.date_created).toBe("number");
  });

  it("merges a partial config over the defaults", () => {
    const doc = widgetCreateDoc(
      { name: "Dark grid", layout: "grid", theme: { accent: "#ff0000" }, filters: { max_roles: 3 } },
      "admin-2",
    );
    expect(doc.layout).toBe("grid");
    expect(doc.theme.accent).toBe("#ff0000");
    expect(doc.theme.mode).toBe("dark"); // default preserved
    expect(doc.filters.max_roles).toBe(3);
    expect(doc.content.heading).toBe("Featured roles"); // untouched default
  });

  it("widgetOut maps _id to id", () => {
    const out = widgetOut({ _id: "abc", name: "W", status: "active", layout: "list" });
    expect(out.id).toBe("abc");
  });
});

describe("selectWidgetRoles (pure)", () => {
  it("returns all when there are no filters (max_roles 0 = unlimited)", () => {
    const out = selectWidgetRoles([role("A"), role("B")], { departments: [], locations: [], employment_types: [], max_roles: 0 });
    expect(out.map((r) => r.title)).toEqual(["A", "B"]);
  });

  it("filters by department", () => {
    const out = selectWidgetRoles(
      [role("A", { department: "Eng" }), role("B", { department: "Design" })],
      { departments: ["Eng"], locations: [], employment_types: [], max_roles: 0 },
    );
    expect(out.map((r) => r.title)).toEqual(["A"]);
  });

  it("combines location + employment_type filters", () => {
    const out = selectWidgetRoles(
      [
        role("A", { location: "SF", employment_type: "full_time" }),
        role("B", { location: "SF", employment_type: "contract" }),
        role("C", { location: "NY", employment_type: "full_time" }),
      ],
      { departments: [], locations: ["SF"], employment_types: ["full_time"], max_roles: 0 },
    );
    expect(out.map((r) => r.title)).toEqual(["A"]);
  });

  it("applies max_roles after filtering", () => {
    const roles = Array.from({ length: 5 }, (_, i) => role(String(i)));
    const out = selectWidgetRoles(roles, { departments: [], locations: [], employment_types: [], max_roles: 3 });
    expect(out.map((r) => r.title)).toEqual(["0", "1", "2"]);
  });
});
