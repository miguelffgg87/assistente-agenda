# Assistente de Agenda com IA e Google Calendar

Um assistente inteligente de agenda que integra a API do Google Calendar e a IA Gemini para entender comandos em linguagem natural e criar eventos automaticamente.  
Desenvolvido em Node.js com Express, este projeto permite que o usuário insira frases como  
> "Marcar reunião amanhã às 15h com o João"  
e o sistema cria o evento diretamente na conta do Google vinculada.

---

## Sobre o Projeto

O Assistente de Agenda tem como objetivo simplificar a organização de compromissos por meio de linguagem natural.  
Em vez de preencher formulários ou datas manualmente, o usuário apenas escreve o que deseja — e a IA interpreta, converte e agenda o evento no Google Calendar.

O sistema possui:
- Login com conta Google (OAuth 2.0)
- Interpretação de texto via Google Gemini
- Criação automática de eventos na agenda
- Servidor em Express.js
- Estrutura pronta para deploy no Render

---

## Arquitetura do Sistema

Usuário → Interface Web (HTML/CSS/JS)
↓
Servidor Express (Node.js)
↓
Autenticação OAuth 2.0 (Google)
↓
API do Gemini (interpretação)
↓
API do Google Calendar (criação do evento)

---

## Tecnologias Utilizadas

- Node.js  
- Express.js  
- Google APIs (OAuth2, Calendar)  
- Google Gemini (IA Generativa)  
- Body-Parser  
- Express-Session  
- Chrono-Node (interpretação de datas)  
- dotenv  

---

## Como Executar Localmente

1. Clonar o repositório

   ```bash
   git clone https://github.com/miguelffgg87/assistente-agenda
   cd assistente-agenda
   
2. Instalar dependências

   npm install

3. Executar o servidor

   npm start
   
5. O servidor estará acessível em:

http://localhost:3000

Deploy
O projeto pode ser implantado diretamente no Render, com os seguintes comandos:

Build Command:
npm install

Start Command:
npm start

A integração contínua (CI/CD) é automática — qualquer alteração na branch main dispara um novo deploy.

Repositório: https://github.com/miguelffgg87/assistente-agenda

Exemplos de Uso
O assistente é capaz de interpretar comandos como:

"Adicionar almoço com Maria amanhã às 13h"

"Marcar reunião com equipe terça às 10 da manhã"

"Criar evento: entregar projeto dia 20 às 15h"

"Agendar consulta médica segunda às 9h"

Solução de Problemas (Troubleshooting)
Erro	Causa	Solução
Erro 400 no login Google	URL de callback incorreta	Verifique se GOOGLE_CALLBACK_URL está igual ao configurado no Console Google
invalid_grant	Sessão expirada	Faça logout e tente novamente
Erro 403 ao criar evento	Falta de permissão Calendar API	Ative a API do Google Calendar no Console Cloud
Erro 500 no servidor	Variáveis ausentes	Verifique se todas as chaves estão no .env

Roadmap Futuro
Integração com Google Tasks

Suporte a múltiplas agendas

Interface visual para edição de eventos

Suporte a voz (Speech-to-Text)

Contribuição
Contribuições são bem-vindas.

Faça um fork do projeto

Crie uma branch (git checkout -b feature/nova-funcionalidade)

Faça commit das mudanças (git commit -m 'Adiciona nova funcionalidade')

Faça push (git push origin feature/nova-funcionalidade)

Abra um Pull Request

Código de Conduta
Este projeto segue princípios de respeito e colaboração.
Ao contribuir, evite linguagem ofensiva, preconceituosa ou discriminatória.
Trabalhe de forma construtiva e mantenha a comunicação clara.

Autor
Miguel dos Santos da Silva
E-mail: migueldossantosdasilva87@gmail.com
Repositório: [assistente-agenda](https://github.com/miguelffgg87/assistente-agenda)

