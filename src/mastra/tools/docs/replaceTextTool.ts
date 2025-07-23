import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { setupGoogleClients } from "../auth/auth";

export const replaceTextTool = createTool({
  id: "replaceText",
  description: "Replace all occurrences of text in a Google Docs document",
  inputSchema: z.object({
    documentId: z.string().describe("The ID of the document to modify"),
    findText: z.string().describe("The text to find and replace"),
    replaceText: z.string().describe("The text to replace it with"),
    matchCase: z.boolean().optional().describe("Whether to match case (default: false)")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    documentId: z.string(),
    replacements: z.number().optional(),
    message: z.string()
  }),
  execute: async (input: any) => {
    const clients = await setupGoogleClients();
    if (!clients?.docs) {
      throw new Error("Google Docs not authenticated. Please run loginTool first.");
    }

    const documentId = input.context?.documentId;
    const findText = input.context?.findText;
    const replaceText = input.context?.replaceText;
    const matchCase = input.context?.matchCase || false;
    
    if (!documentId || !findText || replaceText === undefined) {
      throw new Error("Document ID, findText, and replaceText are required");
    }

    try {
      // Replace all text
      const requests = [
        {
          replaceAllText: {
            containsText: {
              text: findText,
              matchCase: matchCase
            },
            replaceText: replaceText
          }
        }
      ];

      const response = await clients.docs.documents.batchUpdate({
        documentId: documentId,
        requestBody: {
          requests: requests
        }
      });

      // Get the number of replacements made
      const replacements = response.data.replies?.[0]?.replaceAllText?.occurrencesChanged || 0;

      return {
        success: true,
        documentId: documentId,
        replacements: replacements,
        message: `✅ Replaced ${replacements} occurrence(s) of '${findText}' with '${replaceText}'`
      };

    } catch (error) {
      console.error("Text replacement error:", error);
      return {
        success: false,
        documentId: documentId,
        message: `❌ Failed to replace text in document. Please try again.`
      };
    }
  }
}); 