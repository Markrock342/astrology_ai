import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";
import { isPrismaPoolError } from "@/server/prisma-utils";

/** Attach a request id for tracing (spec 11). */
export function requestId(): string {
  return crypto.randomUUID();
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ ok: false, error: { code, message, details } }, { status });
}

/**
 * Persist an unhandled error so the admin can SEE it.
 *
 * console.error on a serverless instance is a message to nobody: the process is
 * gone seconds later and no one tails those logs. Until this existed, the first
 * report of any production 500 was a user complaint.
 *
 * Everything here is deliberately paranoid: dynamic import (http.ts is imported
 * by nearly every route, and lib code must not pull Prisma at module load),
 * bounded strings, and a swallowed catch — the error logger must never be the
 * thing that breaks a request.
 */
function recordError(err: unknown) {
  void (async () => {
    try {
      const { prisma } = await import("@/server/db");
      const name = err instanceof Error ? err.name : "UnknownError";
      const message = err instanceof Error ? err.message : String(err);
      const stack =
        err instanceof Error && err.stack
          ? err.stack.split("\n").slice(0, 12).join("\n").slice(0, 4_000)
          : null;
      await prisma.appErrorLog.create({
        data: { message: `${name}: ${message}`.slice(0, 1_000), stack },
      });
    } catch {
      /* the logger must never take the request down with it */
    }
  })();
}

/**
 * Wrap a route handler body so thrown AppError / ZodError become clean JSON
 * responses. Never leaks stack traces or secrets to the client.
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) {
      return fail(err.code, err.message, err.status, err.details);
    }
    if (err instanceof ZodError) {
      // Our own refinements speak Thai; Zod's built-ins are English. Users saw
      // "Invalid input" in the login and settings forms.
      const own = err.issues.map((i) => i.message).find((m) => /[\u0E00-\u0E7F]/.test(m));
      return fail("VALIDATION", own ?? "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่", 422, err.flatten());
    }
    // A body that is not JSON / form data is the client's mistake, not a
    // server error — it used to be a 500 and a row in the error log.
    if (err instanceof SyntaxError || (err instanceof TypeError && /form ?data|content-type/i.test(err.message))) {
      return fail("VALIDATION", "รูปแบบข้อมูลที่ส่งมาไม่ถูกต้อง", 422);
    }
    const prismaCode = (err as { code?: unknown } | null)?.code;
    if (prismaCode === "P2002") return fail("VALIDATION", "ข้อมูลนี้มีอยู่แล้ว (ซ้ำ)", 409);
    if (prismaCode === "P2003") return fail("VALIDATION", "อ้างถึงข้อมูลที่ไม่มีอยู่", 422);
    if (prismaCode === "P2025") return fail("NOT_FOUND", "ไม่พบข้อมูล", 404);
    console.error("Unhandled error:", err);
    recordError(err);
    const message = isPrismaPoolError(err)
      ? "ระบบฐานข้อมูลไม่ว่างชั่วคราว กรุณารอสักครู่แล้วลองใหม่"
      : "เกิดข้อผิดพลาดชั่วคราว กรุณาลองใหม่อีกครั้ง";
    return fail("INTERNAL", message, 500);
  }
}
