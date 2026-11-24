import React, { useState } from 'react';
import {
  Layout,
  Menu,
  Card,
  Statistic,
  Table,
  Tag,
  Button,
  Drawer,
  Radio,
  Input,
  message,
  Typography,
  Space,
  Divider,
  Timeline,
  Image,
} from 'antd';
import {
  DashboardOutlined,
  SolutionOutlined,
  AuditOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  DollarOutlined,
  UsergroupAddOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../context/AppContext';
import { gerarPdfRequerimento, gerarPdfAnexoIV } from '../services/pdfService';
import type { AlunoCadastro, ProtocoloMensal, FaixaReembolso, StatusRecadastro, StatusProtocolo } from '../types';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

export const PainelSecretaria: React.FC = () => {
  const { todosAlunos, protocolos, julgarRecadastro, julgarProtocolo } = useApp();
  const [menuSelecionado, setMenuSelecionado] = useState<'dashboard' | 'recadastros' | 'validacao' | 'financeiro'>('dashboard');

  const [drawerRecadastroOpen, setDrawerRecadastroOpen] = useState(false);
  const [alunoEmAnalise, setAlunoEmAnalise] = useState<AlunoCadastro | null>(null);
  const [faixaDefinida, setFaixaDefinida] = useState<FaixaReembolso>('75%');
  const [justificativaRecadastro, setJustificativaRecadastro] = useState('');

  const [drawerProtocoloOpen, setDrawerProtocoloOpen] = useState(false);
  const [protocoloEmAnalise, setProtocoloEmAnalise] = useState<ProtocoloMensal | null>(null);
  const [justificativaProtocolo, setJustificativaProtocolo] = useState('');

  const [filtroStatusRecadastro, setFiltroStatusRecadastro] = useState<string>('TODOS');
  const [filtroStatusProtocolo, setFiltroStatusProtocolo] = useState<string>('TODOS');

  // Métricas
  const alunosAtivos = todosAlunos.filter((a) => a.status === 'APROVADO');
  const alunos75 = alunosAtivos.filter((a) => a.faixaReembolso === '75%').length;
  const alunos100 = alunosAtivos.filter((a) => a.faixaReembolso === '100%').length;
  const recadastrosPendentes = todosAlunos.filter((a) => a.status === 'EM_ANALISE').length;
  const protocolosPendentes = protocolos.filter((p) => p.status === 'PENDENTE_ANALISE').length;
  
  const totalReembolsoAprovadoMes = protocolos
    .filter((p) => p.status === 'APROVADO_PAGAMENTO')
    .reduce((acc, p) => acc + p.valorReembolsoEstimado, 0);

  const totalReembolsoPendenteMes = protocolos
    .filter((p) => p.status === 'PENDENTE_ANALISE')
    .reduce((acc, p) => acc + p.valorReembolsoEstimado, 0);

  const abrirAnaliseRecadastro = (aluno: AlunoCadastro) => {
    setAlunoEmAnalise(aluno);
    setFaixaDefinida(aluno.faixaReembolso || '75%');
    setJustificativaRecadastro(aluno.motivoPendencia || '');
    setDrawerRecadastroOpen(true);
  };

  const handleSalvarRecadastro = (status: StatusRecadastro) => {
    if (!alunoEmAnalise) return;
    if (status === 'PENDENTE_CORRECAO' && !justificativaRecadastro.trim()) {
      message.error('Por favor, informe a justificativa técnica para devolução ao estudante.');
      return;
    }

    julgarRecadastro(alunoEmAnalise.id, status, faixaDefinida, justificativaRecadastro);
    message.success(`Requerimento de ${alunoEmAnalise.nome} avaliado como ${status}.`);
    setDrawerRecadastroOpen(false);
  };

  const abrirAnaliseProtocolo = (protocolo: ProtocoloMensal) => {
    setProtocoloEmAnalise(protocolo);
    setJustificativaProtocolo(protocolo.motivoPendencia || '');
    setDrawerProtocoloOpen(true);
  };

  const handleSalvarProtocolo = (status: StatusProtocolo) => {
    if (!protocoloEmAnalise) return;
    if (status === 'PENDENTE_CORRECAO' && !justificativaProtocolo.trim()) {
      message.error('Para registrar pendência, preencha o motivo correspondente.');
      return;
    }

    julgarProtocolo(protocoloEmAnalise.id, status, justificativaProtocolo);
    message.success(`Protocolo ${protocoloEmAnalise.codigoHash} atualizado com sucesso.`);
    setDrawerProtocoloOpen(false);
  };

  const exportarLoteCsv = () => {
    const aprovados = protocolos.filter((p) => p.status === 'APROVADO_PAGAMENTO');
    if (aprovados.length === 0) {
      message.warning('Não há protocolos autorizados para pagamento no momento.');
      return;
    }

    const headers = ['Nome do Estudante', 'CPF', 'Chave PIX', 'Faixa', 'Valor Comprovado (R$)', 'Valor Final a Pagar (R$)', 'Protocolo HASH'];
    const rows = aprovados.map((p) => [
      `"${p.alunoNome}"`,
      `"${p.alunoCpf}"`,
      `"${p.alunoChavePix}"`,
      `"${p.faixaAplicada}"`,
      p.valorTotalComprovado.toFixed(2),
      p.valorReembolsoEstimado.toFixed(2),
      `"${p.codigoHash}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SEMEC_Capivari_LoteReembolso_${dayjs().format('YYYY-MM-DD_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    message.success(`Arquivo de remessa financeira (${aprovados.length} pagamentos) gerado.`);
  };

  const colunasRecadastro = [
    {
      title: 'Estudante Requerente',
      key: 'aluno',
      render: (_: any, r: AlunoCadastro) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1F2421' }}>{r.nome}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            CPF: {r.cpf} • {r.instituicao}
          </Text>
        </div>
      ),
    },
    {
      title: 'Curso',
      dataIndex: 'curso',
      key: 'curso',
      render: (c: string) => <Text style={{ fontSize: 13 }}>{c}</Text>,
    },
    {
      title: 'Faixa Pleiteada',
      dataIndex: 'faixaReembolso',
      key: 'faixaReembolso',
      render: (f: FaixaReembolso) => (
        <Tag style={{ background: f === '100%' ? '#FFF8E1' : '#E8F5E9', color: f === '100%' ? '#C99B53' : '#1B5E3A', borderColor: '#E6E0D4' }}>
          {f}
        </Tag>
      ),
    },
    {
      title: 'Situação',
      dataIndex: 'status',
      key: 'status',
      render: (s: StatusRecadastro) => {
        if (s === 'APROVADO') return <Tag color="success">Deferido</Tag>;
        if (s === 'PENDENTE_CORRECAO') return <Tag color="warning">Com Pendência</Tag>;
        if (s === 'EM_ANALISE') return <Tag color="processing">Em Análise</Tag>;
        return <Tag color="error">Indeferido</Tag>;
      },
    },
    {
      title: 'Ações',
      key: 'acoes',
      align: 'right' as const,
      render: (_: any, r: AlunoCadastro) => (
        <Button
          type="default"
          icon={<EyeOutlined />}
          size="small"
          style={{ borderColor: '#1B5E3A', color: '#1B5E3A', borderRadius: 4 }}
          onClick={() => abrirAnaliseRecadastro(r)}
        >
          Auditar
        </Button>
      ),
    },
  ];

  const colunasProtocolos = [
    {
      title: 'Protocolo / Registro',
      key: 'hash',
      render: (_: any, r: ProtocoloMensal) => (
        <div>
          <Text strong style={{ color: '#1B5E3A', fontFamily: 'monospace' }}>{r.codigoHash}</Text>
          <div style={{ fontSize: 12, color: '#59615C' }}>
            {dayjs(r.dataEnvio).format('DD/MM/YYYY HH:mm')}
          </div>
        </div>
      ),
    },
    {
      title: 'Estudante / Chave PIX',
      key: 'aluno',
      render: (_: any, r: ProtocoloMensal) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1F2421' }}>{r.alunoNome}</div>
          <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>PIX: {r.alunoChavePix}</Text>
        </div>
      ),
    },
    {
      title: 'Modalidade',
      key: 'tipo',
      render: (_: any, r: ProtocoloMensal) => (
        <Space>
          <Tag style={{ background: '#F9F7F2', borderColor: '#E6E0D4', color: '#1F2421' }}>
            {r.tipoTransporte === 'FRETADO' ? 'Fretado' : 'Circular'}
          </Tag>
          <Tag style={{ background: '#FFFFFF', borderColor: '#E6E0D4' }}>{r.mesReferencia}</Tag>
        </Space>
      ),
    },
    {
      title: 'Despesa',
      dataIndex: 'valorTotalComprovado',
      key: 'valorTotal',
      align: 'right' as const,
      render: (v: number) => <span className="tabular-nums">R$ {v.toFixed(2)}</span>,
    },
    {
      title: 'Reembolso Autorizado',
      key: 'reembolso',
      align: 'right' as const,
      render: (_: any, r: ProtocoloMensal) => (
        <div>
          <strong style={{ color: '#1B5E3A' }} className="tabular-nums">R$ {r.valorReembolsoEstimado.toFixed(2)}</strong>
          <div style={{ fontSize: 11, color: '#59615C' }}>Faixa {r.faixaAplicada}</div>
        </div>
      ),
    },
    {
      title: 'Situação',
      dataIndex: 'status',
      key: 'status',
      render: (s: StatusProtocolo) => {
        if (s === 'APROVADO_PAGAMENTO') return <Tag color="success">Autorizado</Tag>;
        if (s === 'PENDENTE_CORRECAO') return <Tag color="warning">Com Pendência</Tag>;
        if (s === 'PENDENTE_ANALISE') return <Tag color="processing">Em Análise</Tag>;
        return <Tag color="error">Indeferido</Tag>;
      },
    },
    {
      title: 'Auditoria',
      key: 'acao',
      align: 'right' as const,
      render: (_: any, r: ProtocoloMensal) => (
        <Button
          type="primary"
          icon={<AuditOutlined />}
          size="small"
          style={{ background: '#1B5E3A', borderColor: '#1B5E3A', borderRadius: 4 }}
          onClick={() => abrirAnaliseProtocolo(r)}
        >
          Conferir
        </Button>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: 'calc(100vh - 120px)', background: '#F9F7F2' }}>
      {/* SIDER LATERAL INSTITUCIONAL EM VERDE ESCURO (#14452B) */}
      <Sider
        width={250}
        style={{
          background: '#14452B',
          borderRight: '1px solid #0E331F',
        }}
      >
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div
            style={{
              fontFamily: "'Merriweather', serif",
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            Gestão SEMEC
          </div>
          <div style={{ color: '#C99B53', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 2 }}>
            Transporte Universitário
          </div>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[menuSelecionado]}
          onClick={({ key }) => setMenuSelecionado(key as any)}
          style={{
            background: 'transparent',
            borderRight: 0,
            marginTop: 12,
            fontSize: 14,
            fontWeight: 500,
          }}
          items={[
            {
              key: 'dashboard',
              icon: <DashboardOutlined style={{ fontSize: 16 }} />,
              label: 'Painel Geral',
            },
            {
              key: 'recadastros',
              icon: <SolutionOutlined style={{ fontSize: 16 }} />,
              label: (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span>Recadastros</span>
                  {recadastrosPendentes > 0 && (
                    <Tag style={{ background: '#C99B53', color: '#1F2421', border: 0, fontSize: 11, fontWeight: 700 }}>
                      {recadastrosPendentes}
                    </Tag>
                  )}
                </div>
              ),
            },
            {
              key: 'validacao',
              icon: <AuditOutlined style={{ fontSize: 16 }} />,
              label: (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span>Prestações Mensais</span>
                  {protocolosPendentes > 0 && (
                    <Tag style={{ background: '#4CAF50', color: '#FFFFFF', border: 0, fontSize: 11, fontWeight: 700 }}>
                      {protocolosPendentes}
                    </Tag>
                  )}
                </div>
              ),
            },
            {
              key: 'financeiro',
              icon: <FileExcelOutlined style={{ fontSize: 16 }} />,
              label: 'Remessa Bancária',
            },
          ]}
        />
      </Sider>

      {/* CONTEÚDO */}
      <Content style={{ padding: '28px 32px' }}>
        {/* ================= ABA 1: DASHBOARD ================= */}
        {menuSelecionado === 'dashboard' && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <Title level={3} style={{ margin: 0, color: '#1F2421' }}>
                Auditoria do Transporte Universitário
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Acompanhamento em tempo real de cadastros, validações contábeis e estimativas orçamentárias
              </Text>
            </div>

            {/* CARDS COM FILETE SEMÂNTICO (SEM CARA DE IA) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18, marginBottom: 28 }}>
              <Card className="semec-card semec-card-accent-green">
                <Statistic
                  title={<span style={{ color: '#59615C', fontSize: 13 }}>Estudantes Ativos Deferidos</span>}
                  value={alunosAtivos.length}
                  prefix={<UsergroupAddOutlined style={{ color: '#1B5E3A' }} />}
                  suffix={<span style={{ fontSize: 12, color: '#59615C' }}>({alunos75} na 75% | {alunos100} na 100%)</span>}
                />
              </Card>

              <Card className="semec-card semec-card-accent-gold">
                <Statistic
                  title={<span style={{ color: '#59615C', fontSize: 13 }}>Recadastros a Homologar</span>}
                  value={recadastrosPendentes}
                  valueStyle={{ color: recadastrosPendentes > 0 ? '#C99B53' : '#1B5E3A', fontWeight: 700 }}
                  prefix={<SolutionOutlined />}
                />
              </Card>

              <Card className="semec-card semec-card-accent-terracotta">
                <Statistic
                  title={<span style={{ color: '#59615C', fontSize: 13 }}>Comprovantes a Auditar</span>}
                  value={protocolosPendentes}
                  valueStyle={{ color: protocolosPendentes > 0 ? '#A83A28' : '#1B5E3A', fontWeight: 700 }}
                  prefix={<AuditOutlined />}
                />
              </Card>

              <Card className="semec-card semec-card-accent-green">
                <Statistic
                  title={<span style={{ color: '#59615C', fontSize: 13 }}>Total Liberado para Repasse</span>}
                  value={totalReembolsoAprovadoMes}
                  precision={2}
                  prefix="R$"
                  valueStyle={{ color: '#1B5E3A', fontWeight: 700 }}
                />
              </Card>
            </div>

            {/* AÇÕES INSTITUCIONAIS */}
            <Card
              className="semec-card"
              title={
                <span style={{ fontFamily: "'Merriweather', serif", fontWeight: 700, fontSize: 15 }}>
                  Ações de Auditoria
                </span>
              }
              style={{ marginBottom: 28 }}
            >
              <Space wrap size="middle">
                <Button
                  type="primary"
                  icon={<SolutionOutlined />}
                  style={{ background: '#1B5E3A', borderColor: '#1B5E3A', borderRadius: 6 }}
                  onClick={() => setMenuSelecionado('recadastros')}
                >
                  Conferir Fila de Recadastros ({recadastrosPendentes})
                </Button>
                <Button
                  icon={<AuditOutlined />}
                  style={{ borderColor: '#E6E0D4', borderRadius: 6 }}
                  onClick={() => setMenuSelecionado('validacao')}
                >
                  Auditar Protocolos Mensais ({protocolosPendentes})
                </Button>
                <Button
                  icon={<FileExcelOutlined />}
                  style={{ borderColor: '#C99B53', color: '#C99B53', borderRadius: 6, fontWeight: 600 }}
                  onClick={exportarLoteCsv}
                >
                  Exportar Relatório Financeiro (CSV)
                </Button>
              </Space>
            </Card>

            <Card
              className="semec-card"
              title={
                <span style={{ fontFamily: "'Merriweather', serif", fontWeight: 700, fontSize: 15 }}>
                  Últimos Protocolos Mensais Submetidos
                </span>
              }
            >
              <Table
                dataSource={protocolos.slice(0, 5)}
                columns={colunasProtocolos}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          </div>
        )}

        {/* ================= ABA 2: RECADASTROS ================= */}
        {menuSelecionado === 'recadastros' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <Title level={3} style={{ margin: 0, color: '#1F2421' }}>
                  Fila de Recadastros Semestrais
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Conferência de documentação acadêmica e fixação da faixa regulamentar (75% ou 100%).
                </Text>
              </div>

              <Radio.Group
                value={filtroStatusRecadastro}
                onChange={(e) => setFiltroStatusRecadastro(e.target.value)}
                buttonStyle="solid"
                size="middle"
              >
                <Radio.Button value="TODOS">Todos ({todosAlunos.length})</Radio.Button>
                <Radio.Button value="EM_ANALISE">Em Análise ({recadastrosPendentes})</Radio.Button>
                <Radio.Button value="APROVADO">Deferidos ({alunosAtivos.length})</Radio.Button>
                <Radio.Button value="PENDENTE_CORRECAO">Com Pendência</Radio.Button>
              </Radio.Group>
            </div>

            <Card className="semec-card">
              <Table
                dataSource={todosAlunos.filter((a) =>
                  filtroStatusRecadastro === 'TODOS' ? true : a.status === filtroStatusRecadastro
                )}
                columns={colunasRecadastro}
                rowKey="id"
                pagination={{ pageSize: 8 }}
              />
            </Card>
          </div>
        )}

        {/* ================= ABA 3: VALIDAÇÃO MENSAL ================= */}
        {menuSelecionado === 'validacao' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <Title level={3} style={{ margin: 0, color: '#1F2421' }}>
                  Auditoria Fiscal de Comprovantes
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Conferência de Notas Fiscais e lotes de cupons fiscais com validação contra duplicidade de chave.
                </Text>
              </div>

              <Radio.Group
                value={filtroStatusProtocolo}
                onChange={(e) => setFiltroStatusProtocolo(e.target.value)}
                buttonStyle="solid"
                size="middle"
              >
                <Radio.Button value="TODOS">Todos ({protocolos.length})</Radio.Button>
                <Radio.Button value="PENDENTE_ANALISE">A Conferir ({protocolosPendentes})</Radio.Button>
                <Radio.Button value="APROVADO_PAGAMENTO">Autorizados</Radio.Button>
                <Radio.Button value="PENDENTE_CORRECAO">Pendências</Radio.Button>
              </Radio.Group>
            </div>

            <Card className="semec-card">
              <Table
                dataSource={protocolos.filter((p) =>
                  filtroStatusProtocolo === 'TODOS' ? true : p.status === filtroStatusProtocolo
                )}
                columns={colunasProtocolos}
                rowKey="id"
                pagination={{ pageSize: 8 }}
              />
            </Card>
          </div>
        )}

        {/* ================= ABA 4: FINANCEIRO ================= */}
        {menuSelecionado === 'financeiro' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <Title level={3} style={{ margin: 0, color: '#1F2421' }}>
                Fechamento Financeiro & Tesouraria
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Geração de arquivo para liquidação contábil e repasse via Chave PIX cadastrada.
              </Text>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 24 }}>
              <Card className="semec-card semec-card-accent-green">
                <Statistic
                  title={<span style={{ color: '#59615C', fontSize: 13 }}>Valor Total Homologado para Pagamento</span>}
                  value={totalReembolsoAprovadoMes}
                  precision={2}
                  prefix="R$"
                  valueStyle={{ color: '#1B5E3A', fontWeight: 700 }}
                />
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Contempla {protocolos.filter((p) => p.status === 'APROVADO_PAGAMENTO').length} protocolos autorizados
                  </Text>
                </div>
              </Card>

              <Card className="semec-card semec-card-accent-gold">
                <Statistic
                  title={<span style={{ color: '#59615C', fontSize: 13 }}>Montante em Auditoria Técnica</span>}
                  value={totalReembolsoPendenteMes}
                  precision={2}
                  prefix="R$"
                  valueStyle={{ color: '#C99B53' }}
                />
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {protocolosPendentes} protocolos em análise prévia
                  </Text>
                </div>
              </Card>
            </div>

            <Card
              className="semec-card"
              title={
                <span style={{ fontFamily: "'Merriweather', serif", fontWeight: 700, fontSize: 15 }}>
                  Relação de Pagamentos Autorizados
                </span>
              }
              extra={
                <Button
                  type="primary"
                  icon={<FileExcelOutlined />}
                  style={{ background: '#1B5E3A', borderColor: '#1B5E3A', borderRadius: 6, fontWeight: 600 }}
                  onClick={exportarLoteCsv}
                >
                  Exportar Remessa Bancária (CSV)
                </Button>
              }
            >
              <Table
                dataSource={protocolos.filter((p) => p.status === 'APROVADO_PAGAMENTO')}
                columns={colunasProtocolos}
                rowKey="id"
                pagination={{ pageSize: 8 }}
                locale={{ emptyText: 'Nenhum protocolo autorizado para pagamento até o momento.' }}
              />
            </Card>
          </div>
        )}
      </Content>

      {/* ================= DRAWER: ANÁLISE DE RECADASTRO (FASE 1) ================= */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 }}>
            <span style={{ fontFamily: "'Merriweather', serif", fontWeight: 700 }}>
              Auditoria de Recadastro: {alunoEmAnalise?.nome || ''}
            </span>
            {alunoEmAnalise && (
              <Button
                size="small"
                icon={<FilePdfOutlined />}
                style={{ borderColor: '#1B5E3A', color: '#1B5E3A' }}
                onClick={() =>
                  gerarPdfRequerimento(alunoEmAnalise)
                    .then(() => message.success('Requerimento oficial baixado em PDF!'))
                    .catch(() => message.error('Erro ao gerar PDF.'))
                }
              >
                Baixar PDF ({alunoEmAnalise.faixaReembolso === '100%' ? 'Anexo II+III' : 'Anexo I'})
              </Button>
            )}
          </div>
        }
        placement="right"
        width={560}
        onClose={() => setDrawerRecadastroOpen(false)}
        open={drawerRecadastroOpen}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <Button
              danger
              onClick={() => handleSalvarRecadastro('REPROVADO')}
              icon={<CloseCircleOutlined />}
              style={{ borderRadius: 6 }}
            >
              Indeferir
            </Button>
            <Space>
              <Button
                type="default"
                style={{ borderColor: '#C99B53', color: '#C99B53', borderRadius: 6 }}
                onClick={() => handleSalvarRecadastro('PENDENTE_CORRECAO')}
                icon={<ExclamationCircleOutlined />}
              >
                Apontar Pendência
              </Button>
              <Button
                type="primary"
                style={{ background: '#1B5E3A', borderColor: '#1B5E3A', borderRadius: 6 }}
                onClick={() => handleSalvarRecadastro('APROVADO')}
                icon={<CheckCircleOutlined />}
              >
                Deferir Recadastro
              </Button>
            </Space>
          </div>
        }
      >
        {alunoEmAnalise && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ color: '#1F2421' }}>Instituição de Ensino & Curso:</Text>
              <div>{alunoEmAnalise.instituicao} — {alunoEmAnalise.curso}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>CPF: {alunoEmAnalise.cpf} • Contato: {alunoEmAnalise.telefone}</Text>
            </div>

            <Divider plain>Domicílio Bancário Declarado</Divider>
            <div style={{ background: '#F9F7F2', padding: 12, borderRadius: 6, border: '1px solid #E6E0D4', marginBottom: 16 }}>
              <div><strong>Banco:</strong> {alunoEmAnalise.banco}</div>
              <div><strong>Agência:</strong> {alunoEmAnalise.agencia} | <strong>Conta:</strong> {alunoEmAnalise.conta}</div>
              <div style={{ marginTop: 4 }}>
                <strong>Chave PIX ({alunoEmAnalise.tipoChavePix}):</strong>{' '}
                <Text code copyable>{alunoEmAnalise.chavePix}</Text>
              </div>
            </div>

            <Divider plain>Comprovação Documental Anexada</Divider>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text>1. Comprovante de Residência em Capivari</Text>
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => window.open(alunoEmAnalise.comprovanteResidenciaUrl || 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=800&q=80', '_blank')}
                >
                  Conferir Anexo
                </Button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text>2. Atestado de Matrícula e Frequência</Text>
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => window.open(alunoEmAnalise.comprovanteMatriculaUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80', '_blank')}
                >
                  Conferir Anexo
                </Button>
              </div>
              {alunoEmAnalise.faixaReembolso === '100%' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ color: '#C99B53' }}>3. Comprovante de Hipossuficiência (100%)</Text>
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => window.open(alunoEmAnalise.declaracaoCustoUrl || 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80', '_blank')}
                  >
                    Conferir Anexo
                  </Button>
                </div>
              )}
            </div>

            <Divider plain>Parecer da SEMEC Capivari</Divider>
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ color: '#1F2421' }}>Faixa Oficial de Enquadramento:</Text>
              <div style={{ marginTop: 8 }}>
                <Radio.Group
                  value={faixaDefinida}
                  onChange={(e) => setFaixaDefinida(e.target.value)}
                  buttonStyle="solid"
                >
                  <Radio.Button value="75%">Faixa Regulamentar (75%)</Radio.Button>
                  <Radio.Button value="100%">Faixa Integral (100%)</Radio.Button>
                </Radio.Group>
              </div>
            </div>

            <div>
              <Text strong style={{ color: '#1F2421' }}>Motivo / Justificativa Técnica:</Text>
              <TextArea
                rows={3}
                value={justificativaRecadastro}
                onChange={(e) => setJustificativaRecadastro(e.target.value)}
                placeholder="Exigido ao apontar pendência (o estudante visualizará esta instrução no painel dele)..."
                style={{ marginTop: 6, borderRadius: 6 }}
              />
            </div>
          </div>
        )}
      </Drawer>

      {/* ================= DRAWER LARGO: AUDITORIA DE PROTOCOLO MENSAL (FASE 2) ================= */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: "'Merriweather', serif", fontWeight: 700 }}>
                Auditoria do Protocolo: {protocoloEmAnalise?.codigoHash}
              </span>
              <Tag style={{ background: '#F9F7F2', borderColor: '#E6E0D4', color: '#1F2421' }}>
                {protocoloEmAnalise?.tipoTransporte === 'FRETADO' ? 'Nota Fiscal' : 'Lote de Cupons'}
              </Tag>
            </div>
            {protocoloEmAnalise && (
              <Button
                size="small"
                icon={<FilePdfOutlined />}
                style={{ borderColor: '#1B5E3A', color: '#1B5E3A' }}
                onClick={() => {
                  const alunoRef = todosAlunos.find((a) => a.id === protocoloEmAnalise.alunoId);
                  gerarPdfAnexoIV(protocoloEmAnalise, alunoRef)
                    .then(() => message.success('Anexo IV (Protocolo + Recibo) baixado em PDF!'))
                    .catch(() => message.error('Erro ao gerar PDF.'));
                }}
              >
                Baixar Anexo IV (PDF)
              </Button>
            )}
          </div>
        }
        placement="right"
        width={850}
        onClose={() => setDrawerProtocoloOpen(false)}
        open={drawerProtocoloOpen}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              danger
              onClick={() => handleSalvarProtocolo('REPROVADO')}
              icon={<CloseCircleOutlined />}
              style={{ borderRadius: 6 }}
            >
              Indeferir Despesa
            </Button>
            <Space>
              <Button
                type="default"
                style={{ borderColor: '#C99B53', color: '#C99B53', borderRadius: 6 }}
                onClick={() => handleSalvarProtocolo('PENDENTE_CORRECAO')}
                icon={<ExclamationCircleOutlined />}
              >
                Apontar Pendência
              </Button>
              <Button
                type="primary"
                style={{ background: '#1B5E3A', borderColor: '#1B5E3A', borderRadius: 6 }}
                onClick={() => handleSalvarProtocolo('APROVADO_PAGAMENTO')}
                icon={<CheckCircleOutlined />}
              >
                Autorizar Repasse (R$ {protocoloEmAnalise?.valorReembolsoEstimado.toFixed(2)})
              </Button>
            </Space>
          </div>
        }
      >
        {protocoloEmAnalise && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 24 }}>
            {/* COLUNA ESQUERDA: COMPROVANTES */}
            <div style={{ borderRight: '1px solid #E6E0D4', paddingRight: 18 }}>
              <Title level={5} style={{ margin: 0, marginBottom: 12, color: '#1F2421' }}>
                Comprovantes Anexados
              </Title>

              {protocoloEmAnalise.tipoTransporte === 'FRETADO' ? (
                <div>
                  <div style={{ marginBottom: 10 }}>
                    <Text strong style={{ fontSize: 13 }}>{protocoloEmAnalise.nfArquivoNome || 'Nota_Fiscal.pdf'}</Text>
                  </div>
                  <div
                    style={{
                      border: '1px solid #E6E0D4',
                      borderRadius: 6,
                      overflow: 'hidden',
                      background: '#F9F7F2',
                      textAlign: 'center',
                    }}
                  >
                    <Image
                      src={protocoloEmAnalise.nfArquivoUrl}
                      alt="Nota Fiscal"
                      style={{ maxHeight: 360, objectFit: 'contain' }}
                      fallback="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=900&q=80"
                    />
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 10 }}>
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => window.open(protocoloEmAnalise.nfArquivoUrl, '_blank')}
                    >
                      Ampliar em Nova Aba
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Text strong style={{ fontSize: 13 }}>Cupons Fiscais do Lote ({protocoloEmAnalise.cupons?.length || 0}):</Text>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, maxHeight: 420, overflowY: 'auto' }}>
                    {protocoloEmAnalise.cupons?.map((c, idx) => (
                      <div
                        key={c.id || idx}
                        style={{
                          background: '#F9F7F2',
                          padding: 10,
                          borderRadius: 6,
                          border: '1px solid #E6E0D4',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{c.numero}</strong>
                          <span style={{ fontWeight: 600, color: '#1B5E3A' }} className="tabular-nums">R$ {c.valor.toFixed(2)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#59615C' }}>
                          Emissão: {c.dataEmissao} • CNPJ: {c.cnpjEmissor}
                        </div>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#59615C', wordBreak: 'break-all', marginTop: 2 }}>
                          Chave: {c.chaveAcesso}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* COLUNA DIREITA: DADOS E AUDITORIA */}
            <div>
              <Title level={5} style={{ margin: 0, marginBottom: 12, color: '#1F2421' }}>
                Dados Extraídos & Cálculos
              </Title>

              {protocoloEmAnalise.tipoTransporte === 'FRETADO' && (
                <div style={{ background: '#F9F7F2', padding: 12, borderRadius: 6, border: '1px solid #E6E0D4', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text strong style={{ fontSize: 12 }}>Extração Documental:</Text>
                    <Tag style={{ background: '#E8F5E9', color: '#1B5E3A', borderColor: '#C8E6C9' }}>
                      Confiabilidade {protocoloEmAnalise.confiancaIa || 'ALTA'}
                    </Tag>
                  </div>
                  <div><strong>NF:</strong> {protocoloEmAnalise.nfNumero}</div>
                  <div><strong>CNPJ:</strong> {protocoloEmAnalise.nfCnpj}</div>
                  <div><strong>Emissão:</strong> {protocoloEmAnalise.nfDataEmissao}</div>
                </div>
              )}

              <Card size="small" className="semec-card" style={{ marginBottom: 16, background: '#FFFFFF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text type="secondary">Despesa Comprovada:</Text>
                  <strong className="tabular-nums">R$ {protocoloEmAnalise.valorTotalComprovado.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text type="secondary">Faixa do Estudante:</Text>
                  <Tag style={{ background: '#FFF8E1', color: '#C99B53', borderColor: '#FFE082' }}>
                    Faixa {protocoloEmAnalise.faixaAplicada}
                  </Tag>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong>Valor Homologado:</Text>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1B5E3A' }} className="tabular-nums">
                    R$ {protocoloEmAnalise.valorReembolsoEstimado.toFixed(2)}
                  </div>
                </div>
              </Card>

              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ color: '#1F2421' }}>Destinatário do Repasse:</Text>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  <div><strong>Estudante:</strong> {protocoloEmAnalise.alunoNome}</div>
                  <div><strong>CPF:</strong> {protocoloEmAnalise.alunoCpf}</div>
                  <div><strong>Chave PIX:</strong> <Text code copyable>{protocoloEmAnalise.alunoChavePix}</Text></div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ color: '#1F2421' }}>Despacho / Notificação ao Estudante:</Text>
                <TextArea
                  rows={2}
                  value={justificativaProtocolo}
                  onChange={(e) => setJustificativaProtocolo(e.target.value)}
                  placeholder="Escreva caso aponte alguma pendência para retificação do estudante..."
                  style={{ marginTop: 6, borderRadius: 6 }}
                />
              </div>

              <Divider plain>Trilha de Auditoria</Divider>
              <Timeline
                style={{ marginTop: 12 }}
                items={protocoloEmAnalise.historicoAuditoria.map((h, i) => ({
                  key: i,
                  children: (
                    <div>
                      <Text strong style={{ fontSize: 12 }}>{h.acao}</Text>
                      <div style={{ fontSize: 11, color: '#59615C' }}>
                        {dayjs(h.data).format('DD/MM/YYYY HH:mm')} — {h.autor}
                      </div>
                      {h.observacao && (
                        <div style={{ fontSize: 11, color: '#A83A28', marginTop: 2 }}>
                          Obs: {h.observacao}
                        </div>
                      )}
                    </div>
                  ),
                }))}
              />
            </div>
          </div>
        )}
      </Drawer>
    </Layout>
  );
};
