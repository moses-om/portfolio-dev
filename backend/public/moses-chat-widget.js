/**
 * Moses Local AI Assistant Widget (Phase 3 Frontend Integration)
 * Communicates locally with http://localhost:3001/api/chat (Gemini 3.5 Flash Backend)
 */
(function () {
  'use strict';

  // Prevent duplicate initialization
  if (document.getElementById('moses-local-assistant')) return;

  const API_BASE = window.MOSES_AI_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3001' : '');
  const API_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/api/chat`;
  let conversationHistory = [];

  // 1. Inject Scoped CSS Styles
  const style = document.createElement('style');
  style.id = 'moses-local-assistant-styles';
  style.textContent = `
    /* ═══════════════════════════════════════════════
       MOSES LOCAL AI ASSISTANT WIDGET STYLES
       ═══════════════════════════════════════════════ */
    #moses-local-assistant {
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      pointer-events: auto;
    }

    /* Floating Trigger Button */
    .moses-local-trigger-btn {
      position: relative;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0D1B3E 0%, #6B1A2A 100%);
      border: 2.5px solid #D4A017;
      box-shadow: 0 8px 24px rgba(13, 27, 62, 0.4);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;
      outline: none;
    }

    .moses-local-trigger-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 12px 30px rgba(107, 26, 42, 0.5);
    }

    .moses-local-trigger-btn svg {
      width: 26px;
      height: 26px;
      fill: #FFFFFF;
    }

    .moses-local-online-badge {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 13px;
      height: 13px;
      background: #1EBD64;
      border: 2px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 0 8px #1EBD64;
    }

    /* Teaser Pill */
    .moses-local-teaser-pill {
      background: #0D1B3E;
      color: #FFFFFF;
      padding: 8px 14px;
      border-radius: 16px 16px 16px 4px;
      font-size: 0.82rem;
      font-weight: 500;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(212, 160, 23, 0.4);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      animation: mosesLocalFloat 3s ease-in-out infinite;
    }

    @keyframes mosesLocalFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }

    /* Chat Window */
    .moses-local-chat-window {
      width: 360px;
      max-width: calc(100vw - 48px);
      height: 500px;
      max-height: calc(100vh - 100px);
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(13, 27, 62, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      display: none;
      border: 1px solid rgba(107, 26, 42, 0.2);
    }

    .moses-local-chat-window.open {
      display: flex;
      animation: mosesLocalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes mosesLocalSlideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Header */
    .moses-local-chat-header {
      background: linear-gradient(135deg, #0D1B3E 0%, #6B1A2A 100%);
      color: #FFFFFF;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .moses-local-header-title {
      font-weight: 600;
      font-size: 0.92rem;
      color: #FFFFFF;
    }

    .moses-local-header-subtitle {
      font-size: 0.72rem;
      opacity: 0.85;
      color: #D4A017;
      margin-top: 2px;
    }

    .moses-local-close-btn {
      background: rgba(255, 255, 255, 0.15);
      border: none;
      color: #FFFFFF;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      transition: background 0.2s;
    }

    .moses-local-close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    /* Message Stream */
    .moses-local-chat-messages {
      flex: 1;
      padding: 14px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #F8F9FA;
    }

    .moses-local-msg {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 0.85rem;
      line-height: 1.45;
      word-break: break-word;
    }

    .moses-local-msg.bot {
      background: #FFFFFF;
      color: #1A1A1A;
      align-self: flex-start;
      border-bottom-left-radius: 2px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      border: 1px solid rgba(0,0,0,0.06);
    }

    .moses-local-msg.user {
      background: #6B1A2A;
      color: #FFFFFF;
      align-self: flex-end;
      border-bottom-right-radius: 2px;
    }

    /* Section Navigation Links */
    .moses-local-nav-link {
      display: inline-block;
      margin: 3px 2px;
      padding: 3px 10px;
      background: rgba(107, 26, 42, 0.08);
      color: #6B1A2A;
      border: 1px solid rgba(107, 26, 42, 0.25);
      border-radius: 999px;
      font-weight: 600;
      font-size: 0.78rem;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .moses-local-nav-link:hover {
      background: #6B1A2A;
      color: #FFFFFF;
    }

    /* Quick Suggestion Chips */
    .moses-local-chips-wrapper {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .moses-local-chip-btn {
      background: #FFFFFF;
      border: 1px solid rgba(107, 26, 42, 0.25);
      color: #6B1A2A;
      font-size: 0.74rem;
      padding: 5px 10px;
      border-radius: 999px;
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 500;
    }

    .moses-local-chip-btn:hover {
      background: #6B1A2A;
      color: #FFFFFF;
    }

    /* Input Area */
    .moses-local-input-area {
      padding: 10px 12px;
      background: #FFFFFF;
      border-top: 1px solid rgba(0,0,0,0.08);
      display: flex;
      gap: 8px;
    }

    .moses-local-input {
      flex: 1;
      border: 1px solid rgba(0,0,0,0.15);
      border-radius: 999px;
      padding: 8px 14px;
      font-size: 0.84rem;
      outline: none;
      color: #1A1A1A;
    }

    .moses-local-input:focus {
      border-color: #6B1A2A;
    }

    .moses-local-send-btn {
      background: #6B1A2A;
      color: #FFFFFF;
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }

    .moses-local-send-btn:hover {
      transform: scale(1.06);
    }
  `;
  document.head.appendChild(style);

  // 2. Inject HTML Markup
  const container = document.createElement('div');
  container.id = 'moses-local-assistant';
  container.innerHTML = `
    <!-- Chat Window -->
    <div class="moses-local-chat-window" id="mosesLocalChatWindow">
      <div class="moses-local-chat-header">
        <div>
          <div class="moses-local-header-title">Moses AI Assistant</div>
          <div class="moses-local-header-subtitle">● Gemini 3.5 Flash Backend</div>
        </div>
        <button class="moses-local-close-btn" id="mosesLocalCloseBtn" aria-label="Close Chat">✕</button>
      </div>

      <div class="moses-local-chat-messages" id="mosesLocalMessages">
        <div class="moses-local-msg bot">
          Hi! 👋 I'm Moses's AI Assistant powered by local Gemini 3.5 Flash. What would you like to know about his background, Power BI dashboards, data engineering, or published research?
          <div class="moses-local-chips-wrapper">
            <button class="moses-local-chip-btn" data-query="Tell me about Moses's degree & educational background.">🎓 Education</button>
            <button class="moses-local-chip-btn" data-query="Tell me about Moses's Power BI experience & Ashesi ranking system.">📊 Power BI</button>
            <button class="moses-local-chip-btn" data-query="What are Moses's core technical skills in SQL, Python, and AI?">🛠️ Skills</button>
            <button class="moses-local-chip-btn" data-query="How can I contact or hire Moses?">📬 Contact</button>
          </div>
        </div>
      </div>

      <form class="moses-local-input-area" id="mosesLocalForm">
        <input type="text" class="moses-local-input" id="mosesLocalInput" placeholder="Ask a question about Moses..." autocomplete="off" />
        <button type="submit" class="moses-local-send-btn" aria-label="Send Message">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </form>
    </div>

    <!-- Teaser Pill & Floating Trigger Button -->
    <div class="moses-local-teaser-pill" id="mosesLocalTeaser">
      <span>💬 Ask Moses AI</span>
    </div>

    <button class="moses-local-trigger-btn" id="mosesLocalTriggerBtn" title="Moses Local AI Assistant">
      <svg viewBox="0 0 24 24">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5.025L2 22l4.975-1.338A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.476 0-2.886-.36-4.13-1.002l-.297-.154-3.048.818.818-3.048-.154-.297A7.954 7.954 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/>
      </svg>
      <div class="moses-local-online-badge"></div>
    </button>
  `;
  document.body.appendChild(container);

  // 3. UI Element References
  const chatWindow = document.getElementById('mosesLocalChatWindow');
  const triggerBtn = document.getElementById('mosesLocalTriggerBtn');
  const teaserPill = document.getElementById('mosesLocalTeaser');
  const closeBtn = document.getElementById('mosesLocalCloseBtn');
  const messagesArea = document.getElementById('mosesLocalMessages');
  const form = document.getElementById('mosesLocalForm');
  const input = document.getElementById('mosesLocalInput');

  // 4. Toggle Chat Window
  function toggleChat(show) {
    const isCurrentlyOpen = chatWindow.classList.contains('open');
    const shouldOpen = typeof show === 'boolean' ? show : !isCurrentlyOpen;
    if (shouldOpen) {
      chatWindow.classList.add('open');
      teaserPill.style.display = 'none';
      input.focus();
    } else {
      chatWindow.classList.remove('open');
      teaserPill.style.display = 'flex';
    }
  }

  triggerBtn.addEventListener('click', () => toggleChat());
  teaserPill.addEventListener('click', () => toggleChat(true));
  closeBtn.addEventListener('click', () => toggleChat(false));

  // Handle Quick Action Chips
  messagesArea.addEventListener('click', (e) => {
    const chip = e.target.closest('.moses-local-chip-btn');
    if (chip) {
      const query = chip.getAttribute('data-query');
      if (query) sendQuery(query);
    }
  });

  // Handle Form Submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) sendQuery(text);
  });

  // 5. Send Query & Stream Response from Local Gemini Backend
  async function sendQuery(userText) {
    // Append User Message
    appendMessage(userText, 'user');
    conversationHistory.push({ role: 'user', content: userText });
    input.value = '';

    // Show Thinking Indicator
    const typingIndicator = appendMessage('<span style="opacity:0.6; font-style:italic;">Moses AI is thinking...</span>', 'bot', 'moses-typing');

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory
        })
      });

      const data = await response.json();
      if (typingIndicator) typingIndicator.remove();

      if (data.success && data.response) {
        const replyText = data.response;
        conversationHistory.push({ role: 'assistant', content: replyText });
        appendMessage(formatMessageHtml(replyText), 'bot');
      } else {
        const errorText = data.error || 'Unable to connect to local Gemini backend.';
        appendMessage(`⚠️ <em>${errorText}</em>`, 'bot');
      }
    } catch (err) {
      if (typingIndicator) typingIndicator.remove();
      appendMessage(`⚠️ <em>Unable to reach local backend at ${API_ENDPOINT}. Please verify server is running on port 3001.</em>`, 'bot');
    }
  }

  // 6. Append Message to Stream
  function appendMessage(htmlContent, sender, customId) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `moses-local-msg ${sender}`;
    if (customId) msgDiv.id = customId;
    msgDiv.innerHTML = htmlContent;
    messagesArea.appendChild(msgDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    return msgDiv;
  }

  // 7. Parse Markdown & Section Navigation Links
  function formatMessageHtml(rawText) {
    let text = rawText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Convert markdown bold **text** -> <strong>text</strong>
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/\n/g, '<br>');

    // Convert Section Tags (#projects, #about, #skills, #experience, #research, #contact) to Clickable Buttons
    const sectionTags = ['#projects', '#about', '#skills', '#experience', '#research', '#contact'];
    sectionTags.forEach(tag => {
      const reg = new RegExp(tag, 'gi');
      text = text.replace(reg, `<a class="moses-local-nav-link" data-section="${tag.substring(1)}">${tag} →</a>`);
    });

    return text;
  }

  // Delegate Navigation Clicks
  messagesArea.addEventListener('click', (e) => {
    const navBtn = e.target.closest('.moses-local-nav-link');
    if (navBtn) {
      const sectionId = navBtn.getAttribute('data-section');
      if (sectionId) {
        const targetEl = document.getElementById(sectionId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  });

})();
