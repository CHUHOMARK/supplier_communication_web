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
  onSuccess?: () => void;
}

interface SupplierShare {
  supplierId: number;
  sharePercentage: number;
  priority: number;
}

export default function ShareAllocationDialog({
  open,
  onOpenChange,
  materialCode,
  materialName,
  onSuccess,
}: ShareAllocationDialogProps) {
  const [supplierShares, setSupplierShares] = useState<SupplierShare[]>([]);

  const { data: suppliers = [] } = trpc.supplier.list.useQuery();
  const { data: existingMappings } = trpc.mapping.getByMaterialCode.useQuery(
    { materialCode },
    { enabled: open && !!materialCode }
  );
  

  const utils = trpc.useUtils();
  const upsertMutation = trpc.mapping.upsert.useMutation({
    onSuccess: () => {
      toast.success('份额分配保存成功');
      utils.mapping.list.invalidate();
      utils.mapping.getByMaterialCode.invalidate({ materialCode });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`保存失败：${error.message}`);
    },
  });

  // 加载现有映射
  useEffect(() => {
    if (existingMappings && existingMappings.length > 0) {
      setSupplierShares(
        existingMappings.map((m) => ({
          supplierId: m.supplierId,
          sharePercentage: parseFloat(m.sharePercentage || "100"),
          priority: m.priority || 1,
        }))
      );
    } else {
      setSupplierShares([]);
    }
  }, [existingMappings]);

  const addSupplier = () => {
    setSupplierShares([
      ...supplierShares,
      {
        supplierId: 0,
        sharePercentage: 0,
        priority: supplierShares.length + 1,
      },
    ]);
  };

  const removeSupplier = (index: number) => {
    setSupplierShares(supplierShares.filter((_, i) => i !== index));
  };

  const updateSupplier = (index: number, field: keyof SupplierShare, value: number) => {
    const updated = [...supplierShares];
    updated[index] = { ...updated[index], [field]: value };
    setSupplierShares(updated);
  };

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

    upsertMutation.mutate({
      materialCode,
      suppliers: supplierShares,
    });
  };

  // 智能份额建议：根据供应商数量平均分配
  const applySuggestion = () => {
    if (supplierShares.length === 0) {
      toast.error('请先添加供应商');
      return;
    }

    const avgShare = 100 / supplierShares.length;
    const updated = supplierShares.map((s, index) => ({
      ...s,
      sharePercentage: index === 0 
        ? parseFloat((100 - avgShare * (supplierShares.length - 1)).toFixed(2)) // 第一个供应商补足余数
        : parseFloat(avgShare.toFixed(2)),
    }));

    setSupplierShares(updated);
    toast.success('已应用平均份额建议');
  };

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

                <div className="w-24">
                  <Label className="text-sm">优先级</Label>
                  <Input
                    type="number"
                    min="1"
                    value={share.priority}
                    onChange={(e) => updateSupplier(index, 'priority', parseInt(e.target.value) || 1)}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={upsertMutation.isPending || !isValidTotal}>
            {upsertMutation.isPending ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
