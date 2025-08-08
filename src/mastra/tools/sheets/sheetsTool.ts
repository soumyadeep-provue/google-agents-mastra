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
    action: z.enum(["search", "get", "create", "addSheet", "deleteSheet", "batchGet", "batchUpdate", "append", "clear"]).optional().describe("The specific Google Sheets action to perform. If unclear or missing, will be handled by Sheets specialist agent."),
    
    // Search spreadsheets
    query: z.string().optional().describe("Search query for spreadsheets (for search action - leave empty to get all)"),
    maxResults: z.number().optional().describe("Maximum number of results to return (for search action, default: 10)"),
    
    // Get/AddSheet/DeleteSheet/BatchGet/BatchUpdate/Append/Clear spreadsheet
    spreadsheetId: z.string().optional().describe("ID of the spreadsheet (for get/addSheet/deleteSheet/batchGet/batchUpdate/append/clear actions)"),
    ranges: z.array(z.string()).optional().describe("Specific ranges to get (for get/batchGet actions, e.g., ['Sheet1!A1:C10'])"),
    
    // Create spreadsheet
    title: z.string().optional().describe("Title of the new spreadsheet (for create action)"),
    sheetTitle: z.string().optional().describe("Title of the first sheet (for create/addSheet actions)"),
    
    // Add sheet
    rowCount: z.number().optional().describe("Number of rows (for addSheet action, default: 1000)"),
    columnCount: z.number().optional().describe("Number of columns (for addSheet action, default: 26)"),
    
    // Delete sheet
    sheetId: z.number().optional().describe("ID of the sheet to delete (for deleteSheet action)"),
    
    // Batch update
    updates: z.array(z.object({
      range: z.string().describe("Range to update (e.g., 'Sheet1!A1:C3')"),
      values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).describe("2D array of values to set")
    })).optional().describe("Array of update operations (for batchUpdate action)"),
    
    // Append/Clear
    range: z.string().optional().describe("Range to append to or clear (for append/clear actions, e.g., 'Sheet1!A:C' or 'Sheet1!A1:C10')"),
    values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).optional().describe("2D array of values to append (for append action)"),
    
    // Fallback context for Sheets specialist agent
    userIntent: z.string().optional().describe("Natural language description of what you want to do with Google Sheets (used when action is unclear)")
  }),
  execute: async ({ context, threadId, resourceId, mastra }) => {
    // Handle cases where action is missing - provide helpful guidance
    if (!context.action) {
      return {
        success: false,
        message: "I can help you with Google Sheets tasks! Please specify what you'd like to do. For example:\n- Search for spreadsheets\n- Create a new spreadsheet\n- Get data from spreadsheets\n- Add or delete sheets/tabs\n- Update cell values in ranges\n- Append new data to existing sheets\n- Clear data from ranges",
        availableActions: ["search", "get", "create", "addSheet", "deleteSheet", "batchGet", "batchUpdate", "append", "clear"]
      };
    }

    // Validate required fields for each action and provide helpful guidance
    switch (context.action) {
      case "search":
        // Search doesn't require any mandatory fields
        return await searchSpreadsheetsTool.execute({
          context: {
            query: context.query,
            maxResults: context.maxResults
          }
        });
        
      case "get":
        if (!context.spreadsheetId) {
          return {
            success: false,
            message: "To get spreadsheet data, I need:\n- **Spreadsheet ID**: Which spreadsheet should I read from?",
            required: ["spreadsheetId"],
            optional: ["ranges"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await getSpreadsheetTool.execute({
          context: {
            spreadsheetId: context.spreadsheetId,
            ranges: context.ranges
          }
        });
        
      case "create":
        if (!context.title) {
          return {
            success: false,
            message: "To create a new spreadsheet, I need:\n- **Title**: What should the spreadsheet be called?",
            required: ["title"],
            optional: ["sheetTitle"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await createSpreadsheetTool.execute({
          context: {
            title: context.title,
            sheetTitle: context.sheetTitle
          }
        });
        
      case "addSheet":
        if (!context.spreadsheetId) {
          return {
            success: false,
            message: "To add a new sheet, I need:\n- **Spreadsheet ID**: Which spreadsheet should I add the sheet to?",
            required: ["spreadsheetId"],
            optional: ["sheetTitle", "rowCount", "columnCount"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await addSheetTool.execute({
          context: {
            spreadsheetId: context.spreadsheetId,
            title: context.sheetTitle,
            rowCount: context.rowCount,
            columnCount: context.columnCount
          }
        });
        
      case "deleteSheet":
        if (!context.spreadsheetId || context.sheetId === undefined) {
          return {
            success: false,
            message: "To delete a sheet, I need:\n- **Spreadsheet ID**: Which spreadsheet contains the sheet?\n- **Sheet ID**: Which sheet should I delete? (numeric ID, not name)",
            required: ["spreadsheetId", "sheetId"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await deleteSheetTool.execute({
          context: {
            spreadsheetId: context.spreadsheetId,
            sheetId: context.sheetId
          }
        });
        
      case "batchGet":
        if (!context.spreadsheetId || !context.ranges) {
          return {
            success: false,
            message: "To read data from multiple ranges, I need:\n- **Spreadsheet ID**: Which spreadsheet should I read from?\n- **Ranges**: Array of ranges to read (e.g., ['Sheet1!A1:C10', 'Sheet2!A:A'])",
            required: ["spreadsheetId", "ranges"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await batchGetValuesTool.execute({
          context: {
            spreadsheetId: context.spreadsheetId,
            ranges: context.ranges
          }
        });
        
      case "batchUpdate":
        if (!context.spreadsheetId || !context.updates) {
          return {
            success: false,
            message: "To update multiple ranges, I need:\n- **Spreadsheet ID**: Which spreadsheet should I update?\n- **Updates**: Array of updates with range and values for each (e.g., [{range: 'Sheet1!A1:B2', values: [['A1', 'B1'], ['A2', 'B2']]}])",
            required: ["spreadsheetId", "updates"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await batchUpdateValuesTool.execute({
          context: {
            spreadsheetId: context.spreadsheetId,
            valueRanges: context.updates
          }
        });
        
      case "append":
        if (!context.spreadsheetId || !context.range || !context.values) {
          return {
            success: false,
            message: "To append data to a sheet, I need:\n- **Spreadsheet ID**: Which spreadsheet should I append to?\n- **Range**: Range to append to (e.g., 'Sheet1!A:C')\n- **Values**: 2D array of values to append (e.g., [['row1col1', 'row1col2'], ['row2col1', 'row2col2']])",
            required: ["spreadsheetId", "range", "values"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await appendValuesTool.execute({
          context: {
            spreadsheetId: context.spreadsheetId,
            range: context.range,
            values: context.values
          }
        });
        
      case "clear":
        if (!context.spreadsheetId || !context.range) {
          return {
            success: false,
            message: "To clear data from a range, I need:\n- **Spreadsheet ID**: Which spreadsheet should I clear data from?\n- **Range**: Range to clear (e.g., 'Sheet1!A1:C10')",
            required: ["spreadsheetId", "range"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await clearValuesTool.execute({
          context: {
            spreadsheetId: context.spreadsheetId,
            range: context.range
          }
        });
        
      default:
        // Fallback to Sheets specialist agent for unknown actions
        console.log(`🔄 Sheets action unclear or unknown: "${context.action}". Delegating to Sheets specialist agent...`);
        
        if (!mastra) {
          return {
            success: false,
            message: `Unknown Google Sheets action: "${context.action}". Available actions are:\n- search: Find spreadsheets\n- get: Read spreadsheet data\n- create: Create new spreadsheets\n- addSheet: Add new sheets/tabs\n- deleteSheet: Remove sheets/tabs\n- batchGet: Read from multiple ranges\n- batchUpdate: Update multiple ranges\n- append: Add data to existing ranges\n- clear: Clear data from ranges`,
            availableActions: ["search", "get", "create", "addSheet", "deleteSheet", "batchGet", "batchUpdate", "append", "clear"],
            unknownAction: context.action
          };
        }

        const sheetsAgent = mastra.getAgent("sheetsAgent");
        if (!sheetsAgent) {
          return {
            success: false,
            message: `Unknown Google Sheets action: "${context.action}". Available actions are:\n- search: Find spreadsheets\n- get: Read spreadsheet data\n- create: Create new spreadsheets\n- addSheet: Add new sheets/tabs\n- deleteSheet: Remove sheets/tabs\n- batchGet: Read from multiple ranges\n- batchUpdate: Update multiple ranges\n- append: Add data to existing ranges\n- clear: Clear data from ranges`,
            availableActions: ["search", "get", "create", "addSheet", "deleteSheet", "batchGet", "batchUpdate", "append", "clear"],
            unknownAction: context.action
          };
        }

        // Create a natural language prompt for the Sheets specialist
        const contextDescription = Object.entries(context)
          .filter(([key, value]) => value !== undefined && value !== null)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join(", ");

        const prompt = `I need help with a Google Sheets task. Here's the context I received: ${contextDescription}

Please analyze this and perform the appropriate Google Sheets operation. If you need authentication, use the loginTool first.`;

        try {
          const result = await sheetsAgent.generate(prompt, {
            memory: threadId && resourceId ? {
              thread: threadId,
              resource: resourceId,
            } : undefined,
            maxSteps: 8,
          });

          return {
            success: true,
            message: "✅ Google Sheets task completed by specialist agent",
            specialistResponse: result.text,
            delegatedAction: true,
            originalContext: context,
          };
        } catch (error) {
          console.error("Sheets specialist agent failed:", error);
          return {
            success: false,
            message: `Sheets specialist agent failed to process the request. Available actions are:\n- search: Find spreadsheets\n- get: Read spreadsheet data\n- create: Create new spreadsheets\n- addSheet: Add new sheets/tabs\n- deleteSheet: Remove sheets/tabs\n- batchGet: Read from multiple ranges\n- batchUpdate: Update multiple ranges\n- append: Add data to existing ranges\n- clear: Clear data from ranges`,
            error: error instanceof Error ? error.message : 'Unknown error',
            availableActions: ["search", "get", "create", "addSheet", "deleteSheet", "batchGet", "batchUpdate", "append", "clear"]
          };
        }
    }
  }
}); 