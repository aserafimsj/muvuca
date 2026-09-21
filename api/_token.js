/* A senha da varredura, num lugar só.
 *
 * As duas funções de /api/manha usam a mesma checagem. Copiar o código para
 * as duas faria uma delas ficar para trás numa correção — e a que ficasse
 * para trás seria uma porta aberta para o banco, porque essas funções falam
 * com o Supabase pela chave de serviço, que passa por cima do RLS.
 */

// Compara em tempo constante. Comparar com === vaza o tamanho do prefixo
// certo pelo tempo de resposta; é pouco, mas é de graça evitar.
function tokenConfere(recebido, esperado) {
  if (!recebido || !esperado || recebido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < recebido.length; i++) dif |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}

/* Devolve { ok, motivo }. O motivo é para o log e para a tela de quem
 * configura — nunca revela nada sobre o token esperado. */
function autorizado(req) {
  const esperado = process.env.MANHA_TOKEN;
  if (!esperado) return { ok: false, motivo: 'MANHA_TOKEN não configurada na hospedagem' };
  const cab = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const m = String(cab).match(/^Bearer\s+(.+)$/i);
  if (!m) return { ok: false, motivo: 'falta o cabeçalho Authorization: Bearer <token>' };
  if (!tokenConfere(m[1].trim(), esperado)) return { ok: false, motivo: 'token inválido' };
  return { ok: true };
}

module.exports = { autorizado, tokenConfere };
