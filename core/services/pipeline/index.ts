/**
 * COGNITIVE PLATFORM - PIPELINE SERVICE
 * ======================================
 * 
 * [38;5;240mUnified Pipeline Service for OSINT Processing[0m
 * 
 * Features:
 * - Pipeline CRUD operations
 * - Pipeline execution engine
 * - Step management
 * - Trigger system (manual, schedule, event, API)
 * - Queue management
 * - Retry logic
 * - Integration with other services
 */

import { config } from '../../config';
import {
  Pipeline,
  PipelineExecution,
  PipelineExecutionRequest,
  PipelineSchedule,
  PipelineStep,
  PipelineStepType,
  PipelineTriggerType,
  ID,
  ISODateString,
  Graph,
  StixObject,
  StixRelationship,
} from '../../types';
import { CognitiveError } from '../../errors';
import { logger } from '../../logger';
import { CacheService } from '../cache';
import { EventBus } from '../eventBus';
import { GraphService } from '../graph';

// ============================================================================
// PIPELINE EXECUTION ENGINE
// ============================================================================

/** Pipeline Execution Context */
interface PipelineExecutionContext {
  executionId: ID;
  pipelineId: ID;
  pipeline: Pipeline;
  input: Record<string, unknown>;
  currentStepIndex: number;
  currentStep: PipelineStep;
  results: Record<string, unknown>;
  errors: Error[];
  startedAt: ISODateString;
}

/** Pipeline Step Handler */
type PipelineStepHandler = (
  context: PipelineExecutionContext,
  step: PipelineStep,
  input: Record<string, unknown>
) => Promise<Record<string, unknown>>;

/** Built-in step handlers */
const builtInHandlers: Record<PipelineStepType, PipelineStepHandler> = {
  enrichment: async (context, step, input) => {
    // Enrichment step - add metadata, resolve entities, etc.
    logger.info(`Executing enrichment step: ${step.name}`);
    
    // Simulate enrichment
    return {
      ...input,
      enriched: true,
      enrichedAt: new Date().toISOString(),
      enricher: step.module,
    };
  },
  
  filter: async (context, step, input) => {
    // Filter step - filter data based on criteria
    logger.info(`Executing filter step: ${step.name}`);
    
    const { filterField, filterValue } = step.config as Record<string, unknown>;
    
    if (filterField && filterValue) {
      // Simple filter logic
      if (input[filterField as string] === filterValue) {
        return input;
      }
      return null as unknown as Record<string, unknown>;
    }
    
    return input;
  },
  
  transform: async (context, step, input) => {
    // Transform step - transform data
    logger.info(`Executing transform step: ${step.name}`);
    
    const { transformType, field, value } = step.config as Record<string, unknown>;
    
    switch (transformType) {
      case 'addField':
        return { ...input, [field as string]: value };
      case 'removeField':
        const result = { ...input };
        delete result[field as string];
        return result;
      case 'renameField':
        const { oldField, newField } = step.config as Record<string, string>;
        const transformed = { ...input };
        if (transformed[oldField]) {
          transformed[newField] = transformed[oldField];
          delete transformed[oldField];
        }
        return transformed;
      default:
        return input;
    }
  },
  
  analysis: async (context, step, input) => {
    // Analysis step - perform graph analysis
    logger.info(`Executing analysis step: ${step.name}`);
    
    const graphService = new GraphService();
    
    if (input.graphId) {
      const graph = await graphService.getGraph(input.graphId as string);
      if (graph) {
        // Perform analysis based on step config
        const { analysisType } = step.config as Record<string, unknown>;
        
        switch (analysisType) {
          case 'centrality':
            const centrality = await graphService.calculateCentrality(
              input.graphId as string,
              ['degree', 'betweenness']
            );
            return { ...input, centrality };
          
          case 'community':
            const communities = await graphService.detectCommunities(
              input.graphId as string,
              'louvain'
            );
            return { ...input, communities };
          
          case 'stats':
            const stats = await graphService.getStats(input.graphId as string);
            return { ...input, stats };
          
          default:
            return input;
        }
      }
    }
    
    return input;
  },
  
  export: async (context, step, input) => {
    // Export step - export data
    logger.info(`Executing export step: ${step.name}`);
    
    const { format, destination } = step.config as Record<string, unknown>;
    
    // Simulate export
    return {
      ...input,
      exported: true,
      exportFormat: format,
      exportDestination: destination,
      exportedAt: new Date().toISOString(),
    };
  },
  
  import: async (context, step, input) => {
    // Import step - import data
    logger.info(`Executing import step: ${step.name}`);
    
    const { source, format } = step.config as Record<string, unknown>;
    
    // Simulate import
    return {
      ...input,
      imported: true,
      importSource: source,
      importFormat: format,
      importedAt: new Date().toISOString(),
    };
  },
  
  notification: async (context, step, input) => {
    // Notification step - send notifications
    logger.info(`Executing notification step: ${step.name}`);
    
    const { message, type } = step.config as Record<string, unknown>;
    
    // Emit notification event
    await EventBus.getInstance().emit('pipeline:notification', {
      pipelineId: context.pipelineId,
      executionId: context.executionId,
      message,
      type,
    });
    
    return input;
  },
};

// ============================================================================
// PIPELINE SCHEDULER
// ============================================================================

/** Scheduled Pipeline */
interface ScheduledPipeline {
  pipelineId: ID;
  schedule: PipelineSchedule;
  nextRun: Date;
  interval: NodeJS.Timeout | null;
}

/** Pipeline Scheduler */
export class PipelineScheduler {
  private scheduledPipelines: Map<ID, ScheduledPipeline> = new Map();
  private running: boolean = false;
  
  constructor() {
    this.start();
  }
  
  /** Start the scheduler */
  public start(): void {
    if (this.running) return;
    this.running = true;
    logger.info('Pipeline scheduler started');
    
    // Load all scheduled pipelines
    this.loadScheduledPipelines();
  }
  
  /** Stop the scheduler */
  public stop(): void {
    this.running = false;
    
    // Clear all intervals
    for (const scheduled of this.scheduledPipelines.values()) {
      if (scheduled.interval) {
        clearInterval(scheduled.interval);
      }
    }
    
    this.scheduledPipelines.clear();
    logger.info('Pipeline scheduler stopped');
  }
  
  /** Load scheduled pipelines from database */
  private async loadScheduledPipelines(): Promise<void> {
    // In a real implementation, this would query the database
    // For now, we'll just log
    logger.info('Loading scheduled pipelines');
  }
  
  /** Schedule a pipeline */
  public async schedulePipeline(pipelineId: ID, schedule: PipelineSchedule): Promise<void> {
    // Remove existing schedule
    this.unschedulePipeline(pipelineId);
    
    const nextRun = this.calculateNextRun(schedule);
    
    const scheduled: ScheduledPipeline = {
      pipelineId,
      schedule,
      nextRun,
      interval: null,
    };
    
    this.scheduledPipelines.set(pipelineId, scheduled);
    
    // Set up interval
    if (schedule.type === 'interval') {
      const intervalMs = this.parseInterval(schedule.value);
      scheduled.interval = setInterval(() => {
        this.runScheduledPipeline(pipelineId);
      }, intervalMs);
    } else if (schedule.type === 'cron') {
      // For cron, we'd need a proper cron parser
      // For now, use a simple interval
      const intervalMs = this.parseCron(schedule.value);
      scheduled.interval = setInterval(() => {
        this.runScheduledPipeline(pipelineId);
      }, intervalMs);
    }
    
    logger.info(`Pipeline ${pipelineId} scheduled with ${schedule.type}: ${schedule.value}`);
  }
  
  /** Unschedule a pipeline */
  public unschedulePipeline(pipelineId: ID): void {
    const scheduled = this.scheduledPipelines.get(pipelineId);
    
    if (scheduled) {
      if (scheduled.interval) {
        clearInterval(scheduled.interval);
      }
      this.scheduledPipelines.delete(pipelineId);
      logger.info(`Pipeline ${pipelineId} unscheduled`);
    }
  }
  
  /** Run a scheduled pipeline */
  private async runScheduledPipeline(pipelineId: ID): Promise<void> {
    if (!this.running) return;
    
    const scheduled = this.scheduledPipelines.get(pipelineId);
    if (!scheduled) return;
    
    // Update next run time
    scheduled.nextRun = this.calculateNextRun(scheduled.schedule);
    
    logger.info(`Running scheduled pipeline: ${pipelineId}`);
    
    // Execute the pipeline
    const pipelineService = new PipelineService();
    await pipelineService.executePipeline(pipelineId, {}, 'schedule');
  }
  
  /** Calculate next run time */
  private calculateNextRun(schedule: PipelineSchedule): Date {
    const now = new Date();
    
    if (schedule.type === 'interval') {
      const intervalMs = this.parseInterval(schedule.value);
      return new Date(now.getTime() + intervalMs);
    } else {
      // Cron expression - simplified
      return new Date(now.getTime() + 60000); // 1 minute
    }
  }
  
  /** Parse interval string */
  private parseInterval(value: string): number {
    const match = value.match(/^(\d+)([smhd]?)$/i);
    
    if (!match) return 1000; // Default to 1 second
    
    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
      case 's': return num * 1000;
      case 'm': return num * 60 * 1000;
      case 'h': return num * 60 * 60 * 1000;
      case 'd': return num * 24 * 60 * 60 * 1000;
      default: return num;
    }
  }
  
  /** Parse cron expression (simplified) */
  private parseCron(value: string): number {
    // Simplified cron parser - return 1 minute
    return 60000;
  }
}

// ============================================================================
// PIPELINE SERVICE
// ============================================================================

/** Pipeline Service */
export class PipelineService {
  private cache: CacheService;
  private eventBus: EventBus;
  private scheduler: PipelineScheduler;
  private executionQueue: PipelineExecutionRequest[] = [];
  private activeExecutions: Map<ID, PipelineExecutionContext> = new Map();
  
  constructor() {
    this.cache = new CacheService();
    this.eventBus = EventBus.getInstance();
    this.scheduler = new PipelineScheduler();
  }
  
  // ==========================================================================
  // PIPELINE CRUD
  // ==========================================================================
  
  /** Create a new pipeline */
  public async createPipeline(pipeline: Omit<Pipeline, 'id' | 'createdAt' | 'updatedAt' | 'executions' | 'lastExecution' | 'avgDuration'>): Promise<Pipeline> {
    const id = this.generateId('pipeline');
    const now = new Date().toISOString();
    
    const newPipeline: Pipeline = {
      ...pipeline,
      id,
      status: 'inactive',
      executions: 0,
      avgDuration: 0,
      createdAt: now,
      updatedAt: now,
    };
    
    // In a real implementation, save to database
    // For now, we'll just emit an event
    await this.eventBus.emit('pipeline:created', { pipeline: newPipeline });
    
    // Schedule if triggers include schedule
    if (pipeline.triggers.includes('schedule') && pipeline.schedule) {
      await this.scheduler.schedulePipeline(id, pipeline.schedule);
    }
    
    return newPipeline;
  }
  
  /** Get a pipeline by ID */
  public async getPipeline(id: ID): Promise<Pipeline | null> {
    const cacheKey = `pipeline:${id}`;
    const cached = await this.cache.get<Pipeline>(cacheKey);
    if (cached) return cached;
    
    // In a real implementation, query database
    // For now, return null
    
    return null;
  }
  
  /** Get all pipelines */
  public async getPipelines(): Promise<Pipeline[]> {
    const cacheKey = 'pipelines:all';
    const cached = await this.cache.get<Pipeline[]>(cacheKey);
    if (cached) return cached;
    
    // In a real implementation, query database
    // For now, return empty array
    
    return [];
  }
  
  /** Update a pipeline */
  public async updatePipeline(id: ID, updates: Partial<Pipeline>): Promise<Pipeline | null> {
    const existing = await this.getPipeline(id);
    if (!existing) return null;
    
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    
    // Invalidate cache
    await this.cache.delete(`pipeline:${id}`);
    await this.cache.delete('pipelines:all');
    
    // Emit event
    await this.eventBus.emit('pipeline:updated', { pipeline: updated });
    
    // Update scheduler if schedule changed
    if (updates.schedule) {
      await this.scheduler.schedulePipeline(id, updates.schedule);
    }
    
    return updated;
  }
  
  /** Delete a pipeline */
  public async deletePipeline(id: ID): Promise<boolean> {
    // Invalidate cache
    await this.cache.delete(`pipeline:${id}`);
    await this.cache.delete('pipelines:all');
    
    // Unschedule
    this.scheduler.unschedulePipeline(id);
    
    // Emit event
    await this.eventBus.emit('pipeline:deleted', { pipelineId: id });
    
    return true;
  }
  
  // ==========================================================================
  // PIPELINE EXECUTION
  // ==========================================================================
  
  /** Execute a pipeline */
  public async executePipeline(
    pipelineId: ID,
    input: Record<string, unknown> = {},
    trigger: PipelineTriggerType = 'manual'
  ): Promise<PipelineExecution> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline) {
      throw new CognitiveError('PIPELINE_NOT_FOUND', `Pipeline ${pipelineId} not found`, 'pipeline');
    }
    
    if (pipeline.status !== 'active') {
      throw new CognitiveError('PIPELINE_INACTIVE', `Pipeline ${pipelineId} is inactive`, 'pipeline');
    }
    
    const executionId = this.generateId('execution');
    const startedAt = new Date().toISOString();
    
    const execution: PipelineExecution = {
      id: executionId,
      pipelineId,
      pipelineName: pipeline.name,
      status: 'pending',
      startedAt,
      duration: 0,
      input,
      progress: 0,
      currentStep: 0,
      currentStepName: '',
    };
    
    // Add to queue
    this.executionQueue.push({ pipelineId, input, trigger });
    
    // Emit event
    await this.eventBus.emit('pipeline:started', { execution, trigger });
    
    // Process queue
    this.processQueue();
    
    return execution;
  }
  
  /** Process execution queue */
  private async processQueue(): Promise<void> {
    if (this.executionQueue.length === 0) return;
    
    const maxWorkers = config.get().pipeline.workers;
    const activeCount = this.activeExecutions.size;
    
    if (activeCount >= maxWorkers) {
      logger.info(`Queue full, waiting for workers to finish (active: ${activeCount}, max: ${maxWorkers})`);
      return;
    }
    
    const request = this.executionQueue.shift();
    if (!request) return;
    
    // Process the request
    this.processExecution(request);
    
    // Continue processing
    setImmediate(() => this.processQueue());
  }
  
  /** Process a single execution */
  private async processExecution(request: PipelineExecutionRequest): Promise<void> {
    const { pipelineId, input, trigger } = request;
    const pipeline = await this.getPipeline(pipelineId);
    
    if (!pipeline) {
      logger.error(`Pipeline ${pipelineId} not found for execution`);
      return;
    }
    
    const executionId = this.generateId('execution');
    const startedAt = new Date().toISOString();
    
    const context: PipelineExecutionContext = {
      executionId,
      pipelineId,
      pipeline,
      input,
      currentStepIndex: 0,
      currentStep: pipeline.steps[0],
      results: {},
      errors: [],
      startedAt,
    };
    
    this.activeExecutions.set(executionId, context);
    
    try {
      // Update execution status
      const execution: PipelineExecution = {
        id: executionId,
        pipelineId,
        pipelineName: pipeline.name,
        status: 'running',
        startedAt,
        duration: 0,
        input,
        progress: 0,
        currentStep: 0,
        currentStepName: pipeline.steps[0]?.name || '',
      };
      
      await this.eventBus.emit('pipeline:execution_started', { execution });
      
      // Execute each step
      let currentInput = { ...input };
      
      for (let i = 0; i < pipeline.steps.length; i++) {
        const step = pipeline.steps[i];
        context.currentStepIndex = i;
        context.currentStep = step;
        
        // Update progress
        execution.progress = Math.round((i / pipeline.steps.length) * 100);
        execution.currentStep = i;
        execution.currentStepName = step.name;
        
        await this.eventBus.emit('pipeline:step_started', {
          executionId,
          step: step,
          progress: execution.progress,
        });
        
        // Execute step
        try {
          const handler = builtInHandlers[step.type] || this.getCustomHandler(step.module);
          
          if (!handler) {
            throw new CognitiveError(
              'STEP_HANDLER_NOT_FOUND',
              `No handler found for step type: ${step.type}`,
              'pipeline'
            );
          }
          
          const result = await handler(context, step, currentInput);
          
          if (result === null) {
            // Step returned null - skip remaining steps
            logger.info(`Step ${step.name} returned null, skipping remaining steps`);
            break;
          }
          
          context.results[step.id] = result;
          currentInput = result;
          
          await this.eventBus.emit('pipeline:step_completed', {
            executionId,
            step: step,
            result,
          });
        } catch (error) {
          logger.error(`Step ${step.name} failed`, { error: error instanceof Error ? error.message : error });
          context.errors.push(error instanceof Error ? error : new Error(String(error)));
          
          await this.eventBus.emit('pipeline:step_failed', {
            executionId,
            step: step,
            error: error instanceof Error ? error.message : String(error),
          });
          
          // Check retry logic
          const shouldRetry = this.shouldRetry(step, context.errors.length);
          
          if (shouldRetry) {
            // Retry the step
            i--; // Decrement to retry
            continue;
          }
          
          // Stop execution on failure
          break;
        }
      }
      
      // Complete execution
      const finishedAt = new Date().toISOString();
      const duration = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
      
      const finalExecution: PipelineExecution = {
        ...execution,
        status: context.errors.length > 0 ? 'failed' : 'completed',
        finishedAt,
        duration,
        output: context.results,
        error: context.errors.length > 0 ? context.errors.map(e => e.message).join(', ') : undefined,
      };
      
      await this.eventBus.emit('pipeline:execution_completed', { execution: finalExecution });
      
      // Update pipeline stats
      await this.updatePipelineStats(pipelineId, duration, finalExecution.status);
      
      logger.info(`Pipeline ${pipelineId} execution ${finalExecution.status}`, {
        executionId,
        duration,
        steps: pipeline.steps.length,
        errors: context.errors.length,
      });
    } catch (error) {
      logger.error(`Pipeline execution failed`, {
        error: error instanceof Error ? error.message : error,
        executionId,
      });
      
      await this.eventBus.emit('pipeline:execution_failed', {
        executionId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.activeExecutions.delete(executionId);
      this.processQueue(); // Process next in queue
    }
  }
  
  /** Check if step should be retried */
  private shouldRetry(step: PipelineStep, attempt: number): boolean {
    const maxAttempts = config.get().pipeline.retryAttempts;
    return attempt < maxAttempts && step.config.retry !== false;
  }
  
  /** Get custom step handler */
  private getCustomHandler(module: string): PipelineStepHandler | null {
    // In a real implementation, this would load from plugin system
    // For now, return null
    return null;
  }
  
  /** Update pipeline statistics */
  private async updatePipelineStats(
    pipelineId: ID,
    duration: number,
    status: 'completed' | 'failed'
  ): Promise<void> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline) return;
    
    const now = new Date().toISOString();
    const executions = pipeline.executions + 1;
    
    // Calculate average duration
    const totalDuration = pipeline.avgDuration * pipeline.executions + duration;
    const avgDuration = totalDuration / executions;
    
    await this.updatePipeline(pipelineId, {
      executions,
      lastExecution: now,
      avgDuration,
    });
  }
  
  // ==========================================================================
  // PIPELINE EXECUTION MANAGEMENT
  // ==========================================================================
  
  /** Get execution by ID */
  public async getExecution(executionId: ID): Promise<PipelineExecution | null> {
    const cacheKey = `execution:${executionId}`;
    const cached = await this.cache.get<PipelineExecution>(cacheKey);
    if (cached) return cached;
    
    // In a real implementation, query database
    return null;
  }
  
  /** Get executions for a pipeline */
  public async getExecutions(pipelineId: ID): Promise<PipelineExecution[]> {
    const cacheKey = `executions:${pipelineId}`;
    const cached = await this.cache.get<PipelineExecution[]>(cacheKey);
    if (cached) return cached;
    
    // In a real implementation, query database
    return [];
  }
  
  /** Cancel an execution */
  public async cancelExecution(executionId: ID): Promise<boolean> {
    const context = this.activeExecutions.get(executionId);
    
    if (!context) {
      return false;
    }
    
    // Update status
    context.currentStepIndex = -1;
    
    const execution: PipelineExecution = {
      id: executionId,
      pipelineId: context.pipelineId,
      pipelineName: context.pipeline.name,
      status: 'cancelled',
      startedAt: context.startedAt,
      finishedAt: new Date().toISOString(),
      duration: new Date().getTime() - new Date(context.startedAt).getTime(),
      input: context.input,
      progress: 0,
      currentStep: 0,
      currentStepName: '',
    };
    
    await this.eventBus.emit('pipeline:execution_cancelled', { execution });
    
    this.activeExecutions.delete(executionId);
    
    return true;
  }
  
  // ==========================================================================
  // PIPELINE STEP MANAGEMENT
  // ==========================================================================
  
  /** Add a step to a pipeline */
  public async addStep(pipelineId: ID, step: Omit<PipelineStep, 'id' | 'order'>): Promise<Pipeline | null> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline) return null;
    
    const newStep: PipelineStep = {
      ...step,
      id: this.generateId('step'),
      order: pipeline.steps.length,
    };
    
    pipeline.steps.push(newStep);
    
    await this.updatePipeline(pipelineId, {
      steps: pipeline.steps,
      updatedAt: new Date().toISOString(),
    });
    
    await this.eventBus.emit('pipeline:step_added', { pipelineId, step: newStep });
    
    return pipeline;
  }
  
  /** Update a step */
  public async updateStep(
    pipelineId: ID,
    stepId: ID,
    updates: Partial<PipelineStep>
  ): Promise<Pipeline | null> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline) return null;
    
    const stepIndex = pipeline.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return null;
    
    pipeline.steps[stepIndex] = { ...pipeline.steps[stepIndex], ...updates };
    
    await this.updatePipeline(pipelineId, {
      steps: pipeline.steps,
      updatedAt: new Date().toISOString(),
    });
    
    await this.eventBus.emit('pipeline:step_updated', { pipelineId, stepId, updates });
    
    return pipeline;
  }
  
  /** Remove a step */
  public async removeStep(pipelineId: ID, stepId: ID): Promise<Pipeline | null> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline) return null;
    
    const stepIndex = pipeline.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return null;
    
    pipeline.steps.splice(stepIndex, 1);
    
    // Reorder remaining steps
    pipeline.steps = pipeline.steps.map((s, i) => ({ ...s, order: i }));
    
    await this.updatePipeline(pipelineId, {
      steps: pipeline.steps,
      updatedAt: new Date().toISOString(),
    });
    
    await this.eventBus.emit('pipeline:step_removed', { pipelineId, stepId });
    
    return pipeline;
  }
  
  /** Reorder steps */
  public async reorderSteps(
    pipelineId: ID,
    stepIds: ID[]
  ): Promise<Pipeline | null> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline) return null;
    
    // Create a map of stepId to step
    const stepMap = new Map(pipeline.steps.map(s => [s.id, s]));
    
    // Reorder based on stepIds
    const newSteps = stepIds
      .filter(id => stepMap.has(id))
      .map((id, index) => ({ ...stepMap.get(id)!, order: index }));
    
    // Add any steps not in the list
    for (const step of pipeline.steps) {
      if (!stepIds.includes(step.id)) {
        newSteps.push(step);
      }
    }
    
    await this.updatePipeline(pipelineId, {
      steps: newSteps,
      updatedAt: new Date().toISOString(),
    });
    
    await this.eventBus.emit('pipeline:steps_reordered', { pipelineId, stepIds });
    
    return pipeline;
  }
  
  // ==========================================================================
  // PIPELINE TRIGGERS
  // ==========================================================================
  
  /** Trigger a pipeline from an event */
  public async triggerFromEvent(
    eventType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    // Find pipelines with this trigger
    const pipelines = await this.getPipelines();
    
    for (const pipeline of pipelines) {
      if (pipeline.triggers.includes('event') && pipeline.triggers.includes(eventType as PipelineTriggerType)) {
        logger.info(`Triggering pipeline ${pipeline.id} from event ${eventType}`);
        await this.executePipeline(pipeline.id, data, 'event');
      }
    }
  }
  
  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================
  
  /** Generate unique ID */
  private generateId(prefix: string): ID {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /** Get pipeline status */
  public async getStatus(pipelineId: ID): Promise<{
    status: 'active' | 'inactive' | 'paused' | 'error';
    executions: number;
    lastExecution?: ISODateString;
    avgDuration: number;
    isScheduled: boolean;
  }> {
    const pipeline = await this.getPipeline(pipelineId);
    if (!pipeline) {
      throw new CognitiveError('PIPELINE_NOT_FOUND', `Pipeline ${pipelineId} not found`, 'pipeline');
    }
    
    return {
      status: pipeline.status,
      executions: pipeline.executions,
      lastExecution: pipeline.lastExecution,
      avgDuration: pipeline.avgDuration,
      isScheduled: pipeline.triggers.includes('schedule'),
    };
  }
  
  /** Get service status */
  public async getServiceStatus(): Promise<{
    running: boolean;
    queueSize: number;
    activeExecutions: number;
    scheduledPipelines: number;
  }> {
    return {
      running: true,
      queueSize: this.executionQueue.length,
      activeExecutions: this.activeExecutions.size,
      scheduledPipelines: this.scheduler['scheduledPipelines'].size,
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let pipelineServiceInstance: PipelineService | null = null;

/** Get singleton instance */
export function getPipelineService(): PipelineService {
  if (!pipelineServiceInstance) {
    pipelineServiceInstance = new PipelineService();
  }
  return pipelineServiceInstance;
}

// Export singleton
export const pipelineService = getPipelineService();
