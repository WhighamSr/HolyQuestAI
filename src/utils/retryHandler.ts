import { ErrorCategory, ErrorHandler, CategorizedError } from './errorHandler';

export interface RetryOptions {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    onRetry?: (attempt: number, error: CategorizedError, delayMs: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000
};

export class RetryHandler {

    static async withRetry<T>(
        operation: () => Promise<T>,
        options: Partial<RetryOptions> = {}
    ): Promise<T> {
        const config = { ...DEFAULT_OPTIONS, ...options };
        let lastError: CategorizedError | null = null;

        for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error: any) {
                lastError = ErrorHandler.categorize(error);

                if (!lastError.recoverable) {
                    throw error;
                }

                if (attempt === config.maxAttempts) {
                    break;
                }

                const delay = lastError.retryAfter ||
                    Math.min(
                        config.baseDelayMs * Math.pow(2, attempt - 1),
                        config.maxDelayMs
                    );

                if (config.onRetry) {
                    config.onRetry(attempt, lastError, delay);
                }

                await this.sleep(delay);
            }
        }

        throw new Error(lastError?.userMessage || 'Max retry attempts reached');
    }

    static async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static calculateDelay(
        attempt: number,
        baseDelayMs: number = 1000,
        maxDelayMs: number = 30000
    ): number {
        const exponential = baseDelayMs * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 1000;
        return Math.min(exponential + jitter, maxDelayMs);
    }
}
