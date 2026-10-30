import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink, Mail, Plus, Search, X } from 'lucide-react'
import { supabase, chamarFuncao, mensagemErro } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Aviso, Botao, Campo, Carregando, cx } from '../ui'

const SITUACOES = { ativo: 'Ativo', em_breve: 'Em breve', oculto: 'Oculto' }

export function Acessos() {
  const { recarregar } = useAuth()
  const [aba, setAba] = useState('pessoas')
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState('')
  const [selId, setSelId] = useState(null)
  const [convidando, setConvidando] = useState(false)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('central_listar_acessos')
    if (error) { setErro(mensagemErro(error)); return }
    setErro(null)
    setDados(data)
  }, [])
  useEffect(() => { carregar() }, [carregar])

  const usuarios = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return (dados?.usuarios || []).filter((u) => !t || u.nome.toLowerCase().includes(t) || (u.email || '').includes(t))
  }, [dados, busca])
  const sel = dados?.usuarios.find((u) => u.id === selId) || null
  const nomeSistema = (k) => dados?.sistemas.find((s) => s.chave === k)?.nome || k

  if (erro && !dados) return <div className="p-6 md:p-12"><Aviso>{erro}</Aviso></div>
  if (!dados) return <Carregando />

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 md:p-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Gestão de acessos</h1>
          <p className="mt-1 text-apagado">Quem entra em qual sistema. O desligamento no RH retira todos os acessos.</p>
        </div>
        <div role="tablist" aria-label="Gestão" className="flex gap-2">
          {[['pessoas', 'Pessoas'], ['sistemas', 'Sistemas']].map(([k, n]) => (
            <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
              className={cx('h-11 rounded-full px-4 text-sm font-semibold', aba === k ? 'bg-marca text-superficie' : 'border border-linha bg-superficie text-apagado hover:bg-fundo')}>{n}</button>
          ))}
        </div>
      </div>

      {aba === 'sistemas' ? <Sistemas sistemas={dados.sistemas} aoSalvar={async () => { await carregar(); await recarregar() }} /> : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Buscar</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-apagado" aria-hidden />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome ou e-mail"
                className="h-11 w-full rounded-lg border border-linha bg-superficie pl-9 pr-3 text-sm" />
            </label>
            <Botao onClick={() => setConvidando(true)}><Plus className="h-4 w-4" aria-hidden />Convidar pessoa</Botao>
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
            <div className="overflow-x-auto rounded-xl border border-linha bg-superficie">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-[#E9F0F0] text-left text-xs font-bold uppercase tracking-[0.06em] text-apagado">
                  <tr><th className="px-4 py-3">Pessoa</th><th className="px-4 py-3">Sistemas</th><th className="px-4 py-3">Situação</th></tr>
                </thead>
                <tbody>
                  {usuarios.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-apagado">Ninguém encontrado.</td></tr>}
                  {usuarios.map((u) => (
                    <tr key={u.id} onClick={() => setSelId(u.id)} className={cx('cursor-pointer border-t border-linha hover:bg-fundo', selId === u.id && 'bg-marca-suave/60')}>
                      <td className="px-4 py-3"><b>{u.nome}</b><br /><span className="text-xs text-apagado">{u.email}</span></td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap gap-1">
                          {u.perfis_rh.length > 0 && <span className="rounded-md bg-marca-suave px-2 py-0.5 text-xs font-bold text-marca">RH</span>}
                          {u.acessos.map((a) => <span key={a.sistema} className="rounded-md bg-marca-suave px-2 py-0.5 text-xs font-bold text-marca">{nomeSistema(a.sistema)}</span>)}
                          {u.perfis_rh.length === 0 && u.acessos.length === 0 && <span className="text-xs text-apagado">Nenhum</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3"><Situacao u={u} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sel ? <Painel u={sel} sistemas={dados.sistemas} aoMudar={carregar} aoFechar={() => setSelId(null)} />
              : <div className="rounded-xl border border-dashed border-linha p-6 text-sm text-apagado">Escolha uma pessoa para liberar ou retirar sistemas.</div>}
          </div>
        </>
      )}
      {convidando && <Convidar aoFechar={() => setConvidando(false)} aoConvidar={async () => { setConvidando(false); await carregar() }} />}
    </div>
  )
}

function Situacao({ u }) {
  if (!u.ativo || !u.liberado) return <span className="font-semibold text-perigo">Bloqueado</span>
  if (u.convite_pendente) return <span className="font-semibold text-aviso">Convite enviado</span>
  return <span className="font-semibold text-ok">Ativo</span>
}

function Painel({ u, sistemas, aoMudar, aoFechar }) {
  const [msg, setMsg] = useState(null)
  const [reenviando, setReenviando] = useState(false)
  const rh = sistemas.find((s) => s.tipo_acesso === 'rh')
  const reenviar = async () => {
    setReenviando(true); setMsg(null)
    try { await chamarFuncao('central-convidar', { reenviar: true, usuario_id: u.id }); setMsg({ tipo: 'ok', texto: 'Convite reenviado.' }) }
    catch (e) { setMsg({ tipo: 'erro', texto: mensagemErro(e) }) }
    setReenviando(false)
  }
  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-linha bg-superficie p-6" aria-label={`Acessos de ${u.nome}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold">{u.nome}</h2>
          <p className="truncate text-xs text-apagado">{u.email}</p>
        </div>
        <button type="button" onClick={aoFechar} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-fundo"><X className="h-5 w-5" /></button>
      </div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      {(!u.ativo || !u.liberado) && <Aviso>Esta pessoa está bloqueada (desativada ou desligada no RH) e não entra em nenhum sistema.</Aviso>}
      {sistemas.filter((s) => (s.tipo_acesso === 'login' || s.tipo_acesso === 'livre') && s.situacao !== 'oculto').map((s) => (
        <LinhaSistema key={s.chave} u={u} s={s} acesso={u.acessos.find((a) => a.sistema === s.chave)} aoMudar={aoMudar} />
      ))}
      {rh && (
        <div className="flex flex-col gap-1 border-t border-linha pt-4">
          <b>{rh.nome}</b>
          <span className="text-sm text-apagado">
            {u.perfis_rh.length ? u.perfis_rh.map((p) => `${p.perfil}${p.loja ? ` · ${p.loja}` : ''}`).join(', ') : 'Sem perfil no RH'}
          </span>
          {rh.url && <a href={`${rh.url}/acessos`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-semibold text-marca hover:underline">Gerir perfis no RH <ExternalLink className="h-3 w-3" aria-hidden /></a>}
        </div>
      )}
      {u.convite_pendente && u.ativo && (
        <Botao variante="secundario" carregando={reenviando} onClick={reenviar}><Mail className="h-4 w-4" aria-hidden />Reenviar convite</Botao>
      )}
    </aside>
  )
}

function LinhaSistema({ u, s, acesso, aoMudar }) {
  const [conta, setConta] = useState(acesso?.conta || '')
  const [estado, setEstado] = useState(null)
  const [erro, setErro] = useState(null)
  useEffect(() => { setConta(acesso?.conta || ''); setErro(null) }, [acesso?.conta, u.id])
  const salvar = async () => {
    setErro(null); setEstado('salvando')
    const { error } = await supabase.rpc('central_conceder', { p_usuario: u.id, p_sistema: s.chave, p_conta: conta })
    setEstado(null)
    if (error) { setErro(mensagemErro(error)); return }
    await aoMudar()
  }
  const retirar = async () => {
    setErro(null); setEstado('retirando')
    const { error } = await supabase.rpc('central_revogar', { p_usuario: u.id, p_sistema: s.chave, p_motivo: null })
    setEstado(null)
    if (error) { setErro(mensagemErro(error)); return }
    setConta('')
    await aoMudar()
  }
  const mudou = (conta.trim().toUpperCase() !== (acesso?.conta || '').toUpperCase())
  if (s.tipo_acesso === 'livre') {
    return (
      <div className="flex flex-col gap-2 border-t border-linha pt-4">
        <div className="flex items-center justify-between gap-2">
          <b>{s.nome}</b>
          {s.situacao === 'em_breve' && <span className="rounded-md bg-fundo px-2 py-0.5 text-xs font-semibold text-apagado">Em breve</span>}
          {acesso && <span className="flex items-center gap-1 text-xs font-semibold text-ok"><Check className="h-3 w-3" aria-hidden />Liberado</span>}
        </div>
        <span className="text-xs text-apagado">Abre direto (sem login do Central). Se o sistema tiver login próprio, a pessoa usa o dela.</span>
        {erro && <Aviso>{erro}</Aviso>}
        {acesso
          ? <Botao variante="perigo" carregando={estado === 'retirando'} onClick={retirar}>Retirar do menu</Botao>
          : <Botao carregando={estado === 'salvando'} onClick={salvar}>Mostrar no menu</Botao>}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2 border-t border-linha pt-4">
      <div className="flex items-center justify-between gap-2">
        <b>{s.nome}</b>
        {s.situacao === 'em_breve' && <span className="rounded-md bg-fundo px-2 py-0.5 text-xs font-semibold text-apagado">Em breve</span>}
        {acesso && <span className="flex items-center gap-1 text-xs font-semibold text-ok"><Check className="h-3 w-3" aria-hidden />Liberado</span>}
      </div>
      <Campo id={`conta-${s.chave}`} rotulo={`Login da pessoa no ${s.nome}`} dica="O mesmo usuário que ela usa hoje neste sistema" value={conta}
        onChange={(e) => setConta(e.target.value)} erro={erro} />
      <div className="flex gap-2">
        <Botao className="flex-1" carregando={estado === 'salvando'} disabled={!conta.trim() || !mudou} onClick={salvar}>{acesso ? 'Trocar login' : 'Liberar'}</Botao>
        {acesso && <Botao variante="perigo" carregando={estado === 'retirando'} onClick={retirar}>Retirar</Botao>}
      </div>
    </div>
  )
}

function Convidar({ aoFechar, aoConvidar }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const enviar = async (e) => {
    e.preventDefault(); setErro(null)
    if (nome.trim().length < 2) { setErro('Informe o nome.'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErro('Informe um e-mail válido.'); return }
    setEnviando(true)
    try { await chamarFuncao('central-convidar', { nome: nome.trim(), email: email.trim().toLowerCase() }); await aoConvidar() }
    catch (er) { setErro(mensagemErro(er)); setEnviando(false) }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0F0F0F]/50 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-convite">
      <form onSubmit={enviar} className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-superficie p-6" noValidate>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="titulo-convite" className="text-2xl font-bold">Convidar pessoa</h2>
            <p className="mt-1 text-sm text-apagado">Ela recebe um e-mail para criar a senha. Depois você libera os sistemas.</p>
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-fundo"><X className="h-5 w-5" /></button>
        </div>
        {erro && <Aviso>{erro}</Aviso>}
        <Campo id="conv-nome" rotulo="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        <Campo id="conv-email" rotulo="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" carregando={enviando}>Enviar convite</Botao>
        </div>
      </form>
    </div>
  )
}

function Sistemas({ sistemas, aoSalvar }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <NovoSistema aoCriar={aoSalvar} />
      {sistemas.map((s) => <CartaoSistema key={s.chave} s={s} aoSalvar={aoSalvar} />)}
    </div>
  )
}

function CartaoSistema({ s, aoSalvar }) {
  const [f, setF] = useState({ nome: s.nome, descricao: s.descricao || '', url: s.url || '', ordem: s.ordem, situacao: s.situacao, abrir_em: s.abrir_em || 'central' })
  const [erro, setErro] = useState(null)
  const [ok, setOk] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const salvar = async () => {
    setErro(null); setOk(false)
    if (f.url && !/^https:\/\/\S+$/.test(f.url.trim())) { setErro('O endereço precisa começar com https://'); return }
    setSalvando(true)
    const { error } = await supabase.rpc('central_editar_sistema', {
      p_chave: s.chave, p_nome: f.nome, p_descricao: f.descricao, p_url: f.url.trim().replace(/\/+$/, ''), p_ordem: Number(f.ordem) || 0, p_situacao: f.situacao, p_abrir_em: f.abrir_em,
    })
    setSalvando(false)
    if (error) { setErro(mensagemErro(error)); return }
    setOk(true); await aoSalvar()
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-linha bg-superficie p-6">
      <div className="flex items-center gap-2"><span className="h-4 w-4 rounded" style={{ background: s.cor }} aria-hidden /><b>{s.nome}</b></div>
      {erro && <Aviso>{erro}</Aviso>}
      {ok && <Aviso tipo="ok">Salvo.</Aviso>}
      <Campo id={`n-${s.chave}`} rotulo="Nome no menu" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
      <Campo id={`d-${s.chave}`} rotulo="Descrição" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
      <Campo id={`u-${s.chave}`} rotulo="Endereço do sistema" placeholder="https://" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Campo id={`o-${s.chave}`} rotulo="Ordem no menu" type="number" value={f.ordem} onChange={(e) => setF({ ...f, ordem: e.target.value })} />
        <label className="flex flex-col gap-1 text-sm font-semibold">Situação
          <select value={f.situacao} onChange={(e) => setF({ ...f, situacao: e.target.value })} className="h-12 rounded-lg border border-linha bg-superficie px-3 text-base font-normal">
            {Object.entries(SITUACOES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-semibold">Como abre
        <select value={f.abrir_em} onChange={(e) => setF({ ...f, abrir_em: e.target.value })} className="h-12 rounded-lg border border-linha bg-superficie px-3 text-base font-normal">
          <option value="central">Dentro do Central</option>
          <option value="nova_aba">Em nova aba (para sites que não abrem dentro do Central)</option>
        </select>
      </label>
      <Botao carregando={salvando} onClick={salvar} className="self-end">Salvar</Botao>
    </div>
  )
}

const CORES = ['#0B6E71', '#2D5C88', '#7A4FA0', '#A3560F', '#1E7A3C', '#C2410C', '#B45309', '#4E6468']
const ICONES_NOVO = [['app', 'Geral'], ['grafico', 'Gráfico'], ['trofeu', 'Troféu'], ['estrela', 'Estrela'], ['calendario', 'Calendário'], ['pessoas', 'Pessoas'], ['alvo', 'Alvo'], ['carrinho', 'Carrinho']]

function NovoSistema({ aoCriar }) {
  const [aberto, setAberto] = useState(false)
  const [f, setF] = useState({ nome: '', descricao: '', url: '', cor: CORES[0], icone: 'app' })
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const chave = f.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30)
  const criar = async () => {
    setErro(null)
    if (chave.length < 2) { setErro('Informe o nome do sistema.'); return }
    if (f.url && !/^https:\/\/\S+$/.test(f.url.trim())) { setErro('O endereço precisa começar com https://'); return }
    setSalvando(true)
    const { error } = await supabase.rpc('central_novo_sistema', {
      p_chave: chave, p_nome: f.nome, p_descricao: f.descricao, p_url: f.url.trim().replace(/\/+$/, ''), p_cor: f.cor, p_icone: f.icone, p_tipo: 'livre', p_ordem: 99,
    })
    setSalvando(false)
    if (error) { setErro(mensagemErro(error)); return }
    setAberto(false); setF({ nome: '', descricao: '', url: '', cor: CORES[0], icone: 'app' }); await aoCriar()
  }
  if (!aberto) return <Botao variante="secundario" onClick={() => setAberto(true)} className="justify-self-start md:col-span-2"><Plus className="h-4 w-4" aria-hidden />Novo sistema</Botao>
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-marca bg-superficie p-6 md:col-span-2">
      <b>Novo sistema no menu</b>
      <p className="text-sm text-apagado">Sistemas novos abrem direto, sem o login do Central (se tiverem login próprio, a pessoa usa o dela). Depois de criar, libere para as pessoas na aba Pessoas.</p>
      {erro && <Aviso>{erro}</Aviso>}
      <div className="grid gap-3 md:grid-cols-2">
        <Campo id="novo-nome" rotulo="Nome no menu" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
        <Campo id="novo-url" rotulo="Endereço" placeholder="https://" dica="Sem endereço, fica como “Em breve”" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
        <Campo id="novo-desc" rotulo="Descrição" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
        <label className="flex flex-col gap-1 text-sm font-semibold">Ícone
          <select value={f.icone} onChange={(e) => setF({ ...f, icone: e.target.value })} className="h-12 rounded-lg border border-linha bg-superficie px-3 text-base font-normal">
            {ICONES_NOVO.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Cor">
        <span className="text-sm font-semibold">Cor</span>
        {CORES.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={f.cor === c} aria-label={c} onClick={() => setF({ ...f, cor: c })}
            className={cx('h-8 w-8 rounded-lg', f.cor === c && 'ring-2 ring-tinta ring-offset-2')} style={{ background: c }} />
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={() => setAberto(false)}>Cancelar</Botao>
        <Botao carregando={salvando} onClick={criar}>Criar</Botao>
      </div>
    </div>
  )
}
