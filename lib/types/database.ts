export type Database = {
  public: {
    Tables: {
      cities: {
        Row: {
          slug: string
          name_bg: string
        }
        Insert: {
          slug: string
          name_bg: string
        }
        Update: {
          slug?: string
          name_bg?: string
        }
      }
      festivals: {
        Row: {
          id: string
          title: string
          slug: string
          description: string
          city: string
          city_id: number | null
          region: string
          address: string | null
          start_date: string
          end_date: string | null
          category: string
          category_slug: string
          image_url: string
          is_free: boolean
          status: string
          is_verified: boolean
          lat: number | null
          lng: number | null
          website_url: string | null
          ticket_url: string | null
          price_range: string | null
          tags: string[] | null
          organizer_id: string | null
          source_type: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          slug: string
          description: string
          city: string
          city_id?: number | null
          region: string
          address?: string | null
          start_date: string
          end_date?: string | null
          category: string
          category_slug: string
          image_url: string
          is_free: boolean
          status: string
          is_verified: boolean
          lat?: number | null
          lng?: number | null
          website_url?: string | null
          ticket_url?: string | null
          price_range?: string | null
          tags?: string[] | null
          organizer_id?: string | null
          source_type?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          description?: string
          city?: string
          city_id?: number | null
          region?: string
          address?: string | null
          start_date?: string
          end_date?: string | null
          category?: string
          category_slug?: string
          image_url?: string
          is_free?: boolean
          status?: string
          is_verified?: boolean
          lat?: number | null
          lng?: number | null
          website_url?: string | null
          ticket_url?: string | null
          price_range?: string | null
          tags?: string[] | null
          organizer_id?: string | null
          source_type?: string | null
          updated_at?: string | null
        }
      }
      festival_days: {
        Row: {
          id: string
          festival_id: string
          date: string
          title: string | null
        }
        Insert: {
          id?: string
          festival_id: string
          date: string
          title?: string | null
        }
        Update: {
          id?: string
          festival_id?: string
          date?: string
          title?: string | null
        }
      }
      festival_schedule_items: {
        Row: {
          id: string
          day_id: string
          start_time: string | null
          end_time: string | null
          stage: string | null
          title: string
          description: string | null
          sort_order: number | null
        }
        Insert: {
          id?: string
          day_id: string
          start_time?: string | null
          end_time?: string | null
          stage?: string | null
          title: string
          description?: string | null
          sort_order?: number | null
        }
        Update: {
          id?: string
          day_id?: string
          start_time?: string | null
          end_time?: string | null
          stage?: string | null
          title?: string
          description?: string | null
          sort_order?: number | null
        }
      }
      festival_media: {
        Row: {
          id: string
          festival_id: string
          url: string
          type: string
          caption: string | null
          sort_order: number | null
        }
        Insert: {
          id?: string
          festival_id: string
          url: string
          type: string
          caption?: string | null
          sort_order?: number | null
        }
        Update: {
          id?: string
          festival_id?: string
          url?: string
          type?: string
          caption?: string | null
          sort_order?: number | null
        }
      }
      organizers: {
        Row: {
          id: string
        }
        Insert: {
          id?: string
        }
        Update: {
          id?: string
        }
      }
      profiles: {
        Row: {
          user_id: string
          display_name: string | null
          avatar_url: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          user_id: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          user_id?: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      user_favorites: {
        Row: {
          user_id: string
          festival_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          festival_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          festival_id?: string
          created_at?: string
        }
      }
      user_notifications: {
        Row: {
          id: string
          user_id: string
          festival_id: string
          type: string
          title: string
          body: string
          scheduled_for: string
          sent_at: string | null
          pushed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          festival_id: string
          type: string
          title: string
          body: string
          scheduled_for: string
          sent_at?: string | null
          pushed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          festival_id?: string
          type?: string
          title?: string
          body?: string
          scheduled_for?: string
          sent_at?: string | null
          pushed_at?: string | null
          created_at?: string
        }
      }
      user_plan_festivals: {
        Row: {
          user_id: string
          festival_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          festival_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          festival_id?: string
          created_at?: string
        }
      }
      user_plan_items: {
        Row: {
          user_id: string
          schedule_item_id: string
        }
        Insert: {
          user_id: string
          schedule_item_id: string
        }
        Update: {
          user_id?: string
          schedule_item_id?: string
        }
      }
      user_plan_reminders: {
        Row: {
          user_id: string
          festival_id: string
          reminder_type: string
        }
        Insert: {
          user_id: string
          festival_id: string
          reminder_type: string
        }
        Update: {
          user_id?: string
          festival_id?: string
          reminder_type?: string
        }
      }
      device_tokens: {
        Row: {
          user_id: string
          token: string
        }
        Insert: {
          user_id: string
          token: string
        }
        Update: {
          user_id?: string
          token?: string
        }
      }
      cron_locks: {
        Row: {
          name: string
          locked_at: string
        }
        Insert: {
          name: string
          locked_at: string
        }
        Update: {
          name?: string
          locked_at?: string
        }
      }
      ingest_jobs: {
        Row: {
          id: string
          source_type: string
          status: string
          started_at: string | null
          finished_at: string | null
          error_message: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          source_type: string
          status: string
          started_at?: string | null
          finished_at?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          source_type?: string
          status?: string
          started_at?: string | null
          finished_at?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string | null
        }
      }
      user_roles: {
        Row: {
          user_id: string
          role: string
        }
        Insert: {
          user_id: string
          role: string
        }
        Update: {
          user_id?: string
          role?: string
        }
      }
    }
  }
}
