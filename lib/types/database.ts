export type Database = {
  public: {
    Tables: {
      cities: {
        Row: {
          slug: string
          name_bg: string
          is_village: boolean
        }
        Insert: {
          slug: string
          name_bg: string
          is_village?: boolean
        }
        Update: {
          slug?: string
          name_bg?: string
          is_village?: boolean
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
          address: string | null
          start_date: string
          end_date: string | null
          start_time: string | null
          end_time: string | null
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
          address?: string | null
          start_date: string
          end_date?: string | null
          start_time?: string | null
          end_time?: string | null
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
          address?: string | null
          start_date?: string
          end_date?: string | null
          start_time?: string | null
          end_time?: string | null
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
          is_hero: boolean
        }
        Insert: {
          id?: string
          festival_id: string
          url: string
          type: string
          caption?: string | null
          sort_order?: number | null
          is_hero?: boolean
        }
        Update: {
          id?: string
          festival_id?: string
          url?: string
          type?: string
          caption?: string | null
          sort_order?: number | null
          is_hero?: boolean
        }
      }
      organizers: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          logo_url: string | null
          website_url: string | null
          facebook_url: string | null
          instagram_url: string | null
          email: string | null
          phone: string | null
          verified: boolean | null
          city_id: number | null
          claimed_events_count: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          logo_url?: string | null
          website_url?: string | null
          facebook_url?: string | null
          instagram_url?: string | null
          email?: string | null
          phone?: string | null
          verified?: boolean | null
          city_id?: number | null
          claimed_events_count?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          logo_url?: string | null
          website_url?: string | null
          facebook_url?: string | null
          instagram_url?: string | null
          email?: string | null
          phone?: string | null
          verified?: boolean | null
          city_id?: number | null
          claimed_events_count?: number | null
          created_at?: string | null
        }
      }
      organizer_members: {
        Row: {
          id: string
          organizer_id: string
          user_id: string
          role: string
          status: string
          created_at: string
          approved_at: string | null
          approved_by: string | null
        }
        Insert: {
          id?: string
          organizer_id: string
          user_id: string
          role: string
          status: string
          created_at?: string
          approved_at?: string | null
          approved_by?: string | null
        }
        Update: {
          id?: string
          organizer_id?: string
          user_id?: string
          role?: string
          status?: string
          created_at?: string
          approved_at?: string | null
          approved_by?: string | null
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
          platform?: string | null
          invalidated_at?: string | null
        }
        Insert: {
          user_id: string
          token: string
          platform?: string | null
          invalidated_at?: string | null
        }
        Update: {
          user_id?: string
          token?: string
          platform?: string | null
          invalidated_at?: string | null
        }
      }
      user_notification_settings: {
        Row: {
          user_id: string
          notify_plan_reminders: boolean
          notify_new_festivals_city: boolean
          notify_new_festivals_category: boolean
          notify_followed_organizers: boolean
          notify_weekend_digest: boolean
          push_enabled: boolean
          only_saved: boolean
          quiet_hours_start: string | null
          quiet_hours_end: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          notify_plan_reminders?: boolean
          notify_new_festivals_city?: boolean
          notify_new_festivals_category?: boolean
          notify_followed_organizers?: boolean
          notify_weekend_digest?: boolean
          push_enabled?: boolean
          only_saved?: boolean
          quiet_hours_start?: string | null
          quiet_hours_end?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          notify_plan_reminders?: boolean
          notify_new_festivals_city?: boolean
          notify_new_festivals_category?: boolean
          notify_followed_organizers?: boolean
          notify_weekend_digest?: boolean
          push_enabled?: boolean
          only_saved?: boolean
          quiet_hours_start?: string | null
          quiet_hours_end?: string | null
          created_at?: string
        }
      }
      notification_jobs: {
        Row: {
          id: string
          user_id: string
          festival_id: string | null
          job_type: string
          scheduled_for: string
          dedupe_key: string
          payload_json: Record<string, unknown>
          status: string
          retry_count: number
          priority: string
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          festival_id?: string | null
          job_type: string
          scheduled_for: string
          dedupe_key: string
          payload_json?: Record<string, unknown>
          status?: string
          retry_count?: number
          priority?: string
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          festival_id?: string | null
          job_type?: string
          scheduled_for?: string
          dedupe_key?: string
          payload_json?: Record<string, unknown>
          status?: string
          retry_count?: number
          priority?: string
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      notification_logs: {
        Row: {
          id: string
          job_id: string
          user_id: string
          status: string
          response: Record<string, unknown> | null
          duration_ms: number | null
          priority: string | null
          notification_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          user_id: string
          status: string
          response?: Record<string, unknown> | null
          duration_ms?: number | null
          priority?: string | null
          notification_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          user_id?: string
          status?: string
          response?: Record<string, unknown> | null
          duration_ms?: number | null
          priority?: string | null
          notification_type?: string | null
          created_at?: string
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
