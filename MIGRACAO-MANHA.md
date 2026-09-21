# Migração — a tela Manhã

**Por que isto existe:** a tela **Manhã** mostra, num lugar só, tudo que
chegou desde ontem — comentários e DMs — já com uma **sugestão de resposta
pronta para você ler, ajustar e copiar**. Essas novidades precisam ficar
guardadas em algum lugar, e esse lugar é uma tabela nova chamada
`manha_items`.

**Sem esta tabela, a tela Manhã não abre.** Ela vai dizer que a tabela não
existe.

**É seguro.** Este guia **cria uma tabela nova** e não encosta em nenhuma das
que já existem. Nenhum comentário, nenhuma publicação e nenhum cliente é
alterado ou apagado. Rodar duas vezes não faz mal: todos os comandos dizem
"se ainda não existir, crie".

> **Uma coisa que vale dizer com todas as letras:** nada no MUVUCA envia
> mensagem, comentário ou DM. A tela Manhã **sugere** um texto. Quem envia é
> você, no Instagram, depois de ler. Não existe — e não vai existir por
> acidente — nenhuma ligação de envio.

---

## Passo 1 — Confirmar que você está no projeto certo

1. Entre em **https://supabase.com** e faça login.
2. Clique no projeto do **MUVUCA**.
3. **Olhe o endereço na barra do navegador.** Ele tem este formato:

   `https://supabase.com/dashboard/project/`**`fkhbjpyoajkadpfjexkb`**

4. **Confira se o código depois de `/project/` é exatamente
   `fkhbjpyoajkadpfjexkb`.**

   - **É esse?** Ótimo, siga para o passo 2.
   - **É outro código?** **Pare.** Você está num projeto diferente daquele
     que o MUVUCA usa. Volte para a lista de projetos e escolha outro. Se não
     achar nenhum com esse código, me avise.

---

## Passo 2 — Abrir o editor de SQL

1. No **menu da esquerda**, clique em **`SQL Editor`** (ícone de folha de
   papel com as letras `SQL`).
2. Clique em **`New query`**, no alto.

**Você vai ver:** uma caixa de texto grande e vazia.

---

## Passo 3 — Colar e rodar

Copie o bloco abaixo **inteiro**, cole na caixa (**`Command + V`**) e clique
em **`Run`**, no canto de baixo à direita.

```sql
create table if not exists manha_items (
  id              bigserial primary key,
  cliente_id      bigint not null references clientes(id) on delete cascade,
  source          text   not null default 'feed',
  external_id     text   not null,
  author          text,
  text            text,
  url             text,
  received_at     timestamptz,
  label           jsonb,
  reply           text,
  escalate        boolean not null default false,
  escalate_reason text,
  status          text   not null default 'pendente',
  created_at      timestamptz not null default now()
);

-- Impede que o mesmo comentário entre duas vezes. É esta linha que faz a
-- varredura poder rodar de novo sem medo: repetir não duplica nem gasta IA.
create unique index if not exists manha_items_unico
  on manha_items (cliente_id, source, external_id);

-- Deixa a tela abrir rápido mesmo com o acervo crescendo.
create index if not exists manha_items_fila
  on manha_items (cliente_id, status, created_at desc);

-- Só quem está logado no MUVUCA enxerga estas linhas.
alter table manha_items enable row level security;

drop policy if exists manha_items_logado on manha_items;
create policy manha_items_logado on manha_items
  for all to authenticated using (true) with check (true);

select column_name as coluna_criada, data_type as tipo
from information_schema.columns
where table_schema = 'public'
  and table_name  = 'manha_items'
order by ordinal_position;
```

**O que você vai ver:** uma tabela com **exatamente catorze linhas**:

| coluna_criada | tipo |
|---|---|
| id | bigint |
| cliente_id | bigint |
| source | text |
| external_id | text |
| author | text |
| text | text |
| url | text |
| received_at | timestamp with time zone |
| label | jsonb |
| reply | text |
| escalate | boolean |
| escalate_reason | text |
| status | text |
| created_at | timestamp with time zone |

**Essa tabela é a prova de que funcionou.** Se as catorze linhas aparecerem,
está feito.

### Se algo diferente aparecer

- **Tabela vazia, ou com menos de catorze linhas:** a tabela não foi criada.
  Tire um print da tela inteira e me mande.
- **Faixa vermelha dizendo `relation "clientes" does not exist`:** você está
  no projeto errado. Volte ao passo 1.
- **Qualquer outra faixa vermelha:** tire um print e me mande o texto do
  erro. Não tente de novo antes disso.
- **Diz `Success. No rows returned` e nenhuma tabela:** a conferência não
  rodou junto. Apague tudo da caixa, cole só a parte do `select` (as cinco
  últimas linhas do bloco) e clique em `Run` de novo.

---

## Passo 4 — Duas senhas na Vercel

A tela Manhã precisa de **duas informações novas** guardadas na hospedagem.
Sem elas, a coleta não entra.

### 4.1 — Pegar a chave de serviço do Supabase

1. Ainda no Supabase, no **menu da esquerda**, lá embaixo, clique em
   **`Project Settings`** (ícone de engrenagem).
2. No menu que abrir, clique em **`API Keys`**.
3. Procure a seção **`service_role`**. Ao lado dela tem uma chave escondida e
   um botão **`Reveal`** (ou um olhinho).
4. Clique em **`Reveal`** e depois no ícone de **copiar**.

**O que você vai ver:** um texto muito longo, começando com `eyJ`.

> **Cuidado de verdade com esta chave.** Ela abre o banco inteiro. Não cole
> em e-mail, não cole no chat, não mande print dela. Ela vai direto do
> Supabase para a Vercel e pronto. (A outra chave, a `anon`, que o MUVUCA já
> usa no navegador, essa é pública e não tem problema.)

### 4.2 — Guardar a chave na Vercel

1. Abra **https://vercel.com** e faça login.
2. Clique no projeto **`muvuca`**.
3. No menu de cima, clique em **`Settings`**.
4. No menu da esquerda, clique em **`Environment Variables`**.
5. No campo **`Key`**, escreva exatamente:

   `SUPABASE_SERVICE_ROLE_KEY`

6. No campo **`Value`**, cole a chave que você copiou (**`Command + V`**).
7. Deixe os três ambientes marcados (`Production`, `Preview`,
   `Development`).
8. Clique em **`Save`**.

### 4.3 — Criar a senha da varredura

Esta é uma senha que **você inventa**. Ela serve para que só a sua varredura
consiga mandar novidades para o MUVUCA.

1. Pense numa frase comprida e sem sentido, com letras e números — por
   exemplo `manha-muvuca-2026-abacaxi-77`. Quanto mais longa, melhor.
2. **Anote essa frase num lugar seguro.** Você vai precisar dela de novo.
3. Na mesma tela da Vercel, clique em **`Add Another`** (ou repita o passo
   4.2).
4. No campo **`Key`**, escreva exatamente:

   `MANHA_TOKEN`

5. No campo **`Value`**, escreva a sua frase.
6. Deixe os três ambientes marcados e clique em **`Save`**.

---

## Passo 5 — Publicar de novo

As variáveis da Vercel só entram numa publicação nova. Sem este passo, nada
muda.

1. Ainda na Vercel, no menu de cima, clique em **`Deployments`**.
2. Na **primeira linha** da lista (a mais recente), clique nos **três
   pontinhos** `···` do lado direito.
3. Clique em **`Redeploy`**.
4. Na janela que abrir, clique em **`Redeploy`** de novo para confirmar.

**O que você vai ver:** uma tela de progresso. Em um ou dois minutos aparece
**`Ready`** com uma bolinha verde.

---

## Passo 6 — Conferir que chegou

1. Abra o MUVUCA no navegador, do jeito que você sempre abre.
2. Clique na **barra de endereço** (onde fica o `https://...`), vá até o
   **fim** do que está escrito e acrescente:

   `/api/manha/ingest`

   Fica assim: o **seu** endereço de sempre, mais esse pedacinho no fim.

3. Aperte Enter.

**O que você vai ver:** um texto curto, parecido com isto:

```
{"versao":"2026-09-21-a","token_configurado":true,"banco_configurado":true,"chave_ia_configurada":true}
```

**Os três `true` são a prova de que funcionou.**

- **`token_configurado: false`** → a `MANHA_TOKEN` não chegou. Refaça o passo
  4.3 e o passo 5.
- **`banco_configurado: false`** → a `SUPABASE_SERVICE_ROLE_KEY` não chegou.
  Refaça o 4.2 e o 5.
- **`chave_ia_configurada: false`** → a `ANTHROPIC_API_KEY` sumiu. Essa já
  existia; confira se alguém apagou.

> Abrir esse endereço no navegador **não gasta nada** e **não grava nada**.
> É só a fichinha de conferência.

---

## Passo 7 — Ver a tela

1. Volte para o MUVUCA e recarregue a página (**`F5`**).
2. No menu de cima, clique em **`Manhã`**.

**O que você vai ver se deu certo:** a tela abre dizendo
**"Nada novo hoje 💙"**. Está certo — ainda não entrou nenhuma novidade.
Quem coloca novidade lá é a varredura, explicada em
`docs/manha-varredura.md`.

**Se aparecer um erro falando em `manha_items`:** a tabela não foi criada.
Volte ao passo 3.
