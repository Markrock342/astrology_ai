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
  creditBalance: number;
  canChat: boolean;
  emailVerified: boolean;
  needsEmailVerification: boolean;
  hasPassword: boolean;
};

type AppDataContextValue = {
  user: AppUser | null;
  categories: Category[];
  threads: Thread[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredCategories: Category[];
  filteredThreads: Thread[];
  refresh: () => void;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [categories, setCategories] = useState<Category[]>(NATAL_CATEGORIES);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, catRes, threadRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/horoscope/categories"),
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
            creditBalance: meJson.data.creditBalance,
            canChat: meJson.data.canChat ?? meJson.data.plan === "PRO",
            emailVerified: meJson.data.emailVerified ?? true,
            needsEmailVerification: meJson.data.needsEmailVerification ?? false,
            hasPassword: meJson.data.hasPassword ?? false,
          });
        }
      }

      if (catRes.ok) {
        const catJson = await catRes.json();
        if (catJson.ok && Array.isArray(catJson.data) && catJson.data.length > 0) {
          setCategories(catJson.data.map(mapApiCategory));
        }
      }

      if (threadRes.ok) {
        const threadJson = await threadRes.json();
        if (threadJson.ok && Array.isArray(threadJson.data)) {
          setThreads(threadJson.data);
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
  const filteredThreads = useMemo(
    () =>
      q
        ? threads.filter(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              t.categoryLabel?.toLowerCase().includes(q),
          )
        : threads,
    [threads, q],
  );

  const value = useMemo(
    () => ({
      user,
      categories,
      threads,
      loading,
      searchQuery,
      setSearchQuery,
      filteredCategories,
      filteredThreads,
      refresh: load,
    }),
    [
      user,
      categories,
      threads,
      loading,
      searchQuery,
      filteredCategories,
      filteredThreads,
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
