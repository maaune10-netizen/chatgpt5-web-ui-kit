/**
 * برامج OpenUI Lang مكتوبة بخطّ اليد — **لا يولّدها النموذج**.
 *
 * الغرض منها واحد: أن نرى كل مكوّن في مكتبة OpenUI على الشاشة. ولهذا لا
 * يمرّ شيء عبر `deepseek-v4.1-flash` هنا — فلو فسد التوليد لفسد العرض،
 * ولما عرفنا أيّ الفسادين ننظر إليه: النموذج أم المكتبة.
 *
 * والمصدر هو `openuiLibrary.prompt()` المقروء من الحزمة المثبَّتة، لا من
 * التوثيق على الويب. وكل برنامج مستقلّ عن غيره، فإذا فسد واحد ظهر الباقي.
 *
 * وقاعدة الكتابة: الوسائط **بالموضع لا بالاسم**، وترتيبها ترتيب خصائص
 * المكوّن. فـ`Card([children], "row", "l")` صحيح، و`Card([children], direction: "row")`
 * خطأ صامت.
 */

/* صور بديلة داخلية — لا شبكة ولا خدمة خارجية، فتعمل بلا إنترنت */
const WIDE =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc0ODAnIGhlaWdodD0nMTgwJz48cmVjdCB3aWR0aD0nNDgwJyBoZWlnaHQ9JzE4MCcgZmlsbD0nI2M5YzljOScvPjx0ZXh0IHg9JzUwJScgeT0nNTIlJyB0ZXh0LWFuY2hvcj0nbWlkZGxlJyBkb21pbmFudC1iYXNlbGluZT0nbWlkZGxlJyBmb250LWZhbWlseT0nc2Fucy1zZXJpZicgZm9udC1zaXplPScyNicgZmlsbD0nIzVhNWE1YSc+aW1hZ2U8L3RleHQ+PC9zdmc+';
const SQUARE =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyNDAnIGhlaWdodD0nMjQwJz48cmVjdCB3aWR0aD0nMjQwJyBoZWlnaHQ9JzI0MCcgZmlsbD0nI2Q2ZDZkNicvPjx0ZXh0IHg9JzUwJScgeT0nNTIlJyB0ZXh0LWFuY2hvcj0nbWlkZGxlJyBkb21pbmFudC1iYXNlbGluZT0nbWlkZGxlJyBmb250LWZhbWlseT0nc2Fucy1zZXJpZicgZm9udC1zaXplPSczNCcgZmlsbD0nIzVhNWE1YSc+dGh1bWI8L3RleHQ+PC9zdmc+';
const PHOTO =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSczNjAnIGhlaWdodD0nMjIwJz48cmVjdCB3aWR0aD0nMzYwJyBoZWlnaHQ9JzIyMCcgZmlsbD0nI2JmYmZiZicvPjx0ZXh0IHg9JzUwJScgeT0nNTIlJyB0ZXh0LWFuY2hvcj0nbWlkZGxlJyBkb21pbmFudC1iYXNlbGluZT0nbWlkZGxlJyBmb250LWZhbWlseT0nc2Fucy1zZXJpZicgZm9udC1zaXplPSczMScgZmlsbD0nIzVhNWE1YSc+cGhvdG88L3RleHQ+PC9zdmc+';

export interface OpenUISample {
  /** اسم المجموعة كما في `openuiComponentGroups` */
  group: string;
  /** ما يعرضه هذا البرنامج */
  note: string;
  /** المكوّنات التي يغطّيها فعليًّا */
  covers: string[];
  program: string;
}

/** مكتبة `openuiLibrary` — الجذر `Stack` */
export const OPENUI_SAMPLES: OpenUISample[] = [
  {
    group: 'Layout',
    note: 'Containers and navigation: a row of cards, then tabs, an accordion, steps, a horizontal carousel, and a modal.',
    covers: ['Stack', 'Tabs', 'TabItem', 'Accordion', 'AccordionItem', 'Steps', 'StepsItem', 'Carousel', 'Separator', 'Modal'],
    program: `root = Stack([sec, modalRow, modal], "column", "m")
sec = Card([InlineHeader("Layout", "Stack · Tabs · Accordion · Steps · Carousel · Separator"), row, sep, tabs, acc, steps, carousel])
row = Stack([b1, b2, b3], "row", "s", "stretch")
b1 = Card([TextContent("Stack", "small-heavy"), TextContent("direction row")])
b2 = Card([TextContent("gap", "small-heavy"), TextContent("s between the cards")])
b3 = Card([TextContent("wrap", "small-heavy"), TextContent("true wraps to the next line")])
sep = Separator("horizontal", true)
tabs = Tabs([t1, t2, t3])
t1 = TabItem("one", "Tab one", [TextContent("First tab body.")])
t2 = TabItem("two", "Tab two", [TextContent("Second tab body.")])
t3 = TabItem("three", "Tab three", [TextContent("Third tab body.")])
acc = Accordion([a1, a2])
a1 = AccordionItem("a1", "Collapsible section", [TextContent("Hidden until you open it.")])
a2 = AccordionItem("a2", "Another section", [TextContent("One statement per line.")])
steps = Steps([st1, st2, st3])
st1 = StepsItem("Write the library", "createLibrary({ root, components })")
st2 = StepsItem("Generate the prompt", "library.prompt()")
st3 = StepsItem("Render the stream", "Renderer response + library")
carousel = Carousel([[k1], [k2], [k3]], "card")
k1 = TextContent("Carousel slide one")
k2 = TextContent("Carousel slide two")
k3 = TextContent("Carousel slide three")
modalRow = Buttons([modalBtn])
modalBtn = Button("Open the modal", @Set($showModal, true), "secondary")
modal = Modal("Modal", $showModal, [TextContent("Escape, the X, or the backdrop closes it.")], "sm")`,
  },
  {
    group: 'Content',
    note: 'Content blocks: a header, text, markdown, two callouts, a code block, and images three ways.',
    covers: ['Card', 'CardHeader', 'TextContent', 'MarkDownRenderer', 'Callout', 'TextCallout', 'Image', 'ImageBlock', 'ImageGallery', 'CodeBlock', 'InlineHeader'],
    program: `root = Stack([sec], "column", "m")
sec = Card([InlineHeader("Content", "CardHeader · TextContent · MarkDownRenderer · Callout · CodeBlock · images"), hdr, body, callouts, code, imgs, gallery])
hdr = CardHeader("CardHeader", "title and subtitle")
body = MarkDownRenderer("**Markdown** renders here: a list, \`inline code\`, a [link](https://openui.com), and a table.\\n\\n| Column | Value |\\n| --- | --- |\\n| Components | 83 |\\n| Groups | 10 |")
callouts = Stack([co1, co2], "row", "s", "stretch")
co1 = Callout("info", "Callout", "variant info, with a title and a description")
co2 = TextCallout("success", "TextCallout", "a lighter callout")
code = CodeBlock("ts", "const x: number = 42;\\nconsole.log(x);")
imgs = Stack([im1, im2], "row", "s", "start")
im1 = Image("A wide placeholder", "${WIDE}")
im2 = ImageBlock("${SQUARE}", "An image block with a loading state")
gallery = ImageGallery([{src: "${WIDE}", alt: "wide", details: "ImageGallery item one"}, {src: "${SQUARE}", alt: "square", details: "item two"}, {src: "${PHOTO}", alt: "photo", details: "item three"}])`,
  },
  {
    group: 'Tables',
    note: 'The table is column-oriented, not row-oriented: each Col carries its own array. EditableTable edits cells in place.',
    covers: ['Table', 'Col', 'EditableTable'],
    program: `root = Stack([sec], "column", "m")
sec = Card([InlineHeader("Tables", "Table · Col · EditableTable"), tbl, ed])
tbl = Table([c1, c2, c3])
c1 = Col("Component", ["Stack", "Tabs", "Table", "PieChart"])
c2 = Col("Group", ["Layout", "Layout", "Tables", "Charts (1D)"])
c3 = Col("Props", [7, 1, 1, 4], "number")
ed = EditableTable("inventory", [{type: "text", key: "sku", header: "SKU"}, {type: "number", key: "qty", header: "Qty"}, {type: "select", key: "status", header: "Status", options: [{value: "ok", label: "In stock"}, {value: "low", label: "Low"}]}], [{id: "r1", values: ["A-100", 42, "ok"]}, {id: "r2", values: ["B-205", 3, "low"]}])`,
  },
  {
    group: 'Charts (2D)',
    note: 'Two-axis charts: bars, lines, areas, radar, and horizontal bars — all from the same two arrays.',
    covers: ['BarChart', 'LineChart', 'AreaChart', 'RadarChart', 'HorizontalBarChart', 'Series'],
    program: `root = Stack([sec], "column", "m")
sec = Card([InlineHeader("Charts (2D)", "BarChart · LineChart · AreaChart · RadarChart · HorizontalBarChart"), bar, line, area, radar, hbar])
labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
s1 = Series("Revenue", [12000, 15000, 14000, 18000, 21000, 25000])
s2 = Series("Costs", [8000, 9000, 9500, 11000, 12000, 13000])
bar = BarChart(labels, [s1, s2], "grouped", "Month", "USD")
line = LineChart(labels, [s1, s2], "natural", "Month", "USD")
area = AreaChart(labels, [s1], "linear", "Month", "USD")
radar = RadarChart(["Speed", "Cost", "Quality", "Support", "Uptime"], [Series("Us", [8, 6, 9, 7, 9]), Series("Them", [6, 8, 7, 6, 8])])
hbar = HorizontalBarChart(["Enterprise", "Mid-market", "SMB"], [Series("Accounts", [12, 48, 210])], "grouped", "Accounts", "Segment")`,
  },
  {
    group: 'Charts (1D)',
    note: 'Charts without an axis: slices, radial bars, and a single stacked bar. Slice is in the program too, but it draws nothing on its own — it is a data holder for the chart components (measured: the section\'s node count does not change when it is added).',
    covers: ['PieChart', 'RadialChart', 'SingleStackedBarChart'],
    program: `root = Stack([sec], "column", "m")
sec = Card([InlineHeader("Charts (1D)", "PieChart · RadialChart · SingleStackedBarChart · Slice"), pie, radial, stacked, slice])
cats = ["Low", "Medium", "High"]
vals = [12, 27, 9]
pie = PieChart(cats, vals, "donut", "circular")
radial = RadialChart(cats, vals)
stacked = SingleStackedBarChart(["Done", "In progress", "Blocked"], [14, 6, 3])
slice = Slice("One slice", 42)`,
  },
  {
    group: 'Charts (Scatter)',
    note: 'Scatter: two datasets of points on two axes.',
    covers: ['ScatterChart', 'ScatterSeries', 'Point'],
    program: `root = Stack([sec], "column", "m")
sec = Card([InlineHeader("Charts (Scatter)", "ScatterChart · ScatterSeries · Point"), sc])
sc = ScatterChart([ds1, ds2], "Ad spend", "Conversions")
ds1 = ScatterSeries("Campaign A", [p1, p2, p3, p4])
p1 = Point(10, 24)
p2 = Point(18, 39)
p3 = Point(25, 44)
p4 = Point(33, 61)
ds2 = ScatterSeries("Campaign B", [q1, q2, q3])
q1 = Point(12, 18)
q2 = Point(22, 27)
q3 = Point(30, 35)`,
  },
  {
    group: 'Forms',
    note: 'Every field in one form: text, email, notes, select, date, slider, choice groups, chips, and option cards.',
    covers: ['Form', 'FormControl', 'Label', 'Input', 'TextArea', 'Select', 'SelectItem', 'DatePicker', 'Slider', 'CheckBoxGroup', 'CheckBoxItem', 'RadioGroup', 'RadioItem', 'SwitchGroup', 'SwitchItem', 'Chips', 'ChipItem', 'OptionCards', 'OptionCard'],
    program: `root = Stack([sec], "column", "m")
sec = Card([InlineHeader("Forms", "Form · FormControl · every input type"), lbl, form])
lbl = Label("Everything below is one Form")
form = Form("demo", btns, [f1, f2, f3, f4, f5, f6, f7, f8, f9, f10])
btns = Buttons([Button("Submit", null, "primary"), Button("Reset", null, "secondary")])
f1 = FormControl("Name", Input("name", "Ada Lovelace", "text", {required: true}), "Required")
f2 = FormControl("Email", Input("email", "ada@example.com", "email", {email: true}))
f3 = FormControl("Notes", TextArea("notes", "Anything else?", 3))
f4 = FormControl("Plan", Select("plan", [SelectItem("free", "Free"), SelectItem("plus", "Plus"), SelectItem("pro", "Pro")], "Choose a plan"))
f5 = FormControl("Due date", DatePicker("due", "single"))
f6 = FormControl("Budget", Slider("budget", "discrete", 0, 100, 10, [40], "Percent"))
f7 = FormControl("Priority", Chips("priority", "single", [ChipItem("low", "Low"), ChipItem("med", "Medium"), ChipItem("high", "High")]))
f8 = FormControl("Region", OptionCards("region", "single", [OptionCard("eu", "Europe", "Frankfurt"), OptionCard("us", "United States", "Virginia")]))
f9 = FormControl("Notifications", SwitchGroup("notif", [SwitchItem("Email", "Daily digest", "email", true), SwitchItem("Push", "On mentions", "push", false)]))
f10 = FormControl("Channels", CheckBoxGroup("channels", [CheckBoxItem("Email", "Daily digest", "email", true), CheckBoxItem("SMS", "Urgent only", "sms", false), CheckBoxItem("Webhook", "POST to a URL", "hook", false)]))`,
  },
  {
    group: 'Buttons',
    note: 'Buttons: the three variants, the sizes, the destructive one, and an icon-only button.',
    covers: ['Button', 'Buttons', 'IconButton'],
    program: `root = Stack([sec], "column", "m")
sec = Card([InlineHeader("Buttons", "Button · Buttons · IconButton"), r1, r2, r3])
r1 = Buttons([b1, b2, b3], "row")
b1 = Button("Primary", null, "primary")
b2 = Button("Secondary", null, "secondary")
b3 = Button("Tertiary", null, "tertiary")
r2 = Buttons([b4, b5], "row")
b4 = Button("Destructive", null, "secondary", "destructive")
b5 = Button("With an action", @OpenUrl("https://openui.com"), "tertiary")
r3 = Buttons([s1, s2, ib], "row")
s1 = Button("Small", null, "primary", "normal", "small")
s2 = Button("Large", null, "secondary", "normal", "large")
ib = IconButton("Add", Icon("plus"), null, "secondary", "medium", "circle")`,
  },
  {
    group: 'Data Display',
    note: 'Data display: coloured tags, an icon, a key/value list, and a numbered list.',
    covers: ['TagBlock', 'Tag', 'Icon', 'EntityList', 'ListBlock', 'ListItem'],
    program: `root = Stack([sec], "column", "m")
sec = Card([InlineHeader("Data display", "TagBlock · Tag · Icon · EntityList · ListBlock"), tagRow, tags, entity, list])
tagRow = TagBlock(["streaming", "positional", "hoisting"], "md")
tags = Stack([t1, t2, t3], "row", "s")
t1 = Tag("success", null, "sm", "success")
t2 = Tag("warning", null, "sm", "warning")
t3 = Tag("danger", null, "sm", "danger")
entity = EntityList([{left: "Components", right: "83", rightVariant: "number"}, {left: "Groups", right: "10", rightVariant: "number"}, {left: "Renderer", right: "React"}], "default", {left: "Metric", right: "Value"}, {left: "Total", right: "1,284", rightVariant: "number"})
list = ListBlock([li1, li2, li3], "number", "default")
li1 = ListItem("Install the package", "npm install @openuidev/react-ui")
li2 = ListItem("Define the library", "createLibrary({ root, components })")
li3 = ListItem("Render the stream", "Renderer response + library")`,
  },
  {
    group: 'Cards',
    note: 'The five card blocks: snippet, overview with a metric, tinted context, composite with a price footer, and photo-first.',
    covers: [
      'SnippetCardBlock', 'SnippetCardItem',
      'OverviewCardBlock', 'OverviewCardItem',
      'ContextCardBlock', 'ContextCardItem',
      'CompositeCardBlock', 'CompositeCardItem',
      'VisualCardBlock', 'VisualCardItem',
      'Text', 'BoldText', 'IconText', 'ImageText', 'ImageTextLarge',
      'MetricIndicatorInline', 'MetricIndicatorWithStrikethrough',
    ],
    program: `root = Stack([sec], "column", "m")
sec = Card([InlineHeader("Cards", "Snippet · Overview · Context · Composite · Visual"), snippets, overview, context, composite, visual])
snippets = SnippetCardBlock([sn1, sn2, sn3, sn4], "grid")
sn1 = SnippetCardItem("s1", IconText(Icon("cpu"), "neutral", "s", "Model", "deepseek-v4.1-flash"), BoldText("text", "flash"))
sn2 = SnippetCardItem("s2", IconText(Icon("database"), "info", "s", "Context", "1,000,000 tokens"), Text("number", "1M"))
sn3 = SnippetCardItem("s3", IconText(Icon("gauge"), "warning", "s", "Max output", "384,000 tokens"), Text("number", "384k"))
sn4 = SnippetCardItem("s4", IconText(Icon("coins"), "success", "s", "Cache read", "50x cheaper"), Text("text", "yes"))
overview = OverviewCardBlock([ov1, ov2, ov3], "grid")
ov1 = OverviewCardItem("o1", IconText(Icon("users"), "info", "s", "Active users"), MetricIndicatorInline("12,480", "vs last week", {direction: "up", value: 12.4}))
ov2 = OverviewCardItem("o2", IconText(Icon("activity"), "neutral", "s", "Requests"), MetricIndicatorInline("1.2M", "vs last week", {direction: "up", value: 3.1}))
ov3 = OverviewCardItem("o3", IconText(Icon("timer"), "warning", "s", "p95 latency"), MetricIndicatorInline("840ms", "vs last week", {direction: "down", value: 8.0}))
context = ContextCardBlock([cx1, cx2, cx3], "grid")
cx1 = ContextCardItem("c1", "Streaming", "The program is re-parsed on every chunk, so the shell appears before its data.", "gray")
cx2 = ContextCardItem("c2", Tag("Hoisting", null, "sm", "info"), "A name may be used before its statement. Unresolved is **not yet**, not an error.", "gray")
cx3 = ContextCardItem("c3", Tag("Errors", null, "sm", "warning"), "A mistake drops the smallest broken piece and the rest still renders.", "gray")
composite = CompositeCardBlock([cp1, cp2], "grid")
cp1 = CompositeCardItem("p1", IconText(Icon("sparkles"), "soft", "s", "Starter", "for a first look"), [BoldText("number", "$0", null, null, "lg"), Text("text", "1 seat, community support"), TagBlock(["free", "no card"], "sm")], {price: BoldText("number", "$0"), button: Button("Choose", null, "primary", "normal", "small")})
cp2 = CompositeCardItem("p2", IconText(Icon("rocket"), "filled", "s", "Pro", "for production"), [BoldText("number", "$20", "per seat", null, "lg"), Text("text", "unlimited projects, SSO"), TagBlock(["popular", "support"], "sm")], {price: MetricIndicatorWithStrikethrough("$20", "per seat", "$29", {direction: "down", value: 31}), button: Button("Upgrade", null, "secondary", "normal", "small")})
visual = VisualCardBlock([v1, v2], "grid")
v1 = VisualCardItem(BoldText("text", "Photo-first card"), "v1", "${PHOTO}", Tag("new", null, "sm", "info"))
v2 = VisualCardItem(BoldText("text", "Second card"), "v2", "${WIDE}", Tag("beta", null, "sm", "warning"))`,
  },
];

/** مكتبة `openuiChatLibrary` — الجذر `Card` لا `Stack` */
export const OPENUI_CHAT_SAMPLES: OpenUISample[] = [
  {
    group: 'Chat — the whole answer',
    note: 'The second library is built for a chat answer: root Card, a sources strip, foldable sections, and follow-up questions at the end. Note: the sources strip resolves favicons through Google\'s favicon service (t0.gstatic.com) — the only outbound request on this page.',
    covers: ['Card', 'CardHeader', 'TextContent', 'SectionBlock', 'SectionItem', 'ListBlock', 'ListItem', 'FollowUpBlock', 'FollowUpItem', 'Callout'],
    program: `root = Card([hdr, summary, secs, follow], [{url: "https://github.com/thesysdev/openui", title: "thesysdev/openui", sourceName: "github.com"}, {url: "https://developer.mozilla.org", title: "MDN Web Docs", sourceName: "developer.mozilla.org"}])
hdr = CardHeader("Chat library", "root is Card, not Stack")
summary = MarkDownRenderer("The chat library trades the general **Stack** root for a **Card** that stacks top to bottom and can carry a sources strip at the end.")
secs = SectionBlock([s1, s2])
s1 = SectionItem("one", "Sections fold", [TextContent("SectionBlock auto-opens each section as it streams in.")])
s2 = SectionItem("two", "Follow-ups sit last", [ListBlock([li1, li2], "number", "small"), Callout("neutral", "Note", "Clicking a follow-up sends its text as a user message.")])
li1 = ListItem("Install", "npm install @openuidev/react-ui")
li2 = ListItem("Render", "Renderer response + library")
follow = FollowUpBlock([fu1, fu2, fu3])
fu1 = FollowUpItem("Tell me more")
fu2 = FollowUpItem("Show an example")
fu3 = FollowUpItem("Compare with JSON")`,
  },
];
