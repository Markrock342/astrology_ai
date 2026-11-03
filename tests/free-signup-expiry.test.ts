import {describe,expect,it} from "vitest";
import {freeSignupExpiry,freeSignupExpiryLabel} from "@/lib/free-expiry";
const signup=new Date("2026-11-03T13:45:20.123Z");
describe("Free signup expiry",()=>{
  it("counts exactly 30 days from signup, preserving its timestamp",()=>{
    expect(freeSignupExpiry({expiryMode:"DAYS",expiryDays:30,expiresOn:null},signup)?.toISOString()).toBe("2026-12-03T13:45:20.123Z");
    expect(freeSignupExpiryLabel({expiryMode:"DAYS",expiryDays:30,expiresOn:null})).toContain("หลังสมัคร");
  });
  for(const mode of ["NONE","DEFAULT"] as const)it(`${mode} remains indefinite independently of paid-pack defaults`,()=>{
    expect(freeSignupExpiry({expiryMode:mode,expiryDays:30,expiresOn:null},signup)).toBeNull();
  });
  it("uses an explicit absolute date unchanged",()=>{
    expect(freeSignupExpiry({expiryMode:"DATE",expiryDays:null,expiresOn:"2027-01-01T16:59:59Z"},signup)?.toISOString()).toBe("2027-01-01T16:59:59.000Z");
  });
});
