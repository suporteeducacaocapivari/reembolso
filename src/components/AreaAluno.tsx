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
} from '@ant-design/icons';
import { Button, message } from 'antd';
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
                {meusProtocolos.length > 0 && (
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
                            <Button
                              size="small"
                              icon={<FilePdfOutlined />}
                              style={{ borderColor: '#1B5E3A', color: '#1B5E3A' }}
                              onClick={() =>
                                gerarPdfAnexoIV(p, alunoAtual)
                                  .then(() => message.success('Anexo IV gerado com sucesso!'))
                                  .catch(() => message.error('Erro ao gerar PDF.'))
                              }
                            >
                              Anexo IV (PDF)
                            </Button>
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
                  </Card>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};
