import React, { useEffect, useRef, useState } from 'react';
import { Card, Button, Alert, Space, Typography, Tag, Spin, message } from 'antd';
import {
  CameraOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  validarEAssinarComRosto,
  type ResultadoAssinaturaFacial,
} from '../services/faceAuthService';

const { Text } = Typography;

interface Props {
  cpfAluno: string;
  nomeAluno: string;
  habilitado: boolean;
  assinaturaAtual?: ResultadoAssinaturaFacial;
  onAssinado: (resultado: ResultadoAssinaturaFacial | undefined) => void;
}

export const AssinaturaFacialBox: React.FC<Props> = ({
  cpfAluno,
  nomeAluno,
  habilitado,
  assinaturaAtual,
  onAssinado,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraAberta, setCameraAberta] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);

  const pararCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraAberta(false);
  };

  useEffect(() => {
    return () => pararCamera();
  }, []);

  const abrirCamera = async () => {
    if (!habilitado) {
      message.warning('Primeiro marque a confirmação de leitura da Lei nº 5.103/2017 e do Decreto nº 6.892/2019.');
      return;
    }
    setErroCamera(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraAberta(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 100);
    } catch {
      setErroCamera(
        'Não foi possível acessar a câmera frontal. Verifique a permissão de câmera no navegador.'
      );
    }
  };

  const capturarEAssinar = async () => {
    if (!videoRef.current) return;
    setProcessando(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Falha ao capturar imagem da câmera.');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const fotoBase64 = canvas.toDataURL('image/jpeg', 0.85);

      const resultado = await validarEAssinarComRosto(fotoBase64, cpfAluno, nomeAluno);
      pararCamera();
      onAssinado(resultado);
      message.success('Assinatura digital por reconhecimento facial validada com sucesso!');
    } catch (err: any) {
      message.error(err?.message || 'Erro ao validar reconhecimento facial. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  if (assinaturaAtual) {
    return (
      <Card
        size="small"
        style={{
          background: '#E8F5E9',
          border: '1px solid #C8E6C9',
          borderRadius: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <img
            src={assinaturaAtual.fotoBase64}
            alt="Biometria Facial"
            style={{
              width: 84,
              height: 84,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '3px solid #1B5E3A',
            }}
          />
          <div style={{ flex: 1 }}>
            <Space style={{ marginBottom: 4 }}>
              <CheckCircleOutlined style={{ color: '#1B5E3A', fontSize: 16 }} />
              <Text strong style={{ color: '#1B5E3A', fontSize: 14 }}>
                Assinatura Digital por Reconhecimento Facial Validada
              </Text>
              <Tag color="green">
                {assinaturaAtual.motor === 'UNIFACE_API' ? 'UniFace ONNX' : 'Biometria Facial'} •{' '}
                {(assinaturaAtual.scoreConfianca * 100).toFixed(0)}%
              </Tag>
            </Space>
            <div style={{ fontSize: 12, color: '#1F2421' }}>
              <strong>Código Hash Biométrico:</strong>{' '}
              <Text code>{assinaturaAtual.hashAssinatura}</Text>
            </div>
            <div style={{ fontSize: 12, color: '#59615C' }}>
              Assinado digitalmente por <strong>{nomeAluno}</strong> (CPF: {cpfAluno}) em{' '}
              {dayjs(assinaturaAtual.dataHora).format('DD/MM/YYYY [às] HH:mm:ss')}
            </div>
          </div>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => {
              onAssinado(undefined);
              void abrirCamera();
            }}
          >
            Refazer Captura
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      size="small"
      style={{
        background: '#F9F7F2',
        border: '1px solid #E6E0D4',
        borderRadius: 6,
      }}
    >
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        {erroCamera && (
          <Alert type="error" showIcon message={erroCamera} style={{ marginBottom: 14, textAlign: 'left' }} />
        )}

        {!cameraAberta ? (
          <div>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: '#FFFFFF',
                border: '2px dashed #1B5E3A',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <UserOutlined style={{ fontSize: 32, color: '#1B5E3A' }} />
            </div>
            <div style={{ fontWeight: 600, color: '#1F2421', marginBottom: 4 }}>
              Assinatura Digital via Reconhecimento Facial
            </div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 14 }}>
              Posicione o rosto em local bem iluminado para assinar digitalmente o Requerimento e o Termo de Ciência.
            </Text>
            <Button
              type="primary"
              size="large"
              icon={<CameraOutlined />}
              disabled={!habilitado}
              style={{ background: '#1B5E3A', borderColor: '#1B5E3A' }}
              onClick={abrirCamera}
            >
              Iniciar Reconhecimento Facial
            </Button>
          </div>
        ) : (
          <div>
            <Spin spinning={processando} tip="Validando biometria facial...">
              <div
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '2px solid #1B5E3A',
                  background: '#000',
                  maxWidth: '100%',
                }}
              >
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  style={{ width: 340, maxWidth: '100%', display: 'block', transform: 'scaleX(-1)' }}
                />
                {/* Guia oval de alinhamento do rosto */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 170,
                    height: 215,
                    borderRadius: '50%',
                    border: '2px dashed rgba(201, 155, 83, 0.95)',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
                    pointerEvents: 'none',
                  }}
                />
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button onClick={pararCamera}>Cancelar</Button>
                <Button
                  type="primary"
                  size="middle"
                  icon={<SafetyCertificateOutlined />}
                  loading={processando}
                  style={{ background: '#1B5E3A', borderColor: '#1B5E3A', fontWeight: 600 }}
                  onClick={capturarEAssinar}
                >
                  Capturar Rosto
                </Button>
              </div>
            </Spin>
          </div>
        )}
      </div>
    </Card>
  );
};
