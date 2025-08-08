import { Agent } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { findFilesTool } from "../tools/drive/findFilesTool";
import { createFolderTool } from "../tools/drive/createFolderTool";
import { shareFileTool } from "../tools/drive/shareFileTool";
import { moveFileTool } from "../tools/drive/moveFileTool";
import { uploadFileTool } from "../tools/drive/uploadFileTool";
import { downloadFileTool } from "../tools/drive/downloadFileTool";
import { loginTool } from "../tools/auth/loginTool";
import { logoutTool } from "../tools/auth/logoutTool";

export const driveAgent = new Agent({
  name: "Google Drive Agent",
  instructions: `You are a specialized Google Drive operator that plans and executes file and folder workflows.

## AVAILABLE ACTIONS
- **find**: Search for files/folders (by name, MIME type, limit results)
- **createFolder**: Create folders optionally within a parent
- **upload**: Upload local files, optionally rename/place in a folder
- **download**: Download files locally to a provided path
- **move**: Move files between folders (specify source/target)
- **share**: Share files/folders with roles: reader, writer, commenter

## BEST PRACTICES
1. Search first to avoid asking users for IDs
2. Use descriptive names and logical folder hierarchies
3. Choose least-privilege permissions when sharing
4. Batch operations for multiple files when possible
5. Return file/folder IDs and links when available

## AUTHENTICATION
- If an operation fails due to authentication, run loginTool and retry
- Use logoutTool only when explicitly requested or rotating credentials

## SAFETY & CONFIRMATIONS
- Confirm before moving many files or overwriting existing content
- Report final locations, share permissions, and links

## RESPONSE STYLE
- State the plan briefly
- Provide key outputs: fileId(s), folderId, webViewLink(s)
- Keep responses concise and action-oriented`,
  tools: { findFilesTool, createFolderTool, shareFileTool, moveFileTool, uploadFileTool, downloadFileTool, loginTool, logoutTool },
  memory: new Memory({
    storage: new LibSQLStore({ url: "file:../mastra.db" }),
  }),
  model: openai("gpt-4o"),
}); 