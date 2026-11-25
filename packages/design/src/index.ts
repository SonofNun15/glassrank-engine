/**
 * @glassrank/design
 *
 * React components for the GlassRank design system. Load the styles once in
 * the app: `@glassrank/design/tokens.css`, then `@glassrank/design/components.css`.
 * Icons come from `lucide-react` (ISC license; see LUCIDE-LICENSE.txt).
 */
export {
  Button,
  DeltaChip,
  Field,
  GlassPanel,
  Logo,
  Mark,
  RatingBadge,
  ReceiptCard,
  Tag,
  headlineBody,
} from "./components";
export type { ButtonProps, Explanation, ProvisionalRange } from "./components";
export { formatDelta, formatRange, formatRating } from "./format";
