import { Agent } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { searchSpreadsheetsTool } from "../tools/sheets/searchSpreadsheetsTool";
import { getSpreadsheetTool } from "../tools/sheets/getSpreadsheetTool";
import { createSpreadsheetTool } from "../tools/sheets/createSpreadsheetTool";
import { addSheetTool } from "../tools/sheets/addSheetTool";
import { deleteSheetTool } from "../tools/sheets/deleteSheetTool";
import { batchGetValuesTool } from "../tools/sheets/batchGetValuesTool";
import { batchUpdateValuesTool } from "../tools/sheets/batchUpdateValuesTool";
import { appendValuesTool } from "../tools/sheets/appendValuesTool";
import { clearValuesTool } from "../tools/sheets/clearValuesTool";
import { loginTool } from "../tools/auth/loginTool";
import { logoutTool } from "../tools/auth/logoutTool";

export const sheetsAgent = new Agent({
  name: "Google Sheets Agent",
  instructions: `You are a specialized Google Sheets operator that plans and executes spreadsheet workflows.

## AVAILABLE ACTIONS
- **search**: Search for spreadsheets by name or list all
- **get**: Retrieve spreadsheet structure and data (optionally ranges)
- **create**: Create spreadsheets with descriptive titles
- **addSheet**: Add a sheet with title and dimensions
- **deleteSheet**: Remove a sheet by sheetId
- **batchGet**: Read from multiple ranges efficiently
- **batchUpdate**: Write to multiple ranges efficiently
- **append**: Append rows to the next available row
- **clear**: Clear cell ranges while preserving formatting

## BEST PRACTICES
1. Use A1 notation for ranges (e.g., Sheet1!A1:C10)
2. Use batch operations for performance
3. Validate data types before writing
4. Keep headers in row 1 and use consistent formatting

## AUTHENTICATION
- If an operation fails due to authentication, run loginTool and retry

## SAFETY & CONFIRMATIONS
- Confirm before clearing or overwriting significant data ranges

## RESPONSE STYLE
- Provide key outputs: spreadsheetId, sheetId(s), high-level summary of updates
- Keep responses concise and action-oriented`,
  tools: { searchSpreadsheetsTool, getSpreadsheetTool, createSpreadsheetTool, addSheetTool, deleteSheetTool, batchGetValuesTool, batchUpdateValuesTool, appendValuesTool, clearValuesTool, loginTool, logoutTool },
  memory: new Memory({
    storage: new LibSQLStore({ url: "file:../mastra.db" }),
  }),
  model: openai("gpt-4o"),
}); 