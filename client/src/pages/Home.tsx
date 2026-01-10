import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Users, Mail, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import MaterialPlanUpload from "@/components/MaterialPlanUpload";
import SupplierManagement from "@/components/SupplierManagement";
import EmailGeneration from "@/components/EmailGeneration";

export default function Home() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("upload");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">供应商物料计划沟通工具</CardTitle>
            <CardDescription>
              高效管理物料计划，自动生成供应商通知邮件
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                <span>Excel上传解析</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span>供应商管理</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <span>邮件自动生成</span>
              </div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span>批量导出</span>
              </div>
            </div>
            <Button className="w-full" size="lg" asChild>
              <a href={getLoginUrl()}>登录开始使用</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">供应商物料计划沟通工具</h1>
            <p className="text-sm text-muted-foreground">一站式物料计划邮件生成与分发平台</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">欢迎，{user.name || user.email}</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">上传物料计划</span>
              <span className="sm:hidden">上传</span>
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">供应商管理</span>
              <span className="sm:hidden">供应商</span>
            </TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">生成邮件</span>
              <span className="sm:hidden">邮件</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <MaterialPlanUpload onUploadSuccess={() => setActiveTab("suppliers")} />
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-4">
            <SupplierManagement onMappingComplete={() => setActiveTab("emails")} />
          </TabsContent>

          <TabsContent value="emails" className="space-y-4">
            <EmailGeneration />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
