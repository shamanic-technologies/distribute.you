"use client";

interface FunnelMetricsProps {
  leadsServed: number;
  emailsGenerated: number;
  emailsContacted: number;
  emailsDelivered: number;
  emailsOpened: number;
  emailsReplied: number;
}

export function FunnelMetricsSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="flex items-end justify-between gap-3">
        {[100, 80, 60, 35, 15].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className="w-full flex justify-center" style={{ height: 128 }}>
              <div
                className="w-full max-w-14 bg-gray-100 rounded-t animate-pulse self-end"
                style={{ height: `${h}%` }}
              />
            </div>
            <div className="mt-2 h-5 w-8 bg-gray-200 rounded animate-pulse" />
            <div className="mt-1 h-3 w-12 bg-gray-100 rounded animate-pulse" />
            {i > 0 && <div className="mt-1 h-3 w-10 bg-gray-100 rounded animate-pulse" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FunnelMetrics({
  leadsServed,
  emailsGenerated,
  emailsContacted,
  emailsDelivered,
  emailsOpened,
  emailsReplied
}: FunnelMetricsProps) {
  const steps = [
    { label: "Leads", value: leadsServed, rate: null as number | null },
    { label: "Generated", value: emailsGenerated, rate: leadsServed > 0 ? (emailsGenerated / leadsServed * 100) : 0 },
    { label: "Contacted", value: emailsContacted, rate: emailsGenerated > 0 ? (emailsContacted / emailsGenerated * 100) : 0 },
    { label: "Delivered", value: emailsDelivered, rate: emailsContacted > 0 ? (emailsDelivered / emailsContacted * 100) : 0 },
    { label: "Opened", value: emailsOpened, rate: emailsDelivered > 0 ? (emailsOpened / emailsDelivered * 100) : 0 },
    { label: "Replied", value: emailsReplied, rate: emailsDelivered > 0 ? (emailsReplied / emailsDelivered * 100) : 0 },
  ];

  const maxValue = Math.max(...steps.map(s => s.value), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <h3 className="font-medium text-gray-800 mb-4 md:mb-6">Campaign Funnel</h3>

      <div className="flex items-end justify-between gap-3">
        {steps.map((step, i) => {
          const barHeight = Math.max((step.value / maxValue) * 100, 4);
          return (
            <div key={step.label} className="flex-1 flex flex-col items-center">
              {/* Bar — fixed-height container, bar grows from bottom */}
              <div className="w-full flex justify-center" style={{ height: 128 }}>
                <div
                  className="w-full max-w-14 bg-brand-500 rounded-t self-end"
                  style={{ height: `${barHeight}%` }}
                />
              </div>

              {/* Labels — fixed layout so all columns align */}
              <p className="mt-2 text-lg font-bold text-gray-800 leading-tight">
                {step.value.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 leading-tight mt-0.5">{step.label}</p>
              <p className="text-xs font-medium leading-tight mt-0.5 h-4">
                {step.rate !== null ? (
                  <span className="text-brand-600">{step.rate.toFixed(1)}%</span>
                ) : (
                  <span>&nbsp;</span>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
