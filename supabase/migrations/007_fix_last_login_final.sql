-- ============================================
-- FINAL FIX: Last Login Update via Trigger/Function
-- Bypass all RLS issues
-- ============================================

-- 1. Create function that runs as owner (bypasses RLS)
CREATE OR REPLACE FUNCTION public.update_last_login_admin(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER  -- This bypasses RLS!
AS $$
BEGIN
    UPDATE system_admins 
    SET last_login_at = NOW() 
    WHERE id = user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_last_login_tenant(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE tenant_admins 
    SET last_login_at = NOW() 
    WHERE id = user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_last_login_gate(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE gate_users 
    SET last_login_at = NOW() 
    WHERE id = user_id;
END;
$$;

-- 2. Grant execute to anon
GRANT EXECUTE ON FUNCTION public.update_last_login_admin(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.update_last_login_tenant(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.update_last_login_gate(UUID) TO anon;

-- 3. Verify
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE 'update_last_login%';
