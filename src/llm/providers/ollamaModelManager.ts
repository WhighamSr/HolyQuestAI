/**
 * Ollama Model Manager for Holy Quest AI
 * Handles model listing, pulling, and deletion
 */

/**
 * Represents an Ollama model
 */
export interface OllamaModel {
  name: string;
  size: number; // bytes
  modified: Date;
  digest: string;
  details?: {
    format: string;
    family: string;
    parameter_size: string;
  };
}

/**
 * Progress information for model pull operations
 */
export interface ModelPullProgress {
  status: string; // e.g. 'downloading', 'verifying', 'done'
  completed?: number; // bytes
  total?: number; // bytes
  percent: number; // 0-100
}

/**
 * Manages Ollama model inventory operations
 */
export class OllamaModelManager {
  private readonly baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  /**
   * List all installed Ollama models
   */
  async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status}`);
      }

      const data: any = await response.json();
      const models: OllamaModel[] = [];

      if (data.models && Array.isArray(data.models)) {
        for (const modelData of data.models) {
          models.push({
            name: modelData.name,
            size: modelData.size || 0,
            modified: new Date(modelData.modified_at || Date.now()),
            digest: modelData.digest || '',
            details: modelData.details ? {
              format: modelData.details.format || '',
              family: modelData.details.family || '',
              parameter_size: modelData.details.parameter_size || '',
            } : undefined,
          });
        }
      }

      return models;
    } catch (error: any) {
      throw new Error(`Failed to list Ollama models: ${error.message}`);
    }
  }

  /**
   * Pull (download) a model from Ollama registry
   */
  async pullModel(
    modelName: string,
    onProgress: (progress: ModelPullProgress) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true }),
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);
            
            // Calculate progress percentage
            let percent = 0;
            if (data.completed && data.total) {
              percent = Math.round((data.completed / data.total) * 100);
            }

            const progress: ModelPullProgress = {
              status: data.status || 'downloading',
              completed: data.completed,
              total: data.total,
              percent,
            };

            onProgress(progress);

            // Check if pull is complete
            if (data.status === 'success' || percent === 100) {
              onProgress({ status: 'done', percent: 100 });
            }
          } catch (parseError) {
            // Skip malformed JSON
            console.warn('Failed to parse pull progress:', line);
          }
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to pull model '${modelName}': ${error.message}`);
    }
  }

  /**
   * Delete a model from local storage
   */
  async deleteModel(modelName: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete model: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to delete model '${modelName}': ${error.message}`);
    }
  }

  /**
   * Check if a specific model exists locally
   */
  async modelExists(modelName: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.some(model => model.name === modelName || model.name.startsWith(modelName + ':'));
    } catch (error) {
      return false;
    }
  }

  /**
   * Get a list of recommended models for Holy Quest AI
   */
  getRecommendedModels(): string[] {
    return ['llama3.1', 'mistral', 'codellama'];
  }
}
