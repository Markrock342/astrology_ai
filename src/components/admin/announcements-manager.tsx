"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminPage,
  Badge,
  Button,
  Card,
  Field,
  PageHeader,
  Select,
  TextArea,
  TextInput,
  Toggle,
  adminFetch,
} from "./ui";

type Announcement = {
  id: string;
  title: string;
  message: string;
  tone: "INFO" | "WARNING" | "PROMO" | "DANGER";
  enabled: boolean;
  linkUrl: string | null;
  linkLabel: string | null;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
};

const EMPTY: Omit<Announcement, "id"> = {
  title: "",
  message: "",
  tone: "INFO",
  enabled: false,
  linkUrl: null,
  linkLabel: null,
  startsAt: null,
  endsAt: null,
  sortOrder: 0,
};

const TONE_LABEL: Record<Announcement["tone"], string> = {
  INFO: "ข้อมูล",
  WARNING: "เตือน",
  PROMO: "โปรโมชัน",
  DANGER: "วิกฤต",
};

export function AnnouncementsManager() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(await adminFetch<Announcement[]>("/api/admin/announcements"));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((e) => setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
  }, [load]);

  function startEdit(item: Announcement) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      message: item.message,
      tone: item.tone,
      enabled: item.enabled,
      linkUrl: item.linkUrl,
      linkLabel: item.linkLabel,
      startsAt: item.startsAt?.slice(0, 16) ?? null,
      endsAt: item.endsAt?.slice(0, 16) ?? null,
      sortOrder: item.sortOrder,
    });
    setShowForm(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        linkUrl: form.linkUrl || null,
        linkLabel: form.linkLabel || null,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      };
      if (editingId) {
        await adminFetch(`/api/admin/announcements/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await adminFetch("/api/admin/announcements", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("ลบประกาศนี้?")) return;
    await adminFetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <AdminPage>
      <PageHeader
        title="ประกาศ / Banner"
        description="ตั้งข้อความแจ้งเตือนด้านบนแอป — เช่น Gemini มีปัญหา, ปิดปรับปรุง, โปรโมชัน Pro"
        action={
          <Button
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY);
              setShowForm(true);
            }}
          >
            + เพิ่มประกาศ
          </Button>
        }
      />

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      {showForm && (
        <Card className="mb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="หัวข้อ">
              <TextInput
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="โทนสี">
              <Select
                value={form.tone}
                onChange={(e) =>
                  setForm({ ...form, tone: e.target.value as Announcement["tone"] })
                }
              >
                {Object.entries(TONE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="ข้อความ">
              <TextArea
                rows={3}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </Field>
            <Field label="ลิงก์ (ไม่บังคับ)">
              <TextInput
                value={form.linkUrl ?? ""}
                onChange={(e) => setForm({ ...form, linkUrl: e.target.value || null })}
                placeholder="https://..."
              />
            </Field>
            <Field label="ข้อความปุ่มลิงก์">
              <TextInput
                value={form.linkLabel ?? ""}
                onChange={(e) => setForm({ ...form, linkLabel: e.target.value || null })}
              />
            </Field>
            <Field label="เริ่มแสดง (ไม่บังคับ)">
              <TextInput
                type="datetime-local"
                value={form.startsAt ?? ""}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value || null })}
              />
            </Field>
            <Field label="หยุดแสดง (ไม่บังคับ)">
              <TextInput
                type="datetime-local"
                value={form.endsAt ?? ""}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value || null })}
              />
            </Field>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Toggle
              checked={form.enabled}
              onChange={(enabled) => setForm({ ...form, enabled })}
              label="เปิดใช้งาน"
            />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                ยกเลิก
              </Button>
              <Button onClick={() => void save()} disabled={busy || !form.title || !form.message}>
                {busy ? "กำลังบันทึก…" : "บันทึก"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{item.title}</span>
              <Badge tone={item.enabled ? "green" : "muted"}>
                {item.enabled ? "เปิด" : "ปิด"}
              </Badge>
              <Badge>{TONE_LABEL[item.tone]}</Badge>
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" onClick={() => startEdit(item)}>
                  แก้ไข
                </Button>
                <Button variant="danger" onClick={() => void remove(item.id)}>
                  ลบ
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">{item.message}</p>
          </Card>
        ))}
        {items.length === 0 && !showForm && (
          <p className="text-sm text-[var(--muted-2)]">ยังไม่มีประกาศ</p>
        )}
      </div>
    </AdminPage>
  );
}
