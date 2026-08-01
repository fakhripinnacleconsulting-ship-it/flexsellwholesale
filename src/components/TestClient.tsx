"use client"; export function TestClient() { const x = async () => { if (typeof window === "undefined") { const { after } = await import("next/server"); } }; return <div/>; }
