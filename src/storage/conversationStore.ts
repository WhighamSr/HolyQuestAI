import * as vscode from 'vscode';

export interface Message {
    role: 'user' | 'assistant';
    content: any;
    timestamp: number;
}

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
    tokenCount: number;
}

export class ConversationStore {
    private static readonly STORAGE_KEY = 'holyQuestAI.conversations';
    private static readonly ACTIVE_KEY = 'holyQuestAI.activeConversation';
    private static readonly MAX_CONVERSATIONS = 50;

    constructor(private readonly globalState: vscode.Memento) {}

    getAllConversations(): Conversation[] {
        return this.globalState.get<Conversation[]>(
            ConversationStore.STORAGE_KEY, []
        );
    }

    getActiveConversation(): Conversation | undefined {
        const activeId = this.globalState.get<string>(
            ConversationStore.ACTIVE_KEY
        );
        if (!activeId) return undefined;
        return this.getAllConversations().find(c => c.id === activeId);
    }

    async saveConversation(conversation: Conversation): Promise<void> {
        const conversations = this.getAllConversations();
        const existingIndex = conversations.findIndex(
            c => c.id === conversation.id
        );
        if (existingIndex >= 0) {
            conversations[existingIndex] = conversation;
        } else {
            conversations.unshift(conversation);
            if (conversations.length > ConversationStore.MAX_CONVERSATIONS) {
                conversations.pop();
            }
        }
        await this.globalState.update(
            ConversationStore.STORAGE_KEY, conversations
        );
    }

    async setActiveConversation(id: string): Promise<void> {
        await this.globalState.update(ConversationStore.ACTIVE_KEY, id);
    }

    async deleteConversation(id: string): Promise<void> {
        const conversations = this.getAllConversations().filter(
            c => c.id !== id
        );
        await this.globalState.update(
            ConversationStore.STORAGE_KEY, conversations
        );
    }

    async clearAllConversations(): Promise<void> {
        await this.globalState.update(ConversationStore.STORAGE_KEY, []);
        await this.globalState.update(ConversationStore.ACTIVE_KEY, undefined);
    }

    createNewConversation(): Conversation {
        return {
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            title: 'New Conversation',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tokenCount: 0
        };
    }

    generateTitle(firstMessage: string): string {
        return firstMessage.slice(0, 50).trim() + 
            (firstMessage.length > 50 ? '...' : '');
    }
}
