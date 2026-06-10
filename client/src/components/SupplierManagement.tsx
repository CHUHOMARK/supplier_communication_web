import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Upload, Download, CheckCircle, AlertCircle, Trash2, KeyRound, Copy, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountResult, setAccountResult] = useState<{ supplierCode: string; pinCode: string; supplierName: string } | null>(null);

  const createAccountMutation = trpc.supplierAccountAdmin.create.useMutation({
    onSuccess: (data) => {
      setAccountResult({ supplierCode: data.supplierCode, pinCode: data.pinCode, supplierName: data.supplierName });
      setAccountDialogOpen(true);
      toast.success('供应商账号创建成功');
      utils.supplier.list.invalidate();
      utils.supplierAccountAdmin.list.invalidate();
    },
    onError: (error) => {
      toast.error(`创建账号失败：${error.message}`);
    },
  });

  const { data: supplierAccounts } = trpc.supplierAccountAdmin.list.useQuery();

  const resetPinMutation = trpc.supplierAccountAdmin.resetPin.useMutation({
    onSuccess: () => {
      toast.success('PIN码已重置为默认值 888888');
    },
    onError: (error: any) => {
      toast.error(`重置失败：${error.message}`);
    },
  });

  const handleCreateAccount = (supplierId: number, supplierName: string) => {
    createAccountMutation.mutate({ supplierId, supplierName });
  };

  const handleResetPin = (supplierId: number, name: string) => {
    const accountRecord = supplierAccounts?.find((a) => a.account.supplierId === supplierId);
    if (!accountRecord) {
      toast.error('未找到该供应商的账号');
      return;
    }
    if (confirm(`确定要重置供应商"${name}"的PIN码为默认值 888888 吗？`)) {
      resetPinMutation.mutate({ accountId: accountRecord.account.id });
    }
  };

  const handleCopyCredentials = () => {
    if (accountResult) {
      const text = `供应商登录凭证\n供应商名称：${accountResult.supplierName}\n供应商编号：${accountResult.supplierCode}\n默认PIN码：${accountResult.pinCode}\n登录地址：${window.location.origin}/supplier-login`;
      navigator.clipboard.writeText(text);
      toast.success('登录凭证已复制到剪贴板');
    }
  };

  const deleteSupplierMutation = trpc.supplier.delete.useMutation({
    onSuccess: () => {
      toast.success('供应商删除成功');
      utils.supplier.list.invalidate();
    },
    onError: (error) => {
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

  const importEmailsMutation = trpc.supplier.importEmails.useMutation({
    onSuccess: (data) => {
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
    },
    onError: (error) => {
      toast.error(`导入失败：${error.message}`);
    },
  });

  const handleEmailImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      toast.error('请上传Excel文件（.xlsx或.xls格式）');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const fileBase64 = base64.split(',')[1];
        importEmailsMutation.mutate({ fileBase64, filename: selectedFile.name });
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

  return (
    <div className="space-y-4">
      {/* 物料计划选择 */}
      <Card>
        <CardHeader>
          <CardTitle>选择物料计划</CardTitle>
          <CardDescription></CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedPlanId.toString()} onValueChange={(v) => setSelectedPlanId(Number(v))}>
            <SelectTrigger>
              <SelectValue placeholder="选择物料计划" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">所有计划</SelectItem>
              {plans?.map(plan => (
                <SelectItem key={plan.id} value={plan.id.toString()}>
                  {plan.fileName} ({plan.planStartDate} ~ {plan.planEndDate})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 供应商列表 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              供应商管理
            </CardTitle>
            <CardDescription>管理供应商信息和登录账号</CardDescription>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                新增供应商
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增供应商</DialogTitle>
                <DialogDescription>填写供应商基本信息</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="supplierName">供应商名称 *</Label>
                  <Input
                    id="supplierName"
                    value={newSupplier.supplierName}
                    onChange={(e) => setNewSupplier({ ...newSupplier, supplierName: e.target.value })}
                    placeholder="请输入供应商名称"
                  />
                </div>
                <div>
                  <Label htmlFor="contactPerson">联系人</Label>
                  <Input
                    id="contactPerson"
                    value={newSupplier.contactPerson}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                    placeholder="请输入联系人"
                  />
                </div>
                <div>
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    placeholder="请输入邮箱"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">电话</Label>
                  <Input
                    id="phone"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    placeholder="请输入电话"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>取消</Button>
                <Button onClick={handleCreateSupplier} disabled={createSupplierMutation.isPending}>
                  {createSupplierMutation.isPending ? '创建中...' : '创建'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadEmailTemplate} className="gap-2">
              <Download className="w-4 h-4" />
              下载邮箱导入模板
            </Button>
            <Button variant="outline" size="sm" onClick={() => emailImportInputRef.current?.click()} className="gap-2">
              <Upload className="w-4 h-4" />
              导入邮箱
            </Button>
            <input
              ref={emailImportInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleEmailImportFileChange}
              className="hidden"
            />
          </div>

          {suppliersLoading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
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
                  {suppliers.map(supplier => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.supplierName}</TableCell>
                      <TableCell>{supplier.contactPerson || '-'}</TableCell>
                      <TableCell>
                        {editingEmailId === supplier.id ? (
                          <div className="flex gap-2">
                            <Input
                              value={editingEmailValue}
                              onChange={(e) => setEditingEmailValue(e.target.value)}
                              className="h-8"
                            />
                            <Button size="sm" onClick={() => handleSaveEmail(supplier.id)}>保存</Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEditEmail}>取消</Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{supplier.email || '-'}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartEditEmail(supplier.id, supplier.email || '')}
                            >
                              编辑
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{supplier.phone || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" className="gap-1">
                                <KeyRound className="w-4 h-4" />
                                创建账号
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>创建供应商账号</DialogTitle>
                                <DialogDescription>为 {supplier.supplierName} 创建登录账号</DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => {}}>取消</Button>
                                <Button onClick={() => {
                                  handleCreateAccount(supplier.id, supplier.supplierName);
                                  // 关闭对话框逻辑由mutation onSuccess处理
                                }}>
                                  创建
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Button size="sm" variant="outline" onClick={() => handleResetPin(supplier.id, supplier.supplierName)} className="gap-1">
                            <RotateCcw className="w-4 h-4" />
                            重置PIN码
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDeleteSupplier(supplier.id, supplier.supplierName)} className="gap-1 text-red-600">
                            <Trash2 className="w-4 h-4" />
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">暂无供应商数据</div>
          )}
        </CardContent>
      </Card>

      {/* 账号凭证展示对话框 */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>供应商账号创建成功</DialogTitle>
            <DialogDescription>请妥善保管以下登录凭证</DialogDescription>
          </DialogHeader>
          {accountResult && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                <div>
                  <Label className="text-sm text-gray-600">供应商名称</Label>
                  <p className="font-medium">{accountResult.supplierName}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">供应商编号</Label>
                  <p className="font-mono font-medium text-lg">{accountResult.supplierCode}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">默认PIN码</Label>
                  <p className="font-mono font-medium text-lg">{accountResult.pinCode}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">登录地址</Label>
                  <p className="text-sm text-blue-600">{window.location.origin}/supplier-login</p>
                </div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800">
                <p>⚠️ 供应商首次登录时需修改PIN码。建议通过邮件或微信发送这些凭证。</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleCopyCredentials} className="gap-2">
              <Copy className="w-4 h-4" />
              复制凭证
            </Button>
            <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 采购订单导入 */}
      <PurchaseOrderImport />
    </div>
  );
}
