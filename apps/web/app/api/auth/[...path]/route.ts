import {NextRequest} from "next/server";
import {getLabAuth} from "../../../../lib/auth/lab-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const auth=getLabAuth();if(!auth)return Response.json({error:"Not found"},{status:404});
 return auth.handler().GET(request,{params:Promise.resolve({path:request.nextUrl.pathname.split('/').slice(3)})});
}
export async function POST(request:NextRequest){
 const auth=getLabAuth();if(!auth)return Response.json({error:"Not found"},{status:404});
 return auth.handler().POST(request,{params:Promise.resolve({path:request.nextUrl.pathname.split('/').slice(3)})});
}
