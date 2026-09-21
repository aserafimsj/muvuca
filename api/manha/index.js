/* Leitura da tela Manhã, para a VARREDURA — não para o navegador.
 *
 * A tela Manhã lê direto do Supabase com a chave anon, protegida por login e
 * RLS, como o resto do MUVUCA. Esta função existe para o agente de varredura
 * conferir o que já entrou antes de mandar mais.
 *
 * Por isso ela pede o mesmo token do ingest. Ela fala com o banco pela chave
 * de serviço, que passa por cima do RLS: sem token, qualquer pessoa que
 * adivinhasse o endereço leria os comentários, as DMs e os rascunhos de um
 * cliente inteiro. Ler é tão sensível quanto gravar.
 *
 * Só lê. Não envia nada, não altera nada. A mudança de status ("respondido",
 * "ignorado") é feita pelo navegador — aqui não entra escrita para não abrir
 * um caminho de gravação sem autenticação de usuário.
 */

const banco = require('../_banco.js');
const { autorizado } = require('../_token.js');

const VERSAO = '2026-09-21-a';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

  const aut = autorizado(req);
  if (!aut.ok) return res.status(401).json({ error: 'Não autorizado: ' + aut.motivo });

  if (!banco.configurado()) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada na hospedagem.' });
  }

  const q = req.query || {};
  const clienteId = Number(q.clienteId);
  if (!clienteId) return res.status(400).json({ error: 'Informe clienteId.' });

  const filtros = { cliente_id: `eq.${clienteId}` };

  // since=AAAA-MM-DD. Data inválida é recusada em vez de ignorada em silêncio:
  // ignorar devolveria o acervo inteiro sem ninguém perceber.
  if (q.since) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(q.since))) {
      return res.status(400).json({ error: 'since deve estar no formato AAAA-MM-DD.' });
    }
    filtros.created_at = `gte.${q.since}`;
  }
  if (q.source === 'feed' || q.source === 'dm') filtros.source = `eq.${q.source}`;
  if (q.status) filtros.status = `eq.${q.status}`;
  if (q.escalate === 'true') filtros.escalate = 'is.true';

  let itens;
  try {
    itens = await banco.buscar('manha_items', filtros, { order: 'created_at.desc', limit: 500 });
  } catch (e) {
    return res.status(500).json({ error: 'Falha ao consultar: ' + e.message });
  }

  const pendentes = itens.filter(i => i.status === 'pendente');
  return res.status(200).json({
    items: itens,
    resumo: {
      total: itens.length,
      feed: pendentes.filter(i => i.source === 'feed').length,
      dm: pendentes.filter(i => i.source === 'dm').length,
      escalar: pendentes.filter(i => i.escalate).length,
      pendentes: pendentes.length,
    },
    versao: VERSAO,
  });
};

module.exports.VERSAO = VERSAO;
