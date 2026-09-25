import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export type CommandRow = {
  id: string;
  text: string;
  type: string;
  status: string;
  expression: string;
  created_at: string;
};

export type SignatureRow = {
  id: string;
  name: string;
  signature_data: string;
  displayed: boolean;
  created_at: string;
};

type Database = {
  public: {
    Tables: {
      commands: {
        Row: CommandRow;
        Insert: Partial<CommandRow> & { text: string; type: string };
        Update: Partial<CommandRow>;
      };
      signatures: {
        Row: SignatureRow;
        Insert: Partial<SignatureRow> & { name: string; signature_data: string };
        Update: Partial<SignatureRow>;
      };
    };
  };
};

let client: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createClient() {
  if (client) return client;
  client = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return client;
}
