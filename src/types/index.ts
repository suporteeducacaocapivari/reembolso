export type FaixaReembolso = '75%' | '100%';

export type TipoSolicitacao = 'CADASTRO' | 'RECADASTRO';

export type StatusRecadastro =
  | 'EM_ANALISE'
  | 'APROVADO'
  | 'PENDENTE_CORRECAO'
  | 'REPROVADO';

export type StatusProtocolo =
  | 'PENDENTE_ANALISE'
  | 'APROVADO_PAGAMENTO'
  | 'PENDENTE_CORRECAO'
  | 'REPROVADO';

export type TipoTransporte = 'FRETADO' | 'LINHA_CIRCULAR';

export interface MembroFamiliar {
  nomeCompleto: string;
  dataNasc: string;
  parentesco: string;
  profissao: string;
  renda: number;
}

export interface AlunoCadastro {
  id: string;
  tipoSolicitacao: TipoSolicitacao;
  nome: string;
  rg: string;
  cpf: string;
  email: string;
  telefone: string;
  endereco: string;
  numero: string;
  bairro: string;
  instituicao: string;
  cidadeInstituicao: string;
  curso: string;
  banco: string;
  agencia: string;
  conta: string;
  chavePix: string;
  tipoChavePix: 'CPF' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA';
  membrosFamilia?: MembroFamiliar[];
  comprovanteResidenciaUrl?: string;
  comprovanteMatriculaUrl?: string;
  declaracaoCustoUrl?: string;
  faixaReembolso: FaixaReembolso;
  status: StatusRecadastro;
  motivoPendencia?: string;
  dataAtualizacao: string;
}

export interface DocumentoExtraidoGemini {
  tipo_documento: 'NF' | 'CUPOM_FISCAL' | 'BPE';
  empresa_emissora?: string;
  cnpj_emissor: string;
  numero_documento: string;
  chave_acesso_44_digitos: string | null;
  data_emissao: string;
  valor_total: number;
  confianca_leitura: 'ALTA' | 'MEDIA' | 'BAIXA';
  origem_leitura?: 'GEMINI_REAL' | 'SIMULADO_SEM_CHAVE';
}

export interface CupomFiscalItem {
  id: string;
  chaveAcesso: string;
  dataEmissao: string;
  numero: string;
  cnpjEmissor: string;
  valor: number;
  comprovanteFotoUrl?: string;
  confianca?: 'ALTA' | 'MEDIA' | 'BAIXA';
}

export interface ProtocoloMensal {
  id: string;
  codigoHash: string;
  alunoId: string;
  alunoNome: string;
  alunoRg?: string;
  alunoCpf: string;
  alunoCurso?: string;
  alunoInstituicao?: string;
  alunoCidadeInstituicao?: string;
  alunoChavePix: string;
  mesReferencia: string; // Ex: '2026-11'
  tipoTransporte: TipoTransporte;
  status: StatusProtocolo;
  dataEnvio: string;
  dataJulgamento?: string;
  motivoPendencia?: string;
  faixaAplicada: FaixaReembolso;

  // Para Fretado (Anexo IV)
  empresaTransporte?: string;
  nfNumero?: string;
  nfCnpj?: string;
  nfDataEmissao?: string;
  nfArquivoUrl?: string;
  nfArquivoNome?: string;
  valorIndividualNf?: number;

  // Para Cupons
  cupons?: CupomFiscalItem[];

  valorTotalComprovado: number;
  valorReembolsoEstimado: number;
  confiancaIa?: 'ALTA' | 'MEDIA' | 'BAIXA';
  declaracaoVeracidade: boolean;
  historicoAuditoria: {
    data: string;
    autor: string;
    acao: string;
    observacao?: string;
  }[];
}
