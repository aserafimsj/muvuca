# Migração — carimbo de "a IA já analisou"

**Por que isto existe:** o MUVUCA não guardava lembrança de já ter mandado um
comentário para a IA. Toda vez que você clicava em *Classificar com IA*, ele
reenviava os antigos junto com os novos e cobrava de novo pelo mesmo trabalho.

Esta migração cria um campo (`ia_em`) que guarda **quando** a IA analisou cada
comentário. Com ele, cada comentário é enviado uma vez só.

**É seguro.** Só acrescenta um campo — não apaga nem reescreve nenhum
comentário, resposta ou classificação sua. Se rodar duas vezes por engano, não
faz mal nenhum.

---

## Passo 1 — Abrir o editor de SQL do Supabase

1. Entre em **https://supabase.com** e faça login.
2. Na lista de projetos, clique no projeto do **MUVUCA**.
3. No **menu da esquerda**, procure o ícone de **`SQL Editor`** (parece uma
   folha de papel com `SQL` escrito). Clique nele.
4. Clique no botão **`New query`**, no alto. Vai abrir uma área grande e
   vazia para escrever.

---

## Passo 2 — Colar o primeiro comando

Copie o bloco abaixo **inteiro** e cole naquela área vazia:

```sql
alter table interacoes add column if not exists ia_em timestamptz;
```

Agora clique no botão **`Run`** (canto de baixo à direita da caixa; em algumas
telas aparece como um triângulo ▶).

**O que você vai ver:** uma faixa verde escrito **`Success. No rows returned`**.

> Se aparecer faixa vermelha, **pare aqui** e me mande o texto do erro.
> Não continue para o passo 3.

---

## Passo 3 — Marcar os comentários que a IA já analisou

Este segundo comando evita que você pague **mais uma vez** pelos comentários
que já foram classificados. Ele carimba os que já têm sentimento preenchido.

Apague o que está na caixa, cole o bloco abaixo e clique em **`Run`** de novo:

```sql
update interacoes
set ia_em = now()
where ia_em is null
  and sentimento_id is not null;
```

**O que você vai ver:** uma faixa verde escrito **`Success`**, normalmente com
a contagem de linhas alteradas (por exemplo `Success. 29 rows`). Esse número é
quantos comentários foram marcados como "a IA já viu".

---

## Passo 4 — Conferir no MUVUCA

1. Volte para o MUVUCA e recarregue a página (tecla **`F5`**).
2. Olhe o botão **`Classificar com IA`** no alto à direita.

**O que você vai ver:** o número entre parênteses agora conta só os
comentários que a IA **nunca** analisou.

- Se você não colou nada novo depois da última rodada, o botão deve ficar
  **sem número** e cinza (não clicável). Isso é o certo: não há trabalho novo.
- Cole alguns comentários novos e o número deve aparecer, contando só eles.

---

## O que mudou no comportamento

- **Cada comentário vai para a IA uma vez só.** Depois de analisado, ele não
  volta na próxima rodada — mesmo que tenha ficado com campo vazio. Campo
  vazio quase sempre é a resposta certa: "Boa noite" não fala de produto
  nenhum, e spam não merece rascunho de resposta.
- **Se você quiser mesmo pagar de novo** por algum que ficou com buraco,
  abra o painel *Classificar com IA*: aparece uma caixinha para marcar,
  dizendo quantos são. Ela só aparece quando existe algum nessa situação.
- Nada do que você escreveu ou corrigiu à mão é tocado, como antes.
