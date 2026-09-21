/* Recebe as novidades coletadas pela varredura externa e guarda.
 *
 * O que esta função NÃO faz: enviar mensagem, responder comentário, responder
 * DM, tocar no Instagram. Ela só recebe, classifica, sugere e grava. Quem
 * responde é uma pessoa, na tela Manhã.
 *
 * Autenticação por token no cabeçalho. Sem token válido, 401 — nada roda e
 * nada é gravado, porque cada item custa uma chamada de IA.
 */

const { sugerir } = require('../suggestReply.js');
const banco = require('../_banco.js');
const { autorizado } = require('../_token.js');

const VERSAO = '2026-09-21-a';
const LOTE_MAXIMO = 60;   // trava de custo: cada item é uma chamada de IA

const texto = (v) => (v === null || v === undefined) ? null : String(v).trim() || null;

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      versao: VERSAO,
      token_configurado: !!process.env.MANHA_TOKEN,
      banco_configurado: banco.configurado(),
      chave_ia_configurada: !!process.env.ANTHROPIC_API_KEY,
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const aut = autorizado(req);
  if (!aut.ok) return res.status(401).json({ error: 'Não autorizado: ' + aut.motivo });

  if (!banco.configurado()) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada na hospedagem.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

  const itens = body && Array.isArray(body.items) ? body.items : null;
  if (!itens || !itens.length) return res.status(400).json({ error: 'Envie { items: [...] } com pelo menos um item.' });
  if (itens.length > LOTE_MAXIMO) {
    return res.status(400).json({ error: `Lote grande demais: ${itens.length}. O máximo por chamada é ${LOTE_MAXIMO}.` });
  }

  const clienteId = Number(body.clienteId);
  if (!clienteId) return res.status(400).json({ error: 'Envie clienteId no corpo.' });

  /* O token não é procuração para escrever em qualquer cliente: confere que o
   * cliente existe antes de gravar qualquer coisa. */
  let cliente;
  try {
    const achados = await banco.buscar('clientes', { id: `eq.${clienteId}` }, { select: 'id,nome', limit: 1 });
    cliente = achados[0];
  } catch (e) {
    return res.status(500).json({ error: 'Falha ao consultar o banco: ' + e.message });
  }
  if (!cliente) return res.status(400).json({ error: `Cliente ${clienteId} não existe.` });

  // Deduplicação por (source, externalId). Reenviar o mesmo lote não duplica
  // nada nem gasta IA de novo — a varredura pode repetir sem medo.
  const chaves = itens.map(i => texto(i.externalId)).filter(Boolean);
  let jaTem = new Set();
  if (chaves.length) {
    try {
      const existentes = await banco.buscar('manha_items', {
        cliente_id: `eq.${clienteId}`,
        external_id: `in.(${chaves.map(c => `"${String(c).replace(/"/g, '')}"`).join(',')})`,
      }, { select: 'source,external_id' });
      jaTem = new Set(existentes.map(e => e.source + '|' + e.external_id));
    } catch (e) {
      return res.status(500).json({ error: 'Falha ao verificar duplicados: ' + e.message });
    }
  }

  const novos = [];
  const pulados = [];
  for (const it of itens) {
    const source = (texto(it.source) || '').toLowerCase() === 'dm' ? 'dm' : 'feed';
    const externalId = texto(it.externalId);
    if (!externalId) { pulados.push('item sem externalId'); continue; }
    if (jaTem.has(source + '|' + externalId)) continue;
    jaTem.add(source + '|' + externalId);   // protege contra repetido dentro do MESMO lote
    novos.push({ ...it, source, externalId });
  }

  const gravar = [];
  for (const it of novos) {
    const s = await sugerir({
      source: it.source,
      author: texto(it.author),
      text: texto(it.text),
      url: texto(it.url),
      context: texto(it.context),
      cliente: cliente.nome,
    });
    gravar.push({
      cliente_id: clienteId,
      source: it.source,
      external_id: it.externalId,
      author: texto(it.author),
      text: texto(it.text),
      url: texto(it.url),
      received_at: texto(it.receivedAt),
      label: s.label || null,
      reply: s.reply || null,
      escalate: !!s.escalate,
      escalate_reason: s.escalateReason || null,
      status: 'pendente',
    });
  }

  let gravados = [];
  if (gravar.length) {
    try { gravados = await banco.inserir('manha_items', gravar); }
    catch (e) { return res.status(500).json({ error: 'Falha ao gravar: ' + e.message }); }
  }

  const escalados = gravar.filter(g => g.escalate).length;
  return res.status(200).json({
    received: itens.length,
    new: gravados.length,
    escalated: escalados,
    duplicates: itens.length - novos.length - pulados.length,
    skipped: pulados.length,
    // Para o agente de varredura mostrar o aviso matinal na sua tela.
    resumo: gravados.length
      ? `${gravados.length} novidade(s): ${gravar.filter(g=>g.source==='feed').length} comentário(s), ` +
        `${gravar.filter(g=>g.source==='dm').length} DM(s), ${escalados} para escalar.`
      : 'Nada novo desde o último envio.',
    versao: VERSAO,
  });
};

module.exports.VERSAO = VERSAO;
module.exports.LOTE_MAXIMO = LOTE_MAXIMO;
