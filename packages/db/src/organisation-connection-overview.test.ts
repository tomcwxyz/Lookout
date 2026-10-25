import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("./client",()=>({getDatabase:vi.fn()}));
import {getDatabase} from "./client";
import {getOrganisationConnectionOverview} from "./organisation-connection-overview";

describe("organisation connection reporting",()=>{
 beforeEach(()=>vi.clearAllMocks());
 it("ignores invalid organisation identifiers without a database read",async()=>{
  expect(await getOrganisationConnectionOverview(-2)).toEqual({connections:[],active:0});
  expect(await getOrganisationConnectionOverview(Number.NaN)).toEqual({connections:[],active:0});
  expect(getDatabase).not.toHaveBeenCalled();
 });
 it("filters by organisation and never exposes credential material",async()=>{
  const execute=vi.fn().mockResolvedValue([
    {id:"7",display_name:"Agent",created_at:"2026-10-20T12:00:00Z",revoked_at:null,expires_at:"2090-01-01T00:00:00Z",granted_projects:1,granted_scopes:2},
    {id:"8",display_name:"Former agent",created_at:"2026-10-19T10:00:00Z",revoked_at:"2026-10-21T10:00:00Z",expires_at:"2090-01-01T00:00:00Z",granted_projects:1,granted_scopes:1}
  ]);
  vi.mocked(getDatabase).mockReturnValue({execute} as never);
  const value=await getOrganisationConnectionOverview(3);
  expect(value.active).toBe(1);
  expect(value.connections.map(c=>c.active)).toEqual([true,false]);
  expect(Object.keys(value.connections[0]).sort()).toEqual(["active","createdAt","expiresAt","id","name","projects","scopes"]);
  const query=execute.mock.calls[0][0] as {queryChunks?:Array<{value?:string[]}>};
  const text=(query.queryChunks??[]).map(c=>c.value?.join("")??"").join("");
  expect(text).toContain("c.organisation_id=");
  expect(text).toContain("lookout_mcp_grants");
  expect(text.split("FROM")[0]).not.toContain("token_hash");
 });
});
