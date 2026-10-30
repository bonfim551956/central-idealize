import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { DefinirSenha, Login, RecuperarSenha, Verificacao } from './pages/Acesso'
import { Shell } from './Shell'
import { Carregando } from './ui'

function Protegida() {
  const { carregando, sessao, mfa } = useAuth()
  if (carregando) return <Carregando texto="Abrindo o Central…" />
  if (!sessao) return <Navigate to="/login" replace />
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
