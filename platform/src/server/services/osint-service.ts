/**
 * COGNITIVE PLATFORM - OSINT SERVICE IMPLEMENTATION
 * 
 * Bridges Node.js pipeline and Python enrichers via unified interface.
 */

import { spawn, ChildProcess } from 'child_process';
import { resolve } from 'path';
import {
  BaseService,
  UnifiedRequest,
  ServiceHealth,
  createTimestamp,
} from '@cognitive/core';

interface OSINTProfile {
  username?: string;
  email?: string;
  targets: string[];
  profiles: any[];
  emails: any[];
  phones: any[];
  hosts: any[];
  links: any[];
  text: any[];
}

/**
 * OSINT Service - orchestrates collection pipeline
 */
export class OSINTService extends BaseService {
  private pythonEnricherPath: string;

  constructor() {
    super('osint', '0.1.0');
    this.pythonEnricherPath = resolve(
      __dirname,
      '../../../flowsint-enrichers/run_enricher.py'
    );
  }

  /**
   * Health check
   */
  async health(): Promise<ServiceHealth> {
    try {
      // Try to spawn Python to check if it's available
      const child = spawn('python', ['--version']);
      const ready = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 2000);
        child.on('close', (code) => {
          clearTimeout(timeout);
          resolve(code === 0);
        });
        child.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
      });

      return {
        ready,
        status: ready ? 'up' : 'degraded',
        latency: 0,
        lastCheck: createTimestamp(),
        version: this.version,
      };
    } catch {
      return {
        ready: false,
        status: 'down',
        latency: 0,
        lastCheck: createTimestamp(),
      };
    }
  }

  /**
   * Handle profile action
   */
  async handleProfile(
    payload: { username?: string; email?: string; targets?: string[] },
    context: any
  ): Promise<OSINTProfile> {
    const targets = payload.targets || [];
    if (payload.username) targets.push(payload.username);
    if (payload.email) targets.push(payload.email);

    if (targets.length === 0) {
      throw new Error('No targets provided');
    }

    return this.runPythonEnricher({
      targets,
      username: payload.username,
      email: payload.email,
    });
  }

  /**
   * Handle search action
   */
  async handleSearch(
    payload: { query: string; type?: string },
    context: any
  ): Promise<any> {
    // Search will call pipeline with broad query
    return this.runPythonEnricher({
      targets: [payload.query],
    });
  }

  /**
   * Run Python enricher via subprocess
   */
  private runPythonEnricher(input: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const child = spawn('python', [this.pythonEnricherPath]);
      let output = '';
      let errorOutput = '';

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Python enricher timeout'));
      }, 120000); // 2 min timeout

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          reject(
            new Error(
              `Python enricher failed (code ${code}): ${errorOutput}`
            )
          );
          return;
        }

        try {
          const result = JSON.parse(output);
          resolve({
            targets: input.targets,
            profiles: result.nds?.filter((n: any) => n.nodeType === 'profile') || [],
            emails: result.nds?.filter((n: any) => n.nodeType === 'email') || [],
            phones: result.nds?.filter((n: any) => n.nodeType === 'phone') || [],
            hosts: result.nds?.filter((n: any) => n.nodeType === 'host') || [],
            links: result.rls?.filter((r: any) => r.type === 'link') || [],
            text: result.nds?.filter((n: any) => n.nodeType === 'text') || [],
          });
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${error}`));
        }
      });

      child.on('error', reject);

      // Send input
      child.stdin.write(JSON.stringify(input));
      child.stdin.end();
    });
  }
}

/**
 * Singleton instance
 */
let osintService: OSINTService | null = null;

export function getOSINTService(): OSINTService {
  if (!osintService) {
    osintService = new OSINTService();
  }
  return osintService;
}
