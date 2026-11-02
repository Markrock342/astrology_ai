import {beforeEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({admin:vi.fn(),list:vi.fn(),verify:vi.fn(),event:vi.fn(),forward:vi.fn()}));
vi.mock("@/server/auth/rbac",()=>({requireAdmin:m.admin}));
vi.mock("@/config/env",()=>({env:{RESEND_WEBHOOK_SECRET:"whsec_test"}}));
vi.mock("@/server/email/inbound",()=>({verifyResendWebhook:m.verify,forwardInboundSupport:m.forward}));
vi.mock("@/server/email/delivery-history",async()=>{const real=await vi.importActual<typeof import("@/server/email/delivery-history")>("@/server/email/delivery-history");return {...real,listEmailHistory:m.list,recordDeliveryEvent:m.event}});
import {GET} from "@/app/api/admin/email-history/route";
import {POST} from "@/app/api/webhooks/resend/route";
import {AppError} from "@/lib/errors";
beforeEach(()=>{vi.resetAllMocks();m.event.mockResolvedValue({tracked:true})});
describe("email history access and webhook",()=>{
 it("requires admin before reading any history",async()=>{
  m.admin.mockRejectedValue(new AppError("UNAUTHENTICATED","Sign in"));
  const r=await GET(new Request("https://example.test/api/admin/email-history"));expect(r.status).toBe(401);expect(m.list).not.toHaveBeenCalled();
 });
 it("rejects invalid signatures before writing events",async()=>{
  m.verify.mockReturnValue(false);expect((await POST(new Request("https://example.test/api/webhooks/resend",{method:"POST",body:"{}"}))).status).toBe(401);expect(m.event).not.toHaveBeenCalled();
 });
 it("records delivery without forwarding it as inbound support",async()=>{
  m.verify.mockReturnValue(true);const r=await POST(new Request("https://example.test/api/webhooks/resend",{method:"POST",headers:{"svix-id":"event1"},body:JSON.stringify({type:"email.delivered"})}));
  expect(r.status).toBe(200);expect(m.event).toHaveBeenCalledWith({type:"email.delivered"},"event1");expect(m.forward).not.toHaveBeenCalled();
 });
});
