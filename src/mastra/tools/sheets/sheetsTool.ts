import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const sheetsTool = createTool({
  id: "sheets",
  description: `A natural language Google Sheets tool that delegates all operations to a specialized Sheets agent. Simply describe what you want to do with Google Sheets in plain English.

## HOW TO USE

Just describe your Google Sheets task naturally! The tool accepts natural language requests and handles all the complexity for you.

### Examples of Requests:

**Finding Spreadsheets:**
- "Find all my budget spreadsheets"
- "Search for sheets containing 'sales data'"
- "Show me spreadsheets from last quarter"
- "Look for the inventory tracking sheet"

**Creating Spreadsheets:**
- "Create a new spreadsheet called 'Q1 2024 Budget'"
- "Make a new sheet for project tracking"
- "Create a spreadsheet with tabs for income and expenses"

**Managing Sheets:**
- "Add a new sheet called 'Summary' to my budget spreadsheet"
- "Delete the unused sheet from my project tracker"
- "Create additional tabs for each department"

**Reading Data:**
- "Get all the data from my sales spreadsheet"
- "Show me the values in cells A1 to C10"
- "Read the summary data from multiple sheets"
- "Extract the budget numbers from the finance sheet"

**Writing & Updating Data:**
- "Add new sales data to my tracking sheet"
- "Update the budget numbers for this quarter"
- "Insert customer information into the database"
- "Clear old data from the previous month"

**Data Management:**
- "Append new employee records to the HR sheet"
- "Update multiple cells with the latest figures"
- "Clear the temporary data from last week"
- "Batch update all regional sales numbers"

**Complex Operations:**
- "Create a monthly report sheet and populate it with data"
- "Organize my project data across multiple tabs"
- "Set up a tracking system for inventory management"
- "Migrate data from one sheet to a new organized structure"

## WHAT YOU CAN PROVIDE

While the tool works with natural language, you can also provide specific details when available:

- **Spreadsheet names or IDs** for specific operations
- **Sheet names** for multi-tab operations
- **Cell ranges** in A1 notation (e.g., "A1:C10")
- **Data values** as arrays or structured formats
- **Column headers** for organized data entry
- **Search terms** for finding specific spreadsheets

## INTELLIGENCE FEATURES

The Google Sheets specialist agent will:
- ✅ **Interpret your intent** from natural language
- ✅ **Find spreadsheets** when you describe them
- ✅ **Ask for missing information** when needed
- ✅ **Handle authentication** automatically
- ✅ **Use best practices** for data organization and management
- ✅ **Provide helpful responses** about what was accomplished
- ✅ **Handle complex workflows** like multi-sheet operations
- ✅ **Manage data types** and formatting intelligently
- ✅ **Organize information** efficiently across sheets and ranges

## BEST PRACTICES APPLIED

The agent automatically follows best practices:
- **Smart Data Organization**: Uses appropriate headers, ranges, and sheet structures
- **Efficient Operations**: Batches updates and uses optimal range selections
- **Data Integrity**: Validates data types and maintains consistency
- **Performance Optimization**: Uses batch operations and minimizes API calls
- **Clear Structure**: Organizes data logically across sheets and ranges

## SPREADSHEET CAPABILITIES

The agent can handle all Google Sheets operations:
- **Discovery**: Find and search existing spreadsheets
- **Creation**: Create new spreadsheets with custom titles and sheets
- **Data Reading**: Extract data from specific ranges or entire sheets
- **Data Writing**: Add, update, or replace data in cells and ranges
- **Sheet Management**: Add, remove, or modify individual sheets
- **Batch Operations**: Handle multiple data operations efficiently
- **Data Clearing**: Remove data while preserving structure

## DATA FORMATS SUPPORTED

The agent works with various data formats:
- **Text and Numbers**: Basic cell values and formulas
- **Tables**: Structured data with headers and rows
- **Arrays**: 2D data arrays for batch operations
- **Ranges**: A1 notation for specific cell selections
- **Multiple Sheets**: Cross-sheet data operations and references

## SECURITY & PRIVACY

- All operations go through Google's secure APIs
- Authentication is handled safely
- Your spreadsheet data remains private and secure
- Best practices for data handling and privacy are automatically applied
- Sensitive operations include confirmation steps`,
  inputSchema: z.object({
    // Natural language request - let the Sheets agent interpret the intent
    request: z.string().describe("Natural language description of what you want to do with Google Sheets (e.g., 'Create a budget spreadsheet', 'Add sales data to my tracking sheet', 'Find my project planning spreadsheet')"),
    
    // Optional specific parameters that users can provide
    query: z.string().optional().describe("Search query for finding spreadsheets"),
    maxResults: z.number().optional().describe("Maximum number of search results"),
    spreadsheetId: z.string().optional().describe("ID of the spreadsheet"),
    ranges: z.array(z.string()).optional().describe("Specific ranges in A1 notation (e.g., ['Sheet1!A1:C10'])"),
    title: z.string().optional().describe("Title for new spreadsheets or sheets"),
    sheetTitle: z.string().optional().describe("Title for new sheets"),
    rowCount: z.number().optional().describe("Number of rows for new sheets"),
    columnCount: z.number().optional().describe("Number of columns for new sheets"),
    sheetId: z.number().optional().describe("ID of the sheet to delete"),
    updates: z.array(z.object({
      range: z.string().describe("Range to update (e.g., 'Sheet1!A1:C3')"),
      values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).describe("2D array of values to set")
    })).optional().describe("Array of update operations for batch updates"),
    range: z.string().optional().describe("Range for append or clear operations"),
    values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).optional().describe("2D array of values for data operations")
  }),
  execute: async ({ context, threadId, resourceId, mastra }) => {
    console.log("🔄 Sheets tool: Delegating all requests directly to Sheets specialist agent...");
    
    // Ensure we have access to the Mastra instance
    if (!mastra) {
      return {
        success: false,
        message: "Google Sheets specialist agent is not available. Unable to process Sheets requests.",
        error: "Mastra instance not provided"
      };
    }

    // Get the Sheets specialist agent
    const sheetsAgent = mastra.getAgent("sheetsAgent");
    if (!sheetsAgent) {
      return {
        success: false,
        message: "Google Sheets specialist agent is not available. Please check your configuration.",
        error: "Sheets agent not found in Mastra instance"
      };
    }

    // Build a comprehensive prompt with the user's request and any provided parameters
    let prompt = `I need help with a Google Sheets task: ${context.request}`;
    
    // Add any specific parameters that were provided
    const providedParams = Object.entries(context)
      .filter(([key, value]) => key !== 'request' && value !== undefined && value !== null)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(", ");
    
    if (providedParams) {
      prompt += `\n\nAdditional context provided: ${providedParams}`;
    }
    
    prompt += `\n\nPlease analyze this request and perform the appropriate Google Sheets operation. If you need authentication, use the loginTool first.`;

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
        agentResponse: result.text,
        delegatedToAgent: true,
        userRequest: context.request,
        providedContext: context,
      };
    } catch (error) {
      console.error("Sheets specialist agent failed:", error);
      return {
        success: false,
        message: "Google Sheets specialist agent failed to process the request. Please try again or provide more specific details about what you want to do with Google Sheets.",
        error: error instanceof Error ? error.message : 'Unknown error',
        userRequest: context.request,
        providedContext: context,
      };
    }
  }
}); 