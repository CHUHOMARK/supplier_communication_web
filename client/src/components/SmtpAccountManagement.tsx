import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Check, Mail } from "lucide-react";

interface SmtpFormData {
  accountName: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  isDefault: boolean;
  isActive: boolean;
}

const defaultFormData: SmtpFormData = {
  accountName: "",
  smtpHost: "",
  smtpPort: 465,
  smtpSecure: true,
  smtpUser: "",
  smtpPassword: "",
  fromEmail: "",
  fromName: "",
  isDefault: false,
  isActive: true,
};

export function SmtpAccountManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<SmtpFormData>(defaultFormData);

  const utils = trpc.useUtils();
  const { data: accounts = [], isLoading } = trpc.smtp.list.useQuery();

  const createMutation = trpc.smtp.create.useMutation({
    onSuccess: () => {
      toast.success("SMTP账号已创建");
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      utils.smtp.list.invalidate();
    },
    onError: (error) => {
      toast.error(`创建失败：${error.message}`);
    },
  });

  const updateMutation = trpc.smtp.update.useMutation({
    onSuccess: () => {
      toast.success("SMTP账号已更新");
      setIsDialogOpen(false);
      setEditingId(null);
      setFormData(defaultFormData);
      utils.smtp.list.invalidate();
    },
    onError: (error) => {
      toast.error(`更新失败：${error.message}`);
    },
  });

  const deleteMutation = trpc.smtp.delete.useMutation({
    onSuccess: () => {
      toast.success("SMTP账号已删除");
      utils.smtp.list.invalidate();
    },
    onError: (error) => {
      toast.error(`删除失败：${error.message}`);
    },
  });

  const setDefaultMutation = trpc.smtp.setDefault.useMutation({
    onSuccess: () => {
      toast.success("已设置为默认账号");
      utils.smtp.list.invalidate();
    },
    onError: (error) => {
      toast.error(`设置失败：${error.message}`);
    },
  });

  const handleCreate = () => {
    setEditingId(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const handleEdit = (account: any) => {
    setEditingId(account.id);
    setFormData({
      accountName: account.accountName,
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      smtpSecure: account.smtpSecure,
      smtpUser: account.smtpUser,
      smtpPassword: "", // 不显示原密码
      fromEmail: account.fromEmail,
      fromName: account.fromName || "",
      isDefault: account.isDefault,
      isActive: account.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("确定要删除这个SMTP账号吗？")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleSetDefault = (id: number) => {
    setDefaultMutation.mutate({ id });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      const updateData: any = {
        id: editingId,
        accountName: formData.accountName,
        smtpHost: formData.smtpHost,
        smtpPort: formData.smtpPort,
        smtpSecure: formData.smtpSecure,
        smtpUser: formData.smtpUser,
        fromEmail: formData.fromEmail,
        fromName: formData.fromName,
        isDefault: formData.isDefault,
        isActive: formData.isActive,
      };
      // 只有在输入了新密码时才更新密码
      if (formData.smtpPassword) {
        updateData.smtpPassword = formData.smtpPassword;
      }
      updateMutation.mutate(updateData);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">SMTP邮箱配置</h2>
          <p className="text-muted-foreground">管理邮件发送账号</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          添加账号
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Mail className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>还没有配置SMTP账号</p>
          <p className="text-sm mt-2">点击"添加账号"按钮开始配置</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>账号名称</TableHead>
                <TableHead>SMTP服务器</TableHead>
                <TableHead>发件人</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account: any) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">
                    {account.accountName}
                    {account.isDefault && (
                      <Badge variant="secondary" className="ml-2">
                        默认
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {account.smtpHost}:{account.smtpPort}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{account.fromEmail}</span>
                      {account.fromName && (
                        <span className="text-xs text-muted-foreground">
                          {account.fromName}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={account.isActive ? "default" : "secondary"}>
                      {account.isActive ? "启用" : "禁用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!account.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(account.id)}
                          disabled={setDefaultMutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(account)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(account.id)}
                        disabled={deleteMutation.isPending}
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
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "编辑SMTP账号" : "添加SMTP账号"}
            </DialogTitle>
            <DialogDescription>
              配置邮件发送服务器信息
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountName">账号名称 *</Label>
                <Input
                  id="accountName"
                  value={formData.accountName}
                  onChange={(e) =>
                    setFormData({ ...formData, accountName: e.target.value })
                  }
                  placeholder="例如：公司邮箱"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fromEmail">发件人邮箱 *</Label>
                <Input
                  id="fromEmail"
                  type="email"
                  value={formData.fromEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, fromEmail: e.target.value })
                  }
                  placeholder="example@company.com"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fromName">发件人名称</Label>
                <Input
                  id="fromName"
                  value={formData.fromName}
                  onChange={(e) =>
                    setFormData({ ...formData, fromName: e.target.value })
                  }
                  placeholder="公司名称"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpHost">SMTP服务器 *</Label>
                <Input
                  id="smtpHost"
                  value={formData.smtpHost}
                  onChange={(e) =>
                    setFormData({ ...formData, smtpHost: e.target.value })
                  }
                  placeholder="smtp.example.com"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtpPort">SMTP端口 *</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  value={formData.smtpPort}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      smtpPort: parseInt(e.target.value) || 465,
                    })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpUser">SMTP用户名 *</Label>
                <Input
                  id="smtpUser"
                  value={formData.smtpUser}
                  onChange={(e) =>
                    setFormData({ ...formData, smtpUser: e.target.value })
                  }
                  placeholder="通常是邮箱地址"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtpPassword">
                SMTP密码 {editingId && "(留空表示不修改)"}
              </Label>
              <Input
                id="smtpPassword"
                type="password"
                value={formData.smtpPassword}
                onChange={(e) =>
                  setFormData({ ...formData, smtpPassword: e.target.value })
                }
                placeholder="邮箱密码或授权码"
                required={!editingId}
              />
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="smtpSecure"
                  checked={formData.smtpSecure}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, smtpSecure: checked })
                  }
                />
                <Label htmlFor="smtpSecure">使用SSL/TLS</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isDefault"
                  checked={formData.isDefault}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isDefault: checked })
                  }
                />
                <Label htmlFor="isDefault">设为默认账号</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked })
                  }
                />
                <Label htmlFor="isActive">启用</Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? "更新" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
