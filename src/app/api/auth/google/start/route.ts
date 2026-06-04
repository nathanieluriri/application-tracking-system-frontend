import { NextResponse } from "next/server";

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL ?? "http://localhost:8000";

export async function GET() {
  return NextResponse.redirect(`${FASTAPI_BASE_URL}/v1/users/google/auth`);
}
