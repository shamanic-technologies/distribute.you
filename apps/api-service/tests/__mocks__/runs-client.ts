/**
 * Mock for @mcpfactory/runs-client
 * Used in tests since the workspace package may not be built in CI
 */

export type RunCost = {
  id: string;
  runId: string;
  costName: string;
  quantity: string;
  unitCostInUsdCents: string;
  totalCostInUsdCents: string;
  createdAt: string;
};

export type DescendantRun = {
  id: string;
  parentRunId: string | null;
  serviceName: string;
  taskName: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  costs: RunCost[];
  ownCostInUsdCents: string;
};

export type Run = {
  id: string;
  organizationId: string;
  userId: string | null;
  appId: string;
  brandId: string | null;
  campaignId: string | null;
  serviceName: string;
  taskName: string;
  status: string;
  parentRunId: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RunWithCosts = Run & {
  costs: RunCost[];
  ownCostInUsdCents: string;
  childrenCostInUsdCents: string;
  totalCostInUsdCents: string;
  descendantRuns: DescendantRun[];
};

export type RunWithOwnCost = Run & {
  ownCostInUsdCents: string;
};

export type CreateRunParams = {
  orgId: string;
  userId?: string;
  appId: string;
  brandId?: string;
  campaignId?: string;
  serviceName: string;
  taskName: string;
  parentRunId?: string;
};

export type CostItem = {
  costName: string;
  quantity: number;
};

export type ListRunsParams = {
  orgId: string;
  userId?: string;
  appId?: string;
  brandId?: string;
  campaignId?: string;
  serviceName?: string;
  taskName?: string;
  status?: string;
  parentRunId?: string;
  limit?: number;
  offset?: number;
};

export async function createRun(_params: CreateRunParams): Promise<Run> {
  return {
    id: "mock-run-id",
    organizationId: "mock-org-uuid",
    userId: null,
    appId: "mcpfactory",
    brandId: null,
    campaignId: null,
    serviceName: "mock-service",
    taskName: "mock-task",
    status: "running",
    parentRunId: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function updateRun(_runId: string, _status: "completed" | "failed"): Promise<Run> {
  return {
    id: _runId,
    organizationId: "mock-org-uuid",
    userId: null,
    appId: "mcpfactory",
    brandId: null,
    campaignId: null,
    serviceName: "mock-service",
    taskName: "mock-task",
    status: "completed",
    parentRunId: null,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function addCosts(_runId: string, _costs: CostItem[]): Promise<{ costs: RunCost[] }> {
  return { costs: [] };
}

export async function listRuns(_params: ListRunsParams): Promise<{ runs: RunWithOwnCost[]; limit: number; offset: number }> {
  return { runs: [], limit: 50, offset: 0 };
}

export async function getRun(_runId: string): Promise<RunWithCosts | null> {
  return null;
}

export async function getRunsBatch(_runIds: string[]): Promise<Map<string, RunWithCosts>> {
  return new Map();
}
