import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import MaterialPlanUpload from "@/components/MaterialPlanUpload";
import { ArrowLeft, Upload, LogOut, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import { NotificationCenter } from "@/components/NotificationCenter";

export default function UploadPlan() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const handleUploadSuccess = () => {
    // 上传成功后跳转到供应商管理页面
    setLocation("/suppliers");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* 顶部导航栏 */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回仪表盘
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <Upload className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">上传物料计划</h1>
                <p className="text-sm text-gray-500">上传Excel文件，系统将自动解析物料信息和计划周期</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <NotificationCenter />
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4" />
              <span>{user?.name || user?.username}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              登出
            </Button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <MaterialPlanUpload onUploadSuccess={handleUploadSuccess} />
          
          {/* 帮助信息 */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>使用说明</CardTitle>
              <CardDescription>如何准备和上传物料计划Excel文件</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Excel文件格式要求：</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>第一列：物料编码（Material Code）</li>
                  <li>第二列：物料描述（Description）</li>
                  <li>第三列及之后：各周期的需求数量（日期格式：YYYY-MM-DD）</li>
                  <li>第一行为表头，包含列名</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">上传后系统将：</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>自动解析物料信息和计划周期</li>
                  <li>创建物料计划记录</li>
                  <li>引导您进行供应商映射配置</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
