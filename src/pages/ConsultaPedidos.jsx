import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, Bot, CheckCircle2, Circle, CircleDot, Clock, Loader2, PackageSearch, RefreshCw, Search, SearchX,
} from 'lucide-react'
import { supabase, chamarFuncao, mensagemErro } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Aviso, Botao, Carregando, cx } from '../ui'
import {
  MSG_ERRO, MSG_NAO_LOCALIZADO, dataHora, hora, identificarPedido, nomeEtapa, nomeLaboratorio, resumoStatus,
} from '../lib/pedidos'

// Consulta de Pedidos: a colaboradora digita o número do pedido no laboratório e vê SÓ o status.
// O robô (GitHub Actions) entra no laboratório; esta tela acompanha a consulta até o resultado.
const LIMITE_ESPERA_MS = 5 * 60000

export function ConsultaPedidos() {
  const { gestor } = useAuth()
  const [aba, setAba] = useState('consultar')
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6 md:p-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-marca-texto">Idealize | Consulta de pedidos</p>
          <h1 className="mt-1 text-3xl font-extrabold">Consulta de Pedidos</h1>
          <p className="mt-1 text-apagado">Consulte rapidamente o status do seu pedido no laboratório.</p>
        </div>
        {gestor && (
          <div role="tablist" aria-label="Consulta de pedidos" className="flex gap-2">
            {[['consultar', 'Consultar'], ['painel', 'Painel']].map(([k, n]) => (
              <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
                className={cx('h-11 rounded-full px-4 text-sm font-semibold', aba === k ? 'bg-marca text-claro' : 'border border-linha bg-superficie text-apagado hover:bg-fundo')}>{n}</button>
            ))}
          </div>
        )}
      </div>
      {aba === 'painel' && gestor ? <Painel /> : <Consultar />}
    </div>
  )
}

function Consultar() {
  const [texto, setTexto] = useState('')
  const [erroCampo, setErroCampo] = useState(null)
  const [consulta, setConsulta] = useState(null) // linha do banco
  const [estado, setEstado] = useState('parado') // parado | enviando | aguardando | pronto | erro
  const [erro, setErro] = useState(null)
  const [inicio, setInicio] = useState(null)
  const [agora, setAgora] = useState(Date.now())
  const [historico, setHistorico] = useState(null)
  const vez = useRef(0) // cancela acompanhamentos antigos
  const campo = useRef(null)

  const carregarHistorico = useCallback(async () => {
    const { data } = await supabase.rpc('consulta_pedido_historico', { p_todos: false, p_dias: 7, p_limite: 8 })
    setHistorico(data || [])
  }, [])
  useEffect(() => { carregarHistorico() }, [carregarHistorico])
  useEffect(() => () => { vez.current++ }, [])

  // relógio enquanto espera
  useEffect(() => {
    if (estado !== 'aguardando') return
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [estado])

  const acompanhar = useCallback(async (id, minha) => {
    const comeco = Date.now()
    let espera = 2500
    while (vez.current === minha) {
      await new Promise((r) => setTimeout(r, espera))
      if (vez.current !== minha) return
      espera = Math.min(espera + 500, 4000)
      const { data, error } = await supabase.rpc('consulta_pedido_ver', { p_id: id })
      if (vez.current !== minha) return
      if (error) {
        if (Date.now() - comeco > LIMITE_ESPERA_MS) { setErro(MSG_ERRO); setEstado('erro'); return }
        continue // falha passageira de internet: tenta de novo
      }
      const c = data?.[0]
      if (!c) { setErro(MSG_ERRO); setEstado('erro'); return }
      setConsulta(c)
      if (['encontrado', 'nao_localizado', 'erro'].includes(c.situacao)) {
        setEstado(c.situacao === 'erro' ? 'erro' : 'pronto')
        if (c.situacao === 'erro') setErro(MSG_ERRO)
        carregarHistorico()
        return
      }
      if (Date.now() - comeco > LIMITE_ESPERA_MS) { setErro(MSG_ERRO); setEstado('erro'); return }
    }
  }, [carregarHistorico])

  const consultar = async (numeroTexto) => {
    const alvo = identificarPedido(numeroTexto ?? texto)
    if (!alvo) {
      setErroCampo('Use o número do pedido no laboratório. Braslab: só números (ex.: 115945581). Haytek: SP2277-… ou SP3485-…')
      campo.current?.focus()
      return
    }
    if (estado === 'enviando' || estado === 'aguardando') return // evita consulta duplicada
    setTexto(alvo.numero)
    setErroCampo(null); setErro(null); setConsulta(null)
    setEstado('enviando')
    const minha = ++vez.current
    try {
      const r = await chamarFuncao('consulta-pedido', { numero: alvo.numero })
      if (vez.current !== minha) return
      setConsulta({ id: r.id, numero: r.numero, laboratorio: r.laboratorio, empresa: alvo.empresa, situacao: 'na_fila' })
      setInicio(Date.now()); setAgora(Date.now())
      setEstado('aguardando')
      acompanhar(r.id, minha)
    } catch (e) {
      if (vez.current !== minha) return
      const m = mensagemErro(e)
      setErro(/Número inválido|acesso|Muitas consultas/i.test(m) ? m : MSG_ERRO)
      setEstado('erro')
      carregarHistorico()
    }
  }

  const ocupado = estado === 'enviando' || estado === 'aguardando'
  const segundos = inicio ? Math.max(0, Math.round((agora - inicio) / 1000)) : 0

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={(e) => { e.preventDefault(); consultar() }} className="flex flex-col gap-3 rounded-xl border border-linha bg-superficie p-4 sm:p-6" noValidate>
        <label htmlFor="numero-pedido" className="text-sm font-semibold">Número do pedido</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-apagado" aria-hidden />
            <input id="numero-pedido" ref={campo} value={texto} autoFocus autoComplete="off" spellCheck={false}
              inputMode="text" maxLength={30} placeholder="115945581 ou SP3485-061126-63"
              onChange={(e) => { setTexto(e.target.value.toUpperCase()); if (erroCampo) setErroCampo(null) }}
              aria-invalid={!!erroCampo} aria-describedby={erroCampo ? 'erro-numero' : 'dica-numero'}
              className={cx('h-14 w-full rounded-lg border bg-superficie pl-11 pr-3 font-mono text-lg tracking-wide text-tinta placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-apagado/70',
                erroCampo ? 'border-perigo' : 'border-linha')} />
          </div>
          <Botao type="submit" carregando={ocupado} className="h-14 px-6 text-base tracking-wide">CONSULTAR PEDIDO</Botao>
        </div>
        {erroCampo
          ? <p id="erro-numero" className="text-sm text-perigo">{erroCampo}</p>
          : <p id="dica-numero" className="text-sm text-apagado">O sistema descobre sozinho se o pedido é da Braslab ou da Haytek.</p>}
      </form>

      <div aria-live="polite">
        {ocupado && <Aguardando consulta={consulta} segundos={segundos} enviando={estado === 'enviando'} />}
        {estado === 'pronto' && consulta && <Resultado c={consulta} aoRepetir={() => consultar(consulta.numero)} />}
        {estado === 'erro' && (
          <div className="flex flex-col gap-4 rounded-xl border border-perigo/30 bg-perigo-suave p-5 sm:p-6" role="alert">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-perigo" aria-hidden />
              <div>
                <p className="text-lg font-bold text-perigo">{erro || MSG_ERRO}</p>
                {consulta?.erro && <p className="mt-1 text-sm text-tinta">{consulta.erro}</p>}
              </div>
            </div>
            {consulta?.numero && <Botao variante="secundario" onClick={() => consultar(consulta.numero)} className="self-start"><RefreshCw className="h-4 w-4" aria-hidden />Tentar de novo</Botao>}
          </div>
        )}
      </div>

      <Historico itens={historico} aoConsultar={(n) => { setTexto(n); consultar(n) }} ocupado={ocupado} />
    </div>
  )
}

function Aguardando({ consulta, segundos, enviando }) {
  const fila = !enviando && consulta?.situacao === 'na_fila'
  const etapas = [
    { nome: 'Consulta registrada', feito: !enviando },
    { nome: 'Robô entrando no laboratório', feito: !enviando && !fila, atual: fila },
    { nome: 'Lendo o status do pedido', feito: false, atual: !enviando && !fila },
  ]
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-linha bg-superficie p-5 sm:p-6" role="status">
      <div className="flex items-center gap-3">
        <Loader2 className="h-7 w-7 shrink-0 animate-spin text-marca-texto" aria-hidden />
        <div>
          <p className="text-lg font-bold">Consultando {consulta?.numero || 'o pedido'}{consulta?.laboratorio ? ` na ${nomeLaboratorio(consulta.laboratorio, consulta.empresa)}` : ''}…</p>
          <p className="text-sm text-apagado">Pode levar até 2 minutos quando o robô está desligado. Não precisa ficar nesta tela.</p>
        </div>
      </div>
      <ol className="flex flex-col gap-2">
        {etapas.map((e) => (
          <li key={e.nome} className="flex items-center gap-2 text-sm">
            {e.feito ? <CheckCircle2 className="h-5 w-5 text-ok" aria-hidden /> : e.atual ? <Loader2 className="h-5 w-5 animate-spin text-marca-texto" aria-hidden /> : <Circle className="h-5 w-5 text-linha" aria-hidden />}
            <span className={cx(e.feito || e.atual ? 'text-tinta' : 'text-apagado', e.atual && 'font-semibold')}>{e.nome}</span>
          </li>
        ))}
      </ol>
      <p className="flex items-center gap-1 text-xs text-apagado"><Clock className="h-3.5 w-3.5" aria-hidden />{segundos}s</p>
    </div>
  )
}

const CORES = {
  concluido: { caixa: 'border-ok/30 bg-[#EAF5EE]', texto: 'text-ok', Icone: CheckCircle2 },
  andamento: { caixa: 'border-marca/30 bg-marca-suave', texto: 'text-marca-texto', Icone: CircleDot },
  problema: { caixa: 'border-perigo/30 bg-perigo-suave', texto: 'text-perigo', Icone: AlertTriangle },
}

function Resultado({ c, aoRepetir }) {
  if (c.situacao === 'nao_localizado') {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-aviso/30 bg-[#FDF3E7] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <SearchX className="mt-0.5 h-7 w-7 shrink-0 text-aviso" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-apagado">Pedido {c.numero} · {nomeLaboratorio(c.laboratorio, c.empresa)}</p>
            <p className="mt-1 text-xl font-extrabold text-aviso">{MSG_NAO_LOCALIZADO}</p>
            <p className="mt-2 text-xs text-apagado">Consultado no laboratório às {hora(c.concluido_em)}</p>
          </div>
        </div>
      </div>
    )
  }
  const r = resumoStatus(c)
  if (!r) return null
  const cor = CORES[r.tipo] || CORES.andamento
  return (
    <div className={cx('flex flex-col gap-5 rounded-xl border p-5 sm:p-6', cor.caixa)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-base font-bold">Pedido {c.numero}</p>
        <span className="rounded-full border border-linha bg-superficie px-3 py-1 text-xs font-semibold text-apagado">{nomeLaboratorio(c.laboratorio, c.empresa)}</span>
      </div>
      <div className="flex items-start gap-3">
        <cor.Icone className={cx('mt-1 h-9 w-9 shrink-0', cor.texto)} aria-hidden />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-apagado">Status atual</p>
          <p className={cx('font-display text-3xl font-extrabold leading-tight sm:text-4xl', cor.texto)}>{r.titulo}</p>
          {r.detalhe && <p className="mt-1 text-sm text-tinta">{r.detalhe}</p>}
        </div>
      </div>
      {Array.isArray(c.etapas) && c.etapas.length > 0 && <Etapas etapas={c.etapas} />}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-4">
        <div className="text-xs text-apagado">
          <p>Consultado direto no laboratório às <strong className="text-tinta">{hora(c.concluido_em)}</strong> de {dataHora(c.concluido_em).split(',')[0]}</p>
          <p className="mt-0.5">Como aparece no laboratório: <span className="font-mono">{c.status_portal}</span></p>
        </div>
        <Botao variante="secundario" onClick={aoRepetir}><RefreshCw className="h-4 w-4" aria-hidden />Atualizar</Botao>
      </div>
    </div>
  )
}

function Etapas({ etapas }) {
  return (
    <ol aria-label="Etapas no laboratório" className="flex flex-col gap-0">
      {etapas.map((e, i) => {
        const ultimo = i === etapas.length - 1
        return (
          <li key={`${e.nome}-${i}`} className="relative flex items-start gap-3 pb-3 last:pb-0">
            {!ultimo && <span aria-hidden className={cx('absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5', e.concluida ? 'bg-ok' : 'bg-linha')} />}
            {e.concluida
              ? <CheckCircle2 className="relative h-6 w-6 shrink-0 rounded-full bg-superficie text-ok" aria-hidden />
              : e.atual
                ? <CircleDot className="relative h-6 w-6 shrink-0 rounded-full bg-superficie text-marca-texto" aria-hidden />
                : <Circle className="relative h-6 w-6 shrink-0 rounded-full bg-superficie text-linha" aria-hidden />}
            <span className={cx('pt-0.5 text-sm', e.atual ? 'font-bold text-tinta' : e.concluida ? 'text-tinta' : 'text-apagado')}>
              {nomeEtapa(e.nome)}
              <span className="sr-only">{e.concluida ? ' (concluída)' : e.atual ? ' (etapa atual)' : ' (a fazer)'}</span>
              {e.atual && !e.concluida && <span className="ml-2 rounded-full bg-marca px-2 py-0.5 text-xs font-semibold text-claro">agora</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const ROTULO = { na_fila: 'Na fila', consultando: 'Consultando', encontrado: null, nao_localizado: 'Não localizado', erro: 'Falhou' }

function Historico({ itens, aoConsultar, ocupado }) {
  if (!itens || itens.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">Suas últimas consultas</h2>
      <p className="-mt-2 text-sm text-apagado">Status de quando você consultou. Para saber o de agora, consulte de novo.</p>
      <ul className="divide-y divide-linha rounded-xl border border-linha bg-superficie">
        {itens.map((c) => {
          const r = resumoStatus(c)
          return (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-bold">{c.numero}</p>
                <p className={cx('text-sm font-semibold', c.situacao === 'erro' ? 'text-perigo' : c.situacao === 'nao_localizado' ? 'text-aviso' : 'text-tinta')}>{r ? r.titulo : ROTULO[c.situacao]}</p>
                <p className="truncate text-xs text-apagado">{nomeLaboratorio(c.laboratorio, c.empresa)} · consultado em {dataHora(c.criado_em)}</p>
              </div>
              <Botao variante="fantasma" disabled={ocupado} onClick={() => aoConsultar(c.numero)} className="shrink-0 px-3">Consultar</Botao>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ===== Painel da diretoria =====
function Painel() {
  const [p, setP] = useState(null)
  const [hist, setHist] = useState(null)
  const [dias, setDias] = useState(7)
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState(null)
  const carregar = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.rpc('consulta_pedido_painel', { p_dias: 30 }),
      supabase.rpc('consulta_pedido_historico', { p_todos: true, p_dias: dias, p_limite: 500 }),
    ])
    if (a.error || b.error) { setErro(mensagemErro(a.error || b.error)); return }
    setErro(null); setP(a.data); setHist(b.data || [])
  }, [dias])
  useEffect(() => { carregar() }, [carregar])

  if (erro && !p) return <Aviso>{erro}</Aviso>
  if (!p) return <Carregando />
  const t = p.totais || {}
  const ligado = p.robo_visto && Date.now() - new Date(p.robo_visto).getTime() < 60000
  const termo = busca.trim().toUpperCase()
  const filtrado = (hist || []).filter((c) => !termo || c.numero.includes(termo) || (c.usuario_nome || '').toUpperCase().includes(termo) || (c.loja || '').toUpperCase().includes(termo))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-linha bg-superficie p-4">
        <div className="flex items-center gap-3">
          <Bot className={cx('h-6 w-6', ligado ? 'text-ok' : 'text-apagado')} aria-hidden />
          <div>
            <p className="font-bold">{ligado ? 'Robô ligado agora' : 'Robô desligado'}</p>
            <p className="text-sm text-apagado">{ligado ? 'Novas consultas respondem em segundos.' : 'Ele liga sozinho na próxima consulta (leva até 2 minutos).'}</p>
          </div>
        </div>
        <Botao variante="secundario" onClick={carregar}><RefreshCw className="h-4 w-4" aria-hidden />Atualizar</Botao>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">Últimos 30 dias</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Consultas', t.total], ['Encontrados', t.encontrado], ['Não localizados', t.nao_localizado], ['Falhas', t.erro]].map(([n, v]) => (
            <div key={n} className="rounded-lg bg-superficie p-4 ring-1 ring-linha">
              <p className="text-sm text-apagado">{n}</p>
              <p className={cx('text-2xl font-extrabold', n === 'Falhas' && v > 0 && 'text-perigo')}>{v ?? 0}</p>
            </div>
          ))}
        </div>
        {t.tempo_medio_s != null && <p className="mt-2 text-sm text-apagado">Tempo médio até a resposta: {t.tempo_medio_s}s</p>}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Conexão com os laboratórios</h2>
        {(p.por_laboratorio || []).length === 0 && <p className="text-sm text-apagado">Nenhuma consulta ainda.</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(p.por_laboratorio || []).map((l) => {
            const problema = l.ultima_falha && (!l.ultimo_sucesso || new Date(l.ultima_falha) > new Date(l.ultimo_sucesso))
            return (
              <div key={l.laboratorio} className={cx('rounded-xl border p-4', problema ? 'border-perigo/30 bg-perigo-suave' : 'border-linha bg-superficie')}>
                <p className="font-bold">{nomeLaboratorio(l.laboratorio)}</p>
                <p className={cx('text-sm', problema ? 'text-perigo' : 'text-ok')}>{problema ? 'A última consulta falhou' : 'Funcionando'}</p>
                <p className="mt-2 text-xs text-apagado">Último sucesso: {l.ultimo_sucesso ? dataHora(l.ultimo_sucesso) : '—'}</p>
                <p className="text-xs text-apagado">Falhas: {l.falhas} de {l.total}</p>
              </div>
            )
          })}
        </div>
      </section>

      {(p.falhas_recentes || []).length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Falhas dos últimos 7 dias</h2>
          <ul className="divide-y divide-linha rounded-xl border border-linha bg-superficie">
            {p.falhas_recentes.map((f, i) => (
              <li key={i} className="px-4 py-3 text-sm">
                <p><span className="font-mono font-bold">{f.numero}</span> · {nomeLaboratorio(f.laboratorio)} · {dataHora(f.criado_em)}</p>
                <p className="text-apagado">{f.erro} — {f.nome}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Consultas por colaboradora (30 dias)</h2>
        {(p.por_pessoa || []).length === 0 ? <p className="text-sm text-apagado">Nenhuma consulta ainda.</p> : (
          <ul className="divide-y divide-linha rounded-xl border border-linha bg-superficie">
            {p.por_pessoa.map((x) => (
              <li key={x.nome} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0"><span className="block truncate font-semibold">{x.nome}</span>{x.loja && <span className="block truncate text-xs text-apagado">{x.loja}</span>}</span>
                <span className="shrink-0 text-right"><span className="block font-bold">{x.total}</span><span className="block text-xs text-apagado">última {dataHora(x.ultima)}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Histórico de consultas</h2>
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Período"
            className="h-11 rounded-lg border border-linha bg-superficie px-3 text-sm">
            <option value={1}>Hoje e ontem</option><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option>
          </select>
        </div>
        <label className="relative">
          <span className="sr-only">Buscar no histórico</span>
          <PackageSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-apagado" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Número, pessoa ou loja"
            className="h-11 w-full rounded-lg border border-linha bg-superficie pl-9 pr-3 text-sm" />
        </label>
        {filtrado.length === 0 ? <p className="text-sm text-apagado">Nenhuma consulta no período.</p> : (
          <ul className="divide-y divide-linha rounded-xl border border-linha bg-superficie">
            {filtrado.map((c) => {
              const r = resumoStatus(c)
              return (
                <li key={c.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span className="min-w-0">
                    <span className="block truncate"><span className="font-mono font-bold">{c.numero}</span> · {nomeLaboratorio(c.laboratorio, c.empresa)}</span>
                    <span className="block truncate text-xs text-apagado">{c.usuario_nome}{c.loja ? ` · ${c.loja}` : ''} · {dataHora(c.criado_em)}</span>
                  </span>
                  <span className={cx('shrink-0 text-sm font-semibold', c.situacao === 'erro' ? 'text-perigo' : c.situacao === 'nao_localizado' ? 'text-aviso' : 'text-tinta')}>
                    {r ? r.titulo : ROTULO[c.situacao]}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
