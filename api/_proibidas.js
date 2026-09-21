/* Rede de segurança da linguagem.
 *
 * O prompt já proíbe estas palavras. Este arquivo existe porque prompt é
 * pedido, não garantia: um modelo pode escorregar, e numa conta regulada pela
 * CVM prometer retorno não é deslize de tom — é infração.
 *
 * Toda sugestão passa por aqui ANTES de chegar à tela. Bateu, a resposta é
 * descartada e o item vira ESCALAR. Perder uma boa resposta por excesso de
 * zelo custa pouco; publicar uma promessa custa caro.
 */

/* Cada regra tem um padrão e o motivo em linguagem de gente — a tela mostra o
 * motivo, e "linguagem proibida" sozinho não ajuda ninguém a entender.
 *
 * Os padrões aceitam acento opcional e espaço variável porque é assim que o
 * texto chega: "garantído", "sem  risco", "nao tem como perder". Casar só a
 * grafia perfeita seria um filtro que se engana fácil. */
/* "o lucro é certo" é a mesma promessa que "lucro certo", e passava direto
 * porque o verbo entra no meio. O modelo escreve das duas formas — a segunda
 * até com mais naturalidade. Este pedaço deixa o verbo de ligação opcional. */
const LIGA = '(?:(?:[ée]|eh|ser[áa]|seria|fica|continua)\\s+)?';
const comLigacao = (a, b) => new RegExp(`\\b${a}\\s+${LIGA}${b}\\b`, 'i');

const REGRAS = [
  { re: /\bgarantid[oa]s?\b/i,                          porque: 'promete retorno ("garantido")' },
  { re: /\bgarante\s+(o\s+)?(retorno|lucro|rendimento|ganho)/i, porque: 'promete retorno ("garante")' },
  { re: comLigacao('lucro', 'cert[oa]'),                porque: 'promete retorno ("lucro certo")' },
  { re: comLigacao('(?:retorno|rendimento|ganho)', 'cert[oa]'), porque: 'promete retorno ("retorno certo")' },
  { re: comLigacao('dinheiro', 'cert[oa]'),             porque: 'promete retorno ("dinheiro certo")' },
  { re: /\bsem\s+err[oa]\b/i,                           porque: 'promete infalibilidade ("sem erro")' },
  { re: /\bsem\s+risco[s]?\b/i,                         porque: 'nega o risco ("sem risco")' },
  { re: comLigacao('risco', 'zero'),                    porque: 'nega o risco ("risco zero")' },
  { re: /\b(n[ãa]o|nunca)\s+(tem\s+como|d[áa]\s+para|d[áa])\s+perder\b/i, porque: 'nega a perda ("não tem como perder")' },
  { re: /\bn[ãa]o\s+tem\s+risco\b/i,                    porque: 'nega o risco' },
  { re: /\bmelhor\s+investimento\b/i,                   porque: 'recomendação superlativa ("melhor investimento")' },
  { re: /\binvestimento\s+segur[oa]\b/i,                porque: '"seguro" só vale como baixo risco de crédito de título público' },
  { re: /\b100\s*%\s*segur[oa]\b/i,                     porque: 'nega o risco ("100% seguro")' },
  // Promessa numérica: "rende 12% ao ano", "vai render 1.000 reais".
  { re: /\b(rende|rendimento|retorno|ganho|lucro)\b[^.!?]{0,30}\b\d+[.,]?\d*\s*%/i, porque: 'promete rendimento com número' },
  { re: /\bvoc[êe]\s+(vai|ir[áa])\s+(ganhar|lucrar|receber)\s+R?\$?\s*\d/i,          porque: 'promete quanto a pessoa vai ganhar' },
];

/* Nome de instituição. A regra do Tesouro Direto é não confirmar nem citar
 * banco ou corretora — a disponibilidade varia, e citar um é fazer indicação.
 *
 * Só nomes próprios de instituição. "banco" e "corretora" como palavra comum
 * são permitidos, porque a resposta CERTA usa justamente essas palavras:
 * "consulte o app da sua corretora". */
const INSTITUICOES = [
  'nubank', 'nuinvest', 'itau', 'itaú', 'bradesco', 'santander', 'banco do brasil',
  'caixa', 'inter', 'c6', 'btg', 'xp investimentos', 'xp ', 'rico', 'clear',
  'modalmais', 'genial', 'avenue', 'toro', 'warren', 'mercado pago', 'picpay',
  'sofisa', 'original', 'safra', 'sicredi', 'sicoob', 'banrisul', 'neon', 'will bank',
];

// Tira acento e baixa a caixa: o texto chega de todo jeito, e um filtro que só
// pega a grafia perfeita se engana fácil.
const semAcento = (t) => String(t || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* Devolve { limpo, motivo }. "limpo: false" significa que a sugestão NÃO pode
 * ir para a tela. */
function verificar(texto) {
  const t = String(texto || '');
  if (!t.trim()) return { limpo: true, motivo: null };

  for (const r of REGRAS) {
    if (r.re.test(t)) return { limpo: false, motivo: r.porque };
  }

  const plano = ' ' + semAcento(t).replace(/[^a-z0-9]+/g, ' ') + ' ';
  for (const nome of INSTITUICOES) {
    const alvo = ' ' + semAcento(nome).trim() + ' ';
    if (plano.includes(alvo)) {
      return { limpo: false, motivo: `cita instituição financeira ("${nome.trim()}")` };
    }
  }

  return { limpo: true, motivo: null };
}

/* Aplica a verificação a uma sugestão pronta. Se não passar, a resposta é
 * DESCARTADA (não censurada nem remendada) e o item vira ESCALAR — remendar
 * texto de compliance automaticamente é como o problema volta disfarçado. */
function filtrar(sugestao) {
  if (!sugestao || sugestao.escalate) return sugestao;
  const { limpo, motivo } = verificar(sugestao.reply);
  if (limpo) return sugestao;
  return {
    ...sugestao,
    reply: null,
    escalate: true,
    escalateReason: `linguagem proibida — ${motivo}`,
  };
}

module.exports = { verificar, filtrar, REGRAS, INSTITUICOES };
