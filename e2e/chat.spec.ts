import { test, expect } from "@playwright/test";
import { stubChat, happyTurn, THREAD_ID, ASSISTANT_MSG_ID } from "./helpers/sse";

/**
 * Regression suite for the chat.
 *
 * Every case here is a bug that actually shipped and had to be found by hand in
 * production. They exist so that never happens twice — if you break one, this
 * goes red before the push, not after a user does.
 */

test.beforeEach(async ({ page }) => {
  await stubChat(page);
});

test("home is ready to chat without picking a category", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "ถามดวงได้เลย" })).toBeVisible();
  await expect(page.getByRole("textbox")).toBeVisible();
  await expect(page.getByRole("region", { name: "พื้นดวงเดิม" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "เลือกหมวดเพื่อเริ่มสนทนา" }),
  ).toHaveCount(0);
  await expect(
    page.locator('aside a[href="/dashboard?cat=self"], .w-16 a[href="/dashboard?cat=self"]'),
  ).toHaveCount(0);
});

test("natal chart view fills the main pane and hides the composer", async ({
  page,
}) => {
  await page.goto("/dashboard?view=natal-chart");

  await expect(page.getByRole("heading", { name: "ถามดวงได้เลย" })).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "พื้นดวงเดิม" })).toBeVisible();
  await expect(
    page.getByText(/กำลังเปิดดวงจักรกำเนิด|กำลังวางลัคนา|ดวงจักรกำเนิด|ผังดวงชะตา|ยังเปิดดวงจักร/),
  ).toBeVisible();
});

test("preset chips always exist, even when the API sends none", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(
    page.locator("button", { hasText: /โชคลาภ|ดวง|ระวัง|โฟกัส|งาน|ตัวตน|รัก/ }).first(),
  ).toBeVisible();
});

test("a sent message streams in full and the answer keeps its actions", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await page.getByRole("textbox").fill("จุดแข็งของฉันคืออะไร");
  await page.keyboard.press("Enter");

  await expect(page.getByText("จุดแข็งของฉันคืออะไร")).toBeVisible();
  await expect(page.locator(".chat-md", { hasText: "นี่คือคำตอบทดสอบจากระบบ" })).toBeVisible();

  await expect(page.getByRole("textbox")).toHaveValue("");
  await expect(page.getByRole("button", { name: "สร้างใหม่" })).toBeVisible();
  await expect(page.getByText(/ใช้เวลา/)).toBeVisible();
});

test("editing a message sends the REAL row id and clears the composer", async ({
  page,
}) => {
  const sends: Array<Record<string, unknown>> = [];
  await stubChat(page, { onSend: (body) => sends.push(body) });

  await page.goto("/dashboard");
  await page.getByRole("textbox").fill("คำถามแรก");
  await page.keyboard.press("Enter");
  await expect(page.locator(".chat-md", { hasText: "นี่คือคำตอบทดสอบจากระบบ" })).toBeVisible();

  await page.getByRole("button", { name: "แก้ไข" }).click();
  await page.getByRole("textbox").fill("คำถามที่แก้แล้ว");
  await page.keyboard.press("Enter");

  await expect
    .poll(() => sends.length, { message: "the edit should have been sent" })
    .toBe(2);

  const editId = sends[1].editUserMessageId as string | undefined;
  expect(editId, "edit must carry a real DB id").toBeTruthy();
  expect(editId).not.toMatch(/^local-/);
  expect(editId).not.toMatch(/^stream-/);

  await expect(page.getByText("ไม่พบข้อความผู้ใช้นี้")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveValue("");
});

test("a turn that FAILS still keeps its server id, so its actions survive", async ({
  page,
}) => {
  await stubChat(page, {
    events: [
      ...happyTurn("x").slice(0, 4),
      { type: "error", code: "AI_PROVIDER_ERROR", message: "ระบบทำนายขัดข้อง" },
    ],
  });

  await page.goto("/dashboard");
  await page.getByRole("textbox").fill("ทดสอบความล้มเหลว");
  await page.keyboard.press("Enter");

  await expect(
    page.getByTestId("message-actions").getByRole("button", { name: "ลองใหม่" }),
  ).toBeVisible();
});

test("leaving for /account and coming back actually renders the chat", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account/);

  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("textbox")).toBeVisible();
});

test("the elapsed counter does not restart when you switch chats", async ({
  page,
}) => {
  const started = new Date(Date.now() - 90_000).toISOString();
  await stubChat(page, {
    events: happyTurn("x").slice(0, 1),
    messages: [
      { id: "u1", role: "user", content: "คำถาม", createdAt: started },
      {
        id: ASSISTANT_MSG_ID,
        role: "assistant",
        content: "",
        status: "PENDING",
        idempotencyKey: "k1",
        createdAt: started,
      },
    ],
  });

  await page.goto(`/dashboard?thread=${THREAD_ID}&cat=self`);

  await expect(page.getByText(/ใช้เวลาไปแล้ว\s*1:3\d นาที/)).toBeVisible();
});

test("a thumbs verdict reaches the SERVER and is persisted", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page.getByRole("textbox").fill("ทดสอบฟีดแบ็ก");
  await page.keyboard.press("Enter");
  await expect(page.locator(".chat-md", { hasText: "นี่คือคำตอบทดสอบจากระบบ" })).toBeVisible();

  const waitForVerdict = page.waitForResponse(
    (r) =>
      r.url().includes(`/api/messages/${ASSISTANT_MSG_ID}/feedback`) &&
      r.request().method() === "POST",
  );

  await page
    .getByTestId("message-actions")
    .getByRole("button", { name: "คำตอบไม่ดี" })
    .click();

  const res = await waitForVerdict;
  expect(res.request().postDataJSON()).toEqual({ value: "DOWN" });

  expect(
    res.status(),
    "500 = the message_feedback table is missing; the migration never ran",
  ).not.toBe(500);
  expect([200, 404]).toContain(res.status());

  if (res.status() === 404) {
    await expect(page.getByText(/บันทึกฟีดแบ็กไม่สำเร็จ/)).toBeVisible();
  }
});
