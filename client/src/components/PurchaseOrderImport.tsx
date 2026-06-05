import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface PurchaseOrderImportProps {
  planId?: number;
  onImportComplete?: () => void;
}

export default function PurchaseOrderImport({ planId, onImportComplete }: PurchaseOrderImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [calculations, setCalculations] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({ orderCount: 0, materialCount: 0, supplierCount: 0 });

  const utils = trpc.useUtils();
  const parseAndCalculateMutation = trpc.purchaseOrder.parseAndCalculate.useMutation({
    onSuccess: (data) => {
      setCalculations(data.calculations);
      setSuppliers(data.suppliers);
      setRawOrders((data as any).rawOrders || []);
      setStats({
        orderCount: data.orderCount,
        materialCount: data.materialCount,
        supplierCount: data.supplierCount,
      });
      setPreviewDialogOpen(true);
      setUploading(false);
      toast.success('采购订单解析成功');
    },
    onError: (error) => {
      setUploading(false);
      toast.error(`解析失败：${error.message}`);
    },
  });

  const applyCalculationsMutation = trpc.purchaseOrder.applyCalculations.useMutation({
    onSuccess: (data) => {
      toast.success(`成功创建 ${data.createdSuppliers} 个供应商，${data.createdMappings} 个映射关系`);
      utils.supplier.list.invalidate();
      utils.mapping.list.invalidate();
      setPreviewDialogOpen(false);
      setFile(null);
      onImportComplete?.();
    },
    onError: (error) => {
      toast.error(`应用失败：${error.message}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast.error('请选择Excel文件（.xlsx或.xls格式）');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('请先选择文件');
      return;
    }

    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const fileContent = base64.split(',')[1];

        parseAndCalculateMutation.mutate({ fileContent });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setUploading(false);
      toast.error('文件读取失败');
    }
  };

  const handleApply = () => {
    applyCalculationsMutation.mutate({
      planId: planId || 0,
      calculations: calculations.map(c => ({
        materialCode: c.materialCode,
        materialName: c.materialName,
        suppliers: c.suppliers.map((s: any) => ({
          supplierName: s.supplierName,
          sharePercentage: s.sharePercentage,
        })),
      })),
      purchaseOrders: rawOrders,
      createMissingSuppliers: true,
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            上传采购订单
          </CardTitle>
          <CardDescription>
            上传包含物料-供应商对应关系的采购订单Excel文件，系统将自动解析并建立映射
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={uploading}
            />
            {file && (
              <p className="text-sm text-muted-foreground mt-2">
                已选择文件: {file.name}
              </p>
            )}
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Upload className="h-4 w-4 mr-2 animate-spin" />
                解析中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                上传并解析
              </>
            )}
          </Button>

          <div className="text-sm text-muted-foreground space-y-1 p-3 bg-muted rounded-lg">
            <p className="font-medium">说明：</p>
            <ul className="list-disc list-inside space-y-1">
              <li>系统将自动识别料号、供应商和采购数量</li>
              <li>根据历史采购数据计算每个供应商的份额百分比</li>
              <li>自动创建缺失的供应商信息</li>
              <li>生成物料-供应商映射关系</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>采购订单解析结果</DialogTitle>
            <DialogDescription>
              请确认以下解析结果，点击"应用"将创建供应商和映射关系
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 统计信息 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">采购订单行数</span>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold mt-2">{stats.orderCount}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">物料数量</span>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold mt-2">{stats.materialCount}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">供应商数量</span>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold mt-2">{stats.supplierCount}</p>
              </div>
            </div>

            {/* 份额计算结果 */}
            <div className="space-y-2">
              <h3 className="font-medium">物料份额分配详情</h3>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {calculations.slice(0, 20).map((calc) => (
                  <div key={calc.materialCode} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{calc.materialCode}</p>
                        <p className="text-sm text-muted-foreground">{calc.materialName}</p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        总采购量: {calc.totalQuantity}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {calc.suppliers.map((supplier: any) => (
                        <div key={supplier.supplierName} className="flex items-center justify-between text-sm">
                          <span>{supplier.supplierName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {supplier.totalQuantity} 个
                            </span>
                            <span className="font-medium text-primary">
                              {supplier.sharePercentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {calculations.length > 20 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    还有 {calculations.length - 20} 个物料未显示...
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleApply} disabled={applyCalculationsMutation.isPending}>
              {applyCalculationsMutation.isPending ? "应用中..." : "应用"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
