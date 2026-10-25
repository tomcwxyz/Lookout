import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("./client",()=>({getDatabase:vi.fn()}));
import {getDatabase} from "./client";
import {issueOrganisationMcpReadToken,authoriseOrganisationMcpReadToken,revokeOrganisationMcpConnection,listOrganisationMcpFindings} from "./organisation-mcp-auth";
const member={issuer:"https://auth.example.test",subject:"verified-user",organisationId:4};
describe("organisation MCP key boundaries",()=>{
 beforeEach(()=>vi.resetAllMocks());
 it("does not query the DB for invalid credentials or organisation IDs",async()=>{
  expect(await authoriseOrganisationMcpReadToken("lko_invalid")).toBeNull();
  expect(await listOrganisationMcpFindings(0)).toEqual([]);
  await expect(issueOrganisationMcpReadToken({...member,organisationId:-1,label:"Desktop assistant"})).rejects.toThrow();
  expect(getDatabase).not.toHaveBeenCalled();
 });
 it("requires verified identity and owner role in the issuance transaction",async()=>{
  const execute=vi.fn().mockResolvedValue([]);
  vi.mocked(getDatabase).mockReturnValue({transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>fn({execute})} as never);
  await expect(issueOrganisationMcpReadToken({...member,label:"Desktop assistant"})).rejects.toThrow("Not authorised");
  expect(execute).toHaveBeenCalledTimes(1);
  const query=JSON.stringify(execute.mock.calls[0][0]);
  expect(query).toContain("lookout_auth_identities");
  expect(query).toContain("lookout_organisation_memberships");
 });
 it("issues a 256-bit random secret once and stores only its hash",async()=>{
  const execute=vi.fn()
   .mockResolvedValueOnce([{user_id:7,role:"owner"}])
   .mockResolvedValueOnce([{total:0}])
   .mockResolvedValueOnce([{id:22,expires_at:"2027-01-22T12:00:00Z"}])
   .mockResolvedValueOnce([]);
  vi.mocked(getDatabase).mockReturnValue({transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>fn({execute})} as never);
  const created=await issueOrganisationMcpReadToken({...member,label:"Desktop assistant"});
  expect(created.token).toMatch(/^lko_[0-9a-f]{64}$/);
  expect(created.id).toBe(22);
  expect(execute).toHaveBeenCalledTimes(4);
  expect(JSON.stringify(execute.mock.calls)).not.toContain(created.token);
  expect(JSON.stringify(execute.mock.calls)).toContain("token_hash");
  expect(JSON.stringify(execute.mock.calls)).toContain("portfolio:read");
  expect(JSON.stringify(execute.mock.calls)).not.toContain("contribution:write");
 });
 it("checks revocation, membership and expiry on every successful token lookup",async()=>{
  const execute=vi.fn().mockResolvedValue([{id:22,organisation_id:4,user_id:7,name:"Good Ship"}]);
  vi.mocked(getDatabase).mockReturnValue({execute} as never);
  const token="lko_"+"a".repeat(64);
  expect(await authoriseOrganisationMcpReadToken(token)).toEqual({connectionId:22,organisationId:4,userId:7,name:"Good Ship"});
  const query=JSON.stringify(execute.mock.calls[0][0]);
  for(const required of ["token_hash","revoked_at","expires_at","lookout_organisation_memberships","lookout_mcp_grants"])
   expect(query).toContain(required);
  expect(query).not.toContain(token);
 });
 it("fails closed after revocation, expiration or membership removal",async()=>{
  const execute=vi.fn().mockResolvedValue([]);
  vi.mocked(getDatabase).mockReturnValue({execute} as never);
  const token="lko_"+"a".repeat(64);
  expect(await authoriseOrganisationMcpReadToken(token)).toBeNull();
  const query=JSON.stringify(execute.mock.calls[0][0]);
  expect(query).toContain("c.revoked_at IS NULL");
  expect(query).toContain("c.expires_at>now()");
  expect(query).toContain("lookout_users u ON u.id=c.user_id AND u.disabled_at IS NULL");
  expect(query).toContain("lookout_organisation_memberships");
  expect(query).toContain("g.scope='portfolio:read'");
 });
 it("cannot revoke a key without current authenticated user membership",async()=>{
  const execute=vi.fn().mockResolvedValue([]);
  vi.mocked(getDatabase).mockReturnValue({execute} as never);
  expect(await revokeOrganisationMcpConnection({...member,connectionId:99})).toBe(false);
  const query=JSON.stringify(execute.mock.calls[0][0]);
  expect(query).toContain("lookout_auth_identities");
  expect(query).toContain("lookout_organisation_memberships");
 });
 it("scopes findings through project grants, never all observed repositories",async()=>{
  const execute=vi.fn().mockResolvedValue([]);
  vi.mocked(getDatabase).mockReturnValue({execute} as never);
  expect(await listOrganisationMcpFindings(4)).toEqual([]);
  const query=JSON.stringify(execute.mock.calls[0][0]);
  expect(query).toContain("lookout_project_access");
  expect(query).toContain("organisation_id");
  expect(query).toContain("LIMIT 100");
 });
});
