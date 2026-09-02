"use client";
import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
export default function Layout({ children }: { children: React.ReactNode }) { const [open, setOpen] = useState(false); return <div className="app-shell"><div className={open ? "mobile-overlay show" : "mobile-overlay"} onClick={() => setOpen(false)} /><div className={open ? "sidebar-wrap open" : "sidebar-wrap"}><Sidebar /></div><div className="main-shell"><Navbar onMenu={() => setOpen(true)} /><main className="page-content">{children}</main></div></div>; }