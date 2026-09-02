"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAuth, getStoredUser } from "@/lib/auth";
export function useAuth() { const router = useRouter(); const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null); useEffect(() => { queueMicrotask(() => setUser(getStoredUser())); }, []); return { user, logout: () => { clearAuth(); router.push("/login"); } }; }