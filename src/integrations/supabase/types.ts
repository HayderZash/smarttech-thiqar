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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      banners: {
        Row: {
          created_at: string
          description_ar: string
          description_en: string
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          sort_order: number
          title_ar: string
          title_en: string
        }
        Insert: {
          created_at?: string
          description_ar?: string
          description_en?: string
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          title_ar?: string
          title_en?: string
        }
        Update: {
          created_at?: string
          description_ar?: string
          description_en?: string
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          title_ar?: string
          title_en?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          icon: string
          id: string
          image_url: string | null
          name_ar: string
          name_en: string
          parent_id: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          image_url?: string | null
          name_ar: string
          name_en?: string
          parent_id?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          image_url?: string | null
          name_ar?: string
          name_en?: string
          parent_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount: number | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
        }
        Relationships: []
      }
      governorates: {
        Row: {
          id: string
          name_ar: string
          name_en: string
          shipping_cost: number
          sort_order: number
        }
        Insert: {
          id?: string
          name_ar: string
          name_en?: string
          shipping_cost?: number
          sort_order?: number
        }
        Update: {
          id?: string
          name_ar?: string
          name_en?: string
          shipping_cost?: number
          sort_order?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          order_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          order_id?: string | null
          title?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          order_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          is_unavailable: boolean
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          is_unavailable?: boolean
          order_id: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          id?: string
          is_unavailable?: boolean
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          coupon_code: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          discount_amount: number
          governorate_id: string | null
          governorate_name: string
          id: string
          landmark: string
          needs_customer_action: boolean
          notes: string
          order_number: number
          phone: string
          preferred_delivery_time: string
          shipping_fee: number
          status: string
          subtotal: number
          total_amount: number
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          discount_amount?: number
          governorate_id?: string | null
          governorate_name?: string
          id?: string
          landmark?: string
          needs_customer_action?: boolean
          notes?: string
          order_number?: number
          phone?: string
          preferred_delivery_time?: string
          shipping_fee?: number
          status?: string
          subtotal?: number
          total_amount?: number
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          discount_amount?: number
          governorate_id?: string | null
          governorate_name?: string
          id?: string
          landmark?: string
          needs_customer_action?: boolean
          notes?: string
          order_number?: number
          phone?: string
          preferred_delivery_time?: string
          shipping_fee?: number
          status?: string
          subtotal?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_governorate_id_fkey"
            columns: ["governorate_id"]
            isOneToOne: false
            referencedRelation: "governorates"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          catalog_pdf_url: string | null
          category_id: string | null
          created_at: string
          deal_ends_at: string | null
          description_ar: string
          description_en: string
          discount_price: number | null
          id: string
          image_url: string | null
          images: string[]
          is_featured: boolean
          name_ar: string
          name_en: string
          price: number
          sku: string
          stock_qty: number
        }
        Insert: {
          catalog_pdf_url?: string | null
          category_id?: string | null
          created_at?: string
          deal_ends_at?: string | null
          description_ar?: string
          description_en?: string
          discount_price?: number | null
          id?: string
          image_url?: string | null
          images?: string[]
          is_featured?: boolean
          name_ar: string
          name_en?: string
          price?: number
          sku?: string
          stock_qty?: number
        }
        Update: {
          catalog_pdf_url?: string | null
          category_id?: string | null
          created_at?: string
          deal_ends_at?: string | null
          description_ar?: string
          description_en?: string
          discount_price?: number | null
          id?: string
          image_url?: string | null
          images?: string[]
          is_featured?: boolean
          name_ar?: string
          name_en?: string
          price?: number
          sku?: string
          stock_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_name: string
          comment: string
          created_at: string
          id: string
          is_approved: boolean
          product_id: string
          rating: number
          user_id: string
        }
        Insert: {
          author_name?: string
          comment?: string
          created_at?: string
          id?: string
          is_approved?: boolean
          product_id: string
          rating?: number
          user_id: string
        }
        Update: {
          author_name?: string
          comment?: string
          created_at?: string
          id?: string
          is_approved?: boolean
          product_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_components: {
        Row: {
          brand: string
          capacity: number
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name_ar: string
          name_en: string
          price: number
          sort_order: number
          tier: string
          voltage: number
        }
        Insert: {
          brand?: string
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          name_ar: string
          name_en?: string
          price?: number
          sort_order?: number
          tier?: string
          voltage?: number
        }
        Update: {
          brand?: string
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name_ar?: string
          name_en?: string
          price?: number
          sort_order?: number
          tier?: string
          voltage?: number
        }
        Relationships: []
      }
      stock_alerts: {
        Row: {
          created_at: string
          id: string
          is_notified: boolean
          phone: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_notified?: boolean
          phone: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_notified?: boolean
          phone?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value?: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          admin_reply: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          phone: string
          replied_at: string | null
          sender_name: string
          user_id: string
        }
        Insert: {
          admin_reply?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          phone?: string
          replied_at?: string | null
          sender_name?: string
          user_id: string
        }
        Update: {
          admin_reply?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          phone?: string
          replied_at?: string | null
          sender_name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      notify_admins: {
        Args: { _body: string; _order_id?: string; _title: string }
        Returns: undefined
      }
      popular_products: {
        Args: { _limit?: number }
        Returns: {
          orders_count: number
          product_id: string
        }[]
      }
      track_order: {
        Args: { _order_number: number; _phone: string }
        Returns: {
          created_at: string
          governorate_name: string
          items: Json
          order_number: number
          status: string
          total_amount: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "customer"
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
    Enums: {
      app_role: ["admin", "customer"],
    },
  },
} as const
