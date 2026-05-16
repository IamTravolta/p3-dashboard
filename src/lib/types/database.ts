export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      positions: {
        Row: {
          id: string
          user_id: string
          ticker: string
          name: string
          exchange: string
          sector: string
          sub_industry: string | null
          shares: number
          avg_buy_price: number
          current_price: number
          currency: string
          factor_scores: Json
          conviction: number
          thesis: string | null
          notes: string | null
          added_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['positions']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['positions']['Insert']>
        Relationships: []
      }
      watchlist: {
        Row: {
          id: string
          user_id: string
          ticker: string
          name: string
          exchange: string
          sector: string
          sub_industry: string | null
          current_price: number
          score: number
          factor_scores: Json
          reason: string | null
          price_trigger: number | null
          score_trigger: number | null
          conviction: number
          expiry_date: string | null
          added_at: string
        }
        Insert: Omit<Database['public']['Tables']['watchlist']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['watchlist']['Insert']>
        Relationships: []
      }
      signals: {
        Row: {
          id: string
          user_id: string
          ticker: string
          module_name: string
          value: string
          confidence: number
          reasoning: string | null
          raw_data: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['signals']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['signals']['Insert']>
        Relationships: []
      }
      verdicts: {
        Row: {
          id: string
          user_id: string
          ticker: string
          final_verdict: string
          confidence: number
          modules_snapshot: Json
          initial_price: number
          logged_at: string
        }
        Insert: Omit<Database['public']['Tables']['verdicts']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['verdicts']['Insert']>
        Relationships: []
      }
      verdict_outcomes: {
        Row: {
          id: string
          verdict_id: string
          days_since: number
          price_then: number
          price_change_pct: number
          outcome: 'correct' | 'wrong' | 'neutral' | 'missed_gain'
          evaluated_at: string
        }
        Insert: Omit<Database['public']['Tables']['verdict_outcomes']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['verdict_outcomes']['Insert']>
        Relationships: []
      }
      conviction_snapshots: {
        Row: {
          id: string
          user_id: string
          ticker: string
          score: number
          factor_scores: Json
          logged_at: string
        }
        Insert: Omit<Database['public']['Tables']['conviction_snapshots']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['conviction_snapshots']['Insert']>
        Relationships: []
      }
      behavioral_log: {
        Row: {
          id: string
          user_id: string
          action_type: string
          ticker: string | null
          system_recommendation: string | null
          user_action: string
          followed_advice: boolean | null
          context: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['behavioral_log']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['behavioral_log']['Insert']>
        Relationships: []
      }
      signal_reliability: {
        Row: {
          id: string
          user_id: string
          module_signal_key: string
          total: number
          correct_30d: number
          correct_60d: number
          correct_90d: number
          wrong_30d: number
          accuracy_30d: number | null
          last_updated: string
        }
        Insert: Omit<Database['public']['Tables']['signal_reliability']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['signal_reliability']['Insert']>
        Relationships: []
      }
      briefings: {
        Row: {
          id: string
          user_id: string
          content: string
          context_hash: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['briefings']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['briefings']['Insert']>
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          ticker: string | null
          message: string
          triggered_at: string
          sent_at: string | null
          read_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
        Relationships: []
      }
      volume_snapshots: {
        Row: {
          id: string
          user_id: string
          ticker: string
          volume: number
          avg_volume_20d: number | null
          relative_volume: number | null
          price: number
          direction: 'up' | 'down' | 'flat'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['volume_snapshots']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['volume_snapshots']['Insert']>
        Relationships: []
      }
      speculation_scores: {
        Row: {
          id: string
          user_id: string
          ticker: string
          speculation_score: number
          beta: number | null
          momentum_score: number | null
          valuation_score: number | null
          iv_rank: number | null
          logged_at: string
        }
        Insert: Omit<Database['public']['Tables']['speculation_scores']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['speculation_scores']['Insert']>
        Relationships: []
      }
      paper_trades: {
        Row: {
          id: string
          user_id: string
          ticker: string
          name: string
          action: 'BUY' | 'SELL' | 'TRIM'
          shares: number
          entry_price: number
          entry_date: string
          entry_timestamp: number
          stop_loss: number | null
          target_1: number | null
          target_2: number | null
          verdict_snapshot: Json | null
          evaluations: Json
          status: 'open' | 'closed'
          closed_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['paper_trades']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['paper_trades']['Insert']>
        Relationships: []
      }
      thesis_log: {
        Row: {
          id: string
          user_id: string
          ticker: string
          thesis_text: string
          conviction: number
          updated_at: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['thesis_log']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['thesis_log']['Insert']>
        Relationships: []
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

// ============================================================
// App-level types (mirror the existing HTML dashboard state)
// ============================================================

export interface FactorScores {
  q: number  // quality
  g: number  // growth
  v: number  // valuation
  m: number  // momentum
  s: number  // sentiment
}

export interface Position {
  id: string
  ticker: string
  name: string
  exchange: string
  sector: string
  subIndustry: string
  shares: number
  avgBuyPrice: number
  currentPrice: number
  currency: string
  factorScores: FactorScores
  conviction: number
  thesis: string
  notes: string
  addedDate: string
  weight?: number
  score?: number
}

export interface WatchlistItem {
  id: string
  ticker: string
  name: string
  exchange: string
  sector: string
  subIndustry: string
  currentPrice: number
  score: number
  factorScores: FactorScores
  reason: string
  priceTrigger: number | null
  scoreTrigger: number | null
  conviction: number
  expiryDate: string | null
  addedDate: string
}

export interface PortfolioSettings {
  weights: {
    quality: number
    growth: number
    valuation: number
    momentum: number
    sentiment: number
  }
  caps: {
    singleName: number
    sector: number
    regionUS: number
    regionEU: number
    USD: number
    cash: number
  }
  currency: string
}

export interface BehavioralLogEntry {
  actionType: string
  ticker?: string
  systemRecommendation?: string
  userAction: string
  followedAdvice?: boolean
  context?: Record<string, unknown>
}

export interface SoldPosition {
  ticker: string
  soldDate: string
  soldPrice: number
  avgBuyPrice: number
  reasonCategory: string
  reasonText: string
  coolOffUntil: string
  evaluations: Array<{
    daysSince: number
    priceThen: number
    priceChangePct: number
    verdict: string
    evaluatedAt: number
  }>
}

// Legacy localStorage state shape — used for migration
export interface LegacyDashboardState {
  portfolio: Position[]
  watchlist: WatchlistItem[]
  settings: PortfolioSettings
  signals: Record<string, unknown>
  soldPositions: SoldPosition[]
  verdictHistory: unknown[]
  signalReliability: Record<string, unknown>
  cash?: number
  alerts?: unknown[]
  paperTrades?: unknown[]
}
