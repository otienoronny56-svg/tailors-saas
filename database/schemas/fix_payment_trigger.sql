-- 1. Create the function that calculates the paid amount
CREATE OR REPLACE FUNCTION update_order_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.orders
  SET amount_paid = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.payments
    WHERE order_id = NEW.order_id AND deleted_at IS NULL
  )
  WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Drop the trigger if it exists to avoid duplication
DROP TRIGGER IF EXISTS on_payment_added ON public.payments CASCADE;

-- 3. Recreate the trigger
CREATE TRIGGER on_payment_added
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE PROCEDURE update_order_paid_amount();

-- 4. Retroactively recalculate all order balances just in case they are out of sync!
UPDATE public.orders o
SET amount_paid = COALESCE((
    SELECT SUM(amount)
    FROM public.payments p
    WHERE p.order_id = o.id AND p.deleted_at IS NULL
), 0);
