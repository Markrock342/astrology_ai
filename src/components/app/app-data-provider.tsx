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
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, catRes, natalRes, transitRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/horoscope/categories"),
        fetch("/api/conversations?mode=NATAL"),
        fetch("/api/conversations?mode=TRANSIT"),
      ]);

      if (meRes.ok) {
        const meJson = await meRes.json();
        if (meJson.ok && meJson.data) {
          setUser({
            name: meJson.data.name ?? meJson.data.email?.split("@")[0] ?? "ผู้ใช้",
            email: meJson.data.email,
            image: meJson.data.image ?? null,
            plan: meJson.data.plan,
            role: meJson.data.role ?? "USER",
            creditBalance: meJson.data.creditBalance,
            canChat: meJson.data.canChat ?? meJson.data.plan === "PRO",
            emailVerified: meJson.data.emailVerified ?? true,
            needsEmailVerification: meJson.data.needsEmailVerification ?? false,
            hasPassword: meJson.data.hasPassword ?? false,
            birthEditsUnlimited: Boolean(meJson.data.birthEditsUnlimited),
          });
        }
      }

      if (catRes.ok) {
        const catJson = await catRes.json();
        if (catJson.ok && Array.isArray(catJson.data) && catJson.data.length > 0) {
          setCategories(catJson.data.map(mapApiCategory));
        }
      }

      if (natalRes.ok) {
        const natalJson = await natalRes.json();
        if (natalJson.ok && Array.isArray(natalJson.data)) {
          setNatalThreads(natalJson.data);
        }
      }

      if (transitRes.ok) {
        const transitJson = await transitRes.json();
        if (transitJson.ok && Array.isArray(transitJson.data)) {
          setTransitThreads(transitJson.data);
        }
      }
    } finally {
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
