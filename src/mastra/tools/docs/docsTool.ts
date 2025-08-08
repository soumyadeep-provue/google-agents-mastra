import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createDocumentTool } from "./createDocumentTool";
import { getDocumentTool } from "./getDocumentTool";
import { insertTextTool } from "./insertTextTool";
import { replaceTextTool } from "./replaceTextTool";
import { deleteContentTool } from "./deleteContentTool";
import { copyDocumentTool } from "./copyDocumentTool";
import { searchDocumentsTool } from "./searchDocumentsTool";
import { insertTableTool } from "./insertTableTool";

export const docsTool = createTool({
  id: "docs",
  description: `A comprehensive tool for Google Docs operations: create, get, insert text, replace text, delete content, copy, search documents, and insert tables.

## AVAILABLE ACTIONS

### Document Discovery & Management
- **"search"**: Find documents by name or get all documents
  - Leave query empty to get all documents
  - Use specific terms to find documents by name
  - Set maxResults to limit results (default: 10)
  - Example: { action: "search", query: "project report", maxResults: 5 }

- **"get"**: Retrieve full document content and metadata
  - Returns formatted text content and document details
  - Use before editing to understand current state
  - Example: { action: "get", documentId: "abc123" }

### Document Creation & Duplication
- **"create"**: Create new Google Docs documents
  - Provide meaningful titles for better organization
  - Returns document ID and web view link
  - Example: { action: "create", title: "Meeting Notes - Jan 2024" }

- **"copy"**: Duplicate existing documents
  - Perfect for templates or creating similar documents
  - Optionally provide custom title for the copy
  - Example: { action: "copy", documentId: "abc123", title: "Q2 Report Copy" }

### Content Editing (Use in Priority Order)
- **"insert"**: Add new content to documents
  - If no index specified, automatically appends to end
  - Use specific index for precise placement
  - Ideal for adding paragraphs, sections, or any new content
  - Example: { action: "insert", documentId: "abc123", text: "New section content" }

- **"replace"**: Find and replace text throughout document
  - Replaces ALL occurrences of target text
  - Use matchCase parameter for exact matching when needed
  - Perfect for bulk text changes, corrections, or updates
  - Returns count of replacements made
  - Example: { action: "replace", documentId: "abc123", findText: "Q3 2024", replaceText: "Q4 2024" }

- **"delete"**: Remove specific content ranges
  - Requires precise start and end indices
  - Use "get" action first to identify exact positions
  - Be careful - indices shift after edits
  - Example: { action: "delete", documentId: "abc123", startIndex: 50, endIndex: 100 }

### Structured Content
- **"insertTable"**: Add tables to documents
  - Specify rows and columns count
  - Use index parameter for precise placement
  - Defaults to end of document if no index provided
  - Example: { action: "insertTable", documentId: "abc123", rows: 3, columns: 4 }

## BEST PRACTICES

### Workflow Recommendations
1. **Search First**: Always search for documents before asking user for IDs
2. **Content Review**: Get document content before complex edits
3. **Appropriate Tools**: Use replace for bulk changes, not delete + insert
4. **Index Management**: Remember Google Docs uses 0-based indexing

### Error Handling
- Check tool responses for success status
- Authentication failures require loginTool
- Provide clear error messages with suggested solutions

### Efficiency Tips
- Use meaningful document titles for better searchability
- Batch related operations when possible
- Cache document IDs during conversation for multiple operations`,
  inputSchema: z.object({
    action: z.enum(["create", "get", "insert", "replace", "delete", "copy", "search", "insertTable"]).optional().describe("The specific Google Docs action to perform. If unclear or missing, will be handled by Docs specialist agent."),
    
    // Create document
    title: z.string().optional().describe("Title of the document (for create/copy actions)"),
    
    // Get/Delete/Insert/Replace/Copy/InsertTable document
    documentId: z.string().optional().describe("The ID of the document (for get/insert/replace/delete/copy/insertTable actions)"),
    
    // Insert text
    text: z.string().optional().describe("The text to insert (for insert action)"),
    index: z.number().optional().describe("Position to insert text (for insert action, defaults to end of document)"),
    
    // Replace text
    findText: z.string().optional().describe("The text to find and replace (for replace action)"),
    replaceText: z.string().optional().describe("The text to replace it with (for replace action)"),
    matchCase: z.boolean().optional().describe("Whether to match case (for replace action, default: false)"),
    
    // Delete content
    startIndex: z.number().optional().describe("Start position of content to delete (for delete action)"),
    endIndex: z.number().optional().describe("End position of content to delete (for delete action)"),
    
    // Search documents
    query: z.string().optional().describe("Search query for document names (for search action - leave empty to get all documents)"),
    maxResults: z.number().optional().describe("Maximum number of results to return (for search action, default: 10)"),
    
    // Insert table
    rows: z.number().optional().describe("Number of rows for the table (for insertTable action)"),
    columns: z.number().optional().describe("Number of columns for the table (for insertTable action)"),
    
    // Fallback context for Docs specialist agent
    userIntent: z.string().optional().describe("Natural language description of what you want to do with Google Docs (used when action is unclear)")
  }),
  execute: async ({ context, threadId, resourceId, mastra }) => {
    // Handle cases where action is missing - provide helpful guidance
    if (!context.action) {
      return {
        success: false,
        message: "I can help you with Google Docs tasks! Please specify what you'd like to do. For example:\n- Create a document (provide title)\n- Get document content (provide document ID)\n- Insert text into a document\n- Replace text in a document\n- Search for documents\n- Copy documents\n- Insert tables",
        availableActions: ["create", "get", "insert", "replace", "delete", "copy", "search", "insertTable"]
      };
    }

    // Validate required fields for each action and provide helpful guidance
    switch (context.action) {
      case "create":
        // Title is optional for create - can create with default title
        return await createDocumentTool.execute({ 
          context: { title: context.title } 
        });
        
      case "get":
        if (!context.documentId) {
          return {
            success: false,
            message: "To get document content, I need:\n- **Document ID**: Which document would you like to retrieve?",
            required: ["documentId"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await getDocumentTool.execute({ 
          context: { documentId: context.documentId } 
        });
        
      case "insert":
        if (!context.documentId || !context.text) {
          return {
            success: false,
            message: "To insert text into a document, I need:\n- **Document ID**: Which document to edit?\n- **Text**: What content would you like to insert?",
            required: ["documentId", "text"],
            optional: ["index"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await insertTextTool.execute({ 
          context: { 
            documentId: context.documentId, 
            text: context.text, 
            index: context.index 
          } 
        });
        
      case "replace":
        if (!context.documentId || !context.findText || !context.replaceText) {
          return {
            success: false,
            message: "To replace text in a document, I need:\n- **Document ID**: Which document to edit?\n- **Find Text**: What text to find and replace?\n- **Replace Text**: What text to replace it with?",
            required: ["documentId", "findText", "replaceText"],
            optional: ["matchCase"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await replaceTextTool.execute({ 
          context: { 
            documentId: context.documentId, 
            findText: context.findText, 
            replaceText: context.replaceText, 
            matchCase: context.matchCase 
          } 
        });
        
      case "delete":
        if (!context.documentId || context.startIndex === undefined || context.endIndex === undefined) {
          return {
            success: false,
            message: "To delete content from a document, I need:\n- **Document ID**: Which document to edit?\n- **Start Index**: Where to start deleting?\n- **End Index**: Where to stop deleting?",
            required: ["documentId", "startIndex", "endIndex"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await deleteContentTool.execute({ 
          context: { 
            documentId: context.documentId, 
            startIndex: context.startIndex, 
            endIndex: context.endIndex 
          } 
        });
        
      case "copy":
        if (!context.documentId) {
          return {
            success: false,
            message: "To copy a document, I need:\n- **Document ID**: Which document would you like to copy?",
            required: ["documentId"],
            optional: ["title"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await copyDocumentTool.execute({ 
          context: { 
            documentId: context.documentId, 
            title: context.title 
          } 
        });
        
      case "search":
        // Search doesn't require any fields - can search all documents
        return await searchDocumentsTool.execute({ 
          context: { 
            query: context.query, 
            maxResults: context.maxResults 
          } 
        });
        
      case "insertTable":
        if (!context.documentId || !context.rows || !context.columns) {
          return {
            success: false,
            message: "To insert a table into a document, I need:\n- **Document ID**: Which document to edit?\n- **Rows**: How many rows for the table?\n- **Columns**: How many columns for the table?",
            required: ["documentId", "rows", "columns"],
            optional: ["index"],
            providedFields: Object.keys(context).filter(key => context[key as keyof typeof context] !== undefined)
          };
        }
        return await insertTableTool.execute({ 
          context: { 
            documentId: context.documentId, 
            rows: context.rows, 
            columns: context.columns, 
            index: context.index 
          } 
        });
        
      default:
        // Fallback to Docs specialist agent for unknown actions
        console.log(`🔄 Docs action unclear or unknown: "${context.action}". Delegating to Docs specialist agent...`);
        
        if (!mastra) {
          return {
            success: false,
            message: `Unknown Google Docs action: "${context.action}". Available actions are:\n- create: Create a new document\n- get: Retrieve document content\n- insert: Add text to a document\n- replace: Find and replace text\n- delete: Remove content from a document\n- copy: Duplicate a document\n- search: Find documents\n- insertTable: Add tables to documents`,
            availableActions: ["create", "get", "insert", "replace", "delete", "copy", "search", "insertTable"],
            unknownAction: context.action
          };
        }

        const docsAgent = mastra.getAgent("docsAgent");
        if (!docsAgent) {
          return {
            success: false,
            message: `Unknown Google Docs action: "${context.action}". Available actions are:\n- create: Create a new document\n- get: Retrieve document content\n- insert: Add text to a document\n- replace: Find and replace text\n- delete: Remove content from a document\n- copy: Duplicate a document\n- search: Find documents\n- insertTable: Add tables to documents`,
            availableActions: ["create", "get", "insert", "replace", "delete", "copy", "search", "insertTable"],
            unknownAction: context.action
          };
        }

        // Create a natural language prompt for the Docs specialist
        const contextDescription = Object.entries(context)
          .filter(([key, value]) => value !== undefined && value !== null)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join(", ");

        const prompt = `I need help with a Google Docs task. Here's the context I received: ${contextDescription}

Please analyze this and perform the appropriate Google Docs operation. If you need authentication, use the loginTool first.`;

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
            specialistResponse: result.text,
            delegatedAction: true,
            originalContext: context,
          };
        } catch (error) {
          console.error("Docs specialist agent failed:", error);
          return {
            success: false,
            message: `Docs specialist agent failed to process the request. Available actions are:\n- create: Create a new document\n- get: Retrieve document content\n- insert: Add text to a document\n- replace: Find and replace text\n- delete: Remove content from a document\n- copy: Duplicate a document\n- search: Find documents\n- insertTable: Add tables to documents`,
            error: error instanceof Error ? error.message : 'Unknown error',
            availableActions: ["create", "get", "insert", "replace", "delete", "copy", "search", "insertTable"]
          };
        }
    }
  }
});