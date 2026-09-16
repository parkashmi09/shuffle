export type Field = { key: string; label: string; required?: boolean; pattern?: string; placeholder?: string }

export type Variant = {
  key: string
  label: string
  description: string
  configFields: Field[]
  secretFields: Field[]
}

export type CatalogueFeature = {
  key: string
  label: string
  category: string
  /** `policy` — always in force, no switch; its "off" is the `none` variant. */
  kind: 'feature' | 'policy'
  defaultVariant: string
  flag: string | null
  variants: Variant[]
}

export type Template = { key: string; label: string; description: string; variants: Record<string, string> }

export type Catalogue = { features: CatalogueFeature[]; templates: Template[] }

export type SiteFeature = {
  feature: string
  label: string
  category: string
  kind: 'feature' | 'policy'
  /** Nothing stored — reading the permissive default. */
  isDefault: boolean
  flag: string | null
  enabled: boolean
  variant: string
  variantLabel: string
  config: Record<string, string>
  secretsSet: Record<string, boolean>
  updatedBy: string | null
  updatedAt: string | null
}

export type SiteFeatures = { template: string | null; features: SiteFeature[] }

export type FeaturesResponse = { catalogue: Catalogue; current: SiteFeatures }

export const CATEGORY_LABELS: Record<string, string> = {
  business: 'Business & payments',
  engagement: 'Engagement',
  wallet: 'Wallet',
  casino: 'Casino',
  content: 'Content',
  integration: 'Integrations'
}

export const CATEGORY_ORDER = ['business', 'engagement', 'wallet', 'casino', 'content', 'integration']
