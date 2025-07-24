# Google Mastra Tools

This repository contains **Mastra** tools for interacting with multiple Google services (Docs, Drive, Gmail, Maps, Sheets & more). Each service lives in its own folder so that tools stay small, composable, and easy to maintain.

## 📁 Directory Structure

```
src/mastra/tools/
├── auth/                     # Authentication & token management
│   ├── auth.ts
│   ├── loginTool.ts
│   └── logoutTool.ts
├── docs/                     # Google Docs utilities
│   ├── copyDocumentTool.ts
│   ├── createDocumentTool.ts
│   ├── deleteContentTool.ts
│   ├── getDocumentTool.ts
│   ├── insertTableTool.ts
│   ├── insertTextTool.ts
│   ├── replaceTextTool.ts
│   └── searchDocumentsTool.ts
├── drive/                    # Google Drive file management
│   ├── createFolderTool.ts
│   ├── downloadFileTool.ts
│   ├── findFilesTool.ts
│   ├── moveFileTool.ts
│   ├── shareFileTool.ts
│   └── uploadFileTool.ts
├── gmail/                    # Gmail e-mail helpers
│   ├── addLabelTool.ts
│   ├── createDraftTool.ts
│   ├── getAttachmentTool.ts
│   ├── getEmailsTool.ts
│   ├── listLabelsTool.ts
│   ├── replyToThreadTool.ts
│   └── sendMessageTool.ts
├── maps/                     # Google Maps & Places data
│   ├── distanceMatrixTool.ts
│   ├── geocodingTool.ts
│   ├── getCurrentLocationTool.ts
│   ├── getDirectionsTool.ts
│   ├── nearbySearchTool.ts
│   └── textSearchTool.ts
└── sheets/                   # Google Sheets spreadsheet helpers
    ├── addSheetTool.ts
    ├── appendValuesTool.ts
    ├── batchGetValuesTool.ts
    ├── batchUpdateValuesTool.ts
    ├── clearValuesTool.ts
    ├── createSpreadsheetTool.ts
    ├── deleteSheetTool.ts
    ├── getSpreadsheetTool.ts
    └── searchSpreadsheetsTool.ts
```

> 💡 Tip: every file defines **one** `createTool` export. Import them individually or group them in your own collections—whatever makes sense for your agent.

## 🚀 Quick Start

### 1. Authenticate once per session
```typescript
import { loginTool } from "./src/mastra/tools/auth/loginTool";

await loginTool();  // Opens OAuth flow in-chat and caches credentials
```

### 2. Call any tool
```typescript
import { getEmailsTool } from "./src/mastra/tools/gmail/getEmailsTool";

const { emails } = await getEmailsTool({ label: "INBOX", maxResults: 10 });
```

### 3. Combine tools inside an agent
```typescript
import { createAgent } from "@mastra/core/agent";
import { sendMessageTool } from "./src/mastra/tools/gmail/sendMessageTool";
import { createSpreadsheetTool } from "./src/mastra/tools/sheets/createSpreadsheetTool";

export const outreachAgent = createAgent({
  tools: [sendMessageTool, createSpreadsheetTool],
  description: "Sends follow-up emails and logs results to a sheet"
});
```

### 4. Logout when done (optional)
```typescript
import { logoutTool } from "./src/mastra/tools/auth/logoutTool";
await logoutTool();
```

## 🎯 Adding a New Google Service
1. Create a new folder under `src/mastra/tools/` (e.g. `calendar/`).
2. Implement tools using `createTool(...)`—one file per tool.
3. Share common API helpers (client creation, types) inside that folder.
4. Wire tools into any agents that need them.

## 🔧 Why this layout?

- **Clear separation** — Each Google API lives in its own namespace.
- **Re-usable auth** — Single OAuth flow powers every tool.
- **Composable** — Pick only the tools you need; they’re all pure functions.
- **Scalable** — Add services without touching existing ones.

Enjoy building with Mastra! 🚀 