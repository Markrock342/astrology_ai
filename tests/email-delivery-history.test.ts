import { describe,it,expect,vi,beforeEach } from "vitest";
const mocks=vi.hoisted(()=>({raw:vi.fn(),upsert:vi.fn(),events:vi.fn(),update:vi.fn(),updateMany:vi.fn()}));
vi.mock("@/server/db",()=>({prisma:{$transaction:async(fn: (tx:unknown)=>unknown)=>fn({$queryRaw:mocks.raw,emailDeliveryEvent:{upsert:mocks.upsert,findMany:mocks.events},emailDelivery:{update:mocks.update,updateMany:mocks.updateMany}})}}));
import {recordDeliveryEvent,attachEmailProvider,resolveDeliveryStatus,emailHistoryQuery} from "@/server/email/delivery-history";
beforeEach(()=>{vi.clearAllMocks();mocks.events.mockResolvedValue([])});
describe("email delivery history",()=>{
 it("keeps delivered and bounce outcomes when sent events arrive late",()=>{
  const event=(status:string,day:number)=>({status,occurredAt:new Date(2026,10,day)});
  expect(resolveDeliveryStatus([event("DELIVERED",1),event("SENT",2)])?.status).toBe("DELIVERED");
  expect(resolveDeliveryStatus([event("BOUNCED",1),event("DELIVERED",2)])?.status).toBe("BOUNCED");
 });
 it("reconciles an early webhook after the provider response is attached",async()=>{
  mocks.events.mockResolvedValue([{status:"DELIVERED",occurredAt:new Date("2026-11-02T00:00:00Z")}]);
  await attachEmailProvider("log1","provider1");
  expect(mocks.updateMany).toHaveBeenCalledWith({where:{providerId:"provider1"},data:{status:"DELIVERED",statusAt:new Date("2026-11-02T00:00:00Z")}});
 });
 it("deduplicates by the signed Svix event id and serializes updates per email",async()=>{
  const payload={type:"email.bounced",created_at:"2026-11-02T00:00:00Z",data:{email_id:"p1"}};
  await recordDeliveryEvent(payload,"evt1");await recordDeliveryEvent(payload,"evt1");
  expect(mocks.upsert.mock.calls[0][0]).toMatchObject({where:{id:"evt1"},update:{},create:{providerId:"p1",status:"BOUNCED"}});
  expect(mocks.raw).toHaveBeenCalledTimes(2);
 });
 it("ignores inbound/open events and rejects malformed tracked events",async()=>{
  expect(await recordDeliveryEvent({type:"email.received"},"e")).toEqual({tracked:false});
  await expect(recordDeliveryEvent({type:"email.delivered",data:{email_id:"p"}},"e")).rejects.toThrow();
  expect(mocks.upsert).not.toHaveBeenCalled();
 });
 it("validates admin filters and paging",()=>{
  expect(emailHistoryQuery.safeParse({status:"INBOX"}).success).toBe(false);
  expect(emailHistoryQuery.safeParse({page:0}).success).toBe(false);
  expect(emailHistoryQuery.parse({status:"BOUNCED",category:"WEEKLY_DAYS",page:"2"}).page).toBe(2);
 });
});
