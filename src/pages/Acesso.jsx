import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { supabase, mensagemErro } from '../lib/supabase'
import { useAuth, lerAviso } from '../lib/auth'
import { Aviso, Botao, Campo } from '../ui'

const NOMES = ['PDV', 'Sistema ADM', 'Idealize RH', 'Plataforma 360', 'Agendamento']

// Moldura das telas de acesso: painel da marca à esquerda, formulário à direita
function Moldura({ children }) {
  return (
    <div className="grid min-h-full md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-marca to-marca-funda p-12 text-claro md:flex">
        <img src="/logo-branca.png" alt="Óticas Idealize" className="h-10 w-auto self-start" />
        <div className="flex flex-col gap-4">
          <h1 className="text-5xl font-extrabold">Um acesso.<br />Todos os sistemas.</h1>
          <p className="max-w-md text-xl text-[#B9CFD0]">Entre uma vez e abra o que for do seu cargo, sem decorar várias senhas.</p>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Sistemas do Central">
          {NOMES.map((n) => <li key={n} className="rounded-full border border-[#2A5A5D] px-3 py-2 text-sm">{n}</li>)}
        </ul>
      </div>
      <div className="flex items-center justify-center bg-superficie p-6">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <img src="/logo.png" alt="Óticas Idealize" className="h-9 w-auto self-start md:hidden" />
          {children}
        </div>
      </div>
    </div>
  )
}

export function Login() {
  const { sessao, mfa, trocarSenha } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [aviso] = useState(lerAviso)
  if (sessao) return <Navigate to={trocarSenha ? '/definir-senha' : mfa === 'ok' ? '/' : '/verificacao'} replace />

  const entrar = async (e) => {
    e.preventDefault()
    setErro(null)
    if (!email.trim() || !senha) { setErro('Informe e-mail e senha.'); return }
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha })
    setEnviando(false)
    if (error) setErro(mensagemErro(error))
  }

  return (
    <Moldura>
      <form onSubmit={entrar} className="flex flex-col gap-6" noValidate>
        <div>
          <h2 className="text-3xl font-bold">Entrar</h2>
          <p className="mt-1 text-sm text-apagado">Use o e-mail cadastrado pela diretoria no Central.</p>
        </div>
        {aviso && !erro && <Aviso tipo="info">{aviso}</Aviso>}
        {erro && <Aviso>{erro}</Aviso>}
        <Campo id="email" rotulo="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <Campo id="senha" rotulo="Senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <div className="flex justify-end">
          <Link to="/recuperar-senha" className="text-sm font-semibold text-marca-texto hover:underline">Esqueci minha senha</Link>
        </div>
        <Botao type="submit" carregando={enviando} className="h-12 text-base">Entrar</Botao>
        <p className="text-xs text-apagado">Depois da senha, confirme com o código do aplicativo autenticador.</p>
      </form>
    </Moldura>
  )
}

export function RecuperarSenha() {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState(null) // null | enviando | enviado
  const [erro, setErro] = useState(null)
  const enviar = async (e) => {
    e.preventDefault()
    setErro(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErro('Informe um e-mail válido.'); return }
    setEstado('enviando')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/definir-senha` })
    if (error) { setErro(mensagemErro(error)); setEstado(null); return }
    setEstado('enviado')
  }
  return (
    <Moldura>
      <form onSubmit={enviar} className="flex flex-col gap-6" noValidate>
        <div>
          <h2 className="text-3xl font-bold">Recuperar senha</h2>
          <p className="mt-1 text-sm text-apagado">Enviamos um link para o seu e-mail para você criar uma senha nova.</p>
        </div>
        {erro && <Aviso>{erro}</Aviso>}
        {estado === 'enviado'
          ? <Aviso tipo="ok">Se este e-mail estiver cadastrado, o link chega em alguns minutos. Confira também a caixa de spam.</Aviso>
          : (
            <>
              <Campo id="email" rotulo="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              <Botao type="submit" carregando={estado === 'enviando'} className="h-12 text-base">Enviar link</Botao>
            </>
          )}
        <Link to="/login" className="text-sm font-semibold text-marca-texto hover:underline">Voltar para o login</Link>
      </form>
    </Moldura>
  )
}

// Chega aqui pelo link do convite ou da recuperação (o link já abre a sessão)
export function DefinirSenha() {
  const { sessao, carregando, trocarSenha, recarregar } = useAuth()
  const nav = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const salvar = async (e) => {
    e.preventDefault()
    setErro(null)
    if (senha.length < 10 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) { setErro('A senha precisa ter pelo menos 10 caracteres, com letras e números.'); return }
    if (senha !== confirma) { setErro('As senhas não conferem.'); return }
    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) { setEnviando(false); setErro(/same|different/i.test(error.message) ? 'Escolha uma senha diferente da senha inicial.' : mensagemErro(error)); return }
    if (trocarSenha) {
      const { error: e2 } = await supabase.rpc('central_senha_trocada')
      if (e2) { setEnviando(false); setErro(mensagemErro(e2)); return }
      await recarregar()
    }
    setEnviando(false)
    nav('/', { replace: true })
  }
  return (
    <Moldura>
      <form onSubmit={salvar} className="flex flex-col gap-6" noValidate>
        <div>
          <h2 className="text-3xl font-bold">{trocarSenha ? 'Troque a senha inicial' : 'Criar senha'}</h2>
          <p className="mt-1 text-sm text-apagado">{trocarSenha ? 'No primeiro acesso, crie a sua própria senha. A senha inicial deixa de valer.' : 'Escolha a senha que você vai usar para entrar no Central.'}</p>
        </div>
        {!carregando && !sessao && <Aviso>O link venceu ou já foi usado. Peça um novo em “Esqueci minha senha”.</Aviso>}
        {erro && <Aviso>{erro}</Aviso>}
        <Campo id="senha" rotulo="Nova senha" type="password" autoComplete="new-password" dica="Pelo menos 10 caracteres, com letras e números" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <Campo id="confirma" rotulo="Repita a senha" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
        <Botao type="submit" carregando={enviando} disabled={!sessao} className="h-12 text-base">Salvar e entrar</Botao>
        {!trocarSenha && <Link to="/recuperar-senha" className="text-sm font-semibold text-marca-texto hover:underline">Pedir um link novo</Link>}
      </form>
    </Moldura>
  )
}

// Verificação em duas etapas (diretoria): confirma o código ou cadastra o autenticador
export function Verificacao() {
  const { sessao, mfa, recarregar, sair } = useAuth()
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [cadastro, setCadastro] = useState(null) // { id, qr, segredo }

  useEffect(() => {
    if (mfa !== 'cadastrar') return
    let vivo = true
    ;(async () => {
      // descarta cadastros não concluídos antes de começar um novo
      const { data: f } = await supabase.auth.mfa.listFactors()
      for (const x of (f?.all || []).filter((x) => x.status === 'unverified')) await supabase.auth.mfa.unenroll({ factorId: x.id })
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Central ${Date.now()}` })
      if (!vivo) return
      if (error) setErro(mensagemErro(error))
      else setCadastro({ id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret })
    })()
    return () => { vivo = false }
  }, [mfa])

  if (!sessao) return <Navigate to="/login" replace />
  if (mfa === 'ok') return <Navigate to="/" replace />

  const confirmar = async (e) => {
    e.preventDefault()
    setErro(null)
    if (!/^\d{6}$/.test(codigo)) { setErro('Digite os 6 números do aplicativo.'); return }
    setEnviando(true)
    let fatorId = cadastro?.id
    if (!fatorId) {
      const { data } = await supabase.auth.mfa.listFactors()
      fatorId = (data?.totp || []).find((f) => f.status === 'verified')?.id
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fatorId, code: codigo })
    setEnviando(false)
    if (error) { setErro(mensagemErro(error)); return }
    await recarregar()
  }

  return (
    <Moldura>
      <form onSubmit={confirmar} className="flex flex-col gap-6" noValidate>
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-7 w-7 shrink-0 text-marca-texto" aria-hidden />
          <div>
            <h2 className="text-3xl font-bold">Verificação em duas etapas</h2>
            <p className="mt-1 text-sm text-apagado">
              {mfa === 'cadastrar'
                ? 'Leia o QR code com o aplicativo autenticador (Google Authenticator, Microsoft Authenticator) e digite o código.'
                : 'Digite o código de 6 números do seu aplicativo autenticador.'}
            </p>
          </div>
        </div>
        {mfa === 'cadastrar' && cadastro && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-linha p-4">
            <img src={cadastro.qr} alt="QR code para o aplicativo autenticador" className="h-44 w-44" />
            <span className="text-xs text-apagado">Sem câmera? Digite a chave: <b className="font-mono">{cadastro.segredo}</b></span>
          </div>
        )}
        {erro && <Aviso>{erro}</Aviso>}
        <Campo id="codigo" rotulo="Código" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} autoFocus />
        <Botao type="submit" carregando={enviando} className="h-12 text-base">Confirmar</Botao>
        <Botao variante="fantasma" onClick={sair}>Sair</Botao>
      </form>
    </Moldura>
  )
}
