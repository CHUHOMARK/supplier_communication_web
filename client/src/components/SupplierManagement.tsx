import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Upload, Download, CheckCircle, AlertCircle, Trash2, Key, Copy, Eye, EyeOff, Pencil, RotateCcw } from "lucide-react";
import PurchaseOrderImport from "@/components/PurchaseOrderImport";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface SupplierManagementProps {
  onMappingComplete?: () => void;
}

export default function SupplierManagement({ onMappingComplete }: SupplierManagementProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number>(0);
  const emailImportInputRef = useRef<HTMLInputElement>(null);
  const [editingEmailId, setEditingEmailId] = useState<number | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState("");

  const [newSupplier, setNewSupplier] = useState({
    supplierName: "",
    contactPerson: "",
    email: "",
    phone: "",
  });

  // Create supplier with login state
  const [createLoginOpen, setCreateLoginOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({
    supplierName: "",
    contactPerson: "",
    email: "",
    phone: "",
    notes: "",
    defaultPin: "",
  });
  const [createdCredentials, setCreatedCredentials] = useState<{
    supplierCode: string;
    defaultPin: string;
    supplierName: string;
  } | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // 编辑供应商状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<{
    id: number;
    supplierName: string;
    supplierCode: string;
    contactPerson: string;
    email: string;
    phone: string;
    notes: string;
    defaultPin: string;
  } | null>(null);
  const [showEditPin, setShowEditPin] = useState(false);

  const utils = trpc.useUtils();
  const { data: plans } = trpc.materialPlan.list.useQuery();
  const { data: suppliers, isLoading: suppliersLoading } = trpc.supplier.list.useQuery(
    selectedPlanId ? { planId: selectedPlanId } : undefined
  );
  const { data: mappings, isLoading: mappingsLoading } = trpc.mapping.list.useQuery();

  const createSupplierMutation = trpc.supplier.create.useMutation({
    onSuccess: () => {
      toast.success('供应商创建成功');
      setAddDialogOpen(false);
      setNewSupplier({ supplierName: "", contactPerson: "", email: "", phone: "" });
      utils.supplier.list.invalidate();
    },
    onError: (error) => {
      toast.error(`创建失败：${error.message}`);
    },
  });

  const deleteSupplierMutation = trpc.supplier.delete.useMutation({
    onSuccess: () => {
      toast.success('供应商删除成功');
      utils.supplier.list.invalidate();
    },
    onError: (error) => {
      toast.error(`删除失败：${error.message}`);
    },
  });

  const updateSupplierMutation = trpc.supplier.update.useMutation({
    onSuccess: () => {
      toast.success('供应商信息更新成功');
      setEditDialogOpen(false);
      setEditingSupplier(null);
      utils.supplier.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(`更新失败：${error.message}`);
    },
  });

  const handleEditSupplier = (supplier: any) => {
    setEditingSupplier({
      id: supplier.id,
      supplierName: supplier.supplierName || '',
      supplierCode: supplier.supplierCode || '',
      contactPerson: supplier.contactPerson || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      notes: supplier.notes || '',
      defaultPin: '',
    });
    setShowEditPin(false);
    setEditDialogOpen(true);
  };

  const handleSaveSupplier = () => {
    if (!editingSupplier) return;
    if (!editingSupplier.supplierName.trim()) {
      toast.error('供应商名称不能为空');
      return;
    }
    if (!editingSupplier.supplierCode.trim()) {
      toast.error('供应商编号不能为空');
      return;
    }
    if (editingSupplier.defaultPin && editingSupplier.defaultPin.length < 4) {
      toast.error('PIN码至少4位');
      return;
    }
    updateSupplierMutation.mutate({
      id: editingSupplier.id,
      supplierName: editingSupplier.supplierName.trim(),
      supplierCode: editingSupplier.supplierCode.trim(),
      contactPerson: editingSupplier.contactPerson.trim() || undefined,
      email: editingSupplier.email.trim() || undefined,
      phone: editingSupplier.phone.trim() || undefined,
      notes: editingSupplier.notes.trim() || undefined,
      defaultPin: editingSupplier.defaultPin.trim() || undefined,
    });
  };

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



  const handleCreateSupplier = () => {
    if (!newSupplier.supplierName.trim()) {
      toast.error('请输入供应商名称');
      return;
    }

    createSupplierMutation.mutate(newSupplier);
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

          if (result.error) {
            throw new Error(result.error?.json?.message || '导入失败');
          }

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
            throw new Error('导入失败：未知响应格式');
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

  // Create supplier with login mutation
  const createWithLoginMutation = trpc.supplier.createWithLogin.useMutation({
    onSuccess: (data) => {
      setCreatedCredentials({
        supplierCode: data.supplierCode,
        defaultPin: data.defaultPin,
        supplierName: loginForm.supplierName,
      });
      setShowPin(false);
      utils.supplier.list.invalidate();
    },
    onError: (error) => {
      toast.error(`创建失败：${error.message}`);
    },
  });

  const handleCreateWithLogin = () => {
    if (!loginForm.supplierName.trim()) {
      toast.error('请输入供应商名称');
      return;
    }
    createWithLoginMutation.mutate({
      supplierName: loginForm.supplierName.trim(),
      contactPerson: loginForm.contactPerson.trim() || undefined,
      email: loginForm.email.trim() || undefined,
      phone: loginForm.phone.trim() || undefined,
      notes: loginForm.notes.trim() || undefined,
      defaultPin: loginForm.defaultPin.trim() || undefined,
    });
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = `供应商登录信息\n名称：${createdCredentials.supplierName}\n编号：${createdCredentials.supplierCode}\nPIN码：${createdCredentials.defaultPin}\n\n登录地址：${window.location.origin}/supplier-login`;
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      toast.success('登录信息已复制到剪贴板');
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleResetLoginDialog = () => {
    setCreateLoginOpen(false);
    setCreatedCredentials(null);
    setLoginForm({ supplierName: "", contactPerson: "", email: "", phone: "", notes: "", defaultPin: "" });
  };

  return (
    <div className="space-y-4">
      {/* 物料计划选择 */}
      <Card>
        <CardHeader>
          <CardTitle>选择物料计划</CardTitle>
          <CardDescription>
            选择要导入供应商数据的物料计划
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Label>物料计划</Label>
          <Select value={selectedPlanId.toString()} onValueChange={(val) => setSelectedPlanId(Number(val))}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="选择物料计划" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">全局映射（不指定计划）</SelectItem>
              {plans?.map((plan) => (
                <SelectItem key={plan.id} value={plan.id.toString()}>
                  {plan.fileName} ({plan.planStartDate} 至 {plan.planEndDate})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 采购订单导入 */}
      {selectedPlanId > 0 && (
        <PurchaseOrderImport 
          planId={selectedPlanId}
          onImportComplete={() => {
            utils.supplier.list.invalidate();
            utils.mapping.list.invalidate();
            onMappingComplete?.();
          }} 
        />
      )}

      {/* 供应商列表（紧凑表格） */}
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
                <Upload className="h-4 w-4 mr-2" />
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
              <Button size="sm" variant="secondary" onClick={() => setCreateLoginOpen(true)}>
                <Key className="h-4 w-4 mr-2" />
                创建登录账号
              </Button>
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
                    确定
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {/* 创建登录账号对话框 */}
          <Dialog open={createLoginOpen} onOpenChange={handleResetLoginDialog}>
            <DialogContent className="max-w-lg">
              {!createdCredentials ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5 text-emerald-500" />
                      创建供应商登录账号
                    </DialogTitle>
                    <DialogDescription>
                      系统将自动生成供应商编号和默认PIN码，创建后可供供应商登录使用
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label>供应商名称 *</Label>
                        <Input
                          value={loginForm.supplierName}
                          onChange={(e) => setLoginForm({ ...loginForm, supplierName: e.target.value })}
                          placeholder="请输入供应商名称"
                        />
                      </div>
                      <div>
                        <Label>联系人</Label>
                        <Input
                          value={loginForm.contactPerson}
                          onChange={(e) => setLoginForm({ ...loginForm, contactPerson: e.target.value })}
                          placeholder="联系人姓名"
                        />
                      </div>
                      <div>
                        <Label>电话</Label>
                        <Input
                          value={loginForm.phone}
                          onChange={(e) => setLoginForm({ ...loginForm, phone: e.target.value })}
                          placeholder="联系电话"
                        />
                      </div>
                      <div>
                        <Label>邮箱</Label>
                        <Input
                          type="email"
                          value={loginForm.email}
                          onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                          placeholder="邮箱地址"
                        />
                      </div>
                      <div>
                        <Label>默认PIN码 <span className="text-xs text-muted-foreground">（可选，默认888888）</span></Label>
                        <Input
                          value={loginForm.defaultPin}
                          onChange={(e) => setLoginForm({ ...loginForm, defaultPin: e.target.value })}
                          placeholder="留空则使用默认值"
                          maxLength={20}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateLoginOpen(false)}>取消</Button>
                    <Button onClick={handleCreateWithLogin} disabled={createWithLoginMutation.isPending}>
                      {createWithLoginMutation.isPending ? '创建中...' : '创建并生成凭证'}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      登录账号创建成功
                    </DialogTitle>
                    <DialogDescription>
                      请将以下登录信息发送给供应商
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="rounded-lg border bg-emerald-50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">供应商名称</p>
                          <p className="font-medium">{createdCredentials.supplierName}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">供应商编号</p>
                          <p className="font-mono text-lg font-bold text-emerald-700">{createdCredentials.supplierCode}</p>
                        </div>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => navigator.clipboard.writeText(createdCredentials.supplierCode)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">默认PIN码</p>
                          <p className="font-mono text-lg font-bold text-emerald-700">
                            {showPin ? createdCredentials.defaultPin : '•'.repeat(createdCredentials.defaultPin.length)}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setShowPin(!showPin)}>
                            {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => navigator.clipboard.writeText(createdCredentials.defaultPin)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground bg-gray-50 rounded-lg p-3">
                      <p className="font-medium mb-1">供应商登录地址：</p>
                      <code className="text-blue-600">{window.location.origin}/supplier-login</code>
                    </div>
                    <div className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>供应商首次登录后将被强制修改PIN码，请提醒他们妥善保管</span>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleCopyCredentials}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      复制登录信息
                    </Button>
                    <Button onClick={handleResetLoginDialog}>关闭</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          <CardDescription>管理您的供应商信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 物料计划选择器 */}
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap">筛选计划：</Label>
            <Select
              value={selectedPlanId?.toString() || "all"}
              onValueChange={(value) => setSelectedPlanId(value === "all" ? 0 : Number(value) || 0)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="全部供应商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部供应商</SelectItem>
                {plans?.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id.toString()}>
                    {plan.fileName} ({plan.planStartDate} - {plan.planEndDate})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 供应商表格 */}
          <div>
          {suppliersLoading ? (
            <div className="flex items-center justify-center py-8">
              <AlertCircle className="h-6 w-6 animate-spin" />
            </div>
          ) : suppliers && suppliers.length > 0 ? (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>供应商名称</TableHead>
                    <TableHead>供应商编号</TableHead>
                    <TableHead>联系人</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>电话</TableHead>
                    <TableHead className="text-center">登录状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.supplierName}</TableCell>
                      <TableCell>
                        {supplier.supplierCode ? (
                          <span className="font-mono text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">{supplier.supplierCode}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>{supplier.contactPerson || '-'}</TableCell>
                      <TableCell>
                        {editingEmailId === supplier.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="email"
                              value={editingEmailValue}
                              onChange={(e) => setEditingEmailValue(e.target.value)}
                              className="h-8"
                              placeholder="请输入邮箱"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSaveEmail(supplier.id)}
                              disabled={updateSupplierEmailMutation.isPending}
                            >
                              保存
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEditEmail}
                            >
                              取消
                            </Button>
                          </div>
                        ) : (
                          <div 
                            className="cursor-pointer hover:text-primary"
                            onClick={() => handleStartEditEmail(supplier.id, supplier.email || '')}
                          >
                            {supplier.email || '点击添加邮箱'}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{supplier.phone || '-'}</TableCell>
                      <TableCell className="text-center">
                        {supplier.supplierCode ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            <CheckCircle className="h-3 w-3" /> 已启用
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">未开通</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditSupplier(supplier)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteSupplier(supplier.id, supplier.supplierName)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
              <AlertCircle className="h-8 w-8" />
              <p>暂无供应商，请先上传映射表或手动添加</p>
            </div>
          )}
          </div>
        </CardContent>
      </Card>

      {/* 编辑供应商对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditDialogOpen(false);
          setEditingSupplier(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑供应商</DialogTitle>
            <DialogDescription>修改供应商信息</DialogDescription>
          </DialogHeader>
          {editingSupplier && (
            <div className="space-y-4">
              <div>
                <Label>供应商名称 *</Label>
                <Input
                  value={editingSupplier.supplierName}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, supplierName: e.target.value })}
                  placeholder="请输入供应商名称"
                />
              </div>
              <div>
                <Label>供应商编号 *</Label>
                <Input
                  value={editingSupplier.supplierCode}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, supplierCode: e.target.value })}
                  placeholder="请输入供应商编号"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">供应商登录时使用此编号</p>
              </div>
              <div>
                <Label>默认PIN码 <span className="text-xs text-muted-foreground">（留空则不修改）</span></Label>
                <div className="flex gap-2">
                  <Input
                    type={showEditPin ? "text" : "password"}
                    value={editingSupplier.defaultPin}
                    onChange={(e) => setEditingSupplier({ ...editingSupplier, defaultPin: e.target.value })}
                    placeholder="至少4位"
                    className="font-mono"
                    maxLength={20}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowEditPin(!showEditPin)}
                  >
                    {showEditPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setEditingSupplier({ ...editingSupplier, defaultPin: '888888' })}
                    title="重置为默认值 888888"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">供应商登录时使用此PIN码</p>
              </div>
              <div>
                <Label>联系人</Label>
                <Input
                  value={editingSupplier.contactPerson}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, contactPerson: e.target.value })}
                  placeholder="请输入联系人姓名"
                />
              </div>
              <div>
                <Label>邮箱</Label>
                <Input
                  type="email"
                  value={editingSupplier.email}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                  placeholder="请输入邮箱地址"
                />
              </div>
              <div>
                <Label>电话</Label>
                <Input
                  value={editingSupplier.phone}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, phone: e.target.value })}
                  placeholder="请输入联系电话"
                />
              </div>
              <div>
                <Label>备注</Label>
                <Input
                  value={editingSupplier.notes}
                  onChange={(e) => setEditingSupplier({ ...editingSupplier, notes: e.target.value })}
                  placeholder="备注信息"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditDialogOpen(false);
              setEditingSupplier(null);
            }}>
              取消
            </Button>
            <Button onClick={handleSaveSupplier} disabled={updateSupplierMutation.isPending}>
              {updateSupplierMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
