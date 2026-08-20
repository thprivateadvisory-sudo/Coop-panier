export type UserRole = 'contributor' | 'beneficiary' | 'association';
export type SubscriptionTier = 'free' | 'essentiel' | 'engagement';
export type BasketStatus = 'funding' | 'funded' | 'assigned' | 'distributed';
export type BeneficiaryStatus = 'waitlist' | 'active' | 'suspended';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  city?: string;
  created_at: string;
}

export interface ContributorProfile {
  profile_id: string;
  points_total: number;
  points_available: number;
  subscription_tier: SubscriptionTier;
  subscription_expires_at?: string;
  tickets_scanned: number;
  baskets_funded: number;
}

export interface BeneficiaryProfile {
  profile_id: string;
  qr_code: string;
  status: BeneficiaryStatus;
  baskets_received: number;
  pickup_point_id?: string;
  next_pickup_date?: string;
}

export interface AssociationProfile {
  profile_id: string;
  name: string;
  siret?: string;
  validated: boolean;
}

export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  opening_hours?: Record<string, string>;
  association_profile_id: string;
  active: boolean;
}

export interface ImpactStats {
  id: number;
  total_contributors: number;
  total_beneficiaries: number;
  baskets_distributed: number;
  total_points_issued: number;
  families_helped: number;
}
