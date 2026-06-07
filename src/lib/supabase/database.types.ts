export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_player_id: string | null
          created_at: string
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_player_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: never
        }
        Update: {
          action?: string
          actor_player_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_player_id_fkey"
            columns: ["actor_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_log_items: {
        Row: {
          count: number
          created_at: string
          custom_name: string | null
          custom_notes: string | null
          custom_unit: string | null
          diet_log_meal_id: string
          food_item_id: string | null
          id: string
          sort_order: number
        }
        Insert: {
          count?: number
          created_at?: string
          custom_name?: string | null
          custom_notes?: string | null
          custom_unit?: string | null
          diet_log_meal_id: string
          food_item_id?: string | null
          id?: string
          sort_order?: number
        }
        Update: {
          count?: number
          created_at?: string
          custom_name?: string | null
          custom_notes?: string | null
          custom_unit?: string | null
          diet_log_meal_id?: string
          food_item_id?: string | null
          id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "diet_log_items_diet_log_meal_id_fkey"
            columns: ["diet_log_meal_id"]
            isOneToOne: false
            referencedRelation: "diet_log_meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_log_items_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_log_meals: {
        Row: {
          created_at: string
          diet_log_id: string
          id: string
          meal_slot_id: string
          skipped: boolean
        }
        Insert: {
          created_at?: string
          diet_log_id: string
          id?: string
          meal_slot_id: string
          skipped?: boolean
        }
        Update: {
          created_at?: string
          diet_log_id?: string
          id?: string
          meal_slot_id?: string
          skipped?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "diet_log_meals_diet_log_id_fkey"
            columns: ["diet_log_id"]
            isOneToOne: false
            referencedRelation: "diet_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_log_meals_meal_slot_id_fkey"
            columns: ["meal_slot_id"]
            isOneToOne: false
            referencedRelation: "meal_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_logs: {
        Row: {
          created_at: string
          id: string
          log_date: string
          narration: string | null
          player_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          log_date: string
          narration?: string | null
          player_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          log_date?: string
          narration?: string | null
          player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_logs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      food_catalog: {
        Row: {
          created_at: string
          emoji: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          section_label: string
          sort_order: number
          unit: string
          unit_detail: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          section_label: string
          sort_order?: number
          unit: string
          unit_detail?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          section_label?: string
          sort_order?: number
          unit?: string
          unit_detail?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      game_types: {
        Row: {
          created_at: string
          emoji: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      gym_catalog: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          kind: "body_part" | "equipment" | "scheme"
          sort_order: number
          supports_weight: boolean
          value: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          kind: "body_part" | "equipment" | "scheme"
          sort_order?: number
          supports_weight?: boolean
          value: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          kind?: "body_part" | "equipment" | "scheme"
          sort_order?: number
          supports_weight?: boolean
          value?: string
        }
        Relationships: []
      }
      gym_log_exercises: {
        Row: {
          body_part: string
          created_at: string
          equipment: string | null
          gym_log_id: string
          id: string
          notes: string | null
          scheme: string | null
          sort_order: number
          weight: number | null
          weight_unit: "kg" | "lb"
        }
        Insert: {
          body_part: string
          created_at?: string
          equipment?: string | null
          gym_log_id: string
          id?: string
          notes?: string | null
          scheme?: string | null
          sort_order?: number
          weight?: number | null
          weight_unit?: "kg" | "lb"
        }
        Update: {
          body_part?: string
          created_at?: string
          equipment?: string | null
          gym_log_id?: string
          id?: string
          notes?: string | null
          scheme?: string | null
          sort_order?: number
          weight?: number | null
          weight_unit?: "kg" | "lb"
        }
        Relationships: [
          {
            foreignKeyName: "gym_log_exercises_gym_log_id_fkey"
            columns: ["gym_log_id"]
            isOneToOne: false
            referencedRelation: "gym_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_logs: {
        Row: {
          body_weight: number | null
          body_weight_unit: "kg" | "lb"
          created_at: string
          id: string
          log_date: string
          narration: string | null
          player_id: string
          updated_at: string
        }
        Insert: {
          body_weight?: number | null
          body_weight_unit?: "kg" | "lb"
          created_at?: string
          id?: string
          log_date: string
          narration?: string | null
          player_id: string
          updated_at?: string
        }
        Update: {
          body_weight?: number | null
          body_weight_unit?: "kg" | "lb"
          created_at?: string
          id?: string
          log_date?: string
          narration?: string | null
          player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_logs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_slots: {
        Row: {
          created_at: string
          emoji: string | null
          end_min: number
          id: string
          is_active: boolean
          key: string
          name: string
          sort_order: number
          start_min: number
          window_label: string
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          end_min: number
          id?: string
          is_active?: boolean
          key: string
          name: string
          sort_order?: number
          start_min: number
          window_label: string
        }
        Update: {
          created_at?: string
          emoji?: string | null
          end_min?: number
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          sort_order?: number
          start_min?: number
          window_label?: string
        }
        Relationships: []
      }
      mmg_entries: {
        Row: {
          arrival_order: number | null
          confirmation_order: number | null
          confirmed_by_11am: boolean | null
          created_at: string
          id: string
          narration: string | null
          packing_kit: boolean | null
          packing_weights: boolean | null
          player_id: string
          session_id: string
          unpacking: boolean | null
          updated_at: string
        }
        Insert: {
          arrival_order?: number | null
          confirmation_order?: number | null
          confirmed_by_11am?: boolean | null
          created_at?: string
          id?: string
          narration?: string | null
          packing_kit?: boolean | null
          packing_weights?: boolean | null
          player_id: string
          session_id: string
          unpacking?: boolean | null
          updated_at?: string
        }
        Update: {
          arrival_order?: number | null
          confirmation_order?: number | null
          confirmed_by_11am?: boolean | null
          created_at?: string
          id?: string
          narration?: string | null
          packing_kit?: boolean | null
          packing_weights?: boolean | null
          player_id?: string
          session_id?: string
          unpacking?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mmg_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mmg_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          phone: string
          pin_hash: string
          role: "super_admin" | "coach" | "admin" | "user"
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          phone: string
          pin_hash: string
          role?: "super_admin" | "coach" | "admin" | "user"
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          phone?: string
          pin_hash?: string
          role?: "super_admin" | "coach" | "admin" | "user"
          updated_at?: string
        }
        Relationships: []
      }
      point_rules: {
        Row: {
          created_at: string
          game_type_id: string | null
          id: string
          is_active: boolean
          label: string
          points: number
          rule_key: string
          scope: "participation" | "result" | "stat" | "order" | "other"
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_type_id?: string | null
          id?: string
          is_active?: boolean
          label: string
          points: number
          rule_key: string
          scope: "participation" | "result" | "stat" | "order" | "other"
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_type_id?: string | null
          id?: string
          is_active?: boolean
          label?: string
          points?: number
          rule_key?: string
          scope?: "participation" | "result" | "stat" | "order" | "other"
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_rules_game_type_id_fkey"
            columns: ["game_type_id"]
            isOneToOne: false
            referencedRelation: "game_types"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          day_of_week: "Tue" | "Thu" | "Sat"
          id: string
          is_active: boolean
          label: string | null
          month: number
          session_date: string
          year: number
        }
        Insert: {
          created_at?: string
          day_of_week: "Tue" | "Thu" | "Sat"
          id?: string
          is_active?: boolean
          label?: string | null
          month: number
          session_date: string
          year: number
        }
        Update: {
          created_at?: string
          day_of_week?: "Tue" | "Thu" | "Sat"
          id?: string
          is_active?: boolean
          label?: string | null
          month?: number
          session_date?: string
          year?: number
        }
        Relationships: []
      }
      submission_game_stats: {
        Row: {
          id: string
          stat_key: string
          stat_value: number
          submission_game_id: string
        }
        Insert: {
          id?: string
          stat_key: string
          stat_value?: number
          submission_game_id: string
        }
        Update: {
          id?: string
          stat_key?: string
          stat_value?: number
          submission_game_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_game_stats_submission_game_id_fkey"
            columns: ["submission_game_id"]
            isOneToOne: false
            referencedRelation: "submission_games"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_games: {
        Row: {
          created_at: string
          game_type_id: string | null
          id: string
          mmg_entry_id: string
          result: "won" | "drew" | "lost" | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          game_type_id?: string | null
          id?: string
          mmg_entry_id: string
          result?: "won" | "drew" | "lost" | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          game_type_id?: string | null
          id?: string
          mmg_entry_id?: string
          result?: "won" | "drew" | "lost" | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "submission_games_game_type_id_fkey"
            columns: ["game_type_id"]
            isOneToOne: false
            referencedRelation: "game_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_games_mmg_entry_id_fkey"
            columns: ["mmg_entry_id"]
            isOneToOne: false
            referencedRelation: "mmg_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_others: {
        Row: {
          created_at: string
          description: string
          id: string
          mmg_entry_id: string
          points: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          mmg_entry_id: string
          points?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          mmg_entry_id?: string
          points?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "submission_others_mmg_entry_id_fkey"
            columns: ["mmg_entry_id"]
            isOneToOne: false
            referencedRelation: "mmg_entries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

