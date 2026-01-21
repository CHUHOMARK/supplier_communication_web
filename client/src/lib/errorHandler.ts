import { toast } from 'sonner';

/**
 * 错误处理工具类
 * 提供网络错误重试、用户友好的错误提示等功能
 */

export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export class ErrorHandler {
  /**
   * 执行带重试的异步操作
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      delayMs = 1000,
      backoffMultiplier = 2,
      onRetry,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 如果是最后一次尝试，抛出错误
        if (attempt === maxRetries) {
          throw lastError;
        }

        // 计算延迟时间（指数退避）
        const delay = delayMs * Math.pow(backoffMultiplier, attempt);

        onRetry?.(attempt + 1, lastError);

        // 等待后重试
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * 获取用户友好的错误消息
   */
  static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      // 处理tRPC错误
      if ('data' in error && typeof error.data === 'object' && error.data !== null) {
        const data = error.data as any;
        if (data.code === 'BAD_REQUEST' && data.message) {
          return data.message;
        }
      }

      // 处理网络错误
      if (error.message.includes('fetch')) {
        return '网络连接失败，请检查您的网络';
      }

      if (error.message.includes('timeout')) {
        return '请求超时，请稍后重试';
      }

      if (error.message.includes('UNAUTHORIZED')) {
        return '您的登录已过期，请重新登录';
      }

      if (error.message.includes('FORBIDDEN')) {
        return '您没有权限执行此操作';
      }

      if (error.message.includes('NOT_FOUND')) {
        return '请求的资源不存在';
      }

      // 返回原始错误消息
      return error.message || '发生未知错误';
    }

    return '发生未知错误';
  }

  /**
   * 显示错误提示
   */
  static showError(error: unknown, defaultMessage = '操作失败'): void {
    const message = this.getErrorMessage(error);
    toast.error(message || defaultMessage);
  }

  /**
   * 显示成功提示
   */
  static showSuccess(message: string): void {
    toast.success(message);
  }

  /**
   * 判断是否是网络错误
   */
  static isNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      );
    }
    return false;
  }

  /**
   * 判断是否是认证错误
   */
  static isAuthError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes('UNAUTHORIZED') ||
        error.message.includes('401') ||
        error.message.includes('Unauthorized')
      );
    }
    return false;
  }

  /**
   * 判断是否是验证错误
   */
  static isValidationError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes('BAD_REQUEST') ||
        error.message.includes('400') ||
        error.message.includes('validation')
      );
    }
    return false;
  }
}

/**
 * 创建带重试的API调用包装器
 */
export function createRetryableApiCall<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
) {
  return async () => {
    try {
      return await ErrorHandler.withRetry(fn, {
        maxRetries: 2,
        delayMs: 500,
        ...options,
      });
    } catch (error) {
      ErrorHandler.showError(error);
      throw error;
    }
  };
}

/**
 * 处理并发编辑冲突
 */
export class ConcurrencyHandler {
  private static locks = new Map<string, Promise<void>>();

  /**
   * 获取资源锁
   */
  static async acquireLock(resourceId: string): Promise<void> {
    const existingLock = this.locks.get(resourceId);
    if (existingLock) {
      await existingLock;
    }
  }

  /**
   * 释放资源锁
   */
  static releaseLock(resourceId: string): void {
    this.locks.delete(resourceId);
  }

  /**
   * 执行带锁的操作
   */
  static async withLock<T>(
    resourceId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    await this.acquireLock(resourceId);

    try {
      return await fn();
    } finally {
      this.releaseLock(resourceId);
    }
  }

  /**
   * 检测并发冲突
   */
  static detectConflict(
    localVersion: number,
    remoteVersion: number
  ): boolean {
    return localVersion !== remoteVersion;
  }

  /**
   * 处理冲突（使用最后写入获胜策略）
   */
  static resolveConflict<T>(
    localData: T,
    remoteData: T,
    strategy: 'local' | 'remote' | 'merge' = 'remote'
  ): T {
    switch (strategy) {
      case 'local':
        return localData;
      case 'remote':
        return remoteData;
      case 'merge':
        // 简单的合并策略：对象属性级别的合并
        if (typeof localData === 'object' && typeof remoteData === 'object') {
          return { ...remoteData, ...localData } as T;
        }
        return remoteData;
      default:
        return remoteData;
    }
  }
}
