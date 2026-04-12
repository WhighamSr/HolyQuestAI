export interface Agent {
  name: string;
  model: string;
  role: string;
  systemPrompt: string;
  temperature: number;
}

export interface AgentResponse {
  agent: string;
  success: boolean;
  output: any;
  forNextAgent?: string;
  needsRetry?: boolean;
  error?: string;
}

export interface SharedMemory {
  currentTask: string;
  projectStatus: string;
  lastUpdate: string;
  completedTasks: any[];
  activeIssues: any[];
  attemptedFixes: any[];
  prohibitedPatterns: string[];
  projectKnowledge: any;
}

export type AgentName = 
  | 'ProjectAnalyst'
  | 'MobileExpert'
  | 'QualityEngineer';
