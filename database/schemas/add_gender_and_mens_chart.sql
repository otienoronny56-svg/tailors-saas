-- 1. Add target_gender to size_charts
ALTER TABLE public.size_charts 
ADD COLUMN IF NOT EXISTS target_gender text DEFAULT 'Unisex';

-- 2. Update the existing Ladies Standard Sizing chart to Female
UPDATE public.size_charts 
SET target_gender = 'Female',
    height_categories = '["Short", "Medium", "Tall"]'::jsonb
WHERE name = 'Ladies Standard Sizing (Default)';

-- 3. Insert Men's Standard Sizing chart
INSERT INTO public.size_charts (name, description, target_gender, dimensions, size_data, height_categories)
VALUES (
    'Men''s Standard Sizing (Default)',
    'Default standard sizing for men''s clothing based on typical chart measurements.',
    'Male',
    '["Chest", "Waist", "Hip", "Shoulder", "Sleeve", "Inseam"]'::jsonb,
    '{
        "36": { "Chest": "36", "Waist": "30", "Hip": "36", "Shoulder": "16", "Sleeve": "32", "Inseam": "30" },
        "38": { "Chest": "38", "Waist": "32", "Hip": "38", "Shoulder": "17", "Sleeve": "33", "Inseam": "31" },
        "40": { "Chest": "40", "Waist": "34", "Hip": "40", "Shoulder": "18", "Sleeve": "34", "Inseam": "32" },
        "42": { "Chest": "42", "Waist": "36", "Hip": "42", "Shoulder": "18.5", "Sleeve": "35", "Inseam": "32" },
        "44": { "Chest": "44", "Waist": "38", "Hip": "44", "Shoulder": "19", "Sleeve": "36", "Inseam": "33" },
        "46": { "Chest": "46", "Waist": "40", "Hip": "46", "Shoulder": "19.5", "Sleeve": "36.5", "Inseam": "33" },
        "48": { "Chest": "48", "Waist": "42", "Hip": "48", "Shoulder": "20", "Sleeve": "37", "Inseam": "34" }
    }'::jsonb,
    '["Short", "Medium", "Tall"]'::jsonb
);
