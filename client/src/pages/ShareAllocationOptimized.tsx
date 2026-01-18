import { useState, useEffect, useCallback, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import ShareAllocationDialog from '@/components/ShareAllocationDialog';
import { Loader2 } from 'lucide-react';

const PAGE_SIZE = 50; // 每页显示50个物料

export default function ShareAllocationOptimized() {
  const [selectedMaterial, setSelectedMaterial] = useState<{ code: string; name: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(0);
  const [materialCache, setMaterialCache] = useState<Map<string, any>>(new Map());

  const { data: plans } = trpc.materialPlan.list.useQuery();
  
  // 获取当前计划中的物料代码
  const { data: planItems } = trpc.materialPlan.getById.useQuery(
    { planId: selectedPlanId! },
    { enabled: !!selectedPlanId }
  );
  const planMaterialCodes = useMemo(
    () => new Set(planItems?.items.map(item => item.materialCode) || []),
    [planItems?.items]
  );

  // 使用分页API获取物料列表
  const { data: paginatedData, isLoading, refetch } = trpc.mapping.listPaginated.useQuery(
    { page: currentPage, pageSize: PAGE_SIZE },
    { staleTime: 30000 } // 30秒缓存
  );

  // 过滤多供应商物料，并按计划过滤
  const multiSupplierMaterials = useMemo(() => {
    if (!paginatedData?.materials) return [];
    
    let materials = paginatedData.materials.filter(
      (group: any) => group.supplierCount > 1
    );
    
    // 如果选择了计划，只显示该计划中的物料
    if (selectedPlanId && planMaterialCodes.size > 0) {
      materials = materials.filter(
        (group: any) => planMaterialCodes.has(group.materialCode)
      );
    }
    
    return materials;
  }, [paginatedData?.materials, selectedPlanId, planMaterialCodes]);

  const handleEditShare = useCallback((materialCode: string) => {
    setSelectedMaterial({ code: materialCode, name: materialCode });
    setDialogOpen(true);
  }, []);

  const handleDialogSuccess = useCallback(() => {
    refetch();
    setDialogOpen(false);
    // 清空缓存以强制刷新
    setMaterialCache(new Map());
  }, [refetch]);

  const handlePreviousPage = useCallback(() => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    if (paginatedData && currentPage < Math.ceil(paginatedData.total / PAGE_SIZE) - 1) {
      setCurrentPage(prev => prev + 1);
    }
  }, [paginatedData]);

  const totalPages = paginatedData ? Math.ceil(paginatedData.total / PAGE_SIZE) : 0;
  const hasNextPage = currentPage < totalPages - 1;
  const hasPreviousPage = currentPage > 0;

  if (isLoading && currentPage === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">物料份额分配</h1>
            <p className="text-sm text-muted-foreground">管理多供应商物料的份额分配</p>
          </div>
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
            {/* 物料计划选择器 */}
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">筛选计划：</Label>
              <Select
                value={selectedPlanId?.toString() || "all"}
                onValueChange={(value) => {
                  setSelectedPlanId(value === "all" ? undefined : Number(value));
                  setCurrentPage(0); // 重置到第一页
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部物料" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部物料</SelectItem>
                  {plans?.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id.toString()}>
                      {plan.fileName} ({plan.planStartDate} - {plan.planEndDate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {multiSupplierMaterials.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>暂无多供应商物料</p>
                <p className="text-sm mt-2">请先在供应商管理页面为物料分配多个供应商</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>物料代码</TableHead>
                      <TableHead>供应商数量</TableHead>
                      <TableHead>份额分配详情</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {multiSupplierMaterials.map((material: any) => {
                      const totalShare = material.mappings.reduce((sum: number, s: any) => sum + parseFloat(s.sharePercentage || "0"), 0);
                      const isValid = Math.abs(totalShare - 100) < 0.01;

                      return (
                        <TableRow key={material.materialCode}>
                          <TableCell className="font-medium">{material.materialCode}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{material.supplierCount} 家</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              {material.mappings
                                .sort((a: any, b: any) => parseFloat(b.sharePercentage || "0") - parseFloat(a.sharePercentage || "0"))
                                .map((supplier: any) => (
                                  <Badge key={supplier.supplierId} variant="outline">
                                    {supplier.supplier?.supplierName || `供应商${supplier.supplierId}`}: {parseFloat(supplier.sharePercentage || "0")}%
                                  </Badge>
                                ))}
                              {!isValid && (
                                <Badge variant="destructive">总和: {totalShare.toFixed(1)}%</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditShare(material.materialCode)}
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
                    第 {currentPage + 1} / {totalPages} 页 | 共 {paginatedData?.total} 个物料
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
          onSuccess={handleDialogSuccess}
        />
      )}
    </div>
  );
}
