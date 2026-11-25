import React, { useEffect, useState } from 'react';
import {
  ConfigProvider,
  Layout,
  Button,
  Modal,
  Input,
  message,
  Tag,
  Spin,
  Space,
} from 'antd';
import ptBR from 'antd/locale/pt_BR';
import 'dayjs/locale/pt-br';
import dayjs from 'dayjs';
import {
  UserOutlined,
  BankOutlined,
  KeyOutlined,
  ScanOutlined,
  LogoutOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { AreaAluno } from './components/AreaAluno';
import { PainelSecretaria } from './components/PainelSecretaria';
import { LoginPage } from './components/LoginPage';
import { setGeminiApiKey, getGeminiApiKey } from './services/geminiService';

dayjs.locale('pt-br');

const { Header, Content, Footer } = Layout;

const MainContent: React.FC = () => {
  const { user, loadingAuth, logout } = useAuth();
  const { perfil, setPerfil } = useApp();
  const [modalApiKeyOpen, setModalApiKeyOpen] = useState(false);
  const [chaveInput, setChaveInput] = useState(() => getGeminiApiKey());

  // Sincroniza a visão inicial com o perfil autenticado (ALUNO -> ALUNO, ADMIN -> SECRETARIA, DEV -> livre)
  useEffect(() => {
    if (!user) return;
    if (user.role === 'ALUNO') setPerfil('ALUNO');
    else if (user.role === 'ADMIN') setPerfil('SECRETARIA');
  }, [user, setPerfil]);

  if (loadingAuth) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F9F7F2',
        }}
      >
        <Spin size="large" tip="Carregando sessão..." />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const isDev = user.role === 'DEV';
  const isAdmin = user.role === 'ADMIN';

  const handleSalvarApiKey = () => {
    setGeminiApiKey(chaveInput.trim());
    message.success(
      chaveInput.trim()
        ? 'Chave do motor de leitura documental (Gemini) salva com sucesso!'
        : 'Chave removida. O sistema continuará usando o motor local gratuito (QR Code + OCR).'
    );
    setModalApiKeyOpen(false);
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#F9F7F2' }}>
      {/* 1. FAIXA FINA DECORATIVA INSTITUCIONAL TRI-COLOR */}
      <div className="semec-flag-bar">
        <div className="bar-green" />
        <div className="bar-gold" />
        <div className="bar-terracotta" />
      </div>

      {/* 2. CABEÇALHO INSTITUCIONAL LIMPO SEMEC CAPIVARI */}
      <Header
        className="semec-header"
        style={{
          background: '#FFFFFF',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          borderBottom: '1px solid #E6E0D4',
          height: 'auto',
          minHeight: 74,
          lineHeight: 'normal',
        }}
      >
        {/* LOGO OFICIAL & TÍTULO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img
            src="/SEMEC_400x416.png"
            alt="SEMEC - Secretaria Municipal da Educação de Capivari"
            style={{
              height: 52,
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
          />
          <div style={{ width: 1, height: 36, backgroundColor: '#E6E0D4' }} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div
              className="brand-title"
              style={{
                fontSize: 18,
                color: '#1F2421',
                lineHeight: 1.2,
                fontFamily: "'Merriweather', serif",
                fontWeight: 700,
                marginBottom: 3,
              }}
            >
              Transporte Escolar
            </div>
            <div style={{ color: '#59615C', fontSize: 12, lineHeight: 1.2, letterSpacing: '0.02em', fontWeight: 500 }}>
              Recadastro e Reembolso
            </div>
          </div>
        </div>

        {/* CONTROLES DE PERFIL (DEV VÊ TUDO; ADMIN VÊ SECRETARIA; ALUNO VÊ ESTUDANTE) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {isDev && (
            <>
              <Button
                type="default"
                icon={<ScanOutlined style={{ color: getGeminiApiKey() ? '#1B5E3A' : '#C99B53' }} />}
                style={{
                  color: '#1F2421',
                  background: '#FFFFFF',
                  border: '1.5px solid #C99B53',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 12,
                }}
                size="middle"
                onClick={() => setModalApiKeyOpen(true)}
              >
                {getGeminiApiKey() ? 'OCR Gemini Ativo' : 'Configurar OCR'}
              </Button>

              <Button
                type={perfil === 'ALUNO' ? 'primary' : 'default'}
                icon={<UserOutlined />}
                onClick={() => setPerfil('ALUNO')}
                style={{
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 12,
                  ...(perfil === 'ALUNO'
                    ? { background: '#1B5E3A', borderColor: '#1B5E3A', color: '#FFFFFF' }
                    : { background: '#FFFFFF', borderColor: '#E6E0D4', color: '#59615C' }),
                }}
              >
                Visão Estudante
              </Button>

              <Button
                type={perfil === 'SECRETARIA' ? 'primary' : 'default'}
                icon={<BankOutlined />}
                onClick={() => setPerfil('SECRETARIA')}
                style={{
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 12,
                  ...(perfil === 'SECRETARIA'
                    ? { background: '#14452B', borderColor: '#14452B', color: '#FFFFFF' }
                    : { background: '#FFFFFF', borderColor: '#E6E0D4', color: '#59615C' }),
                }}
              >
                Visão Secretaria
              </Button>
            </>
          )}

          <Space size={8} style={{ marginLeft: 4 }}>
            <Tag
              icon={isDev ? <CodeOutlined /> : isAdmin ? <BankOutlined /> : <UserOutlined />}
              style={{
                background: isDev ? '#FFF8E1' : '#E8F5E9',
                color: isDev ? '#8C6214' : '#1B5E3A',
                borderColor: isDev ? '#FFE082' : '#C8E6C9',
                fontWeight: 600,
                padding: '3px 8px',
                margin: 0,
              }}
            >
              {user.nome} ({isDev ? 'DEV' : isAdmin ? 'ADMIN' : 'ALUNO'})
            </Tag>

            <Button
              size="middle"
              icon={<LogoutOutlined />}
              onClick={() => void logout()}
              style={{ borderColor: '#E6E0D4', color: '#A83A28', fontWeight: 600 }}
            >
              Sair
            </Button>
          </Space>
        </div>
      </Header>

      {/* 3. ÁREA DE CONTEÚDO PROTEGIDA POR PERFIL */}
      <Content style={{ background: '#F9F7F2', minHeight: 'calc(100vh - 145px)' }}>
        {isDev ? (
          perfil === 'ALUNO' ? <AreaAluno /> : <PainelSecretaria />
        ) : isAdmin ? (
          <PainelSecretaria />
        ) : (
          <AreaAluno />
        )}
      </Content>

      {/* 4. RODAPÉ OFICIAL */}
      <Footer className="semec-footer">
        <div>
          <strong>Secretaria Municipal da Educação de Capivari (SEMEC)</strong> — Rua Pedro Stucchi, 381, Pão de Açúcar, Capivari/SP | CEP 13360-000
        </div>
        <div style={{ marginTop: 4, fontSize: 12 }}>
          Atendimento ao Estudante: transporte.universitario@capivari.sp.gov.br | Portal Oficial:{' '}
          <a href="https://www.capivari.sp.gov.br" target="_blank" rel="noreferrer">
            www.capivari.sp.gov.br
          </a>
        </div>
      </Footer>

      {/* MODAL CONFIGURAÇÃO MOTOR DOCUMENTAL (EXCLUSIVO DEV) */}
      <Modal
        title={
          <span style={{ fontFamily: "'Merriweather', serif", fontWeight: 700, color: '#1F2421' }}>
            Configuração do Motor de Extração Documental
          </span>
        }
        open={modalApiKeyOpen}
        onCancel={() => setModalApiKeyOpen(false)}
        onOk={handleSalvarApiKey}
        okText="Salvar Configuração"
        cancelText="Fechar"
      >
        <p style={{ color: '#59615C', fontSize: 13, marginBottom: 12 }}>
          Para leitura automatizada de notas fiscais e cupons fiscais via modelo <code>gemini-2.5-flash</code>, informe a chave da API abaixo.
        </p>
        <Input.Password
          prefix={<KeyOutlined style={{ color: '#59615C' }} />}
          placeholder="Cole sua GEMINI_API_KEY aqui"
          value={chaveInput}
          onChange={(e) => setChaveInput(e.target.value)}
          style={{ borderRadius: 6 }}
        />
      </Modal>
    </Layout>
  );
};

export default function App() {
  return (
    <ConfigProvider
      locale={ptBR}
      theme={{
        token: {
          colorPrimary: '#1B5E3A',
          colorInfo: '#1B5E3A',
          colorSuccess: '#2E7D32',
          colorWarning: '#C99B53',
          colorError: '#A83A28',
          colorBgLayout: '#F9F7F2',
          colorBgContainer: '#FFFFFF',
          colorBorderSecondary: '#E6E0D4',
          colorText: '#1F2421',
          colorTextSecondary: '#59615C',
          borderRadius: 6,
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          boxShadow: 'none',
        },
        components: {
          Card: { borderRadiusLG: 6, colorBorderSecondary: '#E6E0D4' },
          Button: { borderRadius: 6, controlHeight: 38, fontWeight: 600 },
          Table: { borderRadius: 6, headerBg: '#F9F7F2', headerColor: '#1F2421', borderColor: '#E6E0D4' },
          Drawer: { colorBgElevated: '#FFFFFF' },
          Tabs: { itemSelectedColor: '#1B5E3A', inkBarColor: '#1B5E3A' },
          Steps: { colorPrimary: '#1B5E3A' },
          Alert: { borderRadiusLG: 6 },
        },
      }}
    >
      <AuthProvider>
        <AppProvider>
          <MainContent />
        </AppProvider>
      </AuthProvider>
    </ConfigProvider>
  );
}
