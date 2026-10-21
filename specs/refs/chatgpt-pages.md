# Collection — ChatGPT (logged in)

Captured from the Bot's browser panel: URL + title + screenshot + every link on the page.
Account: Maaun (@maaune10).

| # | Page | URL | Links |
|---|------|-----|-------|
| 1 | Home / new chat | https://chatgpt.com/ | 3 |
| 2 | Library | https://chatgpt.com/library | 3 |
| 3 | Plugins directory | https://chatgpt.com/plugins | 116 |
| 4 | Chat “تحميل MCB Server Ubuntu” | https://chatgpt.com/c/6a0f5ec2-53ac-83eb-b20f-e3e9e0636adb | 11 |
| 5 | Settings · General | https://chatgpt.com/settings/general-settings | 1 |
| 6 | Settings · Appearance | https://chatgpt.com/settings/appearance | 1 |
| 7 | Profile | https://chatgpt.com/u/maaune10 | 4 |
| 8 | Settings · Account | https://chatgpt.com/settings/account | 1 |
| 9 | Settings · Archived chats | https://chatgpt.com/settings/archived-chats | 1 |
| 10 | Settings · Voice | https://chatgpt.com/settings/voice | 1 |
| 11 | Settings · Storage | https://chatgpt.com/settings/storage | 1 |
| 12 | Settings · Usage | https://chatgpt.com/settings/usage?tab=overview | 1 |

## What the app actually is, once logged in

- **Shell:** sidebar (new chat, library, plugins, skills) + a chat surface; every settings page is
  its own route under `/settings/*`.
- **Real surface area is small:** outside the chat, the links are the shell plus `/plugins`.
  `/plugins` alone carries 116 links: category filters (`featured`, `new-and-noteworthy`,
  `small-business`, `productivity`, `communication`, `creativity`) and `plugin_*` detail pages.
- **Plugins are the product:** `plugin_connector_1p_*` (first-party connectors) and
  `plugin_asdk_app_*` (third-party apps) are the two flavours; `/settings/plugins-settings` is
  their management page.
- **Chats** carry content links out (`cursor.com`, `windsurf.com`, `ollama.com`, `openwebui.com`,
  `code.visualstudio.com`, `docs.docker.com`, `claude.ai/download`, `coder.com`) — i.e. answers
  reference the outside world rather than the site itself.
- **Settings** pages are single-purpose and isolated: each lists no navigation except itself, so
  the left menu is rendered from the shell, not from page links. That is why each shows one link.

## Gaps worth a second pass (low and slow)

- `/skills` (seen from the profile page) — never captured.
- `/settings/plugins-settings`
- A few `plugin_*` detail pages, one per category, to see the detail layout.
- `/pricing` and `/download` — they live on openai.com now, so capture them there if wanted.
