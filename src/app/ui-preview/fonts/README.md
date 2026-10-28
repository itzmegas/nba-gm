# Courtside preview fonts

These fonts are shared by the development-only `/ui-preview` route and the
production game shell through `next/font/local`, with preloading disabled.
The application root layout and its existing fonts are unchanged. The shared
definition stays in `src/app/ui-preview/fonts.ts`; consumers do not duplicate binaries.

| File | Export source in `docs/NBA-Franchise-Management-Redesign/assets/fonts/` | Weight |
|---|---|---|
| `Barlow-Regular.ttf` | `body-0.woff2` | 400 |
| `Barlow-SemiBold.ttf` | `body-2.woff2` | 600 |
| `BarlowCondensed-SemiBold.ttf` | `display-1.woff2` | 600 |

`file` and `fc-scan` identified the originals as TrueType, not WOFF2. Only the
extensions were corrected; the font bytes were not converted or modified.
Only the required weights are included: 255,136 bytes in total.

Both original license notices are identical. Their copyright and complete SIL
Open Font License 1.1 are preserved in `OFL.txt`. NBA logos and player portraits
from the prototype are not included or licensed by these font notices.
