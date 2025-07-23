# Tools Organization

This directory contains all Mastra tools organized by Google service for better maintainability and modularity.

## 📁 Structure

```
tools/
├── index.ts              # Main exports (all tools + collections)
├── auth/                 # Authentication & session management
│   ├── index.ts          # Auth tools collection
│   ├── auth.ts           # Core auth utilities
│   ├── loginTool.ts      # OAuth login
│   └── logoutTool.ts     # Session logout
├── gmail/                # Gmail email management
│   ├── index.ts          # Gmail tools collection
│   ├── getEmailsTool.ts  # Find & read emails
│   └── sendEmailTool.ts  # Send emails
└── drive/                # Google Drive file management
    ├── index.ts          # Drive tools collection
    ├── findFilesTool.ts  # Search files/folders
    ├── createFolderTool.ts
    ├── shareFileTool.ts
    ├── moveFileTool.ts
    ├── uploadFileTool.ts
    └── downloadFileTool.ts
```

## 🚀 Usage Examples

### Import Individual Tools
```typescript
import { loginTool, logoutTool } from '../tools/auth';
import { getEmailsTool, sendMessageTool } from '../tools/gmail';
import { findFilesTool, createFolderTool } from '../tools/drive';
```

### Import Service Collections
```typescript
import { AuthTools, GmailTools, DriveTools } from '../tools';

// Use as collections
const authTools = { AuthTools.loginTool, AuthTools.logoutTool };
const gmailTools = { GmailTools.getEmailsTool, GmailTools.sendMessageTool };
```

### Import Everything
```typescript
import * as Tools from '../tools';
// Access via Tools.loginTool, Tools.getEmailsTool, etc.
```

## 🔧 Benefits

- **🗂️ Organized**: Tools grouped by Google service
- **📦 Modular**: Easy to add new services 
- **🔄 Reusable**: Auth tools shared across services
- **📈 Scalable**: Clear structure for growth
- **🧹 Clean**: Better separation of concerns

## 🎯 Next Steps

To add a new Google service (e.g., Calendar):
1. Create `calendar/` folder
2. Add individual tool files
3. Create `calendar/index.ts` collection
4. Export in main `tools/index.ts`
5. Update agents to use new tools 