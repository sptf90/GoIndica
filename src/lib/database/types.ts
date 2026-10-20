// Application data contracts, backed by database/migrations (MySQL).
import type {
  Json,
  AccountState,
  ProfileStats,
  PublicProfile,
  Metrics,
  MemberSummary,
  Operations,
} from '@/lib/types';
export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          event_type: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
      };
      cities: {
        Row: {
          id: number;
          name: string;
          normalized_name: string;
          state_name: string;
          state_code: string;
          country_name: string;
          country_code: string;
          slug: string;
        };
      };
      followed_cities: {
        Row: { user_id: string; city_id: number; created_at: string };
      };
      indications: {
        Row: {
          id: string;
          request_id: string;
          user_id: string;
          place_id: string;
          comment: string | null;
          created_at: string;
          hidden_at: string | null;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          request_id: string;
          kind: string;
          dedupe_key: string;
          read_at: string | null;
          created_at: string;
        };
      };
      places: {
        Row: {
          id: string;
          name: string;
          address: string;
          normalized_name: string;
          created_by: string | null;
          hidden_at: string | null;
          city_id: number;
          last_verified_at: string;
          google_place_id: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          home_city_id: number;
          photo_updated_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: string;
          target_id: string;
          reason: string;
          status: string;
          created_at: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          decision_note: string | null;
        };
      };
      request_interests: {
        Row: {
          user_id: string;
          request_id: string;
          saved: boolean;
          following: boolean;
          created_at: string;
          wanted: boolean;
        };
      };
      request_reconfirmations: {
        Row: { user_id: string; request_id: string; confirmed_at: string };
      };
      request_resolutions: {
        Row: {
          id: string;
          request_id: string;
          type: 'INDICATED_PLACE' | 'OTHER_PLACE' | 'NOT_FOUND';
          place_id: string | null;
          resolved_by: string;
          created_at: string;
        };
      };
      requests: {
        Row: {
          id: string;
          requester_id: string;
          description: string;
          city_id: number;
          neighborhood: string | null;
          status: 'OPEN' | 'REVEALED' | 'RESOLVED' | 'CLOSED_NO_RESULT' | 'CANCELED';
          indication_count: number;
          responses_revealed_at: string | null;
          canceled_at: string | null;
          hidden_at: string | null;
          created_at: string;
          updated_at: string;
          has_photo: boolean;
          photo_updated_at: string | null;
          wanting_count: number;
          reconfirmation_count: number;
          last_reconfirmed_at: string | null;
        };
      };
      reward_events: {
        Row: {
          id: string;
          user_id: string;
          request_id: string;
          indication_id: string;
          city_id: number;
          type: string;
          points: number;
          created_at: string;
        };
      };
      support_requests: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          reason: string;
          status: string;
          reviewer_id: string | null;
          decision_note: string | null;
          created_at: string;
          reviewed_at: string | null;
        };
      };
      topic_alerts: {
        Row: {
          id: string;
          user_id: string;
          city_id: number;
          term: string;
          normalized_term: string;
          created_at: string;
        };
      };
      user_preferences: {
        Row: { user_id: string; email_reminders: boolean; updated_at: string };
      };
    };
    Functions: {
      account_state: { Args: Record<string, never>; Returns: AccountState };
      add_topic_alert: { Args: { p_city_id: number; p_term: string }; Returns: undefined };
      admin_accounts: {
        Args: { p_search?: string; p_offset?: number };
        Returns: {
          id: string;
          kind: 'member' | 'company';
          username: string | null;
          display_name: string | null;
          company_name: string | null;
          cnpj: string | null;
          blocked: boolean;
          created_at: string;
        }[];
      };
      admin_metrics: {
        Args: {
          p_city_id?: number | null;
          p_since?: string | null;
          p_until?: string | null;
        };
        Returns: Metrics;
      };
      admin_moderate: {
        Args: { p_action: string; p_target_id: string; p_note?: string };
        Returns: undefined;
      };
      admin_operations: { Args: Record<string, never>; Returns: Operations };
      admin_review_support: {
        Args: { p_id: string; p_decision: string; p_note: string };
        Returns: undefined;
      };
      cancel_request: { Args: { p_request_id: string }; Returns: undefined };
      city_ranking: {
        Args: { p_city_id: number; p_offset?: number };
        Returns: {
          position: number;
          id: string;
          username: string;
          display_name: string;
          photo_updated_at: string | null;
          points: number;
          confirmations: number;
        }[];
      };
      public_city_ranking: {
        Args: { p_city_id: number };
        Returns: { position: number; points: number }[];
      };
      public_profile: {
        Args: { p_username: string; p_request_id?: string; p_ranking_city_id?: number };
        Returns: PublicProfile | null;
      };
      profile_photo: {
        Args: { p_profile_id: string; p_request_id?: string; p_ranking_city_id?: number };
        Returns: string | null;
      };
      username_available: { Args: { p_username: string }; Returns: boolean };
      claim_email_jobs: {
        Args: { p_worker: string; p_limit?: number };
        Returns: { id: string; user_id: string; request_id: string }[];
      };
      complete_account_closure: {
        Args: { p_id: string; p_note: string };
        Returns: undefined;
      };
      consume_api_limit: { Args: { p_bucket: string }; Returns: undefined };
      consume_share_card_limit: { Args: Record<string, never>; Returns: undefined };
      create_request_with_photo: {
        Args: {
          p_description: string;
          p_city_id: number;
          p_neighborhood?: string | null;
          p_photo?: string | null;
        };
        Returns: string;
      };
      edit_request_with_photo: {
        Args: {
          p_request_id: string;
          p_description: string;
          p_city_id: number;
          p_neighborhood?: string | null;
          p_photo?: string | null;
          p_remove_photo?: boolean;
        };
        Returns: undefined;
      };
      email_job_eligible: { Args: { p_id: string; p_worker: string }; Returns: boolean };
      export_account: { Args: Record<string, never>; Returns: Json };
      finish_email_job: {
        Args: { p_id: string; p_worker: string; p_sent: boolean };
        Returns: undefined;
      };
      health_check: { Args: Record<string, never>; Returns: boolean };
      indication_groups: {
        Args: { p_request_id: string; p_offset?: number };
        Returns: { place_id: string; indications: number }[];
      };
      log_login: { Args: Record<string, never>; Returns: undefined };
      mark_notifications_read: { Args: { p_id?: string | null }; Returns: undefined };
      member_summary: { Args: Record<string, never>; Returns: MemberSummary };
      prepare_account_closure: { Args: { p_id: string }; Returns: string };
      prepare_reminders: { Args: Record<string, never>; Returns: number };
      profile_stats: { Args: Record<string, never>; Returns: ProfileStats };
      reconfirm_discovery: { Args: { p_request_id: string }; Returns: undefined };
      record_analytics: {
        Args: { p_event: string; p_fingerprint: string };
        Returns: undefined;
      };
      record_search_event: {
        Args: { p_kind: string; p_city_id: number; p_request_id?: string | null };
        Returns: undefined;
      };
      refresh_reminders: { Args: Record<string, never>; Returns: undefined };
      remove_topic_alert: { Args: { p_id: string }; Returns: undefined };
      report_content: {
        Args: { p_target_type: string; p_target_id: string; p_reason: string };
        Returns: undefined;
      };
      request_editable: { Args: { p_request_id: string }; Returns: boolean };
      request_photo: { Args: { p_request_id: string }; Returns: string };
      request_support: { Args: { p_kind: string; p_reason: string }; Returns: string };
      resolve_request: {
        Args: {
          p_request_id: string;
          p_type: 'INDICATED_PLACE' | 'OTHER_PLACE' | 'NOT_FOUND';
          p_place_id?: string | null;
        };
        Returns: string;
      };
      reveal_responses: { Args: { p_request_id: string }; Returns: undefined };
      save_preferences: { Args: { p_email_reminders: boolean }; Returns: undefined };
      save_profile: {
        Args: {
          p_username: string;
          p_display_name: string;
          p_city_id: number;
          p_photo?: string | null;
          p_remove_photo?: boolean;
        };
        Returns: undefined;
      };
      search_requests: {
        Args: {
          p_city_id: number;
          p_query?: string;
          p_status?: 'OPEN' | 'REVEALED' | 'RESOLVED' | 'CLOSED_NO_RESULT' | 'CANCELED';
          p_offset?: number;
        };
        Returns: Database['public']['Tables']['requests']['Row'][];
      };
      search_unanswered_requests: {
        Args: { p_city_id: number; p_query?: string; p_offset?: number };
        Returns: Database['public']['Tables']['requests']['Row'][];
      };
      set_followed_city: {
        Args: { p_city_id: number; p_following: boolean };
        Returns: undefined;
      };
      set_request_interest: {
        Args: {
          p_request_id: string;
          p_saved?: boolean | null;
          p_following?: boolean | null;
        };
        Returns: undefined;
      };
      set_request_wanted: {
        Args: { p_request_id: string; p_wanted: boolean };
        Returns: undefined;
      };
      submit_verified_indication: {
        Args: {
          p_actor: string;
          p_request_id: string;
          p_place_id: string;
          p_verified_city_id: number;
          p_comment?: string | null;
        };
        Returns: string;
      };
    };
  };
};
