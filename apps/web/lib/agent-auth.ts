import { authoriseAgentToken } from "@lookout/db";
import type { NextRequest } from "next/server";
export function bearer(request:NextRequest) {
  const value=request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}
export async function agentIdentity(request:NextRequest) {
  return authoriseAgentToken(bearer(request));
}
export const noStore={"Cache-Control":"no-store"};
