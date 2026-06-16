/** Domain types mirroring the Supabase schema (supabase/migrations). */

export type SkinType = 'normal' | 'dry' | 'oily' | 'combination' | 'sensitive';

export interface Profile {
  id: string;
  display_name: string | null;
  is_guest: boolean;
  skin_type: SkinType | null;
  goals: string[];
  onboarded_at: string | null;
}

export interface Concern {
  slug: string;
  name: string;
  blurb: string;
  icon: string;
  severity_descriptors: { max: number; label: string; note: string }[];
}

export type ProductCategory =
  | 'cleanser'
  | 'exfoliant'
  | 'toner'
  | 'serum'
  | 'moisturizer'
  | 'spf'
  | 'treatment'
  | 'mask'
  | 'eye-cream'
  | 'supplement';

export interface RetailerLink {
  retailer: string;
  url: string;
}

export interface Product {
  id: string;
  slug: string;
  brand: string;
  name: string;
  category: ProductCategory;
  description: string;
  key_ingredients: string[];
  price_usd: number | null;
  image_url: string | null;
  retailer_links: RetailerLink[];
  skin_types: string[];
  am_pm: 'am' | 'pm' | 'both';
  step_order: number;
}

export interface ProductForConcern extends Product {
  relevance: number;
  rationale: string | null;
}

export interface ScanConcern {
  concern_slug: string;
  display_name: string;
  severity: number;
  confidence: number;
  areas: string[];
  observations: string;
  caution: string | null;
}

export type ScanStatus = 'pending' | 'analyzing' | 'complete' | 'failed';

export interface Scan {
  id: string;
  user_id: string;
  image_path: string | null;
  status: ScanStatus;
  skin_score: number | null;
  skin_type_estimate: SkinType | null;
  summary: string | null;
  concerns: ScanConcern[];
  area: string | null;
  notes: string | null;
  created_at: string;
}

export interface NutritionGuide {
  concern_slug: string;
  overview: string;
  foods: { food: string; why: string; nutrients: string[] }[];
  nutrients: { nutrient: string; evidence: string; dose_note: string }[];
  avoid: { item: string; why: string }[];
  citations: { label: string; source: string; url: string }[];
}

export interface Tip {
  id: string;
  concern_slug: string;
  title: string;
  body: string;
  category: 'habit' | 'application' | 'environment' | 'myth';
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  category: string;
  read_minutes: number;
  hero_gradient: string;
  excerpt: string;
  body_md: string;
  citations: { label: string; source: string; url: string }[];
  published_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  summary: string | null;
  last_message_at: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  product_refs: string[];
  created_at: string;
}

export type MemoryType = 'profile_fact' | 'preference' | 'event' | 'gotcha' | 'goal';

export interface AiMemory {
  id: string;
  type: MemoryType;
  content: string;
  importance: number;
  source: 'chat' | 'scan' | 'onboarding' | 'system';
  created_at: string;
  updated_at: string;
}

export interface Routine {
  id: string;
  period: 'am' | 'pm';
  generated_from_scan: string | null;
  updated_at: string;
}

export interface RoutineStep {
  id: string;
  routine_id: string;
  position: number;
  product_id: string | null;
  custom_name: string | null;
  instruction: string;
  frequency: 'daily' | 'every-other-day' | '2-3x-week' | 'weekly';
  /** Joined product row when present. */
  product?: Product | null;
}

export interface RoutineCheckin {
  id: string;
  routine_id: string;
  checkin_date: string;
}

export interface ReminderSettings {
  user_id: string;
  am_time: string;
  pm_time: string;
  enabled: boolean;
}

export type PollenLevel = 'low' | 'moderate' | 'high' | 'very-high';

/** Today's environmental readings that drive a Skin Weather forecast. */
export interface ForecastEnvironment {
  /** UV index, 0–11+. */
  uv_index: number;
  /** Relative humidity, 0–100%. */
  humidity: number;
  /** Current temperature, °C. */
  temp_c: number;
  /** Day high − low, °C — large swings stress the barrier. */
  temp_swing_c: number;
  /** US AQI, 0–500. */
  air_quality_index: number;
  pollen_level: PollenLevel;
  /** Plain-language sky condition, e.g. "Clear", "Overcast". */
  condition: string;
}

/** A single actionable routine adjustment for today. */
export type ForecastActionKind = 'add' | 'swap' | 'skip' | 'maintain';

export interface ForecastGuidance {
  kind: ForecastActionKind;
  text: string;
}

/** A personalized environmental skin forecast — one per user per day. */
export interface SkinForecast {
  id: string;
  forecast_date: string;
  location_label: string;
  environment: ForecastEnvironment;
  headline: string;
  summary: string;
  guidance: ForecastGuidance[];
  created_at: string;
}

export type ShelfItemStatus = 'active' | 'finished' | 'archived';

/** A product the user owns — one row in their Shelf inventory. */
export interface ShelfItem {
  id: string;
  product_id: string | null;
  name: string;
  brand: string | null;
  category: ProductCategory | null;
  key_ingredients: string[];
  image_path: string | null;
  size_label: string | null;
  /** ISO date the product was opened — drives PAO expiry. */
  opened_at: string | null;
  shelf_life_months: number | null;
  /** Rough percentage left, 0–100. */
  amount_remaining: number;
  times_used: number;
  last_used_at: string | null;
  status: ShelfItemStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** One flagged ingredient interaction from the conflict checker. */
export interface IngredientConflict {
  severity: 'avoid' | 'caution' | 'time_of_day';
  /** The specific ingredients involved in the interaction. */
  ingredients: string[];
  /** Names of the user's shelf items that contain those ingredients. */
  products: string[];
  reason: string;
  citation: string;
  recommendation: string;
}

/** Result of an AI-driven conflict analysis across the user's active shelf. */
export interface ConflictReport {
  conflicts: IngredientConflict[];
  checkedAt: string;
}

/** What the AI reads off a product label when adding to the Shelf. */
export interface ProductIdentification {
  /** True when the image is not a skincare product. */
  not_product: boolean;
  reject_reason: string | null;
  name: string;
  brand: string | null;
  category: ProductCategory | null;
  key_ingredients: string[];
  /** Typical period-after-opening for this product type, in months. */
  shelf_life_months: number | null;
  /** Catalog slug when the label matches a known product, else null. */
  matched_slug: string | null;
  confidence: number;
}
