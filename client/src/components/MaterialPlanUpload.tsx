import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface MaterialPlanUploadProps {
  onUploadSuccess?: () => void;
}

export default function MaterialPlanUpload({ onUploadSuccess }: MaterialPlanUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [uploading, setUploading] = useState(false);

  const utils = trpc.useUtils();
  const uploadMutation = trpc.materialPlan.upload.useMutation({
    onSuccess: (data) => {
      toast.success(`上传成功！解析了 ${data.itemCount} 个物料项`);
      setFile(null);
      setStartDate("");
      setEndDate("");
      utils.materialPlan.list.invalidate();
      onUploadSuccess?.();
    },
    onError: (error) => {
      toast.error(`上传失败：${error.message}`);
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const { data: plans, isLoading: plansLoading } = trpc.materialPlan.list.useQuery();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast.error('请上传Excel文件（.xlsx或.xls格式）');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('请选择文件');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('请选择计划周期');
      return;
    }

    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const fileBase64 = base64.split(',')[1];

        uploadMutation.mutate({
          fileName: file.name,
          fileBase64,
          planStartDate: startDate,
          planEndDate: endDate,
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('文件读取失败');
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            上传物料计划Excel文件
          </CardTitle>
          <CardDescription>
            支持.xlsx格式，系统将自动解析物料信息和到货计划
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">选择Excel文件</Label>
            <div className="flex gap-2">
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={uploading}
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {file.name}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">计划开始日期</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={uploading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">计划结束日期</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={uploading}
              />
            </div>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || !startDate || !endDate || uploading}
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
                上传并解析
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            已上传的物料计划
          </CardTitle>
        </CardHeader>
        <CardContent>
          {plansLoading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : plans && plans.length > 0 ? (
            <div className="space-y-2">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium">{plan.fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      计划周期：{plan.planStartDate} 至 {plan.planEndDate}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(plan.uploadedAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
              <AlertCircle className="h-8 w-8" />
              <p>暂无物料计划，请先上传</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
