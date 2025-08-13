
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { baseAgent } from './agents/baseAgent';

export const mastra = new Mastra({
  agents: { 
    baseAgent,
  },
  storage: new LibSQLStore({
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'debug',
  }),
  server: {
    host: "localhost",
    port: 4111,
    apiRoutes: [
      {
        path: "/api/chat/approve",
        method: "POST", 
        createHandler: async ({ mastra }) => {
          return async (c) => {
            const { requestId, approval, approvalType, timestamp } = await c.req.json();
            
            // Import the approval handler
            const { handleApprovalResponse } = await import('./tools/auth/humanApprovalTool');
            
            // Handle real human approval
            handleApprovalResponse(requestId, approval, approval ? "User approved" : "User denied");
            
            return c.json({ 
              success: true, 
              requestId, 
              approval,
              approvalType,
              timestamp: timestamp || new Date().toISOString()
            });
          };
        },
      },
      {
        path: "/api/approve/:requestId",
        method: "GET", 
        createHandler: async ({ mastra }) => {
          return async (c) => {
            const requestId = c.req.param('requestId');
            const action = c.req.query('action'); // 'approve' or 'deny'
            
            if (!requestId || !action || !['approve', 'deny'].includes(action)) {
              return c.html(`
                <html>
                  <head><title>Invalid Request</title></head>
                  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; text-align: center;">
                    <div style="max-width: 500px; margin: 0 auto;">
                      <h2 style="color: #f44336;">❌ Invalid Approval Request</h2>
                      <p>The approval link is invalid or has expired.</p>
                      <button onclick="window.close()" style="background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer; font-size: 16px;">Close</button>
                    </div>
                  </body>
                </html>
              `);
            }
            
            const approved = action === 'approve';
            
            try {
              // Import the approval handler
              const { handleApprovalResponse } = await import('./tools/auth/humanApprovalTool');
              
              // Handle the approval
              handleApprovalResponse(requestId, approved, approved ? "User clicked approve" : "User clicked deny");
              
              // Return a nice confirmation page
              const emoji = approved ? '✅' : '❌';
              const title = approved ? 'Action Approved' : 'Action Cancelled';
              const message = approved 
                ? 'Your approval has been recorded. The agent will now proceed with the requested action.'
                : 'The action has been cancelled. The agent will not proceed with the requested operation.';
              const bgColor = approved ? '#d4edda' : '#f8d7da';
              const textColor = approved ? '#155724' : '#721c24';
              
              return c.html(`
                <html>
                  <head>
                    <title>${title}</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  </head>
                  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; background-color: #f5f5f5; margin: 0;">
                    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden;">
                      <div style="background: ${bgColor}; color: ${textColor}; padding: 30px; text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 15px;">${emoji}</div>
                        <h1 style="margin: 0; font-size: 24px;">${title}</h1>
                      </div>
                      <div style="padding: 30px; text-align: center;">
                        <p style="font-size: 16px; line-height: 1.5; color: #333; margin-bottom: 30px;">${message}</p>
                        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                          <button onclick="window.close()" style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer; font-size: 16px;">Close Window</button>
                          <button onclick="window.history.back()" style="background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer; font-size: 16px;">Back to Chat</button>
                        </div>
                        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff;">
                          <p style="margin: 0; font-size: 14px; color: #6c757d;">
                            <strong>Request ID:</strong> ${requestId}<br>
                            <strong>Action:</strong> ${action}<br>
                            <strong>Timestamp:</strong> ${new Date().toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <script>
                      // Auto-close after 5 seconds if no interaction
                      setTimeout(() => {
                        if (confirm('This window will close automatically. Close now?')) {
                          window.close();
                        }
                      }, 5000);
                    </script>
                  </body>
                </html>
              `);
              
            } catch (error) {
              console.error('Error handling approval:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
              return c.html(`
                <html>
                  <head><title>Error</title></head>
                  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; text-align: center;">
                    <div style="max-width: 500px; margin: 0 auto;">
                      <h2 style="color: #f44336;">❌ Error Processing Approval</h2>
                      <p>There was an error processing your approval. Please try again or contact support.</p>
                      <p style="font-family: monospace; background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px;">${errorMessage}</p>
                      <button onclick="window.close()" style="background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer; font-size: 16px;">Close</button>
                    </div>
                  </body>
                </html>
              `);
            }
          };
        },
      },
      {
        path: "/api/preview/:requestId",
        method: "GET",
        createHandler: async ({ mastra }) => {
          return async (c) => {
            const requestId = c.req.param('requestId');
            
            if (!requestId) {
              return c.html(`
                <html>
                  <head><title>Invalid Preview</title></head>
                  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; text-align: center;">
                    <div style="max-width: 500px; margin: 0 auto;">
                      <h2 style="color: #f44336;">❌ Invalid Preview Request</h2>
                      <p>The preview link is invalid or has expired.</p>
                      <button onclick="window.close()" style="background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer; font-size: 16px;">Close</button>
                    </div>
                  </body>
                </html>
              `);
            }

            try {
              // Import the preview handler
              const { getPreviewData } = await import('./tools/auth/humanApprovalTool');
              
              // Get preview data
              const previewData = getPreviewData(requestId);
              
              if (!previewData) {
                return c.html(`
                  <html>
                    <head><title>Preview Not Found</title></head>
                    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; text-align: center;">
                      <div style="max-width: 500px; margin: 0 auto;">
                        <h2 style="color: #f44336;">❌ Preview Not Found</h2>
                        <p>The preview data is not available or has expired.</p>
                        <button onclick="window.close()" style="background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer; font-size: 16px;">Close</button>
                      </div>
                    </body>
                  </html>
                `);
              }

              // Generate preview HTML based on type
              let previewHtml = '';
              const { action, details, contentPreview, previewType } = previewData;

              if (previewType === 'email') {
                previewHtml = `
                  <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 15px 0; color: #495057;">📧 Email Preview</h3>
                    <div style="background: white; border-radius: 4px; padding: 15px; font-family: monospace; white-space: pre-wrap; border: 1px solid #e9ecef;">${contentPreview}</div>
                  </div>
                `;
              } else if (previewType === 'document') {
                previewHtml = `
                  <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 15px 0; color: #495057;">📄 Document Preview</h3>
                    <div style="background: white; border-radius: 4px; padding: 15px; white-space: pre-wrap; border: 1px solid #e9ecef;">${contentPreview}</div>
                  </div>
                `;
              } else if (previewType === 'sharing') {
                previewHtml = `
                  <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 15px 0; color: #495057;">🔗 File Sharing Preview</h3>
                    <div style="background: white; border-radius: 4px; padding: 15px; border: 1px solid #e9ecef;">
                      <p><strong>File:</strong> ${contentPreview.fileName || 'Unknown'}</p>
                      <p><strong>Share with:</strong> ${contentPreview.shareWith || 'Anyone with link'}</p>
                      <p><strong>Permission:</strong> ${contentPreview.permission || 'View only'}</p>
                      <p><strong>Share type:</strong> ${contentPreview.shareType || 'Link sharing'}</p>
                    </div>
                  </div>
                `;
              } else {
                previewHtml = `
                  <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 15px 0; color: #495057;">👁️ Content Preview</h3>
                    <div style="background: white; border-radius: 4px; padding: 15px; white-space: pre-wrap; border: 1px solid #e9ecef;">${contentPreview}</div>
                  </div>
                `;
              }

              return c.html(`
                <html>
                  <head>
                    <title>Content Preview - ${action}</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  </head>
                  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; background-color: #f5f5f5; margin: 0;">
                    <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden;">
                      <div style="background: #007bff; color: white; padding: 30px; text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 15px;">👁️</div>
                        <h1 style="margin: 0; font-size: 24px;">Content Preview</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">${action}</p>
                      </div>
                      <div style="padding: 30px;">
                        ${previewHtml}
                        
                        <div style="background: #e3f2fd; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                          <h4 style="margin: 0 0 10px 0; color: #1976d2;">ℹ️ Action Details</h4>
                          <p style="margin: 0; color: #424242;">${details}</p>
                        </div>

                        <div style="text-align: center; border-top: 1px solid #e9ecef; padding-top: 20px;">
                          <button onclick="window.close()" style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer; font-size: 16px; margin-right: 10px;">Close Preview</button>
                          <button onclick="window.history.back()" style="background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer; font-size: 16px;">Back to Approval</button>
                        </div>

                        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff;">
                          <p style="margin: 0; font-size: 14px; color: #6c757d;">
                            <strong>Request ID:</strong> ${requestId}<br>
                            <strong>Timestamp:</strong> ${new Date().toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <script>
                      // Refresh every 30 seconds to keep preview alive
                      setTimeout(() => {
                        window.location.reload();
                      }, 30000);
                    </script>
                  </body>
                </html>
              `);
              
            } catch (error) {
              console.error('Error generating preview:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
              return c.html(`
                <html>
                  <head><title>Preview Error</title></head>
                  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; text-align: center;">
                    <div style="max-width: 500px; margin: 0 auto;">
                      <h2 style="color: #f44336;">❌ Error Loading Preview</h2>
                      <p>There was an error loading the preview. Please try again or contact support.</p>
                      <p style="font-family: monospace; background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px;">${errorMessage}</p>
                      <button onclick="window.close()" style="background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer; font-size: 16px;">Close</button>
                    </div>
                  </body>
                </html>
              `);
            }
          };
        },
      },
    ],
  },
});
