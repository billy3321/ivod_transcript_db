/**
 * MCP Error Codes 常數定義
 * 基於 JSON-RPC 2.0 和 MCP 規範
 */

// JSON-RPC 2.0 標準錯誤代碼
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,       // JSON 解析錯誤
  INVALID_REQUEST: -32600,   // 無效請求格式
  METHOD_NOT_FOUND: -32601,  // 方法不存在
  INVALID_PARAMS: -32602,    // 無效參數
  INTERNAL_ERROR: -32603,    // 內部錯誤
} as const;

// MCP 實作特定錯誤代碼 (-32000 到 -32099)
export const MCP_ERRORS = {
  RATE_LIMIT_EXCEEDED: -32050,  // 速率限制超出
  RESOURCE_NOT_FOUND: -32002,   // 資源不存在
  CAPABILITY_NOT_SUPPORTED: -32001, // 功能不支援
} as const;

// 自定義錯誤代碼範圍
export const CUSTOM_ERRORS = {
  // 認證相關錯誤 (-31xxx)
  AUTH_REQUIRED: -31001,
  INVALID_TOKEN: -31002,
  TOKEN_EXPIRED: -31003,
  
  // 資源存取錯誤 (-30xxx)
  RESOURCE_LOCKED: -30001,
  QUOTA_EXCEEDED: -30002,
  PERMISSION_DENIED: -30003,
  
  // 工具執行錯誤 (-29xxx)
  TOOL_TIMEOUT: -29001,
  TOOL_UNAVAILABLE: -29002,
  TOOL_EXECUTION_FAILED: -29003,
} as const;

/**
 * 錯誤訊息對照表
 */
export const ERROR_MESSAGES = {
  [JSON_RPC_ERRORS.PARSE_ERROR]: 'Parse error: Invalid JSON',
  [JSON_RPC_ERRORS.INVALID_REQUEST]: 'Invalid Request: Request format is invalid',
  [JSON_RPC_ERRORS.METHOD_NOT_FOUND]: 'Method not found',
  [JSON_RPC_ERRORS.INVALID_PARAMS]: 'Invalid params',
  [JSON_RPC_ERRORS.INTERNAL_ERROR]: 'Internal error',
  
  [MCP_ERRORS.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
  [MCP_ERRORS.RESOURCE_NOT_FOUND]: 'Resource not found',
  [MCP_ERRORS.CAPABILITY_NOT_SUPPORTED]: 'Capability not supported',
  
  [CUSTOM_ERRORS.AUTH_REQUIRED]: 'Authentication required',
  [CUSTOM_ERRORS.INVALID_TOKEN]: 'Invalid authentication token',
  [CUSTOM_ERRORS.TOKEN_EXPIRED]: 'Authentication token expired',
  [CUSTOM_ERRORS.RESOURCE_LOCKED]: 'Resource is locked',
  [CUSTOM_ERRORS.QUOTA_EXCEEDED]: 'Usage quota exceeded',
  [CUSTOM_ERRORS.PERMISSION_DENIED]: 'Permission denied',
  [CUSTOM_ERRORS.TOOL_TIMEOUT]: 'Tool execution timeout',
  [CUSTOM_ERRORS.TOOL_UNAVAILABLE]: 'Tool is currently unavailable',
  [CUSTOM_ERRORS.TOOL_EXECUTION_FAILED]: 'Tool execution failed',
} as const;

/**
 * 檢查錯誤代碼是否為標準 JSON-RPC 錯誤
 */
export function isStandardJsonRpcError(code: number): boolean {
  return Object.values(JSON_RPC_ERRORS).includes(code as any);
}

/**
 * 檢查錯誤代碼是否為有效的 JSON-RPC 錯誤代碼範圍
 */
export function isValidErrorCode(code: number): boolean {
  // JSON-RPC 2.0 保留範圍: -32768 到 -32000
  return code >= -32768 && code <= -32000;
}

/**
 * 獲取錯誤訊息
 */
export function getErrorMessage(code: number): string {
  return ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] || 'Unknown error';
}