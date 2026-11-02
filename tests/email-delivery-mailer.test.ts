import {beforeEach,describe,it,expect,vi,afterEach} from "vitest";
const m=vi.hoisted(()=>({create:vi.fn(),update:vi.fn(),attach:vi.fn()}));
vi.mock("@/config/env",()=>({env:{NODE_ENV:"production",RESEND_API_KEY:"test-key",EMAIL_FROM:"HoraSard <noreply@example.test>"}}));
vi.mock("@/server/db",()=>({prisma:{emailDelivery:{create:m.create,update:m.update}}}));
vi.mock("@/server/email/delivery-history",()=>({attachEmailProvider:m.attach}));
import {sendEmail} from "@/server/email/mailer";
const mail={to:"test@example.test",subject:"Test",text:"Private reset token should not be stored",category:"WEEKLY_DAYS" as const};
beforeEach(()=>{vi.resetAllMocks();m.create.mockResolvedValue({id:"log1"});vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({id:"p1"})}));});
afterEach(()=>vi.unstubAllGlobals());
describe("tracked mail sending",()=>{
 it("records only metadata and associates the Resend message id",async()=>{
  expect(await sendEmail(mail)).toEqual({ok:true,via:"resend"});
  expect(m.create).toHaveBeenCalledWith({data:{recipient:mail.to,subject:"Test",category:"WEEKLY_DAYS"}});
  expect(m.attach).toHaveBeenCalledWith("log1","p1");
 });
 it("does not send if the initial audit record cannot be written",async()=>{
  m.create.mockRejectedValue(new Error("db"));expect((await sendEmail(mail)).ok).toBe(false);expect(fetch).not.toHaveBeenCalled();
 });
 it("does not report a transport failure after provider accepted and history update fails",async()=>{
  m.attach.mockRejectedValue(new Error("db"));expect((await sendEmail(mail)).ok).toBe(true);expect(fetch).toHaveBeenCalledTimes(1);
 });
 it("records send errors as failed",async()=>{
  vi.mocked(fetch).mockResolvedValue({ok:false,status:429,text:async()=>"rate limit"} as Response);
  expect((await sendEmail(mail)).ok).toBe(false);
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:"FAILED",error:"Resend responded 429"})}));
 });
});
