export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string;
          email: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      assignments: {
        Row: {
          completed_at: string | null;
          created_at: string;
          event_id: string;
          expires_at: string;
          found_at: string | null;
          id: string;
          judge_id: string;
          project_id: string;
          reserved_at: string;
          status: Database["public"]["Enums"]["assignment_status"];
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          event_id: string;
          expires_at: string;
          found_at?: string | null;
          id?: string;
          judge_id: string;
          project_id: string;
          reserved_at?: string;
          status: Database["public"]["Enums"]["assignment_status"];
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          event_id?: string;
          expires_at?: string;
          found_at?: string | null;
          id?: string;
          judge_id?: string;
          project_id?: string;
          reserved_at?: string;
          status?: Database["public"]["Enums"]["assignment_status"];
        };
        Relationships: [];
      };
      comparisons: {
        Row: {
          created_at: string;
          current_project_id: string;
          event_id: string;
          id: string;
          judge_id: string;
          loser_project_id: string;
          previous_project_id: string;
          winner_project_id: string;
        };
        Insert: {
          created_at?: string;
          current_project_id: string;
          event_id: string;
          id?: string;
          judge_id: string;
          loser_project_id: string;
          previous_project_id: string;
          winner_project_id: string;
        };
        Update: {
          created_at?: string;
          current_project_id?: string;
          event_id?: string;
          id?: string;
          judge_id?: string;
          loser_project_id?: string;
          previous_project_id?: string;
          winner_project_id?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          created_at: string;
          id: string;
          judging_open: boolean;
          name: string;
          rankings_frozen: boolean;
          submissions_open: boolean;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          judging_open?: boolean;
          name: string;
          rankings_frozen?: boolean;
          submissions_open?: boolean;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          judging_open?: boolean;
          name?: string;
          rankings_frozen?: boolean;
          submissions_open?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      judge_state: {
        Row: {
          comparisons_completed: number;
          event_id: string;
          judge_id: string;
          last_completed_project_id: string | null;
          skips_count: number;
          updated_at: string;
        };
        Insert: {
          comparisons_completed?: number;
          event_id: string;
          judge_id: string;
          last_completed_project_id?: string | null;
          skips_count?: number;
          updated_at?: string;
        };
        Update: {
          comparisons_completed?: number;
          event_id?: string;
          judge_id?: string;
          last_completed_project_id?: string | null;
          skips_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      judges: {
        Row: {
          active: boolean;
          created_at: string;
          event_id: string;
          id: string;
          last_seen_at: string;
          name: string | null;
          token: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          event_id: string;
          id?: string;
          last_seen_at?: string;
          name?: string | null;
          token: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          event_id?: string;
          id?: string;
          last_seen_at?: string;
          name?: string | null;
          token?: string;
        };
        Relationships: [];
      };
      project_rankings: {
        Row: {
          comparisons: number;
          event_id: string;
          losses: number;
          project_id: string;
          rating: number;
          updated_at: string;
          wins: number;
        };
        Insert: {
          comparisons?: number;
          event_id: string;
          losses?: number;
          project_id: string;
          rating?: number;
          updated_at?: string;
          wins?: number;
        };
        Update: {
          comparisons?: number;
          event_id?: string;
          losses?: number;
          project_id?: string;
          rating?: number;
          updated_at?: string;
          wins?: number;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          comparison_count: number;
          created_at: string;
          description: string;
          event_id: string;
          id: string;
          project_link: string;
          status: Database["public"]["Enums"]["project_status"];
          stream: Database["public"]["Enums"]["judging_stream"];
          table_number: number;
          team_name: string;
          title: string;
          updated_at: string;
          visit_count: number;
        };
        Insert: {
          comparison_count?: number;
          created_at?: string;
          description: string;
          event_id: string;
          id?: string;
          project_link: string;
          status?: Database["public"]["Enums"]["project_status"];
          stream: Database["public"]["Enums"]["judging_stream"];
          table_number: number;
          team_name: string;
          title: string;
          updated_at?: string;
          visit_count?: number;
        };
        Update: {
          comparison_count?: number;
          created_at?: string;
          description?: string;
          event_id?: string;
          id?: string;
          project_link?: string;
          status?: Database["public"]["Enums"]["project_status"];
          stream?: Database["public"]["Enums"]["judging_stream"];
          table_number?: number;
          team_name?: string;
          title?: string;
          updated_at?: string;
          visit_count?: number;
        };
        Relationships: [];
      };
      ranking_snapshots: {
        Row: {
          comparisons: number;
          event_id: string;
          frozen_at: string;
          frozen_position: number;
          id: string;
          losses: number;
          project_id: string;
          rating: number;
          visit_count: number;
          wins: number;
        };
        Insert: {
          comparisons: number;
          event_id: string;
          frozen_at?: string;
          frozen_position: number;
          id?: string;
          losses: number;
          project_id: string;
          rating: number;
          visit_count: number;
          wins: number;
        };
        Update: {
          comparisons?: number;
          event_id?: string;
          frozen_at?: string;
          frozen_position?: number;
          id?: string;
          losses?: number;
          project_id?: string;
          rating?: number;
          visit_count?: number;
          wins?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_assignment: {
        Args: {
          p_assignment_id: string;
          p_judge_token: string;
          p_outcome: string;
        };
        Returns: Json;
      };
      confirm_assignment_found: {
        Args: {
          p_assignment_id: string;
          p_judge_token: string;
        };
        Returns: Json;
      };
      get_next_assignment: {
        Args: {
          p_judge_token: string;
        };
        Returns: Json;
      };
      skip_assignment: {
        Args: {
          p_assignment_id: string;
          p_judge_token: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      assignment_status:
        | "reserved_find"
        | "reserved_judge"
        | "completed"
        | "skipped"
        | "expired";
      judging_stream: "most_useful" | "most_useless";
      project_status: "active" | "submitted" | "withdrawn";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
