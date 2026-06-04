import type { FiltersConfig } from "@server/schemas/widgets";
import type { PositionOut } from "@server/schemas/positions";

/**
 * Pure: apply a widget's filters + max_roles to a list of open roles.
 * Mirrors `select_widget_roles` in the FastAPI widget service. Kept dependency-
 * free so it is unit-testable without a database.
 */
export function selectWidgetRoles(roles: PositionOut[], filters: FiltersConfig): PositionOut[] {
  let selected = roles.filter((role) => {
    if (filters.departments.length && !filters.departments.includes(role.department ?? "")) {
      return false;
    }
    if (filters.locations.length && !filters.locations.includes(role.location ?? "")) {
      return false;
    }
    if (
      filters.employment_types.length &&
      !filters.employment_types.includes(role.employment_type)
    ) {
      return false;
    }
    return true;
  });
  if (filters.max_roles && filters.max_roles > 0) {
    selected = selected.slice(0, filters.max_roles);
  }
  return selected;
}
