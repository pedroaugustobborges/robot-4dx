import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export type CommandRow = {
  id: string;
  text: string;
  type: string;
  status: string;
  expression: string;
  created_at: string;
};

let client: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (client) return client;
  client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return client;
}
