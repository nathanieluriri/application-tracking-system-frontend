import { NextRequest } from "next/server";
import { forwardToFastAPI } from "../../_lib/proxy";

export async function GET(req: NextRequest) {
  return forwardToFastAPI(req, "/v1/users/me", { method: "GET", noBody: true });
}
