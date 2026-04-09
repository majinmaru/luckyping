import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';
import PasswordChecklist from '@/components/auth/PasswordChecklist';

type AuthMode = 'login' | 'signup' | 'forgot';

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          toast.error('비밀번호가 일치하지 않습니다');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          toast.error('비밀번호는 6자 이상이어야 합니다');
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success('확인 이메일을 보냈습니다. 이메일을 확인해주세요!');
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success('비밀번호 재설정 이메일을 보냈습니다');
      }
    } catch (err: any) {
      toast.error(err.message || '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error instanceof Error ? result.error.message : '소셜 로그인 중 오류가 발생했습니다');
    } else if (!result.redirected) {
      navigate('/');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl tracking-wider text-primary">
            🍀 행운은 내 손으로
          </h1>
          <p className="mt-2 text-xs tracking-[4px] uppercase text-muted-foreground">
            lotto ticket recorder
          </p>
        </div>

        {/* Card */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-xl">
          <h2 className="mb-6 font-display text-lg text-primary tracking-wide">
            {mode === 'login' ? '🔐 로그인' : mode === 'signup' ? '✨ 회원가입' : '🔑 비밀번호 재설정'}
          </h2>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="mb-2 block text-xs tracking-widest text-muted-foreground">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                className="w-full rounded-lg border border-border bg-surface2 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="mb-2 block text-xs tracking-widest text-muted-foreground">비밀번호</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-border bg-surface2 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="mb-2 block text-xs tracking-widest text-muted-foreground">비밀번호 확인</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-border bg-surface2 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
            )}

            {mode === 'signup' && <PasswordChecklist password={password} />}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground transition hover:bg-gold-glow disabled:opacity-50"
            >
              {loading ? '처리 중...' : mode === 'login' ? '로그인' : mode === 'signup' ? '가입하기' : '재설정 이메일 보내기'}
            </button>
          </form>

          {mode === 'login' && (
            <button
              onClick={() => setMode('forgot')}
              className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-primary transition"
            >
              비밀번호를 잊으셨나요?
            </button>
          )}

          {mode !== 'forgot' && (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">또는</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleSocialLogin('google')}
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface2 py-3 text-sm text-foreground transition hover:border-primary hover:text-primary"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google로 계속하기
                </button>

                <button
                  onClick={() => handleSocialLogin('apple')}
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface2 py-3 text-sm text-foreground transition hover:border-primary hover:text-primary"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Apple로 계속하기
                </button>
              </div>
            </>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === 'login' ? (
              <>
                계정이 없으신가요?{' '}
                <button onClick={() => setMode('signup')} className="text-primary hover:underline">회원가입</button>
              </>
            ) : (
              <>
                이미 계정이 있으신가요?{' '}
                <button onClick={() => setMode('login')} className="text-primary hover:underline">로그인</button>
              </>
            )}
          </div>
        </div>

        <footer className="mt-6 text-center text-xs text-muted-foreground">
          © 2026 Jena. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
