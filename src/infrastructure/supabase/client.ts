import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnvironment } from "@/infrastructure/supabase/env";

export const createClient = () => {
  const { url, publishableKey } = getSupabaseEnvironment();

  return createBrowserClient(url, publishableKey);
};
