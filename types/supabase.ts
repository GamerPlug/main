export type UserRole = 'admin' | 'dealer' | 'agent'
export type UserStatus = 'active' | 'suspended' | 'inactive'
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type PaymentStatus = 'paid' | 'unpaid' | 'refunded'
export type TransactionType = 'credit' | 'debit'
export type TransactionStatus = 'pending' | 'completed' | 'failed'
export type ComplaintStatus = 'pending' | 'in_review' | 'resolved' | 'rejected'
// Coarse buckets used for preference gating + UI grouping.
// Account events (suspend/role/api-key) and security events both live under 'security'.
export type NotificationCategory =
    | 'order'
    | 'payment'
    | 'security'
    | 'announcement'
    | 'marketing'
    | 'system'

export type NotificationPriority = 'low' | 'normal' | 'high'

export type NotificationType =
    // Orders
    | 'order_placed'
    | 'order_processing'
    | 'order_completed'
    | 'order_failed'
    | 'order_update' // legacy alias, kept for backward compatibility
    // Money
    | 'payment_success'
    | 'refund_issued'
    | 'balance_credited'
    | 'balance_debited'
    | 'balance_updated' // legacy alias
    | 'low_balance'
    | 'credit_limit_reached'
    | 'settlement_due'
    // Complaints
    | 'complaint_received'
    | 'complaint_resolved'
    | 'complaint_rejected'
    // Account & security
    | 'account_suspended'
    | 'account_reactivated'
    | 'role_upgraded'
    | 'role_downgraded'
    | 'security_new_login'
    | 'security_password_changed'
    | 'api_key_created'
    | 'api_key_revoked'
    // Broadcast & marketing
    | 'announcement'
    | 'promo'
    | 'new_package'
    | 'price_drop'
    | 'renewal_reminder'
    // Admin-facing (sent to admins/sub-admins)
    | 'admin_new_order'
    | 'admin_new_registration'
    // Fallback
    | 'system'
    | string

export interface User {
    id: string
    email: string
    first_name: string
    last_name: string
    phone_number: string
    role: UserRole
    status: UserStatus
    requires_settlement?: boolean
    created_at: string
    updated_at: string
    wallets?: {
        balance: number
        credit_limit?: number
        unlimited_credit?: boolean
    }
}

export interface Wallet {
    id: string
    user_id: string
    balance: number
    total_credited: number
    total_spent: number
    credit_limit: number
    unlimited_credit: boolean
    updated_at: string
}

export interface DataPackage {
    id: string
    network: 'MTN' | 'Telecel' | 'AT-iShare' | 'AT-BigTime'
    size: string
    price: number
    dealer_price?: number
    agent_price?: number
    cost_price?: number
    description?: string
    is_available: boolean
    sort_order: number
    created_at: string
}

export interface UserPackagePricing {
    id: string
    user_id: string
    package_id: string
    custom_price: number
    note?: string
    created_by?: string
    created_at: string
    updated_at: string
}

export interface Order {
    id: string
    user_id?: string
    package_id?: string
    reference_code: string
    phone_number: string
    network: string
    size: string
    amount: number
    price: number
    cost_price?: number
    status: OrderStatus
    payment_status: PaymentStatus
    reference?: string
    fulfillment_method?: string
    email?: string
    customer_phone?: string
    provider_ref?: string
    created_at: string
    updated_at: string
    complaints?: Complaint[]
}

export interface WalletPayment {
    id: string
    wallet_id: string
    user_id: string
    reference: string
    amount: number
    fee: number
    total_amount: number
    provider: string
    provider_reference?: string
    status: 'pending' | 'success' | 'failed'
    metadata?: Record<string, unknown>
    created_at: string
    updated_at: string
}

export interface WalletTransaction {
    id: string
    wallet_id: string
    user_id: string
    type: TransactionType
    amount: number
    description: string
    reference?: string
    source: string
    status: TransactionStatus
    created_at: string
}

export interface Notification {
    id: string
    user_id: string
    title: string
    message: string
    type: NotificationType
    is_read: boolean
    action_url?: string
    read_at?: string | null
    priority?: NotificationPriority
    metadata?: Record<string, unknown> | null
    created_at: string
}

export interface PushSubscriptionRecord {
    id: string
    user_id: string
    endpoint: string
    p256dh: string
    auth: string
    user_agent?: string | null
    created_at: string
    last_used_at: string
}

export interface NotificationPreferences {
    user_id: string
    order_updates: boolean
    payments: boolean
    security: boolean
    announcements: boolean
    marketing: boolean
    push_enabled: boolean
    updated_at: string
}

export interface Complaint {
    id: string
    user_id: string
    order_id: string
    title: string
    description: string
    status: ComplaintStatus
    admin_response?: string
    resolution_notes?: string
    created_at: string
    updated_at: string
    users?: {
        first_name: string
        last_name: string
        email: string
    }
    orders?: {
        reference_code: string
        created_at?: string
        phone_number: string
        network: string
        size: string
        price?: number
        status?: string
    } | null
}

export interface SystemAnnouncement {
    id: string
    title: string
    message: string
    is_active: boolean
    target_role?: 'all' | 'admin' | 'dealer' | 'agent'
    send_push?: boolean
    created_at: string
    updated_at: string
}

export interface CustomerPurchase {
    id: string
    user_id: string
    customer_phone: string
    total_purchases: number
    total_spent: number
    first_purchase_at: string
    last_purchase_at: string
    created_at: string
}

export interface ApiKey {
    id: string
    user_id: string
    name: string
    key_prefix: string
    is_active: boolean
    last_used_at?: string
    expires_at?: string
    created_at: string
}

export interface DownloadBatch {
    id: string
    filename: string
    network?: string
    order_count: number
    created_at: string
    created_by: string
}

export interface ProfitRecord {
    id: string
    order_id: string
    user_id: string
    network: string
    sale_price: number
    cost_price: number
    profit: number
    created_at: string
}

export type Database = any
