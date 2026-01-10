import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Plus, Upload, CheckCircle, AlertCircle, Trash2, Edit, Percent } from "lucide-react";
import ShareAllocationDialog from "@/components/ShareAllocationDialog";
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

  const handleAddSupplier = () => {
    if (!newSupplier.supplierName) {
      toast.error('请输入供应商名称');
      return;
    }
    createSupplierMutation.mutate(newSupplier);
  };

  const handleDeleteSupplier = (id: number) => {
    if (confirm('确定要删除这个供应商吗？')) {
      deleteSupplierMutation.mutate({ id });
    }
  };

  const getMappingCount = (supplierId: number) => {
    return mappings?.filter(m => m.supplierId === supplierId).length || 0;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            上传供应商映射表
          </CardTitle>
          <CardDescription>
            上传包含物料-供应商对应关系的Excel文件，系统将自动创建供应商并建立映射
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mappingFile">选择Excel文件</Label>
            <div className="flex gap-2">
              <Input
                id="mappingFile"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleMappingFileChange}
                disabled={uploading}
              />
              {mappingFile && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {mappingFile.name}
                </div>
              )}
            </div>
          </div>

          <Button
            onClick={handleUploadMapping}
            disabled={!mappingFile || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                上传中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                上传映射表
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                供应商列表
              </CardTitle>
              <CardDescription>管理您的供应商信息</CardDescription>
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
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplierName">供应商名称 *</Label>
                    <Input
                      id="supplierName"
                      value={newSupplier.supplierName}
                      onChange={(e) => setNewSupplier({ ...newSupplier, supplierName: e.target.value })}
                      placeholder="请输入供应商名称"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">联系人</Label>
                    <Input
                      id="contactPerson"
                      value={newSupplier.contactPerson}
                      onChange={(e) => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                      placeholder="请输入联系人姓名"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">邮箱</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newSupplier.email}
                      onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                      placeholder="请输入邮箱地址"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">电话</Label>
                    <Input
                      id="phone"
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
                  <Button onClick={handleAddSupplier}>
                    确定
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {suppliersLoading || mappingsLoading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : suppliers && suppliers.length > 0 ? (
            <div className="space-y-2">
              {suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{supplier.supplierName}</p>
                    <div className="text-sm text-muted-foreground space-y-1 mt-1">
                      {supplier.contactPerson && <p>联系人：{supplier.contactPerson}</p>}
                      {supplier.email && <p>邮箱：{supplier.email}</p>}
                      {supplier.phone && <p>电话：{supplier.phone}</p>}
                      <p className="text-primary">已映射物料：{getMappingCount(supplier.id)} 个</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSupplier(supplier.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
              <AlertCircle className="h-8 w-8" />
              <p>暂无供应商，请先上传映射表或手动添加</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            物料份额分配
          </CardTitle>
          <CardDescription>为每个物料分配多个供应商及其份额</CardDescription>
        </CardHeader>
        <CardContent>
          {mappingsLoading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : mappings && mappings.length > 0 ? (
            <div className="space-y-2">
              {/* 按物料分组显示 */}
              {Array.from(
                mappings.reduce((map, m) => {
                  if (!map.has(m.materialCode)) {
                    map.set(m.materialCode, []);
                  }
                  map.get(m.materialCode)!.push(m);
                  return map;
                }, new Map<string, typeof mappings>())
              ).map(([materialCode, materialMappings]) => (
                <div
                  key={materialCode}
                  className="p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{materialCode}</p>
                      <p className="text-sm text-muted-foreground">
                        {materialMappings.length} 个供应商
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedMaterial({ code: materialCode, name: materialCode });
                        setShareDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      编辑份额
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {materialMappings.map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-sm">
                        <span>{m.supplier?.supplierName || '未知供应商'}</span>
                        <span className="font-medium text-primary">
                          {parseFloat(m.sharePercentage || "100").toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
              <AlertCircle className="h-8 w-8" />
              <p>暂无映射，请先上传映射表</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedMaterial && (
        <ShareAllocationDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          materialCode={selectedMaterial.code}
          materialName={selectedMaterial.name}
          onSuccess={() => {
            utils.mapping.list.invalidate();
          }}
        />
      )}
    </div>
  );
}
