import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, CheckCircle, Mail, AlertTriangle, Info, Clock } from "lucide-react";

export default function SupplierMessages() {
  const { data, isLoading, refetch } = trpc.supplierPortal.getMessages.useQuery(undefined, {
    staleTime: 60 * 1000,
  });

  const markReadMutation = trpc.supplierPortal.markMessageAsRead.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const markAllReadMutation = trpc.supplierPortal.markAllMessagesAsRead.useMutation({
    onSuccess: () => {
      toast.success("已全部标记为已读");
      refetch();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">加载消息...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Bell className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="mt-4 text-gray-500">暂无消息通知</p>
        </CardContent>
      </Card>
    );
  }

  const unreadCount = data.filter((m: any) => !m.isRead).length;

  const getIcon = (type: string) => {
    switch (type) {
      case "new_plan": return <Mail className="w-4 h-4 text-blue-500" />;
      case "plan_update": return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case "reminder": return <Clock className="w-4 h-4 text-yellow-500" />;
      case "system": return <Info className="w-4 h-4 text-gray-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5" />
              消息通知
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">{unreadCount} 未读</Badge>
              )}
            </CardTitle>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                全部已读
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.map((message: any) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  message.isRead ? 'bg-white border-gray-100' : 'bg-blue-50/50 border-blue-100'
                }`}
                onClick={() => {
                  if (!message.isRead) {
                    markReadMutation.mutate({ messageId: message.id });
                  }
                }}
              >
                <div className="mt-0.5">{getIcon(message.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${message.isRead ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>
                      {message.title}
                    </p>
                    {!message.isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{message.content}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(message.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
