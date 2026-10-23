export type DemoProject = { id:string; name:string; category:string; stage:string; repos:string[]; health:"healthy"|"review"|"blocked"; summary:string; next:string };
export type DemoEvent = { id:string; projectId:string; source:"github"|"agent"|"human"|"vercel"|"neon"; title:string; details:string; when:string; verified:boolean; action?:string };
/** Deterministic fictional observations. Never import production adapters here. */
export const demoProjects: DemoProject[] = [
{id:"harbour",name:"Harbour",category:"Community services",stage:"Testing",repos:["harbour-web","harbour-api","harbour-data","harbour-docs"],health:"blocked",summary:"Release recovery underway after a failing GitHub workflow.",next:"Review passing CI evidence and verify deployment."},
{id:"beacon",name:"Beacon",category:"Data and insights",stage:"Building",repos:["beacon-app","beacon-worker"],health:"review",summary:"Codex handed the search feature to Claude for accessibility testing.",next:"Accept keyboard navigation after human testing."},
{id:"canopy",name:"Canopy",category:"Grant management",stage:"Testing",repos:["canopy-platform","canopy-db"],health:"review",summary:"An agent reported a database migration; production application is unverified.",next:"Check applied migration history in the target environment."},
{id:"common-ground",name:"Common Ground",category:"Community mapping",stage:"Live",repos:["common-ground"],health:"healthy",summary:"Deployment confirmed and release accepted by a person.",next:"Monitor feedback and accessibility."},
{id:"northstar",name:"Northstar",category:"Scheduling",stage:"Building",repos:["northstar-web","northstar-auth"],health:"healthy",summary:"Authentication improvements are in review.",next:"Review pull request #42."},
{id:"fieldnotes",name:"Fieldnotes",category:"Research",stage:"Paused",repos:["fieldnotes"],health:"healthy",summary:"Paused deliberately following the pilot.",next:"Revisit the pilot findings when ready."},
{id:"signalhouse",name:"Signalhouse",category:"Monitoring",stage:"Maintaining",repos:["signalhouse"],health:"healthy",summary:"Regular dependency updates and working pipelines.",next:"No immediate action."},
{id:"willow",name:"Willow",category:"Collaboration",stage:"Exploring",repos:["willow-prototype"],health:"healthy",summary:"Early concept with no production infrastructure.",next:"Agree initial scope."}
];
export const demoEvents: DemoEvent[] = [
{id:"e1",projectId:"harbour",source:"github",title:"Release CI failed",details:"Pull request #28: integration tests failed on the release branch.",when:"Today, 09:10",verified:true,action:"Review CI log"},
{id:"e2",projectId:"harbour",source:"agent",title:"Codex reported a fix",details:"An agent claims it corrected an API contract mismatch and ran tests locally. This is not independently verified.",when:"Today, 09:36",verified:false},
{id:"e3",projectId:"harbour",source:"github",title:"GitHub CI passed",details:"Workflow for commit demo-a28 passed after the proposed fix.",when:"Today, 09:53",verified:true},
{id:"e4",projectId:"harbour",source:"vercel",title:"Production deployment detected",details:"Vercel deployment READY. Human release acceptance is still outstanding.",when:"Today, 10:05",verified:true},
{id:"e5",projectId:"beacon",source:"agent",title:"Codex left a handover",details:"Search indexing implemented (claimed). Remaining: keyboard navigation and screen-reader test.",when:"Yesterday, 16:20",verified:false},
{id:"e6",projectId:"beacon",source:"agent",title:"Claude picked up the work",details:"Reviewed the previous handover; reports completion of keyboard navigation, awaiting user acceptance.",when:"Today, 08:45",verified:false},
{id:"e7",projectId:"canopy",source:"agent",title:"Migration reportedly ready",details:"An agent reports schema version 12 applied; no environment-specific migration evidence is available.",when:"Yesterday, 15:12",verified:false},
{id:"e8",projectId:"canopy",source:"neon",title:"Production migration not verified",details:"Lookout has inventory access but cannot confirm the applied migration state.",when:"Today, 07:00",verified:true},
{id:"e9",projectId:"common-ground",source:"human",title:"Release accepted",details:"A project maintainer confirmed the release after reviewing deployment evidence.",when:"Yesterday, 12:00",verified:true},
{id:"e10",projectId:"common-ground",source:"vercel",title:"Deployment ready",details:"Public application deployment entered READY state.",when:"Yesterday, 11:42",verified:true}
];
export const demoStories = [
{id:"harbour",title:"Follow a failed deployment",description:"From failing CI to agent-reported fix and deployment evidence."},
{id:"beacon",title:"Watch two agents collaborate",description:"A portable handover carries context from one coding assistant to another."},
{id:"canopy",title:"Understand what is unverified",description:"Spot the difference between an agent's claim and verified infrastructure evidence."}
];
