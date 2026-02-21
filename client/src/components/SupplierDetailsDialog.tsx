import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { VirtualSupplierDetailsTable } from "@/components/VirtualSupplierDetailsTable";

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

            {/* 详情表格 - 使用虚拟滚动 */}
            <VirtualSupplierDetailsTable details={details} />
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
