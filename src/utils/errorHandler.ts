import * as vscode from 'vscode';

export enum ErrorCategory {
    NETWORK = 'NETWORK',
    RATE_LIMIT = 'RATE_LIMIT',
    AUTH = 'AUTH',
    INVALID_REQUEST = 'INVALID_REQUEST',
    SERVER_ERROR = 'SERVER_ERROR',
    TIMEOUT = 'TIMEOUT',
    UNKNOWN = 'UNKNOWN'
}

export interface CategorizedError {
    category: ErrorCategory;
    message: string;
    userMessage: string;
    recoverable: boolean;
    retryAfter?: number;
    suggestion: string;
}

export class ErrorHandler {

    static categorize(error: any): CategorizedError {
        const message = error?.message || String(error);
        const status = error?.status || error?.statusCode;

        if (status === 429 || message.includes('rate limit')) {
            const retryAfter = error?.headers?.['retry-after'];
            return {
                category: ErrorCategory.RATE_LIMIT,
                message,
                userMessage: 'Rate limit reached. Waiting before retry...',
                recoverable: true,
                retryAfter: retryAfter ? parseInt(retryAfter) * 1000 : 60000,
                suggestion: 'Your request will be retried automatically.'
            };
        }

        if (status === 401 || message.includes('api key') ||
            message.includes('authentication')) {
            return {
                category: ErrorCategory.AUTH,
                message,
                userMessage: 'Invalid API key.',
                recoverable: false,
                suggestion: 'Check your Anthropic API key in settings.'
            };
        }

        if (status === 400 || message.includes('invalid')) {
            return {
                category: ErrorCategory.INVALID_REQUEST,
                message,
                userMessage: 'Invalid request sent to AI.',
                recoverable: false,
                suggestion: 'Try rephrasing your message.'
            };
        }

        if (status >= 500 || message.includes('server error')) {
            return {
                category: ErrorCategory.SERVER_ERROR,
                message,
                userMessage: 'Anthropic server error.',
                recoverable: true,
                suggestion: 'This is temporary. Retrying automatically...'
            };
        }

        if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
            return {
                category: ErrorCategory.TIMEOUT,
                message,
                userMessage: 'Request timed out.',
                recoverable: true,
                suggestion: 'Check your connection. Retrying...'
            };
        }

        if (message.includes('network') || message.includes('ECONNREFUSED') ||
            message.includes('ENOTFOUND') || message.includes('fetch')) {
            return {
                category: ErrorCategory.NETWORK,
                message,
                userMessage: 'Network connection error.',
                recoverable: true,
                suggestion: 'Check your internet connection.'
            };
        }

        return {
            category: ErrorCategory.UNKNOWN,
            message,
            userMessage: 'An unexpected error occurred.',
            recoverable: false,
            suggestion: 'Try again or restart the extension.'
        };
    }

    static showError(error: CategorizedError): void {
        const fullMessage = `${error.userMessage} ${error.suggestion}`;
        if (error.recoverable) {
            vscode.window.showWarningMessage(`Holy Quest AI: ${fullMessage}`);
        } else {
            vscode.window.showErrorMessage(`Holy Quest AI: ${fullMessage}`);
        }
    }

    static formatForWebview(error: CategorizedError): string {
        return `${error.userMessage}\n\n${error.suggestion}`;
    }
}
