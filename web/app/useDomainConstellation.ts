import { useMemo } from "react";
import type { Testament as BibleTestament } from "@/lib/bibleTaxonomy";
import type { BreakdownTab, ScopeScore } from "./homeTypes";

export function useDomainConstellation({
  activeBreakdownTab,
  profileTestament,
  scopeScores,
  scriptureConnectionsUnlocked,
}: {
  activeBreakdownTab: BreakdownTab;
  profileTestament: BibleTestament;
  scopeScores: ScopeScore[];
  scriptureConnectionsUnlocked: boolean;
}) {
  return useMemo(() => {
    if (activeBreakdownTab !== "domains") {
      return { active: false, points: [] as { angle: number; pct: number }[] };
    }
    const domains = scopeScores.filter(score => score.testament === profileTestament);
    const points = domains.map((score, index) => {
      const isLockedConnection = score.key.endsWith(":scripture_connections") && !scriptureConnectionsUnlocked;
      const pct = isLockedConnection || score.rawScore === null || score.answered === 0
        ? 0
        : Math.max(0, Math.min(100, score.rawScore));
      const angle = -Math.PI / 2 + (index / Math.max(domains.length, 1)) * Math.PI * 2;
      return { angle, pct };
    });
    return { active: true, points };
  }, [activeBreakdownTab, profileTestament, scopeScores, scriptureConnectionsUnlocked]);
}
