// Tema do Central (claro/escuro), guardado neste aparelho. Sem escolha, segue o aparelho.
const CHAVE = 'central.tema'
export function lerTema() {
  try { const t = localStorage.getItem(CHAVE); if (t === 'claro' || t === 'escuro') return t } catch { /* ok */ }
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro' } catch { return 'claro' }
}
export function aplicarTema(t) {
  document.documentElement.dataset.tema = t
  try { localStorage.setItem(CHAVE, t) } catch { /* ok */ }
}
