import { test, expect } from "@playwright/test";
import { stubChat, happyTurn, THREAD_ID } from "./helpers/sse";

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

test("category click updates the sidebar highlight AND the preset chips", async ({
  page,
}) => {
  // Regression: soft-nav passed window.history.state (carrying Next's __NA
  // marker) to pushState, so Next skipped the router sync. The URL changed but
  // every useSearchParams consumer stayed frozen on the old category.
  await page.goto("/dashboard");

  const career = page.getByRole("link", { name: /การงาน/ });
  await career.click();

  await expect(page).toHaveURL(/cat=career/);
  // The chips are rendered from the category the CLIENT resolved, so they only
  // change if useSearchParams actually synced.
  await expect(
    page.getByRole("button", { name: /ช่วงนี้ควรเปลี่ยนงานได้ไหม/ }),
  ).toBeVisible();

  const self = page.getByRole("link", { name: /ตัวตน/ });
  await self.click();
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
  const chips = page.locator("button", { hasText: /โชคลาภ|ดวง|ระวัง|โฟกัส/ });
  await expect(chips.first()).toBeVisible();
});

test("a sent message streams in full and the answer keeps its actions", async ({
  page,
}) => {
  // Regressions: the poll raced the live stream and wiped the optimistic
  // bubbles; a per-delta rAF await stalled the read loop; and the assistant kept
  // a `stream-*` id so it never got action buttons.
  await page.goto("/dashboard?cat=self");

  await page.getByRole("textbox").fill("จุดแข็งของฉันคืออะไร");
  await page.keyboard.press("Enter");

  await expect(page.getByText("จุดแข็งของฉันคืออะไร")).toBeVisible();
  await expect(page.getByText("นี่คือคำตอบทดสอบจากระบบ")).toBeVisible();

  // The turn settled: composer is free and the answer is actionable.
  await expect(page.getByRole("textbox")).toHaveValue("");
  await expect(page.getByRole("button", { name: /คัดลอก/ })).toBeVisible();
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
  await expect(page.getByText("นี่คือคำตอบทดสอบจากระบบ")).toBeVisible();

  await page.getByRole("button", { name: /แก้ไข/ }).first().click();
  await page.getByRole("textbox").fill("คำถามที่แก้แล้ว");
  await page.keyboard.press("Enter");

  await expect
    .poll(() => sends.length, { message: "edit should have been sent" })
    .toBe(2);

  // Never a local id — the server looks this up and 404s on `local-*`.
  const editId = sends[1].editUserMessageId as string | undefined;
  expect(editId, "edit must carry a real DB id").toBeTruthy();
  expect(editId).not.toMatch(/^local-/);
  expect(editId).not.toMatch(/^stream-/);

  await expect(page.getByText("ไม่พบข้อความผู้ใช้นี้")).toBeHidden();
  await expect(page.getByRole("textbox")).toHaveValue("");
});

test("a stopped turn keeps its server id, so its actions survive", async ({
  page,
}) => {
  // Regression: ids arrived only on `done`, so a turn that was stopped or failed
  // had no server id and the UI hid every action on it — even Copy.
  await stubChat(page, {
    // Accepted + a little text, then nothing: the turn never completes.
    events: happyTurn("ข้อความ").slice(0, 6),
  });

  await page.goto("/dashboard?cat=self");
  await page.getByRole("textbox").fill("ทดสอบหยุด");
  await page.keyboard.press("Enter");

  const stop = page.getByRole("button", { name: /หยุดคำตอบ/ });
  await expect(stop).toBeVisible();
  await stop.click();

  // Partial answer is kept AND remains actionable.
  await expect(page.getByRole("button", { name: /คัดลอก/ })).toBeVisible();
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

  await page.getByRole("link", { name: /ตัวตน/ }).click();

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
    // A turn that is still generating, started 90s ago.
    events: happyTurn("x").slice(0, 1),
    messages: [
      { id: "u1", role: "user", content: "คำถาม", createdAt: started },
      {
        id: "a1",
        role: "assistant",
        content: "",
        status: "PENDING",
        idempotencyKey: "k1",
        createdAt: started,
      },
    ],
  });

  await page.goto(`/dashboard?thread=${THREAD_ID}&cat=self`);

  // Derived from the row's createdAt, so it must read ~1:30, not ~0s.
  await expect(page.getByText(/ใช้เวลาไปแล้ว\s*1:3\d นาที/)).toBeVisible();
});
