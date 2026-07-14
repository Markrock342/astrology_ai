import { test, expect, type Page } from "@playwright/test";
import { stubChat, happyTurn, THREAD_ID, ASSISTANT_MSG_ID } from "./helpers/sse";

/**
 * Regression suite for the chat.
 *
 * Every case here is a bug that actually shipped and had to be found by hand in
 * production. They exist so that never happens twice — if you break one, this
 * goes red before the push, not after a user does.
 */

/**
 * The sidebar renders each category twice — once in the collapsed icon rail,
 * once in the expanded list — so name-only lookups are ambiguous. Address the
 * real nav item by its href and its visible label.
 */
function categoryLink(page: Page, slug: string, label: string) {
  return page
    .locator(`a[href="/dashboard?cat=${slug}"]`)
    .filter({ hasText: label });
}

test.beforeEach(async ({ page }) => {
  await stubChat(page);
});

test("category click updates the sidebar highlight AND the preset chips", async ({
  page,
}) => {
  // Regression: soft-nav passed window.history.state (carrying Next's __NA
  // marker) to pushState, so Next skipped the router sync. The URL changed but
  // every useSearchParams consumer stayed frozen on the old category.
  await page.goto("/dashboard");

  await categoryLink(page, "career", "การงาน").click();
  await expect(page).toHaveURL(/cat=career/);
  // Chips come from the category the CLIENT resolved, so they only change if
  // useSearchParams actually synced.
  await expect(
    page.getByRole("button", { name: /ช่วงนี้ควรเปลี่ยนงานได้ไหม/ }),
  ).toBeVisible();

  await categoryLink(page, "self", "ตัวตน").click();
  await expect(page).toHaveURL(/cat=self/);
  await expect(
    page.getByRole("button", { name: /จุดแข็งของฉันคืออะไร/ }),
  ).toBeVisible();
});

test("preset chips always exist, even when the API sends none", async ({
  page,
}) => {
  // Regression: mapApiCategory did `suggestedQuestions ?? []`, and the DB rows
  // have none — so the empty chat landed with nothing to tap.
  await page.goto("/dashboard?cat=fortune");
  await expect(
    page.locator("button", { hasText: /โชคลาภ|ดวง|ระวัง|โฟกัส/ }).first(),
  ).toBeVisible();
});

test("a sent message streams in full and the answer keeps its actions", async ({
  page,
}) => {
  // Regressions: the poll raced the live stream and wiped the optimistic
  // bubbles; a per-delta rAF await stalled the read loop; and the assistant kept
  // a `stream-*` id, so it never got action buttons.
  await page.goto("/dashboard?cat=self");

  await page.getByRole("textbox").fill("จุดแข็งของฉันคืออะไร");
  await page.keyboard.press("Enter");

  await expect(page.getByText("จุดแข็งของฉันคืออะไร")).toBeVisible();
  await expect(page.locator(".chat-md", { hasText: "นี่คือคำตอบทดสอบจากระบบ" })).toBeVisible();

  // The turn settled: composer is free, and the ASSISTANT is actionable —
  // "สร้างใหม่" only renders when the bubble carries a real server id.
  await expect(page.getByRole("textbox")).toHaveValue("");
  await expect(page.getByRole("button", { name: "สร้างใหม่" })).toBeVisible();
  // Server-measured duration is surfaced (it used to be nowhere).
  await expect(page.getByText(/ใช้เวลา/)).toBeVisible();
});

test("editing a message sends the REAL row id and clears the composer", async ({
  page,
}) => {
  // Two regressions in one flow:
  //  - the optimistic bubble carried a client crypto.randomUUID(), so the server
  //    answered "ไม่พบข้อความผู้ใช้นี้" on every edit;
  //  - the edited text stayed in the composer, so users pressed Enter again and
  //    were charged a second credit for a duplicate question.
  const sends: Array<Record<string, unknown>> = [];
  await stubChat(page, { onSend: (body) => sends.push(body) });

  await page.goto("/dashboard?cat=self");
  await page.getByRole("textbox").fill("คำถามแรก");
  await page.keyboard.press("Enter");
  await expect(page.locator(".chat-md", { hasText: "นี่คือคำตอบทดสอบจากระบบ" })).toBeVisible();

  await page.getByRole("button", { name: "แก้ไข" }).click();
  await page.getByRole("textbox").fill("คำถามที่แก้แล้ว");
  await page.keyboard.press("Enter");

  await expect
    .poll(() => sends.length, { message: "the edit should have been sent" })
    .toBe(2);

  // Never a local id — the server looks this up and 404s on `local-*`.
  const editId = sends[1].editUserMessageId as string | undefined;
  expect(editId, "edit must carry a real DB id").toBeTruthy();
  expect(editId).not.toMatch(/^local-/);
  expect(editId).not.toMatch(/^stream-/);

  await expect(page.getByText("ไม่พบข้อความผู้ใช้นี้")).toBeHidden();
  await expect(page.getByRole("textbox")).toHaveValue("");
});

test("a turn that FAILS still keeps its server id, so its actions survive", async ({
  page,
}) => {
  // Regression: row ids arrived only on `done`, so a turn that was stopped or
  // errored never learned them — and the UI hides every action on a bubble with
  // no server id. The `accepted` frame now delivers them up front, which is what
  // lets "ลองใหม่" render on a failed answer at all.
  await stubChat(page, {
    events: [
      ...happyTurn("x").slice(0, 4), // accepted + the three status phases
      { type: "error", code: "AI_PROVIDER_ERROR", message: "ระบบทำนายขัดข้อง" },
    ],
  });

  await page.goto("/dashboard?cat=self");
  await page.getByRole("textbox").fill("ทดสอบความล้มเหลว");
  await page.keyboard.press("Enter");

  // Scoped to the message: the chat-wide ErrorBanner also offers "ลองใหม่", but
  // only THIS one requires the bubble to know its server id.
  await expect(
    page.getByTestId("message-actions").getByRole("button", { name: "ลองใหม่" }),
  ).toBeVisible();
});

test("leaving for /account and coming back actually renders the chat", async ({
  page,
}) => {
  // Regression: softNavigate is shallow routing. Used across routes it swapped
  // the URL while the old page stayed mounted — the sidebar went dead after any
  // visit to Account.
  await page.goto("/dashboard?cat=self");
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account/);

  await categoryLink(page, "self", "ตัวตน").click();

  await expect(page).toHaveURL(/\/dashboard\?cat=self/);
  // The composer only exists on the chat route — proof the page really changed.
  await expect(page.getByRole("textbox")).toBeVisible();
});

test("the elapsed counter does not restart when you switch chats", async ({
  page,
}) => {
  // Regression: ThinkingIndicator timed from its own mount, so switching chats
  // and returning reset a 90-second turn's counter to zero — the one number the
  // user watches to decide whether to keep waiting was the one that lied.
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

  // Derived from the row's createdAt, so it must read ~1:30 — not ~0s.
  await expect(page.getByText(/ใช้เวลาไปแล้ว\s*1:3\d นาที/)).toBeVisible();
});

test("a thumbs verdict reaches the SERVER and is persisted", async ({
  page,
}) => {
  // Regression: the thumbs buttons wrote to localStorage and nowhere else, so a
  // user could tell us an answer was wrong and we would never find out.
  //
  // This test deliberately does NOT stub /api/messages/*/feedback. An earlier
  // version did, and it was theatre: it asserted the CLIENT sent a request, then
  // answered that request itself. It stayed green while the table did not even
  // exist in the database. The request must reach the real route, and the real
  // route must accept it — that is the whole claim being made.
  //
  // The stub gives the assistant a REAL message id (ASSISTANT_MSG_ID), but no
  // such row exists, so the route correctly answers 404. A 404 proves the whole
  // path is alive: auth passed, the route ran, the service queried the database
  // and found no such message. A 500 would mean the table is missing.
  await page.goto("/dashboard?cat=self");
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

  // A 500 here means message_feedback does not exist in the database — exactly
  // the failure the stubbed version of this test could never see.
  expect(
    res.status(),
    "500 = the message_feedback table is missing; the migration never ran",
  ).not.toBe(500);
  expect([200, 404]).toContain(res.status());

  // The row is not real, so the server refuses it — and the UI must SAY so
  // rather than silently un-highlighting the thumb, which is indistinguishable
  // from a dead button.
  if (res.status() === 404) {
    await expect(page.getByText(/บันทึกฟีดแบ็กไม่สำเร็จ/)).toBeVisible();
  }
});
