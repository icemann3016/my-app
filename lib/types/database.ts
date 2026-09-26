// Types for the Supabase database. Hand-written to match the M1 migration;
// `npm run db:types` regenerates this file from the real database (same shape).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_path: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          home_airport_icao: string | null;
          id: string;
          rating_avg: number | null;
          rating_count: number;
          suspended_at: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          home_airport_icao?: string | null;
          id: string;
          rating_avg?: number | null;
          rating_count?: number;
          suspended_at?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          home_airport_icao?: string | null;
          id?: string;
          rating_avg?: number | null;
          rating_count?: number;
          suspended_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          created_at: string;
          locale: string;
          units: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          locale?: string;
          units?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          locale?: string;
          units?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      user_has_role: {
        Args: { check_role: Database["public"]["Enums"]["app_role"]; check_user?: string };
        Returns: boolean;
      };
    };
    Enums: { app_role: "pilot" | "owner" | "admin" };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
