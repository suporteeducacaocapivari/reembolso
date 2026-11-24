import React, { useState } from 'react';
import {
  Card,
  Upload,
  Button,
  Form,
  Input,
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
} from '@ant-design/icons';
import confetti from 'canvas-confetti';
import dayjs from 'dayjs';
import { useApp } from '../context/AppContext';
import { analisarDocumentoTransporte } from '../services/geminiService';
import { gerarPdfAnexoIV } from '../services/pdfService';
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

  const percentualFaixa = alunoAtual.faixaReembolso === '100%' ? 1.0 : 0.75;
  const valorEstimadoReembolso = Number((valorTotal * percentualFaixa).toFixed(2));

  const handleProcessarDocumento = async (file: File) => {
    setLoadingIa(true);
    message.loading({ content: 'Realizando leitura estruturada do documento fiscal...', key: 'doc-msg' });
    try {
      const extraido = await analisarDocumentoTransporte(file, 'NF');
      setDadosIa(extraido);
      setValorTotal(extraido.valor_total);

      form.setFieldsValue({
        empresaTransporte: extraido.empresa_emissora || '',
        numero: extraido.numero_documento,
        cnpj: extraido.cnpj_emissor,
        dataEmissao: extraido.data_emissao ? dayjs(extraido.data_emissao) : dayjs(),
        valorTotal: extraido.valor_total,
      });

      if (extraido.origem_leitura === 'SIMULADO_SEM_CHAVE') {
        message.warning({
          content: 'Modo Simulado: configure sua GEMINI_API_KEY no topo da tela para ler os dados reais da imagem.',
          key: 'doc-msg',
          duration: 5,
        });
      } else {
        message.success({
          content: `Dados reais extraídos pelo Gemini (${extraido.confianca_leitura} confiabilidade). Confira os campos.`,
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
        nfDataEmissao: values.dataEmissao.format('YYYY-MM-DD'),
        nfArquivoNome: arquivoFile?.name || 'Nota_Fiscal.pdf',
        nfArquivoUrl: arquivoPreviewUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=900&q=80',
        valorTotalComprovado: values.valorTotal,
        valorIndividualNf: values.valorIndividual || values.valorTotal,
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

            {arquivoFile && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
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
              </div>
            )}

            {dadosIa && (
              <Alert
                type={dadosIa.origem_leitura === 'SIMULADO_SEM_CHAVE' ? 'warning' : 'info'}
                showIcon
                message={
                  <Space>
                    <span>
                      {dadosIa.origem_leitura === 'SIMULADO_SEM_CHAVE'
                        ? 'Modo Simulado (Sem API Key)'
                        : 'Dados reais extraídos pelo Gemini'}
                    </span>
                    <Tag
                      style={{
                        background: dadosIa.origem_leitura === 'SIMULADO_SEM_CHAVE' ? '#FFF8E1' : '#E8F5E9',
                        color: dadosIa.origem_leitura === 'SIMULADO_SEM_CHAVE' ? '#C99B53' : '#1B5E3A',
                        borderColor: dadosIa.origem_leitura === 'SIMULADO_SEM_CHAVE' ? '#FFE082' : '#C8E6C9',
                      }}
                    >
                      {dadosIa.origem_leitura === 'SIMULADO_SEM_CHAVE'
                        ? 'Fictício'
                        : `Confiabilidade ${dadosIa.confianca_leitura}`}
                    </Tag>
                  </Space>
                }
                description={
                  dadosIa.origem_leitura === 'SIMULADO_SEM_CHAVE'
                    ? 'Os dados ao lado são fictícios porque nenhuma GEMINI_API_KEY foi configurada. Clique em "Configurar OCR/Gemini" no topo da tela para ativar a leitura real da imagem.'
                    : 'Os campos ao lado foram extraídos diretamente do documento enviado. Confira os valores antes de assinar digitalmente.'
                }
                style={{
                  borderRadius: 6,
                  border:
                    dadosIa.origem_leitura === 'SIMULADO_SEM_CHAVE'
                      ? '1px solid #FFE082'
                      : '1px solid #E6E0D4',
                  background:
                    dadosIa.origem_leitura === 'SIMULADO_SEM_CHAVE' ? '#FFF8E1' : '#F9F7F2',
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
                  <Input
                    type="number"
                    step="0.01"
                    prefix="R$"
                    placeholder="0.00"
                    style={{ borderRadius: 6 }}
                    onChange={(e) => setValorTotal(parseFloat(e.target.value) || 0)}
                  />
                </Form.Item>

                <Form.Item
                  name="valorIndividual"
                  label="Valor INDIVIDUAL (R$)"
                >
                  <Input
                    type="number"
                    step="0.01"
                    prefix="R$"
                    placeholder="Igual ao total"
                    style={{ borderRadius: 6 }}
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

          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Button
              type="primary"
              size="large"
              block
              icon={<FilePdfOutlined />}
              style={{ background: '#1B5E3A', borderColor: '#1B5E3A', height: 44, fontWeight: 600 }}
              onClick={() => {
                if (protocoloGerado) {
                  gerarPdfAnexoIV(protocoloGerado, alunoAtual)
                    .then(() => message.success('Anexo IV (Protocolo + Recibo) baixado em PDF!'))
                    .catch(() => message.error('Erro ao gerar o PDF do Anexo IV.'));
                }
              }}
            >
              Baixar Anexo IV Oficial Preenchido (PDF)
            </Button>

            <Button
              size="large"
              block
              onClick={() => {
                setModalSucesso(false);
                form.resetFields();
                setArquivoFile(null);
                setValorTotal(0);
                setDeclarou(false);
              }}
            >
              Concluir e Retornar ao Painel
            </Button>
          </Space>
        </div>
      </Modal>
    </div>
  );
};
