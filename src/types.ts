export interface ProxyConfig {
  user: string;
  pass: string;
  isp: "Verizon" | "AT&T";
  state?: string;
  count: number;
  attempts: number;
  timeout: number;
  workers: number;
}

export interface ProxyResult {
  id: string;
  city: string;
  username: string;
  ip: string;
  stateHint?: string;
  lat?: number;
  lon?: number;
  ping?: number;
  status: "active" | "failed" | "pending";
  phoneNumber?: string;
  smsCode?: string;
  orderId?: string;
  email?: string;
  emailUrl?: string;
  emailPassword?: string;
  emailId?: number;
  emailConsumed?: boolean;
  nearbyPlace?: string;
  jobTitle?: string;
  hingePrompts?: Record<string, string[]>;
  note?: string;
  fraudScore?: number;
  fraudRisk?: string;
}

export interface DaisySMSConfig {
  apiKey: string;
  service: string;
  carriers?: string;
  maxPrice?: string;
}

export interface Account {
  id: number;
  user_id: number;
  proxy_ip: string;
  proxy_port: number;
  proxy_username: string;
  proxy_city: string;
  phone_number?: string;
  order_id?: string;
  sms_code?: string;
  sms_status: 'not_requested' | 'waiting' | 'received' | 'timeout';
  fraud_score?: number;
  fraud_risk?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CityChoice {
  display: string;
  state_token: string;
  city_token: string;
}
