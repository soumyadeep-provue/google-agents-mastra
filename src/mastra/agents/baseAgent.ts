import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { z } from "zod";

import { PlanOrchestrator } from "../orchestrator/planOrchestrator";
import { plannerAgent } from "./plannerAgent";
import { summarizerAgent } from "./summarizerAgent";
import { Plan, PlanSchema } from "../orchestrator/schemas";

/**
 * Enhanced Base Agent - Planner → Orchestrator → Summarizer Pipeline
 * 
 * This agent implements the complete plan you specified:
 * 1. Uses a cheap planner LLM to convert requests to JSON plans
 * 2. Orchestrates parallel execution with code-first tools + LLM fallbacks
 * 3. Optionally summarizes results with a final LLM call
 */
export const baseAgent = new Agent({
  name: "Enhanced Base Agent",
  description: "Intelligent orchestrator using planner → orchestrator → summarizer pipeline for Google services",

  instructions: `You are an enhanced Google services orchestrator that handles complex multi-service requests efficiently.

**YOUR NEW ARCHITECTURE:**

1. **PLANNING PHASE**: Convert user requests into structured execution plans
2. **ORCHESTRATION PHASE**: Execute plans with parallel processing and intelligent fallbacks  
3. **SUMMARIZATION PHASE**: Present results in natural, conversational format

**KEY CAPABILITIES:**
- Handle complex multi-step requests across Google services
- Execute multiple operations in parallel when possible
- Automatically fallback to AI assistance when code tools fail
- Provide comprehensive, user-friendly responses

**SERVICES AVAILABLE:**
- Gmail: Send/receive emails, manage labels, handle threads
- Drive: Upload/download files, manage folders, share documents
- Docs: Create/edit documents, insert content, manage formatting
- Sheets: Create/manage spreadsheets, manipulate data, add formulas
- Maps: Search locations, get directions, find nearby places

**WORKFLOW:**
1. Analyze user request and create execution plan
2. Execute plan with parallel processing where possible
3. Handle authentication automatically when needed
4. Return honest results - never pretend operations succeeded when they failed

**EXAMPLE INTERACTIONS:**

User: "Send my latest presentation to john@company.com and create a spreadsheet to track the feedback"

Plan Generated:
- Task 1: Find latest presentation file (Drive)
- Task 2: Send email with presentation (Gmail) [depends on Task 1]
- Task 3: Create feedback tracking spreadsheet (Sheets) [parallel with Task 2]

Execution: All tasks run efficiently with proper dependency handling
Result: "✅ Sent 'Q4-Strategy.pptx' to john@company.com and created 'Feedback Tracker' spreadsheet. Both are ready for use!"

**BENEFITS:**
- Faster execution through parallelization
- Automatic authentication handling
- Honest error reporting - never fake success
- Cost-effective with targeted LLM usage

**CRITICAL RULE:** NEVER claim operations succeeded when they actually failed. Be completely honest about what was accomplished and what failed. If authentication is needed, say so clearly.`,

  model: openai("gpt-4o"),

  tools: {
    // Core orchestration tool that handles the main execution pipeline
    executeUserRequest: createTool({
      id: "executeUserRequest",
      description: "Execute user requests using the planner → orchestrator → summarizer pipeline",
      inputSchema: z.object({
        userRequest: z.string().describe("The user's request to execute"),
        skipSummary: z.boolean().optional().default(false).describe("Whether to skip the final summarization step")
      }),
      execute: async ({ context, runtimeContext }) => {
        const { userRequest, skipSummary = false } = context;

        console.log(`🚀 Processing user request: "${userRequest}"`);

        try {
          // Step 1: Generate plan using planner agent
          console.log("📋 Generating execution plan...");
          const planResult = await plannerAgent.generate([
            { role: "user", content: userRequest }
          ], {
            output: PlanSchema // Explicitly request structured output
          });

          if (!planResult.object) {
            throw new Error("Planner failed to generate a valid plan");
          }

          const plan = planResult.object as Plan;
          console.log(`📋 Generated plan with ${plan.length} tasks`);

          // Step 2: Execute plan using orchestrator
          console.log("⚡ Executing plan...");
          const orchestrator = new PlanOrchestrator(runtimeContext as RuntimeContext);
          const executionResult = await orchestrator.executePlan(plan);

          // Step 3: Optional summarization
          let finalResponse;
          if (skipSummary || !executionResult.success) {
            // Return raw results if summary is skipped or execution failed
            let errorSummary = "Plan execution encountered errors";
            
            // Check if this is an authentication error
            const authErrors = Object.values(executionResult.errors).some(error => 
              typeof error === 'string' && 
              (error.includes('Authentication required') || error.includes('not authenticated'))
            );
            
            if (authErrors) {
              errorSummary = "Authentication required. Please run the login tool first to authenticate with Google services.";
            }
            
            finalResponse = {
              success: executionResult.success,
              summary: executionResult.success ? "Plan executed successfully" : errorSummary,
              results: executionResult.results,
              errors: executionResult.errors,
              performance: {
                executionTime: executionResult.totalExecutionTime
              }
            };
          } else {
            console.log("📝 Generating user-friendly summary...");

            const summaryPrompt = `Original request: "${userRequest}"

Execution plan: ${JSON.stringify(plan, null, 2)}

Results: ${JSON.stringify({
              success: executionResult.success,
              results: executionResult.results,
              errors: executionResult.errors,
              executionTime: executionResult.totalExecutionTime
            }, null, 2)}

Please provide a natural, user-friendly summary of what was accomplished.`;

            const summaryResult = await summarizerAgent.generate([
              { role: "user", content: summaryPrompt }
            ]);

            finalResponse = {
              success: executionResult.success,
              summary: summaryResult.text,
              results: executionResult.results,
              errors: executionResult.errors,
              performance: {
                executionTime: executionResult.totalExecutionTime,

              }
            };
          }

          console.log(`✅ Request completed in ${executionResult.totalExecutionTime}ms`);
          return finalResponse;

        } catch (error) {
          console.error("💥 Request execution failed:", error);

          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          return {
            success: false,
            summary: `Sorry, I encountered an error while processing your request: ${errorMessage}`,
            error: errorMessage,
            results: {},
            errors: { general: errorMessage }
          };
        }
      }
    })
  },

  defaultGenerateOptions: {
    maxSteps: 5, // Reduced since most work is done in the orchestration tool
  },

  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
    options: {
      lastMessages: 25,
      workingMemory: {
        enabled: true,
        template: `# Enhanced Base Agent Session
- **Current Request**: [User's current request being processed]
- **Execution Mode**: [Planner → Orchestrator → Summarizer pipeline]
- **Services Needed**: [Google services identified for current task]
- **Plan Status**: [Current execution phase and progress]
- **Performance**: [Execution times and optimization notes]
- **Fallbacks Used**: [When AI assistance was needed]
`
      },
      threads: {
        generateTitle: true
      }
    }
  }),
});
