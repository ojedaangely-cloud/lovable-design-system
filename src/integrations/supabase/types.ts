export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      currency_exchanges: {
        Row: {
          amount_bcv: number
          amount_bs: number
          category: string
          commission_2pct: boolean | null
          commission_amount: number | null
          created_at: string
          date: string
          es_ganancia_real: boolean | null
          id: string
          person_name: string
          profit_bs: number | null
          profit_usd: number | null
          purchase_amount_bs: number | null
          purchase_rate: number | null
          quantity_usd: number
          rate: number | null
          rate_bcv: number
          received: boolean | null
          received_amount_bs: number | null
          type: string
          user_id: string
        }
        Insert: {
          amount_bcv?: number
          amount_bs?: number
          category?: string
          commission_2pct?: boolean | null
          commission_amount?: number | null
          created_at?: string
          date: string
          es_ganancia_real?: boolean | null
          id?: string
          person_name?: string
          profit_bs?: number | null
          profit_usd?: number | null
          purchase_amount_bs?: number | null
          purchase_rate?: number | null
          quantity_usd?: number
          rate?: number | null
          rate_bcv?: number
          received?: boolean | null
          received_amount_bs?: number | null
          type: string
          user_id: string
        }
        Update: {
          amount_bcv?: number
          amount_bs?: number
          category?: string
          commission_2pct?: boolean | null
          commission_amount?: number | null
          created_at?: string
          date?: string
          es_ganancia_real?: boolean | null
          id?: string
          person_name?: string
          profit_bs?: number | null
          profit_usd?: number | null
          purchase_amount_bs?: number | null
          purchase_rate?: number | null
          quantity_usd?: number
          rate?: number | null
          rate_bcv?: number
          received?: boolean | null
          received_amount_bs?: number | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      gastos: {
        Row: {
          cantidad: number
          categoria_id: string | null
          descripcion: string | null
          fecha: string
          id: string
          url_factura: string | null
        }
        Insert: {
          cantidad: number
          categoria_id?: string | null
          descripcion?: string | null
          fecha: string
          id?: string
          url_factura?: string | null
        }
        Update: {
          cantidad?: number
          categoria_id?: string | null
          descripcion?: string | null
          fecha?: string
          id?: string
          url_factura?: string | null
        }
        Relationships: []
      }
      incomes: {
        Row: {
          amount_bs: number
          amount_usd: number
          created_at: string
          date: string
          description: string
          es_ingreso_real: boolean | null
          id: string
          rate: number
          rate_bcv: number
          source: string
          tipo_real: string | null
          user_id: string
        }
        Insert: {
          amount_bs?: number
          amount_usd?: number
          created_at?: string
          date: string
          description?: string
          es_ingreso_real?: boolean | null
          id?: string
          rate?: number
          rate_bcv?: number
          source: string
          tipo_real?: string | null
          user_id: string
        }
        Update: {
          amount_bs?: number
          amount_usd?: number
          created_at?: string
          date?: string
          description?: string
          es_ingreso_real?: boolean | null
          id?: string
          rate?: number
          rate_bcv?: number
          source?: string
          tipo_real?: string | null
          user_id?: string
        }
        Relationships: []
      }
      liabilities: {
        Row: {
          amount_bs: number
          amount_usd: number
          created_at: string
          date: string
          description: string
          id: string
          paid: boolean
          rate: number
          user_id: string
        }
        Insert: {
          amount_bs?: number
          amount_usd?: number
          created_at?: string
          date: string
          description?: string
          id?: string
          paid?: boolean
          rate?: number
          user_id: string
        }
        Update: {
          amount_bs?: number
          amount_usd?: number
          created_at?: string
          date?: string
          description?: string
          id?: string
          paid?: boolean
          rate?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rates: {
        Row: {
          bcv: number
          binance: number
          id: string
          last_updated: string
          user_id: string
        }
        Insert: {
          bcv?: number
          binance?: number
          id?: string
          last_updated?: string
          user_id: string
        }
        Update: {
          bcv?: number
          binance?: number
          id?: string
          last_updated?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          amount_bs: number
          amount_usd: number
          created_at: string
          due_day: number
          es_egreso_real: boolean | null
          id: string
          mes_ano: string | null
          month: string
          name: string
          paid: boolean
          paid_date: string | null
          rate: number
          user_id: string
        }
        Insert: {
          amount_bs?: number
          amount_usd?: number
          created_at?: string
          due_day: number
          es_egreso_real?: boolean | null
          id?: string
          mes_ano?: string | null
          month: string
          name: string
          paid?: boolean
          paid_date?: string | null
          rate?: number
          user_id: string
        }
        Update: {
          amount_bs?: number
          amount_usd?: number
          created_at?: string
          due_day?: number
          es_egreso_real?: boolean | null
          id?: string
          mes_ano?: string | null
          month?: string
          name?: string
          paid?: boolean
          paid_date?: string | null
          rate?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_ganancias_cambios: {
        Row: {
          date: string | null
          ganancia_bs: number | null
          ganancia_usd: number | null
          monto_operado: number | null
          person_name: string | null
          tipo_financiero: string | null
        }
        Insert: {
          date?: string | null
          ganancia_bs?: number | null
          ganancia_usd?: number | null
          monto_operado?: number | null
          person_name?: string | null
          tipo_financiero?: never
        }
        Update: {
          date?: string | null
          ganancia_bs?: number | null
          ganancia_usd?: number | null
          monto_operado?: number | null
          person_name?: string | null
          tipo_financiero?: never
        }
        Relationships: []
      }
      v_gastos_reales: {
        Row: {
          amount_bs: number | null
          amount_usd: number | null
          concepto: string | null
          date: string | null
          due_day: number | null
          paid: boolean | null
          tipo_financiero: string | null
        }
        Insert: {
          amount_bs?: number | null
          amount_usd?: number | null
          concepto?: string | null
          date?: string | null
          due_day?: number | null
          paid?: boolean | null
          tipo_financiero?: never
        }
        Update: {
          amount_bs?: number | null
          amount_usd?: number | null
          concepto?: string | null
          date?: string | null
          due_day?: number | null
          paid?: boolean | null
          tipo_financiero?: never
        }
        Relationships: []
      }
      v_ingresos_reales: {
        Row: {
          amount_bs: number | null
          amount_usd: number | null
          date: string | null
          description: string | null
          source: string | null
          tipo_financiero: string | null
        }
        Insert: {
          amount_bs?: number | null
          amount_usd?: number | null
          date?: string | null
          description?: string | null
          source?: string | null
          tipo_financiero?: never
        }
        Update: {
          amount_bs?: number | null
          amount_usd?: number | null
          date?: string | null
          description?: string | null
          source?: string | null
          tipo_financiero?: never
        }
        Relationships: []
      }
      v_inversiones_activo: {
        Row: {
          amount_bs: number | null
          amount_usd: number | null
          date: string | null
          description: string | null
          source: string | null
          tipo_financiero: string | null
        }
        Insert: {
          amount_bs?: number | null
          amount_usd?: number | null
          date?: string | null
          description?: string | null
          source?: string | null
          tipo_financiero?: never
        }
        Update: {
          amount_bs?: number | null
          amount_usd?: number | null
          date?: string | null
          description?: string | null
          source?: string | null
          tipo_financiero?: never
        }
        Relationships: []
      }
      v_pasivos_pendientes: {
        Row: {
          amount_bs: number | null
          amount_usd: number | null
          concepto: string | null
          due_day: number | null
          month: string | null
          tipo_financiero: string | null
        }
        Insert: {
          amount_bs?: number | null
          amount_usd?: number | null
          concepto?: string | null
          due_day?: number | null
          month?: string | null
          tipo_financiero?: never
        }
        Update: {
          amount_bs?: number | null
          amount_usd?: number | null
          concepto?: string | null
          due_day?: number | null
          month?: string | null
          tipo_financiero?: never
        }
        Relationships: []
      }
    }
    Functions: {
      actualizar_saldos_cuentas: {
        Args: never
        Returns: {
          cuenta: string
          saldo_bs: number
          saldo_usd: number
        }[]
      }
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
  public: {
    Enums: {},
  },
} as const
