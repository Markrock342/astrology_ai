import {beforeEach,describe,expect,it,vi} from "vitest";
import {AppError} from "@/lib/errors";
const m=vi.hoisted(()=>({admin:vi.fn(),limit:vi.fn(),verify:vi.fn(),confirm:vi.fn(),forget:vi.fn()}));
vi.mock("@/server/auth/rbac",()=>({requireAdmin:m.admin}));
vi.mock("@/lib/rate-limit",()=>({rateLimit:m.limit,clientIp:()=>"test-ip"}));
vi.mock("@/server/auth/admin-2fa-service",()=>({beginTotpEnrollment:vi.fn(),getAdmin2faStatus:vi.fn(),verifyTotpLogin:m.verify,confirmTotpEnrollment:m.confirm,forgetAdmin2faDevice:m.forget}));
import {POST} from "@/app/api/admin/2fa/route";
const post=(body:unknown)=>POST(new Request("http://localhost/api/admin/2fa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}));
beforeEach(()=>{vi.clearAllMocks();m.admin.mockResolvedValue({id:"admin-a"});m.verify.mockResolvedValue(undefined);m.confirm.mockResolvedValue({backupCodes:[]});m.forget.mockResolvedValue(undefined)});
describe("admin 2FA explicit device consent API",()=>{
  it("defaults to false and accepts explicit true after the existing admin and rate-limit guards",async()=>{
    expect((await post({action:"verify",code:"123456"})).status).toBe(200);
    expect(m.verify).toHaveBeenLastCalledWith("admin-a","123456",false);
    expect((await post({action:"verify",code:"123456",rememberDevice:true})).status).toBe(200);
    expect(m.verify).toHaveBeenLastCalledWith("admin-a","123456",true);
    expect(m.admin).toHaveBeenCalledWith({skip2fa:true});expect(m.limit).toHaveBeenCalledWith("2fa-code:admin-a",8,300000);
  });
  it("rejects truthy strings rather than accidentally remembering a device",async()=>{
    expect((await post({action:"verify",code:"123456",rememberDevice:"false"})).status).toBe(422);expect(m.verify).not.toHaveBeenCalled();
  });
  it("passes consent through initial enrollment",async()=>{
    expect((await post({action:"confirm",code:"123456",rememberDevice:true})).status).toBe(200);
    expect(m.confirm).toHaveBeenCalledWith("admin-a","123456","test-ip",true);
  });
  it("forgetting only clears local proofs and still requires an authenticated admin",async()=>{
    expect((await post({action:"forget"})).status).toBe(200);expect(m.forget).toHaveBeenCalledTimes(1);
    m.admin.mockRejectedValue(new AppError("UNAUTHENTICATED","Please sign in"));
    expect((await post({action:"forget"})).status).toBe(401);expect(m.forget).toHaveBeenCalledTimes(1);
  });
});
