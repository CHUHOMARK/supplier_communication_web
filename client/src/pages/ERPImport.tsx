import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { NotificationCenter } from "@/components/NotificationCenter";

/**
 * ERP实际到货导入页面
 */
export default function ERPImport() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number } | null>(null);

  const { data: receipts, isLoading, refetch } = trpc.erp.getReceipts.useQuery();
  const importMutation = trpc.erp.importData.useMutation();
  const deleteMutation = trpc.erp.deleteReceipt.useMutation();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert("文件格式错误：请上传Excel文件（.xlsx或.xls格式）");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // 读取文件并转换为Base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          const fileContent = base64.split(',')[1]; // 移除data:application/...;base64,前缀

          // 调用API导入数据
          const result = await importMutation.mutateAsync({ fileContent });

          clearInterval(progressInterval);
          setUploadProgress(100);

          // 显示成功对话框
          setImportResult(result);
          setShowSuccessDialog(true);

          // 刷新列表
          refetch();

          // Success handled by dialog
        } catch (error: any) {
          clearInterval(progressInterval);
          alert(`导入失败：${error.message || "解析Excel文件失败，请检查文件格式"}`);
        } finally {
          setUploading(false);
          setUploadProgress(0);
          // 清空input
          event.target.value = '';
        }
      };

      reader.onerror = () => {
        clearInterval(progressInterval);
        setUploading(false);
        setUploadProgress(0);
        alert("读取文件失败：无法读取文件内容");
      };

      reader.readAsDataURL(file);
    } catch (error: any) {
      setUploading(false);
      setUploadProgress(0);
      alert(`上传失败：${error.message || "上传过程中出现错误"}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这条到货记录吗？")) return;

    try {
      await deleteMutation.mutateAsync({ id });
      alert("删除成功");
      refetch();
    } catch (error: any) {
      alert(`删除失败：${error.message || "删除记录时出现错误"}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">ERP实际到货导入</h1>
              <p className="text-gray-600">导入ERP系统的实际到货数据，用于对比供应商承诺交期</p>
            </div>
            <div className="flex items-center gap-2">
              <NotificationCenter />
              <Link href="/dashboard">
                <Button variant="outline">返回仪表盘</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-8">
        {/* 上传卡片 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>上传ERP到货数据</CardTitle>
            <CardDescription>
              上传包含"业务日期"、"料号"、"实收数量(计价单位)"列的Excel文件
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="flex-1"
                />
                <Button disabled={uploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  选择文件
                </Button>
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>上传并解析中...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Excel格式要求：
                </h4>
                <ul className="text-sm text-blue-800 space-y-1 ml-7">
                  <li>• <strong>必须包含列</strong>：业务日期、料号、实收数量(计价单位)</li>
                  <li>• <strong>业务日期格式</strong>：YYYY-MM-DD（如：2025-02-12）</li>
                  <li>• <strong>料号</strong>需与物料计划中的料号一致</li>
                  <li>• <strong>可选列</strong>：供应商名称</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 导入历史记录 */}
        <Card>
          <CardHeader>
            <CardTitle>导入历史记录</CardTitle>
            <CardDescription>
              共 {receipts?.length || 0} 条到货记录
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : receipts && receipts.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>料号</TableHead>
                      <TableHead>业务日期</TableHead>
                      <TableHead>实收数量</TableHead>
                      <TableHead>供应商</TableHead>
                      <TableHead>导入时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.map((receipt: any) => (
                      <TableRow key={receipt.id}>
                        <TableCell className="font-mono">{receipt.materialCode}</TableCell>
                        <TableCell>{receipt.businessDate}</TableCell>
                        <TableCell>{parseFloat(receipt.actualQuantity).toLocaleString()}</TableCell>
                        <TableCell>{receipt.supplierName || '-'}</TableCell>
                        <TableCell>
                          {new Date(receipt.createdAt).toLocaleString('zh-CN')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(receipt.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">暂无导入记录</p>
                <p className="text-sm text-gray-400 mt-2">请上传Excel文件开始导入</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 成功对话框 */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              导入成功
            </DialogTitle>
            <DialogDescription>
              Excel文件解析完成，数据已成功导入到系统
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-lg font-semibold text-green-900">
                匹配成功：{importResult?.count || 0} 条物料记录
              </p>
              <p className="text-sm text-green-700 mt-2">
                这些记录已添加到系统中，可以在"确认监控"页面查看与供应商承诺交期的对比
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSuccessDialog(false)}>
              关闭
            </Button>
            <Link href="/monitor">
              <Button>
                查看监控页面
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
