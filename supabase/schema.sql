-- ============================================================================
-- SCHEMA DO BANCO DE DADOS - SEMEC CAPIVARI
-- Sistema de Recadastro e Reembolso de Transporte Escolar Universitário
-- Compatível com PostgreSQL 15+ e Supabase (Self-Hosted no Coolify ou Cloud)
-- ============================================================================

-- Habilita extensão para geração de UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABELA DE ALUNOS / RECADASTROS (ANEXO I e ANEXO II)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.alunos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_solicitacao VARCHAR(20) NOT NULL DEFAULT 'RECADASTRO' CHECK (tipo_solicitacao IN ('CADASTRO', 'RECADASTRO')),
  nome VARCHAR(255) NOT NULL,
  rg VARCHAR(30) NOT NULL,
  cpf VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  telefone VARCHAR(30) NOT NULL,
  
  -- Endereço em Capivari/SP
  endereco VARCHAR(255) NOT NULL,
  numero VARCHAR(20) NOT NULL,
  bairro VARCHAR(120) NOT NULL,
  
  -- Dados Acadêmicos
  instituicao VARCHAR(255) NOT NULL,
  cidade_instituicao VARCHAR(120) NOT NULL,
  curso VARCHAR(255) NOT NULL,
  
  -- Dados Bancários (Banco do Brasil) e PIX
  banco VARCHAR(100) NOT NULL DEFAULT '001 - Banco do Brasil',
  agencia VARCHAR(30) NOT NULL,
  conta VARCHAR(40) NOT NULL,
  chave_pix VARCHAR(255) NOT NULL,
  tipo_chave_pix VARCHAR(20) NOT NULL CHECK (tipo_chave_pix IN ('CPF', 'EMAIL', 'TELEFONE', 'ALEATORIA')),
  
  -- Documentos Anexados (URLs do Storage)
  comprovante_residencia_url TEXT,
  comprovante_matricula_url TEXT,
  declaracao_custo_url TEXT,
  
  -- Enquadramento e Status
  faixa_reembolso VARCHAR(10) NOT NULL DEFAULT '75%' CHECK (faixa_reembolso IN ('75%', '100%')),
  status VARCHAR(30) NOT NULL DEFAULT 'EM_ANALISE' CHECK (status IN ('EM_ANALISE', 'APROVADO', 'PENDENTE_CORRECAO', 'REPROVADO')),
  motivo_pendencia TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alunos_status ON public.alunos(status);
CREATE INDEX IF NOT EXISTS idx_alunos_cpf ON public.alunos(cpf);

-- ============================================================================
-- 2. TABELA DE MEMBROS E RENDA FAMILIAR (ANEXO III - SOMENTE FAIXA 100%)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.membros_familia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  nome_completo VARCHAR(255) NOT NULL,
  data_nasc VARCHAR(20),
  parentesco VARCHAR(80),
  profissao VARCHAR(120),
  renda NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_membros_familia_aluno ON public.membros_familia(aluno_id);

-- ============================================================================
-- 3. TABELA DE PROTOCOLOS MENSAIS (ANEXO IV - FRETADO OU LOTE CIRCULAR)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.protocolos_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_hash VARCHAR(40) NOT NULL UNIQUE,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  
  -- Snapshot dos dados do aluno no momento do protocolo
  aluno_nome VARCHAR(255) NOT NULL,
  aluno_rg VARCHAR(30),
  aluno_cpf VARCHAR(20) NOT NULL,
  aluno_curso VARCHAR(255),
  aluno_instituicao VARCHAR(255),
  aluno_cidade_instituicao VARCHAR(120),
  aluno_chave_pix VARCHAR(255) NOT NULL,
  
  mes_referencia VARCHAR(7) NOT NULL, -- Formato YYYY-MM (ex: 2026-11)
  tipo_transporte VARCHAR(20) NOT NULL CHECK (tipo_transporte IN ('FRETADO', 'LINHA_CIRCULAR')),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE_ANALISE' CHECK (status IN ('PENDENTE_ANALISE', 'APROVADO_PAGAMENTO', 'PENDENTE_CORRECAO', 'REPROVADO')),
  faixa_aplicada VARCHAR(10) NOT NULL CHECK (faixa_aplicada IN ('75%', '100%')),
  
  -- Dados da Nota Fiscal / Fretado (Anexo IV)
  empresa_transporte VARCHAR(255),
  nf_numero VARCHAR(60),
  nf_cnpj VARCHAR(25),
  nf_data_emissao DATE,
  nf_arquivo_url TEXT,
  nf_arquivo_nome VARCHAR(255),
  valor_individual_nf NUMERIC(10, 2),
  
  -- Valores consolidados
  valor_total_comprovado NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  valor_reembolso_estimado NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  confianca_ia VARCHAR(15) CHECK (confianca_ia IN ('ALTA', 'MEDIA', 'BAIXA')),
  declaracao_veracidade BOOLEAN NOT NULL DEFAULT TRUE,
  
  motivo_pendencia TEXT,
  data_envio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_julgamento TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_protocolos_aluno ON public.protocolos_mensais(aluno_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_status ON public.protocolos_mensais(status);
CREATE INDEX IF NOT EXISTS idx_protocolos_mes ON public.protocolos_mensais(mes_referencia);

-- ============================================================================
-- 4. TABELA DE CUPONS FISCAIS / BP-e (TRAVA ANTIFRAUDE NA CHAVE DE 44 DÍGITOS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cupons_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id UUID NOT NULL REFERENCES public.protocolos_mensais(id) ON DELETE CASCADE,
  chave_acesso VARCHAR(44) NOT NULL UNIQUE, -- TRAVA ANTIFRAUDE NO BANCO: impede duplicidade global!
  data_emissao DATE,
  numero VARCHAR(60) NOT NULL,
  cnpj_emissor VARCHAR(25) NOT NULL,
  valor NUMERIC(10, 2) NOT NULL,
  comprovante_foto_url TEXT,
  confianca VARCHAR(15) CHECK (confianca IN ('ALTA', 'MEDIA', 'BAIXA')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cupons_protocolo ON public.cupons_fiscais(protocolo_id);

-- ============================================================================
-- 5. TABELA DE AUDITORIA DE PROTOCOLOS (HISTÓRICO CRONOLÓGICO)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.auditoria_protocolos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id UUID NOT NULL REFERENCES public.protocolos_mensais(id) ON DELETE CASCADE,
  data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  autor VARCHAR(255) NOT NULL,
  acao VARCHAR(255) NOT NULL,
  observacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_auditoria_protocolo ON public.auditoria_protocolos(protocolo_id);

-- ============================================================================
-- 6. TRIGGER PARA ATUALIZAR updated_at AUTOMATICAMENTE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alunos_updated_at ON public.alunos;
CREATE TRIGGER trg_alunos_updated_at
  BEFORE UPDATE ON public.alunos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_protocolos_updated_at ON public.protocolos_mensais;
CREATE TRIGGER trg_protocolos_updated_at
  BEFORE UPDATE ON public.protocolos_mensais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 7. SEGURANÇA BÁSICA (ROW LEVEL SECURITY - SUPABASE)
-- ============================================================================
-- Ative o RLS em produção e configure políticas por auth.uid() conforme o fluxo de login adotado.
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros_familia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolos_mensais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupons_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_protocolos ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas iniciais para homologação/teste interno (substituir por auth.uid() em produção)
CREATE POLICY "homologacao_alunos_all" ON public.alunos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "homologacao_membros_all" ON public.membros_familia FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "homologacao_protocolos_all" ON public.protocolos_mensais FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "homologacao_cupons_all" ON public.cupons_fiscais FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "homologacao_auditoria_all" ON public.auditoria_protocolos FOR ALL USING (true) WITH CHECK (true);
