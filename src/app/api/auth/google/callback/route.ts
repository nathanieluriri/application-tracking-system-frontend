import { NextRequest, NextResponse } from "next/server";
import { forwardToFastAPI } from "../../../_lib/proxy";

export async function GET(req: NextRequest) {
  // FastAPI's callback issues Set-Cookie and 302s on success. We forward, copy
  // Set-Cookie onto our origin, and redirect the user to the dashboard.
  const search = new URL(req.url).search;
  const upstream = await forwardToFastAPI(req, `/v1/users/auth/callback${search}`, {
    method: "GET",
    noBody: true,
  });

  if (upstream.status >= 300 && upstream.status < 400) {
    const redirect = NextResponse.redirect(new URL("/dashboard/overview", req.url));
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") {
        redirect.headers.append("set-cookie", value);
      }
    });
    return redirect;
  }
  return upstream;
}
