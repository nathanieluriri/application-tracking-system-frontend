import { NextRequest } from "next/server";
import { forwardToFastAPI } from "../../_lib/proxy";
import { clearAuthCookies } from "../../_lib/cookies";

export async function POST(req: NextRequest) {
  const response = await forwardToFastAPI(req, "/v1/users/logout", {
    method: "POST",
    body: req.body,
  });
  clearAuthCookies(response);
  return response;
}
