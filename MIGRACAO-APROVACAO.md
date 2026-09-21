# Migração — Módulo de Aprovação de Conteúdo

**Por que isto existe:** o MUVUCA nunca guardou uma peça de conteúdo **antes**
de ela ir ao ar. Ele só conhecia o post já publicado, com os números. Este
guia cria o lugar onde a peça planejada vai morar: a arte, a legenda, a data
prevista, o status da aprovação, as versões e os comentários do cliente.

**É seguro.** Este guia **só cria tabelas novas**. Ele não encosta em
`interacoes`, `publicacoes`, `clientes` nem em qualquer outra coisa que já
existe. Nenhum comentário e nenhuma publicação é alterado ou apagado. Rodar
duas vezes não faz mal: todos os comandos dizem "se ainda não existir, crie".

> **Você vai criar sete tabelas de uma vez, mas só uma será usada agora.**
> É de propósito: assim você faz **uma** viagem ao Supabase em vez de seis,
> uma por etapa. As outras seis ficam vazias esperando as etapas seguintes
> (arquivos, versões, comentários, link do cliente). Tabela vazia não pesa
> nada e não atrapalha nada.

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

É um bloco longo. Cole tudo de uma vez mesmo — ele foi escrito para rodar
numa tacada só.

```sql
-- ============================================================
-- 1. A PEÇA DE CONTEÚDO
-- O que se planeja publicar. NÃO é a mesma coisa que "publicacoes",
-- que guarda o post já no ar com os números dele.
-- ============================================================
create table if not exists conteudos (
  id             bigserial primary key,
  cliente_id     bigint not null references clientes(id) on delete cascade,
  rede_id        bigint references redes(id),
  produto_id     bigint references produtos(id),
  editoria_id    bigint references editorias(id),
  -- Preenchido DEPOIS de publicar, ligando o planejado ao que foi ao ar.
  -- Fica vazio até lá. É isto que evita ter dois registros do mesmo post.
  publicacao_id  bigint references publicacoes(id) on delete set null,
  titulo         text,
  formato        text,
  data_prevista  date,
  hora_prevista  time,
  legenda        text,
  hashtags       text,
  cta            text,
  campanha       text,
  observacoes    text,
  responsavel    text,
  status         text    not null default 'rascunho',
  versao         integer not null default 1,
  arquivado      boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists conteudos_do_cliente
  on conteudos (cliente_id, data_prevista);
create index if not exists conteudos_por_status
  on conteudos (cliente_id, status);

-- ============================================================
-- 2. OS ARQUIVOS DE CADA PEÇA  (usado na etapa 2)
-- Uma peça tem VÁRIOS arquivos: a capa, os cards do carrossel, o vídeo.
-- Por isso é tabela separada, e não uma coluna "arquivo" na peça.
-- ============================================================
create table if not exists conteudo_arquivos (
  id           bigserial primary key,
  conteudo_id  bigint not null references conteudos(id) on delete cascade,
  versao       integer not null default 1,
  tipo         text    not null default 'imagem',
  caminho      text,
  url          text,
  nome         text,
  tamanho      bigint,
  largura      integer,
  altura       integer,
  duracao      numeric,
  ordem        integer not null default 0,
  criado_em    timestamptz not null default now()
);

create index if not exists conteudo_arquivos_da_peca
  on conteudo_arquivos (conteudo_id, versao, ordem);

-- ============================================================
-- 3. AS VERSÕES  (usado na etapa 5)
-- Conteúdo não é sobrescrito em silêncio. Cada reenvio guarda uma
-- fotografia da versão anterior aqui.
-- ============================================================
create table if not exists conteudo_versoes (
  id           bigserial primary key,
  conteudo_id  bigint not null references conteudos(id) on delete cascade,
  versao       integer not null,
  retrato      jsonb,
  motivo       text,
  quem         text,
  criado_em    timestamptz not null default now()
);

create index if not exists conteudo_versoes_da_peca
  on conteudo_versoes (conteudo_id, versao);

-- ============================================================
-- 4. O HISTÓRICO DE ESTADOS
-- Toda mudança de status entra aqui e NUNCA é apagada. É o que
-- responde "quem enviou isso para aprovação, e quando?".
-- ============================================================
create table if not exists conteudo_eventos (
  id           bigserial primary key,
  conteudo_id  bigint not null references conteudos(id) on delete cascade,
  de           text,
  para         text not null,
  quem         text,
  observacao   text,
  criado_em    timestamptz not null default now()
);

create index if not exists conteudo_eventos_da_peca
  on conteudo_eventos (conteudo_id, criado_em);

-- ============================================================
-- 5. OS COMENTÁRIOS DA APROVAÇÃO  (usado na etapa 5)
-- Não confundir com "interacoes", que é comentário do PÚBLICO nas redes.
-- O campo "alvo" existe para, no futuro, comentar um card específico
-- do carrossel ("card:2") em vez da peça inteira.
-- ============================================================
create table if not exists conteudo_comentarios (
  id           bigserial primary key,
  conteudo_id  bigint not null references conteudos(id) on delete cascade,
  versao       integer not null default 1,
  autor        text,
  autor_tipo   text not null default 'interno',
  alvo         text,
  texto        text not null,
  criado_em    timestamptz not null default now()
);

create index if not exists conteudo_comentarios_da_peca
  on conteudo_comentarios (conteudo_id, criado_em);

-- ============================================================
-- 6. OS LINKS DE APROVAÇÃO DO CLIENTE  (usado na etapa 6)
-- Cada link é um pacote de peças que você escolhe. O cliente que abre
-- o link vê só o que está no pacote — não existe caminho para o resto.
-- ============================================================
create table if not exists aprovacao_links (
  id           bigserial primary key,
  cliente_id   bigint not null references clientes(id) on delete cascade,
  token        text not null unique,
  titulo       text,
  periodo      text,
  expira_em    timestamptz,
  revogado     boolean not null default false,
  visto_em     timestamptz,
  criado_em    timestamptz not null default now()
);

create table if not exists aprovacao_link_itens (
  id           bigserial primary key,
  link_id      bigint not null references aprovacao_links(id) on delete cascade,
  conteudo_id  bigint not null references conteudos(id) on delete cascade
);

create unique index if not exists aprovacao_link_itens_unico
  on aprovacao_link_itens (link_id, conteudo_id);

-- ============================================================
-- 7. QUEM PODE VER O QUÊ
-- Só quem está logado no MUVUCA enxerga estas tabelas.
-- A página do cliente NÃO passa por aqui: ela é servida por uma função
-- separada, que entrega apenas aquele pacote.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'conteudos','conteudo_arquivos','conteudo_versoes','conteudo_eventos',
    'conteudo_comentarios','aprovacao_links','aprovacao_link_itens'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_logado', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      t || '_logado', t);
  end loop;
end $$;

-- ============================================================
-- A CONFERÊNCIA
-- ============================================================
select table_name as tabela_criada, count(*) as colunas
from information_schema.columns
where table_schema = 'public'
  and table_name in ('conteudos','conteudo_arquivos','conteudo_versoes',
                     'conteudo_eventos','conteudo_comentarios',
                     'aprovacao_links','aprovacao_link_itens')
group by table_name
order by table_name;
```

**O que você vai ver:** uma tabela com **exatamente sete linhas**:

| tabela_criada | colunas |
|---|---|
| aprovacao_link_itens | 3 |
| aprovacao_links | 9 |
| conteudo_arquivos | 13 |
| conteudo_comentarios | 8 |
| conteudo_eventos | 7 |
| conteudo_versoes | 7 |
| conteudos | 21 |

**Essas sete linhas são a prova de que funcionou.** Se aparecerem as sete,
está feito.

### Se algo diferente aparecer

- **Menos de sete linhas:** alguma tabela não foi criada. Tire um print da
  tela inteira e me mande, com o texto de qualquer faixa vermelha.
- **Faixa vermelha dizendo `relation "publicacoes" does not exist`:** você
  está no projeto errado. Volte ao passo 1.
- **Faixa vermelha falando em `policy already exists`:** não deveria
  acontecer (o comando apaga antes de criar), mas se acontecer me mande o
  print — não tente de novo antes disso.
- **Diz `Success. No rows returned` e nenhuma tabela:** a conferência não
  rodou junto. Apague tudo da caixa, cole só a parte do `select` (as últimas
  oito linhas do bloco) e clique em `Run` de novo.

---

## Passo 4 — Ver a tela

1. Volte para o MUVUCA e recarregue a página (**`F5`**).
2. No menu da esquerda, clique em **`Aprovações`**.

**O que você vai ver se deu certo:** a tela abre no mês atual dizendo
**"Nenhum conteúdo planejado para este mês"**, com um botão
**`+ Novo conteúdo`** no canto de cima à direita.

**Se aparecer um erro falando em `conteudos`:** as tabelas não foram
criadas. Volte ao passo 3.

---

## Passo 5 — Fazer um teste de verdade

1. Clique em **`+ Novo conteúdo`**.
2. Preencha só o que quiser — nada é obrigatório além da data.
3. Clique em **`Salvar`**.

**O que você vai ver:** a peça aparece na lista do mês, com a etiqueta
cinza **`Rascunho`** e os botões para levá-la adiante.

Se der erro ao salvar, copie a mensagem e me mande: quer dizer que ainda
falta alguma coluna.

---

## O que ainda NÃO existe nesta etapa

Para você não procurar o que não está lá:

- **anexar arte ou vídeo** — etapa 2;
- **prévia de como fica no Instagram** — etapas 3 e 4;
- **mandar para o cliente aprovar** — etapa 6;
- **calendário do mês** — etapa 7.

Nesta etapa dá para cadastrar o mês inteiro, organizar e acompanhar o status
internamente. É a fundação das outras sete.
