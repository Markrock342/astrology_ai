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
      return fail("VALIDATION", "Invalid input", 422, err.flatten());
    }
    console.error("Unhandled error:", err);
    const message = isPrismaPoolError(err)
      ? "ระบบฐานข้อมูลไม่ว่างชั่วคราว กรุณารอสักครู่แล้วลองใหม่"
      : "เกิดข้อผิดพลาดชั่วคราว กรุณาลองใหม่อีกครั้ง";
    return fail("INTERNAL", message, 500);
  }
}
