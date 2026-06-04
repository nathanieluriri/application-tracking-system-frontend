import { NextRequest } from "next/server";
import { forwardToFastAPI } from "../../_lib/proxy";

export async function POST(req: NextRequest) {
  return forwardToFastAPI(req, "/v1/users/login", {
    method: "POST",
    body: req.body,
  });
}
