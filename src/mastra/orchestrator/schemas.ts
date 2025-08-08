import { z } from "zod";

// Task schema for individual tasks in the plan
export const TaskSchema = z.object({
  id: z.string().describe("Unique identifier for the task"),
  service: z.string().describe("Service name (e.g., 'gmail', 'drive', 'docs', 'sheets', 'maps')"),
  action: z.string().describe("Action to perform (e.g., 'sendEmail', 'uploadFile', 'createDocument')"),
  inputs: z.record(z.any()).describe("Input parameters for the action"),
  dependsOn: z.array(z.string()).optional().default([]).describe("Array of task IDs this task depends on"),
  meta: z.object({
    requiresLLM: z.boolean().optional().default(false).describe("Hint that this task may need LLM fallback"),
    priority: z.number().optional().default(0).describe("Execution priority (higher numbers first)")
  }).optional().describe("Optional metadata for the task")
});

// Plan schema - array of tasks
export const PlanSchema = z.array(TaskSchema).describe("Array of tasks to execute in planned order");

// Export types for TypeScript
export type Task = z.infer<typeof TaskSchema>;
export type Plan = z.infer<typeof PlanSchema>;

// Execution result types
export const TaskResultSchema = z.object({
  success: z.boolean(),
  result: z.any().optional(),
  error: z.string().optional(),
  executionTime: z.number().optional(),
  authenticationAttempted: z.boolean().optional(),
  requiresAuthentication: z.boolean().optional(),
  tokens: z.object({
    input: z.number().optional(),
    output: z.number().optional()
  }).optional()
});

export type TaskResult = z.infer<typeof TaskResultSchema>;

export const ExecutionContextSchema = z.object({
  taskResults: z.record(z.any()).describe("Results from completed tasks, keyed by task ID"),
  currentTask: TaskSchema.describe("Currently executing task"),
  runtimeContext: z.any().optional().describe("Runtime context for dynamic configuration")
});

export type ExecutionContext = z.infer<typeof ExecutionContextSchema>;
