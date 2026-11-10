import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { DefinirSenha, Login, RecuperarSenha, Verificacao } from './pages/Acesso'
import { Shell } from './Shell'
import { Carregando } from './ui'

// Quem chega por um sistema (ex.: /s/pdv) e ainda não entrou volta para ele depois do login
export const CHAVE_DESTINO = 'central.destino'
function guardarDestino(caminho) {
  try { if (caminho.startsWith('/s/')) sessionStorage.setItem(CHAVE_DESTINO, caminho) } catch { /* ok */ }
}

function Protegida() {
  const { carregando, sessao, mfa } = useAuth()
  const local = useLocation()
  if (carregando) return <Carregando texto="Abrindo o Central…" />
  if (!sessao) { guardarDestino(local.pathname); return <Navigate to="/login" replace /> }
  if (mfa !== 'ok') return <Navigate to="/verificacao" replace />
  return <Shell />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/recuperar-senha" element={<RecuperarSenha />} />
      <Route path="/definir-senha" element={<DefinirSenha />} />
      <Route path="/verificacao" element={<Verificacao />} />
      <Route path="/*" element={<Protegida />} />
    </Routes>
  )
}
