import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface BatchShareAllocationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: number;
  materials: Array<{ code: string; name: string }>;
  onSuccess?: () => void;
}

interface SupplierShare {
  supplierId: number;
  sharePercentage: number;
  priority: number;
}

export default function BatchShareAllocation({
  open,
  onOpenChange,
  planId,
  materials,
  onSuccess,
}: BatchShareAllocationProps) {
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [supplierShares, setSupplierShares] = useState<SupplierShare[]>([]);
  const [processing, setProcessing] = useState(false);

  const { data: suppliers } = trpc.supplier.list.useQuery();
  const utils = trpc.useUtils();
  const upsertMutation = trpc.mapping.upsert.useMutation();

  const toggleMaterial = (code: string) => {
    const newSelected = new Set(selectedMaterials);
    if (newSelected.has(code)) {
      newSelected.delete(code);
    } else {
      newSelected.add(code);
    }
    setSelectedMaterials(newSelected);
  };

  const selectAll = () => {
    setSelectedMaterials(new Set(materials.map(m => m.code)));
  };

  const clearAll = () => {
    setSelectedMaterials(new Set());
  };

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

  const handleBatchApply = async () => {
    // 验证
    if (selectedMaterials.size === 0) {
      toast.error('请至少选择一个物料');
      return;
    }

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

    setProcessing(true);

    try {
      let successCount = 0;
      let failCount = 0;

      for (const materialCode of Array.from(selectedMaterials)) {
        try {
          await upsertMutation.mutateAsync({
            planId,
            materialCode,
            suppliers: supplierShares,
          });
          successCount++;
        } catch (error) {
          failCount++;
          console.error(`Failed to update ${materialCode}:`, error);
        }
      }

      if (successCount > 0) {
        toast.success(`成功应用到 ${successCount} 个物料`);
        utils.mapping.list.invalidate();
        onSuccess?.();
        onOpenChange(false);
      }

      if (failCount > 0) {
        toast.error(`${failCount} 个物料应用失败`);
      }
    } catch (error) {
      toast.error('批量应用失败');
    } finally {
      setProcessing(false);
    }
  };

  const applyAvgShare = () => {
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
    toast.success('已应用平均份额');
  };

  const totalShare = supplierShares.reduce((sum, s) => sum + s.sharePercentage, 0);
  const isValidTotal = Math.abs(totalShare - 100) < 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量份额分配</DialogTitle>
          <DialogDescription>
            选择多个物料，一次性应用相同的份额分配方案
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* 左侧：物料选择 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">选择物料</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={selectAll}>
                  全选
                </Button>
                <Button size="sm" variant="outline" onClick={clearAll}>
                  清空
                </Button>
              </div>
            </div>

            <div className="border rounded-lg p-3 max-h-96 overflow-y-auto space-y-2">
              {materials.map((material) => (
                <div key={material.code} className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedMaterials.has(material.code)}
                    onCheckedChange={() => toggleMaterial(material.code)}
                  />
                  <span className="text-sm">
                    {material.code} {material.name && `- ${material.name}`}
                  </span>
                </div>
              ))}
            </div>

            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                已选择 {selectedMaterials.size} 个物料
              </AlertDescription>
            </Alert>
          </div>

          {/* 右侧：份额配置 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">配置份额</Label>
              <Button size="sm" variant="outline" onClick={applyAvgShare}>
                平均分配
              </Button>
            </div>

            <div className="space-y-2">
              {supplierShares.map((share, index) => (
                <div key={index} className="flex gap-2 items-end p-2 border rounded-lg">
                  <div className="flex-1">
                    <Label className="text-xs">供应商</Label>
                    <Select
                      value={share.supplierId.toString()}
                      onValueChange={(value) => updateSupplier(index, 'supplierId', parseInt(value))}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="选择" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers?.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id.toString()}>
                            {supplier.supplierName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-24">
                    <Label className="text-xs">份额(%)</Label>
                    <Input
                      className="h-8"
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
                    className="h-8 w-8"
                    onClick={() => removeSupplier(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            <Button onClick={addSupplier} variant="outline" size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              添加供应商
            </Button>

            <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
              <span className="text-sm">份额总和:</span>
              <span className={`text-lg font-bold ${isValidTotal ? 'text-green-600' : 'text-red-600'}`}>
                {totalShare.toFixed(2)}%
              </span>
            </div>

            {!isValidTotal && supplierShares.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  份额总和必须为100%
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button 
            onClick={handleBatchApply} 
            disabled={processing || !isValidTotal || selectedMaterials.size === 0}
          >
            {processing ? '应用中...' : `应用到 ${selectedMaterials.size} 个物料`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
