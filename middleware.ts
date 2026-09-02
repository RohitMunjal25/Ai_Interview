import { NextRequest, NextResponse } from "next/server";
export function middleware(request: NextRequest) { if (!request.cookies.get("token")?.value) return NextResponse.redirect(new URL("/login", request.url)); return NextResponse.next(); }
export const config = { matcher: ["/dashboard/:path*", "/interview/:path*", "/profile/:path*"] };