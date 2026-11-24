import React, { useState } from 'react';
import {
  ConfigProvider,
  Layout,
  Segmented,
  Button,
  Modal,
  Input,
  message,
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
  BookOutlined,
} from '@ant-design/icons';
import { AppProvider, useApp } from './context/AppContext';
import { AreaAluno } from './components/AreaAluno';
import { PainelSecretaria } from './components/PainelSecretaria';
import { setGeminiApiKey, getGeminiApiKey } from './services/geminiService';

dayjs.locale('pt-br');

const { Header, Content, Footer } = Layout;

const MainContent: React.FC = () => {
  const { perfil, setPerfil } = useApp();
  const [modalApiKeyOpen, setModalApiKeyOpen] = useState(false);
  const [chaveInput, setChaveInput] = useState(() => getGeminiApiKey());

  const handleSalvarApiKey = () => {
    setGeminiApiKey(chaveInput.trim());
    message.success(
      chaveInput.trim()
        ? 'Chave do motor de leitura documental (Gemini) salva com sucesso!'
        : 'Chave removida. O sistema funcionará com extração simulada inteligente.'
    );
    setModalApiKeyOpen(false);
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#F9F7F2' }}>
      {/* 1. FAIXA FINA DECORATIVA INSTITUCIONAL TRI-COLOR (4px) */}
      <div className="semec-flag-bar">
        <div className="bar-green" />
        <div className="bar-gold" />
        <div className="bar-terracotta" />
      </div>

      {/* 2. CABEÇALHO INSTITUCIONAL LIMPO SEMEC CAPIVARI */}
      <Header
        style={{
          background: '#FFFFFF',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #E6E0D4',
          height: 80,
          lineHeight: 'normal',
        }}
      >
        {/* LOGO OFICIAL & TÍTULO DO SISTEMA COM DIVISÓRIA SUTIL */}
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
          {/* Divisória vertical sutil */}
          <div
            style={{
              width: 1,
              height: 36,
              backgroundColor: '#E6E0D4',
            }}
          />
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

        {/* SELETOR DE PERFIL E CONFIGURAÇÃO TÉCNICA COLORIDOS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
          {/* BOTÃO OCR/GEMINI COM COR DE DESTAQUE DOURADA/VERDE */}
          <Button
            type="default"
            icon={<ScanOutlined style={{ color: getGeminiApiKey() ? '#1B5E3A' : '#C99B53' }} />}
            style={{
              color: '#1F2421',
              background: '#FFFFFF',
              border: '1.5px solid #C99B53',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 13,
              boxShadow: '0 1px 2px rgba(201, 155, 83, 0.1)',
            }}
            size="middle"
            onClick={() => setModalApiKeyOpen(true)}
          >
            {getGeminiApiKey() ? 'OCR Ativo' : 'Configurar OCR/Gemini'}
          </Button>

          {/* BOTÕES DE PERFIL NA COR DA MARCA */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type={perfil === 'ALUNO' ? 'primary' : 'default'}
              icon={<UserOutlined />}
              onClick={() => setPerfil('ALUNO')}
              style={{
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                ...(perfil === 'ALUNO'
                  ? { background: '#1B5E3A', borderColor: '#1B5E3A', color: '#FFFFFF', boxShadow: '0 2px 4px rgba(27, 94, 58, 0.25)' }
                  : { background: '#FFFFFF', borderColor: '#E6E0D4', color: '#59615C' }),
              }}
            >
              Área do Estudante
            </Button>

            <Button
              type={perfil === 'SECRETARIA' ? 'primary' : 'default'}
              icon={<BankOutlined />}
              onClick={() => setPerfil('SECRETARIA')}
              style={{
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                ...(perfil === 'SECRETARIA'
                  ? { background: '#14452B', borderColor: '#14452B', color: '#FFFFFF', boxShadow: '0 2px 4px rgba(20, 69, 43, 0.25)' }
                  : { background: '#FFFFFF', borderColor: '#E6E0D4', color: '#59615C' }),
              }}
            >
              Painel da Secretaria
            </Button>
          </div>
        </div>
      </Header>

      {/* 3. ÁREA DE CONTEÚDO */}
      <Content style={{ background: '#F9F7F2', minHeight: 'calc(100vh - 145px)' }}>
        {perfil === 'ALUNO' ? <AreaAluno /> : <PainelSecretaria />}
      </Content>

      {/* 4. RODAPÉ OFICIAL DISCRETO */}
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

      {/* MODAL CONFIGURAÇÃO MOTOR DOCUMENTAL */}
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
        <div
          style={{
            marginTop: 14,
            padding: 12,
            background: '#F9F7F2',
            border: '1px solid #E6E0D4',
            borderRadius: 6,
            fontSize: 12,
            color: '#59615C',
          }}
        >
          📌 <strong>Modo com Fallback Ativo:</strong> Se nenhuma chave for inserida, o sistema manterá o processamento estruturado e auditoria funcional para fins de validação.
        </div>
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
          colorPrimary: '#1B5E3A', // Verde-mata institucional
          colorInfo: '#1B5E3A',
          colorSuccess: '#2E7D32',
          colorWarning: '#C99B53', // Ouro / Ocre
          colorError: '#A83A28',   // Terracota / Tijolo
          colorBgLayout: '#F9F7F2', // Papel quente / Off-white
          colorBgContainer: '#FFFFFF',
          colorBorderSecondary: '#E6E0D4', // Areia suave
          colorText: '#1F2421',
          colorTextSecondary: '#59615C',
          borderRadius: 6, // Cantos sóbrios
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          boxShadow: 'none',
        },
        components: {
          Card: {
            borderRadiusLG: 6,
            colorBorderSecondary: '#E6E0D4',
          },
          Button: {
            borderRadius: 6,
            controlHeight: 38,
            fontWeight: 600,
          },
          Table: {
            borderRadius: 6,
            headerBg: '#F9F7F2',
            headerColor: '#1F2421',
            borderColor: '#E6E0D4',
          },
          Drawer: {
            colorBgElevated: '#FFFFFF',
          },
          Tabs: {
            itemSelectedColor: '#1B5E3A',
            inkBarColor: '#1B5E3A',
          },
          Steps: {
            colorPrimary: '#1B5E3A',
          },
          Alert: {
            borderRadiusLG: 6,
          },
        },
      }}
    >
      <AppProvider>
        <MainContent />
      </AppProvider>
    </ConfigProvider>
  );
}
