import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield,
  Phone,
  MessageSquare,
  Plus,
  Search,
  RefreshCw,
  Copy,
  Trash2,
  Settings,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  User,
  MapPin,
  Briefcase,
  Lock,
  Unlock,
  LogOut,
  UserPlus,
  Mail,
  Upload,
  X,
  LayoutDashboard,
  Globe,
  Crown,
  UserCheck,
  UserX,
  Ban,
  ShieldCheck,
  Users,
  Sparkles,
  Heart,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ProxyConfig, ProxyResult, DaisySMSConfig, CityChoice } from './types';
import { DaisySMSService, getNearbyPlaces, normalizeToken, buildUsername, stripToBaseUser } from './services/api';
import { generateHingePrompts, JOB_TITLES } from './services/gemini';
import { FALLBACK_BIG_US_CITIES } from './constants';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_DAISY_KEY = "Xwcfb3FpxPOvCqwK1lQx5L5BzBtxZm";

const HINGE_PROMPTS_CATEGORIES = [
  {
    name: "About me",
    color: "emerald",
    prompts: [
      "My greatest strength",
      "My simple pleasures",
      "A random fact I love is",
      "My most irrational fear",
      "A life goal of mine",
      "Dating me is like",
      "Typical Sunday",
      "I recently discovered that",
      "This year, I really want to",
      "I go crazy for",
      "The way to win me over is",
      "Unusual skills",
    ],
  },
  {
    name: "Date vibes",
    color: "pink",
    prompts: [
      "What I order for the table",
      "Together, we could",
      "The best way to ask me out is by",
      "First round is on me if",
      "I know the best spot in town for",
    ],
  },
  {
    name: "Getting personal",
    color: "purple",
    prompts: [
      "You should *not* go out with me if",
      "I won't shut up about",
      "The dorkiest thing about me is",
      "My Love Language is",
      "What if I told you that",
      "If loving this is wrong, I don't want to be right",
      "Don't hate me if I",
      "The one thing you should know about me is",
      "The key to my heart is",
      "I geek out on",
    ],
  },
  {
    name: "Let's chat about",
    color: "blue",
    prompts: [
      "You should leave a comment if",
      "Let's debate this topic",
      "Teach me something about",
      "Try to guess this about me",
      "Change my mind about",
      "Do you agree or disagree that",
      "The one thing I'd love to know about you is",
      "I bet you can't",
      "Let's make sure we're on the same page about",
      "I'll pick the topic if you start the conversation",
      "Give me travel tips for",
    ],
  },
  {
    name: "My type",
    color: "rose",
    prompts: [
      "The hallmark of a good relationship is",
      "I'll fall for you if",
      "We'll get along if",
      "I'm looking for",
      "I want someone who",
      "Something that's non-negotiable for me is",
      "I'll brag about you to my friends if",
      "We're the same type of weird if",
      "All I ask is that you",
      "Green flags I look for",
      "I'm weirdly attracted to",
    ],
  },
  {
    name: "Your World",
    color: "amber",
    prompts: [
      "My most used emoji is",
      "A song everyone should listen to",
      "I'm convinced that",
      "Two truths and a lie",
      "Fact about me that surprises people",
      "I'm looking for someone to share a",
    ],
  },
  {
    name: "Storytime",
    color: "sky",
    prompts: [
      "The last thing I did for the first time was",
      "The story behind my name is",
      "My last great adventure was",
      "One thing I'll never do again",
      "Weirdest gift I've ever received",
      "I got in trouble for",
    ],
  },
];

export default function App() {
  // --- Auth State ---
  const [user, setUser] = useState<string | null>(() => localStorage.getItem('auth_user'));
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [emailCount, setEmailCount] = useState<number>(0);

  // --- Main App State ---
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig>({
    user: "",
    pass: "",
    isp: "Verizon",
    count: 5,
    attempts: 100,
    timeout: 10,
    workers: 30
  });

  const [daisyConfig, setDaisyConfig] = useState<DaisySMSConfig>({
    apiKey: DEFAULT_DAISY_KEY,
    service: "vz", // Hinge (vz as requested)
    maxPrice: "0.25"
  });

  const [results, setResults] = useState<ProxyResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [generatingPromptsFor, setGeneratingPromptsFor] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [status, setStatus] = useState("Ready.");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'emails' | 'admin'>('dashboard');
  const [allEmails, setAllEmails] = useState<any[]>([]);

  // --- Sidebar Panel State (null = collapsed, shows icons only) ---
  const [openPanel, setOpenPanel] = useState<'proxy' | 'daisy' | 'prompts' | null>(null);

  // --- Selected Prompts State (exactly 3 for AI generation) ---
  const DEFAULT_PROMPTS = ["I go crazy for", "The way to win me over is", "A life goal of mine"];
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>(DEFAULT_PROMPTS);
  // Ref so async callbacks always read the latest value (avoids stale closure)
  const selectedPromptsRef = useRef<string[]>(DEFAULT_PROMPTS);
  useEffect(() => { selectedPromptsRef.current = selectedPrompts; }, [selectedPrompts]);

  // --- Fraud Check State ---
  const [fraudCheckingFor, setFraudCheckingFor] = useState<string | null>(null);

  // --- Admin State ---
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  // --- Helpers ---
  const formatPhoneNumber = (num: string) => {
    if (!num) return "";
    // Expected: +1 223 246 9520
    const cleaned = num.replace(/\D/g, '');
    
    // Handle numbers with or without leading '1'
    let digits = cleaned;
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      digits = cleaned.substring(1);
    }
    
    if (digits.length === 10) {
      return `+1 ${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6)}`;
    }
    
    return num;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setStatus(`${label} copied!`);
    setTimeout(() => setStatus("Ready."), 2000);
  };

  useEffect(() => {
    if (user) {
      fetchEmailCount();
      loadUserData();
      if (currentView === 'emails') {
        fetchAllEmails();
      }
      
      // Auto-refresh email count every 5 seconds
      const interval = setInterval(fetchEmailCount, 5000);
      return () => clearInterval(interval);
    }
  }, [user, currentView]);

  const fetchAllEmails = async () => {
    if (!user) {
      console.log("[Frontend] No user for fetchAllEmails");
      return;
    }
    try {
      console.log(`[Frontend] Fetching all emails for user: ${user}`);
      const res = await axios.get(`/api/emails/list?username=${user}`);
      console.log("[Frontend] Fetch emails response:", res.data);
      if (res.data.success) {
        setAllEmails(res.data.emails);
      }
    } catch (err) {
      console.error("[Frontend] Failed to fetch emails list", err);
    }
  };

  const deleteEmail = async (id: any) => {
    console.log("[Frontend] deleteEmail called with ID:", id);
    // if (!window.confirm("Delete this email?")) return;
    const numericId = Number(id);
    if (isNaN(numericId)) {
      console.error("[Frontend] Invalid email ID:", id);
      setStatus("Error: Invalid ID.");
      return;
    }
    
    try {
      setStatus("Deleting email...");
      console.log(`[Frontend] Deleting email ID: ${numericId}`);
      
      // Optimistically update UI
      setAllEmails(prev => {
        const filtered = prev.filter(e => Number(e.id) !== numericId);
        console.log(`[Frontend] Optimistic filter: ${prev.length} -> ${filtered.length}`);
        return filtered;
      });
      
      const response = await axios.delete(`/api/emails/${numericId}`);
      console.log("[Frontend] Delete response:", response.data);
      
      if (response.data.success) {
        setStatus("Email deleted successfully.");
        await fetchAllEmails();
        await fetchEmailCount();
      } else {
        throw new Error("Server failed to delete");
      }
    } catch (err) {
      console.error("[Frontend] Failed to delete email", err);
      setStatus("Error: Could not delete email.");
      // Revert on error
      await fetchAllEmails();
    }
  };

  // Debounced save for user data
  useEffect(() => {
    if (user && !isInitialLoad) {
      const timer = setTimeout(() => {
        saveUserData();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [proxyConfig, daisyConfig, results, user, isInitialLoad]);

  const loadUserData = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`/api/user/data?username=${user}`);
      if (res.data.proxy_config) setProxyConfig(res.data.proxy_config);
      else setProxyConfig({
        user: "",
        pass: "",
        isp: "Verizon",
        count: 15,
        attempts: 100,
        timeout: 10,
        workers: 30
      });

      if (res.data.daisy_config) setDaisyConfig(res.data.daisy_config);
      else setDaisyConfig({
        apiKey: DEFAULT_DAISY_KEY,
        service: "vz",
        maxPrice: "0.25"
      });

      if (res.data.results) setResults(res.data.results);
      else setResults([]);

      setIsInitialLoad(false);
    } catch (err) {
      console.error("Failed to load user data", err);
      setIsInitialLoad(false);
    }
  };

  const saveUserData = async () => {
    if (!user) return;
    try {
      await axios.post('/api/user/data', {
        username: user,
        proxy_config: proxyConfig,
        daisy_config: daisyConfig,
        results: results
      });
    } catch (err) {
      console.error("Failed to save user data", err);
    }
  };

  const fetchEmailCount = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`/api/emails/count?username=${user}&t=${Date.now()}`);
      setEmailCount(response.data.count);
    } catch (err: any) {
      console.error("Failed to fetch email count", err);
      if (err.response?.status === 404) {
        // User not found in DB, clear local storage and reset user
        localStorage.removeItem('auth_user');
        setUser(null);
        setAuthMode('login');
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.txt')) {
      setStatus("Error: Only .xlsx or .txt files are allowed.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target?.result as string;
        let formattedEmails: any[] = [];

        if (file.name.endsWith('.xlsx')) {
          const wb = XLSX.read(content, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws) as any[];

          if (data.length === 0) {
            setStatus("Error: File is empty.");
            return;
          }

          const firstRow = data[0];
          if (!firstRow.Email || !firstRow.Passwort || !firstRow.URL) {
            setStatus("Error: Invalid columns. Required: Email, Passwort, URL");
            return;
          }

          formattedEmails = data.map(row => ({
            email: row.Email,
            password: row.Passwort,
            url: row.URL
          }));
        } else {
          // Handle .txt (CSV format: Email,Passwort,URL)
          const lines = content.split(/\r?\n/).filter(line => line.trim());
          formattedEmails = lines.map(line => {
            const [email, password, url] = line.split(',').map(s => s.trim());
            return { email, password, url };
          }).filter(item => item.email && item.password && item.url);

          if (formattedEmails.length === 0) {
            setStatus("Error: No valid CSV data found. Format: Email,Passwort,URL");
            return;
          }
        }

        const response = await axios.post('/api/emails/upload', {
          username: user,
          emails: formattedEmails
        });

        if (response.data.success) {
          setStatus(`Success: Imported ${response.data.count} emails.`);
          fetchEmailCount();
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      } catch (err) {
        setStatus("Error: Failed to parse file.");
      }
    };

    if (file.name.endsWith('.xlsx')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleDeleteAllEmails = async () => {
    if (!user) {
      console.log("[Frontend] DELETE ALL clicked but no user logged in");
      setStatus("Error: No user logged in.");
      return;
    }
    
    if (!window.confirm("CRITICAL: This will permanently DELETE ALL emails for your account from the database. This action cannot be undone. Proceed?")) {
      return;
    }
    
    const trimmedUser = user.trim();
    
    try {
      setStatus("DELETING ALL EMAILS...");
      console.log(`[Frontend] handleDeleteAllEmails START for user: "${trimmedUser}"`);
      
      // 1. Call backend to wipe the database for this user FIRST
      console.log(`[Frontend] Calling /api/emails/clear for "${trimmedUser}"...`);
      const response = await axios.post('/api/emails/clear', { username: trimmedUser });
      console.log(`[Frontend] Backend clear response:`, response.data);
      
      if (response.data.success) {
        console.log(`[Frontend] Backend reported success. Deleted: ${response.data.deleted}, Remaining: ${response.data.remaining}`);
        
        // 2. Update local states immediately to reflect 0
        console.log("[Frontend] Updating local states to 0");
        setAllEmails([]);
        setEmailCount(0);
        
        // 3. Clear email references in results too (important for UI consistency)
        console.log("[Frontend] Clearing email references from results state...");
        const clearedResults = results.map(r => ({
          ...r,
          email: undefined,
          emailPassword: undefined,
          emailUrl: undefined,
          emailId: undefined
        }));
        setResults(clearedResults);

        // 4. Save the cleared results state to the DB to ensure persistence of the "no-email" state in results
        console.log("[Frontend] Saving cleared results to /api/user/data...");
        await axios.post('/api/user/data', {
          username: trimmedUser,
          proxy_config: proxyConfig,
          daisy_config: daisyConfig,
          results: clearedResults
        });

        setStatus(`SUCCESS: Permanently deleted ${response.data.deleted || 0} emails.`);
        
        // 5. Force a fresh fetch of everything to confirm sync
        console.log("[Frontend] Final sync check...");
        await fetchEmailCount();
        if (currentView === 'emails') {
          await fetchAllEmails();
        }
        console.log("[Frontend] handleDeleteAllEmails COMPLETED");
      } else {
        throw new Error(response.data.error || "Server failed to delete emails");
      }
    } catch (err: any) {
      console.error("[Frontend] handleDeleteAllEmails FAILED", err);
      const errorMsg = err.response?.data?.error || err.message || "Deletion failed";
      setStatus(`ERROR: ${errorMsg}`);
      // Refresh to show current actual state
      fetchAllEmails();
      fetchEmailCount();
    }
  };

  const consumeEmail = async (resultId: string, emailId: number, url: string) => {
    try {
      await axios.post('/api/emails/consume', { emailId });
      setResults(prev => prev.map(r => r.id === resultId ? { ...r, emailId: undefined } : r));
      // Refresh count immediately
      fetchEmailCount();
      window.open(url, '_blank');
    } catch (err) {
      console.error("Failed to consume email", err);
      window.open(url, '_blank');
    }
  };

  // --- Core Logic: Proxy Search (Simulated for Web, but logic is there) ---
  const checkBalance = async () => {
    if (!daisyConfig.apiKey) return;
    setIsCheckingBalance(true);
    try {
      const response = await axios.get(`/api/daisysms?api_key=${daisyConfig.apiKey}&action=getBalance`);
      const data = response.data as string;
      if (data.startsWith("ACCESS_BALANCE")) {
        setBalance(data.split(":")[1]);
      } else {
        setBalance("Error: " + data);
      }
    } catch (err) {
      setBalance("Network Error");
    } finally {
      setIsCheckingBalance(false);
    }
  };

  const startProxySearch = async () => {
    saveUserData();
    setIsSearching(true);
    setStatus("Searching for proxies...");
    setProgress({ done: 0, total: proxyConfig.attempts });

    let availableCities = FALLBACK_BIG_US_CITIES;
    if (proxyConfig.state) {
      const filterState = proxyConfig.state.toLowerCase().trim().replace(/ /g, "+");
      availableCities = FALLBACK_BIG_US_CITIES.filter(c =>
        c.state_token.toLowerCase() === filterState ||
        c.display.toLowerCase().includes(proxyConfig.state!.toLowerCase().trim())
      );
    }

    if (availableCities.length === 0) {
      alert(`No proxies found for state: ${proxyConfig.state}. Please try another state or leave it empty.`);
      setIsSearching(false);
      setStatus("Search failed: No matching state.");
      return;
    }

    const baseUser = stripToBaseUser(proxyConfig.user);
    const targetCount = Math.min(proxyConfig.count, 10); // hard cap at 10
    let found = 0;

    for (let attempt = 0; attempt < proxyConfig.attempts && found < targetCount; attempt++) {
      setProgress({ done: attempt + 1, total: proxyConfig.attempts });

      const randomCity = availableCities[Math.floor(Math.random() * availableCities.length)];
      const sid = Math.random().toString(36).substring(2, 10);
      const ispToken = proxyConfig.isp === "Verizon" ? "verizon+wireless" : "at&t+wireless";
      const username = buildUsername(baseUser, randomCity.state_token, randomCity.city_token, sid, ispToken);

      const prefix = `[${attempt + 1}/${proxyConfig.attempts}]`;

      // Step 1: Real connectivity test through ProxyEmpire gateway
      setStatus(`${prefix} Verbinde...`);
      let ip: string;
      let ping: number;
      try {
        const testRes = await axios.get(
          `/api/proxy-test?username=${encodeURIComponent(username)}&password=${encodeURIComponent(proxyConfig.pass)}`,
          { timeout: 14000 }
        );
        if (!testRes.data.ok) {
          setStatus(`${prefix} Fehlgeschlagen — ${testRes.data.error ?? ''}`);
          continue;
        }
        ip = testRes.data.ip;
        ping = testRes.data.ping;
      } catch {
        setStatus(`${prefix} Timeout`);
        continue;
      }

      // Step 2: Fraud score (informational only — no filter)
      setStatus(`${prefix} Fraud prüfen... (${ping}ms)`);
      let fraudScore: number | undefined;
      let fraudRisk: string | undefined;
      try {
        const fraudRes = await axios.get(`/api/fraud-check?ip=${ip}`);
        fraudScore = fraudRes.data.score;
        fraudRisk = fraudRes.data.risk;
      } catch {
        // Fraud check failed — still add proxy, just without score
      }

      // Proxy connected — add immediately with real IP, ping and fraud score
      found++;
      setStatus(`${prefix} ✓ ${ip} — ${ping}ms — ${found}/${targetCount}`);

      const newResult: ProxyResult = {
        id: Math.random().toString(36).substring(2, 9),
        city: randomCity.display,
        stateHint: randomCity.state_token,
        username,
        ip,
        ping,
        status: "active",
        lat: 40.7128 + (Math.random() - 0.5) * 5,
        lon: -74.0060 + (Math.random() - 0.5) * 5,
        fraudScore,
        fraudRisk,
      };

      setResults(prev => {
        const created = prev.filter(r => !!r.phoneNumber);
        const pending = prev.filter(r => !r.phoneNumber);
        return [...created, ...pending, newResult];
      });
    }

    setIsSearching(false);
    setStatus(
      found === 0
        ? `Keine Verbindung nach ${proxyConfig.attempts} Versuchen. Zugangsdaten prüfen.`
        : `Fertig — ${found}/${targetCount} Proxies gefunden.`
    );
  };

  // --- Standalone Prompt Generation ---
  const generatePromptsForResult = async (resultId: string) => {
    const result = results.find(r => r.id === resultId);
    if (!result) return;
    setGeneratingPromptsFor(resultId);
    try {
      setStatus("Generating profile data...");
      const nearby = await getNearbyPlaces(result.lat || 0, result.lon || 0);
      const nearbyPlace = nearby[Math.floor(Math.random() * nearby.length)] || result.city;
      const jobTitle = result.jobTitle || JOB_TITLES[Math.floor(Math.random() * JOB_TITLES.length)];
      setStatus("Generating Hinge prompts...");
      const prompts = await generateHingePrompts({ city: result.city, nearbyPlace, job: jobTitle, selectedPrompts: selectedPromptsRef.current });
      setResults(prev => prev.map(r => r.id === resultId ? {
        ...r,
        nearbyPlace: r.nearbyPlace || nearbyPlace,
        jobTitle: r.jobTitle || jobTitle,
        hingePrompts: prompts
      } : r));
      setStatus("Profile created successfully.");
    } catch (error: any) {
      setStatus(`Warning: Could not generate prompts: ${error.message}`);
    } finally {
      setGeneratingPromptsFor(null);
    }
  };

  // --- Core Logic: Create Profile (The requested automated workflow) ---
  const createProfile = async (resultId: string) => {
    if (!daisyConfig.apiKey) {
      alert("Please enter your DaisySMS API Key in the settings first.");
      return;
    }
    const result = results.find(r => r.id === resultId);
    if (!result) return;

    setResults(prev => prev.map(r => r.id === resultId ? { ...r, status: "pending" } : r));
    setStatus(`Creating profile for ${result.city}...`);

    // Step 1: DaisySMS – failure here = real failure, set status "failed"
    let orderId: string;
    let number: string;
    try {
      const daisy = new DaisySMSService(daisyConfig.apiKey);
      setStatus("Requesting phone number...");
      const acquired = await daisy.getNumber(
        daisyConfig.service,
        daisyConfig.carriers,
        daisyConfig.maxPrice
      );
      orderId = acquired.id;
      number = acquired.number;
    } catch (error: any) {
      let msg = String(error.message);
      if (msg.includes("BAD_SERVICE")) {
        msg = "DaisySMS Error: BAD_SERVICE. This means the service code (e.g. hz, hi) is not supported for your account or is invalid. Check your Price List on DaisySMS.";
      } else if (msg.includes("MAX_PRICE_EXCEEDED")) {
        msg = "DaisySMS Error: Price limit exceeded. Increase your Max Price setting.";
      } else if (msg.includes("NO_NUMBERS")) {
        msg = "DaisySMS Error: No numbers available for this service/carrier right now.";
      } else if (msg.includes("NO_MONEY")) {
        msg = "DaisySMS Error: Insufficient balance. Please top up your account.";
      } else if (msg.includes("TOO_MANY_ACTIVE_RENTALS")) {
        msg = "DaisySMS Error: Too many active rentals. Finish or cancel some first.";
      }
      setStatus(msg);
      setResults(prev => prev.map(r => r.id === resultId ? { ...r, status: "failed" } : r));
      return;
    }

    setResults(prev => prev.map(r => r.id === resultId ? {
      ...r,
      phoneNumber: number,
      orderId,
      status: "active"
    } : r));

    // Step 2: SMS Polling
    setStatus("Waiting for SMS code...");
    pollForSms(resultId, orderId);

    // Step 3: Generate Profile Data – failure here does NOT affect status
    await generatePromptsForResult(resultId);
  };

  const pollForSms = async (resultId: string, orderId: string) => {
    const daisy = new DaisySMSService(daisyConfig.apiKey);
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes (5s intervals)

    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setStatus("SMS Timeout.");
        return;
      }

      try {
        const { status: smsStatus, code } = await daisy.getStatus(orderId);
        if (smsStatus === "OK" && code) {
          setResults(prev => prev.map(r => r.id === resultId ? { ...r, smsCode: code } : r));
          setStatus(`SMS Received: ${code}`);
          clearInterval(interval);
        } else if (smsStatus === "CANCELLED") {
          clearInterval(interval);
          setStatus("Order cancelled.");
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 5000);
  };

  // --- Fraud Check ---
  const runFraudCheck = async (resultId: string) => {
    const result = results.find(r => r.id === resultId);
    if (!result || !result.ip || result.ip === 'Checking...') {
      setStatus("No valid IP for fraud check.");
      return;
    }
    setFraudCheckingFor(resultId);
    setStatus(`Checking fraud score for ${result.ip}...`);
    try {
      const res = await axios.get(`/api/fraud-check?ip=${result.ip}`);
      const { score, risk } = res.data;
      setResults(prev => prev.map(r => r.id === resultId ? { ...r, fraudScore: score, fraudRisk: risk } : r));
      setStatus(`Fraud: ${score}/100 (${risk})`);
      setTimeout(() => setStatus("Ready."), 3000);
    } catch (err) {
      setStatus("Fraud check failed.");
    } finally {
      setFraudCheckingFor(null);
    }
  };

  // --- Admin Functions ---
  const fetchAdminUsers = async () => {
    setAdminLoading(true);
    try {
      const res = await axios.get(`/api/admin/users?admin=${user}`);
      setAdminUsers(res.data.users);
    } catch (err) {
      console.error("Failed to fetch admin users", err);
    } finally {
      setAdminLoading(false);
    }
  };

  const adminAction = async (id: number, action: 'approve' | 'reject' | 'block' | 'unblock') => {
    try {
      await axios.post(`/api/admin/users/${id}/${action}`, { admin: user });
      fetchAdminUsers();
    } catch (err) {
      console.error(`Admin action ${action} failed`, err);
    }
  };

  const adminDelete = async (id: number) => {
    if (!confirm("Delete this user and all their data permanently?")) return;
    try {
      await axios.delete(`/api/admin/users/${id}?admin=${user}`);
      fetchAdminUsers();
    } catch (err) {
      console.error("Admin delete failed", err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthenticating(true);
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const trimmedForm = {
        username: authForm.username.trim(),
        password: authForm.password
      };
      const response = await axios.post(endpoint, trimmedForm);
      if (response.data.success) {
        const finalUsername = response.data.username || trimmedForm.username;
        if (authMode === 'login') {
          setUser(finalUsername);
          localStorage.setItem('auth_user', finalUsername);
          setStatus(`Logged in successfully as ${finalUsername}`);
        } else {
          setAuthMode('login');
          if (response.data.pending) {
            setAuthError("Registration submitted! Your account is pending approval by the admin.");
          }
          setAuthForm({ username: authForm.username, password: '' });
        }
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || "Authentication failed");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
    // Prevent state resets from triggering a save and overwriting stored credentials
    setIsInitialLoad(true);
    // Reset all states for multi-user separation
    setProxyConfig({
      user: "",
      pass: "",
      isp: "Verizon",
      count: 15,
      attempts: 100,
      timeout: 10,
      workers: 30
    });
    setDaisyConfig({
      apiKey: DEFAULT_DAISY_KEY,
      service: "vz",
      maxPrice: "2.50"
    });
    setResults([]);
    setEmailCount(0);
    setBalance(null);
    setStatus("Ready.");
  };

  // --- Render ---
  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] text-zinc-300 flex items-center justify-center p-6 selection:bg-emerald-500/30 relative overflow-hidden">
        {/* Liquid Glass Background Blobs */}
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-2xl relative z-10"
        >
          <div className="flex flex-col items-center gap-6 mb-10">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <Shield className="w-10 h-10 text-emerald-400" />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
                {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p className="text-sm text-zinc-500 font-medium">
                {authMode === 'login' ? 'Enter your credentials to access the dashboard' : 'Join the private team dashboard'}
              </p>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 ml-1">Username</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                <input 
                  type="text"
                  required
                  value={authForm.username}
                  onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-700"
                  placeholder="admin"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                <input 
                  type="password"
                  required
                  value={authForm.password}
                  onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-700"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {authError && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 text-red-400 text-xs bg-red-400/10 border border-red-400/20 p-4 rounded-2xl"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-medium">{authError}</span>
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-4 bg-emerald-500/90 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
            >
              {isAuthenticating ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {authMode === 'login' ? <Unlock className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                  <span className="tracking-wide">{authMode === 'login' ? 'Login' : 'Register'}</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button 
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setAuthError(null);
              }}
              className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-emerald-500 transition-colors"
            >
              {authMode === 'login' ? "Don't have an account? Register" : "Already have an account? Login"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-emerald-500/30 relative overflow-hidden">
      {/* Liquid Glass Background Blobs */}
      <div className="fixed -top-[10%] -left-[10%] w-[40vw] h-[40vw] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="fixed -bottom-[10%] -right-[10%] w-[40vw] h-[40vw] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="fixed top-[30%] left-[60%] w-[30vw] h-[30vw] bg-purple-500/5 blur-[100px] rounded-full pointer-events-none z-0" />

      {/* Top Navigation */}
      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Hinge <span className="text-emerald-500/80">Automator</span>
              </h1>
            </div>

            <div className="flex items-center gap-8 ml-12">
              <button 
                onClick={() => setCurrentView('dashboard')}
                className={cn(
                  "text-xs font-bold uppercase tracking-widest transition-all relative py-2",
                  currentView === 'dashboard' ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Dashboard
                {currentView === 'dashboard' && (
                  <motion.div layoutId="nav-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => setCurrentView('emails')}
                className={cn(
                  "text-xs font-bold uppercase tracking-widest transition-all relative py-2",
                  currentView === 'emails' ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Emails
                {currentView === 'emails' && (
                  <motion.div layoutId="nav-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
                )}
              </button>
              {user === 'flo' && (
                <button
                  onClick={() => { setCurrentView('admin'); fetchAdminUsers(); }}
                  className={cn(
                    "text-xs font-bold uppercase tracking-widest transition-all relative py-2 flex items-center gap-1.5",
                    currentView === 'admin' ? "text-yellow-400" : "text-zinc-500 hover:text-yellow-400"
                  )}
                >
                  <Crown className="w-3.5 h-3.5" />
                  Admin
                  {currentView === 'admin' && (
                    <motion.div layoutId="nav-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500 rounded-full" />
                  )}
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-inner w-[260px] overflow-hidden">
              <div className={cn("w-2 h-2 rounded-full shrink-0 shadow-[0_0_10px_currentColor]", isSearching ? "text-yellow-500 bg-yellow-500 animate-pulse" : "text-emerald-500 bg-emerald-500")} />
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 truncate">{status}</span>
            </div>
            
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-5 py-2.5 rounded-2xl">
              <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/30">
                <User className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-sm font-bold text-white uppercase tracking-widest">{user}</span>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={handleLogout}
                className="p-2.5 bg-white/5 hover:bg-red-500/20 rounded-xl text-zinc-500 hover:text-red-400 border border-white/5 hover:border-red-500/30 transition-all active:scale-95"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>

              <button className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-500 hover:text-white border border-white/5 transition-all active:scale-95">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 py-6 grid grid-cols-12 gap-6 relative z-10">
        {currentView === 'dashboard' ? (
          <div className="col-span-12 flex gap-4 items-start">

          {/* ── Animated Sidebar ── */}
          <motion.aside
            animate={{ width: openPanel !== null ? 292 : 68 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="shrink-0"
            style={{ overflow: 'hidden' }}
          >
            <AnimatePresence mode="wait">
              {openPanel === null ? (
                /* Collapsed: two icon pill buttons */
                <motion.div
                  key="icons"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  className="flex flex-col gap-3 w-16"
                >
                  <button
                    onClick={() => setOpenPanel('proxy')}
                    title="Proxy Settings"
                    className="w-14 h-14 bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-2xl flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 shadow-xl transition-all active:scale-95 group"
                  >
                    <Shield className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </button>
                  <button
                    onClick={() => setOpenPanel('daisy')}
                    title="DaisySMS"
                    className="w-14 h-14 bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-2xl flex items-center justify-center text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30 shadow-xl transition-all active:scale-95 group"
                  >
                    <Phone className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </button>
                  {/* Floating Prompts Logo */}
                  <button
                    onClick={() => setOpenPanel('prompts')}
                    title="Prompt Selector"
                    className="w-14 h-14 bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-2xl flex items-center justify-center text-pink-400 hover:bg-pink-500/10 hover:border-pink-500/30 shadow-xl transition-all active:scale-95 group relative"
                  >
                    <Heart className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    {selectedPrompts.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-lg shadow-pink-500/40">
                        {selectedPrompts.length}
                      </span>
                    )}
                  </button>
                </motion.div>
              ) : openPanel === 'proxy' ? (
                /* Proxy Settings Panel */
                <motion.div
                  key="proxy"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, delay: 0.1 }}
                  className="w-[292px] bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/30 shrink-0">
                      <Shield className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 flex-1">Proxy Settings</h2>
                    <button
                      onClick={() => setOpenPanel(null)}
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-500 hover:text-white transition-all active:scale-95"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 210px)' }}>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Base Username</label>
                      <input
                        type="text"
                        value={proxyConfig.user}
                        onChange={e => setProxyConfig({ ...proxyConfig, user: e.target.value })}
                        placeholder="e.g. myuser123"
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-700"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Password</label>
                        <input
                          type="password"
                          value={proxyConfig.pass}
                          onChange={e => setProxyConfig({ ...proxyConfig, pass: e.target.value })}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">ISP</label>
                        <div className="relative">
                          <select
                            value={proxyConfig.isp}
                            onChange={e => setProxyConfig({ ...proxyConfig, isp: e.target.value as any })}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
                          >
                            <option>Verizon</option>
                            <option>AT&T</option>
                          </select>
                          <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none rotate-90" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Count</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={proxyConfig.count}
                          onChange={e => setProxyConfig({ ...proxyConfig, count: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)) })}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">State</label>
                        <input
                          type="text"
                          value={proxyConfig.state}
                          onChange={e => setProxyConfig({ ...proxyConfig, state: e.target.value })}
                          placeholder="optional"
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-700"
                        />
                      </div>
                    </div>
                    <button
                      onClick={startProxySearch}
                      disabled={isSearching}
                      className="w-full bg-emerald-500 text-black font-bold py-3.5 rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                    >
                      {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                      <span className="tracking-wide text-sm">Start Proxy Search</span>
                    </button>
                    <button
                      onClick={() => setOpenPanel('daisy')}
                      className="w-full flex items-center gap-2 px-3 py-2.5 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/15 hover:border-blue-500/25 rounded-2xl text-blue-400/60 hover:text-blue-400 text-xs font-bold uppercase tracking-widest transition-all group"
                    >
                      <Phone className="w-3 h-3 shrink-0" />
                      <span>DaisySMS</span>
                      <ChevronRight className="w-3 h-3 ml-auto opacity-40 group-hover:opacity-80 transition-opacity" />
                    </button>
                  </div>
                </motion.div>
              ) : openPanel === 'daisy' ? (
                /* DaisySMS Panel */
                <motion.div
                  key="daisy"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, delay: 0.1 }}
                  className="w-[292px] bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30 shrink-0">
                      <Phone className="w-4 h-4 text-blue-400" />
                    </div>
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 flex-1">DaisySMS</h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={checkBalance}
                        disabled={isCheckingBalance || !daisyConfig.apiKey}
                        className="text-[10px] font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 disabled:opacity-40"
                      >
                        <RefreshCw className={cn("w-2.5 h-2.5", isCheckingBalance && "animate-spin")} />
                        Balance
                      </button>
                      <button
                        onClick={() => setOpenPanel(null)}
                        className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-500 hover:text-white transition-all active:scale-95"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="px-5 pt-3">
                    <button
                      onClick={() => setOpenPanel('proxy')}
                      className="w-full flex items-center gap-2 px-4 py-3 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/15 hover:border-emerald-500/25 rounded-2xl text-emerald-400/60 hover:text-emerald-400 text-xs font-bold uppercase tracking-widest transition-all group"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>Proxy Settings</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40 group-hover:opacity-80 transition-opacity" />
                    </button>
                  </div>
                  <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>

                    {balance && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-between"
                      >
                        <span className="text-xs font-bold uppercase tracking-widest text-blue-400/80">Balance</span>
                        <span className="text-base font-bold text-white">${balance}</span>
                      </motion.div>
                    )}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">API Key</label>
                      <input
                        type="password"
                        value={daisyConfig.apiKey}
                        onChange={e => setDaisyConfig({ ...daisyConfig, apiKey: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                        placeholder="Enter API Key"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Service</label>
                        <div className="relative">
                          <select
                            value={["vz","oi","mo","tg","wa","go","fb","ig","tw","lf","fu","ds","ub","ll"].includes(daisyConfig.service) ? daisyConfig.service : "custom"}
                            onChange={e => {
                              const val = e.target.value;
                              setDaisyConfig({ ...daisyConfig, service: val === "custom" ? "" : val });
                            }}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
                          >
                            <option value="vz">Hinge</option>
                            <option value="oi">Tinder</option>
                            <option value="mo">Bumble</option>
                            <option value="tg">Telegram</option>
                            <option value="wa">WhatsApp</option>
                            <option value="go">Google</option>
                            <option value="fb">Facebook</option>
                            <option value="ig">Instagram</option>
                            <option value="tw">Twitter</option>
                            <option value="lf">TikTok</option>
                            <option value="fu">Snapchat</option>
                            <option value="ds">DoorDash</option>
                            <option value="ub">Uber</option>
                            <option value="ll">Lyft</option>
                            <option value="custom">Custom...</option>
                          </select>
                          <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none rotate-90" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Max Price</label>
                        <input
                          type="text"
                          placeholder="e.g. 0.25"
                          value={daisyConfig.maxPrice || ""}
                          onChange={e => setDaisyConfig({ ...daisyConfig, maxPrice: e.target.value })}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Carrier (Optional)</label>
                      <div className="relative">
                        <select
                          value={daisyConfig.carriers || ""}
                          onChange={e => setDaisyConfig({ ...daisyConfig, carriers: e.target.value || undefined })}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Any Carrier</option>
                          <option value="vz">Verizon</option>
                          <option value="att">AT&T</option>
                          <option value="tmo">T-Mobile</option>
                        </select>
                        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none rotate-90" />
                      </div>
                    </div>
                    <button
                      onClick={() => setOpenPanel('prompts')}
                      className="w-full flex items-center gap-2 px-4 py-3 bg-pink-500/5 hover:bg-pink-500/10 border border-pink-500/15 hover:border-pink-500/25 rounded-2xl text-pink-400/60 hover:text-pink-400 text-xs font-bold uppercase tracking-widest transition-all group"
                    >
                      <Heart className="w-3.5 h-3.5" />
                      <span>Prompts</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40 group-hover:opacity-80 transition-opacity" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                /* Prompts Panel */
                <motion.div
                  key="prompts"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, delay: 0.1 }}
                  className="w-[292px] bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                    <div className="w-8 h-8 bg-pink-500/20 rounded-lg flex items-center justify-center border border-pink-500/30 shrink-0">
                      <Heart className="w-4 h-4 text-pink-400" />
                    </div>
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 flex-1">Prompts</h2>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider",
                        selectedPrompts.length === 3
                          ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                          : "bg-white/5 text-zinc-500 border border-white/10"
                      )}>
                        {selectedPrompts.length}/3
                      </span>
                      <button
                        onClick={() => setOpenPanel(null)}
                        className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-500 hover:text-white transition-all active:scale-95"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Quick nav: DaisySMS at top */}
                  <div className="px-5 pt-3">
                    <button
                      onClick={() => setOpenPanel('daisy')}
                      className="w-full flex items-center gap-1.5 px-3 py-2.5 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/15 hover:border-blue-500/25 rounded-2xl text-blue-400/60 hover:text-blue-400 text-xs font-bold uppercase tracking-widest transition-all group"
                    >
                      <Phone className="w-3 h-3 shrink-0" />
                      <span>DaisySMS</span>
                      <ChevronRight className="w-3 h-3 ml-auto shrink-0 opacity-40 group-hover:opacity-80 transition-opacity" />
                    </button>
                  </div>

                  {/* Selected count hint */}
                  {selectedPrompts.length < 3 && (
                    <div className="px-5 pt-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70 bg-amber-400/5 border border-amber-400/15 rounded-xl px-3 py-2">
                        Wähle genau 3 Prompts für die Generierung
                      </div>
                    </div>
                  )}
                  {selectedPrompts.length === 3 && (
                    <div className="px-5 pt-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-pink-400/70 bg-pink-400/5 border border-pink-400/15 rounded-xl px-3 py-2 flex items-center gap-2">
                        <Sparkles className="w-3 h-3" />
                        Bereit für AI-Generierung
                      </div>
                    </div>
                  )}

                  {/* Reset button */}
                  <div className="px-5 pt-2">
                    <button
                      onClick={() => setSelectedPrompts(["I go crazy for", "The way to win me over is", "A life goal of mine"])}
                      className="w-full text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-300 transition-colors text-left"
                    >
                      ↺ Standard zurücksetzen
                    </button>
                  </div>

                  {/* Categories + Prompts list */}
                  <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
                    {HINGE_PROMPTS_CATEGORIES.map((cat) => {
                      const colorMap: Record<string, string> = {
                        emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                        pink: "text-pink-400 bg-pink-500/10 border-pink-500/20",
                        purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
                        blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                        rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
                        amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                        sky: "text-sky-400 bg-sky-500/10 border-sky-500/20",
                      };
                      const selectedBg: Record<string, string> = {
                        emerald: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
                        pink: "bg-pink-500/15 border-pink-500/40 text-pink-300",
                        purple: "bg-purple-500/15 border-purple-500/40 text-purple-300",
                        blue: "bg-blue-500/15 border-blue-500/40 text-blue-300",
                        rose: "bg-rose-500/15 border-rose-500/40 text-rose-300",
                        amber: "bg-amber-500/15 border-amber-500/40 text-amber-300",
                        sky: "bg-sky-500/15 border-sky-500/40 text-sky-300",
                      };
                      return (
                        <div key={cat.name}>
                          <div className={cn(
                            "text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-lg border w-fit mb-2",
                            colorMap[cat.color]
                          )}>
                            {cat.name}
                          </div>
                          <div className="space-y-1">
                            {cat.prompts.map((prompt) => {
                              const isSelected = selectedPrompts.includes(prompt);
                              const isDisabled = !isSelected && selectedPrompts.length >= 3;
                              return (
                                <button
                                  key={prompt}
                                  disabled={isDisabled}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedPrompts(prev => prev.filter(p => p !== prompt));
                                    } else if (selectedPrompts.length < 3) {
                                      setSelectedPrompts(prev => [...prev, prompt]);
                                    }
                                  }}
                                  className={cn(
                                    "w-full text-left px-3 py-2 rounded-xl text-[11px] font-medium border transition-all flex items-center gap-2",
                                    isSelected
                                      ? selectedBg[cat.color]
                                      : isDisabled
                                      ? "text-zinc-700 bg-transparent border-zinc-800/50 cursor-not-allowed"
                                      : "text-zinc-400 bg-transparent border-zinc-800 hover:border-zinc-600 hover:text-zinc-200 active:scale-[0.98]"
                                  )}
                                >
                                  <span className={cn(
                                    "w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all",
                                    isSelected
                                      ? "bg-pink-500 border-pink-500"
                                      : "border-zinc-700 bg-transparent"
                                  )}>
                                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                  </span>
                                  <span className="leading-snug">{prompt}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0 space-y-6">
          
          {/* Progress Bar */}
          <AnimatePresence>
            {isSearching && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-xl overflow-hidden"
              >
                <div className="flex justify-between text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">
                  <span>Search Progress</span>
                  <span className="text-emerald-400">{Math.round((progress.done / progress.total) * 100)}%</span>
                </div>
                <div className="h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress.done / progress.total) * 100}%` }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Table */}
          <div className="bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative z-10">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
                  <RefreshCw className={cn("w-4 h-4 text-zinc-400", isSearching && "animate-spin")} />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-300">Active Proxies & Profiles</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setResults(prev => prev.filter(r => !!r.phoneNumber));
                    setExpandedIds(new Set());
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-red-500/20 rounded-2xl text-zinc-400 hover:text-red-400 border border-white/5 hover:border-red-500/30 transition-all active:scale-95 text-xs font-bold uppercase tracking-widest"
                  title="Clear all non-created proxies (created profiles stay)"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                    <th className="px-6 py-3 w-16 text-center">Status</th>
                    <th className="px-6 py-3">City & Network</th>
                    <th className="px-6 py-3">Proxy Auth</th>
                    <th className="px-6 py-3">Phone / SMS</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <>
                    {[...results]
                      .filter(r => !!r.phoneNumber || r.fraudScore != null)
                      .sort((a, b) => (!!b.phoneNumber ? 1 : 0) - (!!a.phoneNumber ? 1 : 0))
                      .map((res) => (
                      <React.Fragment key={res.id}>
                      <motion.tr
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                          "group transition-colors",
                          res.phoneNumber
                            ? "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.07] border-l-2 border-l-emerald-500/40"
                            : "hover:bg-white/[0.03]"
                        )}
                      >
                        <td className="px-6 py-5 text-center">
                          <div className="flex justify-center">
                            {res.status === "active" ? (
                              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
                            ) : res.status === "failed" ? (
                              <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]" />
                            ) : (
                              <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.6)]" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-bold text-white tracking-tight truncate max-w-[200px]">{res.city}</span>
                            <span className="text-xs font-mono text-zinc-500 bg-white/5 px-2.5 py-1 rounded border border-white/5 truncate max-w-[130px] w-fit">{res.ip}</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {res.ping && (
                                <span className={cn(
                                  "text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border",
                                  res.ping < 95
                                    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                                    : "text-amber-400 bg-amber-400/10 border-amber-400/20"
                                )}>
                                  {res.ping}ms
                                </span>
                              )}
                              {res.fraudScore != null && (
                                <span className={cn(
                                  "text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border",
                                  res.fraudScore < 5
                                    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                                    : res.fraudScore < 40
                                    ? "text-sky-400 bg-sky-400/10 border-sky-400/20"
                                    : res.fraudScore < 70
                                    ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
                                    : "text-red-400 bg-red-400/10 border-red-400/20"
                                )}>
                                  {res.fraudScore}/100
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex flex-col gap-2.5">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Proxy Auth</span>
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-mono text-white bg-black/40 px-2.5 py-1 rounded border border-white/5 truncate max-w-[250px]">{res.username}:{proxyConfig.pass}</span>
                              <button onClick={() => copyToClipboard(res.username, "Proxy")} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all">
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex flex-col gap-2.5">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Phone / SMS</span>
                            {res.phoneNumber ? (
                              <div className="flex items-center gap-2.5">
                                <span className="text-xs font-black text-emerald-400 tracking-wider bg-emerald-400/10 px-2.5 py-1 rounded border border-emerald-400/20">{formatPhoneNumber(res.phoneNumber)}</span>
                                <button onClick={() => copyToClipboard(res.phoneNumber!, "Phone")} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all">
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-600 font-bold uppercase tracking-widest italic">No number</span>
                            )}
                            {res.smsCode && (
                              <motion.div 
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="flex items-center gap-2.5 bg-blue-500/20 border border-blue-500/30 px-2.5 py-1 rounded-lg w-fit mt-1.5"
                              >
                                <MessageSquare className="w-4 h-4 text-blue-400" />
                                <span className="text-xs font-black text-blue-400 tracking-wider">{res.smsCode}</span>
                              </motion.div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Delete button — only on created profiles */}
                            {res.phoneNumber && (
                              <button
                                onClick={() => {
                                  setResults(prev => prev.filter(r => r.id !== res.id));
                                  setExpandedIds(prev => { const n = new Set(prev); n.delete(res.id); return n; });
                                }}
                                className="p-2 rounded-xl border bg-red-500/10 border-red-500/15 text-red-400/50 hover:text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all active:scale-95"
                                title="Delete Profile"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            {/* Expand toggle */}
                            <button
                              onClick={() => setExpandedIds(prev => {
                                const n = new Set(prev);
                                n.has(res.id) ? n.delete(res.id) : n.add(res.id);
                                return n;
                              })}
                              className={cn(
                                "p-2 rounded-xl border transition-all active:scale-95",
                                expandedIds.has(res.id)
                                  ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                                  : "bg-white/5 hover:bg-white/10 border-white/5 text-zinc-400 hover:text-white"
                              )}
                              title={expandedIds.has(res.id) ? "Collapse" : "View Profile"}
                            >
                              <ChevronRight className={cn("w-4 h-4 transition-transform", expandedIds.has(res.id) && "rotate-90")} />
                            </button>
                            <button
                              onClick={() => createProfile(res.id)}
                              disabled={res.status === "pending" || !!res.phoneNumber}
                              className={cn(
                                "px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95",
                                res.phoneNumber
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 cursor-default shadow-emerald-500/10"
                                  : "bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20"
                              )}
                            >
                              {res.phoneNumber ? "✓ Active" : "Create"}
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                      {/* ── Inline Profile Expand ── */}
                        {expandedIds.has(res.id) && (
                          <tr className="!border-t-0">
                            <td colSpan={5} className="px-0 py-0">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                                style={{ overflow: "hidden" }}
                              >
                                <div className={cn(
                                  "mx-3 mb-2 rounded-b-2xl overflow-hidden border-x border-b",
                                  res.phoneNumber
                                    ? "border-white/[0.07] bg-zinc-900/50"
                                    : "border-white/5 bg-zinc-950/60"
                                )}>
                                  <div className="flex items-stretch gap-0">
                                    {/* Meta chips — fixed width so prompts always start at same column */}
                                    <div className="flex flex-col gap-1.5 shrink-0 w-[270px] p-3 border-r border-white/5">
                                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03]">
                                        <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
                                        <div className="min-w-0">
                                          <div className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold leading-none mb-0.5">Nearby</div>
                                          <div className="text-[11px] font-semibold text-zinc-200 whitespace-nowrap">{res.nearbyPlace || "—"}</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03]">
                                        <Briefcase className="w-3 h-3 text-zinc-500 shrink-0" />
                                        <div className="min-w-0">
                                          <div className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold leading-none mb-0.5">Job</div>
                                          <div className="text-[11px] font-semibold text-zinc-200 whitespace-nowrap">{res.jobTitle || "—"}</div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Prompts area — always starts at same x position */}
                                    <div className="flex-1 min-w-0 p-3">
                                      {res.hingePrompts ? (
                                        <div className="flex gap-2 h-full" style={{ scrollbarWidth: 'none' }}>
                                          {Object.entries(res.hingePrompts).map(([title, options]) => (
                                            <div key={title} className="flex-1 min-w-0 space-y-1">
                                              <h5 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-0.5">{title}</h5>
                                              <div className="space-y-1">
                                                {(options as string[]).slice(0, 3).map((opt, i) => (
                                                  <button
                                                    key={i}
                                                    onClick={() => copyToClipboard(opt.replace(" — great answer", ""), "Prompt")}
                                                    className={cn(
                                                      "w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-all active:scale-[0.98] leading-snug",
                                                      opt.includes("great answer")
                                                        ? "text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 hover:bg-emerald-950/80"
                                                        : "text-zinc-400 bg-transparent border border-zinc-800 hover:border-zinc-600 hover:text-zinc-200"
                                                    )}
                                                  >
                                                    {opt}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-3 h-full">
                                          {generatingPromptsFor === res.id ? (
                                            <div className="flex items-center gap-2 text-zinc-500">
                                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                              <span className="text-xs font-bold uppercase tracking-widest">Generating...</span>
                                            </div>
                                          ) : (
                                            <button
                                              onClick={() => generatePromptsForResult(res.id)}
                                              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-emerald-500/20 active:scale-95"
                                            >
                                              <RefreshCw className="w-3 h-3" />
                                              Generate Prompts
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </>
                  {results.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-8 py-32 text-center">
                        <div className="flex flex-col items-center gap-4 text-zinc-600">
                          <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center border border-white/5 mb-2">
                            <Search className="w-8 h-8 opacity-20" />
                          </div>
                          <p className="text-sm font-medium tracking-wide">No proxies found. Start a search to begin.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </div>
    ) : currentView === 'emails' ? (
          <div className="col-span-12 space-y-6">
            <div className="bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative z-10">
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                    <Mail className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Email Management</h3>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Manage your private email database</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black rounded-2xl hover:bg-emerald-400 transition-all cursor-pointer text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95">
                    <Upload className="w-4 h-4" />
                    Upload .txt (CSV)
                    <input 
                      type="file" 
                      accept=".txt" 
                      className="hidden" 
                      onChange={handleFileUpload} 
                    />
                  </label>
                  <button 
                    onClick={handleDeleteAllEmails}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-all text-xs font-bold uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                    DELETE ALL
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                      <th className="px-6 py-4">Email Address</th>
                      <th className="px-6 py-4">Password</th>
                      <th className="px-6 py-4">Access URL</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {allEmails.map((email) => (
                      <tr key={email.id} className="group hover:bg-white/[0.03] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-white">{email.email}</span>
                            <button onClick={() => copyToClipboard(email.email, "Email")} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-zinc-400 bg-black/20 px-2 py-1 rounded border border-white/5">{email.password}</span>
                            <button onClick={() => copyToClipboard(email.password, "Password")} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <a href={email.url} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:underline truncate max-w-[300px] block">
                            {email.url}
                          </a>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => window.open(email.url, '_blank')}
                              className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/20 transition-all"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => deleteEmail(email.id)}
                              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {allEmails.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-8 py-32 text-center">
                          <div className="flex flex-col items-center gap-4 text-zinc-600">
                            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center border border-white/5 mb-2">
                              <Mail className="w-8 h-8 opacity-20" />
                            </div>
                            <p className="text-sm font-medium tracking-wide">No emails in your database. Upload a .txt file to start.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
    ) : (
      /* ── Admin Panel (flo only) ── */
      <div className="col-span-12 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-2xl flex items-center justify-center border border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.15)]">
              <Crown className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Admin Panel</h2>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">User Management</p>
            </div>
          </div>
          <button
            onClick={fetchAdminUsers}
            disabled={adminLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
          >
            <RefreshCw className={cn("w-4 h-4", adminLoading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Stats Row */}
        {(() => {
          const total = adminUsers.length;
          const active = adminUsers.filter(u => u.status === 'active').length;
          const pending = adminUsers.filter(u => u.status === 'pending').length;
          const blocked = adminUsers.filter(u => u.status === 'blocked').length;
          return (
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total Users', value: total, icon: Users, color: 'zinc' },
                { label: 'Active', value: active, icon: UserCheck, color: 'emerald' },
                { label: 'Pending', value: pending, icon: Clock, color: 'yellow' },
                { label: 'Blocked', value: blocked, icon: Ban, color: 'red' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className={cn(
                  "bg-zinc-900/60 backdrop-blur-2xl border rounded-3xl p-5 flex items-center gap-4 shadow-xl",
                  color === 'emerald' ? "border-emerald-500/20" :
                  color === 'yellow' ? "border-yellow-500/20" :
                  color === 'red' ? "border-red-500/20" : "border-white/10"
                )}>
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center border",
                    color === 'emerald' ? "bg-emerald-500/20 border-emerald-500/30" :
                    color === 'yellow' ? "bg-yellow-500/20 border-yellow-500/30" :
                    color === 'red' ? "bg-red-500/20 border-red-500/30" : "bg-white/5 border-white/10"
                  )}>
                    <Icon className={cn("w-5 h-5",
                      color === 'emerald' ? "text-emerald-400" :
                      color === 'yellow' ? "text-yellow-400" :
                      color === 'red' ? "text-red-400" : "text-zinc-400"
                    )} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{value}</div>
                    <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Pending Approvals */}
        {adminUsers.filter(u => u.status === 'pending').length > 0 && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-yellow-500/20 flex items-center gap-3 bg-yellow-500/10">
              <Clock className="w-5 h-5 text-yellow-400" />
              <h3 className="text-sm font-bold text-yellow-400 uppercase tracking-widest">Pending Approvals</h3>
              <span className="ml-auto px-2.5 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-xs font-black text-yellow-400">
                {adminUsers.filter(u => u.status === 'pending').length}
              </span>
            </div>
            <div className="divide-y divide-yellow-500/10">
              {adminUsers.filter(u => u.status === 'pending').map(u => (
                <div key={u.id} className="px-6 py-4 flex items-center justify-between hover:bg-yellow-500/5 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 bg-yellow-500/20 rounded-xl flex items-center justify-center border border-yellow-500/30">
                      <User className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{u.username}</div>
                      <div className="text-xs text-zinc-500">{u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adminAction(u.id, 'approve')}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 transition-all active:scale-95"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => adminAction(u.id, 'reject')}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/30 transition-all active:scale-95"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Users Table */}
        <div className="bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-white/10 flex items-center gap-3 bg-black/20">
            <ShieldCheck className="w-5 h-5 text-zinc-400" />
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-widest">All Users</h3>
          </div>
          {adminLoading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-zinc-500">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Loading users...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Emails</th>
                  <th className="px-6 py-4">Registered</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {adminUsers.map(u => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-all group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center border",
                          u.username === 'flo' ? "bg-yellow-500/20 border-yellow-500/30" : "bg-white/5 border-white/10"
                        )}>
                          {u.username === 'flo' ? <Crown className="w-4 h-4 text-yellow-400" /> : <User className="w-4 h-4 text-zinc-400" />}
                        </div>
                        <span className="font-bold text-white text-sm">{u.username}</span>
                        {u.username === 'flo' && <span className="text-xs text-yellow-500 font-bold">ADMIN</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest border",
                        u.status === 'active' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                        u.status === 'pending' ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" :
                        "bg-red-500/10 border-red-500/20 text-red-400"
                      )}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-zinc-400 font-mono">{u.available_emails} / {u.email_count}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-zinc-500">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        {u.username !== 'flo' && (
                          <>
                            {u.status === 'pending' && (
                              <button onClick={() => adminAction(u.id, 'approve')} title="Approve" className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-emerald-400 transition-all active:scale-95">
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {u.status === 'active' && (
                              <button onClick={() => adminAction(u.id, 'block')} title="Block" className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 transition-all active:scale-95">
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {u.status === 'blocked' && (
                              <button onClick={() => adminAction(u.id, 'unblock')} title="Unblock" className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-emerald-400 transition-all active:scale-95">
                                <Unlock className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => adminDelete(u.id)} title="Delete" className="p-2 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 rounded-xl text-zinc-500 hover:text-red-400 transition-all active:scale-95">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {adminUsers.length === 0 && !adminLoading && (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-zinc-600">
                        <Users className="w-10 h-10 opacity-20" />
                        <p className="text-sm font-medium">No users found.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )}
      </main>

    </div>
  );
}
