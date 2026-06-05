import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import ShareAllocationDialog from '@/components/ShareAllocationDialog';
import VirtualMaterialList from '@/components/VirtualMaterialList';
import { MaterialTableSkeleton } from '@/components/MaterialTableSkeleton';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// API的pageSize最大值为100
const PAGE_SIZE = 100;

export default function ShareAllocation() {
  const [selectedPlanId, setSelectedPlanId] = useState<number | undefined>(undefined);
  const [selectedMaterial, setSelectedMaterial] = useState<{ 
    code: string; 
    name: string; 
    planId: number;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [allMaterials, setAllMaterials] = useState<any[]>([]);
  const [isLoadingAllPages, setIsLoadingAllPages] = useState(false);
  const [totalMaterials, setTotalMaterials] = useState(0);

  // 获取所有物料计划
  const { data: plans } = trpc.materialPlan.list.useQuery();

  // 获取第一页数据，用于获取总数
  const { 
    data: firstPageData, 
    isLoading: isLoadingFirstPage, 
    error,
    refetch: refetchFirstPage
  } = trpc.mapping.listByPlan.useQuery(
    { 
      planId: selectedPlanId!,
      page: 0, 
      pageSize: PAGE_SIZE 
    },
    { 
      enabled: !!selectedPlanId,
      staleTime: 5 * 60 * 1000, // 5分钟
      refetchOnWindowFocus: false, // 禁用窗口聚焦时自动刷新
    }
  );

  // 当获取到第一页数据时，自动加载所有其他页面
  const utils = trpc.useUtils();
  const loadedPlanRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!firstPageData || !selectedPlanId) return;
    
    // 如果已经加载过该计划，则不重复加载
    if (loadedPlanRef.current === selectedPlanId) return;

    const loadAllPages = async () => {
      setIsLoadingAllPages(true);
      try {
        const materials = [...firstPageData.materials];
        setTotalMaterials(firstPageData.total);

        // 计算需要加载的页数
        const totalPages = Math.ceil(firstPageData.total / PAGE_SIZE);

        // 加载剩余的页面
        for (let page = 1; page < totalPages; page++) {
          const response = await utils.mapping.listByPlan.fetch({
            planId: selectedPlanId,
            page,
            pageSize: PAGE_SIZE,
          });
          
          if (response && response.materials) {
            materials.push(...response.materials);
          }
        }

        // 过滤出只有多个供应商的物料
        const multiSupplierMaterials = materials.filter(
          (m) => m.suppliers && Array.isArray(m.suppliers) && m.suppliers.length > 1
        );
        setAllMaterials(multiSupplierMaterials);
        
        // 标记该计划已加载
        loadedPlanRef.current = selectedPlanId;
      } catch (err) {
        console.error('加载所有页面失败:', err);
      } finally {
        setIsLoadingAllPages(false);
      }
    };

    loadAllPages();
  }, [firstPageData, selectedPlanId, utils]);

  // 处理计划选择变化
  const handlePlanChange = useCallback((value: string) => {
    const planId = value === "none" ? undefined : Number(value);
    setSelectedPlanId(planId);
    setAllMaterials([]);
    setTotalMaterials(0);
    // 重置loadedPlanRef，允许加载新计划
    loadedPlanRef.current = null;
  }, []);

  // 处理编辑份额
  const handleEditShare = useCallback((materialCode: string, materialName: string) => {
    if (!selectedPlanId) return;
    setSelectedMaterial({ 
      code: materialCode, 
      name: materialName,
      planId: selectedPlanId
    });
    setDialogOpen(true);
  }, [selectedPlanId]);

  // 处理对话框关闭和成功
  const handleDialogSuccess = useCallback(() => {
    setDialogOpen(false);
    setSelectedMaterial(null);
    // 重置loadedPlanRef，允许重新加载数据
    loadedPlanRef.current = null;
    refetchFirstPage();
  }, [refetchFirstPage]);

  // 获取当前计划的信息
  const currentPlan = useMemo(() => {
    return plans?.find(p => p.id === selectedPlanId);
  }, [plans, selectedPlanId]);

  // 判断是否还在加载中
  const isLoading = isLoadingFirstPage || isLoadingAllPages;

  // 加载中状态
  if (!selectedPlanId) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto py-4">
            <h1 className="text-2xl font-bold">物料份额分配</h1>
            <p className="text-sm text-muted-foreground">管理多供应商物料的份额分配</p>
          </div>
        </header>

        <main className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>选择物料计划</CardTitle>
              <CardDescription>
                请先选择一个物料计划，然后查看其中的多供应商物料
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="plan-select" className="mb-2 block">物料计划</Label>
                  <Select
                    value={selectedPlanId ? selectedPlanId.toString() : "none"}
                    onValueChange={handlePlanChange}
                  >
                    <SelectTrigger id="plan-select" className="w-full">
                      <SelectValue placeholder="选择物料计划" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans?.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id.toString()}>
                          {plan.fileName} ({plan.planStartDate} 至 {plan.planEndDate})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // 加载中状态
  if (isLoading) {
    const progress = totalMaterials > 0 ? (allMaterials.length / totalMaterials) * 100 : 0;
    
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto py-4">
            <h1 className="text-2xl font-bold">物料份额分配</h1>
            <p className="text-sm text-muted-foreground">管理多供应商物料的份额分配</p>
          </div>
        </header>

        <main className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>加载中...</CardTitle>
              <CardDescription>
                {isLoadingFirstPage ? '正在加载物料列表' : `正在加载所有物料 (${allMaterials.length}/${totalMaterials})`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>加载进度</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
              <MaterialTableSkeleton rows={8} />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto py-4">
            <h1 className="text-2xl font-bold">物料份额分配</h1>
            <p className="text-sm text-muted-foreground">管理多供应商物料的份额分配</p>
          </div>
        </header>

        <main className="container mx-auto py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              加载物料列表失败: {error.message}
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">物料份额分配</h1>
            <p className="text-sm text-muted-foreground">
              {currentPlan?.fileName} ({currentPlan?.planStartDate} 至 {currentPlan?.planEndDate})
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedPlanId(undefined);
              setAllMaterials([]);
              setTotalMaterials(0);
            }}
          >
            切换计划
          </Button>
        </div>
      </header>

      <main className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>多供应商物料列表</CardTitle>
            <CardDescription>
              以下物料有多个供应商，点击"编辑份额"可调整各供应商的份额分配
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {allMaterials.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>暂无多供应商物料</p>
                <p className="text-sm mt-2">该计划中的所有物料都只有一个供应商</p>
              </div>
            ) : (
              <>
                <div className="text-sm text-muted-foreground mb-4">
                  共 {allMaterials.length} 个多供应商物料
                </div>
                <VirtualMaterialList
                  materials={allMaterials}
                  onEditShare={handleEditShare}
                  isLoading={isLoading}
                />
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {selectedMaterial && (
        <ShareAllocationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          materialCode={selectedMaterial.code}
          materialName={selectedMaterial.name}
          planId={selectedMaterial.planId}
          onSuccess={handleDialogSuccess}
        />
      )}
    </div>
  );
}
