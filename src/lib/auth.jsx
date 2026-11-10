import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

// Regras de sessão vêm do banco (aba Segurança da Gestão de acessos): padrão 2FA para todos,
// senha + código de novo a cada 7 dias e saída automática após 12 h sem uso.
const PADRAO = { exige_2fa: true, dias: 7, horas: 12 }
const CHAVE_ATIVIDADE = 'central.ultimaAtividade'
const CHAVE_REGRAS = 'central.regras'
const CHAVE_AVISO = 'central.aviso'
const lerRegras = () => { try { return { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE_REGRAS) || '{}') } } catch { return PADRAO } }
const guardarRegras = (r) => { try { localStorage.setItem(CHAVE_REGRAS, JSON.stringify(r)) } catch { /* indisponível */ } }
const gravarAtividade = (t) => { try { localStorage.setItem(CHAVE_ATIVIDADE, String(t)) } catch { /* indisponível */ } }
const limparAtividade = () => { try { localStorage.removeItem(CHAVE_ATIVIDADE) } catch { /* indisponível */ } }
const inativoDemais = (horas) => {
  try {
    const t = Number(localStorage.getItem(CHAVE_ATIVIDADE))
    return Number.isFinite(t) && t > 0 && Date.now() - t > horas * 3600000
  } catch { return false }
}
// aviso mostrado na tela de login depois de uma saída automática
export const lerAviso = () => { try { const a = sessionStorage.getItem(CHAVE_AVISO); sessionStorage.removeItem(CHAVE_AVISO); return a } catch { return null } }
const guardarAviso = (a) => { try { sessionStorage.setItem(CHAVE_AVISO, a) } catch { /* indisponível */ } }
// quando o código do autenticador foi confirmado nesta sessão (claim "amr" do token)
function codigoConfirmadoEm(token) {
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    const ts = (p.amr || []).filter((m) => m.method === 'totp').map((m) => Number(m.timestamp)).filter(Number.isFinite)
    return ts.length ? Math.max(...ts) * 1000 : null
  } catch { return null }
}

// Quem quiser saber que a sessão vai acabar (para avisar os sistemas abertos)
const aoSairOuvintes = new Set()
export const aoSair = (fn) => { aoSairOuvintes.add(fn); return () => aoSairOuvintes.delete(fn) }

export function AuthProvider({ children }) {
  const [carregando, setCarregando] = useState(true)
  const [sessao, setSessao] = useState(null)
  const [nome, setNome] = useState('')
  const [mfa, setMfa] = useState('ok') // ok | verificar | cadastrar
  const [trocarSenha, setTrocarSenha] = useState(false) // senha padrão: troca obrigatória no 1º acesso
  const [sistemas, setSistemas] = useState([])
  const [gestor, setGestor] = useState(false)
  const [erroSistemas, setErroSistemas] = useState(null)
  const regras = useRef(lerRegras())

  const carregarContexto = useCallback(async (s) => {
    if (!s) { setNome(''); setMfa('ok'); setTrocarSenha(false); setSistemas([]); setGestor(false); return }
    const [perfil, aal, fatores, r] = await Promise.all([
      supabase.from('usuarios').select('nome, mfa_obrigatorio, trocar_senha').eq('id', s.user.id).maybeSingle(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
      supabase.rpc('central_regras_sessao'),
    ])
    if (r.data) { regras.current = { ...PADRAO, ...r.data }; guardarRegras(regras.current) }
    setNome(perfil.data?.nome || s.user.email || '')
    // senha padrão: antes de tudo, a pessoa cria a própria senha
    if (perfil.data?.trocar_senha) { setTrocarSenha(true); setSistemas([]); setGestor(false); return }
    setTrocarSenha(false)
    const verificados = (fatores.data?.totp || []).filter((f) => f.status === 'verified')
    const obrigatorio = regras.current.exige_2fa || (perfil.data?.mfa_obrigatorio ?? true)
    let estado = 'ok'
    if (obrigatorio) {
      if (verificados.length === 0) estado = 'cadastrar'
      else if (aal.data?.currentLevel !== 'aal2') estado = 'verificar'
      else {
        // a cada N dias pede senha + código de novo, mesmo sem ter saído (também conferido no banco)
        const em = codigoConfirmadoEm(s.access_token)
        if (em && Date.now() - em > regras.current.dias * 86400000) {
          guardarAviso(`Por segurança, a cada ${regras.current.dias} dias o Central pede a senha e o código de novo.`)
          await supabase.auth.signOut({ scope: 'local' })
          return
        }
      }
    }
    setMfa(estado)
    if (estado !== 'ok') { setSistemas([]); setGestor(false); return }
    const [lista, g] = await Promise.all([supabase.rpc('central_menu'), supabase.rpc('central_sou_gestor')])
    setErroSistemas(lista.error ? 'Não foi possível carregar seus sistemas. Verifique a internet e tente de novo.' : null)
    setSistemas(lista.data || [])
    setGestor(!!g.data)
  }, [])

  useEffect(() => {
    let vivo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return
      if (data.session && inativoDemais(regras.current.horas)) {
        guardarAviso(`O Central ficou mais de ${regras.current.horas} h sem uso. Entre de novo.`)
        await supabase.auth.signOut({ scope: 'local' })
        limparAtividade()
        setSessao(null); await carregarContexto(null); setCarregando(false)
        return
      }
      setSessao(data.session)
      await carregarContexto(data.session)
      setCarregando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSessao(s)
      if (evento === 'SIGNED_OUT') { carregarContexto(null); return }
      if (evento === 'SIGNED_IN' || evento === 'MFA_CHALLENGE_VERIFIED' || evento === 'USER_UPDATED') {
        setTimeout(() => carregarContexto(s), 0)
      }
    })
    return () => { vivo = false; sub.subscription.unsubscribe() }
  }, [carregarContexto])

  const sair = useCallback(async () => {
    aoSairOuvintes.forEach((fn) => { try { fn() } catch { /* ok */ } })
    limparAtividade()
    await supabase.auth.signOut()
  }, [])

  // Encerramento por inatividade (vale para todas as abas)
  const timer = useRef()
  useEffect(() => {
    if (!sessao) return
    let ultima = 0
    const marcar = () => { const t = Date.now(); if (t - ultima > 15000) { ultima = t; gravarAtividade(t) } }
    const verificar = () => {
      if (inativoDemais(regras.current.horas)) { guardarAviso(`O Central ficou mais de ${regras.current.horas} h sem uso. Entre de novo.`); sair() }
    }
    const eventos = ['mousedown', 'keydown', 'touchstart', 'scroll']
    eventos.forEach((e) => window.addEventListener(e, marcar, { passive: true }))
    // atividade dentro dos sistemas abertos chega como aviso do próprio sistema
    const doSistema = (e) => { if (e.data?.tipo === 'central:atividade') marcar() }
    window.addEventListener('message', doSistema)
    gravarAtividade(Date.now())
    timer.current = window.setInterval(verificar, 30000)
    document.addEventListener('visibilitychange', verificar)
    return () => {
      window.clearInterval(timer.current)
      document.removeEventListener('visibilitychange', verificar)
      window.removeEventListener('message', doSistema)
      eventos.forEach((e) => window.removeEventListener(e, marcar))
    }
  }, [sessao, sair])

  const valor = useMemo(() => ({
    carregando, sessao, nome, mfa, trocarSenha, sistemas, gestor, erroSistemas, sair,
    recarregar: () => carregarContexto(sessao),
  }), [carregando, sessao, nome, mfa, trocarSenha, sistemas, gestor, erroSistemas, sair, carregarContexto])

  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>
}
