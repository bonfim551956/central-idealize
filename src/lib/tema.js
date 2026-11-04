// Tema da barra lateral do Central (claro/escuro), guardado neste aparelho. Sem escolha: escura, como sempre foi.
const CHAVE = 'central.tema'
export function lerTema() {
  try { const t = localStorage.getItem(CHAVE); if (t === 'claro' || t === 'escuro') return t } catch { /* ok */ }
  return 'escuro'
}
export function aplicarTema(t) {
  document.documentElement.dataset.tema = t
  try { localStorage.setItem(CHAVE, t) } catch { /* ok */ }
}
