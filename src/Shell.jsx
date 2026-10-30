import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import {
  BarChart3, CalendarDays, ChevronsLeft, ChevronsRight, ExternalLink, KeyRound, LayoutGrid, LogOut, Menu,
  ShoppingCart, Target, Users, X,
} from 'lucide-react'
import { useAuth, aoSair } from './lib/auth'
import { Acessos } from './pages/Acessos'
import { cx } from './ui'

const ICONES = { carrinho: ShoppingCart, grafico: BarChart3, pessoas: Users, alvo: Target, calendario: CalendarDays, app: LayoutGrid }
const origemDe = (url) => { try { return new URL(url).origin } catch { return null } }
const iniciais = (n) => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
const primeiroNome = (n) => { const p = (n || '').split(/\s+/)[0] || ''; return p.charAt(0) + p.slice(1).toLowerCase() }

function lerRecolhido() { try { return localStorage.getItem('central.menuRecolhido') === '1' } catch { return false } }

export function Shell() {
  const { nome, sistemas, gestor, sair, sessao, erroSistemas } = useAuth()
  const [recolhido, setRecolhido] = useState(lerRecolhido)
  const [gaveta, setGaveta] = useState(false) // menu no celular
  const local = useLocation()
  const abriveis = sistemas.filter((s) => s.situacao === 'ativo' && s.url)
  const atual = local.pathname.startsWith('/s/') ? decodeURIComponent(local.pathname.slice(3)) : null

  // sistemas já abertos continuam carregados (trocar de sistema não perde o que estava na tela)
  const [abertos, setAbertos] = useState([])
  useEffect(() => {
    if (atual && abriveis.some((s) => s.chave === atual) && !abertos.includes(atual)) setAbertos((a) => [...a, atual])
  }, [atual, abriveis, abertos])
  useEffect(() => { setGaveta(false) }, [local.pathname])

  const quadros = useRef({}) // chave -> iframe
  const token = sessao?.access_token

  // Conversa com os sistemas abertos: entrega o token a quem pede, repassa token novo e pedidos de saída
  useEffect(() => {
    const ouvir = (e) => {
      const chave = Object.keys(quadros.current).find((k) => quadros.current[k]?.contentWindow === e.source)
      if (!chave) return
      const s = abriveis.find((x) => x.chave === chave)
      const origem = s && origemDe(s.url)
      if (!origem || e.origin !== origem) return
      if (e.data?.tipo === 'central:pronto' && token) e.source.postMessage({ tipo: 'central:token', token }, origem)
      if (e.data?.tipo === 'central:sair-pedido') sair()
    }
    window.addEventListener('message', ouvir)
    return () => window.removeEventListener('message', ouvir)
  }, [abriveis, token, sair])

  // token renovado: o RH (que não renova sozinho dentro do Central) recebe o novo
  useEffect(() => {
    if (!token) return
    for (const s of abriveis) {
      const f = quadros.current[s.chave]
      const origem = origemDe(s.url)
      if (f?.contentWindow && origem && s.tipo_acesso === 'rh') f.contentWindow.postMessage({ tipo: 'central:token', token }, origem)
    }
  }, [token, abriveis])

  // ao sair do Central, todos os sistemas abertos encerram a sessão também
  useEffect(() => aoSair(() => {
    for (const s of abriveis) {
      const f = quadros.current[s.chave]
      const origem = origemDe(s.url)
      if (f?.contentWindow && origem) f.contentWindow.postMessage({ tipo: 'central:sair' }, origem)
    }
  }), [abriveis])

  const alternar = () => setRecolhido((r) => { try { localStorage.setItem('central.menuRecolhido', r ? '0' : '1') } catch { /* ok */ } return !r })
  const largura = recolhido ? 'md:w-[72px]' : 'md:w-[264px]'
  const sistemaAtual = abriveis.find((s) => s.chave === atual)

  const menu = (
    <nav aria-label="Sistemas" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      {(!recolhido || gaveta) && <span className="px-3 pb-1 text-xs font-bold uppercase tracking-[0.12em] text-[#8FB3B5]">Meus sistemas</span>}
      {sistemas.map((s) => {
        const Icone = ICONES[s.icone] || LayoutGrid
        const desabilitado = s.situacao !== 'ativo' || !s.url
        const conteudo = (
          <>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-superficie" style={{ background: s.cor }}><Icone className="h-5 w-5" aria-hidden /></span>
            <span className={cx('min-w-0 flex-1 truncate', recolhido && !gaveta && 'md:hidden')}>{s.nome}</span>
            {desabilitado && <span className={cx('rounded-md bg-[#1D4F52] px-2 py-0.5 text-xs font-semibold text-[#B9CFD0]', recolhido && !gaveta && 'md:hidden')}>Em breve</span>}
          </>
        )
        const base = 'flex h-12 items-center gap-3 rounded-lg px-3 text-base font-semibold transition-colors'
        return desabilitado
          ? <span key={s.chave} title={`${s.nome} — em breve`} aria-disabled="true" className={cx(base, 'cursor-not-allowed text-[#D6E6E7]/50')}>{conteudo}</span>
          : (
            <NavLink key={s.chave} to={`/s/${s.chave}`} title={s.nome}
              className={({ isActive }) => cx(base, isActive ? 'bg-superficie text-tinta' : 'text-[#D6E6E7] hover:bg-marca-media')}>
              {conteudo}
            </NavLink>
          )
      })}
      {gestor && (
        <>
          <span className={cx('mt-4 px-3 pb-1 text-xs font-bold uppercase tracking-[0.12em] text-[#8FB3B5]', recolhido && !gaveta && 'md:hidden')}>Diretoria</span>
          <NavLink to="/acessos" title="Gestão de acessos"
            className={({ isActive }) => cx('flex h-12 items-center gap-3 rounded-lg px-3 text-base font-semibold transition-colors', isActive ? 'bg-superficie text-tinta' : 'text-[#D6E6E7] hover:bg-marca-media')}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-apagado text-superficie"><KeyRound className="h-5 w-5" aria-hidden /></span>
            <span className={cx('truncate', recolhido && !gaveta && 'md:hidden')}>Gestão de acessos</span>
          </NavLink>
        </>
      )}
    </nav>
  )

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* topo no celular */}
      <header className="flex h-14 shrink-0 items-center justify-between bg-marca-funda px-4 text-superficie md:hidden">
        <button type="button" onClick={() => setGaveta(true)} aria-label="Abrir menu" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-marca-media"><Menu className="h-6 w-6" /></button>
        <span className="font-display font-extrabold">{sistemaAtual?.nome || 'Central Idealize'}</span>
        <span className="w-11" />
      </header>

      {gaveta && <div className="fixed inset-0 z-30 bg-[#0F0F0F]/50 md:hidden" onClick={() => setGaveta(false)} aria-hidden />}
      <aside
        className={cx('fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col gap-4 bg-marca-funda px-3 pb-4 pt-6 text-superficie transition-transform md:static md:z-auto md:translate-x-0',
          largura, gaveta ? 'translate-x-0' : '-translate-x-full')}
      >
        <div className="flex items-center justify-between gap-2 px-3">
          <Link to="/" className={cx('min-w-0', recolhido && !gaveta && 'md:hidden')}>
            <img src="/logo-branca.png" alt="Óticas Idealize" className="h-7 w-auto" />
            <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[#8FB3B5]">Central Idealize</span>
          </Link>
          <button type="button" onClick={alternar} aria-label={recolhido ? 'Abrir o menu' : 'Recolher o menu'} title={recolhido ? 'Abrir o menu' : 'Recolher o menu'}
            className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg text-[#B9CFD0] hover:bg-marca-media md:grid">
            {recolhido ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
          </button>
          <button type="button" onClick={() => setGaveta(false)} aria-label="Fechar menu" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-marca-media md:hidden"><X className="h-6 w-6" /></button>
        </div>
        {menu}
        {sistemaAtual && (!recolhido || gaveta) && (
          <a href={sistemaAtual.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 text-sm text-[#B9CFD0] hover:text-superficie">
            <ExternalLink className="h-4 w-4" aria-hidden /> Abrir {sistemaAtual.nome} em nova aba
          </a>
        )}
        <div className="flex items-center gap-3 border-t border-[#1D4F52] px-2 pt-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-laranja font-bold text-marca-funda" title={nome}>{iniciais(nome)}</span>
          <div className={cx('min-w-0 flex-1', recolhido && !gaveta && 'md:hidden')}>
            <p className="truncate text-sm font-bold">{nome}</p>
            <p className="truncate text-xs text-[#8FB3B5]">{sessao?.user?.email}</p>
          </div>
          <button type="button" onClick={sair} aria-label="Sair de todos os sistemas" title="Sair de todos os sistemas"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[#B9CFD0] hover:bg-marca-media hover:text-superficie">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </aside>

      <main className="relative min-h-0 min-w-0 flex-1">
        {abertos.map((chave) => {
          const s = abriveis.find((x) => x.chave === chave)
          if (!s) return null
          return (
            <iframe key={chave} ref={(el) => { quadros.current[chave] = el }} src={s.url} title={s.nome}
              allow="camera; clipboard-read; clipboard-write; fullscreen"
              className={cx('absolute inset-0 h-full w-full border-0 bg-superficie', chave === atual ? 'visible' : 'invisible')} />
          )
        })}
        <Routes>
          <Route index element={<Inicio nome={nome} sistemas={abriveis} erro={erroSistemas} />} />
          <Route path="s/:chave" element={<SistemaAberto sistemas={abriveis} />} />
          <Route path="acessos" element={gestor ? <div className="h-full overflow-y-auto"><Acessos /></div> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

// /s/:chave — o quadro do sistema é desenhado acima; aqui só trata sistema sem acesso
function SistemaAberto({ sistemas }) {
  const { chave } = useParams()
  if (!sistemas.some((s) => s.chave === chave)) return <Navigate to="/" replace />
  return null
}

function Inicio({ nome, sistemas, erro }) {
  const lista = useMemo(() => sistemas, [sistemas])
  if (lista.length === 1 && !erro) return <Navigate to={`/s/${lista[0].chave}`} replace />
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 md:p-12">
        <div>
          <h1 className="text-3xl font-extrabold">Olá, {primeiroNome(nome)}</h1>
          <p className="mt-1 text-apagado">Escolha o sistema. Você já está conectado em todos.</p>
        </div>
        {erro && <p role="alert" className="rounded-lg bg-perigo-suave px-3 py-2 text-sm text-perigo">{erro}</p>}
        {!erro && lista.length === 0 && (
          <div className="rounded-xl border border-linha bg-superficie p-6">
            <h2 className="text-xl font-bold">Nenhum sistema liberado ainda</h2>
            <p className="mt-1 text-apagado">Seu login está ativo, mas ainda não tem sistemas liberados. Fale com a diretoria.</p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((s) => {
            const Icone = ICONES[s.icone] || LayoutGrid
            return (
              <Link key={s.chave} to={`/s/${s.chave}`} className="flex flex-col gap-4 rounded-xl border border-linha bg-superficie p-6 transition-shadow hover:shadow-lg">
                <span className="grid h-12 w-12 place-items-center rounded-xl text-superficie" style={{ background: s.cor }}><Icone className="h-6 w-6" aria-hidden /></span>
                <span>
                  <span className="block font-display text-xl font-bold">{s.nome}</span>
                  {s.descricao && <span className="mt-1 block text-sm text-apagado">{s.descricao}</span>}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
