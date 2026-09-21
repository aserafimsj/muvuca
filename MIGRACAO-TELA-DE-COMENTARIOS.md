# Migração — campos da IA

> **Esta migração precisa ser rodada de novo.** A consulta que você fez no
> banco mostrou que **nenhuma** destas colunas existe hoje. Alguma coisa deu
> errado na primeira tentativa, e este guia tem uma conferência no fim para a
> gente ver, na hora, se funcionou.

**Por que isto existe:** a IA já devolve três informações que o MUVUCA joga
fora por não ter onde guardar — a **recomendação** (responder, só curtir ou
não responder), o **motivo** da classificação e o alerta de **Jurídico/STN**
— mais o carimbo de **quando ela analisou** cada comentário, que é o que
impede o sistema de cobrar duas vezes pelo mesmo trabalho.

**Sem estas colunas, o botão "Classificar com IA" não funciona.** A IA
responde, o custo é cobrado, e a gravação falha.

**É seguro.** Só acrescenta colunas — não apaga nem reescreve nada. Rodar
duas vezes não faz mal: o comando diz "se ainda não existir, crie".

> **O que mudou desde a primeira versão deste guia:** a coluna `data_coment`
> saiu. A data do comentário passa a usar `data_publicacao`, que **já existe**
> no banco desde antes. Eu tinha criado uma coluna repetida sem perceber; como
> ela nunca chegou a ser criada de fato, não há nada a corrigir no banco.

---

## Passo 1 — Confirmar que você está no projeto certo

Este é o passo que provavelmente falhou da última vez.

1. Entre em **https://supabase.com** e faça login.
2. Clique no projeto do **MUVUCA**.
3. **Olhe o endereço na barra do navegador.** Ele tem este formato:

   `https://supabase.com/dashboard/project/`**`fkhbjpyoajkadpfjexkb`**

4. **Confira se o código depois de `/project/` é exatamente
   `fkhbjpyoajkadpfjexkb`.**

   - **É esse?** Ótimo, siga para o passo 2.
   - **É outro código?** **Pare.** Você está num projeto diferente daquele
     que o MUVUCA usa. Volte para a lista de projetos e escolha outro. Se não
     achar nenhum com esse código, me avise — o problema é outro.

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
alter table interacoes add column if not exists ia_em       timestamptz;
alter table interacoes add column if not exists ia_triagem  text;
alter table interacoes add column if not exists ia_motivo   text;
alter table interacoes add column if not exists ia_juridico boolean;

select column_name as coluna_criada, data_type as tipo
from information_schema.columns
where table_schema = 'public'
  and table_name  = 'interacoes'
  and column_name in ('ia_em','ia_triagem','ia_motivo','ia_juridico')
order by column_name;
```

**O que você vai ver:** uma tabela com **exatamente quatro linhas**:

| coluna_criada | tipo |
|---|---|
| ia_em | timestamp with time zone |
| ia_juridico | boolean |
| ia_motivo | text |
| ia_triagem | text |

**Essa tabela é a prova de que funcionou.** Se as quatro linhas aparecerem,
está feito.

### Se algo diferente aparecer

- **Tabela vazia, ou com menos de quatro linhas:** as colunas não foram
  criadas. Tire um print da tela inteira e me mande.
- **Faixa vermelha:** tire um print e me mande o texto do erro. Não tente de
  novo antes disso.
- **Diz `Success. No rows returned` e nenhuma tabela:** a conferência não
  rodou junto. Apague tudo da caixa, cole só a parte do `select` (as cinco
  últimas linhas do bloco) e clique em `Run` de novo.

---

## Passo 4 — Conferir no MUVUCA

1. Volte para o MUVUCA e recarregue a página (**`F5`**).
2. Abra **Community** e clique em **`Classificar com IA`** com **poucos**
   comentários — dois ou três. Se algo ainda estiver errado, falha pequena é
   mais barata.

**O que você vai ver se deu certo:** os comentários recebem sentimento e
rascunho, e aparecem etiquetas novas no cartão — a recomendação da IA e, nos
casos sensíveis, o alerta **Jurídico/STN**.

**Se aparecer uma janela de erro** dizendo "Erro ao salvar", copie a mensagem
e me mande: quer dizer que ainda falta alguma coluna.
