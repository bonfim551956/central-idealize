import { Loader2 } from 'lucide-react'

export const cx = (...c) => c.filter(Boolean).join(' ')

export function Botao({ variante = 'primario', carregando, className, children, ...p }) {
  const estilos = {
    primario: 'bg-marca text-superficie hover:bg-marca-escura',
    secundario: 'border border-linha bg-superficie text-tinta hover:bg-fundo',
    perigo: 'border border-perigo/30 bg-superficie text-perigo hover:bg-perigo-suave',
    fantasma: 'text-marca hover:bg-marca-suave',
  }
  return (
    <button
      type="button"
      {...p}
      disabled={p.disabled || carregando}
      className={cx('inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50', estilos[variante], className)}
    >
      {carregando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function Campo({ rotulo, dica, erro, id, ...p }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm font-semibold">
      {rotulo}
      <input
        id={id}
        {...p}
        aria-invalid={!!erro}
        className={cx('h-12 rounded-lg border bg-superficie px-3 text-base font-normal text-tinta placeholder:text-apagado/70', erro ? 'border-perigo' : 'border-linha')}
      />
      {dica && !erro && <span className="text-xs font-normal text-apagado">{dica}</span>}
      {erro && <span className="text-xs font-normal text-perigo">{erro}</span>}
    </label>
  )
}

export function Aviso({ tipo = 'erro', children }) {
  const estilos = { erro: 'bg-perigo-suave text-perigo', ok: 'bg-marca-suave text-marca', info: 'bg-fundo text-apagado' }
  return <p role={tipo === 'erro' ? 'alert' : 'status'} className={cx('rounded-lg px-3 py-2 text-sm', estilos[tipo])}>{children}</p>
}

export function Carregando({ texto = 'Carregando…' }) {
  return (
    <div className="grid h-full min-h-[50vh] place-items-center" role="status">
      <span className="flex items-center gap-2 text-apagado"><Loader2 className="h-5 w-5 animate-spin text-marca" aria-hidden />{texto}</span>
    </div>
  )
}
