"use client";

import { useEffect, useState } from "react";

import {
  selectedViewFromCache,
  type DashboardSnapshot,
  type ViewsCache,
} from "@/lib/dashboard-cache";
import {
  buildLocalDashboardSnapshot,
  mapLocalViewToViewCacheItem,
  synthesizeAllListsView,
} from "@/lib/local-first-dashboard";
import {
  listLocalListsForUser,
  listLocalListItemsForUser,
  listLocalListTagsForUser,
  listLocalTagsForUser,
  listLocalViewListsForUser,
  listLocalViewTagsForUser,
  listLocalViewsForUser,
} from "@/lib/local-db/local-repositories";
import { createClient } from "@/lib/supabase/client";

export type LocalFirstDashboardBoot = {
  localViews: ViewsCache | undefined;
  localCurrentView: DashboardSnapshot | undefined;
  localBootReady: boolean;
  userId: string | null;
};

const supabase = createClient();

export function useLocalFirstDashboardBoot(): LocalFirstDashboardBoot {
  const [boot, setBoot] = useState<LocalFirstDashboardBoot>({
    localViews: undefined,
    localCurrentView: undefined,
    localBootReady: false,
    userId: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function bootFromLocalDb() {
      if (typeof window === "undefined") return;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user.id;

        if (!userId) {
          if (!cancelled) {
            setBoot({
              localViews: undefined,
              localCurrentView: undefined,
              localBootReady: true,
              userId: null,
            });
          }
          return;
        }

        const [
          storedViews,
          storedLists,
          storedListItems,
          storedTags,
          storedListTags,
          storedViewLists,
          storedViewTags,
        ] = await Promise.all([
          listLocalViewsForUser(userId),
          listLocalListsForUser(userId),
          listLocalListItemsForUser(userId),
          listLocalTagsForUser(userId),
          listLocalListTagsForUser(userId),
          listLocalViewListsForUser(userId),
          listLocalViewTagsForUser(userId),
        ]);
        const localViews: ViewsCache = storedViews.length > 0
          ? storedViews
            .map((view) =>
              mapLocalViewToViewCacheItem(
                view,
                storedViewTags,
                storedViewLists,
                storedTags,
              )
            )
            .sort((left, right) =>
              left.order - right.order || left.id.localeCompare(right.id)
            )
          : [synthesizeAllListsView(userId)];
        const defaultView = selectedViewFromCache(localViews);
        const localCurrentView = defaultView
          ? buildLocalDashboardSnapshot(defaultView, {
            lists: storedLists,
            listItems: storedListItems,
            tags: storedTags,
            listTags: storedListTags,
          })
          : undefined;

        if (!cancelled) {
          setBoot({
            localViews,
            localCurrentView,
            localBootReady: true,
            userId,
          });
        }
      } catch {
        if (!cancelled) {
          setBoot((current) => ({
            ...current,
            localBootReady: true,
          }));
        }
      }
    }

    void bootFromLocalDb();

    return () => {
      cancelled = true;
    };
  }, []);

  return boot;
}
