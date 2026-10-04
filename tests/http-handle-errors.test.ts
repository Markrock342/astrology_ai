import { describe, expect, it } from "vitest";
import { z } from "zod";
import { handle } from "@/lib/http";

const body = async (r: Response) => ({ status: r.status, json: await r.json() });

describe("handle() turns client mistakes into Thai 4xx, not 500", () => {
  it("malformed JSON", async () => {
    const r = await body(await handle(async () => { JSON.parse("{oops"); return new Response(); }));
    expect(r.status).toBe(422);
    expect(r.json.error.message).toMatch(/[฀-๿]/);
  });

  it("built-in Zod failure gets a Thai message, a Thai refine keeps its own", async () => {
    const plain = await body(await handle(async () => { z.object({ n: z.number() }).parse({ n: "x" }); return new Response(); }));
    expect(plain.json.error.message).toBe("ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่");
    const own = await body(await handle(async () => { z.string().refine(() => false, "วันเกิดไม่ถูกต้อง").parse("a"); return new Response(); }));
    expect(own.json.error.message).toBe("วันเกิดไม่ถูกต้อง");
  });

  it("a duplicate key is 409", async () => {
    const r = await handle(async () => { throw Object.assign(new Error("Unique"), { code: "P2002" }); });
    expect(r.status).toBe(409);
  });
});
