import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, XCircle, TrendingUp, AlertCircle } from "lucide-react";

interface SupplierDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierName: string;
  planId: number;
}

export function SupplierDetailsDialog({
  open,
  onOpenChange,
  supplierName,
  planId,
}: SupplierDetailsDialogProps) {
  const { data: details, isLoading } = trpc.erp.getSupplierDetails.useQuery(
    { planId, supplierName },
    { enabled: open && !!planId && !!supplierName }
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'on_time':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            准时
          </Badge>
        );
      case 'late':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="w-3 h-3 mr-1" />
            逾期
          </Badge>
        );
      case 'early':
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <TrendingUp className="w-3 h-3 mr-1" />
            提前
          </Badge>
        );
      case 'no_delivery':
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            <AlertCircle className="w-3 h-3 mr-1" />
            未到货
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatDelayDays = (days: number | null) => {
    if (days === null) return '-';
    if (days === 0) return '准时';
    if (days > 0) return `+${days}天`;
    return `${days}天`;
  };

  // 统计数据
  const stats = details ? {
    total: details.length,
    onTime: details.filter(d => d.status === 'on_time' || d.status === 'early').length,
    late: details.filter(d => d.status === 'late').length,
    noDelivery: details.filter(d => d.status === 'no_delivery').length,
  } : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {supplierName} - 交付详情
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {!isLoading && details && (
          <div className="space-y-4">
            {/* 统计卡片 */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">总计划数</div>
                <div className="text-2xl font-bold">{stats?.total}</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-green-600">准时/提前</div>
                <div className="text-2xl font-bold text-green-700">{stats?.onTime}</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-sm text-red-600">逾期</div>
                <div className="text-2xl font-bold text-red-700">{stats?.late}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">未到货</div>
                <div className="text-2xl font-bold text-gray-700">{stats?.noDelivery}</div>
              </div>
            </div>

            {/* 详情表格 */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>物料代码</TableHead>
                    <TableHead>物料名称</TableHead>
                    <TableHead>计划日期</TableHead>
                    <TableHead>计划数量</TableHead>
                    <TableHead>实际日期</TableHead>
                    <TableHead>实际数量</TableHead>
                    <TableHead>差异天数</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.map((detail, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">{detail.materialCode}</TableCell>
                      <TableCell>{detail.materialName}</TableCell>
                      <TableCell>{detail.promisedDate}</TableCell>
                      <TableCell>{detail.promisedQuantity.toLocaleString()}</TableCell>
                      <TableCell>{detail.actualDate || '-'}</TableCell>
                      <TableCell>{detail.actualQuantity?.toLocaleString() || '-'}</TableCell>
                      <TableCell className={
                        detail.delayDays === null ? '' :
                        detail.delayDays > 0 ? 'text-red-600 font-semibold' :
                        detail.delayDays < 0 ? 'text-blue-600 font-semibold' :
                        'text-green-600 font-semibold'
                      }>
                        {formatDelayDays(detail.delayDays)}
                      </TableCell>
                      <TableCell>{getStatusBadge(detail.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {!isLoading && (!details || details.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            暂无交付记录
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
