import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Upload, CheckCircle, AlertCircle, Trash2, Edit, Percent } from "lucide-react";
import ShareAllocationDialog from "@/components/ShareAllocationDialog";
import PurchaseOrderImport from "@/components/PurchaseOrderImport";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface SupplierManagementProps {
  onMappingComplete?: () => void;
}

export default function SupplierManagement({ onMappingComplete }: SupplierManagementProps) {
  const [mappingFile, setMappingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<{ code: string; name: string } | null>(null);
  const [newSupplier, setNewSupplier] = useState({
    supplierName: "",
    contactPerson: "",
    email: "",
    phone: "",
  });

  const utils = trpc.useUtils();
  const { data: suppliers, isLoading: suppliersLoading } = trpc.supplier.list.useQuery();
  const { data: mappings, isLoading: mappingsLoading } = trpc.mapping.list.useQuery();

  const uploadMappingMutation = trpc.supplier.uploadMapping.useMutation({
    onSuccess: (data) => {
      toast.success(`映射上传成功！创建了 ${data.createdSuppliers} 个新供应商，${data.mappingCount} 条映射关系`);
      setMappingFile(null);
      utils.supplier.list.invalidate();
      utils.mapping.list.invalidate();
      onMappingComplete?.();
    },
    onError: (error) => {
      toast.error(`上传失败：${error.message}`);
    },
    onSettled: () => {
      setUploading(false);
    },
  });

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

  const handleMappingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast.error('请上传Excel文件（.xlsx或.xls格式）');
        return;
      }
      setMappingFile(selectedFile);
    }
  };

  const handleUploadMapping = async () => {
    if (!mappingFile) {
      toast.error('请选择文件');
      return;
    }

    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const fileBase64 = base64.split(',')[1];

        uploadMappingMutation.mutate({ fileBase64 });
      };
      reader.readAsDataURL(mappingFile);
    } catch (error) {
      toast.error('文件读取失败');
      setUploading(false);
    }
  };

  const handleCreateSupplier = () => {
    if (!newSupplier.supplierName.trim()) {
      toast.error('请输入供应商名称');
      return;
    }

    createSupplierMutation.mutate(newSupplier);
  };

  const handleDeleteSupplier = (id: number, name: string) => {
    if (confirm(`确定要删除供应商"${name}"吗？这将同时删除相关的映射关系。`)) {
      deleteSupplierMutation.mutate({ id });
    }
  };

  const handleEditShare = (materialCode: string, materialName: string) => {
    setSelectedMaterial({ code: materialCode, name: materialName });
    setShareDialogOpen(true);
  };

  // 按物料分组映射关系，并统计供应商数量
  const materialGroups = mappings?.reduce((acc, mapping) => {
    const key = mapping.materialCode;
    if (!acc[key]) {
      acc[key] = {
        materialCode: mapping.materialCode,
        materialName: mapping.materialCode, // 使用materialCode作为显示名称
        suppliers: [],
      };
    }
    acc[key].suppliers.push(mapping);
    return acc;
  }, {} as Record<string, { materialCode: string; materialName: string; suppliers: typeof mappings }>);

  // 只显示有多个供应商的物料
  const multiSupplierMaterials = Object.values(materialGroups || {}).filter(
    (group) => group.suppliers.length > 1
  );

  return (
    <div className="space-y-4">
      {/* 采购订单导入 */}
      <PurchaseOrderImport onImportComplete={() => {
        utils.supplier.list.invalidate();
        utils.mapping.list.invalidate();
        onMappingComplete?.();
      }} />

      {/* 供应商映射表上传 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            <CardTitle>上传供应商映射表</CardTitle>
          </div>
          <CardDescription>
            上传包含物料-供应商对应关系的Excel文件，系统将自动创建供应商并建立映射
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>选择Excel文件</Label>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleMappingFileChange}
              className="mt-1"
            />
            {mappingFile && (
              <p className="text-sm text-muted-foreground mt-1">
                选择文件: {mappingFile.name}
              </p>
            )}
          </div>

          <Button
            onClick={handleUploadMapping}
            disabled={!mappingFile || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <AlertCircle className="mr-2 h-4 w-4 animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                上传映射表
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 供应商列表（紧凑表格） */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>供应商列表</CardTitle>
            </div>
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
          <CardDescription>管理您的供应商信息</CardDescription>
        </CardHeader>
        <CardContent>
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
                    <TableHead>联系人</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>电话</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.supplierName}</TableCell>
                      <TableCell>{supplier.contactPerson || '-'}</TableCell>
                      <TableCell>{supplier.email || '-'}</TableCell>
                      <TableCell>{supplier.phone || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteSupplier(supplier.id, supplier.supplierName)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
        </CardContent>
      </Card>

      {/* 物料份额分配（仅显示多供应商物料） */}
      {multiSupplierMaterials.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              <CardTitle>物料份额分配</CardTitle>
            </div>
            <CardDescription>
              为有多个供应商的物料配置份额及优先级
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mappingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <AlertCircle className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>物料料号</TableHead>
                      <TableHead>物料名称</TableHead>
                      <TableHead>供应商数量</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {multiSupplierMaterials.map((group) => (
                      <TableRow key={group.materialCode}>
                        <TableCell className="font-medium">{group.materialCode}</TableCell>
                        <TableCell>{group.materialName}</TableCell>
                        <TableCell>{group.suppliers.length} 家</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditShare(group.materialCode, group.materialName)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            编辑份额
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 份额分配弹窗 */}
      {selectedMaterial && (
        <ShareAllocationDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          materialCode={selectedMaterial.code}
          materialName={selectedMaterial.name}
          onSuccess={() => {
            utils.mapping.list.invalidate();
            toast.success('份额分配已更新');
          }}
        />
      )}
    </div>
  );
}
