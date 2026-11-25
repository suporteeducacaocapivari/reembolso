import { supabase } from './supabaseClient';
import type {
  AlunoCadastro,
  ProtocoloMensal,
  FaixaReembolso,
  StatusRecadastro,
  StatusProtocolo,
} from '../types';

function mapAlunoFromDb(row: any): AlunoCadastro {
  return {
    id: row.id,
    tipoSolicitacao: row.tipo_solicitacao || 'RECADASTRO',
    nome: row.nome,
    rg: row.rg || '',
    cpf: row.cpf,
    email: row.email || '',
    telefone: row.telefone || '',
    endereco: row.endereco || '',
    numero: row.numero || '',
    bairro: row.bairro || '',
    instituicao: row.instituicao || '',
    cidadeInstituicao: row.cidade_instituicao || '',
    curso: row.curso || '',
    banco: row.banco || '001 - Banco do Brasil',
    agencia: row.agencia || '',
    conta: row.conta || '',
    chavePix: row.chave_pix || '',
    tipoChavePix: row.tipo_chave_pix || 'CPF',
    comprovanteResidenciaUrl: row.comprovante_residencia_url,
    comprovanteMatriculaUrl: row.comprovante_matricula_url,
    declaracaoCustoUrl: row.declaracao_custo_url,
    faixaReembolso: row.faixa_reembolso || '75%',
    status: row.status || 'EM_ANALISE',
    motivoPendencia: row.motivo_pendencia || undefined,
    dataAtualizacao: row.updated_at || row.created_at || new Date().toISOString(),
    membrosFamilia: (row.membros_familia || []).map((m: any) => ({
      nomeCompleto: m.nome_completo,
      dataNasc: m.data_nasc || '',
      parentesco: m.parentesco || '',
      profissao: m.profissao || '',
      renda: Number(m.renda || 0),
    })),
  };
}

function mapProtocoloFromDb(row: any): ProtocoloMensal {
  return {
    id: row.id,
    codigoHash: row.codigo_hash,
    alunoId: row.aluno_id,
    alunoNome: row.aluno_nome,
    alunoRg: row.aluno_rg,
    alunoCpf: row.aluno_cpf,
    alunoCurso: row.aluno_curso,
    alunoInstituicao: row.aluno_instituicao,
    alunoCidadeInstituicao: row.aluno_cidade_instituicao,
    alunoChavePix: row.aluno_chave_pix,
    mesReferencia: row.mes_referencia,
    tipoTransporte: row.tipo_transporte,
    status: row.status,
    dataEnvio: row.data_envio || row.created_at,
    dataJulgamento: row.data_julgamento || undefined,
    motivoPendencia: row.motivo_pendencia || undefined,
    faixaAplicada: row.faixa_aplicada,
    empresaTransporte: row.empresa_transporte,
    nfNumero: row.nf_numero,
    nfCnpj: row.nf_cnpj,
    nfDataEmissao: row.nf_data_emissao,
    nfArquivoUrl: row.nf_arquivo_url,
    nfArquivoNome: row.nf_arquivo_nome,
    valorIndividualNf: row.valor_individual_nf ? Number(row.valor_individual_nf) : undefined,
    valorTotalComprovado: Number(row.valor_total_comprovado || 0),
    valorReembolsoEstimado: Number(row.valor_reembolso_estimado || 0),
    confiancaIa: row.confianca_ia || 'ALTA',
    declaracaoVeracidade: Boolean(row.declaracao_veracidade),
    cupons: (row.cupons_fiscais || []).map((c: any) => ({
      id: c.id,
      chaveAcesso: c.chave_acesso,
      dataEmissao: c.data_emissao || '',
      numero: c.numero,
      cnpjEmissor: c.cnpj_emissor,
      valor: Number(c.valor || 0),
      comprovanteFotoUrl: c.comprovante_foto_url,
      confianca: c.confianca || 'ALTA',
    })),
    historicoAuditoria: (row.auditoria_protocolos || []).map((a: any) => ({
      data: a.data,
      autor: a.autor,
      acao: a.acao,
      observacao: a.observacao || undefined,
    })),
  };
}

export async function carregarAlunosDb(): Promise<AlunoCadastro[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('alunos')
    .select('*, membros_familia(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Erro ao carregar alunos do banco:', error.message);
    return null;
  }
  return (data || []).map(mapAlunoFromDb);
}

export async function carregarProtocolosDb(): Promise<ProtocoloMensal[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('protocolos_mensais')
    .select('*, cupons_fiscais(*), auditoria_protocolos(*)')
    .order('data_envio', { ascending: false });

  if (error) {
    console.warn('Erro ao carregar protocolos do banco:', error.message);
    return null;
  }
  return (data || []).map(mapProtocoloFromDb);
}

export async function salvarRecadastroDb(aluno: AlunoCadastro): Promise<void> {
  if (!supabase) return;
  const payload = {
    tipo_solicitacao: aluno.tipoSolicitacao,
    nome: aluno.nome,
    rg: aluno.rg,
    cpf: aluno.cpf,
    email: aluno.email,
    telefone: aluno.telefone,
    endereco: aluno.endereco,
    numero: aluno.numero,
    bairro: aluno.bairro,
    instituicao: aluno.instituicao,
    cidade_instituicao: aluno.cidadeInstituicao,
    curso: aluno.curso,
    banco: aluno.banco,
    agencia: aluno.agencia,
    conta: aluno.conta,
    chave_pix: aluno.chavePix,
    tipo_chave_pix: aluno.tipoChavePix,
    faixa_reembolso: aluno.faixaReembolso,
    status: aluno.status,
    motivo_pendencia: aluno.motivoPendencia ?? null,
  };

  const { data, error } = await supabase
    .from('alunos')
    .upsert(payload, { onConflict: 'cpf' })
    .select('id')
    .single();

  if (error || !data) {
    console.warn('Erro ao salvar aluno no banco:', error?.message);
    return;
  }

  if (aluno.membrosFamilia && aluno.membrosFamilia.length > 0) {
    await supabase.from('membros_familia').delete().eq('aluno_id', data.id);
    await supabase.from('membros_familia').insert(
      aluno.membrosFamilia.map((m) => ({
        aluno_id: data.id,
        nome_completo: m.nomeCompleto,
        data_nasc: m.dataNasc,
        parentesco: m.parentesco,
        profissao: m.profissao,
        renda: m.renda,
      }))
    );
  }
}

export async function julgarRecadastroDb(
  alunoId: string,
  status: StatusRecadastro,
  faixa?: FaixaReembolso,
  motivo?: string
): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('alunos')
    .update({
      status,
      ...(faixa ? { faixa_reembolso: faixa } : {}),
      motivo_pendencia: status === 'PENDENTE_CORRECAO' ? motivo ?? null : null,
    })
    .eq('id', alunoId);
}

export async function inserirProtocoloDb(protocolo: ProtocoloMensal): Promise<void> {
  if (!supabase) return;

  const { data, error } = await supabase
    .from('protocolos_mensais')
    .insert({
      codigo_hash: protocolo.codigoHash,
      aluno_id: protocolo.alunoId,
      aluno_nome: protocolo.alunoNome,
      aluno_rg: protocolo.alunoRg,
      aluno_cpf: protocolo.alunoCpf,
      aluno_curso: protocolo.alunoCurso,
      aluno_instituicao: protocolo.alunoInstituicao,
      aluno_cidade_instituicao: protocolo.alunoCidadeInstituicao,
      aluno_chave_pix: protocolo.alunoChavePix,
      mes_referencia: protocolo.mesReferencia,
      tipo_transporte: protocolo.tipoTransporte,
      status: protocolo.status,
      faixa_aplicada: protocolo.faixaAplicada,
      empresa_transporte: protocolo.empresaTransporte,
      nf_numero: protocolo.nfNumero,
      nf_cnpj: protocolo.nfCnpj,
      nf_data_emissao: protocolo.nfDataEmissao || null,
      nf_arquivo_url: protocolo.nfArquivoUrl,
      nf_arquivo_nome: protocolo.nfArquivoNome,
      valor_individual_nf: protocolo.valorIndividualNf ?? null,
      valor_total_comprovado: protocolo.valorTotalComprovado,
      valor_reembolso_estimado: protocolo.valorReembolsoEstimado,
      confianca_ia: protocolo.confiancaIa,
      declaracao_veracidade: protocolo.declaracaoVeracidade,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.warn('Erro ao inserir protocolo no banco:', error?.message);
    return;
  }

  if (protocolo.cupons && protocolo.cupons.length > 0) {
    await supabase.from('cupons_fiscais').insert(
      protocolo.cupons.map((c) => ({
        protocolo_id: data.id,
        chave_acesso: c.chaveAcesso,
        data_emissao: c.dataEmissao || null,
        numero: c.numero,
        cnpj_emissor: c.cnpjEmissor,
        valor: c.valor,
        comprovante_foto_url: c.comprovanteFotoUrl,
        confianca: c.confianca,
      }))
    );
  }

  if (protocolo.historicoAuditoria.length > 0) {
    await supabase.from('auditoria_protocolos').insert(
      protocolo.historicoAuditoria.map((h) => ({
        protocolo_id: data.id,
        data: h.data,
        autor: h.autor,
        acao: h.acao,
        observacao: h.observacao ?? null,
      }))
    );
  }
}

export async function julgarProtocoloDb(
  protocoloId: string,
  status: StatusProtocolo,
  acaoTxt: string,
  motivo?: string
): Promise<void> {
  if (!supabase) return;

  await supabase
    .from('protocolos_mensais')
    .update({
      status,
      motivo_pendencia: status === 'PENDENTE_CORRECAO' ? motivo ?? null : null,
      data_julgamento: new Date().toISOString(),
    })
    .eq('id', protocoloId);

  await supabase.from('auditoria_protocolos').insert({
    protocolo_id: protocoloId,
    autor: 'Secretaria de Transporte Escolar (Auditor)',
    acao: acaoTxt,
    observacao: motivo ?? null,
  });
}
