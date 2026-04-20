/**
 * Onboarding Orchestrator for Holy Quest AI
 * Coordinates the first-run Ollama onboarding experience
 */

import { OllamaDetector, OllamaStatus } from './ollamaDetector';
import { OllamaModelManager } from '../llm/providers/ollamaModelManager';

/**
 * Steps in the onboarding process
 */
export enum OnboardingStep {
  DETECT_OLLAMA = 'detect_ollama',
  INSTALL_PROMPT = 'install_prompt',
  START_PROMPT = 'start_prompt',
  PULL_MODEL = 'pull_model',
  COMPLETE = 'complete',
  SKIPPED = 'skipped'
}

/**
 * Current state of the onboarding process
 */
export interface OnboardingState {
  currentStep: OnboardingStep;
  ollamaStatus?: OllamaStatus;
  installedModels: string[];
  recommendedModel: string;
  userPreferredModel?: string;
  error?: string;
}

/**
 * Orchestrates the Ollama onboarding flow
 */
export class OnboardingOrchestrator {
  private state: OnboardingState;
  private detector: OllamaDetector;
  private modelManager: OllamaModelManager;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.detector = new OllamaDetector(baseUrl);
    this.modelManager = new OllamaModelManager(baseUrl);
    
    this.state = {
      currentStep: OnboardingStep.DETECT_OLLAMA,
      installedModels: [],
      recommendedModel: 'llama3.1',
    };
  }

  /**
   * Start the onboarding process
   */
  async start(): Promise<OnboardingState> {
    this.state.currentStep = OnboardingStep.DETECT_OLLAMA;
    return this.checkOllamaStatus();
  }

  /**
   * Check Ollama status and determine next step
   */
  async checkOllamaStatus(): Promise<OnboardingState> {
    try {
      const statusResult = await this.detector.detectStatus();
      this.state.ollamaStatus = statusResult.status;

      if (statusResult.status === OllamaStatus.RUNNING) {
        // Ollama is running, check for models
        const models = await this.modelManager.listModels();
        this.state.installedModels = models.map(m => m.name);

        if (models.length > 0) {
          // Models exist, onboarding complete
          this.state.currentStep = OnboardingStep.COMPLETE;
        } else {
          // No models, need to pull one
          this.state.currentStep = OnboardingStep.PULL_MODEL;
        }
      } else {
        // Ollama not detected or not running
        this.state.currentStep = OnboardingStep.INSTALL_PROMPT;
      }

      return this.state;
    } catch (error: any) {
      this.state.error = `Failed to check Ollama status: ${error.message}`;
      this.state.currentStep = OnboardingStep.INSTALL_PROMPT;
      return this.state;
    }
  }

  /**
   * Pull the recommended model with progress tracking
   */
  async pullRecommendedModel(
    onProgress: (percent: number, status: string) => void
  ): Promise<OnboardingState> {
    try {
      this.state.currentStep = OnboardingStep.PULL_MODEL;
      const modelName = this.state.userPreferredModel || this.state.recommendedModel;

      await this.modelManager.pullModel(modelName, (progress) => {
        onProgress(progress.percent, progress.status);
      });

      // Update installed models list
      const models = await this.modelManager.listModels();
      this.state.installedModels = models.map(m => m.name);
      this.state.currentStep = OnboardingStep.COMPLETE;

      return this.state;
    } catch (error: any) {
      this.state.error = `Failed to pull model: ${error.message}`;
      return this.state;
    }
  }

  /**
   * Skip onboarding (user will provide their own API keys)
   */
  async skipOnboarding(): Promise<OnboardingState> {
    this.state.currentStep = OnboardingStep.SKIPPED;
    return this.state;
  }

  /**
   * Get current state
   */
  getState(): OnboardingState {
    return { ...this.state };
  }

  /**
   * Determine the next logical step
   */
  getNextStep(): OnboardingStep {
    switch (this.state.currentStep) {
      case OnboardingStep.DETECT_OLLAMA:
        return OnboardingStep.INSTALL_PROMPT;
      
      case OnboardingStep.INSTALL_PROMPT:
        return OnboardingStep.START_PROMPT;
      
      case OnboardingStep.START_PROMPT:
        return OnboardingStep.DETECT_OLLAMA;
      
      case OnboardingStep.PULL_MODEL:
        return OnboardingStep.COMPLETE;
      
      case OnboardingStep.COMPLETE:
      case OnboardingStep.SKIPPED:
        return this.state.currentStep;
      
      default:
        return OnboardingStep.DETECT_OLLAMA;
    }
  }

  /**
   * Set user's preferred model
   */
  setPreferredModel(modelName: string): void {
    this.state.userPreferredModel = modelName;
  }

  /**
   * Get list of recommended models
   */
  getRecommendedModels(): string[] {
    return this.modelManager.getRecommendedModels();
  }
}
