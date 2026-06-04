import "server-only";
import type { NextRequest } from "next/server";
import { forwardToFastAPI } from "./proxy";

type RouteContext = { params: Promise<{ path?: string[] }> };

export function makeCatchAllHandler(prefix: string) {
  return async function handler(req: NextRequest, ctx: RouteContext) {
    const { path = [] } = await ctx.params;
    const search = new URL(req.url).search;
    const upstreamPath = `${prefix}/${path.join("/")}${search}`.replace(/\/+/g, "/");
    return forwardToFastAPI(req, upstreamPath, {
      method: req.method,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
      noBody: req.method === "GET" || req.method === "HEAD",
    });
  };
}
