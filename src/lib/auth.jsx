import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

const INATIVIDADE_MS = 20 * 60 * 1000 // encerra após 20 min sem uso
const CHAVE_ATIVIDADE = 'central.ultimaAtividade'
const gravarAtividade = (t) => { try { localStorage.setItem(CHAVE_ATIVIDADE, String(t)) } catch { /* indisponível */ } }
const limparAtividade = () => { try { localStorage.removeItem(CHAVE_ATIVIDADE) } catch { /* indisponível */ } }
const inativoDemais = () => {
  try {
    const t = Number(localStorage.getItem(CHAVE_ATIVIDADE))
    return Number.isFinite(t) && t > 0 && Date.now() - t > INATIVIDADE_MS
  } catch { return false }
}

// Quem quiser saber que a sessão vai acabar (para avisar os sistemas abertos)
const aoSairOuvintes = new Set()
export const aoSair = (fn) => { aoSairOuvintes.add(fn); return () => aoSairOuvintes.delete(fn) }

export function AuthProvider({ children }) {
  const [carregando, setCarregando] = useState(true)
  const [sessao, setSessao] = useState(null)
  const [nome, setNome] = useState('')
  const [mfa, setMfa] = useState('ok') // ok | verificar | cadastrar
  const [sistemas, setSistemas] = useState([])
  const [gestor, setGestor] = useState(false)
  const [erroSistemas, setErroSistemas] = useState(null)

  const carregarContexto = useCallback(async (s) => {
    if (!s) { setNome(''); setMfa('ok'); setSistemas([]); setGestor(false); return }
    const [perfil, aal, fatores] = await Promise.all([
      supabase.from('usuarios').select('nome, mfa_obrigatorio').eq('id', s.user.id).maybeSingle(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ])
    setNome(perfil.data?.nome || s.user.email || '')
    const verificados = (fatores.data?.totp || []).filter((f) => f.status === 'verified')
    const obrigatorio = perfil.data?.mfa_obrigatorio ?? true
    let estado = 'ok'
    if (obrigatorio) {
      if (aal.data?.currentLevel === 'aal1' && aal.data?.nextLevel === 'aal2') estado = 'verificar'
      else if (verificados.length === 0) estado = 'cadastrar'
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
      if (data.session && inativoDemais()) {
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
    const verificar = () => { if (inativoDemais()) sair() }
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
    carregando, sessao, nome, mfa, sistemas, gestor, erroSistemas, sair,
    recarregar: () => carregarContexto(sessao),
  }), [carregando, sessao, nome, mfa, sistemas, gestor, erroSistemas, sair, carregarContexto])

  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>
}
