import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const docsTool = createTool({
  id: "docs",
  description: `A natural language Google Docs tool that delegates all operations to a specialized Docs agent. Simply describe what you want to do with Google Docs in plain English.

## HOW TO USE

Just describe your Google Docs task naturally! The tool accepts natural language requests and handles all the complexity for you.

### Examples of Requests:

**Creating Documents:**
- "Create a new document called 'Project Proposal 2024'"
- "Make a new doc for meeting notes"
- "Create a document titled 'Team Guidelines'"

**Finding & Reading Documents:**
- "Find documents about the budget"
- "Search for docs containing 'quarterly report'"
- "Get the content of my project planning document"
- "Show me all my documents"

**Editing Content:**
- "Add 'Executive Summary' to the beginning of the document"
- "Insert a paragraph about the project timeline"
- "Replace all instances of 'Q3' with 'Q4' in the document"
- "Delete the section between paragraphs 2 and 4"

**Structured Content:**
- "Add a table with 3 rows and 4 columns to the document"
- "Insert a 5x3 table for the budget breakdown"
- "Create a table at the beginning of the document"

**Document Management:**
- "Copy the template document for the new project"
- "Duplicate the meeting notes template"
- "Make a copy of the proposal with title 'Proposal v2'"

**Complex Operations:**
- "Create a new project document and add a summary table"
- "Find the budget document and update all 2023 references to 2024"
- "Copy the template, rename it to 'New Project Plan', and add an intro paragraph"

## WHAT YOU CAN PROVIDE

While the tool works with natural language, you can also provide specific details when available:

- **Document titles** for creation or searching
- **Document IDs** when you know them
- **Specific text content** to insert or replace
- **Table dimensions** (rows and columns)
- **Position information** for precise placement
- **Search queries** for finding documents

## INTELLIGENCE FEATURES

The Google Docs specialist agent will:
- ✅ **Interpret your intent** from natural language
- ✅ **Find documents** when you describe them
- ✅ **Ask for missing information** when needed
- ✅ **Handle authentication** automatically
- ✅ **Use best practices** for document management
- ✅ **Provide helpful responses** about what was accomplished
- ✅ **Handle complex workflows** like multi-step document operations
- ✅ **Manage document structure** intelligently

## BEST PRACTICES APPLIED

The agent automatically follows best practices:
- **Smart Document Discovery**: Searches for documents by name when IDs aren't provided
- **Content-Aware Editing**: Reviews document content before making complex changes
- **Efficient Operations**: Uses the most appropriate editing method for each task
- **Error Prevention**: Validates operations and provides clear feedback
- **Organization**: Uses meaningful titles and maintains document structure

## SECURITY & PRIVACY

- All operations go through Google's secure APIs
- Authentication is handled safely
- Your document data remains private and secure
- Best practices for document sharing and permissions are automatically applied`,
  inputSchema: z.object({
    // Natural language request - let the Docs agent interpret the intent
    request: z.string().describe("Natural language description of what you want to do with Google Docs (e.g., 'Create a document called Meeting Notes', 'Insert a table in my project doc', 'Find documents about budget')"),
    
    // Optional specific parameters that users can provide
    title: z.string().optional().describe("Document title for creation or searching"),
    documentId: z.string().optional().describe("The ID of the document"),
    text: z.string().optional().describe("Text content to insert or work with"),
    index: z.number().optional().describe("Position for text insertion or operations"),
    findText: z.string().optional().describe("Text to find and replace"),
    replaceText: z.string().optional().describe("Text to replace it with"),
    matchCase: z.boolean().optional().describe("Whether to match case for replace operations"),
    startIndex: z.number().optional().describe("Start position for content deletion"),
    endIndex: z.number().optional().describe("End position for content deletion"),
    query: z.string().optional().describe("Search query for finding documents"),
    maxResults: z.number().optional().describe("Maximum number of search results"),
    rows: z.number().optional().describe("Number of rows for table insertion"),
    columns: z.number().optional().describe("Number of columns for table insertion")
  }),
  execute: async ({ context, threadId, resourceId, mastra }) => {
    console.log("🔄 Docs tool: Delegating all requests directly to Docs specialist agent...");
    
    // Ensure we have access to the Mastra instance
    if (!mastra) {
      return {
        success: false,
        message: "Google Docs specialist agent is not available. Unable to process Docs requests.",
        error: "Mastra instance not provided"
      };
    }

    // Get the Docs specialist agent
    const docsAgent = mastra.getAgent("docsAgent");
    if (!docsAgent) {
      return {
        success: false,
        message: "Google Docs specialist agent is not available. Please check your configuration.",
        error: "Docs agent not found in Mastra instance"
      };
    }

    // Build a comprehensive prompt with the user's request and any provided parameters
    let prompt = `I need help with a Google Docs task: ${context.request}`;
    
    // Add any specific parameters that were provided
    const providedParams = Object.entries(context)
      .filter(([key, value]) => key !== 'request' && value !== undefined && value !== null)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(", ");
    
    if (providedParams) {
      prompt += `\n\nAdditional context provided: ${providedParams}`;
    }
    
    prompt += `\n\nPlease analyze this request and perform the appropriate Google Docs operation. If you need authentication, use the loginTool first.`;

    try {
      const result = await docsAgent.generate(prompt, {
        memory: threadId && resourceId ? {
          thread: threadId,
          resource: resourceId,
        } : undefined,
        maxSteps: 8,
      });

      return {
        success: true,
        message: "✅ Google Docs task completed by specialist agent",
        agentResponse: result.text,
        delegatedToAgent: true,
        userRequest: context.request,
        providedContext: context,
      };
    } catch (error) {
      console.error("Docs specialist agent failed:", error);
      return {
        success: false,
        message: "Google Docs specialist agent failed to process the request. Please try again or provide more specific details about what you want to do with Google Docs.",
        error: error instanceof Error ? error.message : 'Unknown error',
        userRequest: context.request,
        providedContext: context,
      };
    }
  }
});