
// ==========================================
// 🌐 GLOBAL VARIABLES & CONSTANTS
// ==========================================
let USER_PROFILE = null;
let CURRENT_ORDER_ID = null;
let ALL_SHOPS = {};
let analyticsCharts = {};

let lastDashboardLoad = 0;
const DEBOUNCE_DELAY = 500;
let dataCache = {
    shops: null,
    workers: null,
    orders: null,
    expenses: null,
    cacheTime: 0
};
const CACHE_TTL = 60000;

const STATUS_MAP = {
    1: 'Assigned',
    2: 'In Progress',
    3: 'QA Check',
    4: 'Ready for Review/Fitting',
    5: 'Ready for collection',
    6: 'Collected',
    7: 'Closed'
};

const GARMENT_MEASUREMENTS = {
    'Suit': {
        Coat: ['Shoulder', 'Chest', 'Bodice', 'Waist', 'Bicep', 'Sleeve', 'Wrist', 'Length', 'Hips'],
        Shirt: ['Shoulder', 'Chest', 'Bodice', 'Waist', 'Sleeve', 'Length', 'Neck', 'Cuff'],
        Trouser: ['Waist', 'Hips', 'Thigh', 'Knee', 'Bottom', 'Length', 'Crotch']
    },
    'Suit (3-Piece)': {
        Coat: ['Shoulder', 'Chest', 'Bodice', 'Waist', 'Bicep', 'Sleeve', 'Wrist', 'Length', 'Hips'],
        'Half Coat (Waistcoat)': ['Chest', 'Waist', 'Hips', 'Front Length', 'Back Length'],
        Shirt: ['Shoulder', 'Chest', 'Bodice', 'Waist', 'Sleeve', 'Length', 'Neck', 'Cuff'],
        Trouser: ['Waist', 'Hips', 'Thigh', 'Knee', 'Bottom', 'Length', 'Crotch']
    },
    'Kaunda/Senator Suit': {
        Top: ['Shoulder', 'Sleeve', 'Arm', 'Chest', 'Waist', 'Hips', 'Length', 'Neck'],
        Trouser: ['Waist', 'Hips', 'Thigh', 'Knee', 'Bottom', 'Length', 'Crotch']
    },
    'African Wear/Kaftan': {
        Top: ['Shoulder', 'Sleeve', 'Arm', 'Chest', 'Waist', 'Hips', 'Length', 'Neck'],
        Trouser: ['Waist', 'Hips', 'Thigh', 'Knee', 'Bottom', 'Length', 'Crotch']
    },
    'Corporate Wear': {
        Coat: ['Shoulder', 'Chest', 'Bodice', 'Waist', 'Bicep', 'Sleeve', 'Wrist', 'Length', 'Hips'],
        Shirt: ['Shoulder', 'Chest', 'Bodice', 'Waist', 'Sleeve', 'Length', 'Neck', 'Cuff'],
        Trouser: ['Waist', 'Hips', 'Thigh', 'Knee', 'Bottom', 'Length', 'Crotch'],
        Dress: ['Shoulder', 'Bust', 'Waist', 'Hips', 'Length', 'Sleeve']
    },
    'Trouser': {
        Trouser: ['Waist', 'Hips', 'Thigh', 'Knee', 'Bottom', 'Length', 'Crotch']
    },
    'Shirt': {
        Shirt: [
            'Shoulder', 'Chest', 'Bust', 'Bodice', 'Waist', 'Long Sleeve', 'Short Sleeve', 'Length', 'Neck', 'Cuff'
        ]
    },
    'Dress': {
        Dress: ['Shoulder', 'Bust', 'Waist', 'Hips', 'Length', 'Sleeve']
    },
    'Coat': {
        Coat: ['Shoulder', 'Chest', 'Waist', 'Sleeve', 'Wrist', 'Length', 'Hips']
    },
    'Half Coat': {
        Coat: ['Shoulder', 'Chest', 'Waist', 'Length']
    },
    'Trench Coat': {
        Coat: ['Shoulder', 'Chest', 'Waist', 'Hips', 'Sleeve', 'Wrist', 'Length']
    },
    'Standard Size': {
        'Standard Size': ['Top/Shirt Size (e.g. S/M/L/XL)', 'Bottom/Trouser Size (e.g. 30/32/34/36)', 'Chest Size (inches)', 'Waist Size (inches)', 'Height (feet/inches)', 'Weight (kg/lbs)']
    },
    'Shoes': {
        'Shoes': ['Shoe Size (UK/US/EU)', 'Foot Length (inches)', 'Foot Width (inches/Standard/Wide)']
    },
    'Accessories': {
        'Accessories': ['Wrist/Watch Size (inches)', 'Cap/Hat Size (inches or S/M/L)', 'Belt Size (inches)', 'Scarf/Neck Size (inches)', 'Preferred Tie Type (Slim/Standard)']
    },
    'Alteration': {
        Notes: ['Description']
    }
};
