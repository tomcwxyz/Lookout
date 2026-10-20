import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ service: "lookout", status: "ok" }, {
    headers: { "Cache-Control": "no-store" }
  });
}
