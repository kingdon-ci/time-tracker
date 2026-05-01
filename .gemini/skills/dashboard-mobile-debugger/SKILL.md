---
name: dashboard-mobile-debugger
description: Debug and fix CSS layout issues on mobile devices for web dashboards. Use when a dashboard has horizontal overflow, overlapping elements, or poor scaling on small viewports.
---

# Dashboard Mobile Debugger

## Overview
This skill provides a systematic workflow for identifying and fixing CSS layout bugs that specifically affect mobile viewports. It uses Puppeteer to capture visual evidence and measure element dimensions to find the root cause of layout "blowouts".

## Workflow

### 1. Capture Visual Evidence
Always start by capturing a mobile-sized screenshot to confirm the issue and identify the specific area of failure (e.g., header, grid, or table).

```bash
# Default mobile viewport (375x812)
node scripts/capture.mjs http://127.0.0.1:3000 mobile_check.png
```

### 2. Identify Overflowing Elements
Use the analysis script to find elements that are wider than the viewport. This is the most common cause of horizontal scrolling ("blowout").

```bash
node scripts/analyze.mjs http://127.0.0.1:3000
```

Common culprits to look for in the output:
- **Tables**: Often need `table-layout: fixed` and `word-break: break-word`.
- **Pre/Code blocks**: Often need `white-space: pre-wrap` or `overflow-x: auto`.
- **Flex/Grid containers**: Often need `min-width: 0` on children to allow shrinking.
- **Large fixed widths**: Look for pixel values (e.g., `width: 600px`) that should be relative (`100%`).

### 3. Verify CSS Build
If changes are made to source CSS files (e.g., `App.css`) but are not reflected in the UI, check if a build step is required (e.g., `npm run build`) and if the serving process (e.g., `spin watch`) is correctly picking up the latest assets.

### 4. Regression Testing
After applying a fix, always re-run the capture script at both mobile and desktop widths to ensure no new issues were introduced.

## Best Practices
- **Box Sizing**: Ensure `box-sizing: border-box` is applied globally to prevent padding from increasing element widths.
- **Mobile-First**: Favor stacking elements (`flex-direction: column`) on mobile rather than shrinking them side-by-side.
- **Specific Selectors**: If styles aren't applying, check if global styles (like `index.css`) are overriding dashboard-specific styles (like `App.css`).
- **Avoid Tool Pitfalls**: Beware of the `replace` tool creating nested CSS rules incorrectly. Always verify the file structure after an edit.

## Resources

### scripts/
- `capture.mjs`: Captures a high-resolution screenshot at a specific viewport size.
- `analyze.mjs`: Measures all elements and returns a JSON list of those exceeding the viewport width.
