// Consulta de Pedidos: regras de tela (sem React), testadas em pedidos.test.js.

// Mesma regra do banco e do robô: o número diz o laboratório.
export function identificarPedido(texto) {
  const n = String(texto || '').replace(/\s/g, '').toUpperCase()
  if (/^\d{6,12}$/.test(n)) return { numero: n, laboratorio: 'braslab', empresa: null }
  const h = n.match(/^(SP2277|SP3485)-\d{6}-\d{1,6}$/)
  if (h) return { numero: n, laboratorio: 'haytek', empresa: h[1] }
  return null
}

const EMPRESAS = { SP2277: 'Sorocaba', SP3485: 'São Vicente' }
export function nomeLaboratorio(lab, empresa) {
  if (lab === 'braslab') return 'Braslab'
  if (lab === 'haytek') return EMPRESAS[empresa] ? `Haytek · ${EMPRESAS[empresa]}` : 'Haytek'
  return lab || ''
}

// Nome da etapa da Braslab em texto legível, sem mudar o sentido. Desconhecida: só arruma maiúsculas.
const ETAPAS = {
  'PEDIDO REALIZADO': 'Pedido realizado',
  'EM APROVAÇÃO': 'Em aprovação',
  'ESTOQUE LT PRONTA': 'Estoque (lente pronta)',
  'ESTOQUE BLOCO': 'Estoque (bloco)',
  SURFACAGEM: 'Surfaçagem',
  'AR COATING': 'AR coating (antirreflexo)',
  'TRATAMENTO TERCEIROS': 'Tratamento em terceiros',
  EMBALAGEM: 'Embalagem',
  EXPEDICAO: 'Expedição',
  NFE: 'Nota fiscal',
}
export function nomeEtapa(nome) {
  const limpo = String(nome || '').replace(/\s+/g, ' ').trim().toUpperCase().replace(/\d+$/, '').trim()
  if (ETAPAS[limpo]) return ETAPAS[limpo]
  if (!limpo) return ''
  return limpo.charAt(0) + limpo.slice(1).toLowerCase()
}

// Status da Haytek como aparece na lista → texto legível + tipo (cor). Desconhecido: mostra o do portal.
const HAYTEK = {
  'danfe emit.': ['Nota fiscal emitida', 'andamento'],
  entregue: ['Entregue', 'concluido'],
  cancelado: ['Cancelado', 'problema'],
}

// Resultado de uma consulta → o que a tela mostra em destaque.
// tipo: concluido (verde) | andamento (azul) | problema (vermelho)
export function resumoStatus(c) {
  if (!c || c.situacao !== 'encontrado' || !c.status_portal) return null
  if (c.laboratorio === 'braslab' && Array.isArray(c.etapas) && c.etapas.length) {
    const atual = c.etapas.find((e) => e.atual) || c.etapas[c.etapas.length - 1]
    const todas = c.etapas.every((e) => e.concluida)
    const nome = nomeEtapa(atual.nome)
    if (todas) {
      const final = /^NFE$/i.test(String(atual.nome).trim())
      return { titulo: final ? 'Nota fiscal emitida' : `${nome} concluída`, detalhe: 'Todas as etapas do laboratório foram concluídas.', tipo: 'concluido' }
    }
    return { titulo: nome, detalhe: 'Etapa atual no laboratório.', tipo: 'andamento' }
  }
  const bruto = String(c.status_portal).trim()
  const m = HAYTEK[bruto.toLowerCase()]
  if (m) return { titulo: m[0], detalhe: null, tipo: m[1] }
  return { titulo: bruto.charAt(0).toUpperCase() + bruto.slice(1), detalhe: null, tipo: 'andamento' }
}

export function dataHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}
export function hora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' })
}

export const MSG_ERRO = 'Não foi possível consultar o pedido neste momento. Tente novamente.'
export const MSG_NAO_LOCALIZADO = 'Pedido não localizado. Verifique o número informado.'
