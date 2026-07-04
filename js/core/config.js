
// ==========================================
// ⚙️ MASTER CONFIGURATION FILE
// ==========================================

const APP_CONFIG = {
    // === 1. CONTROL SWITCH (THE KILL SWITCH) ===
    // Options: "ACTIVE" (App works) or "SUSPENDED" (Shows Payment Screen)
    SYSTEM_STATUS: "ACTIVE",

    // === 2. PAYMENT & SUPPORT DETAILS (For the Lock Screen) ===
    billing: {
        paybill: "600100",
        account: "200800",
        accountName: "TWO MILLION WAYS LTD",
        supportPhone: "0745806488"
    },

    // === 3. BRANDING IDENTITY ===
    appName: "STITCH & STYLES KENYA",
    appSubtitle: "FIND YOUR PERFECT FIT",
    logoPath: "logo.jpeg",

    // === 4. CONTACT DETAILS (For Receipts) ===
    shopPhone: "0721401495",
    currencySymbol: "Ksh",

    // === 5. BACKEND CONNECTION (Supabase) ===
    supabaseUrl: "https://ouuhirckiavcvgqlpriw.supabase.co",
    supabaseKey: "sb_publishable_cwzaqLI3RB-h_ZxVY2xFMA_bUgp5UcU",
    serviceRoleKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dWhpcmNraWF2Y3ZncWxwcml3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzkxNjI0NSwiZXhwIjoyMDg5NDkyMjQ1fQ.yC10d9Lu9cNB0JALqr5WCLuWBblw_6at8vuy0MXSyWA"
};
