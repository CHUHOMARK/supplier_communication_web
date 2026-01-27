import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Download, FileText, Eye, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function EmailGeneration() {
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [previewEmail, setPreviewEmail] = useState<{ subject: string; body: string } | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");

  const { data: plans, isLoading: plansLoading } = trpc.materialPlan.list.useQuery();
  const { data: generatedEmails, isLoading: emailsLoading } = trpc.email.getByPlanId.useQuery(
    { planId: Number(selectedPlanId) },
    { enabled: !!selectedPlanId }
  );

  const utils = trpc.useUtils();

  const generateEmailsMutation = trpc.email.generateAll.useMutation({
    onSuccess: (data) => {
      toast.success(`成功生成 ${data.emailCount} 封邮件`);
      utils.email.getByPlanId.invalidate({ planId: Number(selectedPlanId) });
    },
    onError: (error) => {
      toast.error(`生成失败：${error.message}`);
    },
  });

  const { data: csvData, refetch: refetchCSV } = trpc.email.exportCSV.useQuery(
    { planId: Number(selectedPlanId) },
    { enabled: false }
  );

  const sendEmailMutation = trpc.email.send.useMutation({
    onSuccess: () => {
      toast.success('邮件发送成功');
    },
    onError: (error) => {
      toast.error(`发送失败：${error.message}`);
    },
  });

  const batchSendMutation = trpc.email.batchSend.useMutation({
    onSuccess: (data) => {
      toast.success(`成功发送 ${data.succeeded} 封邮件${data.failed > 0 ? `，失败 ${data.failed} 封` : ''}`);
      utils.email.getByPlanId.invalidate({ planId: Number(selectedPlanId) });
    },
    onError: (error) => {
      toast.error(`批量发送失败：${error.message}`);
    },
  });

  const handleGenerateEmails = () => {
    if (!selectedPlanId) {
      toast.error('请先选择物料计划');
      return;
    }
    generateEmailsMutation.mutate({ planId: Number(selectedPlanId) });
  };

  const handlePreview = (email: { emailSubject: string; emailBody: string }) => {
    setPreviewEmail({ subject: email.emailSubject, body: email.emailBody });
    setEditedSubject(email.emailSubject);
    setEditedBody(email.emailBody);
    setPreviewDialogOpen(true);
  };

  const handleDownloadTxt = (email: any) => {
    const content = `主题：${email.emailSubject}\n\n${email.emailBody}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${email.supplier?.supplierName || '邮件'}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('邮件已下载');
  };

  const handleDownloadAllTxt = () => {
    if (!generatedEmails || generatedEmails.length === 0) {
      toast.error('没有可下载的邮件');
      return;
    }

    generatedEmails.forEach((email) => {
      handleDownloadTxt(email);
    });
  };

  const handleBatchSendEmails = () => {
    if (!generatedEmails || generatedEmails.length === 0) {
      toast.error('没有可发送的邮件');
      return;
    }

    const emailsToSend = generatedEmails
      .filter(email => email.supplier?.email)
      .map(email => ({
        planId: selectedPlanId ? Number(selectedPlanId) : 0,
        supplierId: email.supplierId,
        recipientEmail: email.supplier!.email,
        subject: email.emailSubject,
        content: email.emailBody,
      }));

    if (emailsToSend.length === 0) {
      toast.error('没有供应商设置了邮箱');
      return;
    }

    batchSendMutation.mutate({ emails: emailsToSend });
  };

  const handleExportCSV = async () => {
    if (!selectedPlanId) {
      toast.error('请先选择物料计划');
      return;
    }

    const result = await refetchCSV();
    if (result.data) {
      const blob = new Blob(['\uFEFF' + result.data.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('CSV文件已下载');
    }
  };

  const selectedPlan = useMemo(() => {
    return plans?.find(p => p.id === Number(selectedPlanId));
  }, [plans, selectedPlanId]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            生成供应商邮件
          </CardTitle>
          <CardDescription>
            选择物料计划，系统将根据供应商映射关系自动生成个性化邮件
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="planSelect">选择物料计划</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger id="planSelect">
                <SelectValue placeholder="请选择物料计划" />
              </SelectTrigger>
              <SelectContent>
                {plansLoading ? (
                  <SelectItem value="loading" disabled>
                    加载中...
                  </SelectItem>
                ) : plans && plans.length > 0 ? (
                  plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id.toString()}>
                      {plan.fileName} ({plan.planStartDate} - {plan.planEndDate})
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="empty" disabled>
                    暂无物料计划
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedPlan && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-medium">已选计划信息</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>文件名：{selectedPlan.fileName}</p>
                <p>计划周期：{selectedPlan.planStartDate} 至 {selectedPlan.planEndDate}</p>
                <p>上传时间：{new Date(selectedPlan.uploadedAt).toLocaleString('zh-CN')}</p>
              </div>
            </div>
          )}

          <Button
            onClick={handleGenerateEmails}
            disabled={!selectedPlanId || generateEmailsMutation.isPending}
            className="w-full"
          >
            {generateEmailsMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                生成中...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                生成邮件
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {selectedPlanId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  已生成的邮件
                </CardTitle>
                <CardDescription>预览和导出邮件内容</CardDescription>
              </div>
              {generatedEmails && generatedEmails.length > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleDownloadAllTxt}>
                    <Download className="h-4 w-4 mr-2" />
                    下载全部TXT
                  </Button>
                  <Button size="sm" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    导出CSV
                  </Button>
                  <Button size="sm" onClick={handleBatchSendEmails} disabled={batchSendMutation.isPending}>
                    <Mail className="h-4 w-4 mr-2" />
                    {batchSendMutation.isPending ? '发送中...' : '全部发送'}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {emailsLoading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : generatedEmails && generatedEmails.length > 0 ? (
              <div className="space-y-3">
                {generatedEmails.map((email) => (
                  <div
                    key={email.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{email.supplier?.supplierName || '未知供应商'}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {email.supplier?.email || '未设置邮箱'}
                      </p>
                      <p className="text-sm text-primary mt-1">{email.emailSubject}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePreview(email)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        预览
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadTxt(email)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        下载
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!email.supplier?.email) {
                            toast.error('该供应商未设置邮箱，请先在供应商管理页面添加邮箱');
                            return;
                          }
                          // 发送邮件（后端会自动创建确认记录）
                          sendEmailMutation.mutate({
                            planId: Number(selectedPlanId),
                            supplierId: email.supplierId,
                            recipientEmail: email.supplier.email,
                            subject: email.emailSubject,
                            content: email.emailBody,
                          });
                        }}
                        disabled={!email.supplier?.email || sendEmailMutation.isPending}
                        title={!email.supplier?.email ? '该供应商未设置邮箱' : ''}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        {!email.supplier?.email ? '未设置邮箱' : '发送'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                <AlertCircle className="h-8 w-8" />
                <p>暂无生成的邮件，请先点击"生成邮件"按钮</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="w-screen h-screen max-w-none overflow-hidden flex flex-col rounded-none">
          <DialogHeader>
            <DialogTitle>邮件预览与编辑</DialogTitle>
            <DialogDescription>查看和编辑邮件内容，修改后可复制使用</DialogDescription>
          </DialogHeader>
          {previewEmail && (
            <div className="space-y-4 flex-1 overflow-y-auto pr-2">
              <div>
                <Label className="text-sm font-medium">主题</Label>
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className="mt-1 w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">正文</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(editedBody);
                        toast.success('已复制到剪贴板');
                      }}
                    >
                      复制正文
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditedSubject(previewEmail.subject);
                        setEditedBody(previewEmail.body);
                        toast.success('已重置为原始内容');
                      }}
                    >
                      重置
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 flex-1" style={{ minHeight: '500px' }}>
                  <div className="flex flex-col">
                    <Label className="text-xs text-muted-foreground mb-2">编辑区</Label>
                    <textarea
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      className="flex-1 p-3 border rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      style={{ minHeight: '450px' }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <Label className="text-xs text-muted-foreground mb-2">预览区</Label>
                    <div className="flex-1 p-4 border rounded-md bg-muted overflow-y-auto prose prose-sm max-w-none" style={{ minHeight: '450px' }}>
                      <Streamdown>{editedBody}</Streamdown>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
