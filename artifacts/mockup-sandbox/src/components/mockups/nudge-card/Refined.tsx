import "./Refined.css";
import { X } from "lucide-react";

export function Refined() {
  return (
    <div className="min-h-screen bg-stone-100 flex items-start justify-end p-8">
      {/* Nudge Card */}
      <div className="nudge-card w-72 bg-white rounded-2xl border border-amber-100 p-5 space-y-4"
           style={{ boxShadow: "0 4px 24px 0 rgba(0,0,0,0.08), 0 1px 4px 0 rgba(0,0,0,0.04)" }}>

        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Brand-green icon */}
          <div className="mt-0.5 shrink-0 p-2 rounded-full" style={{ backgroundColor: "#edf3ea" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a7c59" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12v10H4V12"/>
              <path d="M22 7H2v5h20V7z"/>
              <path d="M12 22V7"/>
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
            </svg>
          </div>

          {/* Text block */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-snug" style={{ color: "#4a7c59" }}>
              Member perks await
            </p>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              Sign in to save your wishlist, track orders, and get early access to exclusive deals.
            </p>
          </div>

          {/* Close button — larger hit target */}
          <button
            className="shrink-0 -mt-1 -mr-1 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100" />

        {/* Google sign-in button — less dominant */}
        <button className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Trust cues */}
        <p className="text-center text-[10px] text-gray-400 leading-relaxed -mt-1">
          Free account · No password required
        </p>
      </div>
    </div>
  );
}
