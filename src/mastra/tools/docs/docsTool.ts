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
    action: z.enum(["create", "get", "insert", "replace", "delete", "copy", "search", "insertTable"]).describe("The action to perform"),
    
    // Create document
    title: z.string().optional().describe("Title of the document (optional, for create/copy actions)"),
    
    // Get/Delete/Insert/Replace/Copy/InsertTable document
    documentId: z.string().optional().describe("The ID of the document (required for get/insert/replace/delete/copy/insertTable actions)"),
    
    // Insert text
    text: z.string().optional().describe("The text to insert (required for insert action)"),
    index: z.number().optional().describe("Position to insert text (optional for insert action, defaults to end of document)"),
    
    // Replace text
    findText: z.string().optional().describe("The text to find and replace (required for replace action)"),
    replaceText: z.string().optional().describe("The text to replace it with (required for replace action)"),
    matchCase: z.boolean().optional().describe("Whether to match case (optional for replace action, default: false)"),
    
    // Delete content
    startIndex: z.number().optional().describe("Start position of content to delete (required for delete action)"),
    endIndex: z.number().optional().describe("End position of content to delete (required for delete action)"),
    
    // Search documents
    query: z.string().optional().describe("Search query for document names (optional for search action - leave empty to get all documents)"),
    maxResults: z.number().optional().describe("Maximum number of results to return (optional for search action, default: 10)"),
    
    // Insert table
    rows: z.number().optional().describe("Number of rows for the table (required for insertTable action)"),
    columns: z.number().optional().describe("Number of columns for the table (required for insertTable action)")
  }),
  execute: async ({ context }) => {
    switch (context.action) {
      case "create":
        return await createDocumentTool.execute({ 
          context: { title: context.title } 
        });
        
      case "get":
        return await getDocumentTool.execute({ 
          context: { documentId: context.documentId } 
        });
        
      case "insert":
        return await insertTextTool.execute({ 
          context: { 
            documentId: context.documentId, 
            text: context.text, 
            index: context.index 
          } 
        });
        
      case "replace":
        return await replaceTextTool.execute({ 
          context: { 
            documentId: context.documentId, 
            findText: context.findText, 
            replaceText: context.replaceText, 
            matchCase: context.matchCase 
          } 
        });
        
      case "delete":
        return await deleteContentTool.execute({ 
          context: { 
            documentId: context.documentId, 
            startIndex: context.startIndex, 
            endIndex: context.endIndex 
          } 
        });
        
      case "copy":
        return await copyDocumentTool.execute({ 
          context: { 
            documentId: context.documentId, 
            title: context.title 
          } 
        });
        
      case "search":
        return await searchDocumentsTool.execute({ 
          context: { 
            query: context.query, 
            maxResults: context.maxResults 
          } 
        });
        
      case "insertTable":
        return await insertTableTool.execute({ 
          context: { 
            documentId: context.documentId, 
            rows: context.rows, 
            columns: context.columns, 
            index: context.index 
          } 
        });
        
      default:
        throw new Error(`Unknown action: ${(context as any).action}`);
    }
  }
});