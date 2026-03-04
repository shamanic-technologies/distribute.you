// API key validation for distribute
// TODO: Implement when backend is ready

export interface ApiKeyValidation {
  isValid: boolean;
  userId?: string;
  plan?: "free";
  quotaRemaining?: number;
}

export async function validateApiKey(apiKey: string): Promise<ApiKeyValidation> {
  // TODO: Call backend API to validate key
  // For now, return mock data
  return {
    isValid: false,
    userId: undefined,
    plan: undefined,
    quotaRemaining: undefined,
  };
}

export function getApiKeyFromEnv(): string | undefined {
  return process.env.ADMIN_DISTRIBUTE_API_KEY;
}
