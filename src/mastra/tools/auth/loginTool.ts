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
    // Check if we already have valid tokens
    const existingTokens = tokenStorage.getTokens();
    if (existingTokens && existingTokens.access_token && existingTokens.refresh_token) {
      console.log("✅ Already authenticated, using existing tokens");
      return {
        accessToken: existingTokens.access_token,
        refreshToken: existingTokens.refresh_token,
        expiryDate: existingTokens.expiry_date
      };
    }

    console.log("🔐 No existing tokens found, starting OAuth flow...");
    return await new Promise<{ accessToken: string; refreshToken: string; expiryDate: number }>((resolve, reject) => {
      const app = express();
      const server = app.listen(3000, (error?: Error) => {
        if (error) {
          console.error("❌ Failed to start auth server (port 3000 may be in use):", error.message);
          reject(new Error("Authentication server failed to start. Please try again."));
          return;
        }
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
