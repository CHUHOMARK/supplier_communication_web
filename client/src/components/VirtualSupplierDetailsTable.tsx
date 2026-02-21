import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, TrendingUp, AlertCircle } from 'lucide-react';

interface DetailRecord {
  materialCode: string;
  materialName: string;
  promisedDate: string;
  promisedQuantity: number;
  actualDate: string | null;
  actualQuantity: number | null;
  delayDays: number | null;
  status: 'on_time' | 'late' | 'early' | 'no_delivery';
}

interface VirtualSupplierDetailsTableProps {
  details: DetailRecord[];
}

export function VirtualSupplierDetailsTable({ details }: VirtualSupplierDetailsTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: details.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // 固定行高56px
    overscan: 5, // 预渲染5行
  });

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

  // 固定列宽（单位：px）
  const columnWidths = {
    materialCode: 140,
    materialName: 180,
    promisedDate: 110,
    promisedQuantity: 100,
    actualDate: 110,
    actualQuantity: 100,
    delayDays: 100,
    status: 110,
  };

  const totalWidth = Object.values(columnWidths).reduce((sum, width) => sum + width, 0);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* 表头 */}
      <div className="bg-gray-50 border-b overflow-hidden">
        <div className="flex text-sm font-medium text-gray-700" style={{ minWidth: `${totalWidth}px` }}>
          <div className="px-4 py-3 border-r" style={{ width: `${columnWidths.materialCode}px` }}>物料代码</div>
          <div className="px-4 py-3 border-r" style={{ width: `${columnWidths.materialName}px` }}>物料名称</div>
          <div className="px-4 py-3 border-r" style={{ width: `${columnWidths.promisedDate}px` }}>计划日期</div>
          <div className="px-4 py-3 border-r" style={{ width: `${columnWidths.promisedQuantity}px` }}>计划数量</div>
          <div className="px-4 py-3 border-r" style={{ width: `${columnWidths.actualDate}px` }}>实际日期</div>
          <div className="px-4 py-3 border-r" style={{ width: `${columnWidths.actualQuantity}px` }}>实际数量</div>
          <div className="px-4 py-3 border-r" style={{ width: `${columnWidths.delayDays}px` }}>差异天数</div>
          <div className="px-4 py-3" style={{ width: `${columnWidths.status}px` }}>状态</div>
        </div>
      </div>

      {/* 虚拟滚动容器 */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: '600px' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const detail = details[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                className="flex border-b hover:bg-gray-50 transition-colors"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  minWidth: `${totalWidth}px`,
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div 
                  className="px-4 py-3 font-mono text-sm flex items-center border-r truncate" 
                  style={{ width: `${columnWidths.materialCode}px` }}
                  title={detail.materialCode}
                >
                  {detail.materialCode}
                </div>
                <div 
                  className="px-4 py-3 flex items-center border-r truncate" 
                  style={{ width: `${columnWidths.materialName}px` }}
                  title={detail.materialName}
                >
                  {detail.materialName}
                </div>
                <div 
                  className="px-4 py-3 flex items-center border-r" 
                  style={{ width: `${columnWidths.promisedDate}px` }}
                >
                  {detail.promisedDate}
                </div>
                <div 
                  className="px-4 py-3 flex items-center border-r" 
                  style={{ width: `${columnWidths.promisedQuantity}px` }}
                >
                  {detail.promisedQuantity.toLocaleString()}
                </div>
                <div 
                  className="px-4 py-3 flex items-center border-r" 
                  style={{ width: `${columnWidths.actualDate}px` }}
                >
                  {detail.actualDate || '-'}
                </div>
                <div 
                  className="px-4 py-3 flex items-center border-r" 
                  style={{ width: `${columnWidths.actualQuantity}px` }}
                >
                  {detail.actualQuantity?.toLocaleString() || '-'}
                </div>
                <div
                  className={`px-4 py-3 flex items-center border-r ${
                    detail.delayDays === null ? '' :
                    detail.delayDays > 0 ? 'text-red-600 font-semibold' :
                    detail.delayDays < 0 ? 'text-blue-600 font-semibold' :
                    'text-green-600 font-semibold'
                  }`}
                  style={{ width: `${columnWidths.delayDays}px` }}
                >
                  {formatDelayDays(detail.delayDays)}
                </div>
                <div 
                  className="px-4 py-3 flex items-center" 
                  style={{ width: `${columnWidths.status}px` }}
                >
                  {getStatusBadge(detail.status)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
