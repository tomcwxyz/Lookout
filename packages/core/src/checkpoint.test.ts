import { describe, expect, it } from "vitest";
import { parseCheckpoint, checkpointNextStep } from "./checkpoint";
const valid = {version:1,eventId:"session-a:checkpoint-001",agent:"codex",title:"Reader improvements",
  objective:"Improve reading OCR",summary:"Built initial OCR correction",
  implemented:["Implemented sentence context"],remaining:["Test low light"],
  tests:[{description:"Unit checks",result:"passed_claimed"}],decisions:["Retain the existing flow"],blockers:[]};
describe("portable agent checkpoint",()=>{
  it("normalises bounded agent-reported data without claiming it verified",()=>{
    const x=parseCheckpoint(valid);
    expect(x.version).toBe(1); expect(checkpointNextStep(x)).toBe("Test low light");
  });
  it("rejects unknown versions, oversized payloads and non-https PR references",()=>{
    expect(()=>parseCheckpoint({...valid,version:2})).toThrow();
    expect(()=>parseCheckpoint({...valid,summary:"x".repeat(3000)})).toThrow();
    expect(()=>parseCheckpoint({...valid,prUrl:"http://localhost/private"})).toThrow();
    expect(()=>parseCheckpoint({...valid,tests:[{description:"ok",result:"passed"}]})).toThrow();
  });
  it("supports two different agents reporting separately",()=>{
    expect(parseCheckpoint({...valid,agent:"claude",eventId:"session-b:checkpoint-002"}).agent).toBe("claude");
  });
});
