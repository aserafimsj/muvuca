# Migração — campos da tela de comentários completa

**Por que isto existe:** a IA já devolve três informações que o MUVUCA está
jogando fora hoje, porque não tem onde guardar: a **recomendação** (responder,
só curtir ou não responder), o **motivo** da classificação e o alerta de
**Jurídico/STN**. Esta migração cria o lugar delas, mais a **data do
comentário**.

**É seguro.** Só acrescenta campos — não apaga nem reescreve nada. Rodar duas
vezes por engano não faz mal.

> **Rode a `MIGRACAO-CARIMBO-DA-IA.md` antes desta**, se ainda não tiver
> rodado. As duas são independentes, mas a ordem mantém as coisas simples.

---

## Passo 1 — Abrir o editor de SQL do Supabase

1. Entre em **https://supabase.com** e faça login.
2. Na lista de projetos, clique no projeto do **MUVUCA**.
3. No **menu da esquerda**, clique em **`SQL Editor`** (ícone de folha de
   papel com `SQL` escrito).
4. Clique em **`New query`**, no alto.

---

## Passo 2 — Colar o comando

Copie o bloco abaixo **inteiro** e cole na área vazia:

```sql
alter table interacoes add column if not exists ia_triagem   text;
alter table interacoes add column if not exists ia_motivo    text;
alter table interacoes add column if not exists ia_juridico  boolean;
alter table interacoes add column if not exists data_coment  date;
```

Clique em **`Run`** (canto de baixo à direita; em algumas telas é um
triângulo ▶).

**O que você vai ver:** faixa verde escrito **`Success. No rows returned`**.

> Faixa vermelha? **Pare** e me mande o texto do erro.

---

## Passo 3 — Conferir no MUVUCA

1. Volte para o MUVUCA e recarregue a página (**`F5`**).
2. Abra **Community**.

**O que você vai ver em cada comentário:**

- Campos novos para preencher: **Post**, **Data do comentário**, e listas
  para escolher **Rede**, **Origem**, **Produto** e **Editoria** — antes
  esses quatro só apareciam, não dava para mudar.
- O texto do comentário agora é **editável** (dá para corrigir um texto que
  veio torto da colagem).
- Nos comentários que a IA já analisou depois desta migração, uma etiqueta
  com a **recomendação dela** e o **motivo** em poucas palavras.
- Dois botões na resposta: **Gerar de novo** (pede outro rascunho à IA, só
  daquele comentário) e **Copiar resposta**.

---

## O que NÃO mudou

- Nada do que você escreveu ou corrigiu à mão foi tocado.
- O campo **Post** reaproveita o `link_conteudo` que o MUVUCA já usava —
  não criei um campo repetido. O que você já tinha colado continua lá.
- O seletor **Pendente / Respondido / Ignorar** continua sendo o seu estado
  de trabalho. A recomendação da IA é uma etiqueta separada, informativa: ela
  **não** mexe nesse seletor.

---

## Ainda não é esta etapa

O campo **Status** do Zmetrics (Em andamento, Escalado, Arquivado) e as abas
**Respondidos / Não Respondidos / Histórico / Lixeira** vêm na etapa seguinte,
junto com o fluxo de trabalho inteiro. Pôr o seletor de Status agora, sem as
abas que dão sentido a ele, só deixaria um controle solto na tela.
