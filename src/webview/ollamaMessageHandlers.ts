/**
 * ollamaMessageHandlers.ts
 * Extracted Ollama message handlers for panel.ts
 * Establishes architectural pattern for future provider handlers
 */

import { OllamaDetector } from '../onboarding/ollamaDetector';
import { OllamaModelManager } from '../llm/providers/ollamaModelManager';

export class OllamaMessageHandlers {
    private detector: OllamaDetector;
    private modelManager: OllamaModelManager;

    constructor(
        private postMessage: (msg: object) => void,
        private baseUrl: string = 'http://localhost:11434'
    ) {
        this.detector = new OllamaDetector();
        this.modelManager = new OllamaModelManager(this.baseUrl);
    }

    /**
     * Check Ollama installation and server status
     */
    async handleStatusCheck(): Promise<void> {
        try {
            const result = await this.detector.detectStatus();
            this.postMessage({
                type: 'ollamaStatus',
                ...result
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.postMessage({
                type: 'ollamaStatus',
                installed: false,
                running: false,
                error: message
            });
        }
    }

    /**
     * List available Ollama models
     */
    async handleListModels(): Promise<void> {
        try {
            const models = await this.modelManager.listModels();
            this.postMessage({
                type: 'ollamaModels',
                models
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.postMessage({
                type: 'ollamaError',
                error: `Failed to list models: ${message}`
            });
        }
    }

    /**
     * Pull (download) an Ollama model with progress updates
     */
    async handlePullModel(modelName: string): Promise<void> {
        try {
            await this.modelManager.pullModel(
                modelName,
                (progress) => {
                    // Send progress updates to webview
                    const completed = progress.completed ?? 0;
                    const total = progress.total ?? 0;
                    this.postMessage({
                        type: 'ollamaPullProgress',
                        modelName,
                        status: progress.status,
                        completed,
                        total,
                        percent: total > 0 
                            ? Math.round((completed / total) * 100) 
                            : 0
                    });
                }
            );

            // Pull completed successfully
            this.postMessage({
                type: 'ollamaPullComplete',
                modelName
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.postMessage({
                type: 'ollamaError',
                error: `Failed to pull model ${modelName}: ${message}`
            });
        }
    }
}
