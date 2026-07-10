// Community style catalog — reusable slide design systems distilled from the
// YouMind-OpenLab "Awesome Nano Banana Pro Prompts" gallery (CC BY 4.0). Each item
// contributes a <page_style> block to buildImagePrompt, exactly like lib/templates.ts,
// but sourced from the community and surfaced in the home Community gallery + the
// post-outline "inspiration" step. Pure-person portraits were filtered out; only
// PPT-usable visual systems (infographics, diagrams, posters, data/maps, editorial,
// product, illustration) are kept. GENERATED — see scratchpad/gen.mjs.

export type CommunityGroup =
  | "Infographic"
  | "Diagram"
  | "Data & Map"
  | "Poster & Ad"
  | "Product"
  | "Editorial"
  | "Illustration";

export type Density = "low" | "medium" | "high";

export interface CommunityTemplate {
  id: string;
  name: string;
  group: CommunityGroup;
  description: string;
  tags: string[];
  palette: string[]; // hex, first = primary accent
  density: Density;
  styleBlock: string; // injected verbatim into <page_style>
  cover: string; // public path, e.g. "/community/<id>.jpg"
  author?: string;
  sourceUrl?: string;
}

export const COMMUNITY_GROUPS: CommunityGroup[] = ["Infographic", "Diagram", "Data & Map", "Poster & Ad", "Product", "Editorial", "Illustration"];

export const COMMUNITY_TEMPLATES: CommunityTemplate[] = [
  { id: "nb-golden-serif-quote", name: "Golden Serif Quote", group: "Editorial", description: "A warm brown quote card with a soft-faded portrait on one side and one oversized light-gold serif statement on the other.", tags: ["quote","editorial","testimonial","portrait","serif","warm","minimal","keynote"], palette: ["#C9A24B","#3B2A1F","#E8D9BE"], density: "low", styleBlock: "Warm brown canvas with a single light-gold serif voice. A portrait anchors one-third of the frame behind a soft gradient fade while an oversized subtle quotation mark and one large serif statement command the remaining two-thirds. Intimate, editorial, and quietly premium — built for a single memorable line per slide.", cover: "/community/nb-golden-serif-quote.jpg", author: "Nicolechan", sourceUrl: "https://x.com/stark_nico99/status/1991718646570426763" },
  { id: "nb-liquid-glass-bento", name: "Liquid Glass Bento", group: "Infographic", description: "An asymmetric 16:9 bento grid of transparent Apple-style liquid-glass cards floating over a blurred, color-derived ground.", tags: ["bento","glassmorphism","product","infographic","dashboard","3d","modern","premium","grid"], palette: ["#2DD4BF","#0B1220","#E8EEF5","#7C93A8"], density: "high", styleBlock: "Apple-style liquid glass over a softly blurred, color-derived ground: an asymmetric 16:9 bento grid of 85-90% transparent cards with whisper-thin borders, subtle drop shadows, and floating depth. One oversized hero cell carries a photoreal or 3D-grade centerpiece while the remaining modules hold crisp titled facts with muted-tint icons. Premium, glossy, and modular — every slide reads as a curated dashboard.", cover: "/community/nb-liquid-glass-bento.jpg", author: "Mansi Sanghani", sourceUrl: "https://x.com/MansiSanghani1/status/2013550795224961492" },
  { id: "nb-handdrawn-gradient-header", name: "Hand-Drawn Header", group: "Illustration", description: "A loose, italic hand-drawn illustration under a blue-to-green gradient with a clear title band, styled like an explainer header.", tags: ["hand-drawn","illustration","header","gradient","casual","education","intro","friendly"], palette: ["#2FBF9F","#2E86AB","#F5F7F2"], density: "low", styleBlock: "Loose hand-drawn illustration washed in a blue-to-green gradient, with light italic sketch linework and an approachable, human feel. A simple illustrated character or motif sits beside a clear title band in 16:9, like the header of a well-designed explainer. Casual, warm, and inviting — good for intros, section openers, and lightweight topics.", cover: "/community/nb-handdrawn-gradient-header.jpg", author: "セミナー講師専門AIコンシェルジュ｜工藤 晶", sourceUrl: "https://x.com/akirakudo_ai/status/1992096860765561190" },
  { id: "nb-watercolor-map", name: "Watercolor Annotated Map", group: "Data & Map", description: "Soft watercolor regions on off-white paper, each zone hand-labeled in fine ballpoint-pen script.", tags: ["map","watercolor","education","geography","hand-drawn","annotated","segmentation","data"], palette: ["#7FB2C9","#F3EDE0","#4A4A4A","#C98B6B"], density: "medium", styleBlock: "Soft watercolor washes on off-white paper, regions bleeding into gentle pastel fields, every zone hand-labeled in fine ballpoint-pen script. An artful, tactile take on cartography and territory diagrams that trades cold precision for warmth. Educational and charming — ideal for geographies, segmentations, or any 'map of a space'.", cover: "/community/nb-watercolor-map.jpg", author: "Florian Gallwitz", sourceUrl: "https://x.com/FlorianGallwitz/status/1991796624646091091" },
  { id: "nb-vintage-patent", name: "Vintage Patent Filing", group: "Diagram", description: "An aged 1800s patent filing with numbered technical drawings, fountain-pen notes, an embossed seal, and a red wax stamp.", tags: ["vintage","patent","diagram","technical","archival","blueprint","retro","annotated"], palette: ["#8B2A1F","#E8DCC0","#3A2E1F"], density: "medium", styleBlock: "A recovered 1800s patent filing: aged ivory paper with foxing stains and fold creases, precise technical line drawings with numbered callouts (Fig. 1, Fig. 2), and fountain-pen annotations describing each part. An embossed seal and red wax stamp anchor a corner while a signature and date close the page. Authoritative, historic, and slightly mysterious — turns any mechanism or concept into an archival document.", cover: "/community/nb-vintage-patent.jpg", author: "Alexandra Aisling", sourceUrl: "https://x.com/AllaAisling/status/2004212035333365763" },
  { id: "nb-chalkboard-lesson", name: "Chalkboard Lesson", group: "Infographic", description: "A teacher's chalkboard of hand-written notes, quick diagrams, arrows, and circled key terms in white and pastel chalk.", tags: ["chalkboard","hand-drawn","education","summary","diagram","notes","casual","teaching"], palette: ["#E4B95B","#1F2A24","#F4F1E9","#6FB2A0"], density: "high", styleBlock: "A teacher's chalkboard: a dark slate ground filled with hand-written chalk lettering, quick sketched diagrams, arrows, and circled key terms in white with pastel chalk accents. Content is broken into approachable, explained beats as if drawn live during a lesson. Warm, informal, and genuinely instructive — perfect for summaries, how-it-works breakdowns, and study notes.", cover: "/community/nb-chalkboard-lesson.jpg", author: "ひでもん | AI開発@ニュース発信", sourceUrl: "https://x.com/okknews/status/1992173611520868372" },
  { id: "nb-bold-product-ad", name: "Bold Product Ad", group: "Poster & Ad", description: "A bold commercial ad with a dimensional 3D product hero wrapped in loud promotional copy and ranking badges.", tags: ["advertising","product","marketing","promo","poster","bold","launch","commercial"], palette: ["#E63946","#1A1A1A","#FFFFFF","#F0C808"], density: "medium", styleBlock: "A punchy commercial ad layout: a single product rendered in dimensional 3D hero placement, wrapped in bold promotional copy, ranking badges, and a loud pre-head banner. High-contrast type stacks and accent call-outs sell one offer hard. Confident, retail-ready, and conversion-minded — built to make a product the unmistakable star of the slide.", cover: "/community/nb-bold-product-ad.jpg", author: "KAWAI", sourceUrl: "https://x.com/kawai_design/status/1992142466255114727" },
  { id: "nb-hyperreal-product-poster", name: "Hyperreal Product Poster", group: "Poster & Ad", description: "Hyper-real advertising photography of a product hero caught in an authentic action moment under warm golden light.", tags: ["advertising","product","photography","marketing","poster","lifestyle","premium","realistic"], palette: ["#A7D129","#F6E23A","#FFFFFF","#B7C9C4"], density: "medium", styleBlock: "Hyper-real advertising photography with an official-campaign polish: a product hero — condensation, micro-bubbles, crisp highlights — caught in an authentic real-world moment under warm golden light. A disciplined composition budget hands most of the frame to human action and product, keeping environment and tight typography minimal. Vivid, premium, and believable — a flagship brand poster for any product.", cover: "/community/nb-hyperreal-product-poster.jpg", author: "ᴍᴜʀᴘʜʏ", sourceUrl: "https://x.com/Diplomeme/status/2075083065127571574" },
  { id: "nb-technical-cutaway", name: "Technical Cutaway", group: "Diagram", description: "A hyper-realistic cutaway on white that opens the subject to reveal detailed interior components with thin-line callouts.", tags: ["cutaway","technical","diagram","product","engineering","education","realistic","callouts"], palette: ["#D64541","#FFFFFF","#1D1D1F","#8A8F98"], density: "medium", styleBlock: "A hyper-realistic cutaway on a clean white background: the subject sliced open to reveal densely detailed interior components, each named by a thin-line text callout. High-focus rendering treats the object like a museum specimen. Precise, technical, and premium — turns any product, tool, or structure into an authoritative 'how it's built' slide.", cover: "/community/nb-technical-cutaway.jpg", author: "Pierrick Chevallier | IA", sourceUrl: "https://x.com/CharaspowerAI/status/2073104523476828533" },
  { id: "nb-3d-character-storyboard", name: "3D Character Storyboard", group: "Infographic", description: "A crisp white storyboard poster with hard black borders, bold type, and dramatic Pixar-style 3D stylized renders.", tags: ["3d","storyboard","character","infographic","playful","process","narrative","bold"], palette: ["#FF5A1F","#FFFFFF","#111111","#E01E37"], density: "high", styleBlock: "A crisp storyboard poster: white ground, hard black panel borders, and bold black typography framing premium Pixar-style 3D stylized renders. Dramatic saturated lighting gives each character or scene cinematic punch across a wide 16:9 grid. Playful yet structured — great for profiles, journeys, and step-by-step narratives with personality.", cover: "/community/nb-3d-character-storyboard.jpg", author: "𝐌", sourceUrl: "https://x.com/Strength04_X/status/2071466852614816182" },
  { id: "nb-luminous-scan-render", name: "Luminous Scan Render", group: "Illustration", description: "A single subject rendered as luminous, semi-transparent glowing tissue floating on a clean white-to-grey gradient.", tags: ["3d","medical","glow","render","hero","futuristic","minimal","technical"], palette: ["#2BE38A","#F2F5F3","#0D1B12","#7CF2B8"], density: "low", styleBlock: "An advanced medical-scan aesthetic: a single subject rendered as luminous, semi-transparent structure — interwoven lit fibers, nodes, and glowing pathways — floating on a clean white-to-grey gradient. Minimalist, high-focus, and text-free, letting the glowing form carry the slide. Clean, technological, and futuristic — a striking hero visual for anatomy, systems, or anything you want to show 'lit from within'.", cover: "/community/nb-luminous-scan-render.jpg", author: "Dera | Performance marketing Creative", sourceUrl: "https://x.com/Ifekaego1/status/2068607373200039956" },
  { id: "nb-summary-infographic", name: "Summary Infographic", group: "Infographic", description: "A clean infographic that organizes a complex subject into grouped cards, icons, and short labeled facts.", tags: ["infographic","summary","education","relationships","cards","data","structured","overview"], palette: ["#2563EB","#0F172A","#F8FAFC","#F59E0B"], density: "high", styleBlock: "A clean summary infographic that organizes a complex subject into a legible visual hierarchy: grouped cards, portraits or icons, connecting lines, and short labeled facts arranged for fast comprehension. Structure over decoration, with a restrained accent guiding the eye through relationships. Clear, encyclopedic, and information-dense — built to make a tangled topic instantly scannable.", cover: "/community/nb-summary-infographic.jpg", author: "ファーラ@ガンプラ", sourceUrl: "https://x.com/Live_05/status/2065366252391113120" },
  { id: "nb-retro-industrial-concept", name: "Retro Industrial Concept", group: "Product", description: "A realistic alternate-history render reimagining an object through muted mid-century industrial design.", tags: ["retro","industrial","product","concept","vintage","design","render","realistic"], palette: ["#B04A3A","#6E7B6B","#C9C1AE","#2E2E2C"], density: "low", styleBlock: "A realistic alternate-history industrial render: a designed object reimagined through mid-century engineering — a muted utilitarian palette, honest materials, restrained chrome, and period-correct forms. Photographic lighting sells it as a genuine archival product shot. Retro, tactile, and conceptual — ideal for design concepts, 'what-if' variants, and heritage-flavored product stories.", cover: "/community/nb-retro-industrial-concept.jpg", author: "Riccardo", sourceUrl: "https://x.com/Riccardo_Nero/status/2065184321514664239" },
  { id: "nb-neo-parametric-editorial", name: "Neo-Parametric Editorial", group: "Editorial", description: "Painterly editorial illustration fused with blueprint overlays in a luxury ivory, gold, and steel-blue palette.", tags: ["editorial","illustration","blueprint","technical","luxury","parametric","schematic","sophisticated"], palette: ["#C9A96A","#F0EBE0","#4A5568","#6B8BA3"], density: "medium", styleBlock: "Neo-parametric editorial illustration: elegant painterly rendering fused with blueprint overlays — flowing linework, cross-hatching, drafting grids, dimensional annotations, and engineering schematics threaded through the subject. A luxury palette of ivory, champagne gold, graphite, and steel blue sits under soft cinematic light with controlled line density. Intellectual, futuristic, and museum-grade — where organic form meets technical drawing.", cover: "/community/nb-neo-parametric-editorial.jpg", author: "zayan", sourceUrl: "https://x.com/HustleXR/status/2064955550971121953" },
  { id: "nb-pastel-chalk-knolling", name: "Pastel Chalk Knolling", group: "Illustration", description: "Soft pastel chalk specimens arranged in a top-down knolling grid with a larger hero piece at center.", tags: ["knolling","chalk","illustration","grid","collection","pastel","comparison","catalog"], palette: ["#B7D84B","#F3E9D2","#E39FB0","#7FB6C9"], density: "medium", styleBlock: "Soft pastel chalk-art specimens arranged in a precise top-down knolling grid, with visible chalk dust and paper grain and one larger hero piece anchoring the center. Gently blended colors sit on a saturated flat ground with clean negative space. Tactile, curated, and calm — a beautiful way to lay out a collection, taxonomy, or set of comparable items.", cover: "/community/nb-pastel-chalk-knolling.jpg", author: "Heather Green", sourceUrl: "https://x.com/heathergreen/status/2063412874232352859" },
  { id: "nb-watercolor-moodboard", name: "Watercolor Moodboard", group: "Editorial", description: "A watercolor lifestyle moodboard of painted vignettes, handwritten script titles, and short notes on off-white paper.", tags: ["watercolor","moodboard","editorial","collage","lifestyle","handwritten","travel","artisanal"], palette: ["#6B7A4F","#8B6A4A","#C9A24B","#F0EAD9"], density: "medium", styleBlock: "A watercolor lifestyle moodboard: a central figure or subject surrounded by loose painted vignettes, elegant handwritten script titles, and short bulleted notes on off-white paper texture. An earthy palette of greens, browns, and warm washes ties the collage together. Romantic, artisanal, and story-driven — perfect for narratives, brand worlds, and travel-flavored themes.", cover: "/community/nb-watercolor-moodboard.jpg", author: "Minahil", sourceUrl: "https://x.com/Minahil42298354/status/2063186164043903032" },
  { id: "nb-engineering-blueprint-grid", name: "Engineering Blueprint Grid", group: "Diagram", description: "A dense engineering infographic grid of photoreal cutaways, exploded views, dimension lines, and color-coded arrows.", tags: ["engineering","blueprint","diagram","exploded","technical","grid","product","industrial"], palette: ["#2563EB","#FFFFFF","#111111","#EA580C"], density: "high", styleBlock: "An ultra-detailed engineering infographic: a clean ground split by sharp separator lines into a precise grid, each cell holding a photoreal 3D render with transparent cutaways, exploded views, dimension lines, callout boxes, and color-coded engineering arrows. Apple-style industrial-design documentation, dense with precise technical labels. Rigorous, high-end, and authoritative — the definitive 'anatomy of the product' layout.", cover: "/community/nb-engineering-blueprint-grid.jpg", author: "⁠ luciaAI", sourceUrl: "https://x.com/luciaverseai/status/2062938095109255382" },
  { id: "nb-multi-angle-grid", name: "Multi-Angle Photo Grid", group: "Product", description: "One subject shown from many angles tiled into a clean nine-square grid against a softly blurred natural backdrop.", tags: ["grid","photography","product","multi-angle","showcase","gallery","perspective","collage"], palette: ["#6FA8DC","#7FA05A","#E8E2D0","#3B3B3B"], density: "medium", styleBlock: "One subject shot from many vantage points and tiled into a clean nine-square grid — distant, medium, and close-up framings mixing angles and crops against a softly blurred natural backdrop. Consistent light and color unify the panels into a single study. Cinematic and comprehensive — a strong way to present a subject, product, or place from every side on one slide.", cover: "/community/nb-multi-angle-grid.jpg", author: "coloringany.com", sourceUrl: "https://x.com/zhoumeng780/status/2062066820656550311" },
  { id: "nb-visual-info-guide", name: "Visual Info Guide", group: "Data & Map", description: "A real photo turned into an annotated information-visualization guide with labeled points and short descriptive notes.", tags: ["guide","infographic","annotated","location","travel","overlay","education","map"], palette: ["#0EA5E9","#F8FAFC","#0F172A","#F59E0B"], density: "medium", styleBlock: "A photo transformed into an information-visualization guide: the real scene kept as the backdrop while clean overlays — annotation lines, labeled points of interest, stat chips, and short descriptive notes — explain what you're looking at. Editorial infographic polish sits lightly over authentic imagery. Informative and immersive — turns any place, object, or scene into a guided, annotated overview.", cover: "/community/nb-visual-info-guide.jpg", author: "AI探路者Tim", sourceUrl: "https://x.com/AIExplorerTim/status/2062017023081848863" },
  { id: "nb-exploded-layers", name: "Exploded Layer Stack", group: "Infographic", description: "A hyper-real exploded breakdown of stacked horizontal layers, each tagged with a thin pointer line on a bright studio ground.", tags: ["exploded","layers","infographic","product","cross-section","breakdown","studio","food"], palette: ["#F5C518","#FFFFFF","#1A1A1A","#E07A2F"], density: "medium", styleBlock: "A hyper-real exploded breakdown: the subject separated into cleanly aligned horizontal layers stacked top-to-bottom, each tagged with a thin pointer line and a short label, floating on a bright seamless studio background. Commercial-photography lighting gives every layer crisp reflections and soft shadows. Appetizing, premium, and self-explaining — the ideal 'what's inside, layer by layer' slide.", cover: "/community/nb-exploded-layers.jpg", author: "𝐌", sourceUrl: "https://x.com/Strength04_X/status/2061027904738496976" },
  { id: "nb-lifestyle-product-shot", name: "Lifestyle Product Shot", group: "Product", description: "Bright, sun-drenched lifestyle photography with a model presenting a razor-sharp product in a joyful outdoor scene.", tags: ["product","lifestyle","photography","marketing","bright","outdoor","aspirational","hero"], palette: ["#12B5C9","#F4C542","#5EC8E5","#FFF6E5"], density: "low", styleBlock: "Bright, sun-drenched lifestyle product photography: a happy model presents the product straight to camera with a shallow depth of field keeping the item razor-sharp against a joyful outdoor scene. Natural sunlight, a warm vibrant palette, and a slightly elevated angle sell mood and use in one shot. Energetic, aspirational, and human — makes any product feel like part of a good day.", cover: "/community/nb-lifestyle-product-shot.jpg", author: "Maddox", sourceUrl: "https://x.com/Maddox_Digital/status/2074154537259356554" },
  { id: "nb-editorial-action-poster", name: "Editorial Action Poster", group: "Poster & Ad", description: "A full-bleed action poster with enormous cropped cream block type and a hero subject breaking through the letters.", tags: ["poster","editorial","advertising","bold","typography","action","marketing","dynamic"], palette: ["#FF4D2E","#3FA9E0","#F3E8CE","#FFFFFF"], density: "medium", styleBlock: "A full-bleed editorial action poster: enormous warm-cream extra-condensed block letters cropped by the frame and sitting behind a hero subject that cuts diagonally across and breaks through the type layer. Hard midday sun, crisp shadows, a sky-blue neutral environment, one vivid accent on the hero, and tight clusters of white microcopy pinned to a strong grid. Kinetic, loud, and magazine-grade — action first, type second, detail third.", cover: "/community/nb-editorial-action-poster.jpg", author: "H A J R A", sourceUrl: "https://x.com/codewithhajra/status/2073422730171478176" },
];

export function getCommunityTemplate(id?: string | null): CommunityTemplate | undefined {
  if (!id) return undefined;
  return COMMUNITY_TEMPLATES.find((t) => t.id === id);
}

export function isCommunityTemplateId(id?: string | null): boolean {
  return !!id && COMMUNITY_TEMPLATES.some((t) => t.id === id);
}

/** The <page_style> paragraph for a community template (palette + density folded in). */
export function communityStyleBlock(t: CommunityTemplate): string {
  return [
    t.styleBlock,
    `Palette: ${t.palette.join(", ")} (first color is the accent).`,
    `Text density: ${t.density}.`,
  ].join(" ");
}

export function communityByGroup(): { group: CommunityGroup; templates: CommunityTemplate[] }[] {
  return COMMUNITY_GROUPS.map((group) => ({
    group,
    templates: COMMUNITY_TEMPLATES.filter((t) => t.group === group),
  })).filter((g) => g.templates.length > 0);
}

/**
 * Lightweight, offline requirement→style matching for the inspiration step.
 * Scores each template by keyword overlap of the query against tags/name/group/
 * description (English). Returns templates sorted by score desc; ties keep catalog
 * order. A codex-backed re-rank (POST /api/inspire) refines this when available.
 */
export function scoreCommunityTemplates(query: string): { t: CommunityTemplate; score: number }[] {
  const q = (query || "").toLowerCase();
  const tokens = Array.from(new Set(q.split(/[^a-z0-9]+/).filter((w) => w.length >= 3)));
  return COMMUNITY_TEMPLATES.map((t) => {
    const hay = [t.name, t.group, t.description, t.tags.join(" ")].join(" ").toLowerCase();
    let score = 0;
    for (const tok of tokens) {
      if (t.tags.some((tag) => tag.includes(tok) || tok.includes(tag))) score += 3;
      else if (hay.includes(tok)) score += 1;
    }
    return { t, score };
  });
}

export function matchCommunityTemplates(query: string, limit?: number): CommunityTemplate[] {
  const scored = scoreCommunityTemplates(query)
    .map((s, i) => ({ ...s, i }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((s) => s.t);
  return typeof limit === "number" ? scored.slice(0, limit) : scored;
}

// ---- inspiration step helpers ------------------------------------------

/** A short, human-readable search query seeded from the deck's requirement/title. */
export function inspireQueryFor(requirement: string, title?: string): string {
  const base = (title || requirement || "").trim().replace(/\s+/g, " ");
  return base.slice(0, 60) || "presentation design";
}

/** Canonical search phrase for each community group, used for the "Try:" chips. */
export const GROUP_QUERY: Record<CommunityGroup, string> = {
  Infographic: "infographic layout",
  Diagram: "technical diagram",
  "Data & Map": "data visualization",
  "Poster & Ad": "bold poster",
  Product: "product showcase",
  Editorial: "editorial layout",
  Illustration: "illustrated style",
};

/**
 * Offline "Try:" suggestion chips (like the reference gallery's query hints):
 * the groups whose templates best match the query, phrased as re-search queries.
 * Falls back to a sensible popular set when nothing matches (e.g. a CJK query the
 * English catalog can't score — the codex /api/inspire re-rank refines those).
 */
export function inspireChips(query: string, n = 3): string[] {
  const scored = scoreCommunityTemplates(query)
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  const groups: CommunityGroup[] = [];
  for (const s of scored) {
    if (!groups.includes(s.t.group)) groups.push(s.t.group);
    if (groups.length >= n) break;
  }
  const fill: CommunityGroup[] = ["Infographic", "Data & Map", "Editorial", "Diagram"];
  for (const g of fill) {
    if (groups.length >= n) break;
    if (!groups.includes(g)) groups.push(g);
  }
  return groups.slice(0, n).map((g) => GROUP_QUERY[g]);
}

/** Full catalog reordered so the given ids come first (in order); rest keep catalog order. */
export function orderedByIds(ids: string[]): CommunityTemplate[] {
  const seen = new Set<string>();
  const head: CommunityTemplate[] = [];
  for (const id of ids) {
    const t = getCommunityTemplate(id);
    if (t && !seen.has(t.id)) {
      head.push(t);
      seen.add(t.id);
    }
  }
  return [...head, ...COMMUNITY_TEMPLATES.filter((t) => !seen.has(t.id))];
}
