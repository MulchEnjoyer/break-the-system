import type { EventRow } from "@/lib/types/domain";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function getCurrentEvent() {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<EventRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getJudgeByToken(token: string) {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("judges")
    .select("id, name, token, active, created_at, last_seen_at, event_id")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
