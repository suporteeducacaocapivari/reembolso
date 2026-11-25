-- ============================================================================
-- CONTROLE DE ACESSO E PERFIS (ALUNO / ADMIN / DESENVOLVEDOR)
-- Integrado ao Supabase Auth (auth.users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.perfis_usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(20),
  role VARCHAR(20) NOT NULL DEFAULT 'ALUNO' CHECK (role IN ('ALUNO', 'ADMIN', 'DEV')),
  foto_facial_base64 TEXT,
  hash_facial VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.perfis_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perfis_read_own" ON public.perfis_usuarios;
CREATE POLICY "perfis_read_own" ON public.perfis_usuarios
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "perfis_insert_own" ON public.perfis_usuarios;
CREATE POLICY "perfis_insert_own" ON public.perfis_usuarios
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "perfis_update_own" ON public.perfis_usuarios;
CREATE POLICY "perfis_update_own" ON public.perfis_usuarios
  FOR UPDATE USING (auth.uid() = id);
