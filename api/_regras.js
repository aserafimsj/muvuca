/* FONTE ÚNICA das regras de tom e das proibições da CVM.
 *
 * Estas regras eram copiadas dentro do classify.js. Agora vivem só aqui, e
 * quem precisa delas importa. O motivo não é organização: é que classificar
 * um comentário e escrever a resposta dele PRECISAM usar exatamente o mesmo
 * texto. Se divergirem, o sistema etiqueta por um critério e responde por
 * outro — e ninguém percebe até sair uma resposta que contradiz a própria
 * etiqueta que ele colocou.
 *
 * O arquivo começa com "_" de propósito: a Vercel não transforma em rota os
 * arquivos de /api que começam com underscore.
 *
 * CommonJS porque o MUVUCA não tem package.json — criar um faria a Vercel
 * achar que o projeto precisa de build.
 */

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

// O MUVUCA atende vários clientes; as regras da CVM só valem para o Tesouro
// Direto. Nada de nome de cliente fixo espalhado pelo código — a decisão é
// feita aqui, num lugar só.
const ehTesouroDireto = (cliente) => /tesouro\s*direto/i.test(cliente || "");

function regrasDe(cliente) {
  return ehTesouroDireto(cliente) ? REGRAS_TESOURO_DIRETO : REGRAS_GENERICAS;
}

function contextoDe(cliente) {
  return ehTesouroDireto(cliente)
    ? "Você é o assistente de Community Management do Tesouro Direto (conta institucional, parceria B3 + Secretaria do Tesouro Nacional — STN)."
    : `Você é o assistente de Community Management da marca "${cliente || "cliente"}".`;
}

module.exports = {
  REGRAS_TESOURO_DIRETO,
  REGRAS_GENERICAS,
  ehTesouroDireto,
  regrasDe,
  contextoDe,
};
