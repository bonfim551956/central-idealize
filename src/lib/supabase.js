import { createClient } from '@supabase/supabase-js'

// Central Idealize usa o login do projeto do Idealize RH (chave pública)
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ifqaukdkurkirmahpuky.supabase.co'
const CHAVE = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_K0XKMUMbZoWD1nP54G8tpA_b3fm5ZUr'

export const supabase = createClient(SUPABASE_URL, CHAVE, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'central-idealize-sessao' },
})

export async function chamarFuncao(nome, corpo) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sessão expirada. Entre novamente.')
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${nome}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: CHAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  let dados = null
  try { dados = await r.json() } catch { /* sem corpo */ }
  if (!r.ok) throw new Error(dados?.erro || `Erro ${r.status}`)
  return dados
}

export function mensagemErro(e) {
  if (!e) return 'Algo deu errado. Tente de novo.'
  const m = e.message || String(e)
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.'
  if (/Email not confirmed/i.test(m)) return 'Seu acesso ainda não foi ativado. Use o link do convite no seu e-mail.'
  if (/rate limit|too many|seconds/i.test(m)) return 'Muitas tentativas agora. Aguarde alguns minutos e tente de novo.'
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet.'
  if (/Invalid TOTP|invalid.*code|expired/i.test(m)) return 'Código inválido ou vencido. Confira no aplicativo e tente de novo.'
  if (/permission denied|42501|Sem permissão/i.test(m)) return m.includes('Sem permissão') ? m : 'Você não tem permissão para esta ação.'
  return m
}
