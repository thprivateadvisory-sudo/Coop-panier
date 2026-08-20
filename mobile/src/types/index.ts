export type UserRole = 'contributor' | 'beneficiary' | 'association';

export type SubscriptionTier = 'free' | 'essentiel' | 'engagement';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
  city?: string;
  created_at: string;
}

export interface ContributorProfile {
  profile_id: string;
  points_total: number;
  points_available: number;
  subscription_tier: SubscriptionTier;
  subscription_expires_at?: string;
  stripe_customer_id?: string;
  tickets_scanned: number;
  baskets_funded: number;
}

export interface BeneficiaryProfile {
  profile_id: string;
  qr_code: string;
  pickup_point_id?: string;
  status: 'waitlist' | 'active' | 'suspended';
  baskets_received: number;
  next_pickup_date?: string;
}

export interface AssociationProfile {
  profile_id: string;
  association_name: string;
  siret?: string;
  address: string;
  city: string;
  postal_code: string;
  validated: boolean;
}

export interface PickupPoint {
  id: string;
  association_profile_id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  opening_hours: Record<string, string>;
  active: boolean;
}

export interface Receipt {
  id: string;
  contributor_id: string;
  image_url: string;
  store_name?: string;
  total_amount?: number;
  purchase_date?: string;
  points_earned: number;
  status: 'pending' | 'validated' | 'rejected';
  ocr_confidence?: number;
  created_at: string;
}

export interface Basket {
  id: string;
  value_eur: number;
  points_required: number;
  funded_by_profile_id?: string;
  beneficiary_profile_id?: string;
  pickup_point_id?: string;
  status: 'funding' | 'funded' | 'assigned' | 'distributed';
  funded_at?: string;
  distributed_at?: string;
  created_at: string;
}

export interface ImpactStats {
  id: string;
  baskets_distributed: number;
  families_helped: number;
  cities_covered: number;
  total_contributors: number;
  total_beneficiaries: number;
  total_points_issued: number;
  updated_at: string;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  city?: string;
  created_at: string;
}

export interface PointTransaction {
  id: string;
  profile_id: string;
  amount: number;
  type: 'earn_scan' | 'earn_purchase' | 'earn_bonus' | 'spend_basket' | 'expire';
  reference_id?: string;
  description: string;
  created_at: string;
}
