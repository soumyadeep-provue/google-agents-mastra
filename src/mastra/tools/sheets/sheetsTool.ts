import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchSpreadsheetsTool } from "./searchSpreadsheetsTool";
import { getSpreadsheetTool } from "./getSpreadsheetTool";
import { createSpreadsheetTool } from "./createSpreadsheetTool";
import { addSheetTool } from "./addSheetTool";
import { deleteSheetTool } from "./deleteSheetTool";
import { batchGetValuesTool } from "./batchGetValuesTool";
import { batchUpdateValuesTool } from "./batchUpdateValuesTool";
import { appendValuesTool } from "./appendValuesTool";
import { clearValuesTool } from "./clearValuesTool";

export const sheetsTool = createTool({
  id: "sheets",
  description: `A comprehensive tool for Google Sheets operations: search spreadsheets, get/create spreadsheets, manage sheets, and handle cell data.

## AVAILABLE ACTIONS

### Spreadsheet Discovery
- **"search"**: Find spreadsheets by name or get all spreadsheets
  - Leave query empty to get all spreadsheets
  - Use specific terms to find spreadsheets by name
  - Set maxResults to limit results (default: 10)
  - Example: { action: "search", query: "budget 2024", maxResults: 5 }

### Spreadsheet Management
- **"get"**: Retrieve spreadsheet structure and data
  - Returns spreadsheet metadata and sheet information
  - Optionally specify ranges to get specific data
  - Example: { action: "get", spreadsheetId: "abc123", ranges: ["Sheet1!A1:C10"] }

- **"create"**: Create new spreadsheets
  - Provide descriptive titles for better organization
  - Optionally specify first sheet title
  - Returns spreadsheet ID for further operations
  - Example: { action: "create", title: "Q4 Sales Analysis", sheetTitle: "Sales Data" }

### Sheet Management
- **"addSheet"**: Add new sheets within spreadsheets
  - Specify sheet title and optional dimensions
  - Default: 1000 rows, 26 columns
  - Example: { action: "addSheet", spreadsheetId: "abc123", title: "Summary", rowCount: 500 }

- **"deleteSheet"**: Remove sheets from spreadsheets
  - Requires spreadsheet ID and sheet ID (not name)
  - Use get action first to find sheet IDs
  - Example: { action: "deleteSheet", spreadsheetId: "abc123", sheetId: 0 }

### Data Operations
- **"batchGet"**: Retrieve data from multiple ranges
  - Efficient for reading multiple areas at once
  - Use A1 notation for ranges (e.g., "Sheet1!A1:C10")
  - Example: { action: "batchGet", spreadsheetId: "abc123", ranges: ["Sheet1!A1:C10", "Summary!A1:B5"] }

- **"batchUpdate"**: Update multiple ranges simultaneously
  - Efficient for writing to multiple areas
  - Provide 2D arrays of values for each range
  - Example: { action: "batchUpdate", spreadsheetId: "abc123", updates: [{ range: "A1:B2", values: [["Name", "Value"], ["Total", 100]] }] }

- **"append"**: Add new rows to existing data
  - Automatically finds next empty row
  - Ideal for adding records to datasets
  - Example: { action: "append", spreadsheetId: "abc123", range: "Sheet1!A:C", values: [["John", "Doe", 25]] }

- **"clear"**: Remove data from specified ranges
  - Clears values but preserves formatting
  - Use for resetting data areas
  - Example: { action: "clear", spreadsheetId: "abc123", range: "Sheet1!A1:C10" }

## BEST PRACTICES

### Data Organization
- Use clear column headers in row 1
- Maintain consistent data types within columns
- Leave buffer space for data growth
- Use separate sheets for different data categories

### Range Notation
- Use A1 notation (e.g., "A1:C10", "Sheet1!A:A")
- Named ranges work when defined in the spreadsheet
- Use entire column/row references (A:A, 1:1) for dynamic ranges

### Performance
- Use batch operations for multiple cell updates
- Avoid reading/writing individual cells when possible
- Cache spreadsheet IDs for multiple operations
- Use appropriate range sizes to minimize data transfer

### Data Integrity
- Validate data before writing to cells
- Use clear, consistent formatting
- Document complex formulas and calculations
- Regular backups for important spreadsheets`,
  inputSchema: z.object({
    action: z.enum(["search", "get", "create", "addSheet", "deleteSheet", "batchGet", "batchUpdate", "append", "clear"]).describe("The action to perform"),
    
    // Search spreadsheets
    query: z.string().optional().describe("Search query for spreadsheets (optional for search action - leave empty to get all)"),
    maxResults: z.number().optional().describe("Maximum number of results to return (optional for search action, default: 10)"),
    
    // Get/AddSheet/DeleteSheet/BatchGet/BatchUpdate/Append/Clear spreadsheet
    spreadsheetId: z.string().optional().describe("ID of the spreadsheet (required for get/addSheet/deleteSheet/batchGet/batchUpdate/append/clear actions)"),
    ranges: z.array(z.string()).optional().describe("Specific ranges to get (optional for get action, required for batchGet action, e.g., ['Sheet1!A1:C10'])"),
    
    // Create spreadsheet
    title: z.string().optional().describe("Title of the new spreadsheet (required for create action)"),
    sheetTitle: z.string().optional().describe("Title of the first sheet (optional for create/addSheet actions)"),
    
    // Add sheet
    rowCount: z.number().optional().describe("Number of rows (optional for addSheet action, default: 1000)"),
    columnCount: z.number().optional().describe("Number of columns (optional for addSheet action, default: 26)"),
    
    // Delete sheet
    sheetId: z.number().optional().describe("ID of the sheet to delete (required for deleteSheet action)"),
    
    // Batch update
    updates: z.array(z.object({
      range: z.string().describe("Range to update (e.g., 'Sheet1!A1:C3')"),
      values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).describe("2D array of values to set")
    })).optional().describe("Array of update operations (required for batchUpdate action)"),
    
    // Append/Clear
    range: z.string().optional().describe("Range to append to or clear (required for append/clear actions, e.g., 'Sheet1!A:C' or 'Sheet1!A1:C10')"),
    values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).optional().describe("2D array of values to append (required for append action)")
  }),
  execute: async ({ context }) => {
    switch (context.action) {
      case "search":
        return await searchSpreadsheetsTool.execute({
          context: {
            query: context.query,
            maxResults: context.maxResults
          }
        });
        
      case "get":
        return await getSpreadsheetTool.execute({
          context: {
            spreadsheetId: context.spreadsheetId,
            ranges: context.ranges
          }
        });
        
      case "create":
        return await createSpreadsheetTool.execute({
          context: {
            title: context.title,
            sheetTitle: context.sheetTitle
          }
        });
        
      case "addSheet":
        return await addSheetTool.execute({
          context: {
            spreadsheetId: context.spreadsheetId,
            title: context.title,
            rowCount: context.rowCount,
            columnCount: context.columnCount
          }
        });
        
      case "deleteSheet":
        return await deleteSheetTool.execute({
          context: {
            spreadsheetId: context.spreadsheetId,
            sheetId: context.sheetId
          }
        });
        
      case "batchGet":
        return await batchGetValuesTool.execute({
          context: {
            spreadsheetId: context.spreadsheetId,
            ranges: context.ranges
          }
        });
        
      case "batchUpdate":
        return await batchUpdateValuesTool.execute({
          context: {
            spreadsheetId: context.spreadsheetId,
            valueRanges: context.updates
          }
        });
        
      case "append":
        return await appendValuesTool.execute({
          context: {
            spreadsheetId: context.spreadsheetId,
            range: context.range,
            values: context.values
          }
        });
        
      case "clear":
        return await clearValuesTool.execute({
          context: {
            spreadsheetId: context.spreadsheetId,
            range: context.range
          }
        });
        
      default:
        throw new Error(`Unknown action: ${(context as any).action}`);
    }
  }
}); 