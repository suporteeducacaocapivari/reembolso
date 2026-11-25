import React, { useState } from 'react';
import {
  Card,
  Tag,
  Alert,
  Tabs,
  Select,
  Typography,
  Space,
  Radio,
  Tooltip,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  LockOutlined,
  CarOutlined,
  IdcardOutlined,
  DollarCircleOutlined,
  FilePdfOutlined,
  CalculatorOutlined,
} from '@ant-design/icons';
import { Button, message, Modal, Divider } from 'antd';
import dayjs from 'dayjs';
import { useApp } from '../context/AppContext';
import { RecadastroFase1 } from './RecadastroFase1';
import { PrestacaoFretado } from './PrestacaoFretado';
import { PrestacaoLinhaCircular } from './PrestacaoLinhaCircular';
import { gerarPdfAnexoIV } from '../services/pdfService';
import type { TipoTransporte } from '../types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export const AreaAluno: React.FC = () => {
  const { alunoAtual, todosAlunos, setAlunoAtualId, protocolos } = useApp();
  const [mesReferencia, setMesReferencia] = useState('2026-11');
  const [tipoTransporte, setTipoTransporte] = useState<TipoTransporte>('FRETADO');
  const [mesesFechados, setMesesFechados] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('APP_MESES_FECHADOS');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const mesAtualCalendario = dayjs().format('YYYY-MM');
  const chaveMesAluno = `${alunoAtual.id}_${mesReferencia}`;
  const isMesAtualFechado = Boolean(mesesFechados[chaveMesAluno]) || mesReferencia < mesAtualCalendario;

  const confirmarFechamentoMesConsolidado = (
    protocolosDoMes: typeof protocolos,
    somaComprovado: number,
    somaReembolso: number
  ) => {
    Modal.confirm({
      title: `Fechar o mês ${mesReferencia} e liberar Anexo IV?`,
      icon: <ExclamationCircleOutlined style={{ color: '#A83A28' }} />,
      width: 500,
      okText: 'Sim, Fechar Mês e Liberar Anexo IV',
      okButtonProps: { style: { background: '#1B5E3A', borderColor: '#1B5E3A' } },
      cancelText: 'Cancelar',
      content: (
        <div style={{ marginTop: 8 }}>
          <Alert
            type="warning"
            showIcon
            message="Atenção: ação irreversível"
            description={`Ao fechar o mês ${mesReferencia}, não será possível reabri-lo para adicionar novos comprovantes. Todos os ${protocolosDoMes.length} documento(s) do mês serão somados em um único Anexo IV oficial.`}
            style={{ marginBottom: 12, borderRadius: 6 }}
          />
          <div style={{ background: '#F9F7F2', border: '1px solid #E6E0D4', borderRadius: 6, padding: 10, fontSize: 13 }}>
            <div><strong>Valor Total Somado:</strong> R$ {somaComprovado.toFixed(2)}</div>
            <div><strong>Reembolso Estimado ({alunoAtual.faixaReembolso}):</strong> <strong style={{ color: '#1B5E3A' }}>R$ {somaReembolso.toFixed(2)}</strong></div>
          </div>
        </div>
      ),
      onOk: () => {
        const atualizado = { ...mesesFechados, [chaveMesAluno]: true };
        setMesesFechados(atualizado);
        localStorage.setItem('APP_MESES_FECHADOS', JSON.stringify(atualizado));
        message.success(`Mês ${mesReferencia} fechado com sucesso! Agora você pode gerar o Anexo IV consolidado.`);
      },
    });
  };

  const isAprovado = alunoAtual.status === 'APROVADO';
  const isPendente = alunoAtual.status === 'PENDENTE_CORRECAO';
  const isEmAnalise = alunoAtual.status === 'EM_ANALISE';

  const statusBadge = () => {
    switch (alunoAtual.status) {
      case 'APROVADO':
        return (
          <Tag
            style={{
              backgroundColor: '#E8F5E9',
              color: '#1B5E3A',
              borderColor: '#C8E6C9',
              fontSize: 13,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 4,
            }}
            icon={<CheckCircleOutlined />}
          >
            APROVADO — FAIXA {alunoAtual.faixaReembolso}
          </Tag>
        );
      case 'PENDENTE_CORRECAO':
        return (
          <Tag
            style={{
              backgroundColor: '#FBE9E7',
              color: '#A83A28',
              borderColor: '#FFCCBC',
              fontSize: 13,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 4,
            }}
            icon={<ExclamationCircleOutlined />}
          >
            PENDENTE DE CORREÇÃO
          </Tag>
        );
      case 'EM_ANALISE':
        return (
          <Tag
            style={{
              backgroundColor: '#FFF8E1',
              color: '#C99B53',
              borderColor: '#FFE082',
              fontSize: 13,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 4,
            }}
            icon={<ClockCircleOutlined />}
          >
            EM ANÁLISE PELA SEMEC
          </Tag>
        );
      case 'REPROVADO':
        return (
          <Tag
            style={{
              backgroundColor: '#FBE9E7',
              color: '#A83A28',
              borderColor: '#FFCCBC',
              fontSize: 13,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 4,
            }}
            icon={<CloseCircleOutlined />}
          >
            CADASTRO INDEFERIDO
          </Tag>
        );
    }
  };

  const meusProtocolos = protocolos.filter((p) => p.alunoId === alunoAtual.id);

  // Define cor de filete semântico do card
  const accentCardClass = isAprovado
    ? 'semec-card semec-card-accent-green'
    : isPendente
    ? 'semec-card semec-card-accent-terracotta'
    : 'semec-card semec-card-accent-gold';

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 60px' }}>
      {/* SIMULADOR DE ALUNO DEMO */}
      <Card
        size="small"
        className="semec-card"
        style={{
          marginBottom: 20,
          background: '#FFFFFF',
          borderColor: '#E6E0D4',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Text strong style={{ color: '#1F2421', fontSize: 13 }}>
            👤 Simulando Estudante Requerente:
          </Text>
          <Select
            value={alunoAtual.id}
            onChange={(val) => setAlunoAtualId(val)}
            style={{ width: 380, maxWidth: '100%' }}
            size="middle"
          >
            {todosAlunos.map((a) => (
              <Option key={a.id} value={a.id}>
                {a.nome} ({a.status} — {a.faixaReembolso})
              </Option>
            ))}
          </Select>
        </div>
      </Card>

      {/* CABEÇALHO DO ESTUDANTE COM STATUS ATUAL */}
      <Card
        className={accentCardClass}
        style={{
          marginBottom: 24,
          padding: '6px 4px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
              <Title level={3} style={{ margin: 0 }}>
                {alunoAtual.nome}
              </Title>
              {statusBadge()}
            </div>
            <Text type="secondary" style={{ fontSize: 13 }}>
              CPF: {alunoAtual.cpf} • {alunoAtual.instituicao} ({alunoAtual.curso})
            </Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              Conta PIX para Reembolso:
            </Text>
            <div style={{ fontWeight: 600, color: '#1B5E3A', fontFamily: 'monospace', fontSize: 13 }}>
              {alunoAtual.chavePix} ({alunoAtual.tipoChavePix})
            </div>
          </div>
        </div>

        {/* ALERTA DE PENDÊNCIA */}
        {isPendente && (
          <Alert
            type="error"
            showIcon
            message="Pendência indicada pela Secretaria de Educação"
            description={
              <div>
                <Paragraph style={{ margin: '4px 0 8px', fontWeight: 500, color: '#A83A28' }}>
                  {alunoAtual.motivoPendencia || 'Favor revisar os documentos e dados bancários anexados.'}
                </Paragraph>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Acesse a aba "Recadastro & Enquadramento" abaixo, retifique as informações e submeta para reavaliação.
                </Text>
              </div>
            }
            style={{ marginTop: 18, border: '1px solid #FFCCBC', background: '#FBE9E7' }}
          />
        )}

        {isEmAnalise && (
          <Alert
            type="warning"
            showIcon
            message="Recadastro em Avaliação Técnica"
            description="Seus documentos estão sob auditoria da equipe da SEMEC. O parecer conclusivo será publicado nesta mesma tela."
            style={{ marginTop: 18, border: '1px solid #FFE082', background: '#FFF8E1' }}
          />
        )}
      </Card>

      {/* ABAS PRINCIPAIS */}
      <Tabs
        defaultActiveKey={isAprovado ? 'prestacao' : 'recadastro'}
        size="large"
        items={[
          {
            key: 'recadastro',
            label: (
              <span style={{ fontWeight: 600 }}>
                <IdcardOutlined /> Fase 1: Recadastro (Anexo 1)
              </span>
            ),
            children: <RecadastroFase1 />,
          },
          {
            key: 'prestacao',
            label: (
              <span style={{ fontWeight: 600 }}>
                <DollarCircleOutlined /> Fase 2: Prestação de Contas Mensal{' '}
                {!isAprovado && <LockOutlined style={{ color: '#A83A28', marginLeft: 4 }} />}
              </span>
            ),
            children: !isAprovado ? (
              <Card
                className="semec-card"
                style={{
                  textAlign: 'center',
                  padding: '48px 24px',
                }}
              >
                <div style={{ maxWidth: 520, margin: '0 auto' }}>
                  <LockOutlined style={{ fontSize: 44, color: '#C99B53', marginBottom: 16 }} />
                  <Title level={4}>Prestação de Contas Indisponível</Title>
                  <Paragraph type="secondary" style={{ lineHeight: 1.6 }}>
                    Nos termos da legislação municipal de transporte universitário, o envio de comprovantes de despesa (notas fiscais ou cupons) exige prévia homologação do recadastro semestral.
                  </Paragraph>
                  <Alert
                    type="info"
                    message={
                      <span>
                        Situação atual do estudante: <strong>{alunoAtual.status}</strong>.
                      </span>
                    }
                    description="Após a homologação pela SEMEC (ou alternando no seletor para um estudante já homologado), este módulo será liberado."
                    style={{ marginTop: 16, border: '1px solid #E6E0D4', background: '#F9F7F2' }}
                  />
                </div>
              </Card>
            ) : (
              <div>
                {/* SELETOR DE MÊS E MODALIDADE */}
                <Card
                  className="semec-card"
                  size="small"
                  style={{
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, padding: '4px 0' }}>
                    <Space wrap size="middle">
                      <Text strong style={{ color: '#1F2421' }}>Mês de Referência:</Text>
                      <Select
                        value={mesReferencia}
                        onChange={setMesReferencia}
                        style={{ width: 190 }}
                        size="middle"
                      >
                        <Option value="2026-11">Novembro / 2026</Option>
                        <Option value="2026-10">Outubro / 2026</Option>
                        <Option value="2026-09">Setembro / 2026</Option>
                      </Select>
                    </Space>

                    <Space wrap size="middle">
                      <Text strong style={{ color: '#1F2421' }}>Modalidade:</Text>
                      <Radio.Group
                        value={tipoTransporte}
                        onChange={(e) => setTipoTransporte(e.target.value)}
                        buttonStyle="solid"
                      >
                        <Radio.Button value="FRETADO">
                          <CarOutlined /> Transporte Fretado (NF)
                        </Radio.Button>
                        <Radio.Button value="LINHA_CIRCULAR">
                          Linha Regular (Cupons Fiscais)
                        </Radio.Button>
                      </Radio.Group>
                    </Space>
                  </div>
                </Card>

                {/* FORMULÁRIO ESPECÍFICO */}
                {tipoTransporte === 'FRETADO' ? (
                  <PrestacaoFretado mesReferencia={mesReferencia} />
                ) : (
                  <PrestacaoLinhaCircular mesReferencia={mesReferencia} />
                )}

                {/* HISTÓRICO DE PROTOCOLOS RECENTES */}
                {meusProtocolos.length > 0 && (() => {
                  const protocolosDoMesAtual = meusProtocolos.filter((p) => p.mesReferencia === mesReferencia);
                  const somaTotalMes = protocolosDoMesAtual.reduce((acc, p) => acc + p.valorTotalComprovado, 0);
                  const somaReembolsoMes = protocolosDoMesAtual.reduce((acc, p) => acc + p.valorReembolsoEstimado, 0);

                  const handleGerarAnexoConsolidado = () => {
                    if (protocolosDoMesAtual.length === 0) return;
                    const base = protocolosDoMesAtual[0];
                    const consolidado = {
                      ...base,
                      nfNumero:
                        protocolosDoMesAtual.length > 1
                          ? `Lote Consolidado (${protocolosDoMesAtual.length} docs)`
                          : base.nfNumero,
                      valorTotalComprovado: somaTotalMes,
                      valorIndividualNf: somaTotalMes,
                      valorReembolsoEstimado: somaReembolsoMes,
                    };
                    gerarPdfAnexoIV(consolidado, alunoAtual)
                      .then(() => message.success('Anexo IV consolidado do mês gerado com sucesso!'))
                      .catch(() => message.error('Erro ao gerar o PDF do Anexo IV.'));
                  };

                  return (
                    <Card
                      title={
                        <span style={{ fontFamily: "'Merriweather', serif", fontWeight: 700, fontSize: 15 }}>
                          Protocolos Submetidos pelo Estudante
                        </span>
                      }
                      className="semec-card"
                      size="small"
                      style={{ marginTop: 24 }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {meusProtocolos.map((p) => (
                          <div
                            key={p.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              padding: '12px 16px',
                              background: '#F9F7F2',
                              borderRadius: 6,
                              border: '1px solid #E6E0D4',
                            }}
                          >
                            <div>
                              <Text strong style={{ color: '#1B5E3A', fontFamily: 'monospace' }}>
                                {p.codigoHash}
                              </Text>{' '}
                              <Tag style={{ background: '#FFFFFF', borderColor: '#E6E0D4' }}>{p.mesReferencia}</Tag>
                              <Tag style={{ background: '#E8F5E9', color: '#1B5E3A', borderColor: '#C8E6C9' }}>
                                {p.tipoTransporte === 'FRETADO' ? 'Fretado' : 'Circular'}
                              </Tag>
                              <div style={{ fontSize: 12, color: '#59615C', marginTop: 4 }}>
                                Comprovado: R$ {p.valorTotalComprovado.toFixed(2)} • Reembolso Estimado: R${' '}
                                {p.valorReembolsoEstimado.toFixed(2)}
                              </div>
                            </div>
                            <Space>
                              {p.status === 'APROVADO_PAGAMENTO' && (
                                <Tag color="success">Autorizado para Pagamento</Tag>
                              )}
                              {p.status === 'PENDENTE_ANALISE' && (
                                <Tag style={{ backgroundColor: '#FFF8E1', color: '#C99B53', borderColor: '#FFE082' }}>
                                  Em Auditoria
                                </Tag>
                              )}
                              {p.status === 'PENDENTE_CORRECAO' && (
                                <Tooltip title={p.motivoPendencia}>
                                  <Tag color="error">Pendência Registrada</Tag>
                                </Tooltip>
                              )}
                              {p.status === 'REPROVADO' && <Tag color="error">Indeferido</Tag>}
                            </Space>
                          </div>
                        ))}
                      </div>

                      {protocolosDoMesAtual.length > 0 && (
                        <>
                          <Divider style={{ margin: '16px 0 12px' }} />
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 12,
                              background: '#FFFFFF',
                              padding: '12px 14px',
                              borderRadius: 6,
                              border: '1px solid #E6E0D4',
                            }}
                          >
                            <div style={{ fontSize: 13 }}>
                              <Text strong style={{ color: '#1F2421' }}>
                                Fechamento do mês {mesReferencia}:
                              </Text>{' '}
                              <Text type="secondary">
                                {protocolosDoMesAtual.length} protocolo(s) • Total:{' '}
                                <strong style={{ color: '#1B5E3A' }}>R$ {somaTotalMes.toFixed(2)}</strong>
                              </Text>
                            </div>

                            <Space wrap>
                              {!isMesAtualFechado ? (
                                <Button
                                  type="primary"
                                  icon={<CalculatorOutlined />}
                                  style={{ background: '#1B5E3A', borderColor: '#1B5E3A', fontWeight: 600 }}
                                  onClick={() =>
                                    confirmarFechamentoMesConsolidado(
                                      protocolosDoMesAtual,
                                      somaTotalMes,
                                      somaReembolsoMes
                                    )
                                  }
                                >
                                  Fechar Mês e Gerar Cálculo ({mesReferencia})
                                </Button>
                              ) : (
                                <>
                                  <Tag color="success" icon={<LockOutlined />} style={{ margin: 0, padding: '4px 10px' }}>
                                    Mês {mesReferencia} Fechado
                                  </Tag>
                                  <Button
                                    type="primary"
                                    icon={<FilePdfOutlined />}
                                    style={{ background: '#1B5E3A', borderColor: '#1B5E3A', fontWeight: 600 }}
                                    onClick={handleGerarAnexoConsolidado}
                                  >
                                    Gerar Anexo IV Consolidado (PDF)
                                  </Button>
                                </>
                              )}
                            </Space>
                          </div>
                        </>
                      )}
                    </Card>
                  );
                })()}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};
