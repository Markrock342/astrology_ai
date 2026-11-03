import { describe, expect, it, vi } from "vitest";
import { lapseExpiredIncludedUsage } from "@/server/usage/usage-budget-service";

function client(wallet: { includedBalanceUnits: number; periodEndsAt: Date | null; includedAllowanceUnits?:number }, runningPro: { expiresAt: Date | null } | null = null, datedFree=false,freeEnd:Date|null=null) {
  return {
    usageWallet: { findUnique: vi.fn(async () => wallet), updateMany: vi.fn(async () => ({ count: 1 })) },
    userSubscription: { findFirst: vi.fn(async (query:{where:{package:{type:string};expiresAt?:unknown}}) => query.where.package.type==="FREE"?("expiresAt" in query.where?(datedFree?{id:"free"}:null):(freeEnd?{expiresAt:freeEnd}:null)):runningPro) },
    package: { findFirst: vi.fn(async () => ({ usageBudgetUnits: 27_778 })) },
    usageTransaction: { create: vi.fn(async () => ({})) },
  };
}
const NOW = new Date("2026-10-04T00:00:00Z");

describe("the included usage pool at period end", () => {
  it("retains a future Free signup deadline after a paid period ends",async()=>{
    const end=new Date(NOW.getTime()+86400000),c=client({includedBalanceUnits:900000,periodEndsAt:NOW},null,false,end);
    await lapseExpiredIncludedUsage("u1",c as never,NOW);
    expect(c.usageWallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{includedBalanceUnits:27778,includedAllowanceUnits:27778,periodEndsAt:end}}));
  });
  it("does not restore Free after its original signup deadline already passed",async()=>{
    const end=new Date(NOW.getTime()-86400000),c=client({includedBalanceUnits:900000,periodEndsAt:NOW},null,false,end);
    await lapseExpiredIncludedUsage("u1",c as never,NOW);
    expect(c.usageWallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{includedBalanceUnits:0,includedAllowanceUnits:0,periodEndsAt:end}}));
  });
  it("expires a dated Free pool to zero, never refills it to the default Free allowance",async()=>{
    const c=client({includedBalanceUnits:5000,includedAllowanceUnits:75000,periodEndsAt:NOW},null,true);
    await lapseExpiredIncludedUsage("u1",c as never,NOW);
    expect(c.usageWallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{includedBalanceUnits:0,includedAllowanceUnits:0}}));
    expect(c.package.findFirst).not.toHaveBeenCalled();
    expect(c.usageTransaction.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({amountUnits:-5000,bucket:"INCLUDED",referenceType:"free_period_end"})}));
  });
  it("does not extend expired Free questions merely because a purchased pack opens Pro",async()=>{
    const c=client({includedBalanceUnits:5000,includedAllowanceUnits:75000,periodEndsAt:NOW},{expiresAt:new Date("2099-01-01")},true);
    await lapseExpiredIncludedUsage("u1",c as never,NOW);
    expect(c.usageWallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{includedBalanceUnits:0,includedAllowanceUnits:0}}));
  });
  it("drops a leftover Pro budget to the Free budget", async () => {
    const c = client({ includedBalanceUnits: 900_000, periodEndsAt: new Date("2026-10-01T16:59:59Z") });
    await lapseExpiredIncludedUsage("u1", c as never, NOW);
    expect(c.usageWallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { includedBalanceUnits: 27_778, includedAllowanceUnits: 27_778, periodEndsAt: null },
    }));
    expect(c.usageTransaction.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amountUnits: 27_778 - 900_000 }) }));
  });

  it("keeps less if less is left", async () => {
    const c = client({ includedBalanceUnits: 5_000, periodEndsAt: new Date("2026-10-01T00:00:00Z") });
    await lapseExpiredIncludedUsage("u1", c as never, NOW);
    expect(c.usageWallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ includedBalanceUnits: 5_000 }) }));
  });

  it("leaves a live period and an open-ended grant alone", async () => {
    for (const periodEndsAt of [new Date("2026-11-01T00:00:00Z"), null]) {
      const c = client({ includedBalanceUnits: 900_000, periodEndsAt });
      await lapseExpiredIncludedUsage("u1", c as never, NOW);
      expect(c.usageWallet.updateMany).not.toHaveBeenCalled();
    }
  });

  // 2 Oct 2026: the promotion's period ended while paid Pro ran on to 20 Oct.
  it("follows a running Pro instead of cutting to Free", async () => {
    const until = new Date("2026-10-20T00:00:00Z");
    const c = client({ includedBalanceUnits: 900_000, periodEndsAt: new Date("2026-10-01T16:59:59Z") }, { expiresAt: until });
    await lapseExpiredIncludedUsage("u1", c as never, NOW);
    expect(c.usageWallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { periodEndsAt: until } }));
    expect(c.usageTransaction.create).not.toHaveBeenCalled();
  });
});
