import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Download, CheckCircle, AlertCircle, Trash2, Edit2, X } from "lucide-react";
import PurchaseOrderImport from "@/components/PurchaseOrderImport";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface SupplierManagementProps {
  onMappingComplete?: () => void;
}

export default function SupplierManagement({ onMappingComplete }: SupplierManagementProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const emailImportInputRef = useRef<HTMLInputElement>(null);
  const [editingEmailId, setEditingEmailId] = useState<number | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState("");

  const [newSupplier, setNewSupplier] = useState({
    supplierName: "",
    contactPerson: "",
    email: "",
    phone: "",
  });

  const utils = trpc.useUtils();
  const { data: suppliers, isLoading: suppliersLoading } = trpc.supplier.list.useQuery();
  const { data: mappings, isLoading: mappingsLoading } = trpc.mapping.list.useQuery();

  const createSupplierMutation = trpc.supplier.create.useMutation({
    onSuccess: () => {
      toast.success('供应商创建成功');
      setAddDialogOpen(false);
      setNewSupplier({ supplierName: "", contactPerson: "", email: "", phone: "" });
      utils.supplier.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(`创建失败：${error.message}`);
    },
  });

  const deleteSupplierMutation = trpc.supplier.delete.useMutation({
    onSuccess: () => {
      toast.success('供应商删除成功');
      utils.supplier.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(`删除失败：${error.message}`);
    },
  });

  const updateSupplierEmailMutation = trpc.supplier.updateEmail.useMutation({
    onSuccess: () => {
      toast.success('邮箱更新成功');
      setEditingEmailId(null);
      setEditingEmailValue("");
      utils.supplier.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(`更新失败：${error.message}`);
    },
  });

  const handleStartEditEmail = (supplierId: number, currentEmail: string) => {
    setEditingEmailId(supplierId);
    setEditingEmailValue(currentEmail || "");
  };

  const handleSaveEmail = (supplierId: number) => {
    if (!editingEmailValue.trim()) {
      toast.error('邮箱不能为空');
      return;
    }
    updateSupplierEmailMutation.mutate({ id: supplierId, email: editingEmailValue });
  };

  const handleCancelEditEmail = () => {
    setEditingEmailId(null);
    setEditingEmailValue("");
  };

  const handleEmailImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleEmailImportFileChange called');
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      console.log('No file selected');
      return;
    }
    console.log('Selected file:', selectedFile.name);

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      toast.error('请上传Excel文件（.xlsx或.xls格式）');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const fileBase64 = base64.split(',')[1];

        try {
          console.log('Calling importEmails API with fileBase64 length:', fileBase64.length);
          const result = await fetch('/api/trpc/supplier.importEmails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              json: { fileBase64, filename: selectedFile.name }
            })
          }).then(res => res.json());
          console.log('API response:', result);

          if (result.result?.data) {
            const data = result.result.data;
            let message = `导入完成！\n总计: ${data.totalCount} 条\n成功: ${data.updatedCount} 个`;
            
            if (data.failedList && data.failedList.length > 0) {
              message += `\n未匹配: ${data.failedList.length} 个`;
              message += `\n\n未匹配的供应商:\n${data.failedList.join('\n')}`;
            }
            
            if (data.skippedList && data.skippedList.length > 0) {
              message += `\n跳过: ${data.skippedList.length} 条`;
            }
            
            if (data.updatedCount > 0) {
              toast.success(message, { duration: 8000 });
              utils.supplier.list.invalidate();
            } else {
              toast.warning(message, { duration: 8000 });
            }
          } else {
            throw new Error('导入失败');
          }
        } catch (error: any) {
          toast.error(`导入失败：${error.message}`);
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (error: any) {
      toast.error(`文件读取失败：${error.message}`);
    }

    // 清空文件输入，允许重复选择同一文件
    e.target.value = '';
  };

  const handleDeleteSupplier = (id: number, name: string) => {
    if (confirm(`确定要删除供应商"${name}"吗？这将同时删除相关的映射关系。`)) {
      deleteSupplierMutation.mutate({ id });
    }
  };

  const handleDownloadEmailTemplate = async () => {
    try {
      const result = await utils.supplier.downloadEmailTemplate.fetch();
      
      // 将Base64转换为Blob
      const byteCharacters = atob(result.fileBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('模板下载成功');
    } catch (error: any) {
      toast.error(`下载失败：${error.message}`);
    }
  };

  const handleCreateSupplier = () => {
    if (!newSupplier.supplierName.trim()) {
      toast.error('请输入供应商名称');
      return;
    }

    createSupplierMutation.mutate(newSupplier);
  };

  return (
    <div className="space-y-4">
      {/* 采购订单导入 */}
      <PurchaseOrderImport 
        onImportComplete={() => {
          utils.supplier.list.invalidate();
          utils.mapping.list.invalidate();
          onMappingComplete?.();
        }} 
      />

      {/* 供应商列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>供应商列表</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleDownloadEmailTemplate}>
                <Download className="h-4 w-4 mr-2" />
                下载模板
              </Button>
              <Button size="sm" onClick={() => document.getElementById('email-import-file')?.click()}>
                <AlertCircle className="h-4 w-4 mr-2" />
                批量导入邮箱
              </Button>
              <input
                ref={emailImportInputRef}
                id="email-import-file"
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={(e) => {
                  console.log('[onChange] Event triggered!', e.target.files);
                  handleEmailImportFileChange(e);
                }}
              />
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    添加供应商
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>添加新供应商</DialogTitle>
                    <DialogDescription>填写供应商基本信息</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>供应商名称 *</Label>
                      <Input
                        value={newSupplier.supplierName}
                        onChange={(e) => setNewSupplier({ ...newSupplier, supplierName: e.target.value })}
                        placeholder="请输入供应商名称"
                      />
                    </div>
                    <div>
                      <Label>联系人</Label>
                      <Input
                        value={newSupplier.contactPerson}
                        onChange={(e) => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                        placeholder="请输入联系人姓名"
                      />
                    </div>
                    <div>
                      <Label>邮箱</Label>
                      <Input
                        type="email"
                        value={newSupplier.email}
                        onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                        placeholder="请输入邮箱地址"
                      />
                    </div>
                    <div>
                      <Label>电话</Label>
                      <Input
                        value={newSupplier.phone}
                        onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                        placeholder="请输入联系电话"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={handleCreateSupplier}>
                      创建
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <CardDescription>
            管理供应商信息，支持单个添加或批量导入邮箱
          </CardDescription>
        </CardHeader>
        <CardContent>
          {suppliersLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-muted-foreground">加载中...</p>
            </div>
          ) : suppliers && suppliers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>供应商名称</TableHead>
                    <TableHead>联系人</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>电话</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.supplierName}</TableCell>
                      <TableCell>{supplier.contactPerson || '-'}</TableCell>
                      <TableCell>
                        {editingEmailId === supplier.id ? (
                          <div className="flex gap-2">
                            <Input
                              type="email"
                              value={editingEmailValue}
                              onChange={(e) => setEditingEmailValue(e.target.value)}
                              className="h-8 text-sm"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSaveEmail(supplier.id)}
                              className="h-8"
                            >
                              保存
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEditEmail}
                              className="h-8"
                            >
                              取消
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{supplier.email || '-'}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartEditEmail(supplier.id, supplier.email || '')}
                              className="h-6 w-6 p-0"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{supplier.phone || '-'}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteSupplier(supplier.id, supplier.supplierName)}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              暂无供应商，请添加或导入供应商信息
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
