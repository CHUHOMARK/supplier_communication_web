import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShareAllocation from './ShareAllocation';
import { trpc } from '@/lib/trpc';

// Mock trpc
vi.mock('@/lib/trpc', () => ({
  trpc: {
    materialPlan: {
      list: {
        useQuery: vi.fn(),
      },
    },
    mapping: {
      listByPlan: {
        useQuery: vi.fn(),
      },
    },
  },
}));

describe('ShareAllocation - 虚拟滚动集成测试', () => {
  const mockPlans = [
    {
      id: 1,
      fileName: '2026年1月计划',
      planStartDate: '2026-01-01',
      planEndDate: '2026-01-31',
    },
  ];

  const mockMaterials = Array.from({ length: 100 }, (_, i) => ({
    materialCode: `MAT-${String(i + 1).padStart(3, '0')}`,
    materialName: `物料${i + 1}`,
    shortage: Math.floor(Math.random() * 1000),
    suppliers: [
      {
        supplierId: 1,
        supplierName: '供应商A',
        sharePercentage: 60,
      },
      {
        supplierId: 2,
        supplierName: '供应商B',
        sharePercentage: 40,
      },
    ],
    totalSharePercentage: 100,
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该显示计划选择器', () => {
    (trpc.materialPlan.list.useQuery as any).mockReturnValue({
      data: mockPlans,
      isLoading: false,
      error: null,
    });

    render(<ShareAllocation />);
    
    expect(screen.getByText('选择物料计划')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('选择物料计划')).toBeInTheDocument();
  });

  it('选择计划后应该加载物料列表', async () => {
    (trpc.materialPlan.list.useQuery as any).mockReturnValue({
      data: mockPlans,
      isLoading: false,
      error: null,
    });

    (trpc.mapping.listByPlan.useQuery as any).mockReturnValue({
      data: {
        materials: mockMaterials.slice(0, 50),
        total: 100,
        page: 0,
        pageSize: 1000,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { rerender } = render(<ShareAllocation />);

    // 选择计划
    const selectTrigger = screen.getByPlaceholderText('选择物料计划');
    fireEvent.click(selectTrigger);

    const planOption = screen.getByText('2026年1月计划 (2026-01-01 至 2026-01-31)');
    fireEvent.click(planOption);

    rerender(<ShareAllocation />);

    // 验证虚拟滚动容器是否存在
    await waitFor(() => {
      expect(screen.getByText('共 100 个多供应商物料')).toBeInTheDocument();
    });
  });

  it('虚拟滚动列表应该显示物料信息', async () => {
    (trpc.materialPlan.list.useQuery as any).mockReturnValue({
      data: mockPlans,
      isLoading: false,
      error: null,
    });

    (trpc.mapping.listByPlan.useQuery as any).mockReturnValue({
      data: {
        materials: mockMaterials.slice(0, 50),
        total: 100,
        page: 0,
        pageSize: 1000,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ShareAllocation />);

    // 验证物料代码和名称显示
    await waitFor(() => {
      expect(screen.getByText('MAT-001')).toBeInTheDocument();
      expect(screen.getByText('物料1')).toBeInTheDocument();
    });
  });

  it('编辑份额按钮应该可点击', async () => {
    (trpc.materialPlan.list.useQuery as any).mockReturnValue({
      data: mockPlans,
      isLoading: false,
      error: null,
    });

    (trpc.mapping.listByPlan.useQuery as any).mockReturnValue({
      data: {
        materials: mockMaterials.slice(0, 50),
        total: 100,
        page: 0,
        pageSize: 1000,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ShareAllocation />);

    await waitFor(() => {
      const editButtons = screen.getAllByText('编辑份额');
      expect(editButtons.length).toBeGreaterThan(0);
      expect(editButtons[0]).not.toBeDisabled();
    });
  });

  it('应该显示供应商分配信息', async () => {
    (trpc.materialPlan.list.useQuery as any).mockReturnValue({
      data: mockPlans,
      isLoading: false,
      error: null,
    });

    (trpc.mapping.listByPlan.useQuery as any).mockReturnValue({
      data: {
        materials: mockMaterials.slice(0, 50),
        total: 100,
        page: 0,
        pageSize: 1000,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ShareAllocation />);

    await waitFor(() => {
      expect(screen.getByText(/供应商A: 60%/)).toBeInTheDocument();
      expect(screen.getByText(/供应商B: 40%/)).toBeInTheDocument();
    });
  });

  it('空列表应该显示提示信息', () => {
    (trpc.materialPlan.list.useQuery as any).mockReturnValue({
      data: mockPlans,
      isLoading: false,
      error: null,
    });

    (trpc.mapping.listByPlan.useQuery as any).mockReturnValue({
      data: {
        materials: [],
        total: 0,
        page: 0,
        pageSize: 1000,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ShareAllocation />);

    expect(screen.getByText('暂无多供应商物料')).toBeInTheDocument();
    expect(screen.getByText('该计划中的所有物料都只有一个供应商')).toBeInTheDocument();
  });

  it('加载中应该显示加载指示器', () => {
    (trpc.materialPlan.list.useQuery as any).mockReturnValue({
      data: mockPlans,
      isLoading: false,
      error: null,
    });

    (trpc.mapping.listByPlan.useQuery as any).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<ShareAllocation />);

    // 应该显示加载指示器
    const loadingIndicator = screen.getByRole('status', { hidden: true });
    expect(loadingIndicator).toBeInTheDocument();
  });

  it('错误状态应该显示错误信息', () => {
    (trpc.materialPlan.list.useQuery as any).mockReturnValue({
      data: mockPlans,
      isLoading: false,
      error: null,
    });

    (trpc.mapping.listByPlan.useQuery as any).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('加载失败'),
      refetch: vi.fn(),
    });

    render(<ShareAllocation />);

    expect(screen.getByText(/加载物料列表失败/)).toBeInTheDocument();
  });

  it('虚拟滚动应该支持大数据集', async () => {
    const largeMaterials = Array.from({ length: 1000 }, (_, i) => ({
      materialCode: `MAT-${String(i + 1).padStart(4, '0')}`,
      materialName: `物料${i + 1}`,
      shortage: Math.floor(Math.random() * 1000),
      suppliers: [
        {
          supplierId: 1,
          supplierName: '供应商A',
          sharePercentage: 60,
        },
        {
          supplierId: 2,
          supplierName: '供应商B',
          sharePercentage: 40,
        },
      ],
      totalSharePercentage: 100,
    }));

    (trpc.materialPlan.list.useQuery as any).mockReturnValue({
      data: mockPlans,
      isLoading: false,
      error: null,
    });

    (trpc.mapping.listByPlan.useQuery as any).mockReturnValue({
      data: {
        materials: largeMaterials,
        total: 1000,
        page: 0,
        pageSize: 1000,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const startTime = performance.now();
    render(<ShareAllocation />);
    const endTime = performance.now();

    // 渲染时间应该在合理范围内（虚拟滚动优化）
    expect(endTime - startTime).toBeLessThan(2000);

    await waitFor(() => {
      expect(screen.getByText('共 1000 个多供应商物料')).toBeInTheDocument();
    });
  });
});
