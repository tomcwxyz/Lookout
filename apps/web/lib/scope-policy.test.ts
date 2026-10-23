import { describe,it,expect } from "vitest";
import { canAccessProject,type ScopedPrincipal } from "./scope-policy";
const subject:ScopedPrincipal={organisationId:1,userId:5,membershipRole:"member",connectionRevoked:false,grants:[{scope:"project:read",portfolioProjectId:12},{scope:"contribution:write",portfolioProjectId:12}]};
describe("multi-tenant MCP access boundaries",()=>{
 it("limits reads and contributions to same org and explicitly granted project",()=>{
  expect(canAccessProject(subject,1,12,"read")).toBe(true);
  expect(canAccessProject(subject,1,12,"contribute")).toBe(true);
  expect(canAccessProject(subject,2,12,"read")).toBe(false);
  expect(canAccessProject(subject,1,13,"contribute")).toBe(false);
  expect(canAccessProject(subject,1,13,"read")).toBe(false);
 });
 it("revocation denies all access",()=>expect(canAccessProject({...subject,connectionRevoked:true},1,12,"read")).toBe(false));
 it("viewer cannot write despite a mistakenly assigned write grant",()=>expect(canAccessProject({...subject,membershipRole:"viewer"},1,12,"contribute")).toBe(false));
 it("portfolio read does not imply write",()=>{
  const principal={...subject,grants:[{scope:"portfolio:read" as const,portfolioProjectId:null}]};
  expect(canAccessProject(principal,1,13,"read")).toBe(true);
  expect(canAccessProject(principal,1,13,"contribute")).toBe(false);
 });
});