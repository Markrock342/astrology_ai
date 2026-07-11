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

type AppDataContextValue = {
  user: AppUser | null;
  categories: Category[];
  natalThreads: Thread[];
  transitThreads: Thread[];
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
  refresh: () => void;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [categories, setCategories] = useState<Category[]>(NATAL_CATEGORIES);
  const [natalThreads, setNatalThreads] = useState<Thread[]>([]);
  const [transitThreads, setTransitThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
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

      const { me, categories: cats, natalThreads: natal, transitThreads: transit } =
        json.data as {
          me?: Record<string, unknown>;
          categories?: Array<{
            slug: string;
            nameTh: string;
            accessLevel: string;
            suggestedQuestions?: string[];
          }>;
          natalThreads?: Thread[];
          transitThreads?: Thread[];
        };

      if (me) {
        setUser({
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
        });
      }

      if (Array.isArray(cats) && cats.length > 0) {
        setCategories(cats.map(mapApiCategory));
      }
      if (Array.isArray(natal)) setNatalThreads(natal);
      if (Array.isArray(transit)) setTransitThreads(transit);
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

  useEffect(() => {
    // Initial data load on mount — async fetch is intentional here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

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

  const value = useMemo(
    () => ({
      user,
      categories,
      natalThreads,
      transitThreads,
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
    }),
    [
      user,
      categories,
      natalThreads,
      transitThreads,
      loading,
      loadError,
      searchQuery,
      filteredCategories,
      filteredNatalThreads,
      filteredTransitThreads,
      load,
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
