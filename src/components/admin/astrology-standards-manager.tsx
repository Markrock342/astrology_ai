"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminPage,
  Badge,
  Button,
  Card,
  CardSkeleton,
  Field,
  PageHeader,
  Select,
  TextArea,
  TextInput,
  Toggle,
  adminFetch,
} from "./ui";

type StandardRow = {
  id: string;
  matchKey: string;
  term: string;
  group: "มาตรฐานดาว" | "เกณฑ์ประกอบ";
  meaning: string;
  enabled: boolean;
  sortOrder: number;
};

const EMPTY: Omit<StandardRow, "id"> = {
  matchKey: "",
  term: "",
  group: "มาตรฐานดาว",
  meaning: "",
  enabled: true,
  sortOrder: 0,
};

export function AstrologyStandardsManager() {
  const [items, setItems] = useState<StandardRow[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await adminFetch<StandardRow[]>("/api/admin/astrology-standards"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void adminFetch<StandardRow[]>("/api/admin/astrology-standards")
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "โหลดไม่สำเร็จ");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function startNew() {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(true);
    setError(null);
  }

  function startEdit(item: StandardRow) {
    setEditingId(item.id);
    setForm({
      matchKey: item.matchKey,
      term: item.term,
      group: item.group,
      meaning: item.meaning,
      enabled: item.enabled,
      sortOrder: item.sortOrder,
    });
    setShowForm(true);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (editingId) {
        await adminFetch(`/api/admin/astrology-standards/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else {
        await adminFetch("/api/admin/astrology-standards", {
          method: "POST",
          body: JSON.stringify(form),
        });
        setShowForm(false);
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("ลบรายการนี้? การ์ดในดวงจะไม่โชว์คำนี้อีกถ้าไม่มีคำทดแทน")) {
      return;
    }
    try {
      await adminFetch(`/api/admin/astrology-standards/${id}`, { method: "DELETE" });
      if (editingId === id) setShowForm(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <AdminPage>
      <PageHeader
        title="มาตรฐานและเกณฑ์ในดวง"
        description="แก้ชื่อ กลุ่ม และคำอธิบายของการ์ด「มาตรฐานและเกณฑ์ที่พบในดวงนี้」ได้ทั้งหมด คีย์จับคู่ใช้ตรงกับคำที่มาจากตารางดาว"
        action={<Button onClick={startNew}>เพิ่มรายการ</Button>}
      />

      {error ? (
        <p className="mb-4 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {showForm ? (
        <Card className="mb-6 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="คีย์จับคู่จากตารางดาว">
              <TextInput
                value={form.matchKey}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, matchKey: event.target.value }))
                }
                placeholder="เช่น มหาอุจจ์"
              />
            </Field>
            <Field label="ชื่อที่แสดงบนการ์ด">
              <TextInput
                value={form.term}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, term: event.target.value }))
                }
                placeholder="เช่น มหาอุจจ์"
              />
            </Field>
            <Field label="กลุ่ม">
              <Select
                value={form.group}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    group: event.target.value as StandardRow["group"],
                  }))
                }
              >
                <option value="มาตรฐานดาว">มาตรฐานดาว</option>
                <option value="เกณฑ์ประกอบ">เกณฑ์ประกอบ</option>
              </Select>
            </Field>
            <Field label="ลำดับ">
              <TextInput
                type="number"
                value={String(form.sortOrder)}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    sortOrder: Number(event.target.value) || 0,
                  }))
                }
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="คำอธิบาย">
                <TextArea
                  rows={4}
                  value={form.meaning}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, meaning: event.target.value }))
                  }
                />
              </Field>
            </div>
            <Toggle
              checked={form.enabled}
              onChange={(checked) => setForm((prev) => ({ ...prev, enabled: checked }))}
              label="แสดงบนดวง"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => void save()} disabled={busy}>
              บันทึก
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowForm(false)}
              disabled={busy}
            >
              ยกเลิก
            </Button>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <CardSkeleton />
      ) : (
        <div className="grid gap-2">
          {items.map((item) => (
            <Card key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-[var(--foreground)]">{item.term}</p>
                <p className="mt-1 text-xs text-[var(--muted-2)]">
                  {item.group} · คีย์ {item.matchKey}
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  {item.meaning}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{item.enabled ? "แสดง" : "ซ่อน"}</Badge>
                <Button variant="ghost" onClick={() => startEdit(item)}>
                  แก้ไข
                </Button>
                <Button variant="danger" onClick={() => void remove(item.id)}>
                  ลบ
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
