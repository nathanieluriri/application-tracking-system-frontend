# Job Widget — Phase 1: Backend `widgets` Resource — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `widgets` resource to the FastAPI backend — admin CRUD plus a public data endpoint that returns a widget's render config alongside its filtered open roles.

**Architecture:** Mirror the existing `positions` vertical exactly: `schemas/ → repositories/ → services/ → api/v1/`, registered in `main.py`. Role filtering/limiting is an extracted pure function so it can be unit-tested without a database (matching this repo's pure-unit test convention).

**Tech Stack:** FastAPI, Pydantic v2, Motor (async MongoDB), pytest.

**Spec:** `docs/superpowers/plans/../specs/2026-06-04-embeddable-job-widget-design.md` (§3 Backend).

**All paths below are relative to `application-tracking-system-backend/`.** Run commands from that directory.

---

### Task 1: Widget schema

**Files:**
- Create: `schemas/widget_schema.py`
- Test: `tests/test_widget_schema.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_widget_schema.py
from schemas.widget_schema import (
    WidgetBase,
    WidgetCreate,
    ThemeConfig,
    ContentConfig,
    FiltersConfig,
    BehaviorConfig,
)


def test_widget_defaults_match_reference_design():
    w = WidgetBase(name="Careers page")
    assert w.layout == "list"
    assert w.status == "active"
    assert w.theme.mode == "dark"
    assert w.theme.accent == "#ffffff"
    assert w.theme.radius == 14
    assert w.content.heading == "Featured roles"
    assert w.content.cta_label == "Apply now"
    assert w.content.show_view_all is True
    assert w.content.view_all_label == "View open roles"
    assert w.content.fields.department is True
    assert w.content.fields.employment_type is False
    assert w.filters.departments == []
    assert w.filters.max_roles == 10
    assert w.behavior.open_in_new_tab is True


def test_widget_create_stamps_timestamps_and_creator():
    w = WidgetCreate(name="X", created_by="admin-1")
    assert w.created_by == "admin-1"
    assert isinstance(w.date_created, int)
    assert isinstance(w.last_updated, int)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_widget_schema.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'schemas.widget_schema'`

- [ ] **Step 3: Write the schema**

```python
# schemas/widget_schema.py
import time
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

from schemas.imports import *  # ObjectId, etc. (mirrors position_schema.py)

LayoutStyle = Literal["list", "grid", "compact"]
ThemeMode = Literal["dark", "light", "auto"]
FontChoice = Literal["system", "inherit"]
WidgetStatus = Literal["active", "disabled"]
EmploymentType = Literal["full_time", "part_time", "contract", "internship", "temporary"]


class ThemeConfig(BaseModel):
    mode: ThemeMode = "dark"
    accent: str = "#ffffff"
    background: Optional[str] = None
    radius: int = 14
    font: FontChoice = "system"


class FieldsConfig(BaseModel):
    department: bool = True
    location: bool = True
    employment_type: bool = False
    posted_date: bool = False


class ContentConfig(BaseModel):
    show_header: bool = True
    heading: str = "Featured roles"
    subtitle: str = "We're always seeking talented individuals to join our team."
    cta_label: str = "Apply now"
    show_view_all: bool = True
    view_all_label: str = "View open roles"
    view_all_url: Optional[str] = None
    fields: FieldsConfig = Field(default_factory=FieldsConfig)


class FiltersConfig(BaseModel):
    departments: List[str] = Field(default_factory=list)
    locations: List[str] = Field(default_factory=list)
    employment_types: List[EmploymentType] = Field(default_factory=list)
    max_roles: int = 10  # 0 = unlimited


class BehaviorConfig(BaseModel):
    enable_search: bool = False
    enable_filters: bool = False
    open_in_new_tab: bool = True


class WidgetBase(BaseModel):
    name: str
    status: WidgetStatus = "active"
    layout: LayoutStyle = "list"
    theme: ThemeConfig = Field(default_factory=ThemeConfig)
    content: ContentConfig = Field(default_factory=ContentConfig)
    filters: FiltersConfig = Field(default_factory=FiltersConfig)
    behavior: BehaviorConfig = Field(default_factory=BehaviorConfig)


class WidgetCreate(WidgetBase):
    created_by: str
    date_created: int = Field(default_factory=lambda: int(time.time()))
    last_updated: int = Field(default_factory=lambda: int(time.time()))


class WidgetUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[WidgetStatus] = None
    layout: Optional[LayoutStyle] = None
    theme: Optional[ThemeConfig] = None
    content: Optional[ContentConfig] = None
    filters: Optional[FiltersConfig] = None
    behavior: Optional[BehaviorConfig] = None
    last_updated: int = Field(default_factory=lambda: int(time.time()))


class WidgetOut(WidgetBase):
    id: Optional[str] = Field(default=None, alias="_id")
    created_by: Optional[str] = None
    date_created: Optional[int] = None
    last_updated: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def convert_objectid(cls, values):
        if isinstance(values, dict) and "_id" in values and isinstance(values["_id"], ObjectId):
            values["_id"] = str(values["_id"])
        return values

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
```

> Note: confirm `schemas/imports.py` exports `ObjectId` (it does for `position_schema.py`). If `from schemas.imports import *` does not provide `ObjectId`, replace with `from bson import ObjectId`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_widget_schema.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add schemas/widget_schema.py tests/test_widget_schema.py
git commit -m "feat(widgets): add widget config schema"
```

---

### Task 2: Pure role-filtering function

**Files:**
- Create: `services/widget_service.py` (filtering function only in this task)
- Test: `tests/test_widget_filtering.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_widget_filtering.py
from schemas.position_schema import PositionOut
from schemas.widget_schema import FiltersConfig
from services.widget_service import select_widget_roles


def _role(title, department=None, location=None, employment_type="full_time"):
    return PositionOut(
        title=title,
        department=department,
        location=location,
        employment_type=employment_type,
        status="open",
    )


def test_no_filters_returns_all():
    roles = [_role("A"), _role("B")]
    out = select_widget_roles(roles, FiltersConfig(max_roles=0))
    assert [r.title for r in out] == ["A", "B"]


def test_department_filter():
    roles = [_role("A", department="Eng"), _role("B", department="Design")]
    out = select_widget_roles(roles, FiltersConfig(departments=["Eng"], max_roles=0))
    assert [r.title for r in out] == ["A"]


def test_location_and_type_filters_combine():
    roles = [
        _role("A", location="SF", employment_type="full_time"),
        _role("B", location="SF", employment_type="contract"),
        _role("C", location="NY", employment_type="full_time"),
    ]
    out = select_widget_roles(
        roles,
        FiltersConfig(locations=["SF"], employment_types=["full_time"], max_roles=0),
    )
    assert [r.title for r in out] == ["A"]


def test_max_roles_limits_after_filtering():
    roles = [_role(str(i)) for i in range(5)]
    out = select_widget_roles(roles, FiltersConfig(max_roles=3))
    assert [r.title for r in out] == ["0", "1", "2"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_widget_filtering.py -v`
Expected: FAIL — `ImportError: cannot import name 'select_widget_roles'`

- [ ] **Step 3: Write the filtering function**

```python
# services/widget_service.py
from typing import List

from schemas.position_schema import PositionOut
from schemas.widget_schema import FiltersConfig


def select_widget_roles(roles: List[PositionOut], filters: FiltersConfig) -> List[PositionOut]:
    """Pure: apply a widget's filters + max_roles to a list of open roles."""
    selected: List[PositionOut] = []
    for role in roles:
        if filters.departments and role.department not in filters.departments:
            continue
        if filters.locations and role.location not in filters.locations:
            continue
        if filters.employment_types and role.employment_type not in filters.employment_types:
            continue
        selected.append(role)
    if filters.max_roles and filters.max_roles > 0:
        selected = selected[: filters.max_roles]
    return selected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_widget_filtering.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add services/widget_service.py tests/test_widget_filtering.py
git commit -m "feat(widgets): add pure role-filtering function"
```

---

### Task 3: Repository (CRUD)

**Files:**
- Create: `repositories/widget_repo.py`

No DB-backed test (mirrors `positions` — this repo has no Mongo test harness). Implementation mirrors `repositories/position_repo.py`.

- [ ] **Step 1: Write the repository**

```python
# repositories/widget_repo.py
from typing import List, Optional

from fastapi import HTTPException, status
from pymongo import ReturnDocument

from core.database import db
from schemas.widget_schema import WidgetCreate, WidgetOut, WidgetUpdate


async def create_widget(widget_data: WidgetCreate) -> WidgetOut:
    payload = widget_data.model_dump()
    result = await db.widgets.insert_one(payload)
    stored = await db.widgets.find_one({"_id": result.inserted_id})
    return WidgetOut(**stored)


async def get_widget(filter_dict: dict) -> Optional[WidgetOut]:
    try:
        result = await db.widgets.find_one(filter_dict)
        if result is None:
            return None
        return WidgetOut(**result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while fetching widget: {str(e)}",
        )


async def get_widgets(filter_dict: dict = {}, start: int = 0, stop: int = 100) -> List[WidgetOut]:
    try:
        if filter_dict is None:
            filter_dict = {}
        cursor = db.widgets.find(filter_dict).skip(start).limit(stop - start)
        items: List[WidgetOut] = []
        async for doc in cursor:
            items.append(WidgetOut(**doc))
        return items
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while fetching widgets: {str(e)}",
        )


async def update_widget(filter_dict: dict, widget_data: WidgetUpdate) -> Optional[WidgetOut]:
    update_dict = {k: v for k, v in widget_data.model_dump().items() if v is not None}
    result = await db.widgets.find_one_and_update(
        filter_dict,
        {"$set": update_dict},
        return_document=ReturnDocument.AFTER,
    )
    if result is None:
        return None
    return WidgetOut(**result)


async def delete_widget(filter_dict: dict):
    return await db.widgets.delete_one(filter_dict)
```

- [ ] **Step 2: Verify it imports**

Run: `python -c "import repositories.widget_repo"`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add repositories/widget_repo.py
git commit -m "feat(widgets): add widget repository"
```

---

### Task 4: Service layer (CRUD + public data)

**Files:**
- Modify: `services/widget_service.py` (append to the file created in Task 2)

- [ ] **Step 1: Append the service functions**

Append below `select_widget_roles` in `services/widget_service.py`:

```python
from bson import ObjectId
from fastapi import HTTPException

from repositories.widget_repo import (
    create_widget,
    delete_widget,
    get_widget,
    get_widgets,
    update_widget,
)
from services.position_service import retrieve_open_positions
from schemas.widget_schema import WidgetCreate, WidgetOut, WidgetUpdate


async def add_widget(widget_data: WidgetCreate) -> WidgetOut:
    return await create_widget(widget_data)


async def retrieve_widgets(start: int = 0, stop: int = 100) -> list[WidgetOut]:
    return await get_widgets(filter_dict={}, start=start, stop=stop)


async def retrieve_widget_by_id(widget_id: str) -> WidgetOut:
    if not ObjectId.is_valid(widget_id):
        raise HTTPException(status_code=400, detail="Invalid widget ID format")
    result = await get_widget({"_id": ObjectId(widget_id)})
    if not result:
        raise HTTPException(status_code=404, detail="Widget not found")
    return result


async def update_widget_by_id(widget_id: str, widget_data: WidgetUpdate) -> WidgetOut:
    if not ObjectId.is_valid(widget_id):
        raise HTTPException(status_code=400, detail="Invalid widget ID format")
    result = await update_widget({"_id": ObjectId(widget_id)}, widget_data)
    if not result:
        raise HTTPException(status_code=404, detail="Widget not found or update failed")
    return result


async def remove_widget(widget_id: str):
    if not ObjectId.is_valid(widget_id):
        raise HTTPException(status_code=400, detail="Invalid widget ID format")
    result = await delete_widget({"_id": ObjectId(widget_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Widget not found")
    return {"deleted": True}


async def duplicate_widget(widget_id: str, created_by: str) -> WidgetOut:
    original = await retrieve_widget_by_id(widget_id)
    base = original.model_dump(exclude={"id", "created_by", "date_created", "last_updated"})
    base["name"] = f"{original.name} (copy)"
    return await create_widget(WidgetCreate(created_by=created_by, **base))


async def retrieve_widget_public_data(widget_id: str) -> dict:
    """Public render payload: widget config + filtered open roles.

    Missing widget -> 404. Disabled widget -> minimal flag + empty roles
    (renderer shows a graceful empty state, never an error).
    """
    widget = await retrieve_widget_by_id(widget_id)
    if widget.status == "disabled":
        return {"widget": {"status": "disabled"}, "roles": []}

    open_roles = await retrieve_open_positions(start=0, stop=1000)
    roles = select_widget_roles(open_roles, widget.filters)
    render = widget.model_dump(
        include={"id", "name", "status", "layout", "theme", "content", "behavior"},
        by_alias=False,
    )
    return {"widget": render, "roles": roles}
```

- [ ] **Step 2: Verify it imports**

Run: `python -c "import services.widget_service"`
Expected: no output, exit 0.

- [ ] **Step 3: Re-run the filtering tests (no regression)**

Run: `python -m pytest tests/test_widget_filtering.py -v`
Expected: PASS (4 passed)

- [ ] **Step 4: Commit**

```bash
git add services/widget_service.py
git commit -m "feat(widgets): add widget service (CRUD + public data)"
```

---

### Task 5: Route layer

**Files:**
- Create: `api/v1/widget_route.py`

- [ ] **Step 1: Write the route**

```python
# api/v1/widget_route.py
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from core.response_envelope import document_response
from schemas.admin_schema import AdminOut
from schemas.widget_schema import WidgetBase, WidgetCreate, WidgetUpdate
from security.account_status_check import check_admin_account_status_and_permissions
from services.widget_service import (
    add_widget,
    duplicate_widget,
    remove_widget,
    retrieve_widget_by_id,
    retrieve_widget_public_data,
    retrieve_widgets,
    update_widget_by_id,
)

router = APIRouter(prefix="/widgets", tags=["Widgets"])


@router.get("/", dependencies=[Depends(check_admin_account_status_and_permissions)])
@document_response(message="Widgets fetched successfully", success_example=[])
async def list_widgets(
    start: Annotated[int, Query(ge=0)] = 0,
    stop: Annotated[int, Query(gt=0)] = 100,
):
    return await retrieve_widgets(start=start, stop=stop)


@router.post("/")
@document_response(message="Widget created successfully", status_code=status.HTTP_201_CREATED)
async def create_new_widget(
    widget_data: WidgetBase,
    admin: AdminOut = Depends(check_admin_account_status_and_permissions),
):
    new_widget = WidgetCreate(created_by=admin.id, **widget_data.model_dump())  # type: ignore
    return await add_widget(widget_data=new_widget)


@router.get("/{widget_id}/data")
@document_response(message="Widget data fetched successfully")
async def get_widget_public_data(widget_id: str):
    return await retrieve_widget_public_data(widget_id=widget_id)


@router.get("/{widget_id}", dependencies=[Depends(check_admin_account_status_and_permissions)])
@document_response(message="Widget fetched successfully")
async def get_widget_by_id(widget_id: str):
    return await retrieve_widget_by_id(widget_id=widget_id)


@router.patch("/{widget_id}", dependencies=[Depends(check_admin_account_status_and_permissions)])
@document_response(message="Widget updated successfully")
async def update_widget_endpoint(widget_id: str, widget_data: WidgetUpdate):
    return await update_widget_by_id(widget_id=widget_id, widget_data=widget_data)


@router.post("/{widget_id}/duplicate")
@document_response(message="Widget duplicated successfully", status_code=status.HTTP_201_CREATED)
async def duplicate_widget_endpoint(
    widget_id: str,
    admin: AdminOut = Depends(check_admin_account_status_and_permissions),
):
    return await duplicate_widget(widget_id=widget_id, created_by=admin.id)  # type: ignore


@router.delete("/{widget_id}", dependencies=[Depends(check_admin_account_status_and_permissions)])
@document_response(message="Widget deleted successfully")
async def delete_widget_endpoint(widget_id: str):
    return await remove_widget(widget_id=widget_id)
```

> Route ORDER matters: `/{widget_id}/data` is declared **before** `/{widget_id}` so the public data route is matched first and is the only one without the auth dependency.

- [ ] **Step 2: Verify it imports**

Run: `python -c "import api.v1.widget_route"`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/v1/widget_route.py
git commit -m "feat(widgets): add widget API routes"
```

---

### Task 6: Register the router

**Files:**
- Modify: `main.py` (import block ~line 308 and include block ~line 321, next to positions)

- [ ] **Step 1: Add the import**

After the line `from api.v1.position_route import router as v1_position_route_router` add:

```python
from api.v1.widget_route import router as v1_widget_route_router
```

- [ ] **Step 2: Include the router**

After the line `app.include_router(v1_position_route_router, prefix='/v1')` add:

```python
app.include_router(v1_widget_route_router, prefix='/v1')
```

- [ ] **Step 3: Verify the app boots**

Run: `python -c "import main; print('ok')"`
Expected: prints `ok` with no import errors.

- [ ] **Step 4: Commit**

```bash
git add main.py
git commit -m "feat(widgets): register widget router"
```

---

### Task 7: Smoke test the running API

**Files:** none (manual verification)

- [ ] **Step 1: Start the API**

Run (per backend readme / existing dev flow, e.g.): `uvicorn main:app --reload --port 8000`
Expected: server boots; no errors mentioning `widgets`.

- [ ] **Step 2: Confirm routes are registered**

Open `http://localhost:8000/docs` (or `/openapi.json`) and confirm a **Widgets** tag with `GET/POST /v1/widgets/`, `GET/PATCH/DELETE /v1/widgets/{id}`, `POST /v1/widgets/{id}/duplicate`, and `GET /v1/widgets/{id}/data`.

- [ ] **Step 3: Confirm the public data route needs no auth**

Run: `curl -i http://localhost:8000/v1/widgets/000000000000000000000000/data`
Expected: a JSON envelope with status 404 ("Widget not found") — **not** a 401/403. This proves the public route bypasses the admin dependency.

- [ ] **Step 4: Full backend test run (no regressions)**

Run: `python -m pytest -q`
Expected: all tests pass, including the new `test_widget_schema.py` (2) and `test_widget_filtering.py` (4).

---

## Self-Review

**Spec coverage (§3):** schema (Task 1) ✓; filtering+limit authoritative server-side (Task 2 + Task 4 `retrieve_widget_public_data`) ✓; admin CRUD endpoints (Task 5) ✓; `duplicate` (Tasks 4–5) ✓; public `/{id}/data` with active/disabled/404 behavior (Task 4 logic + Task 7 verification) ✓; router registration (Task 6) ✓. The Next BFF public proxy, embed runtime, careers pages, and builder UI are **Phases 2–4** (separate plans), not this plan.

**Placeholder scan:** none — every code step contains complete code; the only "confirm" note (schemas/imports ObjectId) includes the exact fallback.

**Type consistency:** `select_widget_roles(roles, filters)` signature is identical in Task 2 (def), its test, and Task 4 (call site). `WidgetCreate`/`WidgetUpdate`/`WidgetOut`/`FiltersConfig` names are consistent across schema, repo, service, and route. `retrieve_widget_public_data` returns `{"widget", "roles"}` — the shape Phase 2's BFF proxy will pass through unchanged.
