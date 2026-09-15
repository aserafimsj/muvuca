// Função de servidor (Vercel). Roda no SERVIDOR, nunca no navegador.
// É aqui que a chave da Anthropic fica guardada — o front-end nunca a vê.
//
// Escrita em CommonJS de propósito: o MUVUCA não tem package.json, e criar um
// faria a Vercel achar que o projeto precisa de build. Assim continua sendo um
// site estático com uma função ao lado.
//
// Diferenças em relação à versão do Zmetrics:
//   - o cliente é enviado pelo front-end, porque o MUVUCA atende vários;
//   - as regras de compliance da CVM só entram quando o cliente é o Tesouro
//     Direto — outros clientes recebem instruções genéricas;
//   - há limite de tamanho do lote (o endpoint do Zmetrics não tinha nenhum,
//     e um POST gigante podia gerar uma conta alta numa única chamada).

const LOTE_MAXIMO = 40;

// Regras específicas do Tesouro Direto. Produto financeiro público tem
// exigências de linguagem que não valem para outros clientes.
const REGRAS_TESOURO_DIRETO = `
PRODUTO (um, inferido do texto): selic | prefixado | ipca | reserva | educa | nenhum
needsLegal (bool): true para tema sensível que exige aval jurídico/STN (política, crise, acusações, comparação com apostas).

TOM: caloroso, direto, inclusivo e próximo — a voz do Tesouro Direto democratiza o investimento, sem elitismo e sem jargão. 💙 com moderação.
Do's: trate pelo @ quando houver; linguagem clara; direcione a recurso oficial quando útil ("Como Investir no Tesouro Direto" / atendimento oficial); problema técnico (cadastro, login, saque) -> atendimento oficial.
Dont's (CVM — inquebráveis): NUNCA prometa retorno garantido, "sem erro", "lucro certo", "sem risco". "seguro" só como baixo risco de crédito de título público. Reframes: Prefixado="você já sabe quanto vai receber se levar até o vencimento"; IPCA+="acompanha e supera a inflação"; Selic="acompanha a Selic, com liquidez diária"; Reserva=liquidez e preparo para imprevistos. NÃO oriente transações de banco/corretora -> direcione ao banco/corretora do investidor. Disponibilidade em um banco específico ("posso investir pelo X?"): diga que varia conforme a instituição e recomende consultar o app/site da própria corretora, sem confirmar nem citar bancos. Reserva nos bancos: está sendo liberado gradualmente pelas instituições; direcione ao canal oficial. Apostas: reforce o posicionamento educativo, sem atacar.`;

const REGRAS_GENERICAS = `
PRODUTO: deixe sempre "nenhum" — este cliente ainda não tem regras de produto configuradas.
needsLegal (bool): true quando o tema for sensível e pedir revisão humana antes de responder (jurídico, crise, acusação grave).

TOM: cordial, direto e prestativo. Responda em 1–3 frases.
Dont's: não prometa resultados; não faça afirmações sobre assuntos que o comentário não deixa claros; na dúvida, direcione ao canal oficial de atendimento do cliente.`;

function montarSystem(cliente) {
  const ehTesouroDireto = /tesouro\s*direto/i.test(cliente || "");
  const regras = ehTesouroDireto ? REGRAS_TESOURO_DIRETO : REGRAS_GENERICAS;
  const contexto = ehTesouroDireto
    ? "Você é o assistente de Community Management do Tesouro Direto (conta institucional, parceria B3 + Secretaria do Tesouro Nacional — STN)."
    : `Você é o assistente de Community Management da marca "${cliente || "cliente"}".`;

  return `${contexto} Classifique cada comentário e gere uma sugestão de resposta seguindo RIGOROSAMENTE as regras.

SENTIMENTO (um): positivo | negativo | neutro | duvida | bot | politico
TRIAGEM (um):
- "responder": dúvidas, reclamações legítimas, pedidos de ajuda.
- "curtir": elogios e mensagens positivas simples.
- "nao_responder": spam, bots, contas falsas, comentários que promovem apostas, provocação/ataque político, conteúdo ofensivo.
${regras}

RASCUNHO — gere SEMPRE que triagem for "responder" OU "curtir". Para "nao_responder" deixe "".
- "curtir" (elogio/positivo): agradecimento curto e caloroso.
- "responder" (dúvida/reclamação): acolha e ajude em 1–3 frases.

Cada item tem um "i". Devolva um objeto por item:
{"i":<n>,"sentimento":"...","triagem":"...","produto":"...","needsLegal":true|false,"rascunho":"...","motivo":"<=8 palavras"}
Responda APENAS com um array JSON na mesma ordem. Sem markdown.`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY não configurada na hospedagem." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const batch = body && Array.isArray(body.batch) ? body.batch : null;
  if (!batch || !batch.length) {
    res.status(400).json({ error: "Envie { batch: [...] } com pelo menos um item." });
    return;
  }
  // Trava de custo: sem isso, um único POST poderia enviar milhares de
  // comentários de uma vez e gerar uma conta alta numa chamada só.
  if (batch.length > LOTE_MAXIMO) {
    res.status(400).json({ error: `Lote grande demais: ${batch.length}. O máximo por chamada é ${LOTE_MAXIMO}.` });
    return;
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Para cortar custo, troque por "claude-haiku-4-5" (mais barato e rápido).
        model: "claude-sonnet-5",
        max_tokens: 2000,
        system: montarSystem(body.cliente),
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              batch.map((c) => ({ i: c.id, autor: c.autor == null ? null : c.autor, texto: c.texto }))
            ),
          },
        ],
      }),
    });

    const data = await r.json();
    if (data.error) {
      res.status(502).json({ error: data.error.message || "Erro na API da Anthropic" });
      return;
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const ini = text.indexOf("[");
    const fim = text.lastIndexOf("]");
    const results = ini !== -1 && fim !== -1 ? JSON.parse(text.slice(ini, fim + 1)) : [];

    // uso real devolvido pela API — permite mostrar custo verdadeiro, não só estimativa
    const uso = data.usage || null;
    res.status(200).json({ results, uso });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
};
