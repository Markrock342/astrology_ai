"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  mapApiCategory,
  NATAL_CATEGORIES,
  type Category,
  type Thread,
} from "./nav-data";

export type AppUser = {
  name: string;
  email: string;
  image: string | null;
  plan: "FREE" | "PRO";
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
  creditBalance: number;
  canChat: boolean;
  emailVerified: boolean;
  needsEmailVerification: boolean;
  hasPassword: boolean;
  birthEditsUnlimited?: boolean;
};

export type AppAnnouncement = {
  id: string;
  title: string;
  message: string;
  tone: string;
  linkUrl: string | null;
  linkLabel: string | null;
};

export type AppPendingPayment = {
  id: string;
  amount: number;
  status: "PENDING";
  createdAt: string;
};

export type NatalChartStatus = {
  status: "PENDING" | "READY" | "FAILED";
  note: string | null;
};

/** Serializable bootstrap payload (mirrors server getAppBootstrap). */
export type AppBootstrapPayload = {
  me: Record<string, unknown>;
  categories: Array<{
    slug: string;
    nameTh: string;
    accessLevel: string;
    suggestedQuestions?: string[];
  }>;
  natalThreads: Thread[];
  transitThreads: Thread[];
  announcements: AppAnnouncement[];
  pendingPayment?: AppPendingPayment | null;
  natalChartStatus?: NatalChartStatus | null;
};

type AppLightBootstrapPayload = Pick<
  AppBootstrapPayload,
  "me" | "natalThreads" | "transitThreads"
>;

type AppDataContextValue = {
  user: AppUser | null;
  categories: Category[];
  natalThreads: Thread[];
  transitThreads: Thread[];
  announcements: AppAnnouncement[];
  pendingPayment: AppPendingPayment | null;
  natalChartStatus: NatalChartStatus | null;
  loading: boolean;
  loadError: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredCategories: Category[];
  filteredNatalThreads: Thread[];
  filteredTransitThreads: Thread[];
  /** @deprecated Use filteredNatalThreads / filteredTransitThreads */
  threads: Thread[];
  filteredThreads: Thread[];
  /** Full reload (categories, announcements, payment, threads, me). */
  refresh: () => void;
  /** Optimistic remove from sidebar lists (delete chat). */
  removeThreadLocal: (threadId: string) => void;
  /** After chat — me + thread lists only (much smaller). */
  refreshLight: () => void;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

function mapMe(me: Record<string, unknown>): AppUser {
  return {
    name:
      (me.name as string | null | undefined) ??
      String(me.email ?? "").split("@")[0] ??
      "ผู้ใช้",
    email: String(me.email ?? ""),
    image: (me.image as string | null | undefined) ?? null,
    plan: (me.plan as "FREE" | "PRO") ?? "FREE",
    role: (me.role as AppUser["role"]) ?? "USER",
    creditBalance: Number(me.creditBalance ?? 0),
    canChat: Boolean(me.canChat ?? me.plan === "PRO"),
    emailVerified: Boolean(me.emailVerified ?? true),
    needsEmailVerification: Boolean(me.needsEmailVerification ?? false),
    hasPassword: Boolean(me.hasPassword ?? false),
    birthEditsUnlimited: Boolean(me.birthEditsUnlimited),
  };
}

function applyBootstrap(
  data: AppBootstrapPayload,
  setters: {
    setUser: (u: AppUser) => void;
    setCategories: (c: Category[]) => void;
    setNatalThreads: (t: Thread[]) => void;
    setTransitThreads: (t: Thread[]) => void;
    setAnnouncements: (a: AppAnnouncement[]) => void;
    setPendingPayment: (p: AppPendingPayment | null) => void;
    setNatalChartStatus: (s: NatalChartStatus | null) => void;
  },
) {
  setters.setUser(mapMe(data.me));
  if (Array.isArray(data.categories) && data.categories.length > 0) {
    setters.setCategories(data.categories.map(mapApiCategory));
  }
  if (Array.isArray(data.natalThreads)) setters.setNatalThreads(data.natalThreads);
  if (Array.isArray(data.transitThreads)) {
    setters.setTransitThreads(data.transitThreads);
  }
  if (Array.isArray(data.announcements)) {
    setters.setAnnouncements(data.announcements);
  }
  setters.setPendingPayment(
    data.pendingPayment
      ? {
          id: data.pendingPayment.id,
          amount: data.pendingPayment.amount,
          status: "PENDING",
          createdAt: String(data.pendingPayment.createdAt),
        }
      : null,
  );
  if ("natalChartStatus" in data) {
    setters.setNatalChartStatus(data.natalChartStatus ?? null);
  }
}

function applyLightBootstrap(
  data: AppLightBootstrapPayload,
  setters: {
    setUser: (u: AppUser) => void;
    setNatalThreads: (t: Thread[]) => void;
    setTransitThreads: (t: Thread[]) => void;
  },
) {
  setters.setUser(mapMe(data.me));
  if (Array.isArray(data.natalThreads)) setters.setNatalThreads(data.natalThreads);
  if (Array.isArray(data.transitThreads)) {
    setters.setTransitThreads(data.transitThreads);
  }
}

export function AppDataProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData?: AppBootstrapPayload | null;
}) {
  const [user, setUser] = useState<AppUser | null>(() =>
    initialData ? mapMe(initialData.me) : null,
  );
  const [categories, setCategories] = useState<Category[]>(() =>
    initialData?.categories?.length
      ? initialData.categories.map(mapApiCategory)
      : NATAL_CATEGORIES,
  );
  const [natalThreads, setNatalThreads] = useState<Thread[]>(
    () => initialData?.natalThreads ?? [],
  );
  const [transitThreads, setTransitThreads] = useState<Thread[]>(
    () => initialData?.transitThreads ?? [],
  );
  const [announcements, setAnnouncements] = useState<AppAnnouncement[]>(
    () => initialData?.announcements ?? [],
  );
  const [pendingPayment, setPendingPayment] = useState<AppPendingPayment | null>(
    () =>
      initialData?.pendingPayment
        ? {
            id: initialData.pendingPayment.id,
            amount: initialData.pendingPayment.amount,
            status: "PENDING",
            createdAt: String(initialData.pendingPayment.createdAt),
          }
        : null,
  );
  const [natalChartStatus, setNatalChartStatus] = useState<NatalChartStatus | null>(
    () => initialData?.natalChartStatus ?? null,
  );
  const [loading, setLoading] = useState(!initialData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch("/api/app/bootstrap", { signal: controller.signal });
      if (!res.ok) {
        setLoadError("โหลดข้อมูลไม่สำเร็จ");
        return;
      }
      const json = await res.json();
      if (!json?.ok || !json.data) {
        setLoadError("โหลดข้อมูลไม่สำเร็จ");
        return;
      }

      applyBootstrap(json.data as AppBootstrapPayload, {
        setUser,
        setCategories,
        setNatalThreads,
        setTransitThreads,
        setAnnouncements,
        setPendingPayment,
        setNatalChartStatus,
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setLoadError("โหลดนานเกินไป — ลองใหม่อีกครั้ง");
      } else {
        setLoadError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
      }
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  const refreshLight = useCallback(async () => {
    try {
      const res = await fetch("/api/app/bootstrap?scope=light");
      if (!res.ok) return;
      const json = await res.json();
      if (!json?.ok || !json.data) return;
      applyLightBootstrap(json.data as AppLightBootstrapPayload, {
        setUser,
        setNatalThreads,
        setTransitThreads,
      });
    } catch {
      /* non-blocking */
    }
  }, []);

  useEffect(() => {
    if (initialData) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [initialData, load]);

  const q = searchQuery.trim().toLowerCase();
  const filteredCategories = useMemo(
    () =>
      q
        ? categories.filter(
            (c) =>
              c.label.toLowerCase().includes(q) ||
              c.slug.toLowerCase().includes(q),
          )
        : categories,
    [categories, q],
  );
  const filteredNatalThreads = useMemo(
    () =>
      q
        ? natalThreads.filter(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              t.categoryLabel?.toLowerCase().includes(q),
          )
        : natalThreads,
    [natalThreads, q],
  );
  const filteredTransitThreads = useMemo(
    () =>
      q
        ? transitThreads.filter(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              t.categoryLabel?.toLowerCase().includes(q),
          )
        : transitThreads,
    [transitThreads, q],
  );

  const removeThreadLocal = useCallback((threadId: string) => {
    setNatalThreads((prev) => prev.filter((t) => t.id !== threadId));
    setTransitThreads((prev) => prev.filter((t) => t.id !== threadId));
  }, []);

  const value = useMemo(
    () => ({
      user,
      categories,
      natalThreads,
      transitThreads,
      announcements,
      pendingPayment,
      natalChartStatus,
      loading,
      loadError,
      searchQuery,
      setSearchQuery,
      filteredCategories,
      filteredNatalThreads,
      filteredTransitThreads,
      threads: natalThreads,
      filteredThreads: filteredNatalThreads,
      refresh: load,
      removeThreadLocal,
      refreshLight,
    }),
    [
      user,
      categories,
      natalThreads,
      transitThreads,
      announcements,
      pendingPayment,
      natalChartStatus,
      loading,
      loadError,
      searchQuery,
      filteredCategories,
      filteredNatalThreads,
      filteredTransitThreads,
      load,
      removeThreadLocal,
      refreshLight,
    ],
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}

/** Find a category by slug from live app data. */
export function useCategory(slug: string | null) {
  const { categories } = useAppData();
  if (!slug) return undefined;
  return categories.find((c) => c.slug === slug);
}

export function isCategoryLocked(
  category: Category | undefined,
  plan: "FREE" | "PRO",
): boolean {
  return category?.tier === "PRO" && plan !== "PRO";
}
