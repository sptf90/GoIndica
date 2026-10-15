import type { Database } from './database/types';
export type RequestStatus = 'OPEN' | 'REVEALED' | 'RESOLVED' | 'CLOSED_NO_RESULT' | 'CANCELED';
export type ResolutionType = 'INDICATED_PLACE' | 'OTHER_PLACE' | 'NOT_FOUND';
export type City = Database['public']['Tables']['cities']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type LocalRequest = Database['public']['Tables']['requests']['Row'];
export type Place = Database['public']['Tables']['places']['Row'];
export type Indication = Database['public']['Tables']['indications']['Row'];
export type Resolution = Database['public']['Tables']['request_resolutions']['Row'];
export type Reward = Database['public']['Tables']['reward_events']['Row'];
export type Report = Database['public']['Tables']['reports']['Row'];
export type Audit = Database['public']['Tables']['audit_logs']['Row'];
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export interface RankingEntry {
  position: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  points: number;
  confirmations: number;
}
export interface AdminAccount {
  id: string;
  username: string | null;
  display_name: string | null;
  blocked: boolean;
  created_at: string;
}
export interface AccountState {
  admin: boolean;
  onboarded: boolean;
}
export interface ProfileStats {
  points: number;
  confirmations: number;
  requests: number;
  indications: number;
}
export interface Metrics {
  requests: number;
  with_indications: number;
  resolved: number;
  other_place: number;
  not_found: number;
  without_indications: number;
  awaiting_decision: number;
  contributors: number;
  returning_contributors: number;
  onboarded: number;
  avg_first_indication_seconds: number | null;
  median_first_indication_seconds: number | null;
  p90_first_indication_seconds: number | null;
  avg_resolution_seconds: number | null;
  median_resolution_seconds: number | null;
  p90_resolution_seconds: number | null;
  analytics: Record<string, number>;
  search: Record<string, number>;
}
export interface MemberSummary {
  unread: number;
  pending: number;
  saved: number;
}
export interface Operations {
  pending_email: number;
  sent_email: number;
  failed_email: number;
}
export type ActionState = {
  error?: string;
  success?: string;
  fields?: Record<string, string[]>;
  redirectTo?: string;
};
export type FormAction = (state: ActionState, form: FormData) => Promise<ActionState>;
