import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, AlertCircle } from "lucide-react";
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

  const { data: suppliers } = trpc.supplier.list.useQuery();
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
    const newShares = [...supplierShares];
    newShares[index] = { ...newShares[index], [field]: value };
    setSupplierShares(newShares);
  };

  const totalShare = supplierShares.reduce((sum, s) => sum + s.sharePercentage, 0);
  const isValid = Math.abs(totalShare - 100) < 0.01 && supplierShares.every((s) => s.supplierId > 0);

  const handleSave = () => {
    if (!isValid) {
      toast.error('请确保所有供应商已选择，且份额总和为100%');
      return;
    }

    upsertMutation.mutate({
      materialCode,
      suppliers: supplierShares.map((s) => ({
        supplierId: s.supplierId,
        sharePercentage: s.sharePercentage,
        priority: s.priority,
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>供应商份额分配</DialogTitle>
          <DialogDescription>
            为物料 <strong>{materialCode}</strong> ({materialName}) 分配供应商份额
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {supplierShares.map((share, index) => (
            <div key={index} className="flex items-end gap-2 p-3 border rounded-lg">
              <div className="flex-1 space-y-2">
                <Label>供应商</Label>
                <Select
                  value={share.supplierId.toString()}
                  onValueChange={(value) => updateSupplier(index, "supplierId", parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择供应商" />
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

              <div className="w-32 space-y-2">
                <Label>份额 (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={share.sharePercentage}
                  onChange={(e) => updateSupplier(index, "sharePercentage", parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="w-24 space-y-2">
                <Label>优先级</Label>
                <Input
                  type="number"
                  min="1"
                  value={share.priority}
                  onChange={(e) => updateSupplier(index, "priority", parseInt(e.target.value) || 1)}
                />
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeSupplier(index)}
                className="mb-0"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}

          <Button variant="outline" onClick={addSupplier} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            添加供应商
          </Button>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="font-medium">份额总和：</span>
            <span
              className={`text-lg font-bold ${
                Math.abs(totalShare - 100) < 0.01 ? "text-green-600" : "text-red-600"
              }`}
            >
              {totalShare.toFixed(1)}%
            </span>
          </div>

          {Math.abs(totalShare - 100) >= 0.01 && supplierShares.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>份额总和必须为100%</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!isValid || upsertMutation.isPending}>
            {upsertMutation.isPending ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
