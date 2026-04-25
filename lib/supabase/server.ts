import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  return value;
}

function getAnonKey() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return value;
}

function getServiceRoleKey() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!value) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return value;
}

export function createAnonServerClient(accessToken?: string) {
  return createClient<Database>(getSupabaseUrl(), getAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
}

export function createServiceRoleClient() {
  return createClient<Database>(getSupabaseUrl(), getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
