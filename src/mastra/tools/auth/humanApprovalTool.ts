import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients, getAuthUrl } from "./auth";

// Global store for pending approvals
const pendingApprovals = new Map<string, any>();
const approvalPromises = new Map<string, { resolve: Function; reject: Function }>();

// Global store for preview data
const previewData = new Map<string, any>();

// Function to store preview data
export function storePreviewData(requestId: string, data: any) {
  previewData.set(requestId, {
    ...data,
    timestamp: Date.now()
  });
  
  // Auto-cleanup after 10 minutes
  setTimeout(() => {
    previewData.delete(requestId);
  }, 10 * 60 * 1000);
}

// Function to get preview data
export function getPreviewData(requestId: string) {
  return previewData.get(requestId) || null;
}

// Function to generate preview URLs
function generatePreviewLinks(requestId: string, baseUrl: string = "http://localhost:4111"): { previewUrl: string } {
  return {
    previewUrl: `${baseUrl}/api/preview/${requestId}`
  };
}

// Function to wait for human approval
function waitForHumanApproval(requestId: string, timeoutMs: number): Promise<{approved: boolean, reason?: string, approver?: string}> {
  return new Promise((resolve, reject) => {
    // Store the promise resolvers
    approvalPromises.set(requestId, { resolve, reject });
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      approvalPromises.delete(requestId);
      pendingApprovals.delete(requestId);
      reject(new Error("Approval request timed out"));
    }, timeoutMs);
    
    // Clean up timeout when resolved
    const originalResolve = resolve;
    const wrappedResolve = (result: any) => {
      clearTimeout(timeoutId);
      approvalPromises.delete(requestId);
      pendingApprovals.delete(requestId);
      originalResolve(result);
    };
    
    approvalPromises.set(requestId, { resolve: wrappedResolve, reject });
  });
}

// Function to handle approval response from API
export function handleApprovalResponse(requestId: string, approved: boolean, reason?: string) {
  const promiseHandlers = approvalPromises.get(requestId);
  if (promiseHandlers) {
    promiseHandlers.resolve({
      approved,
      reason,
      approver: "Human User"
    });
  }
}

// Function to generate approval URLs
function generateApprovalLinks(requestId: string, baseUrl: string = "http://localhost:4111"): { approveUrl: string; denyUrl: string } {
  return {
    approveUrl: `${baseUrl}/api/approve/${requestId}?action=approve`,
    denyUrl: `${baseUrl}/api/approve/${requestId}?action=deny`
  };
}

// Function to format preview message showing what will happen
function formatPreviewMessage(approvalType: string, action: string, contentPreview: string): string {
  let message = `\n📋 **PREVIEW OF UPCOMING ACTION**\n\n`;
  message += `**Action:** ${action}\n\n`;
  message += `**Content Preview:**\n${contentPreview}\n\n`;
  message += `⏳ Requesting your approval before proceeding...\n`;
  
  return message;
}

// Function to format approval message with clear URLs instead of markdown links
function formatApprovalMessage(approvalType: string, action: string, details: string, requestId: string): string {
  const { approveUrl, denyUrl } = generateApprovalLinks(requestId);
  
  let message = `\n🚨 **HUMAN APPROVAL REQUIRED**\n\n`;
  message += `**Action:** ${action}\n`;
  message += `**Details:** ${details}\n\n`;
  
  message += `**CLICK THESE LINKS TO RESPOND:**\n\n`;
  message += `✅ **APPROVE:** ${approveUrl}\n\n`;
  message += `❌ **CANCEL:** ${denyUrl}\n\n`;
  message += `⏰ This approval will timeout in 5 minutes if no action is taken.\n`;
  message += `💡 Click the URLs above to open confirmation pages in your browser.\n`;
  
  return message;
}

// Function to format a combined message for preview and approval
function formatCombinedMessage(approvalType: string, action: string, details: string, contentPreview: string | undefined, requestId: string): string {
  let message = "";
  
  if (contentPreview) {
    message += formatPreviewMessage(approvalType, action, contentPreview);
  }
  
  message += formatApprovalMessage(approvalType, action, details, requestId);
  
  return message;
}

export const humanApprovalTool = createTool({
  id: "human-approval-tool",
  description: `A comprehensive human approval system for Google Services operations with clickable approval links and rich content previews.

## CRITICAL APPROVAL REQUIREMENTS

### MANDATORY EMAIL APPROVAL
**EVERY EMAIL OPERATION REQUIRES HUMAN APPROVAL - NO EXCEPTIONS**

For ANY email sending operation (send, reply, forward):
1. **ALWAYS** use this tool with approvalType: "content_confirmation"
2. **ALWAYS** provide complete email preview in contentPreview parameter
3. **NEVER** send emails without approval - this is MANDATORY
4. Wait for approval result before proceeding with email operation

### MANDATORY APPROVAL OPERATIONS
The following operations REQUIRE human approval:

**HIGH SEVERITY (severity: "high")**:
- **Gmail**: sendEmail, reply - Use approvalType: "content_confirmation"
- **Drive**: share - Use approvalType: "execution_approval" 
- **Docs**: replace, delete - Use approvalType: "execution_approval"
- **Sheets**: deleteSheet, batchUpdate, clear - Use approvalType: "execution_approval"

**MEDIUM SEVERITY (severity: "medium")**:
- **Docs**: insert - Use approvalType: "content_confirmation"
- **Drive**: upload (to shared folders), move (important files)
- **Sheets**: create (business data), append (financial data)

**LOW SEVERITY (severity: "low")**:
- Read-only operations: NO approval needed
- Document creation (title only): NO approval needed
- Safe organizational operations: NO approval needed

## APPROVAL TYPES & USAGE

### "content_confirmation"
Use for operations where user needs to review content before execution:
- **Email operations**: Show complete email with headers, recipients, subject, body
- **Text insertion**: Show text to be inserted and target location
- **Content modifications**: Show what will be changed

### "execution_approval" 
Use for potentially dangerous operations that change permissions or delete data:
- **File sharing**: Show file details, recipients, permission levels
- **Data deletion**: Show what will be deleted and impact
- **Permission changes**: Show current vs new permissions
- **Bulk operations**: Show scope and impact of changes

### "authentication"
Use when user needs to complete OAuth flow:
- Show authentication URL
- Explain what access will be granted
- Wait for authentication completion

### "general"
Use for other approval needs not covered by specific types.

## SEVERITY LEVELS

### "high" 
Operations that could cause data loss, security issues, or send communications:
- All email operations
- File sharing with external users  
- Data deletion or bulk modifications
- Permission changes

### "medium"
Operations that create or modify content but are reversible:
- Document text insertions and modifications
- File uploads and moves
- Spreadsheet modifications
- Content insertions

### "low"
Safe operations with minimal impact:
- Read-only operations (no approval needed)
- Creating new documents with titles only
- Basic searches and file organization
- Safe organizational operations

## REQUIRED PARAMETERS

### For Email Operations (MANDATORY)
\`\`\`javascript
{
  approvalType: "content_confirmation",
  action: "Send Email" / "Reply to Email",
  details: "Recipients: user@example.com\\nSubject: Project Update",
  contentPreview: "To: user@example.com\\nSubject: Project Update\\n\\nEmail body content...",
  severity: "high"
}
\`\`\`

### For File Sharing (MANDATORY)
\`\`\`javascript
{
  approvalType: "execution_approval", 
  action: "Share File in Google Drive",
  details: "File: document.pdf\\nShare with: colleague@company.com\\nPermission: edit",
  contentPreview: JSON.stringify({fileName, shareWith, permission, shareType}),
  severity: "high"
}
\`\`\`

### For Document Operations
\`\`\`javascript
{
  approvalType: "content_confirmation",
  action: "Insert Text into Document",
  details: "Document: Meeting Notes\\nInsertion position: End of document",
  contentPreview: "Text content to be inserted into the document",
  severity: "medium"
}
\`\`\`

## PREVIEW SYSTEM

When contentPreview is provided:
- Automatic preview page generation at /api/preview/{requestId}
- Preview link displayed alongside approval links
- Rich HTML formatting based on content type (email, document, sharing)
- Auto-cleanup after 10 minutes

## APPROVAL WORKFLOW

1. **Check Operation**: Determine if operation requires approval
2. **Call Tool**: Use appropriate approvalType and severity
3. **Wait for Response**: Tool will pause execution until user responds
4. **Handle Result**: Check approved/denied status before proceeding
5. **Error Handling**: Always handle approval denial gracefully

## EXAMPLE USAGE

### Email Approval (MANDATORY)
\`\`\`javascript
const approval = await humanApprovalTool.execute({
  context: {
    approvalType: "content_confirmation",
    action: "Send Email via Gmail", 
    details: "To: colleague@company.com\\nSubject: Project Update",
    contentPreview: "To: colleague@company.com\\nSubject: Project Update\\n\\nThe project is on track...",
    severity: "high"
  }
});

if (!approval.approved) {
  return { error: "Email cancelled by user" };
}
// Proceed with email sending
\`\`\`

### File Sharing Approval
\`\`\`javascript
const approval = await humanApprovalTool.execute({
  context: {
    approvalType: "execution_approval",
    action: "Share File in Google Drive",
    details: "File: important.pdf\\nShare with: external@company.com\\nPermission: edit",
    contentPreview: JSON.stringify({fileName: "important.pdf", shareWith: "external@company.com", permission: "edit"}),
    severity: "high"
  }
});
\`\`\`

## RESPONSE FORMAT

Returns approval result with:
- \`approved\`: boolean - Whether user approved the action
- \`reason\`: string - User's reason or system message
- \`timestamp\`: string - When approval was given/denied
- \`approver\`: string - Who made the decision
- \`output\`: string - Message to display to user

## CRITICAL REMINDERS

1. **EMAIL OPERATIONS**: ALWAYS require approval - no exceptions
2. **CONTENT PREVIEW**: Always provide for content_confirmation type
3. **ERROR HANDLING**: Always check approval.approved before proceeding
4. **SEVERITY**: Match severity to actual risk level
5. **DETAILS**: Provide clear, specific operation details

This tool ensures user control over sensitive operations while maintaining security and providing rich preview capabilities.`,
  inputSchema: z.object({
    approvalType: z.enum(["authentication", "content_confirmation", "execution_approval", "general"]).describe("Type of approval required"),
    action: z.string().describe("The action that requires human approval"),
    details: z.string().describe("Detailed description of what will be performed"),
    severity: z.enum(["low", "medium", "high"]).describe("Severity level of the action"),
    timeout: z.number().optional().describe("Timeout in seconds (default: 300)"),
    authUrl: z.string().optional().describe("OAuth URL for authentication type"),
    contentPreview: z.string().optional().describe("Preview of content for confirmation"),
    buttonText: z.string().optional().describe("Custom text for approval button"),
    denyText: z.string().optional().describe("Custom text for deny button"),
  }),
  outputSchema: z.object({
    approved: z.boolean(),
    reason: z.string().optional(),
    timestamp: z.string(),
    approver: z.string().optional(),
    continuedFromAuth: z.boolean().optional(),
    contentConfirmed: z.boolean().optional(),
    output: z.string().describe("The approval message to show to the user"),
  }),
  execute: async ({ context: { approvalType, action, details, severity, timeout = 300, authUrl, contentPreview, buttonText, denyText } }) => {
    // First, check if user is authenticated
    const googleClients = await setupGoogleClients();
    
    if (!googleClients) {
      // User is not authenticated - return auth link
      const authenticationUrl = getAuthUrl();
      
      let authOutput = `🔐 AUTHENTICATION REQUIRED\n\nBefore we can ${action.toLowerCase()}, you need to connect your Google account.\n\n🔗 CONNECT YOUR GOOGLE ACCOUNT:\n${authenticationUrl}\n\nAfter connecting, please try your request again.`;
      
      console.log('Authentication required, providing auth URL:', authenticationUrl);
      
      return {
        approved: false,
        reason: "Authentication required",
        timestamp: new Date().toISOString(),
        approver: "System",
        continuedFromAuth: false,
        contentConfirmed: false,
        output: authOutput,
      };
    }

    // User is authenticated - create approval request
    const requestId = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store approval request in memory
    pendingApprovals.set(requestId, {
      approvalType,
      action,
      details,
      severity,
      timeout,
      authUrl,
      contentPreview,
      buttonText: buttonText || getDefaultButtonText(approvalType),
      denyText: denyText || "Cancel",
      status: "pending",
      timestamp: Date.now()
    });

    // Generate approval URLs
    const { approveUrl, denyUrl } = generateApprovalLinks(requestId);
    
    // Store preview data if contentPreview is provided
    let previewUrl = '';
    if (contentPreview) {
      const { previewUrl: generatedPreviewUrl } = generatePreviewLinks(requestId);
      previewUrl = generatedPreviewUrl;
      
      // Store preview data with type detection
      let previewType = 'general';
      if (approvalType === 'content_confirmation' && action.toLowerCase().includes('email')) {
        previewType = 'email';
      } else if (action.toLowerCase().includes('document') || action.toLowerCase().includes('doc')) {
        previewType = 'document';
      } else if (action.toLowerCase().includes('share')) {
        previewType = 'sharing';
      }
      
      storePreviewData(requestId, {
        action,
        details,
        contentPreview,
        previewType,
        approvalType,
        severity
      });
    }
    
    // Create output with links
    let approvalOutput = `🚨 HUMAN APPROVAL REQUIRED\n\nAction: ${action}\nDetails: ${details}\n\n`;
    
    if (contentPreview && previewUrl) {
      approvalOutput += `👁️ PREVIEW: ${previewUrl}\n\n`;
    }
    
    approvalOutput += `APPROVAL LINKS:\n✅ APPROVE: ${approveUrl}\n❌ CANCEL: ${denyUrl}\n\nClick the URLs above to respond. Timeout: 5 minutes.`;

    // Log the approval request so it's visible in console immediately
    console.log('🚨 APPROVAL REQUIRED - Links generated:');
    if (previewUrl) {
      console.log(`👁️ PREVIEW: ${previewUrl}`);
    }
    console.log(`✅ APPROVE: ${approveUrl}`);
    console.log(`❌ CANCEL: ${denyUrl}`);
    console.log('Waiting for user response...');

    let approved = false;
    let reason = "";
    let approver = "system";
    let continuedFromAuth = false;
    let contentConfirmed = false;

    // Now wait for human approval via URL click
    try {
      const result = await waitForHumanApproval(requestId, timeout * 1000);
      approved = result.approved;
      reason = result.reason || (approved ? "User approved" : "User denied");
      approver = result.approver || "Human User";
      continuedFromAuth = approvalType === "authentication" && approved;
      contentConfirmed = approvalType === "content_confirmation" && approved;
      
      console.log(`✅ APPROVAL RECEIVED: ${approved ? 'APPROVED' : 'DENIED'} - ${reason}`);
    } catch (error) {
      approved = false;
      reason = error instanceof Error ? error.message : "Approval timeout";
      approver = "System";
      
      console.log(`❌ APPROVAL FAILED: ${reason}`);
    }

    // Return final result - this will allow the agent to continue in the same stream
    return {
      approved,
      reason,
      timestamp: new Date().toISOString(),
      approver,
      continuedFromAuth,
      contentConfirmed,
      output: approved 
        ? `✅ APPROVED: ${reason}. Proceeding with action...` 
        : `❌ ${reason}. Action cancelled.`
    };
  },
});

function getApprovalMessage(approvalType: string, action: string): string {
  switch (approvalType) {
    case "authentication":
      return `🔐 Authentication required for: ${action}`;
    case "content_confirmation":
      return `📄 Please review and confirm content for: ${action}`;
    case "execution_approval":
      return `⚡ Final approval required to execute: ${action}`;
    default:
      return `🚨 Human approval required for: ${action}`;
  }
}

function getDefaultButtonText(approvalType: string): string {
  switch (approvalType) {
    case "authentication":
      return "Continue";
    case "content_confirmation":
      return "Confirm";
    case "execution_approval":
      return "Execute";
    default:
      return "Approve";
  }
}

function getInstructionsForType(approvalType: string): string {
  switch (approvalType) {
    case "authentication":
      return "Click 'Continue' after completing the authentication process to proceed with your request.";
    case "content_confirmation":
      return "Please review the generated content carefully and click 'Confirm' if it meets your requirements.";
    case "execution_approval":
      return "This is the final step. Click 'Execute' to perform the action or 'Cancel' to abort.";
    default:
      return "Please review the action and approve/deny using the buttons below.";
  }
}



function getFinalMessage(approvalType: string, approved: boolean, reason: string): string {
  if (!approved) {
    return `❌ **Action Cancelled**\n\nReason: ${reason}\n\nThe requested operation has been stopped.`;
  }

  const baseMessage = `✅ **Action Approved**\n\nReason: ${reason}\n\n`;
  
  switch (approvalType) {
    case "authentication":
      return baseMessage + "🔐 Authentication successful - continuing with your request...";
    case "content_confirmation":
      return baseMessage + "📄 Content confirmed - proceeding to next step...";
    case "execution_approval":
      return baseMessage + "⚡ Execution approved - performing action now...";
    default:
      return baseMessage + "✅ Request approved - proceeding...";
  }
} 