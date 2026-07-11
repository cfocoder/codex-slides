import type { Aspect } from "./types";

export type ScenarioGroupId =
  | "create"
  | "transform"
  | "data"
  | "research"
  | "optimize"
  | "delivery";

export type ScenarioIcon =
  | "sparkle"
  | "report"
  | "rocket"
  | "briefcase"
  | "wand"
  | "document"
  | "notes"
  | "images"
  | "chart"
  | "calendar"
  | "finance"
  | "survey"
  | "search"
  | "trend"
  | "compare"
  | "books"
  | "brand"
  | "replica"
  | "translate"
  | "restructure"
  | "training"
  | "keynote"
  | "portfolio"
  | "batch";

export interface LocalizedScenarioText {
  "zh-CN": string;
  en: string;
}

export interface ScenarioInputSlot {
  id: string;
  label: LocalizedScenarioText;
  detail: LocalizedScenarioText;
  accept: string;
  required?: boolean;
  multiple?: boolean;
}

export interface PresentationScenario {
  id: string;
  group: ScenarioGroupId;
  icon: ScenarioIcon;
  featured?: boolean;
  name: LocalizedScenarioText;
  description: LocalizedScenarioText;
  output: LocalizedScenarioText;
  starter: LocalizedScenarioText;
  /** Stable model-facing workflow contract; user edits remain separate. */
  instruction: string;
  keywords: string[];
  defaults: {
    pages: number;
    aspect: Aspect;
    style: string;
    research?: boolean;
  };
  slots: ScenarioInputSlot[];
}

const deckAccept = ".ppt,.pptx,.pdf";
const documentAccept = ".pdf,.doc,.docx,.rtf,.odt,.txt,.md,.ppt,.pptx";
const dataAccept = ".csv,.tsv,.xls,.xlsx,.json";
const imageAccept = "image/png,image/jpeg,image/webp,image/gif";
const brandAccept = `${imageAccept},.pdf,.ppt,.pptx,.doc,.docx`;

const text = (zh: string, en: string): LocalizedScenarioText => ({ "zh-CN": zh, en });
const slot = (
  id: string,
  zh: string,
  en: string,
  zhDetail: string,
  enDetail: string,
  accept: string,
  required = false,
  multiple = true,
): ScenarioInputSlot => ({
  id,
  label: text(zh, en),
  detail: text(zhDetail, enDetail),
  accept,
  required,
  multiple,
});

export const SCENARIO_GROUPS: Array<{
  id: ScenarioGroupId;
  label: LocalizedScenarioText;
  description: LocalizedScenarioText;
}> = [
  { id: "create", label: text("从零创作", "Create"), description: text("把想法组织成完整演示", "Turn an idea into a complete deck") },
  { id: "transform", label: text("材料转演示", "Transform sources"), description: text("让现有材料直接成为演示", "Turn existing material into slides") },
  { id: "data", label: text("数据与洞察", "Data & insights"), description: text("分析数据并讲清楚结论", "Analyze data and explain what matters") },
  { id: "research", label: text("研究与决策", "Research & decisions"), description: text("搜索、验证、综合并呈现", "Search, verify, synthesize, and present") },
  { id: "optimize", label: text("优化现有稿", "Optimize a deck"), description: text("重做视觉、结构与版本", "Improve visuals, structure, and variants") },
  { id: "delivery", label: text("专项交付", "Specialized outputs"), description: text("面向具体工作任务的成品", "Purpose-built presentation deliverables") },
];

export const PRESENTATION_SCENARIOS: PresentationScenario[] = [
  {
    id: "new-deck",
    group: "create",
    icon: "sparkle",
    featured: true,
    name: text("从 0 到 1 生成", "Create from scratch"),
    description: text("从一个主题开始，完成结构、文案、视觉与整套页面", "Go from a topic to narrative, copy, visuals, and a finished deck"),
    output: text("完整可编辑演示文稿", "Complete editable presentation"),
    starter: text("为【主题】制作一份面向【受众】的演示文稿，目标是【希望对方理解或采取的行动】。", "Create a presentation about [topic] for [audience], with the goal of [what they should understand or do]."),
    instruction: "Create a net-new presentation. Establish audience, decision or communication goal, and narrative arc before outlining. Make every slide earn its place and end with a clear takeaway or action.",
    keywords: ["主题", "生成", "空白", "idea", "topic", "new"],
    defaults: { pages: 8, aspect: "16:9", style: "clear modern editorial presentation with strong narrative hierarchy" },
    slots: [
      slot("brief", "补充材料", "Brief or notes", "DOCX / PDF / Markdown", "DOCX / PDF / Markdown", documentAccept),
      slot("brand", "品牌资产", "Brand assets", "Logo / 品牌手册", "Logo / brand guide", brandAccept),
      slot("reference", "视觉参考", "Visual references", "图片 / 截图", "Images / screenshots", imageAccept),
    ],
  },
  {
    id: "business-report",
    group: "create",
    icon: "report",
    name: text("工作汇报 / 总结", "Business report"),
    description: text("周报、月报、复盘、述职与管理层汇报", "Weekly, monthly, retrospective, performance, or leadership reporting"),
    output: text("结论先行的业务汇报", "Answer-first business report"),
    starter: text("把【时间范围 / 项目】整理成一份结论先行的工作汇报，突出成果、问题、原因和下一步。", "Turn [period / project] into an answer-first business report covering outcomes, issues, causes, and next steps."),
    instruction: "Build an answer-first business review. Separate outcomes, evidence, problems, root causes, decisions, and next actions. Use precise periods and metric definitions; never blur facts with interpretation.",
    keywords: ["汇报", "总结", "述职", "复盘", "weekly", "monthly", "review"],
    defaults: { pages: 10, aspect: "16:9", style: "executive business review, concise, structured, evidence-led" },
    slots: [
      slot("report-source", "汇报材料", "Report material", "文档 / 表格 / 旧汇报", "Documents / sheets / prior deck", `${documentAccept},${dataAccept}`),
      slot("brand", "公司模板", "Company template", "PPTX / 品牌手册", "PPTX / brand guide", brandAccept),
    ],
  },
  {
    id: "pitch-deck",
    group: "create",
    icon: "rocket",
    name: text("商业计划 / 融资路演", "Pitch deck"),
    description: text("把机会、产品、增长与商业模式讲成投资叙事", "Shape opportunity, product, traction, and business model into an investor story"),
    output: text("投资人路演稿", "Investor-ready pitch deck"),
    starter: text("为【公司 / 项目】制作融资路演稿，清楚呈现机会、方案、壁垒、增长证据、商业模式和融资用途。", "Create an investor pitch for [company / project] covering the opportunity, solution, moat, traction, business model, and use of funds."),
    instruction: "Create an investor-grade pitch narrative. Lead with the market pain and why-now, connect product proof to traction, state business model and defensibility, and distinguish verified metrics from assumptions.",
    keywords: ["融资", "路演", "BP", "创业", "investor", "pitch", "fundraising"],
    defaults: { pages: 12, aspect: "16:9", style: "confident investor storytelling with bold evidence and restrained visuals" },
    slots: [
      slot("pitch-source", "业务资料", "Business material", "BP / 产品资料 / 数据", "Plan / product / metrics", `${documentAccept},${dataAccept}`),
      slot("brand", "品牌资产", "Brand assets", "Logo / 产品图", "Logo / product images", brandAccept),
    ],
  },
  {
    id: "proposal",
    group: "create",
    icon: "briefcase",
    name: text("项目方案 / 客户提案", "Project proposal"),
    description: text("针对客户、项目或内部决策制作可执行方案", "Build an actionable proposal for a client, project, or internal decision"),
    output: text("可评审、可执行的方案稿", "Reviewable, actionable proposal"),
    starter: text("针对【客户 / 项目目标】提出一套方案，包含现状、目标、策略、实施路径、排期、资源和预期结果。", "Propose a plan for [client / project goal] covering context, goals, strategy, execution, timeline, resources, and expected outcomes."),
    instruction: "Produce a decision-ready proposal. Connect the diagnosed situation to objectives, strategy, workstreams, timeline, owners, risks, resources, and measurable outcomes. Make assumptions explicit.",
    keywords: ["方案", "提案", "售前", "项目", "proposal", "client", "plan"],
    defaults: { pages: 10, aspect: "16:9", style: "consulting proposal, structured, credible, implementation-oriented" },
    slots: [
      slot("requirements", "需求与背景", "Requirements", "RFP / 需求文档 / 纪要", "RFP / brief / notes", documentAccept),
      slot("evidence", "案例与证据", "Cases and proof", "案例 / 数据 / 图片", "Cases / data / images", `${documentAccept},${dataAccept},${imageAccept}`),
    ],
  },
  {
    id: "beautify-deck",
    group: "transform",
    icon: "wand",
    featured: true,
    name: text("一键美化 PPT", "Beautify a deck"),
    description: text("上传 PPTX / PDF，在保留内容的前提下重做整套视觉", "Upload PPTX / PDF and redesign the full deck while preserving its content"),
    output: text("统一、精致的重设计版本", "Polished, consistent redesign"),
    starter: text("在保留原始事实、核心文案和页序的前提下，重做整份演示的视觉层级、版式与一致性。", "Redesign the entire deck's visual hierarchy, layout, and consistency while preserving its facts, core copy, and slide order."),
    instruction: "Treat the uploaded deck or PDF as the source of truth. Preserve facts and intended sequence unless the user asks to restructure. Rebuild each slide with a coherent design system, better hierarchy, spacing, typography, and chart treatment.",
    keywords: ["美化", "重做", "PPT", "PDF", "redesign", "polish", "beautify"],
    defaults: { pages: 8, aspect: "16:9", style: "polished coherent redesign with strong typography and layout consistency" },
    slots: [
      slot("source-deck", "原始演示", "Source deck", "PPTX / PPT / PDF · 必需", "PPTX / PPT / PDF · required", deckAccept, true, false),
      slot("brand", "品牌规范", "Brand system", "Logo / 品牌手册 / 模板", "Logo / brand guide / template", brandAccept),
      slot("reference", "目标风格", "Target style", "参考截图 / 贴图", "Reference images", imageAccept),
    ],
  },
  {
    id: "document-to-deck",
    group: "transform",
    icon: "document",
    name: text("文档 / PRD / 报告转 PPT", "Document to deck"),
    description: text("把长文档提炼成适合讲述和浏览的页面", "Distill long documents into slides designed for presenting and scanning"),
    output: text("结构化文档演示", "Structured document presentation"),
    starter: text("把上传的文档提炼成一份完整演示，保留关键事实与逻辑，删去不适合上屏的冗余。", "Turn the uploaded document into a complete presentation, preserving key facts and logic while removing content that does not belong on slides."),
    instruction: "Transform source documents into a presentation rather than copying paragraphs. Identify the document's argument, evidence, decisions, and actions; preserve exact facts and convert dense content into visual, speakable slides.",
    keywords: ["文档", "PRD", "报告", "Word", "document", "brief", "report"],
    defaults: { pages: 10, aspect: "16:9", style: "editorial document-to-presentation design, concise and highly legible" },
    slots: [
      slot("source-document", "源文档", "Source document", "PDF / DOCX / Markdown · 必需", "PDF / DOCX / Markdown · required", documentAccept, true),
      slot("brand", "品牌资产", "Brand assets", "Logo / 模板", "Logo / template", brandAccept),
    ],
  },
  {
    id: "notes-to-deck",
    group: "transform",
    icon: "notes",
    name: text("会议纪要 / 长文本转 PPT", "Notes to deck"),
    description: text("从访谈、会议、逐字稿和笔记中提取主线", "Extract a clear story from interviews, meetings, transcripts, and notes"),
    output: text("有结论的纪要呈现", "Insight-led summary deck"),
    starter: text("从上传的会议纪要、逐字稿或笔记中提取核心结论、分歧、决定和后续行动，并组织成演示。", "Extract key conclusions, disagreements, decisions, and actions from the uploaded notes or transcript and organize them into a presentation."),
    instruction: "Synthesize notes or transcripts into a truthful narrative. Separate direct evidence, interpretation, unresolved disagreement, decisions, owners, and next actions. Do not flatten nuance into generic summary.",
    keywords: ["会议", "纪要", "逐字稿", "访谈", "transcript", "meeting", "notes"],
    defaults: { pages: 8, aspect: "16:9", style: "clear synthesis deck with quotes, themes, decisions, and actions" },
    slots: [
      slot("source-notes", "纪要或逐字稿", "Notes or transcript", "DOCX / PDF / TXT / Markdown · 必需", "DOCX / PDF / TXT / Markdown · required", documentAccept, true),
      slot("supporting", "补充材料", "Supporting material", "图片 / 文档", "Images / documents", `${documentAccept},${imageAccept}`),
    ],
  },
  {
    id: "visual-to-deck",
    group: "transform",
    icon: "images",
    name: text("贴图 / 白板 / 手稿转 PPT", "Visuals to deck"),
    description: text("识别截图、白板和草图，重组为清晰可编辑的演示", "Interpret screenshots, whiteboards, and sketches as a clean editable deck"),
    output: text("从视觉素材重建的演示", "Presentation rebuilt from visual sources"),
    starter: text("理解上传的截图、白板或手稿，保留原始信息与关系，重组为一套清晰、统一的演示。", "Interpret the uploaded screenshots, whiteboard, or sketches, preserve their information and relationships, and rebuild them as a clear, consistent presentation."),
    instruction: "Read the uploaded visual sources carefully. Recover hierarchy, labels, relationships, and implied sequence; then redraw them as clean presentation-native layouts without inventing missing facts.",
    keywords: ["贴图", "白板", "手稿", "截图", "image", "whiteboard", "sketch"],
    defaults: { pages: 8, aspect: "16:9", style: "clean reconstructed diagrams and presentation-native layouts" },
    slots: [
      slot("source-visuals", "原始贴图", "Source visuals", "截图 / 白板 / 手稿 · 必需", "Screenshots / whiteboards / sketches · required", imageAccept, true),
      slot("notes", "文字补充", "Supporting notes", "文档 / 说明", "Document / explanation", documentAccept),
    ],
  },
  {
    id: "data-insights",
    group: "data",
    icon: "chart",
    featured: true,
    name: text("数据可视化与洞察", "Data visualization & insights"),
    description: text("上传 CSV / XLSX，完成分析、选图表并讲出数据故事", "Upload CSV / XLSX, analyze it, choose charts, and tell the data story"),
    output: text("洞察驱动的数据故事", "Insight-led data story"),
    starter: text("分析上传的数据，先找出最值得讲的趋势、异常、对比和驱动因素，再用合适图表组织成演示。", "Analyze the uploaded data, identify the most important trends, anomalies, comparisons, and drivers, then organize them into a presentation with appropriate charts."),
    instruction: "Perform real analysis before outlining. Surface the strongest 3-7 insights, select chart forms that fit each comparison, state metric definitions, denominators, and time windows, and distinguish observed facts from hypotheses. Never invent values.",
    keywords: ["数据", "图表", "洞察", "CSV", "Excel", "chart", "insights", "analysis"],
    defaults: { pages: 10, aspect: "16:9", style: "answer-first analytical deck with precise charts and restrained annotation" },
    slots: [
      slot("dataset", "数据文件", "Dataset", "CSV / XLSX / TSV · 必需", "CSV / XLSX / TSV · required", dataAccept, true),
      slot("metric-guide", "指标口径", "Metric definitions", "数据字典 / 说明文档", "Data dictionary / notes", documentAccept),
      slot("brand", "报告模板", "Report template", "PPTX / 品牌手册", "PPTX / brand guide", brandAccept),
    ],
  },
  {
    id: "recurring-report",
    group: "data",
    icon: "calendar",
    name: text("周报 / 月报 / 经营看板", "Recurring performance report"),
    description: text("把周期数据转为固定口径的经营复盘", "Turn periodic data into a consistent operating review"),
    output: text("可复用的周期经营报告", "Reusable recurring performance report"),
    starter: text("基于上传的本期与历史数据生成经营报告，突出环比、同比、目标差距、异常和下一步动作。", "Create an operating report from the uploaded current and historical data, highlighting period changes, targets, anomalies, and next actions."),
    instruction: "Create a repeatable operating review. Preserve period labels, compare like-for-like windows, show target versus actual, explain meaningful variance, and make the final action list traceable to evidence.",
    keywords: ["周报", "月报", "经营", "看板", "KPI", "periodic", "operations"],
    defaults: { pages: 8, aspect: "16:9", style: "repeatable KPI review with stable sections and clear variance callouts" },
    slots: [
      slot("period-data", "本期数据", "Current-period data", "CSV / XLSX · 必需", "CSV / XLSX · required", dataAccept, true),
      slot("history", "历史 / 目标", "History or targets", "历史数据 / 目标表", "Historical data / targets", dataAccept),
      slot("template", "既有模板", "Existing template", "PPTX / PDF", "PPTX / PDF", deckAccept),
    ],
  },
  {
    id: "financial-report",
    group: "data",
    icon: "finance",
    name: text("财报 / 业绩解读", "Financial results"),
    description: text("呈现收入、成本、利润、现金流与关键驱动", "Explain revenue, cost, profit, cash flow, and the drivers behind them"),
    output: text("管理层业绩解读", "Executive financial narrative"),
    starter: text("解读上传的财务与业务数据，说明业绩结果、结构变化、关键驱动、风险和展望。", "Interpret the uploaded financial and operating data, explaining results, mix shifts, key drivers, risks, and outlook."),
    instruction: "Build a financially rigorous results narrative. Reconcile totals, units, periods, and percentage changes; connect financial outcomes to operating drivers; keep forecasts, management views, and reported facts clearly separated.",
    keywords: ["财报", "业绩", "利润", "收入", "financial", "earnings", "results"],
    defaults: { pages: 12, aspect: "16:9", style: "investor-relations quality financial presentation with rigorous charts" },
    slots: [
      slot("financial-data", "财务数据", "Financial data", "XLSX / CSV · 必需", "XLSX / CSV · required", dataAccept, true),
      slot("commentary", "管理层说明", "Management commentary", "PDF / DOCX / 纪要", "PDF / DOCX / notes", documentAccept),
    ],
  },
  {
    id: "survey-insights",
    group: "data",
    icon: "survey",
    name: text("问卷 / 用户研究分析", "Survey & user research"),
    description: text("从定量与定性材料提炼人群、行为和机会", "Synthesize quantitative and qualitative evidence into segments, behaviors, and opportunities"),
    output: text("证据驱动的研究洞察", "Evidence-backed research insights"),
    starter: text("分析上传的问卷、访谈或用户研究材料，提炼关键人群、行为模式、痛点、证据和产品机会。", "Analyze the uploaded survey, interview, or user-research material and identify key segments, behaviors, pain points, evidence, and product opportunities."),
    instruction: "Synthesize quantitative and qualitative research without overclaiming. State sample sizes and question wording where available, distinguish frequency from importance, preserve representative quotes, and tie opportunities to evidence.",
    keywords: ["问卷", "用户研究", "访谈", "调研", "survey", "research", "insight"],
    defaults: { pages: 10, aspect: "16:9", style: "human-centered insight report with evidence, quotes, and opportunity areas" },
    slots: [
      slot("research-data", "研究数据", "Research data", "CSV / XLSX / 访谈材料 · 必需", "CSV / XLSX / interview material · required", `${dataAccept},${documentAccept}`, true),
      slot("artifacts", "研究素材", "Research artifacts", "截图 / 照片", "Screenshots / photos", imageAccept),
    ],
  },
  {
    id: "deep-research",
    group: "research",
    icon: "search",
    featured: true,
    name: text("Deep Research 呈现", "Deep research presentation"),
    description: text("联网检索、多轮验证并生成带来源的研究叙事", "Search the web, verify across rounds, and create a sourced research narrative"),
    output: text("带来源的研究简报与演示", "Sourced research brief and deck"),
    starter: text("围绕【研究主题】做深度研究，覆盖背景、关键事实、主要观点、最新进展、争议与结论，并把来源保留到演示中。", "Conduct deep research on [topic], covering context, key facts, major viewpoints, recent developments, debates, and conclusions, while preserving sources in the presentation."),
    instruction: "Use current, authoritative sources and triangulate important claims. Build a research brief before the deck, cite sources, separate fact from inference, surface uncertainty and disagreement, and end with implications or decisions.",
    keywords: ["深度研究", "联网", "来源", "research", "web", "sources"],
    defaults: { pages: 12, aspect: "16:9", style: "editorial research report with source-aware charts and evidence callouts", research: true },
    slots: [
      slot("internal-context", "内部资料", "Internal context", "已有报告 / 笔记", "Existing reports / notes", documentAccept),
      slot("data", "补充数据", "Supporting data", "CSV / XLSX", "CSV / XLSX", dataAccept),
    ],
  },
  {
    id: "market-research",
    group: "research",
    icon: "trend",
    name: text("市场 / 行业研究", "Market & industry research"),
    description: text("市场规模、趋势、玩家、机会与风险的系统研究", "Systematic research on market size, trends, players, opportunities, and risks"),
    output: text("市场判断与机会地图", "Market view and opportunity map"),
    starter: text("研究【市场 / 行业】，明确市场边界、规模与增速、结构变化、主要玩家、机会窗口和关键风险。", "Research [market / industry], defining its boundaries, size and growth, structural shifts, major players, opportunity windows, and key risks."),
    instruction: "Define the market boundary before quoting size. Reconcile conflicting estimates, name time periods and currencies, explain growth drivers and constraints, map major players, and turn findings into opportunity and risk implications.",
    keywords: ["市场", "行业", "规模", "趋势", "market", "industry", "TAM"],
    defaults: { pages: 12, aspect: "16:9", style: "strategy research deck with market maps, timelines, and quantified evidence", research: true },
    slots: [
      slot("market-context", "内部判断", "Internal perspective", "已有报告 / 假设 / 数据", "Reports / hypotheses / data", `${documentAccept},${dataAccept}`),
      slot("brand", "品牌模板", "Brand template", "PPTX / 品牌手册", "PPTX / brand guide", brandAccept),
    ],
  },
  {
    id: "competitor-analysis",
    group: "research",
    icon: "compare",
    name: text("竞品 / 对标分析", "Competitive analysis"),
    description: text("统一维度对比产品、定位、体验、定价与能力", "Compare products, positioning, experience, pricing, and capabilities on common dimensions"),
    output: text("可决策的竞品对比", "Decision-ready competitor comparison"),
    starter: text("对比【产品 / 公司列表】，围绕目标用户、定位、核心能力、体验、定价、证据和差异化机会形成结论。", "Compare [products / companies] across audience, positioning, capabilities, experience, pricing, evidence, and differentiation opportunities."),
    instruction: "Use a consistent comparison framework and current evidence. Avoid feature-dump slides; explain why differences matter, identify table stakes versus true differentiation, and end with strategic implications.",
    keywords: ["竞品", "对标", "竞争", "compare", "competitive", "benchmark"],
    defaults: { pages: 10, aspect: "16:9", style: "structured comparison deck with matrices, evidence, and strategic implications", research: true },
    slots: [
      slot("competitor-material", "竞品材料", "Competitor material", "截图 / 文档 / 链接摘录", "Screenshots / documents / excerpts", `${documentAccept},${imageAccept}`),
      slot("criteria", "对比维度", "Comparison criteria", "需求 / 评估表", "Requirements / scorecard", `${documentAccept},${dataAccept}`),
    ],
  },
  {
    id: "literature-review",
    group: "research",
    icon: "books",
    name: text("论文 / 文献综述", "Literature review"),
    description: text("综合研究问题、方法、共识、分歧与证据质量", "Synthesize research questions, methods, consensus, disagreement, and evidence quality"),
    output: text("结构化文献综述", "Structured literature review"),
    starter: text("围绕【研究问题】整理文献，说明研究脉络、主要方法、共识、分歧、证据强弱和仍待回答的问题。", "Review the literature around [research question], covering the field's development, major methods, consensus, disagreement, evidence quality, and open questions."),
    instruction: "Synthesize literature rather than listing papers. Preserve citations, compare methods and populations, identify consensus and disagreement, assess evidence quality, and avoid claiming causality where sources do not support it.",
    keywords: ["论文", "文献", "综述", "academic", "literature", "papers"],
    defaults: { pages: 12, aspect: "16:9", style: "academic editorial presentation with citation-led evidence synthesis", research: true },
    slots: [
      slot("papers", "论文与资料", "Papers and sources", "PDF / 文献笔记", "PDF / literature notes", documentAccept),
      slot("data", "研究数据", "Research data", "CSV / XLSX", "CSV / XLSX", dataAccept),
    ],
  },
  {
    id: "brand-apply",
    group: "optimize",
    icon: "brand",
    name: text("套用品牌规范", "Apply a brand system"),
    description: text("把 Logo、配色、字体和组件规则应用到整套演示", "Apply logo, color, typography, and component rules across a deck"),
    output: text("品牌一致的演示版本", "Brand-consistent presentation"),
    starter: text("将上传的品牌规范应用到原始演示，统一 Logo、配色、字体、组件、图片处理和版式节奏。", "Apply the uploaded brand system to the source deck, unifying logo, color, typography, components, image treatment, and layout rhythm."),
    instruction: "Treat the brand guide as a constraint system, not loose inspiration. Preserve source content while applying logo rules, palette, typography, components, image treatment, spacing, and accessibility consistently.",
    keywords: ["品牌", "VI", "套版", "brand", "guideline", "template"],
    defaults: { pages: 8, aspect: "16:9", style: "strict brand-system application with consistent components and spacing" },
    slots: [
      slot("source-deck", "原始演示", "Source deck", "PPTX / PDF · 必需", "PPTX / PDF · required", deckAccept, true, false),
      slot("brand-system", "品牌规范", "Brand system", "品牌手册 / Logo / 模板 · 必需", "Brand guide / logo / template · required", brandAccept, true),
    ],
  },
  {
    id: "reference-replica",
    group: "optimize",
    icon: "replica",
    name: text("参考图复刻 / 风格迁移", "Reference recreation"),
    description: text("拆解截图的配色、字体、间距和组件后衍生新设计", "Deconstruct color, type, spacing, and components from references, then derive a new design"),
    output: text("同风格但原创的演示", "Original deck in the referenced visual language"),
    starter: text("拆解上传参考图的视觉系统，并把这种设计语言应用到我的内容；保留风格特征，但不要机械复制。", "Deconstruct the uploaded reference's visual system and apply that design language to my content, preserving its character without mechanically copying it."),
    instruction: "Analyze the reference's palette, typography, spacing, composition, component grammar, image treatment, and density. Derive an original deck that feels related without copying protected content or irrelevant details.",
    keywords: ["参考图", "复刻", "风格迁移", "screenshot", "replica", "style transfer"],
    defaults: { pages: 8, aspect: "16:9", style: "faithful visual-system derivation from supplied references" },
    slots: [
      slot("reference", "参考图", "Visual reference", "截图 / 图片 · 必需", "Screenshot / image · required", imageAccept, true),
      slot("content", "演示内容", "Deck content", "文档 / 原始演示", "Document / source deck", documentAccept),
    ],
  },
  {
    id: "translate-localize",
    group: "optimize",
    icon: "translate",
    name: text("翻译 / 本地化演示", "Translate & localize"),
    description: text("翻译整套内容，同时重排版并适配目标受众", "Translate the full deck, reflow layouts, and adapt it for the target audience"),
    output: text("本地化语言版本", "Localized language version"),
    starter: text("把上传的演示翻译为【目标语言】，保持原意与事实，并根据文本长度和当地表达重新排版。", "Translate the uploaded presentation into [target language], preserve its meaning and facts, and reflow layouts for text length and local conventions."),
    instruction: "Translate for meaning and audience, not word-for-word. Preserve names, numbers, and claims; adapt idiom and units only when appropriate; reflow layouts for text expansion; keep terminology consistent across slides.",
    keywords: ["翻译", "本地化", "中英", "translate", "localize", "language"],
    defaults: { pages: 8, aspect: "16:9", style: "layout-faithful localized presentation with clear typography" },
    slots: [
      slot("source-deck", "原始演示", "Source deck", "PPTX / PDF · 必需", "PPTX / PDF · required", deckAccept, true, false),
      slot("glossary", "术语表", "Glossary", "术语 / 翻译规范", "Terminology / translation guide", `${documentAccept},${dataAccept}`),
    ],
  },
  {
    id: "restructure-deck",
    group: "optimize",
    icon: "restructure",
    name: text("压缩 / 扩展 / 重组", "Restructure a deck"),
    description: text("按时长、受众或目标重新组织现有演示", "Reorganize an existing deck for a new duration, audience, or goal"),
    output: text("面向新目标的重组版本", "Restructured deck for the new goal"),
    starter: text("把上传的演示调整为【页数 / 时长】，面向【新受众】，保留必要证据并重组叙事。", "Adapt the uploaded deck to [slide count / duration] for [new audience], preserving essential evidence while restructuring the narrative."),
    instruction: "Reframe the source deck for the new audience, duration, and decision goal. Preserve essential evidence, remove repetition, fill critical narrative gaps, and make the new sequence coherent rather than merely deleting slides.",
    keywords: ["压缩", "扩展", "重组", "缩减", "restructure", "shorten", "expand"],
    defaults: { pages: 8, aspect: "16:9", style: "concise restructured presentation with a stronger narrative arc" },
    slots: [
      slot("source-deck", "原始演示", "Source deck", "PPTX / PDF · 必需", "PPTX / PDF · required", deckAccept, true, false),
      slot("new-brief", "新目标说明", "New brief", "受众 / 时长 / 目标", "Audience / duration / goal", documentAccept),
    ],
  },
  {
    id: "training-course",
    group: "delivery",
    icon: "training",
    name: text("培训 / 课程课件", "Training & courseware"),
    description: text("从学习目标出发设计讲解、练习、案例与检查点", "Design explanations, exercises, cases, and checks from learning objectives"),
    output: text("可直接授课的课件", "Ready-to-teach course deck"),
    starter: text("为【学习者】制作关于【主题】的培训课件，包含学习目标、关键概念、案例、练习和知识检查。", "Create training material about [topic] for [learners], including objectives, key concepts, examples, exercises, and knowledge checks."),
    instruction: "Design for learning rather than information dumping. Define observable learning objectives, sequence concepts from simple to applied, include examples, practice, reflection, and checks, and make facilitator cues explicit where useful.",
    keywords: ["培训", "课程", "教学", "课件", "training", "course", "lesson"],
    defaults: { pages: 14, aspect: "16:9", style: "engaging instructional design with examples, exercises, and checks" },
    slots: [
      slot("course-source", "课程资料", "Course material", "教材 / SOP / 知识库", "Textbook / SOP / knowledge base", documentAccept),
      slot("examples", "案例素材", "Examples", "案例 / 图片 / 数据", "Cases / images / data", `${documentAccept},${imageAccept},${dataAccept}`),
    ],
  },
  {
    id: "keynote-story",
    group: "delivery",
    icon: "keynote",
    name: text("演讲 / 发布会叙事", "Keynote & launch story"),
    description: text("围绕现场表达设计节奏、金句、转折与视觉记忆点", "Design pacing, lines, reveals, and visual moments for live delivery"),
    output: text("适合现场讲述的演讲稿", "Stage-ready keynote deck"),
    starter: text("为【活动 / 发布会】设计一场面向【受众】的演讲，围绕【核心主张】形成有节奏、有记忆点的叙事。", "Design a keynote for [event] and [audience] around [core claim], with strong pacing and memorable moments."),
    instruction: "Write for live delivery. Favor one idea per slide, strong transitions, memorable lines, purposeful reveals, and visual moments. Keep dense detail out of the main flow and make the closing land the core claim.",
    keywords: ["演讲", "发布会", "keynote", "launch", "speech", "story"],
    defaults: { pages: 12, aspect: "16:9", style: "cinematic keynote storytelling with bold type and memorable visual beats" },
    slots: [
      slot("speech", "演讲素材", "Speech material", "讲稿 / 提纲 / 产品资料", "Script / outline / product material", documentAccept),
      slot("media", "现场素材", "Stage media", "产品图 / 照片", "Product images / photos", imageAccept),
    ],
  },
  {
    id: "portfolio-case",
    group: "delivery",
    icon: "portfolio",
    name: text("作品集 / 案例展示", "Portfolio & case study"),
    description: text("把过程、判断、方案和结果组织成可信案例", "Present process, decisions, solution, and outcomes as a credible case"),
    output: text("可展示的案例故事", "Presentation-ready case story"),
    starter: text("把【项目 / 作品】整理成案例展示，讲清背景、挑战、我的角色、过程、关键判断、结果和反思。", "Turn [project / work] into a case study covering context, challenge, my role, process, key decisions, outcomes, and reflection."),
    instruction: "Build a credible case story. Clarify context, constraints, personal role, process, important decisions, before-and-after evidence, measurable outcomes, and reflection. Let artifacts prove the work instead of relying on adjectives.",
    keywords: ["作品集", "案例", "设计", "portfolio", "case study", "showcase"],
    defaults: { pages: 10, aspect: "16:9", style: "editorial portfolio case study with strong artifacts and process storytelling" },
    slots: [
      slot("artifacts", "项目素材", "Project artifacts", "截图 / 图片 / 文档", "Screenshots / images / documents", `${imageAccept},${documentAccept}`),
      slot("results", "结果数据", "Outcome data", "指标 / 反馈", "Metrics / feedback", `${dataAccept},${documentAccept}`),
    ],
  },
  {
    id: "template-batch",
    group: "delivery",
    icon: "batch",
    name: text("模板套版 / 批量页面", "Template-driven batch"),
    description: text("用模板与表格批量生成结构一致的产品、人物或报告页面", "Use a template and table to generate consistent product, profile, or report pages"),
    output: text("结构一致的批量页面", "Consistent batch-generated slides"),
    starter: text("按照上传的模板与数据，为每条记录生成结构一致的页面，保持字段、版式和品牌规则统一。", "Use the uploaded template and data to create a consistent slide for each record, preserving fields, layout, and brand rules."),
    instruction: "Treat the template as a strict repeatable schema and the table as source data. Map fields explicitly, preserve one consistent layout system, handle missing values visibly, and never fabricate record content.",
    keywords: ["批量", "套版", "模板", "名单", "catalog", "batch", "merge"],
    defaults: { pages: 10, aspect: "16:9", style: "strict repeatable template system with consistent field mapping" },
    slots: [
      slot("template", "页面模板", "Slide template", "PPTX / PDF / 参考图 · 必需", "PPTX / PDF / reference image · required", `${deckAccept},${imageAccept}`, true, false),
      slot("records", "批量数据", "Batch data", "CSV / XLSX · 必需", "CSV / XLSX · required", dataAccept, true, true),
      slot("assets", "关联素材", "Related assets", "产品图 / 人物图", "Product / profile images", imageAccept),
    ],
  },
];

export const FEATURED_SCENARIOS = PRESENTATION_SCENARIOS.filter((scenario) => scenario.featured);

export function scenarioText(value: LocalizedScenarioText, locale: string): string {
  return locale === "zh-CN" ? value["zh-CN"] : value.en;
}

export function getScenario(id?: string | null): PresentationScenario | undefined {
  return id ? PRESENTATION_SCENARIOS.find((scenario) => scenario.id === id) : undefined;
}

export function getScenarioGroup(id: ScenarioGroupId) {
  return SCENARIO_GROUPS.find((group) => group.id === id);
}

export function scenarioPromptContext(id?: string | null): string {
  const scenario = getScenario(id);
  if (!scenario) return "";
  return [
    "<presentation_scenario>",
    `Scenario: ${scenario.name.en}`,
    `Expected output: ${scenario.output.en}`,
    `Workflow contract: ${scenario.instruction}`,
    "</presentation_scenario>",
  ].join("\n");
}

export function materialRolePrompt(
  items?: Array<{ id: string; name: string; role: string }>,
): string {
  if (!items?.length) return "";
  return [
    "<attached_context_roles>",
    ...items.map((item) => `- ${item.name}: ${item.role}`),
    "Use each attached file according to this role; do not confuse source content with visual or brand references.",
    "</attached_context_roles>",
  ].join("\n");
}

export function isScenarioStarter(value: string): boolean {
  const normalized = value.trim();
  return PRESENTATION_SCENARIOS.some((scenario) =>
    scenario.starter.en === normalized || scenario.starter["zh-CN"] === normalized,
  );
}
