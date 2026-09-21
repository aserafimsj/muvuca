/* Falar com o Supabase a partir do SERVIDOR, sem biblioteca.
 *
 * O navegador usa o SDK do Supabase, carregado por CDN. Aqui não dá: o MUVUCA
 * não tem package.json, e criar um faria a Vercel achar que o projeto precisa
 * de build. Então usamos a API REST do próprio Supabase (PostgREST) com o
 * fetch que já existe no Node. Mesma coisa, zero dependência.
 *
 * A chave usada aqui é a de serviço (service_role). Ela passa por cima do RLS
 * e NUNCA pode chegar ao navegador — por isso vive em variável de ambiente e
 * só é lida dentro de /api, que roda no servidor.
 */

const URL_BASE = process.env.SUPABASE_URL || 'https://fkhbjpyoajkadpfjexkb.supabase.co';
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function configurado() {
  return !!CHAVE;
}

function cabecalhos(extras) {
  return {
    apikey: CHAVE,
    Authorization: `Bearer ${CHAVE}`,
    'Content-Type': 'application/json',
    ...extras,
  };
}

async function responder(r) {
  const texto = await r.text();
  let corpo = null;
  try { corpo = texto ? JSON.parse(texto) : null; } catch (e) { corpo = texto; }
  if (!r.ok) {
    // A mensagem do PostgREST costuma ser útil ("column X does not exist").
    const msg = (corpo && (corpo.message || corpo.hint)) || `HTTP ${r.status}`;
    const erro = new Error(msg);
    erro.status = r.status;
    throw erro;
  }
  return corpo;
}

/* Busca linhas. `filtros` é um objeto de parâmetros do PostgREST, por exemplo
 * { cliente_id: 'eq.1', status: 'eq.pendente' }. */
async function buscar(tabela, filtros = {}, opcoes = {}) {
  const q = new URLSearchParams({ select: opcoes.select || '*', ...filtros });
  if (opcoes.order) q.set('order', opcoes.order);
  if (opcoes.limit) q.set('limit', String(opcoes.limit));
  const r = await fetch(`${URL_BASE}/rest/v1/${tabela}?${q}`, { headers: cabecalhos() });
  return (await responder(r)) || [];
}

/* Insere linhas e devolve o que foi gravado. */
async function inserir(tabela, linhas) {
  const lista = Array.isArray(linhas) ? linhas : [linhas];
  if (!lista.length) return [];
  const r = await fetch(`${URL_BASE}/rest/v1/${tabela}`, {
    method: 'POST',
    headers: cabecalhos({ Prefer: 'return=representation' }),
    body: JSON.stringify(lista),
  });
  return (await responder(r)) || [];
}

module.exports = { buscar, inserir, configurado, URL_BASE };
