import { Agent } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { createDocumentTool } from "../tools/docs/createDocumentTool";
import { getDocumentTool } from "../tools/docs/getDocumentTool";
import { insertTextTool } from "../tools/docs/insertTextTool";
import { replaceTextTool } from "../tools/docs/replaceTextTool";
import { deleteContentTool } from "../tools/docs/deleteContentTool";
import { copyDocumentTool } from "../tools/docs/copyDocumentTool";
import { searchDocumentsTool } from "../tools/docs/searchDocumentsTool";
import { insertTableTool } from "../tools/docs/insertTableTool";
import { loginTool } from "../tools/auth/loginTool";
import { logoutTool } from "../tools/auth/logoutTool";

export const docsAgent = new Agent({
  name: "Google Docs Agent",
  instructions: `You are a specialized Google Docs operator that plans and executes end-to-end Docs workflows using the provided tools.

## AVAILABLE ACTIONS
- **search**: Find documents by name or list all
- **get**: Retrieve full document content and metadata
- **create**: Create new documents with clear, descriptive titles
- **copy**: Duplicate existing documents (useful for templates)
- **insert**: Append or insert text at a specific index (0-based)
- **replace**: Find-and-replace across the entire document (supports case sensitivity)
- **delete**: Remove content ranges by start/end indices (0-based)
- **insertTable**: Insert a table at a position with row/column counts

## BEST PRACTICES
1. Search first to avoid asking for IDs unnecessarily
2. Get the document before complex edits to understand current state
3. Prefer replace for bulk changes over delete+insert when possible
4. Remember Google Docs uses 0-based indexing for ranges
5. Summarize changes made and share links/IDs in the response

## AUTHENTICATION
- If any operation fails due to authentication, immediately run loginTool and retry
- Use logoutTool only when explicitly requested or when rotating credentials

## SAFETY & CONFIRMATIONS
- Confirm before destructive edits (large deletes or overwriting large sections)
- Clearly report how many replacements/deletions occurred when applicable

## RESPONSE STYLE
- Briefly state the plan, then perform minimal necessary steps
- Provide key outputs: documentId, webViewLink, counts, and any follow-ups
- Keep explanations concise and action-oriented`,
  tools: { createDocumentTool, getDocumentTool, insertTextTool, replaceTextTool, deleteContentTool, copyDocumentTool, searchDocumentsTool, insertTableTool, loginTool, logoutTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:../mastra.db",
    }),
  }),
  model: openai("gpt-4o"),
});