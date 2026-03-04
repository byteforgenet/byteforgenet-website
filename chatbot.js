// ==========================================
// BYTEFORGENET AI CHATBOT LOGIC
// ==========================================

const initChatbot = () => {
  const path = window.location.pathname;

  // Do not load chatbot on intro page (can load on login/dashboard as needed)
  if (path.includes("intro")) return;

  // 1. Inject the Chat UI
  const cuteRobotHTML = `
    <div class="cute-robot" style="--robot-scale: 1;">
      <div class="robot-head">
        <div class="robot-antenna left"></div>
        <div class="robot-antenna right"></div>
        <div class="robot-face">
          <div class="robot-eye left"></div>
          <div class="robot-eye right"></div>
          <div class="robot-cheek left"></div>
          <div class="robot-cheek right"></div>
          <div class="robot-mouth"></div>
        </div>
      </div>
      <div class="robot-body">
        <div class="robot-arm left"></div>
        <div class="robot-arm right"></div>
        <div class="robot-screen"></div>
      </div>
    </div>
  `;

  // 1. Inject the Chat UI
  const chatHTML = `
      <!-- Floating Chat Toggle Button -->
      <button id="chatbot-toggle" class="chatbot-toggle-btn">
        ${cuteRobotHTML.replace('--robot-scale: 1;', '--robot-scale: 0.7;').replace('class="cute-robot"', 'class="cute-robot small"')}
      </button>

      <!-- Chat Window UI -->
      <div id="chatbot-window" class="chatbot-window hidden">
        <div class="chatbot-header">
          <div class="chatbot-title">
            ${cuteRobotHTML}
            <div>
                <h4>Byteforge AI</h4>
                <p>Support Agent</p>
            </div>
          </div>
          <button id="chatbot-close" class="chatbot-close-btn">✕</button>
        </div>
        
        <div id="chatbot-messages" class="chatbot-messages">
          <!-- Initial Greeting -->
          <div class="chat-message bot">
            <div class="message-bubble">
              Hi there! I'm your Byteforgenet AI assistant. How can I help you today?
            </div>
          </div>
        </div>
        
        <!-- Sticky Typing Indicator -->
        <div id="chatbot-typing-container" class="chatbot-typing-container hidden">
           <div class="typing-bubble">
              <span id="typing-text"><i class="fas fa-brain"></i> Agent is analyzing project scope...</span>
              <div class="typing-dots"><span></span><span></span><span></span></div>
           </div>
        </div>
        
        <div class="chatbot-input-area">
          <input type="text" id="chatbot-input" placeholder="Ask about Byteforgenet..." autocomplete="off"/>
          <button id="chatbot-send">
             <svg fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
          </button>
        </div>
      </div>
    `;

  document.body.insertAdjacentHTML('beforeend', chatHTML);

  // 2. Chatbot State and DOM Links
  const toggleBtn = document.getElementById("chatbot-toggle");
  const closeBtn = document.getElementById("chatbot-close");
  const chatWindow = document.getElementById("chatbot-window");
  const sendBtn = document.getElementById("chatbot-send");
  const inputField = document.getElementById("chatbot-input");
  const messagesArea = document.getElementById("chatbot-messages");

  let isWaitingForResponse = false;
  let chatHistory = []; // Stores context for the current session

  // 3. UI Interactions
  const typingContainer = document.getElementById("chatbot-typing-container");
  const typingText = document.getElementById("typing-text");

  toggleBtn.addEventListener("click", () => {
    chatWindow.classList.toggle("hidden");
    if (!chatWindow.classList.contains("hidden")) {
      inputField.focus();
    }
  });

  closeBtn.addEventListener("click", () => {
    chatWindow.classList.add("hidden");
    chatHistory = []; // Clear memory when closed
  });

  const addMessage = (text, sender) => {
    const div = document.createElement("div");
    div.className = `chat-message ${sender}`;

    let content = `<div class="message-bubble">${escapeHtml(text)}</div>`;
    if (sender === "typing") {
      content = `
              <div class="message-bubble typing-indicator">
                <span></span><span></span><span></span>
              </div>
            `;
    }

    div.innerHTML = content;
    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    return div;
  };

  const escapeHtml = (unsafe) => {
    return (unsafe || "").toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  const handleSend = async () => {
    if (isWaitingForResponse) return;
    const text = inputField.value.trim();
    if (!text) return;

    // Add user message
    addMessage(text, "user");
    inputField.value = "";

    // Show sticky typing indicator
    isWaitingForResponse = true;
    chatWindow.classList.add("typing");

    // Check if prompt seems like a breakdown request
    const isProjectBreakdown = text.toLowerCase().includes("build") || text.toLowerCase().includes("create") || text.toLowerCase().includes("plan") || text.toLowerCase().includes("break down");

    if (isProjectBreakdown) {
      typingText.innerHTML = `<i class="fas fa-brain"></i> Agent is analyzing project scope...`;
    } else {
      typingText.innerHTML = `Typing...`;
    }

    typingContainer.classList.remove("hidden");

    try {
      // Pass the current team members to the AI
      const currentTeam = JSON.parse(localStorage.getItem("bf_team") || "[]");
      const teamMembers = currentTeam.map(m => ({ name: m.name, email: m.email }));

      const res = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send message, team, and the current session history
        body: JSON.stringify({ message: text, teamMembers: teamMembers, history: chatHistory })
      });

      // Update history with the user's message AFTER sending so it's not duplicated
      // but ensure it's in the array for the next turn.
      chatHistory.push({ role: "user", parts: [{ text: text }] });

      const data = await res.json();

      // Remove typing indicator
      typingContainer.classList.add("hidden");
      isWaitingForResponse = false;
      chatWindow.classList.remove("typing");

      if (res.ok) {
        // Render markdown reply safely (just the basic text for now)
        addMessage(data.reply, "bot");

        // Remember the bot's response
        chatHistory.push({ role: "model", parts: [{ text: data.reply }] });

        // Process potential AI action payloads
        if (data.action && data.action.type === "CREATE_TASKS") {
          const tasksToCreate = data.action.payload;

          // 1. Load the current Kanban board state from memory
          let board = JSON.parse(localStorage.getItem("bf_kanban") || '{"todo":[],"inprog":[],"done":[]}');
          const activities = JSON.parse(localStorage.getItem("bf_activity") || "[]");

          // 2. Process each generated task
          tasksToCreate.forEach(t => {
            let finalPriority = ["Low", "Med", "High"].includes(t.priority) ? t.priority : "Med";
            let finalCol = ["todo", "inprog", "done"].includes(t.column) ? t.column : "todo";
            let taskName = t.title;
            if (t.assignee) taskName += ` (Assigned to: ${t.assignee})`;

            // 3. Inject new task
            const newTask = {
              id: Date.now() + Math.random(), // ensure unique IDs during fast batch insert
              text: taskName,
              description: t.description || "",
              assigneeEmail: t.assigneeEmail || "",
              priority: finalPriority
            };
            board[finalCol].push(newTask);

            // Log activity
            activities.unshift(`Added task "${taskName}" via Byteforge AI`);

            // 3.5 Dispatch email notification if assigned
            if (t.assigneeEmail) {
              const inviterName = document.getElementById("topbarName")?.textContent || "A Team Member";
              fetch("http://localhost:3000/api/task-assign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  assigneeEmail: t.assigneeEmail,
                  assigneeName: t.assignee,
                  taskTitle: t.title,
                  taskDescription: t.description,
                  assignerName: inviterName
                })
              }).catch(err => console.error("Failed to notify assignee", err));
            }
          });

          // 4. Save to storage
          localStorage.setItem("bf_kanban", JSON.stringify(board));
          localStorage.setItem("bf_activity", JSON.stringify(activities.slice(0, 20)));

          // Sync flat dashboard task list
          const allTasks = [...board.todo, ...board.inprog, ...board.done.map(t => ({ ...t, done: true }))];
          localStorage.setItem("bf_tasks", JSON.stringify(allTasks));

          // 5. Tell the project UI to hot-reload if the user is on the project page
          window.dispatchEvent(new CustomEvent("refreshKanbanBoard"));

          // Add a follow up message showing the generated tasks
          setTimeout(() => {
            const htmlList = tasksToCreate.map(t => `<li><strong>${t.title}</strong><br/><span style="font-size:12px;color:#888">${t.description}</span></li>`).join('');
            addMessage(`Generated Subtasks:\n<ul style="margin:8px 0; padding-left:20px;">${htmlList}</ul>`, "bot");
          }, 500);
        } else if (data.action && data.action.type === "PREPARE_REPO") {
          const config = data.action.payload;

          // Build a visual preview card
          const cardHtml = `
                <div class="repo-preview-card" style="background: rgba(20,20,26,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 15px; margin-top: 10px; font-family: monospace; font-size: 13px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">
                        <strong style="color: #4f8cff; font-size: 15px;">${config.repoName}</strong>
                        <span style="background: ${config.isPrivate ? '#f43f5e' : '#22c55e'}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${config.isPrivate ? 'PRIVATE' : 'PUBLIC'}</span>
                    </div>
                    <p style="color: #aaa; margin: 0 0 10px 0;">${config.description || "No description provided."}</p>
                    <div style="display:flex; justify-content:space-between; color: #888;">
                        <span>Language: ${config.language || "None"}</span>
                        <span>Init Repo: Yes</span>
                    </div>
                    <button class="confirm-repo-btn" onclick="triggerRepoEmail('${encodeURIComponent(JSON.stringify(config))}')" style="width: 100%; margin-top: 15px; padding: 8px; background: #4f8cff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-family: sans-serif;">Send Confirmation Email</button>
                    <p class="repo-status-text" style="color: #86efac; font-size: 11px; text-align: center; margin: 8px 0 0 0; display: none;">Email sent! Check your inbox.</p>
                </div>
            `;
          addMessage(cardHtml, "bot");
        }

      } else {
        addMessage(data.error || "Sorry, I am experiencing technical difficulties.", "bot-error");
      }
    } catch (err) {
      console.error(err);
      typingContainer.classList.add("hidden");
      isWaitingForResponse = false;
      chatWindow.classList.remove("typing");
      addMessage("Network error. Could not connect to the AI.", "bot-error");
    }
  };

  sendBtn.addEventListener("click", handleSend);
  inputField.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSend();
  });
};

// Global function to trigger the email
window.triggerRepoEmail = async (encodedConfig) => {
  const config = JSON.parse(decodeURIComponent(encodedConfig));
  const btn = event.target;
  const statusText = btn.nextElementSibling;

  btn.textContent = "Sending...";
  btn.disabled = true;

  const userEmail = JSON.parse(localStorage.getItem('currentUser') || '{}').email;
  const userName = JSON.parse(localStorage.getItem('currentUser') || '{}').name;

  if (!userEmail) {
    alert("You must be logged in with an email to use this feature!");
    btn.textContent = "Send Confirmation Email";
    btn.disabled = false;
    return;
  }

  try {
    const res = await fetch("http://localhost:3000/api/repo-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...config,
        userEmail,
        userName
      })
    });

    const data = await res.json();

    if (res.ok) {
      btn.style.display = "none";
      statusText.style.display = "block";

      if (data.previewUrl) {
        console.log("TEST EMAIL PREVIEW: ", data.previewUrl);
        // Temporarily inject the link into the status for local testing
        statusText.innerHTML = `Email sent! <a href="${data.previewUrl}" target="_blank" style="color:#4f8cff">View Ethereal Inbox</a>`;
      }
    } else {
      alert("Failed: " + data.error);
      btn.textContent = "Send Confirmation Email";
      btn.disabled = false;
    }
  } catch (e) {
    console.error(e);
    alert("Network error.");
    btn.textContent = "Send Confirmation Email";
    btn.disabled = false;
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initChatbot);
} else {
  initChatbot();
}
