import {describe,it,expect,vi,beforeEach,afterEach} from "vitest";
vi.mock("../lib/lab-neon-jwt",()=>({verifyLabBearer:vi.fn()}));
vi.mock("@lookout/db",()=>({listVerifiedIdentityOrganisations:vi.fn()}));
import {GET} from "../app/api/lab/organisations/route";
import {NextRequest} from "next/server";
import {verifyLabBearer} from "../lib/lab-neon-jwt";
import {listVerifiedIdentityOrganisations} from "@lookout/db";
const req=()=>new NextRequest("https://example.test/api/lab/organisations");
describe("lab workspace discovery",()=>{
 beforeEach(()=>{vi.clearAllMocks();process.env.LOOKOUT_MULTIUSER_LAB="enabled";});
 afterEach(()=>{delete process.env.LOOKOUT_MULTIUSER_LAB;});
 it("returns 404 when lab disabled",async()=>{delete process.env.LOOKOUT_MULTIUSER_LAB;expect((await GET(req())).status).toBe(404);});
 it("rejects missing verified session before querying organisations",async()=>{
  vi.mocked(verifyLabBearer).mockResolvedValue(null);
  expect((await GET(req())).status).toBe(401);
  expect(listVerifiedIdentityOrganisations).not.toHaveBeenCalled();
 });
 it("derives workspace identity from verified token, never a user query parameter",async()=>{
  vi.mocked(verifyLabBearer).mockResolvedValue({issuer:"https://auth.example.test",subject:"user-a",authenticated:true});
  vi.mocked(listVerifiedIdentityOrganisations).mockResolvedValue([{id:1,name:"Private A",slug:"private-a",role:"owner"}]);
  const response=await GET(req());expect(response.status).toBe(200);
  expect(await response.json()).toEqual({organisations:[{id:1,name:"Private A",slug:"private-a",role:"owner"}]});
  expect(listVerifiedIdentityOrganisations).toHaveBeenCalledWith("https://auth.example.test","user-a");
 });
});
