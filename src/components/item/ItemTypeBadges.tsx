import { Badge } from "@/components/ui/Badge";
import { itemTypeLabel } from "@/lib/wiki/taxonomy";

/** One badge per raw `data.json` type key; items can legitimately have several. */
export function ItemTypeBadges({ types }: { types: string[] }) {
  if (types.length === 0) {
    return <Badge className="border-white/10 bg-white/[0.03] text-stone-500">Unclassified</Badge>;
  }

  return (
    <>
      {types.map((typeKey) => (
        <Badge key={typeKey} className="border-white/10 bg-white/[0.03] text-stone-400">
          {itemTypeLabel(typeKey)}
        </Badge>
      ))}
    </>
  );
}
