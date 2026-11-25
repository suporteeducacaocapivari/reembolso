import React, { useState } from 'react';
import {
  Card,
  Button,
  Upload,
  Input,
  InputNumber,
  DatePicker,
  Modal,
  Tag,
  Statistic,
  message,
  Typography,
  Space,
  Popconfirm,
  Divider,
  Alert,
  Collapse,
  Empty,
} from 'antd';
import {
  ScanOutlined,
  DeleteOutlined,
  SendOutlined,
  KeyOutlined,
  FileSearchOutlined,
  SafetyCertificateOutlined,
  ExportOutlined,
  EyeOutlined,
  CalendarOutlined,
  PlusOutlined,
  CalculatorOutlined,
  LockOutlined,
  FilePdfOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import confetti from 'canvas-confetti';
import dayjs from 'dayjs';
import { useApp } from '../context/AppContext';
import type { CupomFiscalItem, ProtocoloMensal } from '../types';
import { analisarDocumentoTransporte } from '../services/geminiService';
import { gerarPdfAnexoIV } from '../services/pdfService';
import { QrCodeScannerModal } from './QrCodeScannerModal';
import {
  decodificarQrCodeFiscal,
  gerarUrlConsultaSefaz,
  type DadosQrCodeFiscal,
} from '../services/qrFiscalParser';
import { consultarRazaoSocialPorCnpj } from '../services/localOcrService';

const { Title, Text, Paragraph } = Typography;

interface Props {
  mesReferencia: string;
}

export const PrestacaoLinhaCircular: React.FC<Props> = ({ mesReferencia }) => {
  const {
    alunoAtual,
    protocolos,
    cuponsRascunho,
    adicionarCupomRascunho,
    removerCupomRascunho,
    limparCuponsRascunho,
    submeterProtocoloMensal,
  } = useApp();

  const [modalManualOpen, setModalManualOpen] = useState(false);
  const [modalQrOpen, setModalQrOpen] = useState(false);
  const [chaveManual, setChaveManual] = useState('');
  const [urlQrManual, setUrlQrManual] = useState('');
  const [dataManual, setDataManual] = useState<dayjs.Dayjs>(dayjs());
  const [valorManual, setValorManual] = useState<number | null>(7.5);
  const [loadingIa, setLoadingIa] = useState(false);
  const [modalSucesso, setModalSucesso] = useState(false);
  const [protocoloGerado, setProtocoloGerado] = useState<ProtocoloMensal | null>(null);
  const [paineisAbertos, setPaineisAbertos] = useState<string[]>([]);

  // 1. Verifica se o mês já foi fechado (protocolado) pelo aluno
  const protocoloJaFechadoNoMes = protocolos.find(
    (p) =>
      p.alunoId === alunoAtual.id &&
      p.mesReferencia === mesReferencia &&
      p.tipoTransporte === 'LINHA_CIRCULAR'
  );

  // 2. Verifica se o mês de referência já virou (é anterior ao mês atual do calendário)
  const mesAtualCalendario = dayjs().format('YYYY-MM'); // ex: '2026-11'
  const mesJaVirou = mesReferencia < mesAtualCalendario;
  const mesBloqueado = Boolean(protocoloJaFechadoNoMes) || mesJaVirou;

  // Fechamento automático quando o mês vira e ainda existem cupons em rascunho acumulados
  React.useEffect(() => {
    if (mesJaVirou && !protocoloJaFechadoNoMes && cuponsRascunho.length > 0) {
      const soma = cuponsRascunho.reduce((acc, c) => acc + c.valor, 0);
      const perc = alunoAtual.faixaReembolso === '100%' ? 1.0 : 0.75;
      const reemb = Number((soma * perc).toFixed(2));

      submeterProtocoloMensal({
        alunoId: alunoAtual.id,
        alunoNome: alunoAtual.nome,
        alunoRg: alunoAtual.rg,
        alunoCpf: alunoAtual.cpf,
        alunoCurso: alunoAtual.curso,
        alunoInstituicao: alunoAtual.instituicao,
        alunoCidadeInstituicao: alunoAtual.cidadeInstituicao,
        alunoChavePix: alunoAtual.chavePix,
        mesReferencia,
        tipoTransporte: 'LINHA_CIRCULAR',
        status: 'PENDENTE_ANALISE',
        faixaAplicada: alunoAtual.faixaReembolso,
        empresaTransporte: cuponsRascunho[0]?.empresaEmissora || 'Linha Circular / Intermunicipal',
        cupons: [...cuponsRascunho],
        valorTotalComprovado: soma,
        valorIndividualNf: soma,
        valorReembolsoEstimado: reemb,
        confiancaIa: 'ALTA',
        declaracaoVeracidade: true,
      });
      limparCuponsRascunho();
      message.info(`O mês ${mesReferencia} foi encerrado automaticamente na virada do mês e seu lote foi protocolado!`);
    }
  }, [mesJaVirou, protocoloJaFechadoNoMes, cuponsRascunho.length, mesReferencia]);

  const totalGasto = cuponsRascunho.reduce((acc, c) => acc + c.valor, 0);
  const percentual = alunoAtual.faixaReembolso === '100%' ? 1.0 : 0.75;
  const totalReembolso = Number((totalGasto * percentual).toFixed(2));

  // Upload de foto de 1 ou vários cupons diários (permite envio múltiplo!)
  const handleUploadCupom = async (file: File) => {
    setLoadingIa(true);
    const msgKey = 'cupom-ia-' + file.name;
    message.loading({
      content: `Lendo cupom "${file.name}" (QR Code + OCR)...`,
      key: msgKey,
    });

    try {
      const previewUrl = URL.createObjectURL(file);
      const extraido = await analisarDocumentoTransporte(file, 'CUPOM_FISCAL');

      if (!extraido.chave_acesso_44_digitos) {
        message.warning({
          content: `Não foi possível ler os 44 dígitos do QR Code em "${file.name}". Use "Adicionar Manualmente" para completar a chave.`,
          key: msgKey,
          duration: 5,
        });
        setDataManual(extraido.data_emissao ? dayjs(extraido.data_emissao) : dayjs());
        if (extraido.valor_total > 0) setValorManual(extraido.valor_total);
        setModalManualOpen(true);
        return false;
      }

      const idNovo = 'cup-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      const chave = extraido.chave_acesso_44_digitos;
      const urlVerificacao = extraido.qr_code_url || gerarUrlConsultaSefaz(chave);

      const novoCupom: CupomFiscalItem = {
        id: idNovo,
        chaveAcesso: chave,
        qrCodeUrl: urlVerificacao,
        empresaEmissora: extraido.empresa_emissora || '',
        dataEmissao: extraido.data_emissao || `${mesReferencia}-01`,
        numero: extraido.numero_documento || `Doc ${chave.slice(25, 34)}`,
        cnpjEmissor: extraido.cnpj_emissor,
        valor: extraido.valor_total,
        comprovanteFotoUrl: previewUrl,
        comprovanteNome: file.name,
        confianca: extraido.confianca_leitura,
      };

      const res = adicionarCupomRascunho(novoCupom);
      if (!res.sucesso) {
        message.error({
          content: res.mensagem || 'Trava antifraude: Chave de acesso duplicada!',
          key: msgKey,
          duration: 5,
        });
      } else {
        setPaineisAbertos((prev) => [idNovo, ...prev]);
        message.success({
          content: `Cupom diário ${novoCupom.numero} (R$ ${novoCupom.valor.toFixed(2)}) adicionado ao mês!`,
          key: msgKey,
        });
      }
    } catch {
      message.error({ content: `Falha ao processar "${file.name}".`, key: msgKey });
    } finally {
      setLoadingIa(false);
    }
    return false;
  };

  const handleQrDecoded = async (dados: DadosQrCodeFiscal) => {
    const idNovo = 'cup-' + Date.now();
    const razao = dados.cnpjEmissor ? await consultarRazaoSocialPorCnpj(dados.cnpjEmissor) : '';

    const novoCupom: CupomFiscalItem = {
      id: idNovo,
      chaveAcesso: dados.chaveAcesso,
      qrCodeUrl: dados.urlVerificacao,
      empresaEmissora: razao,
      dataEmissao: dados.dataEmissao || `${dados.anoMes}-01`,
      numero: dados.numeroDocumento,
      cnpjEmissor: dados.cnpjEmissor,
      valor: dados.valorTotal || 0,
      confianca: 'ALTA',
    };

    const res = adicionarCupomRascunho(novoCupom);
    if (!res.sucesso) {
      message.error(res.mensagem);
    } else {
      setPaineisAbertos([idNovo]);
      message.success(`${dados.numeroDocumento} (R$ ${novoCupom.valor.toFixed(2)}) adicionado ao lote via QR Code!`);
    }
  };

  const handleAdicionarChaveManual = async () => {
    // Aceita colar tanto os 44 dígitos quanto o link inteiro do QR Code!
    const decodificado = decodificarQrCodeFiscal(urlQrManual || chaveManual);
    const limpa = decodificado?.chaveAcesso || chaveManual.replace(/\D/g, '');

    if (limpa.length !== 44) {
      message.error(
        `Informe a Chave de Acesso de 44 dígitos ou cole o código/URL completo do QR Code (atualmente: ${limpa.length} dígitos).`
      );
      return;
    }

    if (!valorManual || valorManual <= 0) {
      message.error('Informe um valor de passagem válido.');
      return;
    }

    const parsedChave = decodificado || decodificarQrCodeFiscal(limpa);
    const cnpj = parsedChave?.cnpjEmissor || '00.000.000/0000-00';
    const razao = cnpj !== '00.000.000/0000-00' ? await consultarRazaoSocialPorCnpj(cnpj) : '';
    const idNovo = 'cup-' + Date.now();

    const novoCupom: CupomFiscalItem = {
      id: idNovo,
      chaveAcesso: limpa,
      qrCodeUrl: urlQrManual.trim() || parsedChave?.urlVerificacao || gerarUrlConsultaSefaz(limpa),
      empresaEmissora: razao,
      dataEmissao: dataManual ? dataManual.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
      numero: parsedChave?.numeroDocumento || `CF-${limpa.substring(25, 34)}`,
      cnpjEmissor: cnpj,
      valor: valorManual,
      confianca: 'ALTA',
    };

    const res = adicionarCupomRascunho(novoCupom);
    if (!res.sucesso) {
      message.error(res.mensagem);
    } else {
      setPaineisAbertos([idNovo]);
      message.success('Cupom diário adicionado ao lote do mês!');
      setChaveManual('');
      setUrlQrManual('');
      setModalManualOpen(false);
    }
  };

  const confirmarEGerarCalculo = () => {
    if (cuponsRascunho.length === 0) {
      message.warning('Adicione ao menos 1 cupom fiscal diário antes de gerar o cálculo mensal.');
      return;
    }

    Modal.confirm({
      title: 'Confirmar Fechamento do Mês e Gerar Cálculo?',
      icon: <ExclamationCircleOutlined style={{ color: '#A83A28' }} />,
      width: 500,
      okText: 'Sim, Fechar Mês e Gerar Anexo IV',
      okType: 'primary',
      okButtonProps: { style: { background: '#1B5E3A', borderColor: '#1B5E3A' } },
      cancelText: 'Cancelar e continuar adicionando',
      content: (
        <div style={{ marginTop: 8 }}>
          <Alert
            type="warning"
            showIcon
            message="Atenção: Esta ação não pode ser desfeita!"
            description={`Ao clicar em confirmar, o mês de referência ${mesReferencia} será fechado definitivamente e NÃO será possível reabri-lo para adicionar novos cupons diários.`}
            style={{ marginBottom: 14, borderRadius: 6 }}
          />
          <div
            style={{
              background: '#F9F7F2',
              border: '1px solid #E6E0D4',
              borderRadius: 6,
              padding: 12,
              fontSize: 13,
            }}
          >
            <div>
              <strong>Total de cupons somados:</strong> {cuponsRascunho.length} bilhete(s)
            </div>
            <div>
              <strong>Valor TOTAL consolidado (Anexo IV):</strong> R$ {totalGasto.toFixed(2)}
            </div>
            <div>
              <strong>Reembolso estimado ({alunoAtual.faixaReembolso}):</strong>{' '}
              <strong style={{ color: '#1B5E3A' }}>R$ {totalReembolso.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      ),
      onOk: () => {
        handleFecharLote();
      },
    });
  };

  const handleFecharLote = () => {
    if (cuponsRascunho.length === 0) {
      message.warning('Adicione ao menos 1 cupom fiscal diário antes de submeter o lote mensal.');
      return;
    }

    const novo = submeterProtocoloMensal({
      alunoId: alunoAtual.id,
      alunoNome: alunoAtual.nome,
      alunoRg: alunoAtual.rg,
      alunoCpf: alunoAtual.cpf,
      alunoCurso: alunoAtual.curso,
      alunoInstituicao: alunoAtual.instituicao,
      alunoCidadeInstituicao: alunoAtual.cidadeInstituicao,
      alunoChavePix: alunoAtual.chavePix,
      mesReferencia,
      tipoTransporte: 'LINHA_CIRCULAR',
      status: 'PENDENTE_ANALISE',
      faixaAplicada: alunoAtual.faixaReembolso,
      empresaTransporte: cuponsRascunho[0]?.empresaEmissora || 'Linha Circular / Intermunicipal',
      cupons: [...cuponsRascunho],
      valorTotalComprovado: totalGasto,
      valorIndividualNf: totalGasto,
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

  // Ordena cupons por data de emissão (cronológico diário do mês)
  const cuponsOrdenados = [...cuponsRascunho].sort((a, b) => a.dataEmissao.localeCompare(b.dataEmissao));

  const accordionItems = cuponsOrdenados.map((cupom, index) => {
    const linkSefaz = cupom.qrCodeUrl || gerarUrlConsultaSefaz(cupom.chaveAcesso);
    const dataFormatada = cupom.dataEmissao
      ? dayjs(cupom.dataEmissao).format('DD/MM/YYYY')
      : cupom.dataEmissao;

    return {
      key: cupom.id,
      label: (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            flexWrap: 'wrap',
            gap: 8,
            paddingRight: 8,
          }}
        >
          <Space size="middle" wrap>
            <Tag
              style={{
                background: '#E8F5E9',
                color: '#1B5E3A',
                borderColor: '#C8E6C9',
                fontWeight: 700,
                margin: 0,
              }}
            >
              #{index + 1} • <CalendarOutlined /> {dataFormatada}
            </Tag>
            <Text strong style={{ color: '#1F2421', fontSize: 13 }}>
              {cupom.numero}
            </Text>
            {cupom.empresaEmissora && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                — {cupom.empresaEmissora}
              </Text>
            )}
          </Space>

          <Space size="middle">
            <strong style={{ color: '#1B5E3A', fontSize: 14 }} className="tabular-nums">
              R$ {cupom.valor.toFixed(2)}
            </strong>
            <Popconfirm
              title="Remover este cupom diário do lote?"
              onConfirm={(e) => {
                e?.stopPropagation();
                removerCupomRascunho(cupom.id);
              }}
              onCancel={(e) => e?.stopPropagation()}
              okText="Remover"
              cancelText="Cancelar"
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          </Space>
        </div>
      ),
      children: (
        <div
          style={{
            background: '#FFFFFF',
            padding: '12px 14px',
            borderRadius: 6,
            border: '1px solid #E6E0D4',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
          }}
        >
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              EMPRESA / CNPJ EMISSOR
            </Text>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#1F2421' }}>
              {cupom.empresaEmissora || 'Transporte Regular / Intermunicipal'}
            </div>
            <div style={{ fontSize: 12, color: '#59615C' }}>CNPJ: {cupom.cnpjEmissor}</div>
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              CÓDIGO DO QR CODE / CHAVE DE ACESSO (44 DÍGITOS)
            </Text>
            <Text
              copyable={{ text: cupom.chaveAcesso, tooltips: ['Copiar 44 dígitos', 'Copiado!'] }}
              style={{
                fontSize: 12,
                fontFamily: 'monospace',
                color: '#1F2421',
                background: '#F9F7F2',
                padding: '4px 8px',
                borderRadius: 4,
                border: '1px solid #E6E0D4',
                display: 'inline-block',
                marginTop: 4,
                wordBreak: 'break-all',
              }}
            >
              {cupom.chaveAcesso}
            </Text>

            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button
                type="primary"
                size="small"
                icon={<SafetyCertificateOutlined />}
                href={linkSefaz}
                target="_blank"
                rel="noopener noreferrer"
                style={{ background: '#1B5E3A', borderColor: '#1B5E3A' }}
              >
                Verificar Autenticidade na SEFAZ <ExportOutlined />
              </Button>

              {cupom.comprovanteFotoUrl && (
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => window.open(cupom.comprovanteFotoUrl, '_blank')}
                >
                  Ver Foto do Bilhete ({cupom.comprovanteNome || 'Anexo'})
                </Button>
              )}
            </div>
          </div>
        </div>
      ),
    };
  });

  return (
    <div>
      <Card className="semec-card" style={{ padding: '8px 4px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 14,
            marginBottom: 20,
          }}
        >
          <div>
            <Title level={4} style={{ margin: 0, color: '#1F2421' }}>
              Cupons Fiscais Diários do Mês ({mesReferencia})
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Adicione todos os bilhetes/cupons diários utilizados no mês. Clique em cada item abaixo (Accordion) para conferir o código do QR Code e validar a veracidade na SEFAZ.
            </Text>
          </div>

          <Space wrap size="small">
            <Button
              icon={<ScanOutlined />}
              onClick={() => setModalQrOpen(true)}
              type="primary"
              disabled={mesBloqueado}
              style={{ background: '#1B5E3A', borderColor: '#1B5E3A' }}
            >
              Ler QR Code (Câmera / Foto)
            </Button>

            <Upload
              beforeUpload={handleUploadCupom}
              showUploadList={false}
              accept="image/*"
              multiple
              disabled={mesBloqueado}
            >
              <Button
                icon={<FileSearchOutlined />}
                loading={loadingIa}
                disabled={mesBloqueado}
                style={{ borderColor: '#1B5E3A', color: '#1B5E3A', fontWeight: 600 }}
              >
                Enviar Fotos dos Cupons (Vários)
              </Button>
            </Upload>

            <Button icon={<PlusOutlined />} disabled={mesBloqueado} onClick={() => setModalManualOpen(true)}>
              Adicionar Manualmente
            </Button>
          </Space>
        </div>

        {/* AVISO DE MÊS FECHADO (MANUALMENTE OU POR VIRADA DE MÊS) */}
        {mesBloqueado && (
          <Alert
            type={protocoloJaFechadoNoMes ? 'success' : 'warning'}
            showIcon
            icon={<LockOutlined />}
            message={
              protocoloJaFechadoNoMes
                ? `Mês ${mesReferencia} fechado e protocolado (${protocoloJaFechadoNoMes.codigoHash})`
                : `Mês ${mesReferencia} encerrado automaticamente pela virada do mês`
            }
            description={
              protocoloJaFechadoNoMes
                ? `O cálculo consolidado deste mês já foi fechado (${protocoloJaFechadoNoMes.cupons?.length || 0} cupons somando R$ ${protocoloJaFechadoNoMes.valorTotalComprovado.toFixed(2)}) e não pode mais ser reaberto. Você pode baixar o Anexo IV consolidado abaixo.`
                : `O período de envio para ${mesReferencia} encerrou automaticamente com a virada do calendário (${mesAtualCalendario}). Não é possível adicionar novos cupons em meses encerrados.`
            }
            action={
              protocoloJaFechadoNoMes ? (
                <Button
                  type="primary"
                  icon={<FilePdfOutlined />}
                  style={{ background: '#1B5E3A', borderColor: '#1B5E3A' }}
                  onClick={() =>
                    gerarPdfAnexoIV(protocoloJaFechadoNoMes, alunoAtual)
                      .then(() => message.success('Anexo IV consolidado baixado em PDF!'))
                      .catch(() => message.error('Erro ao gerar o PDF do Anexo IV.'))
                  }
                >
                  Baixar Anexo IV (PDF)
                </Button>
              ) : undefined
            }
            style={{ marginBottom: 18, borderRadius: 6 }}
          />
        )}

        {/* ACCORDION (COLLAPSE) DOS CUPONS DIÁRIOS DO MÊS */}
        {cuponsOrdenados.length === 0 ? (
          <div
            style={{
              background: '#F9F7F2',
              border: '1px dashed #E6E0D4',
              borderRadius: 6,
              padding: '32px 16px',
              textAlign: 'center',
            }}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span style={{ color: '#59615C' }}>
                  Nenhum cupom diário adicionado neste mês ainda. Use <strong>Ler QR Code</strong> ou{' '}
                  <strong>Enviar Fotos dos Cupons</strong> para montar seu lote mensal!
                </span>
              }
            />
          </div>
        ) : (
          <Collapse
            activeKey={paineisAbertos}
            onChange={(keys) => setPaineisAbertos(Array.isArray(keys) ? keys : [keys])}
            items={accordionItems}
            style={{ background: '#F9F7F2', borderColor: '#E6E0D4', borderRadius: 6 }}
          />
        )}

        <Divider style={{ margin: '20px 0' }} />

        {/* RESUMO CONSOLIDADO DO LOTE MENSAL */}
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
          <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
            <Statistic
              title="Cupons Diários no Mês"
              value={cuponsRascunho.length}
              valueStyle={{ fontWeight: 600, color: '#1F2421' }}
            />
            <Statistic
              title="Soma Total Comprovada"
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
            icon={<CalculatorOutlined />}
            disabled={cuponsRascunho.length === 0 || mesBloqueado}
            style={{ background: '#1B5E3A', borderColor: '#1B5E3A', height: 44, fontWeight: 600 }}
            onClick={confirmarEGerarCalculo}
          >
            Gerar Cálculo e Fechar Mês ({cuponsRascunho.length} cupons)
          </Button>
        </div>
      </Card>

      {/* MODAL LEITOR REAL DE QR CODE (CÂMERA / FOTO) */}
      <QrCodeScannerModal
        open={modalQrOpen}
        onClose={() => setModalQrOpen(false)}
        onDecoded={handleQrDecoded}
        exigirValor={true}
      />

      {/* MODAL INSERÇÃO MANUAL COM CÓDIGO QR CODE + CHAVE */}
      <Modal
        title={
          <span style={{ fontFamily: "'Merriweather', serif", fontWeight: 700 }}>
            Adicionar Cupom Diário Manualmente
          </span>
        }
        open={modalManualOpen}
        onCancel={() => setModalManualOpen(false)}
        onOk={handleAdicionarChaveManual}
        okText="Validar e Adicionar ao Mês"
        cancelText="Cancelar"
      >
        <Alert
          type="info"
          showIcon
          message="Verificação Oficial na SEFAZ & Antifraude"
          description="Você pode digitar os 44 dígitos da Chave de Acesso ou colar o link completo do QR Code. O sistema gera automaticamente o link clicável de confirmação na SEFAZ."
          style={{ marginBottom: 16, borderRadius: 6, border: '1px solid #E6E0D4', background: '#F9F7F2' }}
        />

        <div style={{ marginBottom: 14 }}>
          <Text strong style={{ color: '#1F2421' }}>
            Chave de Acesso (44 dígitos) ou Código/Link do QR Code:
          </Text>
          <Input
            prefix={<KeyOutlined style={{ color: '#59615C' }} />}
            value={chaveManual}
            onChange={(e) => {
              const v = e.target.value;
              setChaveManual(v);
              if (/^https?:\/\//i.test(v.trim())) {
                setUrlQrManual(v.trim());
              }
            }}
            placeholder="Cole os 44 dígitos ou a URL completa do QR Code..."
            style={{ marginTop: 6, borderRadius: 6 }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Dígitos identificados: {(decodificarQrCodeFiscal(chaveManual)?.chaveAcesso || chaveManual.replace(/\D/g, '')).length} / 44
          </Text>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Text strong style={{ color: '#1F2421' }}>Data da Viagem:</Text>
            <DatePicker
              value={dataManual}
              onChange={(d) => d && setDataManual(d)}
              format="DD/MM/YYYY"
              style={{ width: '100%', marginTop: 6, borderRadius: 6 }}
            />
          </div>

          <div>
            <Text strong style={{ color: '#1F2421' }}>Valor Pago (R$):</Text>
            <InputNumber
              value={valorManual}
              onChange={(v) => setValorManual(v)}
              precision={2}
              decimalSeparator=","
              step={0.1}
              min={0.01}
              prefix="R$"
              style={{ width: '100%', marginTop: 6, borderRadius: 6 }}
            />
          </div>
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
            <div style={{ width: 80, height: 2, backgroundColor: '#C99B53', marginBottom: 8 }} />
            <div
              style={{
                fontSize: 16,
                fontFamily: "'Merriweather', serif",
                fontWeight: 700,
                color: '#1F2421',
              }}
            >
              Comprovante de Lote Mensal Protocolado
            </div>
            <div style={{ fontSize: 12, color: '#59615C' }}>
              Secretaria Municipal da Educação de Capivari
            </div>
          </div>

          <Paragraph style={{ margin: '8px 0 16px', color: '#59615C', fontSize: 13 }}>
            O lote de cupons fiscais diários de <strong>{mesReferencia}</strong> foi consolidado e registrado sob guarda digital da SEMEC Capivari.
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
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#1B5E3A',
                letterSpacing: 1.5,
                margin: '6px 0',
                fontFamily: 'monospace',
              }}
            >
              {protocoloGerado?.codigoHash}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 12, color: '#59615C', marginTop: 10 }}>
              <span>
                <strong>Cupons Diários:</strong> {protocoloGerado?.cupons?.length || 0} bilhetes
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
            Concluir
          </Button>
        </div>
      </Modal>
    </div>
  );
};
