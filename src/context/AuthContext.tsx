import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

export type UserRole = 'ALUNO' | 'ADMIN' | 'DEV';

export interface AuthUser {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
  cpf?: string;
  fotoFacialBase64?: string;
  hashFacial?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loadingAuth: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  registrarAluno: (
    nome: string,
    cpf: string,
    email: string,
    password: string,
    biometria?: { fotoBase64: string; hashAssinatura: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'SEMEC_AUTH_SESSION';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const carregarPerfilSupabase = async (uid: string, emailFallback: string, meta?: any): Promise<AuthUser> => {
    if (supabase) {
      const { data } = await supabase
        .from('perfis_usuarios')
        .select('id, email, nome, cpf, role')
        .eq('id', uid)
        .maybeSingle();

      if (data) {
        return {
          id: data.id,
          email: data.email,
          nome: data.nome,
          cpf: data.cpf || undefined,
          role: (data.role as UserRole) || 'ALUNO',
        };
      }
    }

    const roleMeta = (meta?.role as UserRole) || 'ALUNO';
    return {
      id: uid,
      email: emailFallback,
      nome: meta?.nome || emailFallback.split('@')[0],
      cpf: meta?.cpf,
      role: roleMeta,
    };
  };

  useEffect(() => {
    let ativo = true;

    const init = async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user && ativo) {
            const u = data.session.user;
            const perfil = await carregarPerfilSupabase(u.id, u.email || '', u.user_metadata);
            if (ativo) setUser(perfil);
          }
        } else {
          const saved = sessionStorage.getItem(STORAGE_KEY);
          if (saved && ativo) {
            setUser(JSON.parse(saved));
          }
        }
      } finally {
        if (ativo) setLoadingAuth(false);
      }
    };

    void init();

    if (isSupabaseConfigured && supabase) {
      const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const perfil = await carregarPerfilSupabase(
            session.user.id,
            session.user.email || '',
            session.user.user_metadata
          );
          setUser(perfil);
        } else {
          setUser(null);
        }
      });
      return () => {
        ativo = false;
        listener.subscription.unsubscribe();
      };
    }

    return () => {
      ativo = false;
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const emailLimpo = email.trim().toLowerCase();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailLimpo,
        password,
      });

      if (error) {
        return { ok: false, error: 'E-mail ou senha inválidos. Verifique suas credenciais.' };
      }

      if (data.user) {
        const perfil = await carregarPerfilSupabase(
          data.user.id,
          data.user.email || emailLimpo,
          data.user.user_metadata
        );
        setUser(perfil);
        return { ok: true };
      }
    }

    return {
      ok: false,
      error: 'Serviço de autenticação indisponível. Verifique a configuração do Supabase.',
    };
  };

  const registrarAluno = async (
    nome: string,
    cpf: string,
    email: string,
    password: string,
    biometria?: { fotoBase64: string; hashAssinatura: string }
  ): Promise<{ ok: boolean; error?: string }> => {
    const emailLimpo = email.trim().toLowerCase();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: emailLimpo,
        password,
        options: {
          data: {
            nome,
            cpf,
            role: 'ALUNO',
            hash_facial: biometria?.hashAssinatura,
          },
        },
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data.user) {
        await supabase.from('perfis_usuarios').upsert({
          id: data.user.id,
          email: emailLimpo,
          nome,
          cpf,
          role: 'ALUNO',
          foto_facial_base64: biometria?.fotoBase64 ?? null,
          hash_facial: biometria?.hashAssinatura ?? null,
        });

        const novoUser: AuthUser = {
          id: data.user.id,
          email: emailLimpo,
          nome,
          cpf,
          role: 'ALUNO',
          fotoFacialBase64: biometria?.fotoBase64,
          hashFacial: biometria?.hashAssinatura,
        };
        setUser(novoUser);
        return { ok: true };
      }
    }

    return { ok: false, error: 'Não foi possível concluir o cadastro. Verifique a conexão com o servidor.' };
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    sessionStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loadingAuth, login, registrarAluno, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
