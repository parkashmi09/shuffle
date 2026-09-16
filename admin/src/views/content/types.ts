/** Row shapes for the content area — mirrors the admin-service banners / blogs / notifications mappers. */

export type Banner = {
  id: number
  type: string
  contentType: string | null
  byteSize: number | null
  active: boolean
  uploadedBy: number | string | null
  title: string | null
  subtitle: string | null
  cta: { label: string; href: string } | null
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
  url?: string
}

export type Blog = {
  id: number
  slug: string
  title: string
  subheading: string | null
  author: string | null
  category: string | null
  date: string | null
  published: boolean
  publishedAt: string | null
  imageUrl: string | null
  contentType: string | null
  byteSize: number | null
  createdAt: string | null
  updatedAt: string | null
  /** Only on `GET /blogs/:id`. */
  description?: string
}

export const NOTIFICATION_TYPES = ['general', 'deposit', 'withdrawal', 'bonus', 'bet', 'promotion'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export type Device = {
  id: number
  userId: number | string
  name: string | null
  email: string | null
  platform: string | null
  active: boolean
  token: string
  registeredAt: string | null
}

export type NotificationRow = {
  id: number
  title: string
  body: string | null
  type: string
  data: Record<string, unknown> | null
  read: boolean
  readAt: string | null
  delivered: boolean
  createdAt: string | null
}
