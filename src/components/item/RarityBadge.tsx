import { Badge } from "@/components/ui/Badge";
import { RARITY_META } from "@/lib/wiki/taxonomy";
import type { Rarity } from "@/lib/wiki/types";

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  const meta = RARITY_META[rarity];
  return (
    <Badge className={meta.badge}>
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </Badge>
  );
}
