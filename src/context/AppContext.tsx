import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AlunoCadastro, ProtocoloMensal, CupomFiscalItem, FaixaReembolso, StatusRecadastro, StatusProtocolo } from '../types';
import { ALUNOS_MOCK, PROTOCOLOS_MOCK } from '../mocks/initialData';
import { isSupabaseConfigured } from '../services/supabaseClient';
import {
  carregarAlunosDb,
  carregarProtocolosDb,
  salvarRecadastroDb,
  julgarRecadastroDb,
  inserirProtocoloDb,
  julgarProtocoloDb,
} from '../services/databaseService';

interface AppContextType {
  // Perfil Atual
  perfil: 'ALUNO' | 'SECRETARIA';
  setPerfil: (p: 'ALUNO' | 'SECRETARIA') => void;

  // Aluno Selecionado para simulação (se perfil ALUNO)
  alunoAtual: AlunoCadastro;
  setAlunoAtualId: (id: string) => void;
  todosAlunos: AlunoCadastro[];

  // Operações de Aluno
  atualizarCadastroAluno: (dados: Partial<AlunoCadastro>) => void;
  submeterProtocoloMensal: (protocolo: Omit<ProtocoloMensal, 'id' | 'codigoHash' | 'dataEnvio' | 'historicoAuditoria'>) => ProtocoloMensal;

  // Cupons da Linha Circular em rascunho
  cuponsRascunho: CupomFiscalItem[];
  adicionarCupomRascunho: (cupom: CupomFiscalItem) => { sucesso: boolean; mensagem?: string };
  removerCupomRascunho: (id: string) => void;
  limparCuponsRascunho: () => void;
  todasChavesUsadas: Set<string>;

  // Operações da Secretaria
  protocolos: ProtocoloMensal[];
  julgarRecadastro: (alunoId: string, status: StatusRecadastro, faixa?: FaixaReembolso, motivo?: string) => void;
  julgarProtocolo: (protocoloId: string, status: StatusProtocolo, motivo?: string) => void;
  
  // API Key do Gemini
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [perfil, setPerfil] = useState<'ALUNO' | 'SECRETARIA'>('ALUNO');
  
  // Lista de Alunos e Aluno Ativo
  const [todosAlunos, setTodosAlunos] = useState<AlunoCadastro[]>(() => {
    const saved = localStorage.getItem('APP_ALUNOS');
    return saved ? JSON.parse(saved) : ALUNOS_MOCK;
  });

  const [alunoAtualId, setAlunoAtualId] = useState<string>(() => todosAlunos[0].id);

  // Lista de Protocolos
  const [protocolos, setProtocolos] = useState<ProtocoloMensal[]>(() => {
    const saved = localStorage.getItem('APP_PROTOCOLOS');
    return saved ? JSON.parse(saved) : PROTOCOLOS_MOCK;
  });

  // Cupons fiscais rascunho
  const [cuponsRascunho, setCuponsRascunho] = useState<CupomFiscalItem[]>([]);

  // API Key Gemini
  const [geminiApiKey, setGeminiApiKeyState] = useState<string>(() => {
    return localStorage.getItem('GEMINI_API_KEY') || '';
  });

  const setGeminiApiKey = (key: string) => {
    setGeminiApiKeyState(key);
    if (key) {
      localStorage.setItem('GEMINI_API_KEY', key);
    } else {
      localStorage.removeItem('GEMINI_API_KEY');
    }
  };

  // Sincronização inicial com o Banco de Dados (se configurado via .env)
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      const [alunosDb, protocolosDb] = await Promise.all([
        carregarAlunosDb(),
        carregarProtocolosDb(),
      ]);
      if (alunosDb && alunosDb.length > 0) {
        setTodosAlunos(alunosDb);
        setAlunoAtualId(alunosDb[0].id);
      }
      if (protocolosDb) {
        setProtocolos(protocolosDb);
      }
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem('APP_ALUNOS', JSON.stringify(todosAlunos));
  }, [todosAlunos]);

  useEffect(() => {
    localStorage.setItem('APP_PROTOCOLOS', JSON.stringify(protocolos));
  }, [protocolos]);

  const alunoAtual = todosAlunos.find((a) => a.id === alunoAtualId) || todosAlunos[0];

  // Coleta todas as chaves de 44 dígitos já registradas para antifraude
  const todasChavesUsadas = new Set<string>();
  protocolos.forEach((p) => {
    p.cupons?.forEach((c) => {
      if (c.chaveAcesso) todasChavesUsadas.add(c.chaveAcesso.trim());
    });
  });
  cuponsRascunho.forEach((c) => {
    if (c.chaveAcesso) todasChavesUsadas.add(c.chaveAcesso.trim());
  });

  // Atualizar cadastro do aluno
  const atualizarCadastroAluno = (dados: Partial<AlunoCadastro>) => {
    const atualizado: AlunoCadastro = {
      ...alunoAtual,
      ...dados,
      status: 'EM_ANALISE',
      dataAtualizacao: new Date().toISOString(),
      motivoPendencia: undefined,
    };

    setTodosAlunos((prev) => prev.map((a) => (a.id === alunoAtual.id ? atualizado : a)));
    void salvarRecadastroDb(atualizado);
  };

  // Adicionar cupom em rascunho com trava antifraude
  const adicionarCupomRascunho = (novoCupom: CupomFiscalItem): { sucesso: boolean; mensagem?: string } => {
    const chave = novoCupom.chaveAcesso.trim();
    if (todasChavesUsadas.has(chave)) {
      return {
        sucesso: false,
        mensagem: `A chave de acesso "${chave}" já foi utilizada anteriormente em outro lote ou prestação de contas! Duplicidade detectada pela trava antifraude.`,
      };
    }
    setCuponsRascunho((prev) => [...prev, novoCupom]);
    return { sucesso: true };
  };

  const removerCupomRascunho = (id: string) => {
    setCuponsRascunho((prev) => prev.filter((c) => c.id !== id));
  };

  const limparCuponsRascunho = () => {
    setCuponsRascunho([]);
  };

  // Submeter protocolo de reembolso mensal
  const submeterProtocoloMensal = (
    dados: Omit<ProtocoloMensal, 'id' | 'codigoHash' | 'dataEnvio' | 'historicoAuditoria'>
  ): ProtocoloMensal => {
    const hash = 'PROTO-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const novo: ProtocoloMensal = {
      ...dados,
      id: 'prot-' + Date.now(),
      codigoHash: hash,
      dataEnvio: new Date().toISOString(),
      historicoAuditoria: [
        {
          data: new Date().toISOString(),
          autor: `${dados.alunoNome} (Aluno)`,
          acao: 'Protocolo de prestação de contas submetido digitalmente',
        },
      ],
    };

    setProtocolos((prev) => [novo, ...prev]);
    void inserirProtocoloDb(novo);
    return novo;
  };

  // Julgamento de recadastro (Secretaria)
  const julgarRecadastro = (alunoId: string, status: StatusRecadastro, faixa?: FaixaReembolso, motivo?: string) => {
    setTodosAlunos((prev) =>
      prev.map((a) => {
        if (a.id !== alunoId) return a;
        return {
          ...a,
          status,
          faixaReembolso: faixa || a.faixaReembolso,
          motivoPendencia: status === 'PENDENTE_CORRECAO' ? motivo : undefined,
          dataAtualizacao: new Date().toISOString(),
        };
      })
    );
    void julgarRecadastroDb(alunoId, status, faixa, motivo);
  };

  // Julgamento de protocolo mensal (Secretaria)
  const julgarProtocolo = (protocoloId: string, status: StatusProtocolo, motivo?: string) => {
    const acaoTxt =
      status === 'APROVADO_PAGAMENTO'
        ? 'Aprovado para pagamento'
        : status === 'PENDENTE_CORRECAO'
        ? 'Devolvido com pendência de correção'
        : 'Reprovado';

    setProtocolos((prev) =>
      prev.map((p) => {
        if (p.id !== protocoloId) return p;

        return {
          ...p,
          status,
          motivoPendencia: status === 'PENDENTE_CORRECAO' ? motivo : undefined,
          dataJulgamento: new Date().toISOString(),
          historicoAuditoria: [
            ...p.historicoAuditoria,
            {
              data: new Date().toISOString(),
              autor: 'Secretaria de Transporte Escolar (Auditor)',
              acao: acaoTxt,
              observacao: motivo,
            },
          ],
        };
      })
    );
    void julgarProtocoloDb(protocoloId, status, acaoTxt, motivo);
  };

  return (
    <AppContext.Provider
      value={{
        perfil,
        setPerfil,
        alunoAtual,
        setAlunoAtualId,
        todosAlunos,
        atualizarCadastroAluno,
        submeterProtocoloMensal,
        cuponsRascunho,
        adicionarCupomRascunho,
        removerCupomRascunho,
        limparCuponsRascunho,
        todasChavesUsadas,
        protocolos,
        julgarRecadastro,
        julgarProtocolo,
        geminiApiKey,
        setGeminiApiKey,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp deve ser usado dentro de AppProvider');
  return context;
};
