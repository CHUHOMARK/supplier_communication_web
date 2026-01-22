import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, AlertCircle, Lightbulb, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ShareAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialCode: string;
  materialName: string;
  planId: number;
  onSuccess?: () => void;
}

interface SupplierShare {
  supplierId: number;
  sharePercentage: number;
}

export default function ShareAllocationDialog({
  open,
  onOpenChange,
  materialCode,
  materialName,
  planId,
  onSuccess,
}: ShareAllocationDialogProps) {
  const [supplierShares, setSupplierShares] = useState<SupplierShare[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 获取所有供应商列表
  const { data: suppliers = [] } = trpc.supplier.list.useQuery();

  // 获取该物料的现有供应商分配详情
  const { data: materialDetail } = trpc.mapping.getByPlanAndMaterial.useQuery(
    { 
      planId,
      materialCode 
    },
    { 
      enabled: open && !!materialCode && !!planId
    }
  );

  // 更新份额的mutation
  const updateSharesMutation = trpc.mapping.updateShares.useMutation({
    onSuccess: () => {
      toast.success('份额分配保存成功');
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`保存失败：${error.message}`);
      setIsSaving(false);
    },
  });

  // 当物料详情加载完成时，初始化供应商份额
  useEffect(() => {
    if (materialDetail?.suppliers && materialDetail.suppliers.length > 0) {
      setSupplierShares(
        materialDetail.suppliers.map((s: any) => ({
          supplierId: s.supplierId,
          sharePercentage: s.sharePercentage,
        }))
      );
    } else {
      setSupplierShares([]);
    }
  }, [materialDetail]);

  // 添加供应商
  const addSupplier = () => {
    setSupplierShares([
      ...supplierShares,
      {
        supplierId: 0,
        sharePercentage: 0,
      },
    ]);
  };

  // 移除供应商
  const removeSupplier = (index: number) => {
    setSupplierShares(supplierShares.filter((_, i) => i !== index));
  };

  // 更新供应商份额
  const updateSupplier = (index: number, field: keyof SupplierShare, value: number) => {
    const updated = [...supplierShares];
    updated[index] = { ...updated[index], [field]: value };
    
    // 如果修改的是份额百分比，自动计算剩余份额
    if (field === 'sharePercentage' && updated.length > 1) {
      const remaining = 100 - value;
      
      // 如果剩余份额大于0且还有其他供应商，自动分配到其他供应商
      if (remaining > 0) {
        const otherSuppliers = updated.filter((_, i) => i !== index);
        const avgRemaining = remaining / otherSuppliers.length;
        
        updated.forEach((s, i) => {
          if (i !== index) {
            updated[i].sharePercentage = parseFloat(avgRemaining.toFixed(2));
          }
        });
        
        // 补足四舍五入的误差
        const newTotal = updated.reduce((sum, s) => sum + s.sharePercentage, 0);
        if (Math.abs(newTotal - 100) > 0.01 && otherSuppliers.length > 0) {
          const diff = 100 - newTotal;
          const firstOtherIndex = updated.findIndex((_, i) => i !== index);
          updated[firstOtherIndex].sharePercentage = parseFloat((updated[firstOtherIndex].sharePercentage + diff).toFixed(2));
        }
      }
    }
    
    setSupplierShares(updated);
  };

  // 保存份额分配
  const handleSave = () => {
    // 验证
    if (supplierShares.length === 0) {
      toast.error('请至少添加一个供应商');
      return;
    }

    const invalidSupplier = supplierShares.find((s) => s.supplierId === 0);
    if (invalidSupplier) {
      toast.error('请选择所有供应商');
      return;
    }

    const totalShare = supplierShares.reduce((sum, s) => sum + s.sharePercentage, 0);
    if (Math.abs(totalShare - 100) > 0.01) {
      toast.error(`份额总和必须为100%，当前为${totalShare.toFixed(2)}%`);
      return;
    }

    setIsSaving(true);
    updateSharesMutation.mutate({
      planId,
      materialCode,
      shares: supplierShares,
    });
  };

  // 应用平均份额建议
  const applySuggestion = () => {
    if (supplierShares.length === 0) {
      toast.error('请先添加供应商');
      return;
    }

    const avgShare = 100 / supplierShares.length;
    const updated = supplierShares.map((s, index) => ({
      ...s,
      sharePercentage: index === 0 
        ? parseFloat((100 - avgShare * (supplierShares.length - 1)).toFixed(2))
        : parseFloat(avgShare.toFixed(2)),
    }));

    setSupplierShares(updated);
    toast.success('已应用平均份额建议');
  };

  // 计算份额总和
  const totalShare = supplierShares.reduce((sum, s) => sum + s.sharePercentage, 0);
  const isValidTotal = Math.abs(totalShare - 100) < 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑物料份额分配</DialogTitle>
          <DialogDescription>
            物料: {materialCode} {materialName && `- ${materialName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 智能建议提示 */}
          {supplierShares.length > 1 && !isValidTotal && (
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>可以使用智能建议功能快速分配份额</span>
                <Button size="sm" variant="outline" onClick={applySuggestion}>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  应用平均分配
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* 供应商份额列表 */}
          <div className="space-y-3">
            {supplierShares.map((share, index) => (
              <div key={index} className="flex gap-3 items-end p-3 border rounded-lg">
                <div className="flex-1 space-y-1">
                  <Label className="text-sm">供应商</Label>
                  <Select
                    value={share.supplierId.toString()}
                    onValueChange={(value) => updateSupplier(index, 'supplierId', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择供应商" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id.toString()}>
                          {supplier.supplierName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-32">
                  <Label className="text-sm">份额 (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={share.sharePercentage}
                    onChange={(e) => updateSupplier(index, 'sharePercentage', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeSupplier(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button onClick={addSupplier} variant="outline" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            添加供应商
          </Button>

          {/* 份额总和提示 */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">份额总和:</span>
            <span className={`text-lg font-bold ${isValidTotal ? 'text-green-600' : 'text-red-600'}`}>
              {totalShare.toFixed(2)}%
            </span>
          </div>

          {!isValidTotal && supplierShares.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                份额总和必须为100%，当前为{totalShare.toFixed(2)}%
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !isValidTotal}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
