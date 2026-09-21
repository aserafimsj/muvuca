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

// As regras de tom e as proibições da CVM vivem em UM lugar só. Copiar o
// texto para cá de novo faria a classificação e a geração de resposta
// divergirem com o tempo — e ninguém perceberia.
const { regrasDe, contextoDe } = require('./_regras.js');
const { verificar } = require('./_proibidas.js');

const LOTE_MAXIMO = 40;

// Muda a cada alteração desta função. Serve para saber, de fora, QUAL versão a
// hospedagem está servindo — sem isso, "já publicou?" vira adivinhação.
const VERSAO = "2026-09-20-d";

function montarSystem(cliente) {
  const regras = regrasDe(cliente);
  const contexto = contextoDe(cliente);

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

// Informações de ambiente úteis para diagnóstico. NUNCA inclui valor de chave —
// só nomes de variáveis e o tamanho da chave, que não permite reconstruí-la.
function diagnostico() {
  const key = process.env.ANTHROPIC_API_KEY;
  return {
    versao: VERSAO,
    chave_encontrada: !!key,
    chave_tamanho: key ? key.length : 0,
    ambiente: process.env.VERCEL_ENV || null,
    projeto: process.env.VERCEL_PROJECT_PRODUCTION_URL || null,
    deploy: process.env.VERCEL_URL || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : null,
    variaveis_anthropic: Object.keys(process.env).filter((k) => /anthropic/i.test(k)),
  };
}

module.exports = async function handler(req, res) {
  // Abrir o endereço no navegador (GET) devolve a ficha de diagnóstico. É o
  // único jeito de o dono do projeto, que não é programador, conferir sozinho
  // qual versão está no ar e se a chave chegou — sem gastar nada com a IA.
  if (req.method === "GET") {
    res.status(200).json(diagnostico());
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // Diagnóstico: quando a chave não aparece, o motivo quase sempre é ter
    // sido configurada no projeto errado, no ambiente errado, ou sem
    // republicar. Dizer ONDE a função está procurando resolve em segundos.
    const onde = [
      "versão " + VERSAO,
      process.env.VERCEL_ENV ? "ambiente: " + process.env.VERCEL_ENV : null,
      process.env.VERCEL_URL ? "deploy: " + process.env.VERCEL_URL : null,
      process.env.VERCEL_GIT_COMMIT_REF ? "branch: " + process.env.VERCEL_GIT_COMMIT_REF : null,
    ].filter(Boolean).join(" · ");
    // Nomes parecidos já configurados por engano (nunca mostra o valor).
    // Só ANTHROPIC*, para pegar erros de digitação como "anthropic_api_key",
    // "ANTHROPIC_KEY" ou um espaço sobrando no fim do nome.
    const parecidas = Object.keys(process.env)
      .filter((k) => /anthropic/i.test(k) && k !== "ANTHROPIC_BASE_URL")
      .slice(0, 5)
      .map((k) => '"' + k + '"')
      .join(", ");
    res.status(500).json({
      error:
        "ANTHROPIC_API_KEY não configurada na hospedagem." +
        (onde ? " (" + onde + ")" : "") +
        (parecidas ? " Variáveis parecidas encontradas: " + parecidas + "." : " Nenhuma variável parecida foi encontrada neste deploy."),
    });
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
        // Sem este campo o modelo LIGA O RACIOCÍNIO SOZINHO, e o raciocínio
        // gasta do mesmo teto de max_tokens da resposta. Era essa a causa da
        // falha silenciosa: o pensamento comia o teto, o JSON vinha cortado no
        // meio e a função devolvia lista vazia com status 200. Classificar
        // comentário com regra escrita não precisa de raciocínio — desligar
        // corrige a falha E sai mais barato.
        thinking: { type: "disabled" },
        // Teto de segurança, não orçamento: só se paga o que for realmente
        // gerado. Deixar folgado não custa nada e evita corte no meio.
        max_tokens: 8000,
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
    // Erro que não veio no formato esperado (gateway, HTML de proxy). Sem isto,
    // um corpo estranho seguiria adiante e viraria "lista vazia" mais abaixo.
    if (!r.ok) {
      res.status(502).json({ error: `A API da Anthropic respondeu ${r.status} sem detalhar o motivo. (versão ${VERSAO})` });
      return;
    }

    // A resposta foi cortada por falta de espaço: o JSON está pela metade e
    // NÃO dá para aproveitar. Antes isso virava lista vazia com status 200 —
    // o lote inteiro falhava em silêncio, já cobrado. Agora é erro explícito.
    if (data.stop_reason === "max_tokens") {
      res.status(502).json({
        error:
          `A resposta da IA foi cortada por tamanho (lote de ${batch.length}). ` +
          `Tente um lote menor. (versão ${VERSAO})`,
      });
      return;
    }
    // A IA recusou o conteúdo. Sem este aviso viraria "lista vazia" também.
    if (data.stop_reason === "refusal") {
      res.status(502).json({ error: `A IA recusou classificar este lote por política de conteúdo. (versão ${VERSAO})` });
      return;
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const ini = text.indexOf("[");
    const fim = text.lastIndexOf("]");
    if (ini === -1 || fim === -1 || fim < ini) {
      res.status(502).json({
        error:
          "A IA respondeu em um formato inesperado (não veio a lista JSON). " +
          `Início da resposta: ${JSON.stringify(text.slice(0, 120))} (versão ${VERSAO})`,
      });
      return;
    }

    let results;
    try {
      results = JSON.parse(text.slice(ini, fim + 1));
    } catch (e) {
      res.status(502).json({ error: `A lista devolvida pela IA não é um JSON válido: ${e.message} (versão ${VERSAO})` });
      return;
    }
    if (!Array.isArray(results)) {
      res.status(502).json({ error: `A IA devolveu ${typeof results} em vez de uma lista. (versão ${VERSAO})` });
      return;
    }

    /* Rede de segurança da linguagem, a mesma da tela Manhã.
     *
     * O prompt já proíbe prometer retorno e citar banco ou corretora, mas
     * prompt é pedido, não garantia. Aqui o rascunho é DESCARTADO quando
     * escorrega — não remendado: remendar texto de compliance é como o
     * problema volta disfarçado, e sem ninguém perceber.
     *
     * Sem rascunho, o front-end já se comporta certo sozinho: o lote não
     * preenche a resposta e o botão "Gerar de novo" mostra o motivo. O
     * needsLegal acende a etiqueta "Jurídico/STN", que é exatamente o que
     * este caso é — um texto que só uma pessoa pode liberar. */
    let bloqueados = 0;
    for (const r of results) {
      if (!r || !r.rascunho) continue;
      const { limpo, motivo } = verificar(r.rascunho);
      if (limpo) continue;
      bloqueados++;
      r.rascunho = "";
      r.needsLegal = true;
      r.motivo = `linguagem proibida — ${motivo}`;
    }

    // uso real devolvido pela API — permite mostrar custo verdadeiro, não só estimativa
    const uso = data.usage || null;
    res.status(200).json({ results, uso, bloqueados });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
};
