/* Escreve a resposta sugerida para um comentário ou DM.
 *
 * NÃO ENVIA NADA. Devolve texto para uma pessoa ler, ajustar e mandar. Não há
 * nesta função — nem em nenhuma outra do MUVUCA — qualquer integração de
 * envio para Instagram ou qualquer outro canal. É de propósito.
 *
 * Usa as MESMAS regras do classify.js, importadas de _regras.js. O prompt
 * abaixo é o que o dono do projeto já usa à mão no Claude in Chrome
 * (PROMPT-DM-CLAUDE-IN-CHROME.md), adaptado para receber um item por vez.
 */

const { regrasDe, contextoDe, ehTesouroDireto } = require('./_regras.js');
const { filtrar } = require('./_proibidas.js');

const VERSAO = '2026-09-21-a';

// Mesmo modelo e mesmos parâmetros do classify.js. Trocar num lugar e não no
// outro faria a classificação e a resposta saírem de modelos diferentes.
const MODELO = 'claude-sonnet-5';

/* Os doze tipos de DM, com a resposta que o dono do projeto daria. São
 * exemplos, não um menu fechado: quando a mensagem não se encaixa em nenhum,
 * o modelo usa o mais próximo. */
const EXEMPLOS = `
TIPOS DE MENSAGEM QUE EU RECEBO, E COMO EU RESPONDO

1. Como começar a investir
"Oi, @fulano! 💙 Para começar você precisa de CPF ativo e conta em uma instituição financeira habilitada. O passo a passo completo está aqui: tesourodireto.com.br/investindo/como-investir.htm — é mais simples do que parece."

2. Qual título escolher
"Oi, @fulano! Depende do seu objetivo e do prazo. Para guardar com liquidez diária, o Tesouro Selic acompanha a Selic e você resgata quando quiser. Para proteger o poder de compra no longo prazo, o Tesouro IPCA+ acompanha e supera a inflação. O simulador ajuda a comparar: tesourodireto.com.br"

3. Quanto rende
"Oi, @fulano! As taxas mudam todo dia e ficam sempre atualizadas aqui: tesourodireto.com.br/titulos/precos-e-taxas.htm. No Prefixado, você já sabe quanto vai receber se levar até o vencimento."

4. Posso investir pelo banco X?
"Oi, @fulano! Isso varia conforme a instituição. O melhor caminho é consultar no app ou no site da sua corretora — lá você vê quais títulos estão disponíveis."

5. Dá para resgatar antes do vencimento?
"Oi, @fulano! Dá, sim. O Tesouro recompra pelo preço do dia, que pode estar acima ou abaixo do da compra. Se a ideia é poder sacar a qualquer momento sem sustos, o Tesouro Selic é o mais indicado, porque tem liquidez diária."

6. Problema técnico (login, cadastro, saque)
"Oi, @fulano! Sinto muito pelo transtorno. Questões de cadastro, login e resgate são resolvidas pelo atendimento oficial, que consegue olhar a sua conta com segurança: tesourodireto.com.br/atendimento"

7. Tesouro Reserva / Educa+ — disponibilidade
"Oi, @fulano! O Tesouro Reserva está sendo liberado aos poucos pelas instituições. Para saber se já chegou na sua, vale consultar o canal oficial: tesourodireto.com.br"

8. Comparação com poupança ou CDB
"Oi, @fulano! São produtos diferentes e vale comparar prazo, liquidez e imposto, não só o número do rendimento. O simulador do Tesouro Direto mostra lado a lado: tesourodireto.com.br"

9. Elogio
"Que bom ler isso, @fulano! 💙 Obrigado por acompanhar a gente."

10. Crítica ou reclamação legítima
"Oi, @fulano! Entendo a sua frustração e obrigado por contar. Para a gente conseguir olhar o seu caso com atenção, o caminho é o atendimento oficial: tesourodireto.com.br/atendimento"

11. Spam, bot, corrente, divulgação de outro perfil
ESCALAR: spam, não responder

12. "Isso aí é melhor que aposta?" (em tom genuíno, não de ataque)
"Oi, @fulano! São coisas diferentes: aqui é investimento em título público, com regras claras e prazo definido. Se quiser entender como funciona, começa por aqui: tesourodireto.com.br/investindo/como-investir.htm"`;

const PARE = `
PARE E NÃO RESPONDA — nestes casos devolva reply vazio e escalate true:
- Tema político, eleitoral ou de governo.
- Crise, acusação grave, ameaça de processo, imprensa, ofício.
- Pedido de recomendação personalizada ("o que EU faço com R$ 5.000?").
- Qualquer dado pessoal na conversa: CPF, número de conta, saldo, print de extrato.
- Suspeita de golpe ou de perfil se passando pela marca.
- Comparação com apostas feita em tom de ataque ou provocação.
- Spam, bot, corrente, divulgação de outro perfil.
- Qualquer coisa que você responderia com uma suposição em vez de um fato.
Na dúvida entre responder e escalar, ESCALE. Errar para o lado do silêncio custa pouco; errar para o lado da promessa custa caro.`;

function montarSystem(cliente, source) {
  const onde = source === 'dm'
    ? 'Esta é uma mensagem privada (DM). A pessoa está falando reservadamente.'
    : 'Este é um comentário PÚBLICO no feed. Qualquer pessoa lê a resposta — nunca peça nem repita dado pessoal.';

  return `${contextoDe(cliente)} Escreva a resposta que a marca daria a UMA mensagem recebida.

${onde}

${regrasDe(cliente)}

COMO EU ESCREVO
- Direto. De 1 a 3 frases. Nunca um textão.
- Caloroso e próximo, tratando a pessoa pelo @ quando houver.
- No máximo um 💙 por mensagem, e só quando couber.
- Dou a resposta. Só faço pergunta quando falta informação sem a qual a resposta sairia errada — e aí faço UMA.
- Sem assinatura. Quando houver link oficial que resolva, ele fecha a mensagem.
- Linguagem de gente: "quanto você vai receber", não "rentabilidade bruta projetada".
${ehTesouroDireto(cliente) ? EXEMPLOS : ''}
${PARE}

Devolva APENAS um objeto JSON, sem markdown e sem explicação:
{"sentimento":"positivo|negativo|neutro|duvida|bot|politico","triagem":"responder|curtir|nao_responder","produto":"...","needsLegal":true|false,"motivo":"<=8 palavras","reply":"a resposta pronta, ou string vazia se for para escalar","escalate":true|false,"escalateReason":"motivo curto, ou string vazia"}

Sem preâmbulo. Sem "Claro, aqui está". Só o JSON.
Você NÃO envia nada: o texto é para uma pessoa revisar e mandar.`;
}

/* Chama a Anthropic e devolve a sugestão já filtrada.
 * Exportada para o ingest usar direto, sem passar por HTTP. */
async function sugerir({ source, author, text, url, context, cliente }) {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) {
    return {
      label: null, reply: null, escalate: true,
      escalateReason: 'ANTHROPIC_API_KEY não configurada na hospedagem',
    };
  }
  if (!text || !String(text).trim()) {
    return { label: null, reply: null, escalate: true, escalateReason: 'mensagem sem texto' };
  }

  const entrada = {
    origem: source === 'dm' ? 'DM' : 'comentário no feed',
    autor: author || null,
    texto: String(text),
    ...(url ? { link: url } : {}),
    ...(context ? { contexto: String(context) } : {}),
  };

  let data;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': chave,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELO,
        thinking: { type: 'disabled' },
        max_tokens: 2000,
        system: montarSystem(cliente, source),
        messages: [{ role: 'user', content: JSON.stringify(entrada) }],
      }),
    });
    data = await r.json();
    if (data.error) {
      return { label: null, reply: null, escalate: true,
        escalateReason: 'erro na API da Anthropic: ' + (data.error.message || 'sem detalhe') };
    }
    if (!r.ok) {
      return { label: null, reply: null, escalate: true,
        escalateReason: `a API da Anthropic respondeu ${r.status}` };
    }
    // Resposta cortada não pode virar sugestão pela metade.
    if (data.stop_reason === 'max_tokens') {
      return { label: null, reply: null, escalate: true, escalateReason: 'resposta da IA cortada por tamanho' };
    }
    if (data.stop_reason === 'refusal') {
      return { label: null, reply: null, escalate: true, escalateReason: 'a IA recusou o conteúdo' };
    }
  } catch (e) {
    return { label: null, reply: null, escalate: true, escalateReason: 'falha ao falar com a IA: ' + (e.message || e) };
  }

  const texto = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  const ini = texto.indexOf('{'), fim = texto.lastIndexOf('}');
  if (ini === -1 || fim === -1 || fim < ini) {
    return { label: null, reply: null, escalate: true, escalateReason: 'a IA respondeu fora do formato esperado' };
  }
  let bruto;
  try { bruto = JSON.parse(texto.slice(ini, fim + 1)); }
  catch (e) { return { label: null, reply: null, escalate: true, escalateReason: 'a IA devolveu JSON inválido' }; }

  const label = {
    sentimento: bruto.sentimento || null,
    triagem: bruto.triagem || null,
    produto: bruto.produto || null,
    needsLegal: !!bruto.needsLegal,
    motivo: bruto.motivo || null,
  };

  const reply = String(bruto.reply || '').trim();
  // needsLegal é aval jurídico pendente: vale como escalada mesmo que o
  // modelo não tenha marcado escalate.
  const escalouSozinho = !!bruto.escalate || !reply || label.needsLegal;

  const sugestao = {
    label,
    reply: escalouSozinho ? null : reply,
    escalate: escalouSozinho,
    escalateReason: escalouSozinho
      ? (bruto.escalateReason || (label.needsLegal ? 'tema sensível — precisa de aval jurídico/STN' : 'a IA entendeu que não cabe responder'))
      : null,
    uso: data.usage || null,
  };

  // A rede de segurança: prompt é pedido, não garantia.
  return filtrar(sugestao);
}

// Endpoint HTTP, para testar um item avulso sem passar pelo ingest.
module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ versao: VERSAO, modelo: MODELO, chave_encontrada: !!process.env.ANTHROPIC_API_KEY });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  if (!body || !body.text) return res.status(400).json({ error: 'Envie { source, author, text, url }.' });

  const r = await sugerir(body);
  return res.status(200).json(r);
};

module.exports.sugerir = sugerir;
module.exports.montarSystem = montarSystem;
module.exports.VERSAO = VERSAO;
