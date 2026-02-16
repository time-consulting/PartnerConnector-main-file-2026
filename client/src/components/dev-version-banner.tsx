/**
 * Dev Version Banner
 * 
 * Shows a fixed overlay banner at the top of all pages in ALL environments.
 * Displays the current build version and timestamp so you can instantly verify
 * whether the deployed code matches the latest push.
 * 
 * REMOVE THIS COMPONENT (or set VITE_HIDE_DEV_BANNER=true) for production.
 * 
 * UPDATE THESE VALUES every time you push a change:
 */

// ============================================================
// 🔄 UPDATE THESE ON EVERY PUSH
// ============================================================
const BUILD_VERSION = "v1.0.3";
const BUILD_CHANGES = "Consolidated product types: Business Automation, Marketing, Bookings";
const BUILD_TIMESTAMP = "2026-02-16 17:46";
// ============================================================

export default function DevVersionBanner() {
    // Set VITE_HIDE_DEV_BANNER=true in production to hide
    if (import.meta.env.VITE_HIDE_DEV_BANNER === 'true') return null;

    return (
        <div
            id="dev-version-banner"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 99999,
                background: 'linear-gradient(90deg, #f59e0b, #ef4444, #f59e0b)',
                color: '#000',
                textAlign: 'center',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: 'monospace',
                letterSpacing: '0.5px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                userSelect: 'none',
                pointerEvents: 'none',
            }}
        >
            🚧 DEV BUILD: {BUILD_VERSION} | {BUILD_CHANGES} | Built: {BUILD_TIMESTAMP} 🚧
        </div>
    );
}
