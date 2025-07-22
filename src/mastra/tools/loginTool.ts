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
          res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Gmail Agent - No Authorization Code</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #ffa502 0%, #ff6348 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                    }
                    
                    .container {
                        background: rgba(255, 255, 255, 0.1);
                        backdrop-filter: blur(10px);
                        border-radius: 20px;
                        padding: 3rem;
                        text-align: center;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                        border: 1px solid rgba(255, 255, 255, 0.18);
                        max-width: 500px;
                        width: 90%;
                    }
                    
                    .warning-icon {
                        font-size: 4rem;
                        margin-bottom: 1rem;
                    }
                    
                    h1 {
                        font-size: 2rem;
                        margin-bottom: 1rem;
                        font-weight: 600;
                    }
                    
                    p {
                        font-size: 1.1rem;
                        opacity: 0.9;
                        margin-bottom: 2rem;
                        line-height: 1.6;
                    }
                    
                    .close-btn {
                        background: rgba(255, 255, 255, 0.2);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        color: white;
                        padding: 12px 24px;
                        border-radius: 25px;
                        font-size: 1rem;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        font-weight: 500;
                    }
                    
                    .close-btn:hover {
                        background: rgba(255, 255, 255, 0.3);
                        transform: translateY(-2px);
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="warning-icon">⚠️</div>
                    <h1>Authorization Incomplete</h1>
                    <p>No authorization code was received from Google. Please close this tab and try the login process again.</p>
                    <button class="close-btn" onclick="window.close()">Close Tab</button>
                </div>
            </body>
            </html>
          `);
          return reject(new Error("No code returned from Google"));
        }

        try {
          const tokens = await getTokens(code);
          
          // Store tokens for future use
          tokenStorage.setTokens(tokens);
          
          res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Gmail Agent - Login Successful</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                    }
                    
                    .container {
                        background: rgba(255, 255, 255, 0.1);
                        backdrop-filter: blur(10px);
                        border-radius: 20px;
                        padding: 3rem;
                        text-align: center;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                        border: 1px solid rgba(255, 255, 255, 0.18);
                        max-width: 500px;
                        width: 90%;
                    }
                    
                    .success-icon {
                        font-size: 4rem;
                        margin-bottom: 1rem;
                        animation: bounce 0.6s ease-in-out;
                    }
                    
                    @keyframes bounce {
                        0%, 20%, 50%, 80%, 100% {
                            transform: translateY(0);
                        }
                        40% {
                            transform: translateY(-10px);
                        }
                        60% {
                            transform: translateY(-5px);
                        }
                    }
                    
                    h1 {
                        font-size: 2rem;
                        margin-bottom: 1rem;
                        font-weight: 600;
                    }
                    
                    p {
                        font-size: 1.1rem;
                        opacity: 0.9;
                        margin-bottom: 2rem;
                        line-height: 1.6;
                    }
                    
                    .close-btn {
                        background: rgba(255, 255, 255, 0.2);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        color: white;
                        padding: 12px 24px;
                        border-radius: 25px;
                        font-size: 1rem;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        font-weight: 500;
                    }
                    
                    .close-btn:hover {
                        background: rgba(255, 255, 255, 0.3);
                        transform: translateY(-2px);
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                    }
                    
                    .gmail-logo {
                        width: 60px;
                        height: 60px;
                        margin-bottom: 1rem;
                        opacity: 0.8;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="success-icon">✅</div>
                    <h1>Login Successful!</h1>
                    <p>You've successfully connected your Gmail account to the Gmail Agent. You can now safely close this tab and return to your chat.</p>
                    <button class="close-btn" onclick="window.close()">Close Tab</button>
                </div>
                
                <script>
                    // Auto-close after 5 seconds
                    setTimeout(() => {
                        window.close();
                    }, 5000);
                    
                    // Add some nice effects
                    document.addEventListener('DOMContentLoaded', () => {
                        const container = document.querySelector('.container');
                        container.style.opacity = '0';
                        container.style.transform = 'translateY(20px)';
                        
                        setTimeout(() => {
                            container.style.transition = 'all 0.6s ease';
                            container.style.opacity = '1';
                            container.style.transform = 'translateY(0)';
                        }, 100);
                    });
                </script>
            </body>
            </html>
          `);
          server.close();
          resolve({
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token!,
            expiryDate: tokens.expiry_date!
          });
        } catch (err) {
          res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Gmail Agent - Authentication Failed</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                    }
                    
                    .container {
                        background: rgba(255, 255, 255, 0.1);
                        backdrop-filter: blur(10px);
                        border-radius: 20px;
                        padding: 3rem;
                        text-align: center;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                        border: 1px solid rgba(255, 255, 255, 0.18);
                        max-width: 500px;
                        width: 90%;
                    }
                    
                    .error-icon {
                        font-size: 4rem;
                        margin-bottom: 1rem;
                    }
                    
                    h1 {
                        font-size: 2rem;
                        margin-bottom: 1rem;
                        font-weight: 600;
                    }
                    
                    p {
                        font-size: 1.1rem;
                        opacity: 0.9;
                        margin-bottom: 2rem;
                        line-height: 1.6;
                    }
                    
                    .close-btn {
                        background: rgba(255, 255, 255, 0.2);
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        color: white;
                        padding: 12px 24px;
                        border-radius: 25px;
                        font-size: 1rem;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        font-weight: 500;
                    }
                    
                    .close-btn:hover {
                        background: rgba(255, 255, 255, 0.3);
                        transform: translateY(-2px);
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="error-icon">❌</div>
                    <h1>Authentication Failed</h1>
                    <p>There was an issue connecting your Gmail account. Please close this tab and try again.</p>
                    <button class="close-btn" onclick="window.close()">Close Tab</button>
                </div>
            </body>
            </html>
          `);
          reject(err);
        }
      });
    });
  }
});
