import React, { useState } from 'react';
import { Card, Form, Input, Button, Tabs, Typography, Alert, Space, message } from 'antd';
import {
  MailOutlined,
  LockOutlined,
  UserOutlined,
  IdcardOutlined,
  LoginOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { AssinaturaFacialBox } from './AssinaturaFacialBox';
import type { ResultadoAssinaturaFacial } from '../services/faceAuthService';

const { Title, Text } = Typography;

export const LoginPage: React.FC = () => {
  const { login, registrarAluno } = useAuth();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<'login' | 'cadastro'>('login');
  const [biometriaCadastro, setBiometriaCadastro] = useState<ResultadoAssinaturaFacial | undefined>();
  const [formLogin] = Form.useForm();
  const [formCadastro] = Form.useForm();

  const handleLogin = async (values: { email: string; password: string }) => {
    setErro(null);
    setLoading(true);
    try {
      const res = await login(values.email, values.password);
      if (!res.ok) {
        setErro(res.error || 'Falha ao entrar.');
      } else {
        message.success('Acesso autorizado!');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCadastro = async (values: {
    nome: string;
    cpf: string;
    email: string;
    password: string;
  }) => {
    if (!biometriaCadastro) {
      setErro('É obrigatório cadastrar sua biometria facial pela câmera antes de criar a conta.');
      return;
    }
    setErro(null);
    setLoading(true);
    try {
      const res = await registrarAluno(
        values.nome,
        values.cpf,
        values.email,
        values.password,
        {
          fotoBase64: biometriaCadastro.fotoBase64,
          hashAssinatura: biometriaCadastro.hashAssinatura,
        }
      );
      if (!res.ok) {
        setErro(res.error || 'Não foi possível concluir o cadastro.');
      } else {
        message.success('Conta de estudante e biometria facial cadastradas com sucesso!');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F9F7F2',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Faixa institucional SEMEC */}
      <div className="semec-flag-bar">
        <div className="bar-green" />
        <div className="bar-gold" />
        <div className="bar-terracotta" />
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
        }}
      >
        <Card
          className="semec-card semec-card-accent-green"
          style={{ width: 440, maxWidth: '100%', padding: '8px 6px' }}
        >
          {/* CABEÇALHO COM BRASÃO OFICIAL */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <img
              src="/SEMEC_400x416.png"
              alt="SEMEC - Secretaria Municipal da Educação de Capivari"
              style={{ height: 84, width: 'auto', objectFit: 'contain', marginBottom: 10 }}
            />
            <Title level={4} style={{ margin: 0, color: '#1F2421' }}>
              Transporte Escolar Universitário
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Portal de Recadastro e Reembolso — SEMEC Capivari
            </Text>
          </div>

          {erro && (
            <Alert
              type="error"
              showIcon
              message={erro}
              style={{ marginBottom: 16, borderRadius: 6 }}
            />
          )}

          <Tabs
            activeKey={aba}
            onChange={(k) => {
              setErro(null);
              setAba(k as 'login' | 'cadastro');
            }}
            centered
            items={[
              {
                key: 'login',
                label: (
                  <Space size={6}>
                    <LoginOutlined />
                    <span>Entrar</span>
                  </Space>
                ),
                children: (
                  <Form form={formLogin} layout="vertical" onFinish={handleLogin}>
                    <Form.Item
                      name="email"
                      label="E-mail de Acesso"
                      rules={[
                        { required: true, message: 'Informe seu e-mail' },
                        { type: 'email', message: 'Informe um e-mail válido' },
                      ]}
                    >
                      <Input
                        size="large"
                        prefix={<MailOutlined style={{ color: '#59615C' }} />}
                        placeholder="seu.email@exemplo.com"
                      />
                    </Form.Item>

                    <Form.Item
                      name="password"
                      label="Senha"
                      rules={[{ required: true, message: 'Informe sua senha' }]}
                    >
                      <Input.Password
                        size="large"
                        prefix={<LockOutlined style={{ color: '#59615C' }} />}
                        placeholder="Digite sua senha"
                      />
                    </Form.Item>

                    <Button
                      type="primary"
                      htmlType="submit"
                      size="large"
                      block
                      loading={loading}
                      icon={<LoginOutlined />}
                      style={{
                        background: '#1B5E3A',
                        borderColor: '#1B5E3A',
                        height: 44,
                        fontWeight: 600,
                        marginTop: 4,
                      }}
                    >
                      Acessar Sistema
                    </Button>
                  </Form>
                ),
              },
              {
                key: 'cadastro',
                label: (
                  <Space size={6}>
                    <UserAddOutlined />
                    <span>Primeiro Acesso</span>
                  </Space>
                ),
                children: (
                  <Form form={formCadastro} layout="vertical" onFinish={handleCadastro}>
                    <Form.Item
                      name="nome"
                      label="Nome Completo"
                      rules={[{ required: true, message: 'Informe seu nome completo' }]}
                    >
                      <Input
                        size="large"
                        prefix={<UserOutlined style={{ color: '#59615C' }} />}
                        placeholder="Nome completo do estudante"
                      />
                    </Form.Item>

                    <Form.Item
                      name="cpf"
                      label="CPF"
                      rules={[{ required: true, message: 'Informe seu CPF' }]}
                    >
                      <Input
                        size="large"
                        prefix={<IdcardOutlined style={{ color: '#59615C' }} />}
                        placeholder="000.000.000-00"
                      />
                    </Form.Item>

                    <Form.Item
                      name="email"
                      label="E-mail"
                      rules={[
                        { required: true, message: 'Informe seu e-mail' },
                        { type: 'email', message: 'E-mail inválido' },
                      ]}
                    >
                      <Input
                        size="large"
                        prefix={<MailOutlined style={{ color: '#59615C' }} />}
                        placeholder="estudante@email.com"
                      />
                    </Form.Item>

                    <Form.Item
                      name="password"
                      label="Crie uma Senha (mín. 6 caracteres)"
                      rules={[
                        { required: true, message: 'Crie uma senha' },
                        { min: 6, message: 'A senha deve ter pelo menos 6 caracteres' },
                      ]}
                    >
                      <Input.Password
                        size="large"
                        prefix={<LockOutlined style={{ color: '#59615C' }} />}
                        placeholder="Mínimo 6 caracteres"
                      />
                    </Form.Item>

                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ display: 'block', marginBottom: 8, color: '#1F2421' }}>
                        Cadastro de Biometria Facial (Obrigatório):
                      </Text>
                      <AssinaturaFacialBox
                        cpfAluno={formCadastro.getFieldValue('cpf') || 'NOVO-CADASTRO'}
                        nomeAluno={formCadastro.getFieldValue('nome') || 'Estudante'}
                        habilitado={true}
                        assinaturaAtual={biometriaCadastro}
                        onAssinado={(res) => {
                          setErro(null);
                          setBiometriaCadastro(res);
                        }}
                      />
                    </div>

                    <Button
                      type="primary"
                      htmlType="submit"
                      size="large"
                      block
                      loading={loading}
                      disabled={!biometriaCadastro}
                      icon={<UserAddOutlined />}
                      style={{
                        background: '#1B5E3A',
                        borderColor: '#1B5E3A',
                        height: 44,
                        fontWeight: 600,
                        marginTop: 4,
                      }}
                    >
                      Criar Conta com Biometria Facial
                    </Button>
                  </Form>
                ),
              },
            ]}
          />

          <div
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop: '1px solid #E6E0D4',
              textAlign: 'center',
              fontSize: 12,
              color: '#59615C',
            }}
          >
            Acesso unificado para <strong>Estudantes</strong>, <strong>Administração SEMEC</strong> e{' '}
            <strong>Desenvolvimento</strong>.
          </div>
        </Card>
      </div>

      <footer className="semec-footer">
        <strong>Secretaria Municipal da Educação de Capivari (SEMEC)</strong> — Rua Pedro Stucchi, 381, Pão de Açúcar, Capivari/SP
      </footer>
    </div>
  );
};
