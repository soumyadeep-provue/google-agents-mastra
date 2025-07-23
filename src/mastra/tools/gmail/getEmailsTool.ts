import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGmailClient } from "../auth/auth";

export const getEmailsTool = createTool({
  id: "getEmails",
  description: "Get emails based on any request - latest emails, emails from specific people, about topics, by date, unread status, or any combination. Handles all email retrieval needs.",
  inputSchema: z.object({
    query: z.string().describe("Natural language query for emails - e.g., 'latest email', 'emails from john', 'unread emails', 'emails about meeting', 'my newest message'"),
    count: z.number().optional().describe("Number of emails to return (default: 1 for 'latest' requests, 5 for searches)")
  }),
  outputSchema: z.object({
    emails: z.array(z.object({
      subject: z.string(),
      from: z.string(),
      to: z.string(),
      date: z.string(),
      snippet: z.string(),
      fullBody: z.string(),
      isUnread: z.boolean()
    })),
    totalFound: z.number(),
    queryUsed: z.string(),
    description: z.string()
  }),
  execute: async (input: any) => {
    const gmail = await setupGmailClient();
    if (!gmail) {
      throw new Error("Gmail client not authenticated. Please run loginTool first.");
    }

    const userQuery = input.context?.query || "";
    let requestedCount = input.context?.count;
    
    // Convert natural language to Gmail search syntax
    let gmailQuery = "";
    let description = "";
    const lowerQuery = userQuery.toLowerCase();

    // Handle "latest" or "newest" requests
    if (lowerQuery.includes("latest") || lowerQuery.includes("newest") || lowerQuery.includes("most recent")) {
      if (lowerQuery.includes("unread")) {
        gmailQuery = "is:unread";
        description = "Latest unread email";
      } else {
        gmailQuery = "";
        description = "Latest email";
      }
      if (!requestedCount) requestedCount = 1;
    } 
    // Handle unread requests
    else if (lowerQuery.includes("unread")) {
      gmailQuery = "is:unread";
      description = "Unread emails";
      if (!requestedCount) requestedCount = 5;
    }
    // Handle sender requests
    else if (lowerQuery.includes("from ")) {
      const fromMatch = userQuery.match(/from\s+([^\s]+)/i);
      if (fromMatch) {
        gmailQuery += `from:${fromMatch[1]} `;
        description = `Emails from ${fromMatch[1]}`;
      }
      if (!requestedCount) requestedCount = 5;
    }
    // Handle recipient requests
    else if (lowerQuery.includes("to ")) {
      const toMatch = userQuery.match(/to\s+([^\s]+)/i);
      if (toMatch) {
        gmailQuery += `to:${toMatch[1]} `;
        description = `Emails to ${toMatch[1]}`;
      }
      if (!requestedCount) requestedCount = 5;
    }
    // Handle subject/topic requests
    else if (lowerQuery.includes("about") || lowerQuery.includes("subject")) {
      const topicMatch = userQuery.match(/(?:about|subject)\s+(.+?)(?:\s+(?:from|to|in|on|$))/i);
      if (topicMatch) {
        const topic = topicMatch[1].trim();
        gmailQuery += `subject:"${topic}" `;
        description = `Emails about ${topic}`;
      }
      if (!requestedCount) requestedCount = 5;
    }
    // Handle date requests
    else if (lowerQuery.includes("today")) {
      const today = new Date().toISOString().split('T')[0];
      gmailQuery += `after:${today} `;
      description = "Today's emails";
      if (!requestedCount) requestedCount = 5;
    }
    else if (lowerQuery.includes("yesterday")) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      gmailQuery += `after:${yesterdayStr} before:${new Date().toISOString().split('T')[0]} `;
      description = "Yesterday's emails";
      if (!requestedCount) requestedCount = 5;
    }
    else if (lowerQuery.includes("this week")) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];
      gmailQuery += `after:${weekAgoStr} `;
      description = "This week's emails";
      if (!requestedCount) requestedCount = 5;
    }
    // Default: use the query as general search
    else {
      gmailQuery = userQuery;
      description = `Emails matching "${userQuery}"`;
      if (!requestedCount) requestedCount = 5;
    }

    // Get list of threads
    const threadsRes = await gmail.users.threads.list({
      userId: "me",
      q: gmailQuery.trim(),
      maxResults: requestedCount
    });

    if (!threadsRes.data.threads || threadsRes.data.threads.length === 0) {
      return {
        emails: [],
        totalFound: 0,
        queryUsed: gmailQuery.trim(),
        description: `No emails found for: ${description}`
      };
    }

    // Get details for each thread
    const emails = [];
    for (const thread of threadsRes.data.threads.slice(0, requestedCount)) {
      try {
        const threadRes = await gmail.users.threads.get({
          userId: "me",
          id: thread.id!
        });

        // Get the latest message in each thread
        const messages = threadRes.data.messages || [];
        const latestMessage = messages[messages.length - 1];

        if (latestMessage) {
          // Extract headers
          const headers = Object.fromEntries(
            (latestMessage.payload?.headers || []).map((h: any) => [h.name, h.value])
          );

          // Check if message is unread
          const isUnread = latestMessage.labelIds?.includes("UNREAD") || false;

          // Extract body text
          let fullBody = "";
          if (latestMessage.payload?.body?.data) {
            try {
              fullBody = Buffer.from(latestMessage.payload.body.data, 'base64').toString();
            } catch (e) {
              fullBody = "Could not decode message body";
            }
          } else if (latestMessage.payload?.parts) {
            // Look for text/plain part first, then text/html
            for (const part of latestMessage.payload.parts) {
              if (part.mimeType === "text/plain" && part.body?.data) {
                try {
                  fullBody = Buffer.from(part.body.data, 'base64').toString();
                  break;
                } catch (e) {
                  continue;
                }
              }
            }
            // If no plain text found, try HTML
            if (!fullBody) {
              for (const part of latestMessage.payload.parts) {
                if (part.mimeType === "text/html" && part.body?.data) {
                  try {
                    fullBody = Buffer.from(part.body.data, 'base64').toString();
                    break;
                  } catch (e) {
                    continue;
                  }
                }
              }
            }
          }

          emails.push({
            subject: headers["Subject"] || "No Subject",
            from: headers["From"] || "Unknown Sender",
            to: headers["To"] || "Unknown Recipient",
            date: headers["Date"] || "Unknown Date",
            snippet: latestMessage.snippet || "",
            fullBody: fullBody || "No body content available",
            isUnread
          });
        }
      } catch (error) {
        console.error(`Error fetching thread ${thread.id}:`, error);
        // Continue with other threads
      }
    }

    return {
      emails,
      totalFound: threadsRes.data.resultSizeEstimate || emails.length,
      queryUsed: gmailQuery.trim(),
      description: `Found ${emails.length} email(s): ${description}`
    };
  }
}); 