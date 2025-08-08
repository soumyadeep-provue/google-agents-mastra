import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const driveTool = createTool({
  id: "drive",
  description: `A natural language Google Drive tool that delegates all operations to a specialized Drive agent. Simply describe what you want to do with Google Drive in plain English.

## HOW TO USE

Just describe your Google Drive task naturally! The tool accepts natural language requests and handles all the complexity for you.

### Examples of Requests:

**Finding Files & Folders:**
- "Find all my presentation files"
- "Search for documents containing 'budget'"
- "Show me all PDF files in my drive"
- "Look for the project proposal folder"

**Creating Folders:**
- "Create a folder called 'Client Documents 2024'"
- "Make a new folder for project files"
- "Create a subfolder called 'Images' in my Marketing folder"

**File Management:**
- "Upload the contract.pdf file to my Legal folder"
- "Move the quarterly report to the Reports folder"
- "Download my presentation file to the Desktop"
- "Copy the template document for the new project"

**Sharing & Collaboration:**
- "Share the budget spreadsheet with john@company.com with edit access"
- "Give read access to the project folder to the entire team"
- "Share my presentation with sarah@client.com as view-only"

**Organization:**
- "Organize all my photos into a Photos folder"
- "Move all documents from last month to the Archive folder"
- "Create a project structure with subfolders for docs, images, and data"

**Complex Operations:**
- "Find all unorganized files and suggest a folder structure"
- "Upload my local project files and organize them by type"
- "Share the entire project folder with the team and set appropriate permissions"

## WHAT YOU CAN PROVIDE

While the tool works with natural language, you can also provide specific details when available:

- **File names or descriptions** for searching
- **Folder names** for organization
- **File paths** for uploads and downloads
- **File/Folder IDs** when you know them
- **Email addresses** for sharing
- **Permission levels** (reader, writer, commenter)
- **MIME types** for specific file filtering

## INTELLIGENCE FEATURES

The Google Drive specialist agent will:
- ✅ **Interpret your intent** from natural language
- ✅ **Find files and folders** when you describe them
- ✅ **Ask for missing information** when needed
- ✅ **Handle authentication** automatically
- ✅ **Use best practices** for file organization and sharing
- ✅ **Provide helpful responses** about what was accomplished
- ✅ **Handle complex workflows** like multi-step file operations
- ✅ **Manage permissions** intelligently and securely

## BEST PRACTICES APPLIED

The agent automatically follows best practices:
- **Smart File Discovery**: Searches for files by name/type when IDs aren't provided
- **Secure Sharing**: Uses appropriate permission levels for different collaboration needs
- **Efficient Organization**: Creates logical folder structures and file hierarchies
- **Error Prevention**: Validates operations and provides clear feedback
- **Privacy Protection**: Handles sensitive file sharing with appropriate caution

## SECURITY & PRIVACY

- All operations go through Google's secure APIs
- Authentication is handled safely
- Your file data remains private and secure
- Best practices for file sharing and permissions are automatically applied
- Sensitive operations require explicit confirmation`,
  inputSchema: z.object({
    // Natural language request - let the Drive agent interpret the intent
    request: z.string().describe("Natural language description of what you want to do with Google Drive (e.g., 'Find my presentation files', 'Create a folder for project documents', 'Share the budget with the team')"),
    
    // Optional specific parameters that users can provide
    query: z.string().optional().describe("Search query for finding files"),
    maxResults: z.number().optional().describe("Maximum number of search results"),
    mimeType: z.string().optional().describe("Filter by specific MIME type (e.g., 'application/pdf')"),
    name: z.string().optional().describe("Name for folder creation or file operations"),
    parentId: z.string().optional().describe("ID of parent folder"),
    fileId: z.string().optional().describe("ID of the file or folder"),
    email: z.string().optional().describe("Email address for sharing"),
    role: z.enum(["reader", "writer", "commenter"]).optional().describe("Permission role for sharing"),
    newParentId: z.string().optional().describe("ID of the destination folder for moving"),
    oldParentId: z.string().optional().describe("ID of the current parent folder"),
    filePath: z.string().optional().describe("Local path to the file for upload"),
    fileName: z.string().optional().describe("Name for the uploaded file"),
    outputPath: z.string().optional().describe("Local path where the file should be saved for download")
  }),
  execute: async ({ context, threadId, resourceId, mastra }) => {
    console.log("🔄 Drive tool: Delegating all requests directly to Drive specialist agent...");
    
    // Ensure we have access to the Mastra instance
    if (!mastra) {
      return {
        success: false,
        message: "Google Drive specialist agent is not available. Unable to process Drive requests.",
        error: "Mastra instance not provided"
      };
    }

    // Get the Drive specialist agent
    const driveAgent = mastra.getAgent("driveAgent");
    if (!driveAgent) {
      return {
        success: false,
        message: "Google Drive specialist agent is not available. Please check your configuration.",
        error: "Drive agent not found in Mastra instance"
      };
    }

    // Build a comprehensive prompt with the user's request and any provided parameters
    let prompt = `I need help with a Google Drive task: ${context.request}`;
    
    // Add any specific parameters that were provided
    const providedParams = Object.entries(context)
      .filter(([key, value]) => key !== 'request' && value !== undefined && value !== null)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(", ");
    
    if (providedParams) {
      prompt += `\n\nAdditional context provided: ${providedParams}`;
    }
    
    prompt += `\n\nPlease analyze this request and perform the appropriate Google Drive operation. If you need authentication, use the loginTool first.`;

    try {
      const result = await driveAgent.generate(prompt, {
        memory: threadId && resourceId ? {
          thread: threadId,
          resource: resourceId,
        } : undefined,
        maxSteps: 8,
      });

      return {
        success: true,
        message: "✅ Google Drive task completed by specialist agent",
        agentResponse: result.text,
        delegatedToAgent: true,
        userRequest: context.request,
        providedContext: context,
      };
    } catch (error) {
      console.error("Drive specialist agent failed:", error);
      return {
        success: false,
        message: "Google Drive specialist agent failed to process the request. Please try again or provide more specific details about what you want to do with Google Drive.",
        error: error instanceof Error ? error.message : 'Unknown error',
        userRequest: context.request,
        providedContext: context,
      };
    }
  }
}); 