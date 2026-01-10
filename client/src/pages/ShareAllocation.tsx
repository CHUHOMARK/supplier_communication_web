import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import ShareAllocationDialog from '@/components/ShareAllocationDialog';
import { Loader2 } from 'lucide-react';

export default function ShareAllocation() {
  const [selectedMaterial, setSelectedMaterial] = useState<{ code: string; name: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | undefined>(undefined);

  const { data: plans } = trpc.materialPlan.list.useQuery();
  const { data: mappings, isLoading, refetch } = trpc.mapping.list.useQuery();
  
  // 获取当前计划中的物料代码
  const { data: planItems } = trpc.materialPlan.getById.useQuery(
    { planId: selectedPlanId! },
    { enabled: !!selectedPlanId }
  );
  const planMaterialCodes = new Set(planItems?.items.map(item => item.materialCode) || []);

  // 按物料代码分组，只显示有多个供应商的物料
  const materialGroups = mappings?.reduce((acc, mapping) => {
    const key = mapping.materialCode;
    if (!acc[key]) {
      acc[key] = {
        materialCode: mapping.materialCode,
        suppliers: [],
      };
    }
    acc[key].suppliers.push({
      supplierId: mapping.supplierId,
      supplierName: mapping.supplier?.supplierName || '',
      sharePercentage: Number(mapping.sharePercentage),
      priority: mapping.priority,
    });
    return acc;
  }, {} as Record<string, { materialCode: string; suppliers: Array<{ supplierId: number; supplierName: string; sharePercentage: number; priority: number }> }>);

  // 只保留多供应商物料，并按计划过滤
  let multiSupplierMaterials = Object.values(materialGroups || {}).filter(
    (group) => group.suppliers.length > 1
  );
  
  // 如果选择了计划，只显示该计划中的物料
  if (selectedPlanId && planMaterialCodes.size > 0) {
    multiSupplierMaterials = multiSupplierMaterials.filter(
      (group) => planMaterialCodes.has(group.materialCode)
    );
  }

  const handleEditShare = (materialCode: string) => {
    setSelectedMaterial({ code: materialCode, name: materialCode });
    setDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    refetch();
    setDialogOpen(false);
  };

  if (isLoading) {
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
                onValueChange={(value) => setSelectedPlanId(value === "all" ? undefined : Number(value))}
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
                  {multiSupplierMaterials.map((material) => {
                    const totalShare = material.suppliers.reduce((sum, s) => sum + s.sharePercentage, 0);
                    const isValid = Math.abs(totalShare - 100) < 0.01;

                    return (
                      <TableRow key={material.materialCode}>
                        <TableCell className="font-medium">{material.materialCode}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{material.suppliers.length} 家</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {material.suppliers
                              .sort((a, b) => b.sharePercentage - a.sharePercentage)
                              .map((supplier) => (
                                <Badge key={supplier.supplierId} variant="outline">
                                  {supplier.supplierName}: {supplier.sharePercentage}%
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
