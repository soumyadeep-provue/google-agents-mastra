import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getAuthUrl, getTokens, oauth2Client, tokenStorage } from "./auth";
import express from "express";
import open from "open";

export const loginTool = createTool({
  id: "loginTool",
  description: "Automatically logs in to Gmail using OAuth2, no manual code entry needed.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiryDate: z.number()
  }),
  execute: async (input: any) => {
    return await new Promise<{ accessToken: string; refreshToken: string; expiryDate: number }>((resolve, reject) => {
      const app = express();
      const server = app.listen(3000, () => {
        const url = getAuthUrl();
        console.log("🔐 Opening browser for Gmail login...");
        open(url);
      });

      app.get("/callback", async (req, res) => {
        const code = req.query.code as string;
        if (!code) {
          res.send("No code provided.");
          return reject(new Error("No code returned from Google"));
        }

        try {
          const tokens = await getTokens(code);
          
          // Store tokens for future use
          tokenStorage.setTokens(tokens);
          
          res.send("✅ Logged in successfully! You can close this tab.");
          server.close();
          resolve({
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token!,
            expiryDate: tokens.expiry_date!
          });
        } catch (err) {
          res.send("❌ Failed to authenticate.");
          reject(err);
        }
      });
    });
  }
});
