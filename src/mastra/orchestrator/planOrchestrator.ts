import { RuntimeContext } from "@mastra/core/runtime-context";
import { Task, Plan, TaskResult, ExecutionContext } from "./schemas";
import { TOOL_REGISTRY, getAgentCapability } from "../tools/orchestrator/toolRegistry";


/**
 * PlanOrchestrator - Executes plans with parallel processing and dependency resolution
 */
export class PlanOrchestrator {
  private activeRuns = new Map<string, Promise<TaskResult>>();
  private completedTasks = new Map<string, any>();
  private runtimeContext: RuntimeContext;
  private static globalAuthLock: Promise<void> | null = null;

  constructor(runtimeContext?: RuntimeContext) {
    this.runtimeContext = runtimeContext || new RuntimeContext();
  }

  /**
   * Execute a complete plan
   */
  async executePlan(plan: Plan): Promise<{ 
    success: boolean; 
    results: Record<string, any>; 
    errors: Record<string, string>;
    totalExecutionTime: number;

  }> {
    const startTime = Date.now();
    const results: Record<string, any> = {};
    const errors: Record<string, string> = {};

    const remaining = new Set(plan.map(t => t.id));

    // Validate plan first
    const validationErrors = this.validatePlan(plan);
    if (validationErrors.length > 0) {
      throw new Error(`Plan validation failed: ${validationErrors.join(', ')}`);
    }

    console.log(`🚀 Starting plan execution with ${plan.length} tasks`);

    while (remaining.size > 0) {
      // Find tasks that are ready to execute (dependencies satisfied)
      const readyTasks = plan.filter(task => 
        remaining.has(task.id) && 
        task.dependsOn?.every(depId => results[depId] !== undefined)
      );

      if (readyTasks.length === 0) {
        const remainingIds = Array.from(remaining);
        throw new Error(`Dependency deadlock detected. Remaining tasks: ${remainingIds.join(', ')}`);
      }

      console.log(`⚡ Executing ${readyTasks.length} tasks in parallel: ${readyTasks.map(t => t.id).join(', ')}`);

      // Execute ready tasks in parallel
      const taskPromises = readyTasks.map(async (task) => {
        try {
          const taskResult = await this.executeTask(task, results);
          
          if (taskResult.success) {
            results[task.id] = taskResult.result;
            console.log(`✅ Task ${task.id} completed successfully`);
          } else {
            errors[task.id] = taskResult.error || 'Unknown error';
            console.log(`❌ Task ${task.id} failed: ${taskResult.error}`);
          }
          
          remaining.delete(task.id);
          return { taskId: task.id, result: taskResult };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors[task.id] = errorMessage;
          remaining.delete(task.id);
          console.log(`💥 Task ${task.id} threw exception: ${errorMessage}`);
          return { taskId: task.id, result: { success: false, error: errorMessage } };
        }
      });

      // Wait for all parallel tasks to complete
      await Promise.all(taskPromises);
    }

    const totalExecutionTime = Date.now() - startTime;
    const success = Object.keys(errors).length === 0;

    console.log(`🏁 Plan execution ${success ? 'completed successfully' : 'completed with errors'} in ${totalExecutionTime}ms`);


    return {
      success,
      results,
      errors,
      totalExecutionTime,

    };
  }

  /**
   * Execute a single task with authentication-aware fallback logic
   */
  private async executeTask(task: Task, context: Record<string, any>): Promise<TaskResult> {
    const startTime = Date.now();
    
    // Substitute variables in task inputs
    const resolvedInputs = this.substituteVariables(task.inputs, context);
    
    console.log(`🔧 Executing task ${task.id} (${task.service}.${task.action})`);

    try {
      // First try: Execute with code-first tool
      console.log(`🛠️ Attempting tool execution for ${task.id}...`);
      const toolResult = await this.executeWithCodeFirstTool(task, resolvedInputs);
      
      console.log(`✅ Tool execution successful for ${task.id}`);
      const executionTime = Date.now() - startTime;
      return {
        success: true,
        result: toolResult,

        executionTime
      };
    } catch (codeFirstError) {
      const errorMessage = codeFirstError instanceof Error ? codeFirstError.message : 'Unknown error';
      console.log(`⚠️ Code-first tool failed for ${task.id}: ${errorMessage}`);
      
      // Check if this is an authentication error
      if (this.isAuthenticationError(errorMessage)) {
        console.log(`🔐 Authentication required for ${task.service} service - attempting auto-login...`);
        
        try {
          // Use centralized authentication to prevent multiple login windows
          console.log(`🔑 Starting centralized authentication for ${task.id}...`);
          await this.handleAuthentication(task.service);

          console.log(`✅ Auto-login successful! Retrying task ${task.id}...`);
          
          // Retry the original task after successful authentication
          console.log(`🔄 Retrying tool execution for ${task.id}...`);
          const retryResult = await this.executeWithCodeFirstTool(task, resolvedInputs);
          console.log(`✅ Retry successful for ${task.id}`);
          const executionTime = Date.now() - startTime;
          
          return {
            success: true,
            result: retryResult,
    
            executionTime,
            authenticationAttempted: true
          };
          
        } catch (authError) {
          console.log(`❌ Auto-login failed: ${authError instanceof Error ? authError.message : 'Unknown'}`);
          
          const executionTime = Date.now() - startTime;
          return {
            success: false,
            error: `Authentication failed for ${task.service} service. Auto-login attempt failed: ${authError instanceof Error ? authError.message : 'Unknown error'}. Please try logging in manually.`,
    
            executionTime,
            requiresAuthentication: true
          };
        }
      }
      
      // For other errors, just return the error directly - no fallback complexity
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        error: `Code-first tool failed: ${errorMessage}`,

        executionTime
      };
    }
  }

  /**
   * Execute task using code-first tool
   */
  private async executeWithCodeFirstTool(task: Task, inputs: any): Promise<any> {
    const capability = getAgentCapability(`google-${task.service}`);
    if (!capability) {
      throw new Error(`No capability found for service: ${task.service}`);
    }

    const tool = capability.tools[`${task.action}Tool`] || capability.tools[task.action];
    if (!tool || !tool.execute) {
      throw new Error(`No tool found for action: ${task.service}.${task.action}`);
    }

    // Execute the tool
    const result = await tool.execute({ 
      context: inputs,
      runtimeContext: this.runtimeContext
    });

    // Validate tool output
    if (result === null || result === undefined) {
      throw new Error(`Tool ${task.service}.${task.action} returned null/undefined result`);
    }

    return result;
  }



  /**
   * Check if an error message indicates authentication is required
   */
  private isAuthenticationError(errorMessage: string): boolean {
    const authErrorPatterns = [
      /not authenticated/i,
      /authentication required/i,
      /please run loginTool/i,
      /login required/i,
      /unauthorized/i,
      /invalid credentials/i,
      /token expired/i,
      /access denied/i
    ];
    
    return authErrorPatterns.some(pattern => pattern.test(errorMessage));
  }

  /**
   * Handle authentication for all Google services (centralized to prevent conflicts)
   */
  private async handleAuthentication(service: string): Promise<void> {
    // Use a global static lock to prevent multiple instances from authenticating simultaneously
    if (PlanOrchestrator.globalAuthLock) {
      console.log(`🔐 Authentication already in progress globally, waiting for completion...`);
      await PlanOrchestrator.globalAuthLock;
      return;
    }

    // Create and set the global lock
    PlanOrchestrator.globalAuthLock = this.performAuthentication(service);

    try {
      await PlanOrchestrator.globalAuthLock;
    } finally {
      // Clear the global lock
      PlanOrchestrator.globalAuthLock = null;
    }
  }

  /**
   * Perform the actual authentication
   */
  private async performAuthentication(service: string): Promise<void> {
    // Import the login tool dynamically
    const { loginTool } = await import('../tools/auth/loginTool');
    
    console.log(`🔐 Performing centralized authentication for ALL Google services (triggered by ${service})...`);
    console.log(`🚀 This will authenticate Gmail, Docs, Drive, Sheets, and Maps all at once`);
    
    // Execute the login tool once for all Google services
    const result = await loginTool.execute({
      context: {},
      runtimeContext: this.runtimeContext
    });

    if (!result || !result.accessToken) {
      throw new Error(`Authentication failed for Google services`);
    }

    console.log(`✅ Successfully authenticated ALL Google services - no more login windows needed!`);
  }



  /**
   * Substitute variables like {{taskId.field}} with actual values
   */
  private substituteVariables(inputs: any, context: Record<string, any>): any {
    if (typeof inputs === 'string') {
      return inputs.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const parts = path.split('.');
        const taskId = parts[0];
        const taskResult = context[taskId];
        
        if (!taskResult) {
          console.warn(`⚠️ Variable substitution failed: ${match} - task ${taskId} not found`);
          return match;
        }
        
        // Navigate through the path (e.g., emails.0.subject)
        let value = taskResult;
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          // Handle array indices (like "0", "1", etc.)
          if (/^\d+$/.test(part)) {
            const index = parseInt(part);
            if (Array.isArray(value) && index < value.length) {
              value = value[index];
            } else {
              console.warn(`⚠️ Variable substitution failed: ${match} - array index ${index} not found`);
              return match;
            }
          } else {
            // Handle object properties
            if (value && typeof value === 'object' && part in value) {
              value = value[part];
            } else {
              console.warn(`⚠️ Variable substitution failed: ${match} - field ${part} not found`);
              return match;
            }
          }
        }
        
        return value !== undefined ? String(value) : match;
      });
    }
    
    if (Array.isArray(inputs)) {
      return inputs.map(item => this.substituteVariables(item, context));
    }
    
    if (inputs && typeof inputs === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(inputs)) {
        result[key] = this.substituteVariables(value, context);
      }
      return result;
    }
    
    return inputs;
  }

  /**
   * Validate plan structure and dependencies
   */
  private validatePlan(plan: Plan): string[] {
    const errors: string[] = [];
    const taskIds = new Set(plan.map(t => t.id));

    // Check for duplicate task IDs
    const duplicates = plan
      .map(t => t.id)
      .filter((id, index, arr) => arr.indexOf(id) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate task IDs: ${duplicates.join(', ')}`);
    }

    // Check dependencies
    for (const task of plan) {
      if (task.dependsOn) {
        for (const depId of task.dependsOn) {
          if (!taskIds.has(depId)) {
            errors.push(`Task ${task.id} depends on non-existent task: ${depId}`);
          }
        }
      }

      // Check if service.action combination exists
      const capability = getAgentCapability(`google-${task.service}`);
      if (!capability) {
        errors.push(`Unknown service: ${task.service} in task ${task.id}`);
        continue;
      }

      const tool = capability.tools[`${task.action}Tool`] || capability.tools[task.action];
      if (!tool) {
        errors.push(`Unknown action: ${task.action} for service ${task.service} in task ${task.id}`);
      }
    }

    return errors;
  }

  /**
   * Check for circular dependencies
   */
  private hasCircularDependencies(plan: Plan): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (taskId: string): boolean => {
      if (recursionStack.has(taskId)) return true;
      if (visited.has(taskId)) return false;

      visited.add(taskId);
      recursionStack.add(taskId);

      const task = plan.find(t => t.id === taskId);
      if (task?.dependsOn) {
        for (const depId of task.dependsOn) {
          if (hasCycle(depId)) return true;
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    return plan.some(task => hasCycle(task.id));
  }
}
