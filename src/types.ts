/**
 * Common Types and Protocol Interfaces for Antigravity WeChat Bridge
 */

export interface ModelConfig {
  id: string;
  name: string;
  label: string;
  displayName?: string;
  isRecommended?: boolean;
  tagTitle?: string;
  quota?: number; // 0 to 1
  resetTime?: string;
  maxTokens?: number;
}

export interface TrajectorySummary {
  cascadeId: string;
  summary: string;
  stepCount: number;
  isPinned?: boolean;
  status?: string;
  createdTime?: string;
  lastModifiedTime?: string;
  relativeTime?: string;
  workspaceDirectory?: string;
  workspaces?: string[];
}

export interface WeChatAttachment {
  name: string;
  type: 'image' | 'file' | 'audio' | 'video';
  mimeType?: string;
  size?: number;
  url?: string;
  aesKey?: string;
  localPath?: string;
  buffer?: Buffer;
}

export interface IncomingWeChatMessage {
  messageId: string;
  senderId: string;
  senderName?: string;
  isGroup?: boolean;
  groupId?: string;
  content: string;
  attachments?: WeChatAttachment[];
  timestamp: number;
}

export interface OutgoingWeChatMessage {
  recipientId: string;
  isGroup?: boolean;
  replyToMessageId?: string;
  text?: string;
  attachments?: WeChatAttachment[];
  model?: string;
}

export interface ACPJsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface ACPJsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}
