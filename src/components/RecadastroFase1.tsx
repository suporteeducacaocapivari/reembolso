import React, { useState } from 'react';
import {
  Card,
  Steps,
  Form,
  Input,
  Select,
  Button,
  Upload,
  Radio,
  message,
  Typography,
  Divider,
  Alert,
  Space,
  InputNumber,
} from 'antd';
import {
  UserOutlined,
  BankOutlined,
  FileDoneOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  FilePdfOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useApp } from '../context/AppContext';
import type { FaixaReembolso, AlunoCadastro } from '../types';
import { gerarPdfRequerimento } from '../services/pdfService';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export const RecadastroFase1: React.FC = () => {
  const { alunoAtual, atualizarCadastroAluno } = useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [faixaDesejada, setFaixaDesejada] = useState<FaixaReembolso>(alunoAtual.faixaReembolso || '75%');
  const [enviadoSucesso, setEnviadoSucesso] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  React.useEffect(() => {
    form.setFieldsValue({
      tipoSolicitacao: alunoAtual.tipoSolicitacao || 'RECADASTRO',
      nome: alunoAtual.nome,
      rg: alunoAtual.rg,
      cpf: alunoAtual.cpf,
      email: alunoAtual.email,
      telefone: alunoAtual.telefone,
      endereco: alunoAtual.endereco,
      numero: alunoAtual.numero,
      bairro: alunoAtual.bairro,
      instituicao: alunoAtual.instituicao,
      cidadeInstituicao: alunoAtual.cidadeInstituicao,
      curso: alunoAtual.curso,
      banco: alunoAtual.banco,
      agencia: alunoAtual.agencia,
      conta: alunoAtual.conta,
      chavePix: alunoAtual.chavePix,
      tipoChavePix: alunoAtual.tipoChavePix,
      faixaReembolso: alunoAtual.faixaReembolso,
      membrosFamilia: alunoAtual.membrosFamilia || [
        { nomeCompleto: alunoAtual.nome, dataNasc: '', parentesco: 'Requerente', profissao: 'Estudante', renda: 0 },
      ],
    });
    setFaixaDesejada(alunoAtual.faixaReembolso);
    setEnviadoSucesso(false);
  }, [alunoAtual, form]);

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields([
          'tipoSolicitacao',
          'nome',
          'rg',
          'cpf',
          'email',
          'telefone',
          'endereco',
          'numero',
          'bairro',
          'instituicao',
          'cidadeInstituicao',
          'curso',
        ]);
      } else if (currentStep === 1) {
        await form.validateFields(['banco', 'agencia', 'conta', 'tipoChavePix', 'chavePix']);
      }
      setCurrentStep((prev) => prev + 1);
    } catch {
      message.error('Por favor, preencha os campos obrigatórios corretamente.');
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleFinalizar = async () => {
    try {
      const values = await form.validateFields();
      atualizarCadastroAluno({
        ...values,
        faixaReembolso: faixaDesejada,
      });
      message.success('Requerimento submetido com sucesso à SEMEC Capivari!');
      setEnviadoSucesso(true);
    } catch {
      message.error('Verifique o preenchimento de todos os requisitos do formulário.');
    }
  };

  const handleBaixarPdfOficial = async () => {
    setGerandoPdf(true);
    try {
      const values = form.getFieldsValue(true);
      const dadosParaPdf: AlunoCadastro = {
        ...alunoAtual,
        ...values,
        faixaReembolso: faixaDesejada,
      };
      await gerarPdfRequerimento(dadosParaPdf);
      message.success(
        faixaDesejada === '100%'
          ? 'PDF oficial (Anexo II + Termo de Ciência + Anexo III) gerado com sucesso!'
          : 'PDF oficial (Anexo I + Termo de Ciência) gerado com sucesso!'
      );
    } catch (err) {
      console.error(err);
      message.error('Erro ao gerar o PDF oficial. Verifique os dados preenchidos.');
    } finally {
      setGerandoPdf(false);
    }
  };

  const dummyUploadProps = {
    beforeUpload: (file: File) => {
      message.success(`Documento "${file.name}" anexado.`);
      return false;
    },
    maxCount: 1,
  };

  return (
    <Card className="semec-card" style={{ padding: '8px 4px', marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#1F2421' }}>
            Requerimento de Ajuda de Custo (Anexo I / Anexo II e III)
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Lei Municipal nº 5.103/2017 e Decreto nº 6.892/2019 — Preenchimento oficial para geração do PDF timbrado
          </Text>
        </div>

        <Button
          icon={<FilePdfOutlined />}
          loading={gerandoPdf}
          onClick={handleBaixarPdfOficial}
          style={{ borderColor: '#1B5E3A', color: '#1B5E3A', fontWeight: 600 }}
        >
          Baixar PDF Oficial ({faixaDesejada === '100%' ? 'Anexo II + III' : 'Anexo I'})
        </Button>
      </div>

      <Steps
        current={currentStep}
        responsive
        size="small"
        style={{ marginBottom: 32 }}
        items={[
          { title: 'Dados Pessoais & Endereço', icon: <UserOutlined /> },
          { title: 'Dados Bancários & PIX', icon: <BankOutlined /> },
          { title: 'Faixa, Renda & Documentos', icon: <FileDoneOutlined /> },
        ]}
      />

      {enviadoSucesso ? (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined style={{ fontSize: 24, color: '#1B5E3A' }} />}
          message="Requerimento Encaminhado para Homologação"
          description="Seu requerimento foi protocolado e será auditado pela equipe técnica da Secretaria Municipal da Educação. Você já pode baixar o PDF oficial preenchido no modelo idêntico da Prefeitura."
          style={{ borderRadius: 6, padding: 20, border: '1px solid #C8E6C9', background: '#E8F5E9' }}
          action={
            <Space direction="vertical">
              <Button
                type="primary"
                icon={<FilePdfOutlined />}
                loading={gerandoPdf}
                style={{ background: '#1B5E3A', borderColor: '#1B5E3A' }}
                onClick={handleBaixarPdfOficial}
              >
                Baixar PDF Oficial Preenchido
              </Button>
              <Button size="small" onClick={() => setEnviadoSucesso(false)}>
                Revisar Requerimento
              </Button>
            </Space>
          }
        />
      ) : (
        <Form form={form} layout="vertical" initialValues={alunoAtual}>
          {/* ETAPA 1: DADOS PESSOAIS, ENDEREÇO E MATRÍCULA */}
          <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
            <Alert
              type="info"
              showIcon
              message="Etapa 1: Qualificação, Endereço em Capivari e Matrícula"
              description="Estes campos preenchem exatamente o cabeçalho do Anexo I (75%) ou Anexo II (100%)."
              style={{ marginBottom: 20, borderRadius: 6, border: '1px solid #E6E0D4', background: '#F9F7F2' }}
            />

            <Form.Item
              name="tipoSolicitacao"
              label="Tipo de Solicitação"
              rules={[{ required: true }]}
            >
              <Radio.Group buttonStyle="solid">
                <Radio.Button value="CADASTRO">Cadastro (1ª vez)</Radio.Button>
                <Radio.Button value="RECADASTRO">Recadastro Semestral</Radio.Button>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name="nome"
              label="Nome Completo do Estudante"
              rules={[{ required: true, message: 'Informe o nome completo' }]}
            >
              <Input size="large" placeholder="Ex: Maria Eduarda Silva" style={{ borderRadius: 6 }} />
            </Form.Item>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <Form.Item
                name="rg"
                label="RG nº"
                rules={[{ required: true, message: 'Informe o RG' }]}
              >
                <Input size="large" placeholder="00.000.000-0" style={{ borderRadius: 6 }} />
              </Form.Item>

              <Form.Item
                name="cpf"
                label="CPF nº"
                rules={[{ required: true, message: 'Informe o CPF' }]}
              >
                <Input size="large" placeholder="000.000.000-00" style={{ borderRadius: 6 }} />
              </Form.Item>

              <Form.Item
                name="telefone"
                label="Telefone / Celular"
                rules={[{ required: true, message: 'Informe o telefone' }]}
              >
                <Input size="large" placeholder="(19) 99999-9999" style={{ borderRadius: 6 }} />
              </Form.Item>
            </div>

            <Form.Item
              name="email"
              label="E-mail"
              rules={[{ required: true, message: 'Informe o e-mail' }]}
            >
              <Input size="large" placeholder="estudante@email.com" style={{ borderRadius: 6 }} />
            </Form.Item>

            <Divider plain>Endereço Residencial em Capivari/SP</Divider>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: 16 }}>
              <Form.Item
                name="endereco"
                label="Rua / Avenida"
                rules={[{ required: true, message: 'Informe a rua/avenida' }]}
              >
                <Input size="large" placeholder="Ex: Rua Barão do Rio Branco" style={{ borderRadius: 6 }} />
              </Form.Item>

              <Form.Item
                name="numero"
                label="Número"
                rules={[{ required: true, message: 'Informe o nº' }]}
              >
                <Input size="large" placeholder="Ex: 412" style={{ borderRadius: 6 }} />
              </Form.Item>

              <Form.Item
                name="bairro"
                label="Bairro"
                rules={[{ required: true, message: 'Informe o bairro' }]}
              >
                <Input size="large" placeholder="Ex: Centro" style={{ borderRadius: 6 }} />
              </Form.Item>
            </div>

            <Divider plain>Dados Acadêmicos</Divider>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <Form.Item
                name="curso"
                label="Curso"
                rules={[{ required: true, message: 'Informe o curso' }]}
              >
                <Input size="large" placeholder="Ex: Engenharia de Software" style={{ borderRadius: 6 }} />
              </Form.Item>

              <Form.Item
                name="instituicao"
                label="Instituição de Ensino"
                rules={[{ required: true, message: 'Informe a instituição' }]}
              >
                <Input size="large" placeholder="Ex: UNESP, UNICAMP, FATEC..." style={{ borderRadius: 6 }} />
              </Form.Item>

              <Form.Item
                name="cidadeInstituicao"
                label="Cidade da Instituição"
                rules={[{ required: true, message: 'Informe a cidade' }]}
              >
                <Input size="large" placeholder="Ex: Piracicaba, Campinas, Americana..." style={{ borderRadius: 6 }} />
              </Form.Item>
            </div>
          </div>

          {/* ETAPA 2: DADOS BANCÁRIOS / PIX */}
          <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
            <Alert
              type="info"
              showIcon
              message="Etapa 2: Conta Bancária Individual (Banco do Brasil)"
              description="Conforme o requerimento oficial, o crédito da ajuda de custo é efetuado em conta bancária individual no Banco do Brasil."
              style={{ marginBottom: 20, borderRadius: 6, border: '1px solid #E6E0D4', background: '#F9F7F2' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <Form.Item
                name="banco"
                label="Instituição Financeira"
                rules={[{ required: true, message: 'Informe o banco' }]}
              >
                <Input size="large" placeholder="001 - Banco do Brasil" style={{ borderRadius: 6 }} />
              </Form.Item>

              <Form.Item
                name="agencia"
                label="Agência (Ag)"
                rules={[{ required: true, message: 'Informe a agência' }]}
              >
                <Input size="large" placeholder="Ex: 0345-X" style={{ borderRadius: 6 }} />
              </Form.Item>

              <Form.Item
                name="conta"
                label="Conta nº"
                rules={[{ required: true, message: 'Informe a conta' }]}
              >
                <Input size="large" placeholder="Ex: 98765-4" style={{ borderRadius: 6 }} />
              </Form.Item>
            </div>

            <Divider plain>Chave PIX (Opcional para controle interno)</Divider>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <Form.Item
                name="tipoChavePix"
                label="Tipo de Chave PIX"
                rules={[{ required: true, message: 'Selecione o tipo de chave' }]}
              >
                <Select size="large">
                  <Option value="CPF">CPF do Titular</Option>
                  <Option value="EMAIL">E-mail</Option>
                  <Option value="TELEFONE">Telefone Celular</Option>
                  <Option value="ALEATORIA">Chave Aleatória (EVP)</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="chavePix"
                label="Chave PIX"
                rules={[{ required: true, message: 'Informe a chave PIX' }]}
              >
                <Input size="large" placeholder="Digite a chave PIX" style={{ borderRadius: 6 }} />
              </Form.Item>
            </div>
          </div>

          {/* ETAPA 3: FAIXA, ANEXO III (SE 100%) E DOCUMENTOS */}
          <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
            <Form.Item label="Faixa de Reembolso Solicitada (Lei nº 5.103/2017)">
              <Radio.Group
                value={faixaDesejada}
                onChange={(e) => setFaixaDesejada(e.target.value)}
                buttonStyle="solid"
                size="large"
                style={{ width: '100%', display: 'flex', gap: 14 }}
              >
                <Radio.Button value="75%" style={{ flex: 1, textAlign: 'center', height: 'auto', padding: 14, borderRadius: 6 }}>
                  <div style={{ fontWeight: 600 }}>Anexo I — Faixa de 75% (Art. 1º)</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Requerimento padrão + Termo de Ciência
                  </Text>
                </Radio.Button>
                <Radio.Button value="100%" style={{ flex: 1, textAlign: 'center', height: 'auto', padding: 14, borderRadius: 6 }}>
                  <div style={{ fontWeight: 600 }}>Anexo II + III — Faixa de 100% (Art. 2º)</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Inclui Declaração de Membros e Renda Familiar
                  </Text>
                </Radio.Button>
              </Radio.Group>
            </Form.Item>

            {/* ANEXO III: DECLARAÇÃO DE MEMBROS E RENDA FAMILIAR (SOMENTE 100%) */}
            {faixaDesejada === '100%' && (
              <Card
                size="small"
                style={{ marginBottom: 20, background: '#F9F7F2', borderColor: '#C99B53', borderRadius: 6 }}
                title={
                  <span style={{ color: '#1F2421', fontWeight: 700 }}>
                    Anexo III — Declaração dos Membros e Renda Familiar
                  </span>
                }
              >
                <Form.List name="membrosFamilia">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name, ...restField }) => (
                        <div
                          key={key}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1fr 1.2fr 1fr auto',
                            gap: 8,
                            marginBottom: 8,
                            alignItems: 'center',
                          }}
                        >
                          <Form.Item {...restField} name={[name, 'nomeCompleto']} style={{ marginBottom: 0 }}>
                            <Input placeholder="Nome Completo" />
                          </Form.Item>
                          <Form.Item {...restField} name={[name, 'dataNasc']} style={{ marginBottom: 0 }}>
                            <Input placeholder="DD/MM/AAAA" />
                          </Form.Item>
                          <Form.Item {...restField} name={[name, 'parentesco']} style={{ marginBottom: 0 }}>
                            <Input placeholder="Parentesco" />
                          </Form.Item>
                          <Form.Item {...restField} name={[name, 'profissao']} style={{ marginBottom: 0 }}>
                            <Input placeholder="Profissão" />
                          </Form.Item>
                          <Form.Item {...restField} name={[name, 'renda']} style={{ marginBottom: 0 }}>
                            <InputNumber
                              prefix="R$"
                              min={0}
                              step={50}
                              style={{ width: '100%' }}
                              placeholder="0,00"
                            />
                          </Form.Item>
                          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                        </div>
                      ))}
                      <Button
                        type="dashed"
                        onClick={() => add({ nomeCompleto: '', dataNasc: '', parentesco: '', profissao: '', renda: 0 })}
                        block
                        icon={<PlusOutlined />}
                      >
                        Adicionar Membro da Família
                      </Button>
                    </>
                  )}
                </Form.List>
              </Card>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              <div>
                <Text strong style={{ color: '#1F2421' }}>1. Comprovante de Endereço Atualizado</Text>
                <Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 8px' }}>
                  Conta recente de água, luz ou IPTU em Capivari/SP
                </Paragraph>
                <Upload.Dragger {...dummyUploadProps} style={{ padding: 14, background: '#F9F7F2', borderColor: '#E6E0D4', borderRadius: 6 }}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ color: '#1B5E3A', fontSize: 28 }} />
                  </p>
                  <p className="ant-upload-text" style={{ fontSize: 13 }}>Clique ou arraste</p>
                </Upload.Dragger>
              </div>

              <div>
                <Text strong style={{ color: '#1F2421' }}>2. Comprovante de Matrícula / Frequência</Text>
                <Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 8px' }}>
                  Declaração da instituição de ensino
                </Paragraph>
                <Upload.Dragger {...dummyUploadProps} style={{ padding: 14, background: '#F9F7F2', borderColor: '#E6E0D4', borderRadius: 6 }}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ color: '#1B5E3A', fontSize: 28 }} />
                  </p>
                  <p className="ant-upload-text" style={{ fontSize: 13 }}>Clique ou arraste</p>
                </Upload.Dragger>
              </div>

              <div>
                <Text strong style={{ color: '#1F2421' }}>3. RG/CPF, Cartão BB e Certificado da Empresa</Text>
                <Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 8px' }}>
                  Documentos previstos nas alíneas a, e, f
                </Paragraph>
                <Upload.Dragger {...dummyUploadProps} style={{ padding: 14, background: '#F9F7F2', borderColor: '#E6E0D4', borderRadius: 6 }}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ color: '#1B5E3A', fontSize: 28 }} />
                  </p>
                  <p className="ant-upload-text" style={{ fontSize: 13 }}>Clique ou arraste</p>
                </Upload.Dragger>
              </div>
            </div>
          </div>

          {/* BOTÕES DE NAVEGAÇÃO */}
          <Divider style={{ margin: '24px 0 16px' }} />
          <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            {currentStep > 0 ? (
              <Button size="large" icon={<ArrowLeftOutlined />} onClick={handlePrev} style={{ borderRadius: 6 }}>
                Retornar
              </Button>
            ) : <span />}

            <Space>
              {currentStep === 2 && (
                <Button
                  size="large"
                  icon={<FilePdfOutlined />}
                  loading={gerandoPdf}
                  onClick={handleBaixarPdfOficial}
                  style={{ borderColor: '#C99B53', color: '#1F2421', borderRadius: 6, fontWeight: 600 }}
                >
                  Gerar PDF Oficial
                </Button>
              )}

              {currentStep < 2 ? (
                <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={handleNext} style={{ background: '#1B5E3A', borderColor: '#1B5E3A', borderRadius: 6 }}>
                  Avançar
                </Button>
              ) : (
                <Button
                  type="primary"
                  size="large"
                  style={{ background: '#1B5E3A', borderColor: '#1B5E3A', borderRadius: 6, fontWeight: 600 }}
                  icon={<CheckCircleOutlined />}
                  onClick={handleFinalizar}
                >
                  Submeter Requerimento à SEMEC
                </Button>
              )}
            </Space>
          </Space>
        </Form>
      )}
    </Card>
  );
};
