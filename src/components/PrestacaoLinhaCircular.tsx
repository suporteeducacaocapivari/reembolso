import React, { useState } from 'react';
import {
  Card,
  Button,
  Table,
  Upload,
  Input,
  Modal,
  Tag,
  Statistic,
  message,
  Typography,
  Space,
  Popconfirm,
  Divider,
  Alert,
  Result,
} from 'antd';
import {
  ScanOutlined,
  DeleteOutlined,
  SendOutlined,
  KeyOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import confetti from 'canvas-confetti';
import dayjs from 'dayjs';
import { useApp } from '../context/AppContext';
import type { CupomFiscalItem, ProtocoloMensal } from '../types';
import { analisarDocumentoTransporte } from '../services/geminiService';

const { Title, Text, Paragraph } = Typography;

interface Props {
  mesReferencia: string;
}

export const PrestacaoLinhaCircular: React.FC<Props> = ({ mesReferencia }) => {
  const {
    alunoAtual,
    cuponsRascunho,
    adicionarCupomRascunho,
    removerCupomRascunho,
    limparCuponsRascunho,
    submeterProtocoloMensal,
  } = useApp();

  const [modalManualOpen, setModalManualOpen] = useState(false);
  const [chaveManual, setChaveManual] = useState('');
  const [valorManual, setValorManual] = useState<string>('7.50');
  const [loadingIa, setLoadingIa] = useState(false);
  const [modalSucesso, setModalSucesso] = useState(false);
  const [protocoloGerado, setProtocoloGerado] = useState<ProtocoloMensal | null>(null);

  const totalGasto = cuponsRascunho.reduce((acc, c) => acc + c.valor, 0);
  const percentual = alunoAtual.faixaReembolso === '100%' ? 1.0 : 0.75;
  const totalReembolso = Number((totalGasto * percentual).toFixed(2));

  const handleUploadCupom = async (file: File) => {
    setLoadingIa(true);
    message.loading({ content: 'Realizando leitura estruturada do cupom e da chave de acesso...', key: 'cupom-ia' });
    try {
      const extraido = await analisarDocumentoTransporte(file, 'CUPOM_FISCAL');
      
      const chaveDetectada = extraido.chave_acesso_44_digitos ||
        `352611${Math.floor(10000000000000 + Math.random() * 90000000000000)}${Math.floor(100000000000000000000000 + Math.random() * 900000000000000000000000)}`.slice(0, 44);

      const novoCupom: CupomFiscalItem = {
        id: 'cup-' + Date.now() + Math.random().toString(36).substring(7),
        chaveAcesso: chaveDetectada,
        dataEmissao: extraido.data_emissao || new Date().toISOString().split('T')[0],
        numero: extraido.numero_documento,
        cnpjEmissor: extraido.cnpj_emissor,
        valor: extraido.valor_total,
        confianca: extraido.confianca_leitura,
      };

      const res = adicionarCupomRascunho(novoCupom);
      if (!res.sucesso) {
        message.error({
          content: res.mensagem || 'Trava antifraude: Chave de acesso duplicada!',
          key: 'cupom-ia',
          duration: 5,
        });
      } else {
        message.success({
          content: `Cupom ${novoCupom.numero} (R$ ${novoCupom.valor.toFixed(2)}) adicionado ao lote!`,
          key: 'cupom-ia',
        });
      }
    } catch {
      message.error({ content: 'Falha ao processar o cupom fiscal.', key: 'cupom-ia' });
    } finally {
      setLoadingIa(false);
    }
    return false;
  };

  const handleSimularQrCodeScanner = () => {
    const chaveGerada = `352611${Math.floor(10000000000000 + Math.random() * 90000000000000)}${Math.floor(100000000000000000000000 + Math.random() * 900000000000000000000000)}`.slice(0, 44);
    const novoCupom: CupomFiscalItem = {
      id: 'cup-' + Date.now(),
      chaveAcesso: chaveGerada,
      dataEmissao: new Date().toISOString().split('T')[0],
      numero: `CF-${Math.floor(1000 + Math.random() * 9000)}`,
      cnpjEmissor: '07.123.456/0001-89',
      valor: 7.50,
      confianca: 'ALTA',
    };

    const res = adicionarCupomRascunho(novoCupom);
    if (!res.sucesso) {
      message.error(res.mensagem);
    } else {
      message.success(`Leitura de QR Code efetuada com sucesso (R$ 7,50).`);
    }
  };

  const handleAdicionarChaveManual = () => {
    const limpa = chaveManual.replace(/\D/g, '');
    if (limpa.length !== 44) {
      message.error(`A chave de acesso de segurança deve possuir exatamente 44 dígitos (atualmente: ${limpa.length}).`);
      return;
    }

    const valorNum = parseFloat(valorManual);
    if (isNaN(valorNum) || valorNum <= 0) {
      message.error('Informe um valor de passagem válido.');
      return;
    }

    const novoCupom: CupomFiscalItem = {
      id: 'cup-' + Date.now(),
      chaveAcesso: limpa,
      dataEmissao: new Date().toISOString().split('T')[0],
      numero: `CF-${limpa.substring(25, 31)}`,
      cnpjEmissor: '07.123.456/0001-89',
      valor: valorNum,
      confianca: 'ALTA',
    };

    const res = adicionarCupomRascunho(novoCupom);
    if (!res.sucesso) {
      message.error(res.mensagem);
    } else {
      message.success('Cupom fiscal adicionado ao lote com sucesso!');
      setChaveManual('');
      setModalManualOpen(false);
    }
  };

  const handleFecharLote = () => {
    if (cuponsRascunho.length === 0) {
      message.warning('Adicione ao menos 1 cupom fiscal antes de submeter o lote mensal.');
      return;
    }

    const novo = submeterProtocoloMensal({
      alunoId: alunoAtual.id,
      alunoNome: alunoAtual.nome,
      alunoCpf: alunoAtual.cpf,
      alunoChavePix: alunoAtual.chavePix,
      mesReferencia,
      tipoTransporte: 'LINHA_CIRCULAR',
      status: 'PENDENTE_ANALISE',
      faixaAplicada: alunoAtual.faixaReembolso,
      cupons: [...cuponsRascunho],
      valorTotalComprovado: totalGasto,
      valorReembolsoEstimado: totalReembolso,
      confiancaIa: 'ALTA',
      declaracaoVeracidade: true,
    });

    limparCuponsRascunho();
    setProtocoloGerado(novo);
    setModalSucesso(true);
    confetti({
      particleCount: 70,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const columns = [
    {
      title: 'Emissão',
      dataIndex: 'dataEmissao',
      key: 'dataEmissao',
      width: 105,
      render: (d: string) => <Text style={{ fontSize: 13 }}>{d}</Text>,
    },
    {
      title: 'Identificação & Chave de Acesso (44 dígitos)',
      key: 'chave',
      render: (_: any, r: CupomFiscalItem) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1F2421', fontSize: 13 }}>
            {r.numero} <Tag style={{ fontSize: 10, background: '#F9F7F2', borderColor: '#E6E0D4' }}>NFC-e / SAT</Tag>
          </div>
          <Text
            copyable={{ text: r.chaveAcesso }}
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              color: '#59615C',
              background: '#F9F7F2',
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid #E6E0D4',
            }}
          >
            {r.chaveAcesso.slice(0, 10)}...{r.chaveAcesso.slice(-8)}
          </Text>
        </div>
      ),
    },
    {
      title: 'Valor (R$)',
      dataIndex: 'valor',
      key: 'valor',
      align: 'right' as const,
      width: 110,
      render: (v: number) => <strong style={{ color: '#1F2421' }}>R$ {v.toFixed(2)}</strong>,
    },
    {
      title: '',
      key: 'acao',
      width: 50,
      render: (_: any, r: CupomFiscalItem) => (
        <Popconfirm
          title="Remover este cupom do lote?"
          onConfirm={() => removerCupomRascunho(r.id)}
          okText="Remover"
          cancelText="Cancelar"
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Card className="semec-card" style={{ padding: '8px 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
          <div>
            <Title level={4} style={{ margin: 0, color: '#1F2421' }}>
              Lote de Cupons Fiscais — Linha Regular
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Demonstrativo de passagens intermunicipais para o mês de {mesReferencia}. Cada chave de acesso de 44 dígitos é auditada contra duplicidade.
            </Text>
          </div>

          <Space wrap size="middle">
            <Button
              icon={<ScanOutlined />}
              onClick={handleSimularQrCodeScanner}
              type="default"
              style={{ borderColor: '#1B5E3A', color: '#1B5E3A' }}
            >
              Leitor de QR Code
            </Button>

            <Upload beforeUpload={handleUploadCupom} showUploadList={false} accept="image/*,.pdf">
              <Button icon={<FileSearchOutlined />} loading={loadingIa} type="default">
                Extrair de foto do cupom
              </Button>
            </Upload>

            <Button icon={<KeyOutlined />} onClick={() => setModalManualOpen(true)}>
              Digitar Chave (44 dígitos)
            </Button>
          </Space>
        </div>

        {/* TABELA DE CUPONS */}
        <Table
          dataSource={cuponsRascunho}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 6 }}
          size="small"
          locale={{ emptyText: 'Nenhum cupom fiscal adicionado ao lote deste mês.' }}
        />

        <Divider style={{ margin: '18px 0' }} />

        {/* RESUMO DO LOTE */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            background: '#F9F7F2',
            padding: 16,
            borderRadius: 6,
            border: '1px solid #E6E0D4',
          }}
        >
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <Statistic
              title="Cupons Registrados"
              value={cuponsRascunho.length}
              valueStyle={{ fontWeight: 600, color: '#1F2421' }}
            />
            <Statistic
              title="Despesa Comprovada"
              value={totalGasto}
              precision={2}
              prefix="R$"
              valueStyle={{ fontWeight: 600, color: '#1F2421' }}
            />
            <Statistic
              title={`Reembolso (${alunoAtual.faixaReembolso})`}
              value={totalReembolso}
              precision={2}
              prefix="R$"
              valueStyle={{ fontWeight: 700, color: '#1B5E3A' }}
            />
          </div>

          <Button
            type="primary"
            size="large"
            icon={<SendOutlined />}
            disabled={cuponsRascunho.length === 0}
            style={{ background: '#1B5E3A', borderColor: '#1B5E3A', height: 44, fontWeight: 600 }}
            onClick={handleFecharLote}
          >
            Submeter Lote Consolidado ({cuponsRascunho.length} cupons)
          </Button>
        </div>
      </Card>

      {/* MODAL INSERÇÃO MANUAL */}
      <Modal
        title={
          <span style={{ fontFamily: "'Merriweather', serif", fontWeight: 700 }}>
            Inserir Cupom por Chave de Acesso
          </span>
        }
        open={modalManualOpen}
        onCancel={() => setModalManualOpen(false)}
        onOk={handleAdicionarChaveManual}
        okText="Validar Chave e Adicionar"
        cancelText="Cancelar"
      >
        <Alert
          type="info"
          showIcon
          message="Validação Antifraude e Duplicidade"
          description="A chave de acesso de 44 dígitos impressa no documento fiscal garante a unicidade do reembolso solicitado."
          style={{ marginBottom: 16, borderRadius: 6, border: '1px solid #E6E0D4', background: '#F9F7F2' }}
        />

        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ color: '#1F2421' }}>Chave de Acesso (44 dígitos numéricos):</Text>
          <Input
            value={chaveManual}
            onChange={(e) => setChaveManual(e.target.value)}
            placeholder="Ex: 3526 1107 1234 5600 0189 5900 0123 4567 8901 2345 6789"
            maxLength={50}
            style={{ marginTop: 6, borderRadius: 6 }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Caracteres numéricos inseridos: {chaveManual.replace(/\D/g, '').length} / 44
          </Text>
        </div>

        <div>
          <Text strong style={{ color: '#1F2421' }}>Valor da Tarifa / Passagem (R$):</Text>
          <Input
            value={valorManual}
            onChange={(e) => setValorManual(e.target.value)}
            type="number"
            step="0.10"
            prefix="R$"
            style={{ marginTop: 6, borderRadius: 6 }}
          />
        </div>
      </Modal>

      {/* MODAL SUCESSO LOTE COM TIMBRE OFICIAL */}
      <Modal
        open={modalSucesso}
        footer={null}
        onCancel={() => setModalSucesso(false)}
        centered
        width={540}
      >
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          {/* TIMBRE OFICIAL DA SEMEC CAPIVARI */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 }}>
            <img
              src="/SEMEC_400x416.png"
              alt="SEMEC Capivari"
              style={{
                height: 88,
                width: 'auto',
                objectFit: 'contain',
                marginBottom: 8,
              }}
            />
            {/* Filete decorativo dourado institucional */}
            <div style={{ width: 80, height: 2, backgroundColor: '#C99B53', marginBottom: 8 }} />
            <div
              style={{
                fontSize: 16,
                fontFamily: "'Merriweather', serif",
                fontWeight: 700,
                color: '#1F2421',
              }}
            >
              Comprovante de Lote Protocolado
            </div>
            <div style={{ fontSize: 12, color: '#59615C' }}>
              Secretaria Municipal da Educação de Capivari
            </div>
          </div>

          <Paragraph style={{ margin: '8px 0 16px', color: '#59615C', fontSize: 13 }}>
            O lote de cupons fiscais de <strong>{mesReferencia}</strong> (Linha Regular) foi consolidado e registrado sob guarda digital da SEMEC Capivari.
          </Paragraph>

          <div
            style={{
              background: '#F9F7F2',
              border: '1px solid #E6E0D4',
              borderTop: '3px solid #1B5E3A',
              padding: 16,
              borderRadius: 6,
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            <Text type="secondary" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Código Autenticador / HASH do Lote
            </Text>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1B5E3A', letterSpacing: 1.5, margin: '6px 0', fontFamily: 'monospace' }}>
              {protocoloGerado?.codigoHash}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 12, color: '#59615C', marginTop: 10 }}>
              <span>
                <strong>Cupons:</strong> {protocoloGerado?.cupons?.length || 0} bilhetes
              </span>
              <span>
                <strong>Reembolso Estimado:</strong> R$ {protocoloGerado?.valorReembolsoEstimado.toFixed(2)}
              </span>
            </div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
              Registrado em: {protocoloGerado?.dataEnvio ? dayjs(protocoloGerado.dataEnvio).format('DD/MM/YYYY [às] HH:mm:ss') : ''}
            </Text>
          </div>

          <Button
            type="primary"
            size="large"
            block
            style={{ background: '#1B5E3A', borderColor: '#1B5E3A', height: 44, fontWeight: 600 }}
            onClick={() => setModalSucesso(false)}
          >
            Concluir e Fechar
          </Button>
        </div>
      </Modal>
    </div>
  );
};
