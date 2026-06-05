import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

type ProductionStatus = "not_started" | "material_prep" | "in_production" | "in_qc" | "ready_to_ship" | "shipped";

const PROD: { key: ProductionStatus; label: string }[] = [
  { key: "not_started", label: "未始" },
  { key: "material_prep", label: "备料" },
  { key: "in_production", label: "生产" },
  { key: "in_qc", label: "质检" },
  { key: "ready_to_ship", label: "待发" },
  { key: "shipped", label: "已发" },
];

const statusLabel: Record<string, { text: string; color: string }> = {
  pending: { text: "待确认", color: "bg-gray-100 text-gray-600" },
  confirmed: { text: "已确认", color: "bg-green-100 text-green-700" },
  partial: { text: "部分确认", color: "bg-yellow-100 text-yellow-700" },
  rejected: { text: "已拒绝", color: "bg-red-100 text-red-700" },
  modified: { text: "已修改", color: "bg-blue-100 text-blue-700" },
};

export default function ConfirmationMonitor() {
  const { user, logout } = useAuth();
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);
  const [expandedSupplier, setExpandedSupplier] = useState<number | null>(null);

  const { data: plans, isLoading } = trpc.materialPlan.list.useQuery();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/"><h1 className="text-sm font-bold cursor-pointer hover:opacity-80">📋 供应商确认监控</h1></Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{user?.name || user?.username}</span>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { logout(); window.location.href = "/login"; }}>登出</Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
        ) : plans && plans.length > 0 ? (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="w-6"></th>
                  <th className="text-left px-2 py-2 font-medium text-gray-500">计划名称</th>
                  <th className="text-left px-2 py-2 font-medium text-gray-500">周期</th>
                  <th className="text-center px-2 py-2 font-medium text-gray-500">供应商</th>
                  <th className="text-center px-2 py-2 font-medium text-gray-500">已确认</th>
                  <th className="text-center px-2 py-2 font-medium text-gray-500">待确认</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(plan => (
                  <PlanRow key={plan.id} plan={plan} expanded={expandedPlan === plan.id}
                    onToggle={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                    expandedSupplier={expandedSupplier}
                    onToggleSupplier={(id) => setExpandedSupplier(expandedSupplier === id ? null : id)} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">暂无物料计划</div>
        )}
      </div>
    </div>
  );
}

function PlanRow({ plan, expanded, onToggle, expandedSupplier, onToggleSupplier }: {
  plan: any; expanded: boolean; onToggle: () => void;
  expandedSupplier: number | null; onToggleSupplier: (id: number) => void;
}) {
  const { data: confirmations, isLoading } = trpc.confirmation.getByPlanId.useQuery(
    { planId: plan.id }, { enabled: expanded }
  );

  const confirmed = confirmations?.filter(c => ['confirmed', 'modified'].includes(c.confirmation.status)).length || 0;
  const pending = confirmations?.filter(c => c.confirmation.status === 'pending').length || 0;
  const total = confirmations?.length || 0;

  return (
    <>
      <tr className="border-b cursor-pointer hover:bg-blue-50/50 transition" onClick={onToggle}>
        <td className="px-1.5 py-2 text-gray-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="px-2 py-2 font-medium">{plan.fileName || plan.name}</td>
        <td className="px-2 py-2 text-gray-500">{plan.planStartDate} ~ {plan.planEndDate}</td>
        <td className="px-2 py-2 text-center font-medium">{total}</td>
        <td className="px-2 py-2 text-center text-green-600 font-medium">{confirmed}</td>
        <td className="px-2 py-2 text-center text-orange-600 font-medium">{pending}</td>
      </tr>

      {expanded && (
        <tr className="border-b bg-gray-50/50" onClick={e => e.stopPropagation()}>
          <td></td>
          <td colSpan={5} className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
            ) : confirmations && confirmations.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="w-6"></th>
                    <th className="text-left px-2 py-1.5 font-medium text-gray-500">供应商</th>
                    <th className="text-left px-2 py-1.5 font-medium text-gray-500">联系人</th>
                    <th className="text-left px-2 py-1.5 font-medium text-gray-500">邮箱</th>
                    <th className="text-center px-2 py-1.5 font-medium text-gray-500">确认状态</th>
                    <th className="text-center px-2 py-1.5 font-medium text-gray-500">生产进度</th>
                    <th className="text-left px-2 py-1.5 font-medium text-gray-500">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmations.map(({ confirmation, supplier }) => (
                    <SupplierRow key={confirmation.id} confirmation={confirmation} supplier={supplier}
                      expanded={expandedSupplier === confirmation.id}
                      onToggle={() => onToggleSupplier(confirmation.id)} />
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-4 text-gray-400 text-xs">暂无确认记录</div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function SupplierRow({ confirmation, supplier, expanded, onToggle }: {
  confirmation: any; supplier: any; expanded: boolean; onToggle: () => void;
}) {
  const { data: detail } = trpc.confirmation.getByToken.useQuery(
    { token: confirmation.confirmToken }, { enabled: expanded && !!confirmation.confirmToken }
  );

  const s = statusLabel[confirmation.status] || statusLabel.pending;
  
  // 从逐项进度推导最高生产状态
  let prodIdx = PROD.findIndex(p => p.key === (confirmation.productionStatus || 'not_started'));
  try {
    const progress: Record<string, string> = confirmation.supplierResponse ? JSON.parse(confirmation.supplierResponse) : {};
    const progressValues = Object.values(progress);
    if (progressValues.length > 0) {
      const maxIdx = Math.max(...progressValues.map(v => PROD.findIndex(p => p.key === v)).filter(i => i >= 0));
      if (maxIdx > prodIdx) prodIdx = maxIdx;
    }
  } catch {}

  return (
    <>
      <tr className="border-b last:border-0 cursor-pointer hover:bg-blue-50/30" onClick={onToggle}>
        <td className="px-1.5 py-1.5 text-gray-400">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </td>
        <td className="px-2 py-1.5 font-medium">{supplier?.supplierName || '-'}</td>
        <td className="px-2 py-1.5 text-gray-500">{supplier?.contactPerson || '-'}</td>
        <td className="px-2 py-1.5 text-gray-500">{supplier?.email || '-'}</td>
        <td className="px-2 py-1.5 text-center">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.color}`}>{s.text}</span>
        </td>
        <td className="px-2 py-1.5 text-center">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${prodIdx >= 4 ? 'bg-green-100 text-green-700' : prodIdx > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
            {PROD[prodIdx]?.label || '未始'}
          </span>
        </td>
        <td className="px-2 py-1.5 text-gray-500 max-w-[150px] truncate" title={confirmation.supplierNotes}>
          {confirmation.supplierNotes || '-'}
        </td>
      </tr>

      {expanded && detail && (
        <tr className="border-b bg-white" onClick={e => e.stopPropagation()}>
          <td></td>
          <td colSpan={6} className="p-3">
            <div className="space-y-2">
              {/* 供应商备注 */}
              {confirmation.supplierNotes && (
                <div className="text-xs bg-yellow-50 border border-yellow-200 rounded p-2">
                  <span className="font-medium text-yellow-700">备注：</span>
                  <span className="text-yellow-800">{confirmation.supplierNotes}</span>
                </div>
              )}

              {/* 修改记录 */}
              {detail.modifications && detail.modifications.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-400 font-medium mb-1">修改记录</div>
                  <div className="space-y-1">
                    {detail.modifications.map((mod: any) => {
                      const orig = typeof mod.originalSchedule === 'string' ? JSON.parse(mod.originalSchedule) : mod.originalSchedule;
                      const modified = typeof mod.modifiedSchedule === 'string' ? JSON.parse(mod.modifiedSchedule) : mod.modifiedSchedule;
                      const allDates = [...new Set([...Object.keys(orig || {}), ...Object.keys(modified || {})])].sort();
                      return (
                        <div key={mod.id} className="text-[10px] bg-blue-50 border border-blue-200 rounded p-1.5">
                          <span className="font-medium text-blue-700">{mod.materialCode}</span>
                          {allDates.map(d => {
                            const o = orig?.[d] || 0;
                            const m = modified?.[d] || 0;
                            const diff = m - o;
                            return (
                              <span key={d} className="ml-2">
                                {d.slice(5)}: {o.toLocaleString()} → {m.toLocaleString()}
                                {diff !== 0 && <span className={diff < 0 ? 'text-red-600' : 'text-green-600'}> ({diff > 0 ? '+' : ''}{diff})</span>}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 逐日生产进度 */}
              {(() => {
                let progress: Record<string, string> = {};
                try { progress = detail.confirmation?.supplierResponse ? JSON.parse(detail.confirmation.supplierResponse) : {}; } catch {}
                const entries = Object.entries(progress);
                if (entries.length === 0) return <div className="text-xs text-gray-400">暂无进度更新</div>;
                return (
                  <div>
                    <div className="text-[10px] text-gray-400 font-medium mb-1">逐日生产进度</div>
                    <div className="flex flex-wrap gap-1">
                      {entries.map(([key, status]) => {
                        const [code, ...dateParts] = key.split('_');
                        const dateStr = dateParts.join('_');
                        const pi = PROD.findIndex(p => p.key === status);
                        return (
                          <span key={key} className={`text-[10px] px-1.5 py-0.5 rounded ${pi >= 4 ? 'bg-green-100 text-green-700' : pi > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                            {code} {dateStr?.slice(5)} {PROD[pi]?.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
