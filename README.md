# ChatGPT 5 Web — UI Kit → code

A working React implementation of the **ChatGPT 5 Web: Free UI Kit & Prototype**
Figma file, built by extracting the design's real numbers instead of eyeballing it.

Source: https://www.figma.com/design/J4mMUwLS0Mg1Ll5j6gH5wL  (`133:6239` — New Chat, Logged In)

## Where the numbers come from

The Figma node tree was pulled through the REST API and flattened into
[`specs/chatgpt5-newchat.txt`](specs/chatgpt5-newchat.txt) — 175 visible nodes with
absolute positions, auto-layout direction, padding, gaps, fills (including alpha),
strokes, corner radii and effects.

Design tokens taken straight from that file:

| Token | Value | Where |
|---|---|---|
| `--color-body` | `#212121` | app background |
| `--color-sidebar` | `#181818` | sidebar surface |
| `--color-line` | `#3e3e3e` | 1px dividers |
| `--color-input` | `#303030` | prompt field |
| `--color-upsell` | `#373669` | "Get Plus" pill |
| `--color-avatar` | `#3c6ac3` | profile circle |
| `--color-muted` | `#afafaf` | secondary text |

Type is **Inter**: 14/19.7 for menu rows, 12/15.6 for secondary, 13/18.5 for buttons,
16/24 for the prompt field, 30/36 semibold for the empty-state title, and
18/27.9 `-0.72px` for the model selector.

The prompt field uses the kit's exact three-layer shadow:

```css
box-shadow:
  inset 0 1px 0 0 rgb(255 255 255 / 0.13),
  0 8px 16px 0 rgb(0 0 0 / 0.10),
  0 1.5px 3px 0 rgb(0 0 0 / 0.45);
```

## Fidelity check

Rendered at the frame's own size (1440×1024) and compared row by row against the
Figma export. All 19 sidebar rows land within 1px, and the title's text band is
identical (`432–459`):

```
REFERENCE  26, 78, 114, 150, 198, 234, 271, 307, 363, 398, 434, 471, 507, 542, 598, 635, 671, 707, 990
OURS       26, 77, 113, 150, 198, 234, 270, 306, 363, 398, 434, 471, 507, 542, 598, 635, 671, 707, 990
```

## Run

```bash
npm install
npm run dev     # http://localhost:5180
npm run build
```

## What is still missing

The Figma API rate-limited this account (a ~4-day `retry-after`) after two of the
eighteen screens were read, and the MCP server hit the Starter plan's tool-call
limit. So:

- **Built from real data:** New Chat — Logged In
- **Not yet extracted:** the other 17 screens. They are listed in
  [`src/screens.ts`](src/screens.ts) with their node ids and render a placeholder
  shell until their node trees can be read.

`specs/` also keeps the raw node dumps used for the build.
