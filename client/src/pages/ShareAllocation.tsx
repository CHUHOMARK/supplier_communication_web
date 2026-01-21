import { useState, useCallback, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import ShareAllocationDialog from '@/components/ShareAllocationDialog';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const PAGE_SIZE = 50;

export default function ShareAllocation() {
  const [selectedPlanId, setSelectedPlanId] = useState<number | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedMaterial, setSelectedMaterial] = useState<{ 
    code: string; 
    name: string; 
    planId: number;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // 获取所有物料计划
  const { data: plans } = trpc.materialPlan.list.useQuery();

  // 使用新的API获取计划中的物料及其供应商分配
  const { 
    data: materialsData, 
    isLoading, 
    error,
    refetch 
  } = trpc.mapping.listByPlan.useQuery(
    { 
      planId: selectedPlanId!,
      page: currentPage, 
      pageSize: PAGE_SIZE 
    },
    { 
      enabled: !!selectedPlanId,
      staleTime: 30000 
    }
  );

  // 计算分页信息
  const totalPages = useMemo(() => {
    if (!materialsData) return 0;
    return Math.ceil(materialsData.total / PAGE_SIZE);
  }, [materialsData]);

  const hasNextPage = useMemo(() => {
    return currentPage < totalPages - 1;
  }, [currentPage, totalPages]);

  const hasPreviousPage = useMemo(() => {
    return currentPage > 0;
  }, [currentPage]);

  // 处理计划选择变化
  const handlePlanChange = useCallback((value: string) => {
    const planId = value === "none" ? undefined : Number(value);
    setSelectedPlanId(planId);
    setCurrentPage(0);
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
    refetch();
  }, [refetch]);

  // 处理分页
  const handlePreviousPage = useCallback(() => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasNextPage]);

  // 验证份额是否有效
  const isShareValid = useCallback((totalShare: number) => {
    return Math.abs(totalShare - 100) < 0.01;
  }, []);

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
                    value="none"
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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

  // 获取当前计划的信息
  const currentPlan = plans?.find(p => p.id === selectedPlanId);

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
              setCurrentPage(0);
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
            {!materialsData?.materials || materialsData.materials.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>暂无多供应商物料</p>
                <p className="text-sm mt-2">该计划中的所有物料都只有一个供应商</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>物料代码</TableHead>
                      <TableHead>物料名称</TableHead>
                      <TableHead>缺口</TableHead>
                      <TableHead>供应商分配</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialsData.materials.map((material: any) => {
                      const totalShare = material.totalSharePercentage;
                      const isValid = isShareValid(totalShare);

                      return (
                        <TableRow key={material.materialCode}>
                          <TableCell className="font-medium">{material.materialCode}</TableCell>
                          <TableCell>{material.materialName}</TableCell>
                          <TableCell>{material.shortage}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {material.suppliers.map((supplier: any) => (
                                <div key={supplier.supplierId} className="text-sm">
                                  <Badge variant="outline">
                                    {supplier.supplierName}: {supplier.sharePercentage}%
                                  </Badge>
                                </div>
                              ))}
                              {!isValid && (
                                <div className="text-sm">
                                  <Badge variant="destructive">
                                    总和: {totalShare.toFixed(1)}%
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditShare(material.materialCode, material.materialName)}
                            >
                              编辑份额
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* 分页控件 */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    第 {currentPage + 1} / {totalPages} 页 | 共 {materialsData.total} 个物料
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousPage}
                      disabled={!hasPreviousPage || isLoading}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={!hasNextPage || isLoading}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
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
