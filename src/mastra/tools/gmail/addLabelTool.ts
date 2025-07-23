import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const addLabelTool = createTool({
  id: "addLabel",
  description: "Add label(s) to Gmail emails for organization. Can add multiple labels to multiple messages.",
  inputSchema: z.object({
    messageId: z.string().optional().describe("Specific message ID to add label to"),
    threadId: z.string().optional().describe("Thread ID to add label to all messages in thread"),
    emailSubject: z.string().optional().describe("Email subject to find and add label to"),
    labelNames: z.string().describe("Label name(s) to add, comma-separated if multiple (e.g., 'Important' or 'Work,Urgent')"),
    searchQuery: z.string().optional().describe("Gmail search query to find multiple emails to label (e.g., 'from:boss@company.com')")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    labeledCount: z.number(),
    appliedLabels: z.array(z.string()),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.gmail) {
      throw new Error("Gmail not authenticated. Please run loginTool first.");
    }

    const messageId = input.context?.messageId;
    const threadId = input.context?.threadId;
    const emailSubject = input.context?.emailSubject;
    const labelNames = input.context?.labelNames;
    const searchQuery = input.context?.searchQuery;

    if (!labelNames) {
      throw new Error("Label names are required");
    }

    if (!messageId && !threadId && !emailSubject && !searchQuery) {
      throw new Error("Must provide messageId, threadId, emailSubject, or searchQuery to identify emails to label");
    }

    try {
      // Parse label names
      const requestedLabels = labelNames.split(',').map((label: string) => label.trim());
      
      // Get all available labels to find label IDs
      const labelsResponse = await clients.gmail.users.labels.list({
        userId: 'me'
      });

      const availableLabels = labelsResponse.data.labels || [];
      const labelMap = new Map();
      availableLabels.forEach(label => {
        if (label.name && label.id) {
          labelMap.set(label.name.toLowerCase(), label.id);
        }
      });

      // Find matching label IDs
      const labelIdsToAdd: string[] = [];
      const foundLabels: string[] = [];
      const missingLabels: string[] = [];

      for (const requestedLabel of requestedLabels) {
        const labelId = labelMap.get(requestedLabel.toLowerCase());
        if (labelId) {
          labelIdsToAdd.push(labelId);
          foundLabels.push(requestedLabel);
        } else {
          missingLabels.push(requestedLabel);
        }
      }

      if (labelIdsToAdd.length === 0) {
        return {
          success: false,
          labeledCount: 0,
          appliedLabels: [],
          message: `❌ None of the requested labels exist: ${missingLabels.join(', ')}. Use listLabelsTool to see available labels.`
        };
      }

      // Find target messages
      let targetMessageIds: string[] = [];

      if (messageId) {
        targetMessageIds = [messageId];
      } else if (threadId) {
        // Get all messages in the thread
        const threadResponse = await clients.gmail.users.threads.get({
          userId: 'me',
          id: threadId,
          format: 'minimal'
        });
        
        targetMessageIds = threadResponse.data.messages?.map(msg => msg.id!) || [];
      } else if (emailSubject) {
        // Search for emails with this subject
        const searchResponse = await clients.gmail.users.messages.list({
          userId: 'me',
          q: `subject:"${emailSubject}"`,
          maxResults: 10
        });

        targetMessageIds = searchResponse.data.messages?.map(msg => msg.id!) || [];
      } else if (searchQuery) {
        // Use custom search query
        const searchResponse = await clients.gmail.users.messages.list({
          userId: 'me',
          q: searchQuery,
          maxResults: 50
        });

        targetMessageIds = searchResponse.data.messages?.map(msg => msg.id!) || [];
      }

      if (targetMessageIds.length === 0) {
        return {
          success: false,
          labeledCount: 0,
          appliedLabels: foundLabels,
          message: `❌ No emails found to apply labels to`
        };
      }

      // Apply labels to each message
      let successCount = 0;
      
      for (const msgId of targetMessageIds) {
        try {
          await clients.gmail.users.messages.modify({
            userId: 'me',
            id: msgId,
            requestBody: {
              addLabelIds: labelIdsToAdd
            }
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to add labels to message ${msgId}:`, error);
        }
      }

      let resultMessage = `✅ Successfully added labels [${foundLabels.join(', ')}] to ${successCount} email${successCount > 1 ? 's' : ''}`;
      
      if (missingLabels.length > 0) {
        resultMessage += `. Note: These labels don't exist: ${missingLabels.join(', ')}`;
      }

      return {
        success: successCount > 0,
        labeledCount: successCount,
        appliedLabels: foundLabels,
        message: resultMessage
      };

    } catch (error) {
      console.error("Add label error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      return {
        success: false,
        labeledCount: 0,
        appliedLabels: [],
        message: `❌ Failed to add labels: ${errorMessage}`
      };
    }
  }
}); 