import type { CommunityGroup } from "@/lib/community";
import type { MessageKey } from "@/i18n/messages";

export const COMMUNITY_GROUP_KEYS: Record<CommunityGroup, MessageKey> = {
  Infographic: "community.group.infographic",
  Diagram: "community.group.diagram",
  "Data & Map": "community.group.dataMap",
  "Poster & Ad": "community.group.posterAd",
  Product: "community.group.product",
  Editorial: "community.group.editorial",
  Illustration: "community.group.illustration",
};

export const COMMUNITY_QUERY_KEYS: Record<string, MessageKey> = {
  "infographic layout": "inspire.query.infographic",
  "technical diagram": "inspire.query.diagram",
  "data visualization": "inspire.query.data",
  "bold poster": "inspire.query.poster",
  "product showcase": "inspire.query.product",
  "editorial layout": "inspire.query.editorial",
  "illustrated style": "inspire.query.illustration",
};

