/**
 * 性能基准测试工具
 * 用于对比虚拟滚动优化前后的性能差异
 */

export interface PerformanceMetrics {
  renderTime: number; // 渲染时间（毫秒）
  memoryUsed: number; // 内存使用（字节）
  fps: number; // 帧率
  scrollSmoothness: number; // 滚动流畅度（0-100）
}

export interface BenchmarkResult {
  beforeOptimization: PerformanceMetrics;
  afterOptimization: PerformanceMetrics;
  improvement: {
    renderTimeReduction: number; // 百分比
    memoryReduction: number; // 百分比
    fpsImprovement: number; // 绝对值
    smoothnessImprovement: number; // 百分比
  };
}

/**
 * 测量渲染时间
 */
export function measureRenderTime(fn: () => void): number {
  const startTime = performance.now();
  fn();
  const endTime = performance.now();
  return endTime - startTime;
}

/**
 * 测量内存使用
 */
export function measureMemoryUsage(): number {
  if (performance.memory) {
    return performance.memory.usedJSHeapSize;
  }
  return 0;
}

/**
 * 测量帧率（FPS）
 */
export async function measureFPS(duration: number = 1000): Promise<number> {
  return new Promise((resolve) => {
    let frameCount = 0;
    let lastTime = performance.now();

    function countFrame() {
      frameCount++;
      const currentTime = performance.now();

      if (currentTime - lastTime >= duration) {
        const fps = (frameCount / (currentTime - lastTime)) * 1000;
        resolve(fps);
      } else {
        requestAnimationFrame(countFrame);
      }
    }

    requestAnimationFrame(countFrame);
  });
}

/**
 * 测量滚动流畅度
 */
export async function measureScrollSmoothness(
  scrollElement: HTMLElement,
  scrollDistance: number = 1000
): Promise<number> {
  return new Promise((resolve) => {
    let frameCount = 0;
    let droppedFrames = 0;
    let lastTime = performance.now();
    const startTime = lastTime;

    function checkScroll() {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;

      // 如果帧时间超过16.67ms（60fps），则认为是掉帧
      if (deltaTime > 16.67) {
        droppedFrames++;
      }

      frameCount++;
      lastTime = currentTime;

      // 滚动完成
      if (scrollElement.scrollTop >= scrollDistance || currentTime - startTime > 5000) {
        const smoothness = Math.max(0, 100 - (droppedFrames / frameCount) * 100);
        resolve(smoothness);
      } else {
        requestAnimationFrame(checkScroll);
      }
    }

    // 开始滚动
    const scrollInterval = setInterval(() => {
      if (scrollElement.scrollTop < scrollDistance) {
        scrollElement.scrollTop += 50;
      } else {
        clearInterval(scrollInterval);
      }
    }, 50);

    requestAnimationFrame(checkScroll);
  });
}

/**
 * 运行完整的性能基准测试
 */
export async function runBenchmark(
  beforeOptimizationFn: () => void,
  afterOptimizationFn: () => void,
  scrollElement?: HTMLElement
): Promise<BenchmarkResult> {
  // 测试优化前的性能
  const beforeRenderTime = measureRenderTime(beforeOptimizationFn);
  const beforeMemory = measureMemoryUsage();
  const beforeFPS = await measureFPS();
  const beforeSmoothness = scrollElement
    ? await measureScrollSmoothness(scrollElement)
    : 0;

  // 等待垃圾回收
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 测试优化后的性能
  const afterRenderTime = measureRenderTime(afterOptimizationFn);
  const afterMemory = measureMemoryUsage();
  const afterFPS = await measureFPS();
  const afterSmoothness = scrollElement
    ? await measureScrollSmoothness(scrollElement)
    : 0;

  // 计算改进百分比
  const renderTimeReduction =
    ((beforeRenderTime - afterRenderTime) / beforeRenderTime) * 100;
  const memoryReduction =
    ((beforeMemory - afterMemory) / beforeMemory) * 100;
  const fpsImprovement = afterFPS - beforeFPS;
  const smoothnessImprovement =
    ((afterSmoothness - beforeSmoothness) / beforeSmoothness) * 100;

  return {
    beforeOptimization: {
      renderTime: beforeRenderTime,
      memoryUsed: beforeMemory,
      fps: beforeFPS,
      scrollSmoothness: beforeSmoothness,
    },
    afterOptimization: {
      renderTime: afterRenderTime,
      memoryUsed: afterMemory,
      fps: afterFPS,
      scrollSmoothness: afterSmoothness,
    },
    improvement: {
      renderTimeReduction,
      memoryReduction,
      fpsImprovement,
      smoothnessImprovement,
    },
  };
}

/**
 * 格式化性能数据用于显示
 */
export function formatMetrics(metrics: PerformanceMetrics): string {
  return `
    渲染时间: ${metrics.renderTime.toFixed(2)}ms
    内存使用: ${(metrics.memoryUsed / 1024 / 1024).toFixed(2)}MB
    帧率: ${metrics.fps.toFixed(2)} FPS
    滚动流畅度: ${metrics.scrollSmoothness.toFixed(2)}%
  `;
}

/**
 * 格式化基准测试结果用于显示
 */
export function formatBenchmarkResult(result: BenchmarkResult): string {
  return `
    优化前性能:
    ${formatMetrics(result.beforeOptimization)}
    
    优化后性能:
    ${formatMetrics(result.afterOptimization)}
    
    性能改进:
    - 渲染时间减少: ${result.improvement.renderTimeReduction.toFixed(2)}%
    - 内存使用减少: ${result.improvement.memoryReduction.toFixed(2)}%
    - 帧率提升: ${result.improvement.fpsImprovement.toFixed(2)} FPS
    - 滚动流畅度改进: ${result.improvement.smoothnessImprovement.toFixed(2)}%
  `;
}
