import axios from 'axios';
import { CityChoice, ProxyResult } from '../types';

const GATEWAY_HOST = "v2.proxyempire.io";
const GATEWAY_PORT = 5000;
const TEST_URL = "https://api.ipify.org?format=json";
const GEO_URL = "http://ip-api.com/json/{ip}?fields=status,city,regionName,region,lat,lon";

export const normalizeToken = (s: string) => {
  return (s || "").toLowerCase().trim().replace(/ /g, "+").replace(/[^a-z0-9+&_-]/g, "");
};

export const stripToBaseUser = (user: string) => {
  let u = (user || "").trim();
  const markers = ["-country-", "-region-", "-city-", "-isp-", "-sid-"];
  for (const m of markers) {
    const idx = u.indexOf(m);
    if (idx !== -1) {
      u = u.substring(0, idx);
    }
  }
  return u;
};

export const buildUsername = (base: string, state: string | null, city: string | null, sid: string, ispToken: string) => {
  const parts = [stripToBaseUser(base), "country-us"];
  if (state) parts.push(`region-${state}`);
  if (city) parts.push(`city-${city}`);
  parts.push(`isp-${ispToken}`);
  parts.push(`sid-${sid}`);
  return parts.join("-");
};

// DaisySMS Service
export class DaisySMSService {
  private apiKey: string;
  private baseUrl = "/api/daisysms";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getNumber(service: string, carriers?: string, maxPrice?: string): Promise<{ id: string; number: string }> {
    const params = new URLSearchParams();
    params.append("api_key", this.apiKey);
    params.append("action", "getNumber");
    params.append("service", service);
    
    if (carriers && carriers.trim() !== "") {
      params.append("carriers", carriers.trim());
    }
    
    if (maxPrice && maxPrice.trim() !== "") {
      const sanitizedPrice = maxPrice.trim().replace(",", ".");
      params.append("max_price", sanitizedPrice);
    }
    
    const response = await axios.get(`${this.baseUrl}?${params.toString()}`);
    const data = String(response.data);
    
    if (data.startsWith("ACCESS_NUMBER")) {
      const parts = data.split(":");
      return { id: parts[1], number: parts[2] };
    }
    
    throw new Error(data);
  }

  async getStatus(id: string): Promise<{ status: string; code?: string }> {
    const params = new URLSearchParams();
    params.append("api_key", this.apiKey);
    params.append("action", "getStatus");
    params.append("id", id);

    const response = await axios.get(`${this.baseUrl}?${params.toString()}`);
    const data = response.data as string;

    if (data.startsWith("STATUS_OK")) {
      const [, code] = data.split(":");
      return { status: "OK", code };
    }
    
    if (data === "STATUS_WAIT_CODE") {
      return { status: "WAIT" };
    }

    if (data === "STATUS_CANCEL") {
      return { status: "CANCELLED" };
    }

    return { status: "UNKNOWN", code: data };
  }
}

// Nearby City Logic
export const getNearbyPlaces = async (lat: number, lon: number): Promise<string[]> => {
  const query = `
    [out:json][timeout:12];
    (
      node["place"~"city|town|village|suburb|hamlet|neighbourhood|locality"](around:25000,${lat},${lon});
      way["place"~"city|town|village|suburb|hamlet|neighbourhood|locality"](around:25000,${lat},${lon});
      relation["place"~"city|town|village|suburb|hamlet|neighbourhood|locality"](around:25000,${lat},${lon});
    );
    out tags;
  `;
  
  try {
    const response = await axios.post("/api/overpass", { query });
    const elements = response.data.elements || [];
    const names = elements.map((el: any) => el.tags?.name).filter(Boolean);
    return Array.from(new Set(names)) as string[];
  } catch (error) {
    console.error("Overpass Error:", error);
    return [];
  }
};
