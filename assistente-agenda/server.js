import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { google } from "googleapis";
import * as chrono from "chrono-node";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// 🔧 Corrige cookies de sessão no Render
app.set("trust proxy", 1);


app.use(session({
  secret: process.env.SESSION_SECRET || 'minha-agenda-inteligente-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

let connectionSettings;
let isLoggedOut = false;

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || "https://assistente-agenda.onrender.com/auth/google-ui/callback";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google-ui/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      const user = {
        id: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        accessToken: accessToken,
        refreshToken: refreshToken
      };
      return done(null, user);
    }
  )
);

async function getAccessToken(req) {
  // 🔹 Se o usuário não estiver autenticado, lança erro
  if (!req || !req.user || !req.user.accessToken) {
    throw new Error("Usuário não autenticado. Faça login com o Google.");
  }

  // 🔹 Se o token ainda estiver válido na sessão
  if (connectionSettings?.settings?.expires_at && 
      new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    const cachedToken = connectionSettings?.settings?.access_token || 
                        connectionSettings?.settings?.oauth?.credentials?.access_token;
    if (!cachedToken) {
      throw new Error("Token em cache inválido. Reconectando ao Google Calendar...");
    }
    return cachedToken;
  }

  // 🔹 Se não tiver token em cache, tenta puxar via API do Render (caso exista integração)
  if (typeof fetch !== "undefined" && typeof hostname !== "undefined" && typeof xReplitToken !== "undefined") {
    connectionSettings = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=google-calendar`,
      {
        headers: {
          "Accept": "application/json",
          "X_REPLIT_TOKEN": xReplitToken
        }
      }
    ).then(res => res.json()).then(data => data.items?.[0]);

    if (!connectionSettings) {
      throw new Error("Google Calendar não está conectado. Configure a integração primeiro.");
    }

    const accessToken = connectionSettings?.settings?.access_token ||
                        connectionSettings?.settings?.oauth?.credentials?.access_token;

    if (!accessToken) {
      throw new Error("Não foi possível obter o token de acesso do Google Calendar.");
    }

    return accessToken;
  }

  // 🔹 Caso não haja integração, retorna o token do usuário logado via OAuth
  return req.user.accessToken;
}


async function getGoogleCalendarClient(req) {
  const accessToken = await getAccessToken(req);
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

function formatISOwithOffset(date) {
  const pad = (n) => n.toString().padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());

  return `${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`;
}


async function createCalendarEvent(summary, dateTime, duration = 60, isAllDay = false, req = null) {
  try {
    const calendar = await getGoogleCalendarClient(req);
    const startDate = new Date(dateTime);

    let event;

    if (isAllDay) {
      // Evento de dia inteiro
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const day = String(startDate.getDate()).padStart(2, '0');
      const startDateStr = `${year}-${month}-${day}`;

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      const endYear = endDate.getFullYear();
      const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
      const endDay = String(endDate.getDate()).padStart(2, '0');
      const endDateStr = `${endYear}-${endMonth}-${endDay}`;

      event = {
        summary,
        start: { date: startDateStr },
        end: { date: endDateStr },
        description: 'Evento criado pelo Assistente de Agenda Inteligente',
        colorId: '11'
      };
    } else {
      // Evento com horário
      const durationMinutes = duration || 60; // garante duração
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

      event = {
        summary,
        start: {
          dateTime: formatISOwithOffset(startDate),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: formatISOwithOffset(endDate),
          timeZone: 'America/Sao_Paulo',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
            { method: 'popup', minutes: 10 },
            { method: 'email', minutes: 60 }
          ]
        },
        description: 'Compromisso criado pelo Assistente de Agenda Inteligente',
        colorId: '9'
      };
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    if (response?.data?.id) {
      const eventType = isAllDay ? 'evento' : 'compromisso';
      const dateDisplay = isAllDay 
        ? startDate.toLocaleDateString('pt-BR') 
        : startDate.toLocaleString('pt-BR');
      const reminderMsg = isAllDay ? '' : ' 🔔 Lembretes: 30min, 10min antes e 1h por email';

      return {
        success: true,
        message: `✅ ${eventType.charAt(0).toUpperCase() + eventType.slice(1)} agendado com sucesso: "${summary}" em ${dateDisplay}${reminderMsg}`,
        eventId: response.data.id
      };
    } else {
      throw new Error("A API do Google não retornou confirmação de criação.");
    }

  } catch (error) {
    console.error('Erro ao criar evento:', error);
    return {
      success: false,
      message: '❌ Erro ao criar evento no Google Calendar: ' + (error.message || error)
    };
  }
}



async function analyzeAndCreateEvent(userMessage, req) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const now = new Date();
    const dataAtual = now.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const horaAtual = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const anoAtual = now.getFullYear();

    const prompt = `Você é um assistente de agenda inteligente altamente preciso. 

DATA E HORA ATUAL: ${dataAtual} às ${horaAtual} (${now.toISOString()})

IMPORTANTE - TIPOS DE EVENTOS:
1. EVENTOS DE DIA INTEIRO (is_all_day: true):
   - Aniversários, feriados, férias, datas comemorativas
   - Eventos que duram o dia todo SEM horário específico
   - Exemplos: "meu aniversário dia 4 de dezembro", "natal dia 25 de dezembro", "férias em janeiro"

2. COMPROMISSOS COM HORÁRIO (is_all_day: false):
   - Consultas, reuniões, lembretes com hora específica
   - Eventos com horário de início e/ou duração definida
   - Exemplos: "consulta médica amanhã às 14h", "reunião dia 10 às 9h", "almoço às 12h"

ANÁLISE DA MENSAGEM:
"${userMessage}"

REGRAS PARA INTERPRETAÇÃO DE DATA E HORA:
- Se o usuário mencionar "às 14 horas" ou "às 14h", o horário é EXATAMENTE 14:00:00
- Se mencionar "às 9 da manhã", usar 09:00:00
- Se mencionar "meio-dia" ou "12h", usar 12:00:00
- Se mencionar apenas a data sem hora, é um evento de dia inteiro
- Sempre use o timezone: -03:00 (America/Sao_Paulo)
- Se o ano não for mencionado, use ${anoAtual} se a data ainda não passou, senão use ${anoAtual + 1}

- Sempre priorize horário explícito, mesmo que a data seja genérica.
- Nunca arredonde horários; mantenha a precisão do que o usuário disse.
- Se não houver horário, considere evento de dia inteiro.

Se for uma solicitação de agendamento, responda APENAS com um JSON:
{
  "is_event": true,
  "event_type": "compromisso" ou "evento" ou "lembrete",
  "is_all_day": true ou false,
  "summary": "título claro e descritivo",
  "datetime": "data e hora PRECISA no formato ISO 8601 com timezone -03:00",
  "duration": número em minutos (ignorado se is_all_day for true)
}

Exemplo 1 - Evento de dia inteiro:
Entrada: "dia 4 de dezembro às 14 horas é meu aniversário"
{
  "is_event": true,
  "event_type": "evento",
  "is_all_day": true,
  "summary": "Meu aniversário",
  "datetime": "2025-12-04T00:00:00-03:00",
  "duration": 0
}

Exemplo 2 - Compromisso com horário:
Entrada: "marcar consulta médica dia 10 de dezembro às 15h"
{
  "is_event": true,
  "event_type": "compromisso",
  "is_all_day": false,
  "summary": "Consulta médica",
  "datetime": "2025-12-10T15:00:00-03:00",
  "duration": 60
}

Se NÃO for uma solicitação de agendamento, responda:
{
  "is_event": false,
  "response": "sua resposta amigável e útil"
}

Responda APENAS com o JSON válido, sem explicações adicionais.`;

    // 🔹 Gera o conteúdo usando o modelo e processa o JSON
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = await response.text();
    text = text.replace(/```json|```/g, "").trim();

    let analysis;
    try {
      analysis = JSON.parse(text);
    } catch (err) {
      console.error("Erro ao parsear JSON retornado pelo modelo:", text);
      throw new Error("Resposta do modelo inválida (não retornou JSON).");
    }

  if (analysis.is_event) {
  let eventDate = null;

  if (analysis.datetime) {
    const chronoDate = chrono.parseDate(userMessage, new Date(), { forwardDate: true });
    eventDate = chronoDate || new Date(analysis.datetime);
    console.log("⏱ Data final do evento:", eventDate.toString());
  } else {
    eventDate = chrono.parseDate(userMessage, new Date(), { forwardDate: true }) || null;
    console.log("⏱ Data calculada pelo chrono-node:", eventDate?.toString());
  }

  if (!eventDate || isNaN(eventDate.getTime())) {
    return {
      response: "⚠️ Não consegui entender a data e hora. Por favor, seja mais específico."
    };
  }

  const isAllDay = analysis.is_all_day === true;
  const eventResult = await createCalendarEvent(
    analysis.summary,
    eventDate,
    analysis.duration || 60,
    isAllDay,
    req
  );

  return { response: eventResult.message };

} else {
  // Caso não seja evento, responde normalmente
  return { response: analysis.response };
}


  } catch (error) {
    console.error('Erro na análise ou criação do evento:', error);

    // 🔹 Fallback seguro
    try {
      const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const fallbackPrompt = `Responda de forma amigável e útil à seguinte mensagem: "${userMessage}"`;
      const fallbackResult = await fallbackModel.generateContent(fallbackPrompt);
      const fallbackResp = await fallbackResult.response;
      const fallbackText = await fallbackResp.text();
      return { response: fallbackText };
    } catch (e) {
      console.error("Erro no fallback do modelo:", e);
      return { response: "⚠️ Ocorreu um erro ao processar sua mensagem. Tente novamente." };
    }
  }
}



app.get("/auth/status", async (req, res) => {
  try {
    if (req.user && req.user.accessToken) {
      return res.json({ 
        connected: true, 
        email: req.user.email,
        name: req.user.name,
        method: 'oauth'
      });
    }
    
    await getAccessToken();
    res.json({ connected: true, method: 'connector' });
  } catch (error) {
    res.json({ connected: false, message: error.message });
  }
});

app.post("/auth/logout", async (req, res) => {
  connectionSettings = null;
  isLoggedOut = true;
  
  req.logout((err) => {
    if (err) {
      console.error('Erro ao fazer logout:', err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Erro ao destruir sessão:', err);
      }
      res.json({ success: true, message: "Desconectado do Google Calendar" });
    });
  });
});

app.post("/auth/login", async (req, res) => {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return res.json({ 
      success: true, 
      redirectToOAuth: true,
      message: "Redirecionando para autenticação do Google..." 
    });
  }
  
  isLoggedOut = false;
  connectionSettings = null;
  try {
    await getAccessToken();
    res.json({ success: true, message: "Conectado ao Google Calendar" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.post("/mensagem", async (req, res) => {
  try {
    const { texto } = req.body;

    if (!texto || texto.trim() === "") {
      return res.status(400).json({ resposta: "⚠️ Mensagem vazia." });
    }

    const result = await analyzeAndCreateEvent(texto, req);
    res.json({ resposta: result.response });
  } catch (error) {
    console.error("Erro ao processar mensagem:", error);
    res.status(500).json({ resposta: "❌ Erro ao processar sua mensagem. Tente novamente." });
  }
});

// ✅ Serialização e desserialização do usuário (mantém sessão ativa)
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// 🔹 Rotas extras para login Google com interface simples (sem alterar o resto do sistema)
app.get(
  "/auth/google-ui/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    isLoggedOut = false; // ✅ resetando
    connectionSettings = null; // opcional, se você quiser limpar integração antiga
    res.redirect("/sucesso");
  }
);

app.get(
  "/auth/google-ui",
  passport.authenticate("google", {
    scope: ["profile", "email", "https://www.googleapis.com/auth/calendar"]
  })
);



app.get(
  "/auth/google-ui/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    isLoggedOut = false;
    connectionSettings = null;
    res.redirect("/sucesso");
  }
);

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/auth/google-ui");
}

// 🔹 Middleware para garantir que a sessão está salva antes de seguir
function ensureSession(req, res, next) {
  if (req.session && req.user) {
    return next();
  }

  req.session.save((err) => {
    if (err) console.error("Erro ao salvar sessão:", err);
    next();
  });
}


app.get("/sucesso", ensureSession, ensureAuthenticated, (req, res) => {
  const indexPath = path.join(__dirname, "public", "index.html");

  fs.readFile(indexPath, "utf8", (err, html) => {
    if (err) {
      console.error("Erro ao ler index.html:", err);
      return res.status(500).send("Erro interno do servidor");
    }

    // Cria o HTML que mostra o nome e token do usuário
    const userHtml = `
      <script>
        document.addEventListener("DOMContentLoaded", () => {
          const authStatus = document.getElementById("auth-status");
          const loginBtn = document.getElementById("login-btn");
          const logoutBtn = document.getElementById("logout-btn");

          if(authStatus) authStatus.textContent = "Olá, ${req.user.name}!";
          if(loginBtn) loginBtn.style.display = "none";
          if(logoutBtn) logoutBtn.style.display = "inline-block";

          console.log("Access Token:", "${req.user.accessToken}");
        });
      </script>
    `;

    // Insere o script antes de </body>
    const finalHtml = html.replace("</body>", `${userHtml}</body>`);

    res.send(finalHtml);
  });
});



app.get("/login", (req, res) => {
  res.send(`
    <h2>Bem-vindo!</h2>
    <button onclick="window.location.href='/auth/google-ui'">
      🔗 Conectar com Google
    </button>
  `);
});

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;
const API_KEY = process.env.GOOGLE_API_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET;



const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`);
});
