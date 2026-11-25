import React, { useState } from 'react';
import {
  Card,
  Upload,
  Button,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Statistic,
  Checkbox,
  message,
  Typography,
  Divider,
  Tag,
  Alert,
  Modal,
  Result,
  Space,
  Spin,
} from 'antd';
import {
  FilePdfOutlined,
  ScanOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
  FileSearchOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import confetti from 'canvas-confetti';
import dayjs from 'dayjs';
import { useApp } from '../context/AppContext';
import { analisarDocumentoTransporte } from '../services/geminiService';
import { gerarPdfAnexoIV } from '../services/pdfService';
import { QrCodeScannerModal } from './QrCodeScannerModal';
import { consultarRazaoSocialPorCnpj } from '../services/localOcrService';
import { gerarUrlConsultaSefaz, type DadosQrCodeFiscal } from '../services/qrFiscalParser';
import type { DocumentoExtraidoGemini, ProtocoloMensal } from '../types';

const { Title, Text, Paragraph } = Typography;

interface Props {
  mesReferencia: string;
}

export const PrestacaoFretado: React.FC<Props> = ({ mesReferencia }) => {
  const { alunoAtual, submeterProtocoloMensal } = useApp();
  const [form] = Form.useForm();
  const [loadingIa, setLoadingIa] = useState(false);
  const [dadosIa, setDadosIa] = useState<DocumentoExtraidoGemini | null>(null);
  const [arquivoFile, setArquivoFile] = useState<File | null>(null);
  const [arquivoPreviewUrl, setArquivoPreviewUrl] = useState<string>('');
  const [valorTotal, setValorTotal] = useState<number>(0);
  const [declarou, setDeclarou] = useState(false);
  const [protocoloGerado, setProtocoloGerado] = useState<ProtocoloMensal | null>(null);
  const [modalSucesso, setModalSucesso] = useState(false);
  const [modalQrOpen, setModalQrOpen] = useState(false);
  const [chaveOuQrAtual, setChaveOuQrAtual] = useState<string>('');
  const [urlVerificacaoAtual, setUrlVerificacaoAtual] = useState<string>('');

  const handleQrDecodedFretado = async (dados: DadosQrCodeFiscal) => {
    const razao = dados.cnpjEmissor ? await consultarRazaoSocialPorCnpj(dados.cnpjEmissor) : '';
    setChaveOuQrAtual(dados.chaveAcesso);
    setUrlVerificacaoAtual(dados.urlVerificacao);
    form.setFieldsValue({
      ...(razao ? { empresaTransporte: razao } : {}),
      numero: dados.numeroDocumento,
      cnpj: dados.cnpjEmissor,
      chaveQrCode: dados.chaveAcesso,
      ...(dados.dataEmissao ? { dataEmissao: dayjs(dados.dataEmissao) } : {}),
      ...(dados.valorTotal ? { valorTotal: dados.valorTotal } : {}),
    });
    if (dados.valorTotal) {
      setValorTotal(dados.valorTotal);
    }
    setDadosIa({
      tipo_documento: dados.modelo === 'BP-e' ? 'BPE' : 'NF',
      empresa_emissora: razao,
      cnpj_emissor: dados.cnpjEmissor,
      numero_documento: dados.numeroDocumento,
      chave_acesso_44_digitos: dados.chaveAcesso,
      qr_code_url: dados.urlVerificacao,
      data_emissao: dados.dataEmissao || `${dados.anoMes}-01`,
      valor_total: dados.valorTotal || valorTotal,
      confianca_leitura: 'ALTA',
      origem_leitura: 'OCR_LOCAL_REAL',
    });
    message.success(`Dados do QR Code (${dados.numeroDocumento}) preenchidos automaticamente!`);
  };

  const percentualFaixa = alunoAtual.faixaReembolso === '100%' ? 1.0 : 0.75;
  const valorEstimadoReembolso = Number((valorTotal * percentualFaixa).toFixed(2));

  const handleProcessarDocumento = async (file: File) => {
    setLoadingIa(true);
    message.loading({ content: 'Realizando leitura estruturada do documento fiscal...', key: 'doc-msg' });
    try {
      const extraido = await analisarDocumentoTransporte(file, 'NF');
      setDadosIa(extraido);
      setValorTotal(extraido.valor_total);
      const chExtraida = extraido.chave_acesso_44_digitos || '';
      const urlExtraida = extraido.qr_code_url || (chExtraida ? gerarUrlConsultaSefaz(chExtraida) : '');
      setChaveOuQrAtual(chExtraida);
      setUrlVerificacaoAtual(urlExtraida);

      form.setFieldsValue({
        ...(extraido.empresa_emissora ? { empresaTransporte: extraido.empresa_emissora } : {}),
        numero: extraido.numero_documento || '',
        cnpj: extraido.cnpj_emissor || '',
        chaveQrCode: chExtraida,
        dataEmissao: extraido.data_emissao ? dayjs(extraido.data_emissao) : undefined,
        valorTotal: extraido.valor_total || undefined,
      });

      if (extraido.origem_leitura === 'OCR_LOCAL_REAL') {
        message.success({
          content: `Leitura real concluída (QR Code + OCR Local — confiança ${extraido.confianca_leitura}). Confira os campos preenchidos.`,
          key: 'doc-msg',
        });
      } else {
        message.success({
          content: `Dados reais extraídos pelo Gemini (confiança ${extraido.confianca_leitura}). Confira os campos.`,
          key: 'doc-msg',
        });
      }
    } catch {
      message.error({ content: 'Falha na leitura automática. Favor preencher os campos manualmente.', key: 'doc-msg' });
    } finally {
      setLoadingIa(false);
    }
  };

  const handleCustomUpload = (file: File) => {
    setArquivoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setArquivoPreviewUrl(objectUrl);
    handleProcessarDocumento(file);
    return false;
  };

  const handleSubmit = async () => {
    if (!arquivoFile && !dadosIa) {
      message.warning('Por favor, anexe a Nota Fiscal do serviço de transporte.');
      return;
    }
    if (!declarou) {
      message.error('É obrigatório assinalar o termo de veracidade e responsabilidade.');
      return;
    }

    try {
      const values = await form.validateFields();
      const novoProtocolo = submeterProtocoloMensal({
        alunoId: alunoAtual.id,
        alunoNome: alunoAtual.nome,
        alunoRg: alunoAtual.rg,
        alunoCpf: alunoAtual.cpf,
        alunoCurso: alunoAtual.curso,
        alunoInstituicao: alunoAtual.instituicao,
        alunoCidadeInstituicao: alunoAtual.cidadeInstituicao,
        alunoChavePix: alunoAtual.chavePix,
        mesReferencia,
        tipoTransporte: 'FRETADO',
        status: 'PENDENTE_ANALISE',
        faixaAplicada: alunoAtual.faixaReembolso,
        empresaTransporte: values.empresaTransporte || 'Empresa de Transporte Escolar',
        nfNumero: values.numero,
        nfCnpj: values.cnpj,
        nfChaveAcesso: values.chaveQrCode || chaveOuQrAtual || undefined,
        nfQrCodeUrl:
          urlVerificacaoAtual ||
          (values.chaveQrCode ? gerarUrlConsultaSefaz(values.chaveQrCode) : undefined),
        nfDataEmissao: values.dataEmissao.format('YYYY-MM-DD'),
        nfArquivoNome: arquivoFile?.name || 'Nota_Fiscal.pdf',
        nfArquivoUrl: arquivoPreviewUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=900&q=80',
        valorTotalComprovado: Number(values.valorTotal),
        valorIndividualNf: Number(values.valorIndividual || values.valorTotal),
        valorReembolsoEstimado: valorEstimadoReembolso,
        confiancaIa: dadosIa?.confianca_leitura || 'ALTA',
        declaracaoVeracidade: true,
      });

      setProtocoloGerado(novoProtocolo);
      setModalSucesso(true);
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {
      message.error('Preencha os campos obrigatórios da nota fiscal antes de enviar.');
    }
  };

  return (
    <div>
      <Card className="semec-card" style={{ padding: '8px 4px' }}>
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ margin: 0, color: '#1F2421' }}>
            Prestação de Contas — Transporte Fretado
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Envie a Nota Fiscal de serviço de van, micro-ônibus ou ônibus referente a {mesReferencia}.
          </Text>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 28 }}>
          {/* COLUNA ESQUERDA: DOCUMENTO & EXTRAÇÃO */}
          <div>
            <Text strong style={{ color: '#1F2421' }}>1. Documento Fiscal (PDF ou Imagem)</Text>
            <div style={{ marginTop: 8, marginBottom: 16 }}>
              <Upload.Dragger
                beforeUpload={handleCustomUpload}
                showUploadList={false}
                accept="image/*,.pdf"
                style={{ padding: 24, background: '#F9F7F2', borderColor: '#E6E0D4', borderRadius: 6 }}
              >
                {loadingIa ? (
                  <Spin tip="Realizando leitura estruturada do documento fiscal..." />
                ) : (
                  <>
                    <p className="ant-upload-drag-icon">
                      <FilePdfOutlined style={{ color: '#1B5E3A', fontSize: 38 }} />
                    </p>
                    <p className="ant-upload-text" style={{ fontWeight: 600, fontSize: 14 }}>
                      {arquivoFile ? arquivoFile.name : 'Clique ou arraste a Nota Fiscal aqui'}
                    </p>
                    <p className="ant-upload-hint" style={{ fontSize: 12 }}>
                      Formatos aceitos: PDF, PNG ou JPG (até 15MB)
                    </p>
                  </>
                )}
              </Upload.Dragger>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <Button
                icon={<ScanOutlined />}
                type="primary"
                style={{ background: '#1B5E3A', borderColor: '#1B5E3A' }}
                onClick={() => setModalQrOpen(true)}
              >
                Ler QR Code (Câmera / Foto)
              </Button>

              {arquivoFile && (
                <>
                  <Button
                    icon={<FileSearchOutlined />}
                    type="default"
                    loading={loadingIa}
                    style={{ borderColor: '#1B5E3A', color: '#1B5E3A' }}
                    onClick={() => handleProcessarDocumento(arquivoFile)}
                  >
                    Extrair dados novamente
                  </Button>
                  {arquivoPreviewUrl && (
                    <Button
                      icon={<EyeOutlined />}
                      onClick={() => window.open(arquivoPreviewUrl, '_blank')}
                    >
                      Visualizar Anexo
                    </Button>
                  )}
                </>
              )}
            </div>

            {dadosIa && (
              <Alert
                type="info"
                showIcon
                message={
                  <Space>
                    <span>
                      {dadosIa.origem_leitura === 'OCR_LOCAL_REAL'
                        ? 'Leitura real via QR Code + OCR Local (Gratuito)'
                        : 'Dados reais extraídos pelo Gemini'}
                    </span>
                    <Tag
                      style={{
                        background: '#E8F5E9',
                        color: '#1B5E3A',
                        borderColor: '#C8E6C9',
                      }}
                    >
                      Confiabilidade {dadosIa.confianca_leitura}
                    </Tag>
                  </Space>
                }
                description="Os campos ao lado foram lidos diretamente da imagem enviada (sem dados fictícios). Confira os valores antes de assinar digitalmente."
                style={{
                  borderRadius: 6,
                  border: '1px solid #E6E0D4',
                  background: '#F9F7F2',
                }}
              />
            )}
          </div>

          {/* COLUNA DIREITA: CONFERÊNCIA DOS DADOS & VALOR */}
          <div>
            <Text strong style={{ color: '#1F2421' }}>2. Conferência dos Dados Fiscais</Text>
            <Form
              form={form}
              layout="vertical"
              style={{ marginTop: 12 }}
              onValuesChange={(_, all) => {
                if (all.valorTotal) setValorTotal(Number(all.valorTotal));
              }}
            >
              <Form.Item
                name="empresaTransporte"
                label="Empresa de Transporte"
                rules={[{ required: true, message: 'Informe a empresa de transporte' }]}
              >
                <Input placeholder="Ex: TransCapivari Fretamento Ltda" style={{ borderRadius: 6 }} />
              </Form.Item>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Form.Item
                  name="numero"
                  label="Número do Documento (NF)"
                  rules={[{ required: true, message: 'Informe o número da NF' }]}
                >
                  <Input placeholder="Ex: NF-e 004812" style={{ borderRadius: 6 }} />
                </Form.Item>

                <Form.Item
                  name="cnpj"
                  label="CNPJ do Prestador"
                  rules={[{ required: true, message: 'Informe o CNPJ' }]}
                >
                  <Input placeholder="00.000.000/0000-00" style={{ borderRadius: 6 }} />
                </Form.Item>
              </div>

              <Form.Item
                name="chaveQrCode"
                label="Código do QR Code / Chave de Acesso (44 dígitos p/ Verificação)"
              >
                <Input
                  placeholder="44 dígitos ou link do QR Code (preenchido automaticamente na leitura)"
                  style={{ borderRadius: 6, fontFamily: 'monospace', fontSize: 12 }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setChaveOuQrAtual(val);
                    setUrlVerificacaoAtual(val.trim() ? gerarUrlConsultaSefaz(val) : '');
                  }}
                  suffix={
                    (urlVerificacaoAtual || chaveOuQrAtual.trim()) ? (
                      <a
                        href={urlVerificacaoAtual || gerarUrlConsultaSefaz(chaveOuQrAtual)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#1B5E3A',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        Confirmar na SEFAZ <ExportOutlined />
                      </a>
                    ) : null
                  }
                />
              </Form.Item>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Form.Item
                  name="dataEmissao"
                  label="Data de Emissão"
                  rules={[{ required: true, message: 'Informe a data' }]}
                >
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 6 }} />
                </Form.Item>

                <Form.Item
                  name="valorTotal"
                  label="Valor TOTAL NF (R$)"
                  rules={[{ required: true, message: 'Informe o valor total' }]}
                >
                  <InputNumber
                    precision={2}
                    decimalSeparator=","
                    step={0.1}
                    min={0}
                    prefix="R$"
                    placeholder="0,00"
                    style={{ width: '100%', borderRadius: 6 }}
                    onChange={(val) => setValorTotal(Number(val) || 0)}
                  />
                </Form.Item>

                <Form.Item
                  name="valorIndividual"
                  label="Valor INDIVIDUAL (R$)"
                >
                  <InputNumber
                    precision={2}
                    decimalSeparator=","
                    step={0.1}
                    min={0}
                    prefix="R$"
                    placeholder="Igual ao total"
                    style={{ width: '100%', borderRadius: 6 }}
                  />
                </Form.Item>
              </div>
            </Form>

            {/* ESTIMATIVA INSTITUCIONAL */}
            <Card
              size="small"
              className="semec-card semec-card-accent-green"
              style={{
                borderRadius: 6,
                marginBottom: 20,
                background: '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                    Faixa de Enquadramento:
                  </Text>
                  <div style={{ fontWeight: 600, color: '#1F2421', fontSize: 13 }}>
                    Faixa {alunoAtual.faixaReembolso} do Custo Total
                  </div>
                </div>
                <Statistic
                  title={<span style={{ fontSize: 12, color: '#59615C' }}>Valor Estimado de Reembolso</span>}
                  value={valorEstimadoReembolso}
                  precision={2}
                  prefix="R$"
                  valueStyle={{ color: '#1B5E3A', fontWeight: 700, fontSize: 22 }}
                />
              </div>
            </Card>

            {/* TERMO DE VERACIDADE */}
            <div
              style={{
                background: '#F9F7F2',
                padding: 14,
                borderRadius: 6,
                border: '1px solid #E6E0D4',
                marginBottom: 20,
              }}
            >
              <Checkbox checked={declarou} onChange={(e) => setDeclarou(e.target.checked)}>
                <span style={{ fontSize: 12, color: '#1F2421', lineHeight: 1.5 }}>
                  <strong>Declaro sob as penas da lei</strong> a veracidade e autenticidade dos dados fiscais
                  prestados para fins de reembolso público junto à Secretaria Municipal da Educação de Capivari.
                </span>
              </Checkbox>
            </div>

            <Button
              type="primary"
              size="large"
              block
              icon={<SafetyCertificateOutlined />}
              style={{ background: '#1B5E3A', borderColor: '#1B5E3A', height: 46, fontWeight: 600 }}
              onClick={handleSubmit}
            >
              Gerar Protocolo Digital e Submeter
            </Button>
          </div>
        </div>
      </Card>

      {/* MODAL LEITOR REAL DE QR CODE (CÂMERA / FOTO) */}
      <QrCodeScannerModal
        open={modalQrOpen}
        onClose={() => setModalQrOpen(false)}
        onDecoded={handleQrDecodedFretado}
        exigirValor={false}
      />

      {/* MODAL SUCESSO PROTOCOLO TIMBRADO SEMEC */}
      <Modal
        open={modalSucesso}
        footer={null}
        onCancel={() => {
          setModalSucesso(false);
          form.resetFields();
          setArquivoFile(null);
          setValorTotal(0);
          setDeclarou(false);
        }}
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
              Comprovante de Protocolo Digital
            </div>
            <div style={{ fontSize: 12, color: '#59615C' }}>
              Secretaria Municipal da Educação de Capivari
            </div>
          </div>

          <Paragraph style={{ margin: '8px 0 16px', color: '#59615C', fontSize: 13 }}>
            A prestação de contas de <strong>{mesReferencia}</strong> (Transporte Fretado) foi protocolada e registrada sob guarda digital da SEMEC Capivari.
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
              Código Autenticador / HASH do Protocolo
            </Text>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1B5E3A', letterSpacing: 1.5, margin: '6px 0', fontFamily: 'monospace' }}>
              {protocoloGerado?.codigoHash}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 12, color: '#59615C', marginTop: 10 }}>
              <span>
                <strong>Estudante:</strong> {protocoloGerado?.alunoNome}
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
            onClick={() => {
              setModalSucesso(false);
              form.resetFields();
              setArquivoFile(null);
              setValorTotal(0);
              setDeclarou(false);
              setChaveOuQrAtual('');
              setUrlVerificacaoAtual('');
            }}
          >
            Concluir
          </Button>
        </div>
      </Modal>
    </div>
  );
};
